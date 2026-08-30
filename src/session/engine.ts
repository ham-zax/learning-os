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
  finishSessionInteraction,
  getChallenge,
  getLearningObjective,
  registerChallenge,
} from "../kernel/foundation.js";
import { getDueObjectives } from "../scheduler/index.js";

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
  duration: number; // advisory wall elapsed seconds; never active-study budget consumption
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_DAILY_MINUTES = 30;

/** Rough estimate: ~3 min per concept in learn/practice, ~2 min in review. */
function defaultMaxConcepts(dailyMinutes: number, mode: DeliveryContext): number {
  const minutesPerConcept = mode === "review" ? 2 : 3;
  return Math.max(3, Math.floor(dailyMinutes / minutesPerConcept));
}

// ─── Concept Selection ──────────────────────────────────────────────────────

/** Select ordinary concepts from objective projections and objective review cards. */
export function selectConcepts(
  db: Database.Database,
  topicId: string,
  mode: DeliveryContext,
  maxConcepts: number,
): Concept[] {
  const allConcepts = getConceptsByTopic(db, topicId);
  const byId = new Map(allConcepts.map((concept) => [concept.id, concept]));

  switch (mode) {
    case "learn":
      return selectForLearning(db, topicId, allConcepts, maxConcepts);
    case "practice":
      return selectForPractice(db, topicId, allConcepts, maxConcepts);
    case "review":
      return getDueObjectives(db, { topicId, capabilityId: "explain" })
        .map((due) => byId.get(due.conceptId))
        .filter((concept): concept is Concept => concept !== undefined)
        .slice(0, maxConcepts);
    case "interview":
    case "mock":
      throw new Error(`Delivery context ${mode} is not supported by ordinary sessions.`);
    default:
      throw new Error(`Unknown delivery context: ${String(mode)}`);
  }
}

function getExplainReadinessByConcept(
  db: Database.Database,
  topicId: string,
): Map<string, "unknown" | "exposed" | "guided" | "independent"> {
  const rows = db
    .prepare(
      `SELECT objective.concept_id, projection.readiness
       FROM learning_objectives objective
       JOIN objective_projections projection ON projection.objective_id = objective.id
       JOIN concepts concept ON concept.id = objective.concept_id
       WHERE concept.topic_id = ?
         AND objective.capability_id = 'explain'`,
    )
    .all(topicId) as Array<{
    concept_id: string;
    readiness: "unknown" | "exposed" | "guided" | "independent";
  }>;
  return new Map(rows.map((row) => [row.concept_id, row.readiness]));
}

function selectForLearning(
  db: Database.Database,
  topicId: string,
  allConcepts: Concept[],
  maxConcepts: number,
): Concept[] {
  const readiness = getExplainReadinessByConcept(db, topicId);
  const rank = new Map<string | undefined, number>([
    [undefined, 0],
    ["unknown", 1],
    ["exposed", 2],
  ]);

  return allConcepts
    .filter((concept) => {
      const state = readiness.get(concept.id);
      return state === undefined || state === "unknown" || state === "exposed";
    })
    .sort((a, b) => {
      const readinessDelta = (rank.get(readiness.get(a.id)) ?? 3) - (rank.get(readiness.get(b.id)) ?? 3);
      if (readinessDelta !== 0) return readinessDelta;
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
      return a.prerequisites.length - b.prerequisites.length;
    })
    .slice(0, maxConcepts);
}

function selectForPractice(
  db: Database.Database,
  topicId: string,
  allConcepts: Concept[],
  maxConcepts: number,
): Concept[] {
  const readiness = getExplainReadinessByConcept(db, topicId);
  return allConcepts
    .filter((concept) => {
      const state = readiness.get(concept.id);
      return state === "guided" || state === "independent";
    })
    .sort((a, b) => {
      const aState = readiness.get(a.id);
      const bState = readiness.get(b.id);
      if (aState !== bState) return aState === "guided" ? -1 : 1;
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
      return a.id.localeCompare(b.id);
    })
    .slice(0, maxConcepts);
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

  finishSessionInteraction(db, sessionId);

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
