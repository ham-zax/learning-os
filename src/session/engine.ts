/**
 * Session orchestrator for the tutor engine.
 *
 * Manages the full lifecycle of a tutoring session:
 *   1. Start a session (create DB record, select concepts by mode)
 *   2. Present concepts (delegated to mode-specific logic)
 *   3. Grade user responses (SM-2 integration)
 *   4. End session (summary stats)
 */

import type Database from "better-sqlite3";
import type { Concept } from "../db/types.js";
import type { SM2Result, ConceptStatus } from "../sm2.js";
import {
  createSession,
  getSession,
  updateSession,
  getConceptsByTopic,
  getConcept,
  getReviewsBySession,
  updateTopic,
  updateConcept,
  createReview,
} from "../db/database.js";
import {
  getConceptState,
  getDueConcepts,
} from "../state.js";
import { sm2, updateStatus } from "../sm2.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionConfig {
  topicId: string;
  mode: "explore" | "quiz" | "teach-back";
  maxConcepts?: number; // default: based on daily_minutes
  maxMinutes?: number; // default: from config
}

export interface SessionState {
  sessionId: number;
  topicId: string;
  mode: string;
  concepts: Concept[]; // selected for this session
  currentIndex: number;
  startedAt: string;
}

export interface GradedResponse {
  conceptId: string;
  grade: number; // 0-5
  feedback: string;
  sm2Result: SM2Result;
  newStatus: ConceptStatus;
}

export interface SessionSummary {
  sessionId: number;
  topicId: string;
  mode: string;
  conceptsReviewed: number;
  grades: number[];
  averageGrade: number;
  duration: number; // seconds
  nextDueDate: string | null; // earliest next review
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_DAILY_MINUTES = 30;

/** Rough estimate: ~3 min per concept in explore/teach-back, ~2 min in quiz. */
function defaultMaxConcepts(dailyMinutes: number, mode: string): number {
  const minutesPerConcept = mode === "quiz" ? 2 : 3;
  return Math.max(3, Math.floor(dailyMinutes / minutesPerConcept));
}

// ─── Concept Selection ──────────────────────────────────────────────────────

/**
 * Select concepts for a session based on the learning mode.
 *
 * - **explore**: pick unseen concepts in prerequisite order
 * - **quiz**: pick due concepts + interleave 2-3 older reviewed concepts
 * - **teach-back**: pick reviewing concepts (reviewed at least once)
 */
export function selectConcepts(
  db: Database.Database,
  topicId: string,
  mode: string,
  maxConcepts: number,
): Concept[] {
  const allConcepts = getConceptsByTopic(db, topicId);

  switch (mode) {
    case "explore":
      return selectExplore(allConcepts, maxConcepts);
    case "quiz":
      return selectQuiz(db, topicId, allConcepts, maxConcepts);
    case "teach-back":
      return selectTeachBack(allConcepts, maxConcepts);
    default:
      return selectExplore(allConcepts, maxConcepts);
  }
}

/**
 * Explore mode: pick unseen concepts, respecting prerequisite order.
 * A concept's prerequisites must all be in reviewing/mastered status
 * (or absent from the topic) before it is eligible.
 */
function selectExplore(
  allConcepts: Concept[],
  maxConcepts: number,
): Concept[] {
  const byId = new Map(allConcepts.map((c) => [c.id, c]));
  const mastered = new Set(
    allConcepts
      .filter((c) => c.status === "reviewing" || c.status === "mastered")
      .map((c) => c.id),
  );

  // Filter to unseen concepts whose prerequisites are satisfied
  const eligible = allConcepts.filter((c) => {
    if (c.status !== "unseen") return false;
    return c.prerequisites.every(
      (pre) => !byId.has(pre) || mastered.has(pre),
    );
  });

  // Sort by difficulty, then by number of prerequisites (fewer first)
  eligible.sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.prerequisites.length - b.prerequisites.length;
  });

  return eligible.slice(0, maxConcepts);
}

/**
 * Quiz mode: pick due concepts (next_review <= today or NULL) and
 * interleave 2-3 older reviewed concepts for reinforcement.
 */
