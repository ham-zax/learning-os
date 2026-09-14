/**
 * SQLite database access for the current Learning OS schema.
 *
 * Fresh databases are created directly at the current schema version. Older
 * persisted schemas are rejected instead of replaying historical migrations.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  GoalObjectiveSchema,
  GoalPreparationSchema,
  InteractionInputMode,
  QuestionChunking,
  SessionSchema,
  StudyFocusEpisodeSchema,
} from "./types.js";
import type {
  Topic,
  Concept,
  Session,
  SyncedGap,
  SyncedSignal,
  Problem,
  DeliveryContext,
  GoalObjective,
  GoalImportance,
  GoalTargetReadiness,
  GoalPreparation,
  StudyFocusEpisode,
  PreparationPurpose,
  PreparationStrategy,
  InitialDiagnosticKind,
} from "./types.js";
import { CURRENT_SCHEMA_SQL, CURRENT_SCHEMA_VERSION } from "./schema.js";

// ─── Database lifecycle ─────────────────────────────────────────────────────

function initializeCurrentSchema(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;
  if (currentVersion === CURRENT_SCHEMA_VERSION) return;

  const { count } = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    )
    .get() as { count: number };

  if (currentVersion !== 0 || count !== 0) {
    throw new Error(
      `Unsupported learner database schema v${currentVersion}. ` +
        `Learning OS now requires schema v${CURRENT_SCHEMA_VERSION}; recreate or explicitly migrate this profile before opening it.`,
    );
  }

  db.transaction(() => {
    db.exec(CURRENT_SCHEMA_SQL);
    db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  })();
}

/** Create or open a database using the single current Learning OS schema. */
export function createDatabase(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Could not locate the bindings file") || message.includes("better_sqlite3.node")) {
      throw new Error(
        "Learning OS could not load the better-sqlite3 native binding. Reinstall dependencies with lifecycle scripts enabled (run `npm ci` from the repository root).",
      );
    }
    throw err;
  }

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  try {
    initializeCurrentSchema(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export interface InteractionPreferences {
  inputMode: InteractionInputMode;
  questionChunking: QuestionChunking;
  source: "default" | "learner_explicit";
  updatedAt: string | null;
}

export interface SetInteractionPreferencesInput {
  inputMode?: InteractionInputMode;
  questionChunking?: QuestionChunking;
}

export function getInteractionPreferences(db: Database.Database): InteractionPreferences {
  const row = db
    .prepare(`SELECT input_mode, question_chunking, source, updated_at
              FROM interaction_preferences WHERE singleton = 1`)
    .get() as
    | {
        input_mode: InteractionInputMode;
        question_chunking: QuestionChunking;
        source: "learner_explicit";
        updated_at: string;
      }
    | undefined;
  if (!row) {
    return {
      inputMode: "default",
      questionChunking: "default",
      source: "default",
      updatedAt: null,
    };
  }
  return {
    inputMode: row.input_mode,
    questionChunking: row.question_chunking,
    source: row.source,
    updatedAt: row.updated_at,
  };
}

export function setInteractionPreferences(
  db: Database.Database,
  input: SetInteractionPreferencesInput,
): InteractionPreferences {
  if (input.inputMode === undefined && input.questionChunking === undefined) {
    throw new Error("At least one interaction preference must be supplied");
  }
  const current = getInteractionPreferences(db);
  const inputMode = input.inputMode === undefined
    ? current.inputMode
    : InteractionInputMode.parse(input.inputMode);
  const questionChunking = input.questionChunking === undefined
    ? current.questionChunking
    : QuestionChunking.parse(input.questionChunking);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO interaction_preferences (singleton, input_mode, question_chunking, source, updated_at)
     VALUES (1, ?, ?, 'learner_explicit', ?)
     ON CONFLICT(singleton) DO UPDATE SET
       input_mode = excluded.input_mode,
       question_chunking = excluded.question_chunking,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  ).run(inputMode, questionChunking, now);
  return getInteractionPreferences(db);
}

// ─── CRUD: Topics ─────────────────────────────────────────────────────────

export function createTopic(
  db: Database.Database,
  input: { id: string; name: string; goal?: string; deadline?: string },
): Topic {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO topics (id, name, goal, deadline, created_at)
     VALUES (@id, @name, @goal, @deadline, @created_at)`,
  ).run({
    id: input.id,
    name: input.name,
    goal: input.goal ?? null,
    deadline: input.deadline ?? null,
    created_at: now,
  });
  return getTopic(db, input.id)!;
}

export function getTopic(
  db: Database.Database,
  id: string,
): Topic | undefined {
  return db.prepare(`SELECT * FROM topics WHERE id = ?`).get(id) as
    | Topic
    | undefined;
}

export function listTopics(db: Database.Database): Topic[] {
  return db.prepare(`SELECT * FROM topics ORDER BY created_at DESC`).all() as Topic[];
}

export function updateTopic(
  db: Database.Database,
  id: string,
  updates: Partial<Pick<Topic, "name" | "goal" | "deadline" | "last_session">>,
): void {
  const allowed = ["name", "goal", "deadline", "last_session"] as const;
  const entries = Object.entries(updates).filter(([k]) =>
    (allowed as readonly string[]).includes(k),
  );
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE topics SET ${sets} WHERE id = @id`).run({ id, ...Object.fromEntries(entries) });
}

