import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type Database from "better-sqlite3";
import {
  getActiveGoalStudyFocusEpisode,
  getConcept,
  getGoalObjectives,
  getGoalPreparation,
  getSession,
  getStudyFocusEpisode,
  getTopic,
} from "./db/database.js";
import {
  RevisionNoteSchema,
  TeachingArtifactSchema,
} from "./db/types.js";
import type {
  Attempt,
  EvidenceEvent,
  ExposureEvent,
  HintObservation,
  RevisionNote,
  TeachingArtifact,
} from "./db/types.js";
import {
  getAttemptsTargetingObjective,
  getChallenge,
  getExposureEventsByObjective,
  getHintObservationsForAttempt,
  getLearningObjective,
  getObjectiveProjection,
} from "./kernel/foundation.js";
import {
  getEffectiveEvidenceEventsByObjective,
  getWeaknessProjections,
} from "./kernel/evidence.js";

export type RevisionNoteScope =
  | { kind: "profile" }
  | { kind: "goal"; goalId: string }
  | { kind: "concept"; conceptId: string }
  | { kind: "objective"; objectiveId: string }
  | { kind: "session"; sessionId: number }
  | { kind: "current_focus"; goalId: string }
  | { kind: "focus_episode"; focusEpisodeId: string };

export interface RevisionNoteContextInput {
  scope: RevisionNoteScope;
  maxInteractions?: number;
}

export interface RevisionNoteSourceState {
  maxAttemptId: number;
  maxEvidenceSeq: number;
  maxEvidenceRevisionSeq: number;
  maxExposureSeq: number;
  maxHintSeq: number;
  preparationUpdatedAt: string | null;
  focusEpisodeClosedAt: string | null;
}

export interface RevisionNoteKnowledgeRef {
  conceptId: string;
  title: string;
  filePath: string | null;
  source: string | null;
  sourceId: string | null;
}

export interface RevisionNoteSourceRefs {
  conceptIds: string[];
  objectiveIds: string[];
  sessionIds: number[];
  attemptIds: number[];
  evidenceIds: string[];
  exposureSeqs: number[];
  teachingArtifactIds: string[];
  focusEpisodeIds: string[];
  challenges: Array<{ id: string; version: number }>;
  knowledge: RevisionNoteKnowledgeRef[];
}

export interface RevisionNoteExposureContext {
  seq: number;
  objectiveId: string;
  sessionId: number | null;
  attemptId: number | null;
  exposureType: ExposureEvent["exposure_type"];
  sourceRef: string | null;
  occurredAt: string;
  teachingMaterial:
    | {
        artifactId: string;
        format: TeachingArtifact["content_format"];
        content: string;
      }
    | null;
  materialStatus: "recorded" | "historical_unavailable";
}

export interface RevisionNoteInteractionContext {
  attemptId: number;
  sessionId: number | null;
  startedAt: string;
  submittedAt: string | null;
  learnerResponse: string | null;
  challenge: {
    id: string;
    version: number;
    publicPrompt: string;
    taskForm: string;
    deliveryContext: string;
    criteria: Array<{
      id: string;
      objectiveId: string;
      required: boolean;
      description: string;
    }>;
  } | null;
  evidence: Array<{
    id: string;
    objectiveId: string;
    result: EvidenceEvent["result"];
    criteriaMet: string[];
    criteriaUnmet: string[];
    observedErrors: string[];
    rationale: string;
    performedAt: string;
  }>;
  hints: Array<{
    level: number;
    scopeKind: HintObservation["scope_kind"];
    objectiveId: string | null;
    criterionIds: string[] | null;
    recordedAt: string;
  }>;
  exposures: RevisionNoteExposureContext[];
}

export interface RevisionNoteObjectiveContext {
  objectiveId: string;
  conceptId: string;
  conceptTitle: string;
  capabilityId: string;
  readiness: string;
  transferState: string;
  durabilityState: string;
  weaknesses: Array<{
    key: string;
    category: string;
    lifecycle: string;
    lastEventSeq: number;
  }>;
}

export interface RevisionNoteContext {
  scope: RevisionNoteScope;
  maxInteractions: number;
  title: string;
  objectives: RevisionNoteObjectiveContext[];
  interactions: RevisionNoteInteractionContext[];
  standaloneExposures: RevisionNoteExposureContext[];
  knowledgeRefs: RevisionNoteKnowledgeRef[];
  sourceState: RevisionNoteSourceState;
  sourceRefs: RevisionNoteSourceRefs;
  limitations: string[];
}