function selectQuiz(
  db: Database.Database,
  topicId: string,
  allConcepts: Concept[],
  maxConcepts: number,
): Concept[] {
  const today = new Date().toISOString().slice(0, 10);

  // Due concepts: next_review <= today OR next_review IS NULL
  const due = allConcepts
    .filter((c) => c.next_review === null || c.next_review <= today)
    .sort((a, b) => {
      // NULLs first (never reviewed), then by next_review ascending
      if (a.next_review === null && b.next_review !== null) return -1;
      if (a.next_review !== null && b.next_review === null) return 1;
      return (a.next_review ?? "").localeCompare(b.next_review ?? "");
    });

  // Older reviewed concepts: not due, status is reviewing/mastered
  const olderReviewed = allConcepts
    .filter(
      (c) =>
        c.next_review !== null &&
        c.next_review > today &&
        (c.status === "reviewing" || c.status === "mastered"),
    )
    .sort(() => Math.random() - 0.5); // shuffle for variety

  // Interleave: take all due, then fill remaining slots with older reviewed
  const result: Concept[] = [];
  const seen = new Set<string>();

  for (const c of due) {
    if (result.length >= maxConcepts) break;
    result.push(c);
    seen.add(c.id);
  }

  const interleavedCount = Math.min(
    3,
    maxConcepts - result.length,
    olderReviewed.length,
  );
  for (let i = 0; i < interleavedCount; i++) {
    if (!seen.has(olderReviewed[i].id)) {
      result.push(olderReviewed[i]);
    }
  }

  return result.slice(0, maxConcepts);
}

/**
 * Teach-back mode: pick concepts in "reviewing" status (reviewed at least
 * once but not yet mastered). These are concepts the learner has some
 * familiarity with and should be able to explain.
 */