// ─── CRUD: Goal objectives ─────────────────────────────────────────────────

export interface SetGoalObjectiveInput {
  goalId: string;
  objectiveId: string;
  isActive?: boolean;
  importance?: GoalImportance;
  targetReadiness?: GoalTargetReadiness;
  requireTransfer?: boolean;
  requireDurability?: boolean;
  preparationStrategy?: PreparationStrategy;
  initialDiagnosticKind?: InitialDiagnosticKind;
}

export function setGoalObjective(
  db: Database.Database,
  input: SetGoalObjectiveInput,
): GoalObjective {
  if (!getTopic(db, input.goalId)) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }

  const objectiveExists = db
    .prepare(`SELECT 1 FROM learning_objectives WHERE id = ?`)
    .get(input.objectiveId);
  if (!objectiveExists) {
    throw new Error(`Learning objective not found: ${input.objectiveId}`);
  }

  if (input.isActive === false) {
    const activeFocus = getActiveGoalStudyFocusEpisode(db, input.goalId);
    if (activeFocus?.target_objective_ids.includes(input.objectiveId)) {
      throw new Error(
        `Cannot deactivate study-focus objective ${input.objectiveId}; clear or replace active focus ${activeFocus.id} first`,
      );
    }
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO goal_objectives (
       goal_id,
       objective_id,
       is_active,
       importance,
       target_readiness,
       require_transfer,
       require_durability,
       preparation_strategy,
       initial_diagnostic_kind,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(goal_id, objective_id) DO UPDATE SET
       is_active = excluded.is_active,
       importance = excluded.importance,
       target_readiness = excluded.target_readiness,
       require_transfer = excluded.require_transfer,
       require_durability = excluded.require_durability,
       preparation_strategy = COALESCE(excluded.preparation_strategy, goal_objectives.preparation_strategy),
       initial_diagnostic_kind = COALESCE(excluded.initial_diagnostic_kind, goal_objectives.initial_diagnostic_kind),
       updated_at = excluded.updated_at`,
  ).run(
    input.goalId,
    input.objectiveId,
    input.isActive === false ? 0 : 1,
    input.importance ?? "important",
    input.targetReadiness ?? "independent",
    input.requireTransfer ? 1 : 0,
    input.requireDurability ? 1 : 0,
    input.preparationStrategy ?? null,
    input.initialDiagnosticKind ?? null,
    now,
    now,
  );

  return getGoalObjective(db, input.goalId, input.objectiveId)!;
}

export function getGoalObjective(
  db: Database.Database,
  goalId: string,
  objectiveId: string,
): GoalObjective | undefined {
  const row = db
    .prepare(`SELECT * FROM goal_objectives WHERE goal_id = ? AND objective_id = ?`)
    .get(goalId, objectiveId);
  return row === undefined ? undefined : GoalObjectiveSchema.parse(row);
}

export function getGoalObjectives(
  db: Database.Database,
  goalId: string,
  options: { includeInactive?: boolean } = {},
): GoalObjective[] {
  const rows = options.includeInactive
    ? db
        .prepare(
          `SELECT * FROM goal_objectives
           WHERE goal_id = ?
           ORDER BY CASE importance WHEN 'core' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
                    objective_id`,
        )
        .all(goalId)
    : db
        .prepare(
          `SELECT * FROM goal_objectives
           WHERE goal_id = ? AND is_active = 1
           ORDER BY CASE importance WHEN 'core' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
                    objective_id`,
        )
        .all(goalId);
  return GoalObjectiveSchema.array().parse(rows);
}

export interface SetGoalPreparationInput {
  goalId: string;
  purpose: PreparationPurpose;
  targetRole?: string | null;
  targetOutcome?: string | null;
  minutesPerDay?: number | null;
  daysPerWeek?: number | null;
  minutesPerWeek?: number | null;
  confirmedAt: string;
}

export function setGoalPreparation(
  db: Database.Database,
  input: SetGoalPreparationInput,
): GoalPreparation {
  if (!getTopic(db, input.goalId)) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }
  const confirmedAt = new Date(input.confirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new Error(`Invalid onboarding confirmation time: ${input.confirmedAt}`);
  }
  for (const [label, value] of [
    ["minutesPerDay", input.minutesPerDay],
    ["minutesPerWeek", input.minutesPerWeek],
  ] as const) {
    if (value !== undefined && value !== null && (!Number.isInteger(value) || value <= 0)) {
      throw new Error(`${label} must be a positive integer when provided`);
    }
  }
  if (
    input.daysPerWeek !== undefined &&
    input.daysPerWeek !== null &&
    (!Number.isInteger(input.daysPerWeek) || input.daysPerWeek < 1 || input.daysPerWeek > 7)
  ) {
    throw new Error("daysPerWeek must be an integer from 1 to 7 when provided");
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO goal_preparation (
       goal_id,
       purpose,
       target_role,
       target_outcome,
       minutes_per_day,
       days_per_week,
       minutes_per_week,
       confirmed_at,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(goal_id) DO UPDATE SET
       purpose = excluded.purpose,
       target_role = excluded.target_role,
       target_outcome = excluded.target_outcome,
       minutes_per_day = excluded.minutes_per_day,
       days_per_week = excluded.days_per_week,
       minutes_per_week = excluded.minutes_per_week,
       confirmed_at = excluded.confirmed_at,
       updated_at = excluded.updated_at`,
  ).run(
    input.goalId,
    input.purpose,
    input.targetRole ?? null,
    input.targetOutcome ?? null,
    input.minutesPerDay ?? null,
    input.daysPerWeek ?? null,
    input.minutesPerWeek ?? null,
    confirmedAt.toISOString(),
    now,
    now,
  );
  return getGoalPreparation(db, input.goalId)!;
}

