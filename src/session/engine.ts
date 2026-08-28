/**
 * Session orchestrator for the tutor engine.
 *
 * Manages the ordinary tutoring-session lifecycle:
 *   1. Start a session (create DB record, select concepts by delivery context)
 *   2. Prepare an objective-backed frozen challenge for each assessable response
 *   3. End the session with attempt/submission summary facts
 *
 * Learner work is persisted through the kernel attempt APIs. Assessment and
 * learner-state projection are separate kernel responsibilities.
 */

import type Database from "better-sqlite3";
import type { ChallengeSpec, Concept, DeliveryContext } from "../db/types.js";
import {
  createSession,
  getSession,
  updateSession,
  getConceptsByTopic,
  updateTopic,
} from "../db/database.js";
import {
  createLearningObjective,
  getChallenge,
  getLearningObjective,
  registerChallenge,
} from "../kernel/foundation.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionConfig {
  topicId: string;
  mode: DeliveryContext;
  maxConcepts?: number; // default: based on daily_minutes
  maxMinutes?: number; // default: from config
}

export interface SessionState {
  sessionId: number;
  topicId: string;
  mode: DeliveryContext;
  concepts: Concept[]; // selected for this session
  currentIndex: number;
  startedAt: string;
}

export interface OrdinaryChallengeSurface {
  surfaceId: string;
  prompt: string;
  referenceMaterial?: string[];
}

export interface PreparedOrdinaryChallenge {
  objectiveId: string;
  challenge: ChallengeSpec;
}