function selectTeachBack(
  allConcepts: Concept[],
  maxConcepts: number,
): Concept[] {
  const reviewing = allConcepts
    .filter((c) => c.status === "reviewing")
    .sort((a, b) => {
      // Prioritize those with lower easiness factor (harder for the learner)
      if (a.ef !== b.ef) return a.ef - b.ef;
      // Then by most overdue
      return (a.next_review ?? "").localeCompare(b.next_review ?? "");
    });

  // If not enough reviewing concepts, supplement with learning concepts
  if (reviewing.length < maxConcepts) {
    const learning = allConcepts
      .filter((c) => c.status === "learning")
      .sort((a, b) => a.ef - b.ef);

    const result = [...reviewing];
    for (const c of learning) {
      if (result.length >= maxConcepts) break;
      result.push(c);
    }
    return result.slice(0, maxConcepts);
  }

  return reviewing.slice(0, maxConcepts);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start a new tutoring session.
 *
 * Creates a session record in the DB, selects concepts for the session
 * based on mode, and returns the initial SessionState.
 */
export function startSession(
  db: Database.Database,
  config: SessionConfig,
): SessionState {
  const { topicId, mode } = config;

  // Derive defaults from config
  const dailyMinutes = DEFAULT_DAILY_MINUTES;
  const maxConcepts =
    config.maxConcepts ?? defaultMaxConcepts(dailyMinutes, mode);
  const maxMinutes = config.maxMinutes ?? dailyMinutes;

  // Create session record
  const session = createSession(db, { topicId, mode });

  // Select concepts for this session
  const concepts = selectConcepts(db, topicId, mode, maxConcepts);

  // Update session with selected concept IDs
  updateSession(db, session.id, {
    conceptsReviewed: concepts.map((c) => c.id),
  });

  // Update topic's last_session timestamp
  updateTopic(db, topicId, {
    last_session: session.started_at ?? new Date().toISOString(),
  });

  return {
    sessionId: session.id,
    topicId,
    mode,
    concepts,
    currentIndex: 0,
    startedAt: session.started_at ?? new Date().toISOString(),
  };
}

/**
 * Grade a user's response to a concept.
 *
 * Runs the SM-2 algorithm, updates the concept's state in the DB,
 * creates a review record, and returns the grading result.
 *
 * @param db       Database instance
 * @param conceptId  The concept being reviewed
 * @param grade    Quality of recall (0-5, where >= 3 is successful)
 * @param mode     Session mode (for the review record)
 * @param sessionId Optional session ID to link the review to
 * @param response Optional user response text (stored in review record)
 * @returns        GradedResponse with SM-2 result and new status
 */
export function gradeResponse(
  db: Database.Database,
  conceptId: string,
  grade: number,
  mode: string,
  sessionId?: number,
  response?: string,
): GradedResponse {
  // Clamp grade to valid range
  const clampedGrade = Math.max(0, Math.min(5, Math.round(grade)));

  // Get current concept state
  const concept = getConceptState(db, conceptId);
  const today = new Date().toISOString().slice(0, 10);

  // Run SM-2 algorithm
  const sm2Result = sm2(
    clampedGrade,
    concept.ef,
    concept.interval,
    concept.repetitions,
    today,
  );

  // Derive new status
  const newStatus: ConceptStatus = updateStatus(
    concept.status,
    clampedGrade,
    sm2Result.repetitions,
    sm2Result.interval,
  );

  // Generate feedback based on grade
  const feedback = generateFeedback(clampedGrade, concept.status, newStatus);

  // Update concept in DB
  updateConcept(db, conceptId, {
    ef: sm2Result.ef,
    interval: sm2Result.interval,
    repetitions: sm2Result.repetitions,
    next_review: sm2Result.nextReview,
    last_grade: clampedGrade,
    status: newStatus,
  });

  // Create review record linked to the session if provided
  createReview(db, {
    sessionId: sessionId ?? null,
    conceptId,
    grade: clampedGrade,
    mode,
    response,
    feedback,
  });

  return {
    conceptId,
    grade: clampedGrade,
    feedback,
    sm2Result,
    newStatus,
  };
}

/**
 * End a tutoring session and return summary statistics.
 *
 * Calculates grades, duration, and the earliest next review date.
 * Updates the session record with ended_at timestamp.
 */
export function endSession(
  db: Database.Database,
  sessionId: number,
): SessionSummary {
  const session = getSession(db, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Get all reviews for this session
  const reviews = getReviewsBySession(db, sessionId);
  const grades = reviews.map((r) => r.grade);
  const conceptsReviewed = new Set(reviews.map((r) => r.concept_id)).size;

  // Calculate average grade
  const averageGrade =
    grades.length > 0
      ? grades.reduce((sum, g) => sum + g, 0) / grades.length
      : 0;

  // Calculate duration in seconds
  const startedAt = session.started_at
    ? new Date(session.started_at)
    : new Date();
  const endedAt = new Date();
  const duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

  // Find earliest next review date from reviewed concepts
  const conceptIds = session.concepts_reviewed;
  let nextDueDate: string | null = null;

  for (const cid of conceptIds) {
    const concept = getConcept(db, cid);
    if (concept?.next_review) {
      if (nextDueDate === null || concept.next_review < nextDueDate) {
        nextDueDate = concept.next_review;
      }
    }
  }

  // Update session record with ended_at
  updateSession(db, sessionId, {
    endedAt: endedAt.toISOString(),
  });

  return {
    sessionId,
    topicId: session.topic_id,
    mode: session.mode,
    conceptsReviewed,
    grades,
    averageGrade: Math.round(averageGrade * 100) / 100,
    duration,
    nextDueDate,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate human-readable feedback based on the grade and status transition.
 */
function generateFeedback(
  grade: number,
  oldStatus: string,
  newStatus: string,
): string {
  // Status transition messages
  if (oldStatus !== newStatus) {
    switch (newStatus) {
      case "learning":
        if (oldStatus === "unseen") {
          return "New concept introduced. Keep practicing to build familiarity.";
        }
        return "Back to learning. Review the material and try again.";
      case "reviewing":
        return "Good progress! Moving to spaced review intervals.";
      case "mastered":
        return "Excellent! This concept is now mastered.";
    }
  }

  // Grade-based feedback for same-status
  if (grade >= 4) {
    return "Great recall! Keep it up.";
  }
  if (grade === 3) {
    return "Adequate recall. A bit more practice will strengthen it.";
  }
  if (grade === 2) {
    return "Partial recall. Review the material and try again soon.";
  }
  return "Needs more practice. Don't worry, repetition builds mastery.";
}