export function getGoalPreparation(
  db: Database.Database,
  goalId: string,
): GoalPreparation | undefined {
  const row = db.prepare(`SELECT * FROM goal_preparation WHERE goal_id = ?`).get(goalId);
  return row === undefined ? undefined : GoalPreparationSchema.parse(row);
}

export interface SetGoalStudyFocusInput {
  goalId: string;
  label?: string | null;
  objectiveIds: readonly string[];
}

export function getStudyFocusEpisode(
  db: Database.Database,
  episodeId: string,
): StudyFocusEpisode | undefined {
  const row = db.prepare(`SELECT * FROM study_focus_episodes WHERE id = ?`).get(episodeId);
  return row === undefined ? undefined : StudyFocusEpisodeSchema.parse(row);
}

export function getActiveGoalStudyFocusEpisode(
  db: Database.Database,
  goalId: string,
): StudyFocusEpisode | undefined {
  const row = db
    .prepare(
      `SELECT * FROM study_focus_episodes
       WHERE goal_id = ? AND closed_at IS NULL
       ORDER BY opened_at DESC, id DESC
       LIMIT 1`,
    )
    .get(goalId);
  return row === undefined ? undefined : StudyFocusEpisodeSchema.parse(row);
}

export function listGoalStudyFocusEpisodes(
  db: Database.Database,
  goalId: string,
): StudyFocusEpisode[] {
  return StudyFocusEpisodeSchema.array().parse(
    db
      .prepare(
        `SELECT * FROM study_focus_episodes
         WHERE goal_id = ?
         ORDER BY opened_at DESC, id DESC`,
      )
      .all(goalId),
  );
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function resolveGoalStudyFocusObjectiveClosure(
  db: Database.Database,
  goalId: string,
  focusObjectiveIds: readonly string[],
  prerequisiteCapabilityId = "explain",
): string[] {
  const objectiveIds = [...new Set(focusObjectiveIds)];
  if (objectiveIds.length === 0) {
    throw new Error("Study focus requires at least one active goal objective");
  }
  const activeObjectiveIds = new Set(
    getGoalObjectives(db, goalId).map((objective) => objective.objective_id),
  );
  for (const objectiveId of objectiveIds) {
    if (!activeObjectiveIds.has(objectiveId)) {
      throw new Error(`Study focus objective is not active for goal ${goalId}: ${objectiveId}`);
    }
  }

  const result = [...objectiveIds];
  const resultSet = new Set(result);
  const visitedConcepts = new Set<string>();
  const queue: string[] = [];
  const objectiveConcept = db.prepare(`SELECT concept_id FROM learning_objectives WHERE id = ?`);
  for (const objectiveId of objectiveIds) {
    const row = objectiveConcept.get(objectiveId) as { concept_id: string } | undefined;
    if (row) queue.push(row.concept_id);
  }

  const conceptPrerequisites = db.prepare(`SELECT prerequisites FROM concepts WHERE id = ?`);
  const prerequisiteObjective = db.prepare(
    `SELECT id FROM learning_objectives WHERE concept_id = ? AND capability_id = ?`,
  );
  while (queue.length > 0) {
    const conceptId = queue.shift()!;
    if (visitedConcepts.has(conceptId)) continue;
    visitedConcepts.add(conceptId);
    const row = conceptPrerequisites.get(conceptId) as { prerequisites: string } | undefined;
    if (!row) continue;
    const prerequisites = JSON.parse(row.prerequisites) as unknown;
    if (!Array.isArray(prerequisites) || prerequisites.some((value) => typeof value !== "string")) {
      throw new Error(`Concept ${conceptId} has invalid prerequisites`);
    }
    for (const prerequisiteConceptId of prerequisites) {
      const objective = prerequisiteObjective.get(
        prerequisiteConceptId,
        prerequisiteCapabilityId,
      ) as { id: string } | undefined;
      if (objective) {
        const membership = getGoalObjective(db, goalId, objective.id);
        if (membership && !membership.is_active) continue;
        if (!resultSet.has(objective.id)) {
          resultSet.add(objective.id);
          result.push(objective.id);
        }
      }
      queue.push(prerequisiteConceptId);
    }
  }
  return result;
}

export function setGoalStudyFocus(
  db: Database.Database,
  input: SetGoalStudyFocusInput,
): StudyFocusEpisode {
  if (!getGoalPreparation(db, input.goalId)) {
    throw new Error(`Goal preparation not found: ${input.goalId}`);
  }
  const objectiveIds = [...new Set(input.objectiveIds)];
  const resolvedObjectiveIds = resolveGoalStudyFocusObjectiveClosure(
    db,
    input.goalId,
    objectiveIds,
  );
  const label = input.label?.trim() || null;

  return db.transaction(() => {
    const activeEpisode = getActiveGoalStudyFocusEpisode(db, input.goalId);
    if (
      activeEpisode &&
      activeEpisode.label === label &&
      sameIds(activeEpisode.target_objective_ids, objectiveIds)
    ) {
      return activeEpisode;
    }

    const now = new Date().toISOString();
    if (activeEpisode) {
      db.prepare(
        `UPDATE study_focus_episodes SET closed_at = ? WHERE id = ? AND closed_at IS NULL`,
      ).run(now, activeEpisode.id);
    }

    const id = `focus-${randomUUID()}`;
    db.prepare(
      `INSERT INTO study_focus_episodes (
         id, goal_id, label, target_objective_ids, resolved_objective_ids,
         opened_at, closed_at
       ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      id,
      input.goalId,
      label,
      JSON.stringify(objectiveIds),
      JSON.stringify(resolvedObjectiveIds),
      now,
    );
    return getStudyFocusEpisode(db, id)!;
  })();
}

export function clearGoalStudyFocus(
  db: Database.Database,
  goalId: string,
): StudyFocusEpisode | undefined {
  if (!getGoalPreparation(db, goalId)) {
    throw new Error(`Goal preparation not found: ${goalId}`);
  }
  return db.transaction(() => {
    const activeEpisode = getActiveGoalStudyFocusEpisode(db, goalId);
    if (!activeEpisode) return undefined;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE study_focus_episodes SET closed_at = ? WHERE id = ? AND closed_at IS NULL`,
    ).run(now, activeEpisode.id);
    return getStudyFocusEpisode(db, activeEpisode.id)!;
  })();
}

// ─── CRUD: Concepts ───────────────────────────────────────────────────────

export function createConcept(
  db: Database.Database,
  input: {
    id: string;
    topicId: string;
    title: string;
    difficulty?: number;
    prerequisites?: string[];
    tags?: string[];
    source?: string;
    sourceId?: string;
  },
): Concept {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO concepts (id, topic_id, title, difficulty, prerequisites, tags, source, source_id, created_at)
     VALUES (@id, @topic_id, @title, @difficulty, @prerequisites, @tags, @source, @source_id, @created_at)`,
  ).run({
    id: input.id,
    topic_id: input.topicId,
    title: input.title,
    difficulty: input.difficulty ?? 1,
    prerequisites: JSON.stringify(input.prerequisites ?? []),
    tags: JSON.stringify(input.tags ?? []),
    source: input.source ?? null,
    source_id: input.sourceId ?? null,
    created_at: now,
  });
  return getConcept(db, input.id)!;
}

/**
 * Parse JSON fields in a concept row.
 * SQLite stores JSON arrays as TEXT, so we need to parse them.
 */
function parseConcept(row: any): Concept {
  if (!row) return row;
  return {
    ...row,
    prerequisites: typeof row.prerequisites === 'string' ? JSON.parse(row.prerequisites) : row.prerequisites ?? [],
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags ?? [],
  };
}

export function getConcept(
  db: Database.Database,
  id: string,
): Concept | undefined {
  const row = db.prepare(`SELECT * FROM concepts WHERE id = ?`).get(id);
  return parseConcept(row) as Concept | undefined;
}

export function getConceptsByTopic(
  db: Database.Database,
  topicId: string,
): Concept[] {
  const rows = db
    .prepare(`SELECT * FROM concepts WHERE topic_id = ? ORDER BY created_at`)
    .all(topicId);
  return rows.map(parseConcept) as Concept[];
}

export function updateConcept(
  db: Database.Database,
  id: string,
  updates: Partial<
    Pick<
      Concept,
      | "title"
      | "difficulty"
      | "prerequisites"
      | "tags"
      | "file_path"
      | "source"
      | "source_id"
    >
  >,
): void {
  const allowed = [
    "title",
    "difficulty",
    "prerequisites",
    "tags",
    "file_path",
    "source",
    "source_id",
  ] as const;
  const entries = Object.entries(updates).filter(([k]) =>
    (allowed as readonly string[]).includes(k),
  );
  if (entries.length === 0) return;
  const serialised = entries.map(([k, v]) => {
    if ((k === "prerequisites" || k === "tags") && Array.isArray(v)) {
      return [k, JSON.stringify(v)];
    }
    return [k, v];
  });
  const sets = serialised.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE concepts SET ${sets} WHERE id = @id`).run({
    id,
    ...Object.fromEntries(serialised),
  });
}