export interface SaveRevisionNoteInput {
  context: RevisionNoteContext;
  markdown: string;
  title?: string;
}

export interface RevisionNoteSnapshot {
  id: string;
  scope: RevisionNoteScope;
  title: string;
  markdown: string;
  sourceState: RevisionNoteSourceState;
  sourceRefs: RevisionNoteSourceRefs;
  generatedAt: string;
  stale: boolean;
}

const DEFAULT_MAX_INTERACTIONS = 12;
const MAX_INTERACTIONS = 40;

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function normalizeMaxInteractions(value: number | undefined): number {
  const normalized = value ?? DEFAULT_MAX_INTERACTIONS;
  if (!Number.isInteger(normalized) || normalized <= 0 || normalized > MAX_INTERACTIONS) {
    throw new Error(`maxInteractions must be an integer from 1 to ${MAX_INTERACTIONS}`);
  }
  return normalized;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

interface ResolvedRevisionNoteScope {
  scope: RevisionNoteScope;
  objectiveIds: string[];
  title: string;
  preparationUpdatedAt: string | null;
  focusEpisodeClosedAt: string | null;
  focusWindow: { openedAt: string; closedAt: string | null } | null;
}

function focusEpisodeActualObjectiveIds(
  db: Database.Database,
  episode: { goal_id: string; opened_at: string; closed_at: string | null },
): string[] {
  const endClause = episode.closed_at === null ? "" : " AND contact_at <= ?";
  const rows = db
    .prepare(
      `SELECT DISTINCT objective_id
       FROM (
         SELECT target.objective_id AS objective_id,
                COALESCE(attempt.submitted_at, attempt.started_at) AS contact_at
         FROM attempts attempt
         JOIN sessions session ON session.id = attempt.session_id
         JOIN challenge_targets target
           ON target.challenge_id = attempt.challenge_id
          AND target.version = attempt.challenge_version
         WHERE session.topic_id = ?

         UNION ALL

         SELECT exposure.objective_id AS objective_id,
                exposure.occurred_at AS contact_at
         FROM exposure_events exposure
         JOIN sessions session ON session.id = exposure.session_id
         WHERE session.topic_id = ?
       ) scoped
       WHERE contact_at >= ?${endClause}
       ORDER BY objective_id`,
    )
    .all(...(
      episode.closed_at === null
        ? [episode.goal_id, episode.goal_id, episode.opened_at]
        : [episode.goal_id, episode.goal_id, episode.opened_at, episode.closed_at]
    )) as Array<{ objective_id: string }>;
  return rows.map((row) => row.objective_id);
}

function resolvedFocusEpisode(
  db: Database.Database,
  episodeId: string,
): ResolvedRevisionNoteScope {
  const episode = getStudyFocusEpisode(db, episodeId);
  if (!episode) throw new Error(`Study focus episode not found: ${episodeId}`);
  const topic = getTopic(db, episode.goal_id);
  return {
    scope: { kind: "focus_episode", focusEpisodeId: episode.id },
    objectiveIds: unique([
      ...episode.resolved_objective_ids,
      ...focusEpisodeActualObjectiveIds(db, episode),
    ]),
    title: episode.label?.trim() || `${topic?.name ?? episode.goal_id} study focus`,
    preparationUpdatedAt: null,
    focusEpisodeClosedAt: episode.closed_at,
    focusWindow: { openedAt: episode.opened_at, closedAt: episode.closed_at },
  };
}

function scopeObjectiveIds(
  db: Database.Database,
  scope: RevisionNoteScope,
): ResolvedRevisionNoteScope {
  if (scope.kind === "profile") {
    const objectiveIds = (db.prepare(`SELECT id FROM learning_objectives ORDER BY id`).all() as Array<{ id: string }>)
      .map((row) => row.id);
    return {
      scope,
      objectiveIds,
      title: "Profile revision",
      preparationUpdatedAt: null,
      focusEpisodeClosedAt: null,
      focusWindow: null,
    };
  }

  if (scope.kind === "goal") {
    const topic = getTopic(db, scope.goalId);
    if (!topic) throw new Error(`Goal topic not found: ${scope.goalId}`);
    const preparation = getGoalPreparation(db, scope.goalId);
    return {
      scope,
      objectiveIds: getGoalObjectives(db, scope.goalId).map((objective) => objective.objective_id),
      title: topic.goal?.trim() || topic.name,
      preparationUpdatedAt: preparation?.updated_at ?? null,
      focusEpisodeClosedAt: null,
      focusWindow: null,
    };
  }

  if (scope.kind === "current_focus") {
    const episode = getActiveGoalStudyFocusEpisode(db, scope.goalId);
    if (!episode) throw new Error(`Goal has no active study focus: ${scope.goalId}`);
    return resolvedFocusEpisode(db, episode.id);
  }

  if (scope.kind === "focus_episode") {
    return resolvedFocusEpisode(db, scope.focusEpisodeId);
  }

  if (scope.kind === "concept") {
    const concept = getConcept(db, scope.conceptId);
    if (!concept) throw new Error(`Concept not found: ${scope.conceptId}`);
    const objectiveIds = (db
      .prepare(`SELECT id FROM learning_objectives WHERE concept_id = ? ORDER BY id`)
      .all(scope.conceptId) as Array<{ id: string }>).map((row) => row.id);
    return {
      scope,
      objectiveIds,
      title: concept.title,
      preparationUpdatedAt: null,
      focusEpisodeClosedAt: null,
      focusWindow: null,
    };
  }

  if (scope.kind === "objective") {
    const objective = getLearningObjective(db, scope.objectiveId);
    if (!objective) throw new Error(`Learning objective not found: ${scope.objectiveId}`);
    const concept = getConcept(db, objective.concept_id);
    return {
      scope,
      objectiveIds: [scope.objectiveId],
      title: `${concept?.title ?? objective.concept_id} - ${objective.capability_id}`,
      preparationUpdatedAt: null,
      focusEpisodeClosedAt: null,
      focusWindow: null,
    };
  }

  const session = getSession(db, scope.sessionId);
  if (!session) throw new Error(`Session not found: ${scope.sessionId}`);
  const objectiveIds = (db
    .prepare(
      `SELECT DISTINCT target.objective_id
       FROM attempts attempt
       JOIN challenge_targets target
         ON target.challenge_id = attempt.challenge_id
        AND target.version = attempt.challenge_version
       WHERE attempt.session_id = ?
       ORDER BY target.objective_id`,
    )
    .all(scope.sessionId) as Array<{ objective_id: string }>).map((row) => row.objective_id);
  return {
    scope,
    objectiveIds,
    title: `Session ${scope.sessionId}`,
    preparationUpdatedAt: null,
    focusEpisodeClosedAt: null,
    focusWindow: null,
  };
}

function loadTeachingArtifacts(
  db: Database.Database,
  events: readonly ExposureEvent[],
): Map<string, TeachingArtifact> {
  const ids = unique(
    events
      .map((event) => event.teaching_artifact_id)
      .filter((id): id is string => id !== null),
  );
  const result = new Map<string, TeachingArtifact>();
  const query = db.prepare(`SELECT * FROM teaching_artifacts WHERE id = ?`);
  for (const id of ids) {
    const row = query.get(id);
    if (row !== undefined) result.set(id, TeachingArtifactSchema.parse(row));
  }
  return result;
}

function exposureContext(
  event: ExposureEvent,
  artifacts: ReadonlyMap<string, TeachingArtifact>,
): RevisionNoteExposureContext {
  const artifact = event.teaching_artifact_id === null
    ? undefined
    : artifacts.get(event.teaching_artifact_id);
  return {
    seq: event.seq,
    objectiveId: event.objective_id,
    sessionId: event.session_id,
    attemptId: event.attempt_id,
    exposureType: event.exposure_type,
    sourceRef: event.source_ref,
    occurredAt: event.occurred_at,
    teachingMaterial: artifact
      ? {
          artifactId: artifact.id,
          format: artifact.content_format,
          content: artifact.content,
        }
      : null,
    materialStatus: artifact ? "recorded" : "historical_unavailable",
  };
}

function maxOrZero(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

function currentRevisionHighWater(
  db: Database.Database,
  objectiveIds: readonly string[],
  sessionId: number | undefined,
  focusWindow: { openedAt: string; closedAt: string | null } | null,
): number {
  if (objectiveIds.length === 0) return 0;
  const placeholders = objectiveIds.map(() => "?").join(", ");
  const clauses = [`evidence.objective_id IN (${placeholders})`];
  const params: Array<string | number> = [...objectiveIds];
  if (sessionId !== undefined) {
    clauses.push("evidence.session_id = ?");
    params.push(sessionId);
  }
  if (focusWindow !== null) {
    clauses.push("evidence.performed_at >= ?");
    params.push(focusWindow.openedAt);
    if (focusWindow.closedAt !== null) {
      clauses.push("evidence.performed_at <= ?");
      params.push(focusWindow.closedAt);
    }
  }
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(revision.seq), 0) AS seq
       FROM evidence_revisions revision
       JOIN evidence_events evidence ON evidence.id = revision.evidence_event_id
       WHERE ${clauses.join(" AND ")}`,
    )
    .get(...params) as { seq: number };
  return row.seq;
}

function sourceStateEqual(left: RevisionNoteSourceState, right: RevisionNoteSourceState): boolean {
  return (
    left.maxAttemptId === right.maxAttemptId &&
    left.maxEvidenceSeq === right.maxEvidenceSeq &&
    left.maxEvidenceRevisionSeq === right.maxEvidenceRevisionSeq &&
    left.maxExposureSeq === right.maxExposureSeq &&
    left.maxHintSeq === right.maxHintSeq &&
    left.preparationUpdatedAt === right.preparationUpdatedAt &&
    left.focusEpisodeClosedAt === right.focusEpisodeClosedAt
  );
}

function withinWindow(
  timestamp: string,
  focusWindow: { openedAt: string; closedAt: string | null } | null,
): boolean {
  if (focusWindow === null) return true;
  if (timestamp < focusWindow.openedAt) return false;
  return focusWindow.closedAt === null || timestamp <= focusWindow.closedAt;
}

export function getRevisionNoteContext(
  db: Database.Database,
  input: RevisionNoteContextInput,
): RevisionNoteContext {
  const maxInteractions = normalizeMaxInteractions(input.maxInteractions);
  const resolved = scopeObjectiveIds(db, input.scope);
  const objectiveIds = unique(resolved.objectiveIds);

  const objectiveContexts: RevisionNoteObjectiveContext[] = [];
  const knowledgeRefs: RevisionNoteKnowledgeRef[] = [];
  const knowledgeByConcept = new Map<string, RevisionNoteKnowledgeRef>();
  const attemptsById = new Map<number, Attempt>();
  const evidenceById = new Map<string, EvidenceEvent>();
  const exposuresBySeq = new Map<number, ExposureEvent>();

  for (const objectiveId of objectiveIds) {
    const objective = getLearningObjective(db, objectiveId);
    if (!objective) continue;
    const concept = getConcept(db, objective.concept_id);
    const projection = getObjectiveProjection(db, objectiveId);
    if (!projection) continue;
    const objectiveWeaknesses = getWeaknessProjections(db, objectiveId);
    objectiveContexts.push({
      objectiveId,
      conceptId: objective.concept_id,
      conceptTitle: concept?.title ?? objective.concept_id,
      capabilityId: objective.capability_id,
      readiness: projection.readiness,
      transferState: projection.transfer_state,
      durabilityState: projection.durability_state,
      weaknesses: objectiveWeaknesses.map((weakness) => ({
        key: weakness.key,
        category: weakness.category,
        lifecycle: weakness.lifecycle,
        lastEventSeq: weakness.last_event_seq,
      })),
    });

    if (concept && !knowledgeByConcept.has(concept.id)) {
      const ref: RevisionNoteKnowledgeRef = {
        conceptId: concept.id,
        title: concept.title,
        filePath: concept.file_path,
        source: concept.source,
        sourceId: concept.source_id,
      };
      knowledgeByConcept.set(concept.id, ref);
      knowledgeRefs.push(ref);
    }

    for (const attempt of getAttemptsTargetingObjective(db, objectiveId)) {
      attemptsById.set(attempt.id, attempt);
    }
    for (const evidence of getEffectiveEvidenceEventsByObjective(db, objectiveId)) {
      evidenceById.set(evidence.id, evidence);
    }
    for (const exposure of getExposureEventsByObjective(db, objectiveId)) {
      exposuresBySeq.set(exposure.seq, exposure);
    }
  }

  const sessionScopeId = resolved.scope.kind === "session" ? resolved.scope.sessionId : null;
  let allAttempts = [...attemptsById.values()];
  if (sessionScopeId !== null) {
    allAttempts = allAttempts.filter((attempt) => attempt.session_id === sessionScopeId);
  }
  if (resolved.focusWindow !== null) {
    allAttempts = allAttempts.filter((attempt) =>
      withinWindow(attempt.submitted_at ?? attempt.started_at, resolved.focusWindow),
    );
  }
  allAttempts.sort((left, right) =>
    right.started_at.localeCompare(left.started_at) || right.id - left.id,
  );

  const allEvidence = [...evidenceById.values()].filter(
    (evidence) =>
      (sessionScopeId === null || evidence.session_id === sessionScopeId) &&
      withinWindow(evidence.performed_at, resolved.focusWindow),
  );
  const allExposures = [...exposuresBySeq.values()].filter(
    (exposure) =>
      (sessionScopeId === null || exposure.session_id === sessionScopeId) &&
      withinWindow(exposure.occurred_at, resolved.focusWindow),
  );
  const artifacts = loadTeachingArtifacts(db, allExposures);

  const selectedAttempts = allAttempts.slice(0, maxInteractions);
  const selectedAttemptIds = new Set(selectedAttempts.map((attempt) => attempt.id));
  const interactions: RevisionNoteInteractionContext[] = selectedAttempts.map((attempt) => {
    const challenge =
      attempt.challenge_id !== null && attempt.challenge_version !== null
        ? getChallenge(db, attempt.challenge_id, attempt.challenge_version)
        : undefined;
    const attemptEvidence = allEvidence
      .filter((evidence) => evidence.attempt_id === attempt.id)
      .sort((left, right) => left.seq - right.seq);
    const hints = getHintObservationsForAttempt(db, attempt.id);
    const attemptExposures = allExposures
      .filter((exposure) => exposure.attempt_id === attempt.id)
      .sort((left, right) => left.seq - right.seq);

    return {
      attemptId: attempt.id,
      sessionId: attempt.session_id,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      learnerResponse: attempt.response_text,
      challenge: challenge
        ? {
            id: challenge.id,
            version: challenge.version,
            publicPrompt: challenge.publicPrompt,
            taskForm: challenge.taskForm,
            deliveryContext: challenge.deliveryContext,
            criteria: challenge.rubric.criteria.map((criterion) => ({
              id: criterion.id,
              objectiveId: criterion.objectiveId,
              required: criterion.required,
              description: criterion.description,
            })),
          }
        : null,
      evidence: attemptEvidence.map((evidence) => ({
        id: evidence.id,
        objectiveId: evidence.objective_id,
        result: evidence.result,
        criteriaMet: [...evidence.criteria_json.met],
        criteriaUnmet: [...evidence.criteria_json.unmet],
        observedErrors: [...evidence.observed_errors_json],
        rationale: evidence.rationale,
        performedAt: evidence.performed_at,
      })),
      hints: hints.map((hint) => ({
        level: hint.level,
        scopeKind: hint.scope_kind,
        objectiveId: hint.objective_id,
        criterionIds: hint.criterion_ids_json === null ? null : [...hint.criterion_ids_json],
        recordedAt: hint.recorded_at,
      })),
      exposures: attemptExposures.map((event) => exposureContext(event, artifacts)),
    };
  });

  const standaloneExposures = allExposures
    .filter((exposure) => exposure.attempt_id === null || !selectedAttemptIds.has(exposure.attempt_id))
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at) || right.seq - left.seq)
    .slice(0, maxInteractions)
    .map((event) => exposureContext(event, artifacts));

  const allHints = allAttempts.flatMap((attempt) => getHintObservationsForAttempt(db, attempt.id));
  const sourceState: RevisionNoteSourceState = {
    maxAttemptId: maxOrZero(allAttempts.map((attempt) => attempt.id)),
    maxEvidenceSeq: maxOrZero(allEvidence.map((evidence) => evidence.seq)),
    maxEvidenceRevisionSeq: currentRevisionHighWater(
      db,
      objectiveIds,
      sessionScopeId ?? undefined,
      resolved.focusWindow,
    ),
    maxExposureSeq: maxOrZero(allExposures.map((exposure) => exposure.seq)),
    maxHintSeq: maxOrZero(allHints.map((hint) => hint.seq)),
    preparationUpdatedAt: resolved.preparationUpdatedAt,
    focusEpisodeClosedAt: resolved.focusEpisodeClosedAt,
  };

  const selectedEvidence = interactions.flatMap((interaction) => interaction.evidence);
  const selectedExposures = [
    ...interactions.flatMap((interaction) => interaction.exposures),
    ...standaloneExposures,
  ];
  const selectedSessions = unique(
    [
      ...interactions.map((interaction) => interaction.sessionId),
      ...selectedExposures.map((exposure) => exposure.sessionId),
    ].filter((sessionId): sessionId is number => sessionId !== null),
  );
  const selectedChallenges = unique(
    interactions
      .map((interaction) => interaction.challenge)
      .filter((challenge): challenge is NonNullable<typeof challenge> => challenge !== null)
      .map((challenge) => `${challenge.id}\u0000${challenge.version}`),
  ).map((value) => {
    const [id, version] = value.split("\u0000");
    return { id, version: Number(version) };
  });

  const sourceRefs: RevisionNoteSourceRefs = {
    conceptIds: knowledgeRefs.map((ref) => ref.conceptId),
    objectiveIds,
    sessionIds: selectedSessions,
    attemptIds: unique([
      ...interactions.map((interaction) => interaction.attemptId),
      ...selectedExposures
        .map((exposure) => exposure.attemptId)
        .filter((attemptId): attemptId is number => attemptId !== null),
    ]),
    evidenceIds: selectedEvidence.map((evidence) => evidence.id),
    exposureSeqs: selectedExposures.map((exposure) => exposure.seq),
    teachingArtifactIds: unique(
      selectedExposures
        .map((exposure) => exposure.teachingMaterial?.artifactId ?? null)
        .filter((id): id is string => id !== null),
    ),
    focusEpisodeIds:
      resolved.scope.kind === "focus_episode" ? [resolved.scope.focusEpisodeId] : [],
    challenges: selectedChallenges,
    knowledge: knowledgeRefs,
  };

  const missingHistoricalTeaching = allExposures.some(
    (exposure) => exposure.teaching_artifact_id === null,
  );
  const limitations: string[] = [];
  if (missingHistoricalTeaching) {
    limitations.push(
      "Some historical exposure events do not contain recoverable learner-visible teaching material. Use their provenance plus learner/evidence history, but do not claim an exact prior explanation was recovered.",
    );
  }
  if (allAttempts.length > selectedAttempts.length) {
    limitations.push(
      `Context is bounded to the ${selectedAttempts.length} most recent relevant interactions out of ${allAttempts.length}.`,
    );
  }

  return {
    scope: resolved.scope,
    maxInteractions,
    title: resolved.title,
    objectives: objectiveContexts,
    interactions,
    standaloneExposures,
    knowledgeRefs,
    sourceState,
    sourceRefs,
    limitations,
  };
}

function parseStoredScope(kind: RevisionNote["scope_kind"], raw: Record<string, unknown>): RevisionNoteScope {
  if (kind === "profile") return { kind };
  if (kind === "goal" || kind === "current_focus") {
    if (typeof raw.goalId !== "string") throw new Error(`Stored revision note is missing goalId`);
    return { kind, goalId: raw.goalId };
  }
  if (kind === "focus_episode") {
    if (typeof raw.focusEpisodeId !== "string") {
      throw new Error(`Stored revision note is missing focusEpisodeId`);
    }
    return { kind, focusEpisodeId: raw.focusEpisodeId };
  }
  if (kind === "concept") {
    if (typeof raw.conceptId !== "string") throw new Error(`Stored revision note is missing conceptId`);
    return { kind, conceptId: raw.conceptId };
  }
  if (kind === "objective") {
    if (typeof raw.objectiveId !== "string") throw new Error(`Stored revision note is missing objectiveId`);
    return { kind, objectiveId: raw.objectiveId };
  }
  if (typeof raw.sessionId !== "number" || !Number.isInteger(raw.sessionId)) {
    throw new Error(`Stored revision note is missing sessionId`);
  }
  return { kind, sessionId: raw.sessionId };
}

function parseSourceState(raw: Record<string, unknown>): RevisionNoteSourceState {
  const numeric = [
    "maxAttemptId",
    "maxEvidenceSeq",
    "maxEvidenceRevisionSeq",
    "maxExposureSeq",
    "maxHintSeq",
  ] as const;
  for (const key of numeric) {
    if (typeof raw[key] !== "number" || !Number.isInteger(raw[key])) {
      throw new Error(`Stored revision note source state has invalid ${key}`);
    }
  }
  const preparationUpdatedAt = raw.preparationUpdatedAt ?? null;
  if (preparationUpdatedAt !== null && typeof preparationUpdatedAt !== "string") {
    throw new Error(`Stored revision note source state has invalid preparationUpdatedAt`);
  }
  const focusEpisodeClosedAt = raw.focusEpisodeClosedAt ?? null;
  if (focusEpisodeClosedAt !== null && typeof focusEpisodeClosedAt !== "string") {
    throw new Error(`Stored revision note source state has invalid focusEpisodeClosedAt`);
  }
  return {
    maxAttemptId: raw.maxAttemptId as number,
    maxEvidenceSeq: raw.maxEvidenceSeq as number,
    maxEvidenceRevisionSeq: raw.maxEvidenceRevisionSeq as number,
    maxExposureSeq: raw.maxExposureSeq as number,
    maxHintSeq: raw.maxHintSeq as number,
    preparationUpdatedAt,
    focusEpisodeClosedAt,
  };
}

function parseSourceRefs(raw: Record<string, unknown>): RevisionNoteSourceRefs {
  return {
    ...(raw as unknown as RevisionNoteSourceRefs),
    focusEpisodeIds: Array.isArray(raw.focusEpisodeIds)
      ? raw.focusEpisodeIds.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function canonicalContextEqual(left: RevisionNoteContext, right: RevisionNoteContext): boolean {
  return isDeepStrictEqual(left, right);
}

function rowToSnapshot(db: Database.Database, row: RevisionNote): RevisionNoteSnapshot {
  const scope = parseStoredScope(row.scope_kind, row.scope_json);
  const sourceState = parseSourceState(row.source_state_json);
  let stale = true;
  try {
    const current = getRevisionNoteContext(db, { scope, maxInteractions: 1 }).sourceState;
    stale = !sourceStateEqual(sourceState, current);
  } catch {
    // A saved snapshot remains readable after its former goal/focus/scope is no longer active.
    stale = true;
  }
  return {
    id: row.id,
    scope,
    title: row.title,
    markdown: row.markdown,
    sourceState,
    sourceRefs: parseSourceRefs(row.source_refs_json),
    generatedAt: row.generated_at,
    stale,
  };
}

export function saveRevisionNote(
  db: Database.Database,
  input: SaveRevisionNoteInput,
): RevisionNoteSnapshot {
  const markdown = requireNonEmpty(input.markdown, "Revision note markdown");
  const current = getRevisionNoteContext(db, {
    scope: input.context.scope,
    maxInteractions: input.context.maxInteractions,
  });
  if (!canonicalContextEqual(current, input.context)) {
    throw new Error(
      "Revision note context changed or was modified; derive a fresh canonical context before saving",
    );
  }
  const title = input.title?.trim() || current.title;

  const id = randomUUID();
  const generatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO revision_notes (
       id, scope_kind, scope_json, title, markdown,
       source_state_json, source_refs_json, generated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    current.scope.kind,
    JSON.stringify(current.scope),
    title,
    markdown,
    JSON.stringify(current.sourceState),
    JSON.stringify(current.sourceRefs),
    generatedAt,
  );
  const row = RevisionNoteSchema.parse(db.prepare(`SELECT * FROM revision_notes WHERE id = ?`).get(id));
  return rowToSnapshot(db, row);
}

export function getRevisionNote(
  db: Database.Database,
  noteId: string,
): RevisionNoteSnapshot | undefined {
  const row = db.prepare(`SELECT * FROM revision_notes WHERE id = ?`).get(noteId);
  if (row === undefined) return undefined;
  return rowToSnapshot(db, RevisionNoteSchema.parse(row));
}

export function listRevisionNotes(db: Database.Database): RevisionNoteSnapshot[] {
  return RevisionNoteSchema.array()
    .parse(db.prepare(`SELECT * FROM revision_notes ORDER BY generated_at DESC, id DESC`).all())
    .map((row) => rowToSnapshot(db, row));
}