export interface SessionSummary {
  sessionId: number;
  topicId: string;
  mode: DeliveryContext;
  challengesAttempted: number;
  submittedAttempts: number;
  assessedAttempts: number;
  pendingAssessmentAttempts: number;
  duration: number; // seconds
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_DAILY_MINUTES = 30;

/** Rough estimate: ~3 min per concept in learn/practice, ~2 min in review. */
function defaultMaxConcepts(dailyMinutes: number, mode: DeliveryContext): number {
  const minutesPerConcept = mode === "review" ? 2 : 3;
  return Math.max(3, Math.floor(dailyMinutes / minutesPerConcept));
}

// ─── Concept Selection ──────────────────────────────────────────────────────

/**
 * Select concepts for an ordinary session based on delivery context.
 *
 * - **learn**: use the existing explore strategy for unseen concepts
 * - **review**: use the existing quiz strategy for due/interleaved concepts
 * - **practice**: use the existing teach-back strategy for reviewed concepts
 */
export function selectConcepts(
  db: Database.Database,
  topicId: string,
  mode: DeliveryContext,
  maxConcepts: number,
): Concept[] {
  const allConcepts = getConceptsByTopic(db, topicId);

  switch (mode) {
    case "learn":
      return selectExplore(allConcepts, maxConcepts);
    case "review":
      return selectQuiz(db, topicId, allConcepts, maxConcepts);
    case "practice":
      return selectTeachBack(allConcepts, maxConcepts);
    case "interview":
    case "mock":
      throw new Error(`Delivery context ${mode} is not supported by ordinary sessions.`);
    default:
      throw new Error(`Unknown delivery context: ${String(mode)}`);
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

  // Select concepts before persisting so unsupported contexts cannot create sessions.
  const concepts = selectConcepts(db, topicId, mode, maxConcepts);

  // Create session record
  const session = createSession(db, { topicId, mode });

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
 * Ensure the ordinary explanation objective exists, then register or reuse the
 * frozen challenge for one stable learner-visible surface.
 *
 * An exact prompt reuses its existing frozen challenge. If the prompt changes
 * in the same stable surface slot, a new challenge/rubric version is frozen
 * instead of mutating the prior assessment contract.
 */
export function prepareOrdinaryChallenge(
  db: Database.Database,
  concept: Concept,
  mode: DeliveryContext,
  surface: OrdinaryChallengeSurface,
): PreparedOrdinaryChallenge {
  if (mode === "interview" || mode === "mock") {
    throw new Error(`Delivery context ${mode} is not supported by ordinary sessions.`);
  }

  const canonicalObjectiveId = `${concept.id}:explain`;
  const canonicalObjective = getLearningObjective(db, canonicalObjectiveId);
  let objectiveId: string;

  if (canonicalObjective) {
    if (
      canonicalObjective.concept_id !== concept.id ||
      canonicalObjective.capability_id !== "explain"
    ) {
      throw new Error(`Objective ID collision: ${canonicalObjectiveId}`);
    }
    objectiveId = canonicalObjective.id;
  } else {
    const existingObjective = db
      .prepare(
        `SELECT id FROM learning_objectives
         WHERE concept_id = ? AND capability_id = 'explain'`,
      )
      .get(concept.id) as { id: string } | undefined;

    if (existingObjective) {
      objectiveId = existingObjective.id;
    } else {
      objectiveId = canonicalObjectiveId;
      createLearningObjective(db, {
        id: objectiveId,
        conceptId: concept.id,
        capabilityId: "explain",
      });
    }
  }

  const ordinaryChallengePrefix = `ordinary:${concept.id}:explain:${mode}:`;
  const matchingFrozen = db
    .prepare(
      `SELECT challenge.challenge_id, challenge.version
       FROM challenge_versions challenge
       JOIN challenge_targets target
         ON target.challenge_id = challenge.challenge_id
        AND target.version = challenge.version
       WHERE challenge.is_frozen = 1
         AND substr(challenge.challenge_id, 1, length(?)) = ?
         AND challenge.delivery_context = ?
         AND challenge.task_form = 'explanation'
         AND challenge.public_prompt = ?
         AND target.objective_id = ?
         AND (
           SELECT COUNT(*)
           FROM challenge_targets frozen_target
           WHERE frozen_target.challenge_id = challenge.challenge_id
             AND frozen_target.version = challenge.version
         ) = 1
       ORDER BY challenge.created_at, challenge.challenge_id, challenge.version
       LIMIT 1`,
    )
    .get(
      ordinaryChallengePrefix,
      ordinaryChallengePrefix,
      mode,
      surface.prompt,
      objectiveId,
    ) as
    | { challenge_id: string; version: number }
    | undefined;

  if (matchingFrozen) {
    const challenge = getChallenge(
      db,
      matchingFrozen.challenge_id,
      matchingFrozen.version,
    );
    if (!challenge) {
      throw new Error(
        `Frozen ordinary challenge could not be reconstructed: ${matchingFrozen.challenge_id}@${matchingFrozen.version}`,
      );
    }
    return { objectiveId, challenge };
  }

  const challengeId = `ordinary:${concept.id}:explain:${mode}:${surface.surfaceId}`;
  const latestVersion = db
    .prepare(`SELECT MAX(version) AS version FROM challenge_versions WHERE challenge_id = ?`)
    .get(challengeId) as { version: number | null };
  const version = (latestVersion.version ?? 0) + 1;

  const referenceMaterial = (surface.referenceMaterial ?? []).filter(
    (item) => item.trim().length > 0,
  );
  const criterionId = "explain-response";
  const challenge = registerChallenge(db, {
    id: challengeId,
    version,
    publicPrompt: surface.prompt,
    taskForm: "explanation",
    deliveryContext: mode,
    targets: [
      {
        objectiveId,
        novelty: "same",
        criterionIds: [criterionId],
      },
    ],
    rubric: {
      id: `${challengeId}:rubric`,
      version,
      criteria: [
        {
          id: criterionId,
          objectiveId,
          required: true,
          description:
            `Answers the frozen explanation prompt for ${concept.title} accurately, ` +
            "covering the relevant mechanism and boundaries.",
          acceptableVariants: referenceMaterial,
        },
      ],
    },
    hintLadder: {},
    verification: {
      required: false,
      basis: "frozen_rubric",
    },
  });

  return { objectiveId, challenge };
}

/** End a tutoring session and return attempt/submission summary facts. */
export function endSession(
  db: Database.Database,
  sessionId: number,
): SessionSummary {
  const session = getSession(db, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const attemptCounts = db
    .prepare(
      `SELECT COUNT(*) AS challenges_attempted,
              SUM(CASE WHEN submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS submitted_attempts,
              SUM(CASE
                WHEN submitted_at IS NOT NULL AND EXISTS (
                  SELECT 1
                  FROM evidence_events evidence
                  WHERE evidence.attempt_id = attempts.id
                    AND COALESCE((
                      SELECT revision.action
                      FROM evidence_revisions revision
                      WHERE revision.evidence_event_id = evidence.id
                      ORDER BY revision.seq DESC
                      LIMIT 1
                    ), 'restore') <> 'invalidate'
                ) THEN 1 ELSE 0
              END) AS assessed_attempts
       FROM attempts
       WHERE session_id = ?`,
    )
    .get(sessionId) as {
    challenges_attempted: number;
    submitted_attempts: number | null;
    assessed_attempts: number | null;
  };

  const startedAt = session.started_at
    ? new Date(session.started_at)
    : new Date();
  const endedAt = new Date();
  const duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

  updateSession(db, sessionId, {
    endedAt: endedAt.toISOString(),
  });

  const submittedAttempts = attemptCounts.submitted_attempts ?? 0;
  const assessedAttempts = attemptCounts.assessed_attempts ?? 0;

  return {
    sessionId,
    topicId: session.topic_id,
    mode: session.mode,
    challengesAttempted: attemptCounts.challenges_attempted,
    submittedAttempts,
    assessedAttempts,
    pendingAssessmentAttempts: submittedAttempts - assessedAttempts,
    duration,
  };
}