// ─── CRUD: Sessions ───────────────────────────────────────────────────────

export function createSession(
  db: Database.Database,
  input: { topicId: string; mode: DeliveryContext },
): Session {
  const requiredRepair = db
    .prepare(
      `SELECT id
       FROM sessions
       WHERE topic_id = ?
         AND phase = 'feedback'
         AND pending_action = 'present_feedback'
         AND reconstruction_status = 'required'
       ORDER BY COALESCE(started_at, '') DESC, id DESC
       LIMIT 1`,
    )
    .get(input.topicId) as { id: number } | undefined;
  if (requiredRepair) {
    throw new Error(
      `Session ${requiredRepair.id} requires learner reconstruction or explicit opt-out before another session can start`,
    );
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO sessions (topic_id, mode, started_at)
       VALUES (@topic_id, @mode, @started_at)`,
    )
    .run({
      topic_id: input.topicId,
      mode: input.mode,
      started_at: now,
    });
  return getSession(db, Number(info.lastInsertRowid))!;
}

export function getSession(
  db: Database.Database,
  id: number,
): Session | undefined {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  return row === undefined ? undefined : SessionSchema.parse(row);
}

export function updateSession(
  db: Database.Database,
  id: number,
  updates: { endedAt?: string },
): void {
  if (updates.endedAt === undefined) return;
  db.prepare(`UPDATE sessions SET ended_at = ? WHERE id = ?`).run(updates.endedAt, id);
}

// ─── CRUD: Synced Gaps ────────────────────────────────────────────────────

export function upsertGap(
  db: Database.Database,
  input: { jobId: string; skill: string; frequency?: number; source?: string },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO synced_gaps (job_id, skill, frequency, source, synced_at)
     VALUES (@job_id, @skill, @frequency, @source, @synced_at)
     ON CONFLICT(job_id, skill) DO UPDATE SET
       frequency = excluded.frequency,
       source = excluded.source,
       synced_at = excluded.synced_at`,
  ).run({
    job_id: input.jobId,
    skill: input.skill,
    frequency: input.frequency ?? 1,
    source: input.source ?? "job-hunter",
    synced_at: now,
  });
}

export function getGaps(
  db: Database.Database,
  jobId?: string,
): SyncedGap[] {
  if (jobId) {
    return db
      .prepare(`SELECT * FROM synced_gaps WHERE job_id = ? ORDER BY skill`)
      .all(jobId) as SyncedGap[];
  }
  return db.prepare(`SELECT * FROM synced_gaps ORDER BY job_id, skill`).all() as SyncedGap[];
}

// ─── CRUD: Synced Signals ─────────────────────────────────────────────────

export function upsertSignal(
  db: Database.Database,
  input: {
    sourceId: string;
    title: string;
    url?: string;
    score?: number;
    source?: string;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO synced_signals (source_id, title, url, score, source, synced_at)
     VALUES (@source_id, @title, @url, @score, @source, @synced_at)
     ON CONFLICT(source_id, source) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       score = excluded.score,
       synced_at = excluded.synced_at`,
  ).run({
    source_id: input.sourceId,
    title: input.title,
    url: input.url ?? null,
    score: input.score ?? null,
    source: input.source ?? "ai-feeds",
    synced_at: now,
  });
}

export function getSignals(
  db: Database.Database,
  minScore?: number,
): SyncedSignal[] {
  if (minScore !== undefined) {
    return db
      .prepare(
        `SELECT * FROM synced_signals WHERE score >= ? ORDER BY score DESC`,
      )
      .all(minScore) as SyncedSignal[];
  }
  return db
    .prepare(`SELECT * FROM synced_signals ORDER BY score DESC`)
    .all() as SyncedSignal[];
}

// ─── CRUD: Problems ───────────────────────────────────────────────────────

export function createProblem(
  db: Database.Database,
  input: {
    id: string;
    type: string;
    title: string;
    description: string;
    difficulty?: number;
    tags?: string[];
    testCases?: Record<string, unknown>[];
    rubric?: string;
    conceptId?: string;
    source?: string;
    externalId?: string;
  },
): Problem {
  db.prepare(
    `INSERT INTO problems (id, type, title, description, difficulty, tags, test_cases, rubric, concept_id, source, external_id)
     VALUES (@id, @type, @title, @description, @difficulty, @tags, @test_cases, @rubric, @concept_id, @source, @external_id)`,
  ).run({
    id: input.id,
    type: input.type,
    title: input.title,
    description: input.description,
    difficulty: input.difficulty ?? 1,
    tags: JSON.stringify(input.tags ?? []),
    test_cases: JSON.stringify(input.testCases ?? []),
    rubric: input.rubric ?? null,
    concept_id: input.conceptId ?? null,
    source: input.source ?? null,
    external_id: input.externalId ?? null,
  });
  return getProblem(db, input.id)!;
}

export function getProblem(
  db: Database.Database,
  id: string,
): Problem | undefined {
  return db.prepare(`SELECT * FROM problems WHERE id = ?`).get(id) as
    | Problem
    | undefined;
}

export function getProblemsByConcept(
  db: Database.Database,
  conceptId: string,
): Problem[] {
  return db
    .prepare(`SELECT * FROM problems WHERE concept_id = ? ORDER BY difficulty`)
    .all(conceptId) as Problem[];
}
