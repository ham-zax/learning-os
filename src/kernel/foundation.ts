import type Database from "better-sqlite3";
import {
  AttemptSchema,
  CapabilitySchema,
  ChallengeCriterionRowSchema,
  ChallengeSpecSchema,
  ChallengeTargetRowSchema,
  ChallengeVersionRowSchema,
  ExposureEventSchema,
  ExposureType,
  HintObservationSchema,
  HintScopeSchema,
  LearningObjectiveSchema,
  ObjectiveProjectionSchema,
} from "../db/types.js";
import type {
  Attempt,
  ChallengeCriterion,
  ChallengeCriterionRow,
  ChallengeSpec,
  ChallengeSpecInput,
  ChallengeTarget,
  ChallengeTargetRow,
  ExposureEvent,
  HintObservation,
  HintScope,
  LearningObjective,
  ObjectiveProjection,
} from "../db/types.js";

export interface LearningObjectiveInput {
  id: string;
  conceptId: string;
  capabilityId: string;
}

export type LearnerVisibleChallenge = Pick<
  ChallengeSpec,
  "id" | "version" | "publicPrompt" | "taskForm" | "deliveryContext" | "timeBudgetMinutes"
>;

export interface OpenedAttempt {
  attempt: Attempt;
  challenge: LearnerVisibleChallenge;
}

export interface SubmitAttemptInput {
  responseText?: string;
  artifactRef?: Record<string, unknown>;
}

export interface RecordHintUseInput {
  level: number;
  scope: HintScope;
}

export interface RecordExposureInput {
  attemptId?: number;
  objectiveIds: string[];
  exposureType: ExposureEvent["exposure_type"];
  sourceRef?: string;
}

function requireNonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  return value;
}

function getFrozenChallengeOrThrow(
  db: Database.Database,
  challengeId: string,
  version: number,
): ChallengeSpec {
  const challenge = getChallenge(db, challengeId, version);
  if (!challenge) {
    throw new Error(`Frozen challenge version not found: ${challengeId}@${version}`);
  }
  return challenge;
}

function getAttemptOrThrow(db: Database.Database, attemptId: number): Attempt {
  const attempt = getAttempt(db, attemptId);
  if (!attempt) {
    throw new Error(`Attempt not found: ${attemptId}`);
  }
  return attempt;
}

function validateChallengeRelationships(spec: ChallengeSpec): void {
  const targetByObjective = new Map<string, ChallengeSpec["targets"][number]>();
  for (const target of spec.targets) {
    if (targetByObjective.has(target.objectiveId)) {
      throw new Error(`Challenge target objective is duplicated: ${target.objectiveId}`);
    }
    targetByObjective.set(target.objectiveId, target);

    const uniqueCriterionIds = new Set(target.criterionIds);
    if (uniqueCriterionIds.size !== target.criterionIds.length) {
      throw new Error(`Challenge target has duplicate criterion IDs: ${target.objectiveId}`);
    }
  }

  const criterionById = new Map<string, ChallengeSpec["rubric"]["criteria"][number]>();
  for (const criterion of spec.rubric.criteria) {
    if (criterionById.has(criterion.id)) {
      throw new Error(`Challenge rubric criterion is duplicated: ${criterion.id}`);
    }
    if (!targetByObjective.has(criterion.objectiveId)) {
      throw new Error(
        `Challenge criterion ${criterion.id} references non-target objective ${criterion.objectiveId}`,
      );
    }
    criterionById.set(criterion.id, criterion);
  }

  const referencedCriterionIds = new Set<string>();
  for (const target of spec.targets) {
    for (const criterionId of target.criterionIds) {
      const criterion = criterionById.get(criterionId);
      if (!criterion) {
        throw new Error(
          `Challenge target ${target.objectiveId} references unknown criterion ${criterionId}`,
        );
      }
      if (criterion.objectiveId !== target.objectiveId) {
        throw new Error(
          `Challenge criterion ${criterionId} belongs to ${criterion.objectiveId}, not ${target.objectiveId}`,
        );
      }
      referencedCriterionIds.add(criterionId);
    }
  }

  for (const criterion of spec.rubric.criteria) {
    if (!referencedCriterionIds.has(criterion.id)) {
      throw new Error(`Challenge rubric criterion is not owned by a target: ${criterion.id}`);
    }
  }
}

function ensureChallengeObjectivesExist(db: Database.Database, spec: ChallengeSpec): void {
  const getObjective = db.prepare(`SELECT id FROM learning_objectives WHERE id = ?`);
  for (const target of spec.targets) {
    if (!getObjective.get(target.objectiveId)) {
      throw new Error(`Learning objective not found: ${target.objectiveId}`);
    }
  }
}

function learnerVisibleChallenge(spec: ChallengeSpec): LearnerVisibleChallenge {
  return {
    id: spec.id,
    version: spec.version,
    publicPrompt: spec.publicPrompt,
    taskForm: spec.taskForm,
    deliveryContext: spec.deliveryContext,
    timeBudgetMinutes: spec.timeBudgetMinutes ?? null,
  };
}

export function listCapabilities(db: Database.Database) {
  const rows = db.prepare(`SELECT * FROM capabilities ORDER BY id`).all();
  return CapabilitySchema.array().parse(rows);
}

export function createLearningObjective(
  db: Database.Database,
  input: LearningObjectiveInput,
): LearningObjective {
  const id = requireNonEmpty(input.id, "Learning objective id");
  const conceptId = requireNonEmpty(input.conceptId, "Concept id");
  const capabilityId = requireNonEmpty(input.capabilityId, "Capability id");
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO learning_objectives (id, concept_id, capability_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, conceptId, capabilityId, now, now);

    db.prepare(
      `INSERT INTO objective_projections (objective_id, rebuilt_at)
       VALUES (?, ?)`,
    ).run(id, now);
  })();

  return getLearningObjective(db, id)!;
}

export function getLearningObjective(
  db: Database.Database,
  objectiveId: string,
): LearningObjective | undefined {
  const row = db
    .prepare(`SELECT * FROM learning_objectives WHERE id = ?`)
    .get(objectiveId);
  return row === undefined ? undefined : LearningObjectiveSchema.parse(row);
}

export function getObjectiveProjection(
  db: Database.Database,
  objectiveId: string,
): ObjectiveProjection | undefined {
  const row = db
    .prepare(`SELECT * FROM objective_projections WHERE objective_id = ?`)
    .get(objectiveId);
  return row === undefined ? undefined : ObjectiveProjectionSchema.parse(row);
}

export function registerChallenge(
  db: Database.Database,
  input: ChallengeSpecInput,
): ChallengeSpec {
  const spec = ChallengeSpecSchema.parse(input);
  validateChallengeRelationships(spec);

  db.transaction(() => {
    const existing = db
      .prepare(`SELECT 1 FROM challenge_versions WHERE challenge_id = ? AND version = ?`)
      .get(spec.id, spec.version);
    if (existing) {
      throw new Error(`Challenge version already registered: ${spec.id}@${spec.version}`);
    }

    if (spec.sourceProblemId) {
      const problem = db.prepare(`SELECT 1 FROM problems WHERE id = ?`).get(spec.sourceProblemId);
      if (!problem) {
        throw new Error(`Source problem not found: ${spec.sourceProblemId}`);
      }
    }

    ensureChallengeObjectivesExist(db, spec);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO challenge_versions (
         challenge_id,
         version,
         source_problem_id,
         public_prompt,
         task_form,
         delivery_context,
         time_budget_minutes,
         rubric_id,
         rubric_version,
         hint_ladder_json,
         verification_required,
         verification_basis,
         private_solution_ref,
         is_frozen,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(
      spec.id,
      spec.version,
      spec.sourceProblemId ?? null,
      spec.publicPrompt,
      spec.taskForm,
      spec.deliveryContext,
      spec.timeBudgetMinutes ?? null,
      spec.rubric.id,
      spec.rubric.version,
      JSON.stringify(spec.hintLadder),
      spec.verification.required ? 1 : 0,
      spec.verification.basis,
      spec.privateSolutionRef ?? null,
      now,
    );

    const insertTarget = db.prepare(
      `INSERT INTO challenge_targets (
         challenge_id,
         version,
         objective_id,
         novelty,
         criterion_ids_json,
         position
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    spec.targets.forEach((target: ChallengeTarget, position: number) => {
      insertTarget.run(
        spec.id,
        spec.version,
        target.objectiveId,
        target.novelty,
        JSON.stringify(target.criterionIds),
        position,
      );
    });

    const insertCriterion = db.prepare(
      `INSERT INTO challenge_criteria (
         challenge_id,
         version,
         criterion_id,
         objective_id,
         required,
         description,
         acceptable_variants_json,
         position
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    spec.rubric.criteria.forEach((criterion: ChallengeCriterion, position: number) => {
      insertCriterion.run(
        spec.id,
        spec.version,
        criterion.id,
        criterion.objectiveId,
        criterion.required ? 1 : 0,
        criterion.description,
        JSON.stringify(criterion.acceptableVariants),
        position,
      );
    });

    const freeze = db
      .prepare(
        `UPDATE challenge_versions
         SET is_frozen = 1
         WHERE challenge_id = ? AND version = ? AND is_frozen = 0`,
      )
      .run(spec.id, spec.version);
    if (freeze.changes !== 1) {
      throw new Error(`Failed to freeze challenge version: ${spec.id}@${spec.version}`);
    }
  })();

  return getFrozenChallengeOrThrow(db, spec.id, spec.version);
}

export function getChallenge(
  db: Database.Database,
  challengeId: string,
  version: number,
): ChallengeSpec | undefined {
  const parentRaw = db
    .prepare(
      `SELECT * FROM challenge_versions
       WHERE challenge_id = ? AND version = ? AND is_frozen = 1`,
    )
    .get(challengeId, version);
  if (parentRaw === undefined) return undefined;

  const parent = ChallengeVersionRowSchema.parse(parentRaw);
  const targetRows = ChallengeTargetRowSchema.array().parse(
    db
      .prepare(
        `SELECT * FROM challenge_targets
         WHERE challenge_id = ? AND version = ?
         ORDER BY position`,
      )
      .all(challengeId, version),
  );
  const criterionRows = ChallengeCriterionRowSchema.array().parse(
    db
      .prepare(
        `SELECT * FROM challenge_criteria
         WHERE challenge_id = ? AND version = ?
         ORDER BY position`,
      )
      .all(challengeId, version),
  );

  return ChallengeSpecSchema.parse({
    id: parent.challenge_id,
    version: parent.version,
    sourceProblemId: parent.source_problem_id,
    publicPrompt: parent.public_prompt,
    taskForm: parent.task_form,
    deliveryContext: parent.delivery_context,
    timeBudgetMinutes: parent.time_budget_minutes,
    targets: targetRows.map((target: ChallengeTargetRow) => ({
      objectiveId: target.objective_id,
      novelty: target.novelty,
      criterionIds: target.criterion_ids_json,
    })),
    rubric: {
      id: parent.rubric_id,
      version: parent.rubric_version,
      criteria: criterionRows.map((criterion: ChallengeCriterionRow) => ({
        id: criterion.criterion_id,
        objectiveId: criterion.objective_id,
        required: criterion.required,
        description: criterion.description,
        acceptableVariants: criterion.acceptable_variants_json,
      })),
    },
    hintLadder: parent.hint_ladder_json,
    verification: {
      required: parent.verification_required,
      basis: parent.verification_basis,
    },
    privateSolutionRef: parent.private_solution_ref,
  });
}

export function getAttempt(
  db: Database.Database,
  attemptId: number,
): Attempt | undefined {
  const row = db.prepare(`SELECT * FROM attempts WHERE id = ?`).get(attemptId);
  return row === undefined ? undefined : AttemptSchema.parse(row);
}

export function openAttempt(
  db: Database.Database,
  challengeId: string,
  version: number,
  sessionId: number | null = null,
): OpenedAttempt {
  const challenge = getFrozenChallengeOrThrow(db, challengeId, version);
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO attempts (
         challenge_id,
         challenge_version,
         session_id,
         started_at,
         created_at
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(challenge.id, challenge.version, sessionId, now, now);

  const attempt = getAttemptOrThrow(db, Number(info.lastInsertRowid));
  return {
    attempt,
    challenge: learnerVisibleChallenge(challenge),
  };
}

export function submitAttempt(
  db: Database.Database,
  attemptId: number,
  input: SubmitAttemptInput,
): Attempt {
  if (input.responseText === undefined && input.artifactRef === undefined) {
    throw new Error("Attempt submission requires response text or an artifact reference");
  }

  return db.transaction(() => {
    const attempt = getAttemptOrThrow(db, attemptId);
    if (attempt.submitted_at !== null) {
      throw new Error(`Attempt is already submitted: ${attemptId}`);
    }

    const submittedAt = new Date().toISOString();
    const update = db
      .prepare(
        `UPDATE attempts
         SET response_text = ?, artifact_ref_json = ?, submitted_at = ?
         WHERE id = ? AND submitted_at IS NULL`,
      )
      .run(
        input.responseText ?? null,
        input.artifactRef === undefined ? null : JSON.stringify(input.artifactRef),
        submittedAt,
        attemptId,
      );
    if (update.changes !== 1) {
      throw new Error(`Attempt could not be submitted: ${attemptId}`);
    }

    return getAttemptOrThrow(db, attemptId);
  })();
}

function validateHintScope(challenge: ChallengeSpec, scope: HintScope): void {
  const targetByObjective = new Map<string, ChallengeTarget>(
    challenge.targets.map(
      (target: ChallengeTarget): [string, ChallengeTarget] => [target.objectiveId, target],
    ),
  );
  const criterionById = new Map<string, ChallengeCriterion>(
    challenge.rubric.criteria.map(
      (criterion: ChallengeCriterion): [string, ChallengeCriterion] => [criterion.id, criterion],
    ),
  );

  if ("objectiveId" in scope) {
    if (!targetByObjective.has(scope.objectiveId)) {
      throw new Error(`Hint objective is not a frozen challenge target: ${scope.objectiveId}`);
    }
    return;
  }

  if ("criterionIds" in scope) {
    if (new Set(scope.criterionIds).size !== scope.criterionIds.length) {
      throw new Error("Hint criterion scope contains duplicate criterion IDs");
    }
    for (const criterionId of scope.criterionIds) {
      const criterion = criterionById.get(criterionId);
      if (!criterion) {
        throw new Error(`Hint criterion is not part of the frozen challenge: ${criterionId}`);
      }
      const target = targetByObjective.get(criterion.objectiveId);
      if (!target || !target.criterionIds.includes(criterionId)) {
        throw new Error(
          `Hint criterion ${criterionId} is not owned by frozen target ${criterion.objectiveId}`,
        );
      }
    }
  }
}

export function recordHintUse(
  db: Database.Database,
  attemptId: number,
  input: RecordHintUseInput,
): HintObservation {
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 5) {
    throw new Error("Hint level must be an integer from L1 through L5");
  }
  const scope = HintScopeSchema.parse(input.scope);

  return db.transaction(() => {
    const attempt = getAttemptOrThrow(db, attemptId);
    if (attempt.challenge_id === null || attempt.challenge_version === null) {
      throw new Error(`Attempt is not attached to a frozen challenge: ${attemptId}`);
    }
    if (attempt.submitted_at !== null) {
      throw new Error(`Cannot record a hint after attempt submission: ${attemptId}`);
    }

    const challenge = getFrozenChallengeOrThrow(
      db,
      attempt.challenge_id,
      attempt.challenge_version,
    );
    validateHintScope(challenge, scope);

    let scopeKind: "objective" | "criteria" | "all_targets";
    let objectiveId: string | null = null;
    let criterionIdsJson: string | null = null;
    if ("objectiveId" in scope) {
      scopeKind = "objective";
      objectiveId = scope.objectiveId;
    } else if ("criterionIds" in scope) {
      scopeKind = "criteria";
      criterionIdsJson = JSON.stringify(scope.criterionIds);
    } else {
      scopeKind = "all_targets";
    }

    const recordedAt = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO hint_observations (
           attempt_id,
           level,
           scope_kind,
           objective_id,
           criterion_ids_json,
           recorded_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        attemptId,
        input.level,
        scopeKind,
        objectiveId,
        criterionIdsJson,
        recordedAt,
      );

    const row = db
      .prepare(`SELECT * FROM hint_observations WHERE seq = ?`)
      .get(Number(info.lastInsertRowid));
    return HintObservationSchema.parse(row);
  })();
}

export function getHintObservationsForAttempt(
  db: Database.Database,
  attemptId: number,
): HintObservation[] {
  const rows = db
    .prepare(
      `SELECT * FROM hint_observations
       WHERE attempt_id = ?
       ORDER BY seq`,
    )
    .all(attemptId);
  return HintObservationSchema.array().parse(rows);
}

export function recordExposure(
  db: Database.Database,
  sessionId: number | null,
  input: RecordExposureInput,
): ExposureEvent[] {
  const exposureType = ExposureType.parse(input.exposureType);
  if (input.objectiveIds.length === 0) {
    throw new Error("Exposure must name at least one learning objective");
  }
  if (new Set(input.objectiveIds).size !== input.objectiveIds.length) {
    throw new Error("Exposure objective scope contains duplicate objective IDs");
  }

  return db.transaction(() => {
    const objectiveExists = db.prepare(`SELECT 1 FROM learning_objectives WHERE id = ?`);
    for (const objectiveId of input.objectiveIds) {
      if (!objectiveExists.get(objectiveId)) {
        throw new Error(`Learning objective not found: ${objectiveId}`);
      }
    }

    let challengeId: string | null = null;
    let challengeVersion: number | null = null;
    if (input.attemptId !== undefined) {
      const attempt = getAttemptOrThrow(db, input.attemptId);
      if (attempt.challenge_id === null || attempt.challenge_version === null) {
        throw new Error(`Attempt is not attached to a frozen challenge: ${input.attemptId}`);
      }
      const challenge = getFrozenChallengeOrThrow(
        db,
        attempt.challenge_id,
        attempt.challenge_version,
      );
      const targetIds = new Set(
        challenge.targets.map((target: ChallengeTarget) => target.objectiveId),
      );
      for (const objectiveId of input.objectiveIds) {
        if (!targetIds.has(objectiveId)) {
          throw new Error(
            `Exposure objective is not a frozen target of attempt ${input.attemptId}: ${objectiveId}`,
          );
        }
      }
      challengeId = challenge.id;
      challengeVersion = challenge.version;
    }

    const occurredAt = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO exposure_events (
         objective_id,
         session_id,
         challenge_id,
         challenge_version,
         attempt_id,
         exposure_type,
         source_ref,
         occurred_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const events: ExposureEvent[] = [];
    for (const objectiveId of input.objectiveIds) {
      const info = insert.run(
        objectiveId,
        sessionId,
        challengeId,
        challengeVersion,
        input.attemptId ?? null,
        exposureType,
        input.sourceRef ?? null,
        occurredAt,
      );
      const row = db
        .prepare(`SELECT * FROM exposure_events WHERE seq = ?`)
        .get(Number(info.lastInsertRowid));
      events.push(ExposureEventSchema.parse(row));
    }
    return events;
  })();
}

export function getExposureEventsByObjective(
  db: Database.Database,
  objectiveId: string,
): ExposureEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM exposure_events
       WHERE objective_id = ?
       ORDER BY occurred_at, seq`,
    )
    .all(objectiveId);
  return ExposureEventSchema.array().parse(rows);
}

export function getAttemptsTargetingObjective(
  db: Database.Database,
  objectiveId: string,
): Attempt[] {
  const rows = db
    .prepare(
      `SELECT a.*
       FROM attempts a
       JOIN challenge_targets target
         ON target.challenge_id = a.challenge_id
        AND target.version = a.challenge_version
       JOIN challenge_versions challenge
         ON challenge.challenge_id = target.challenge_id
        AND challenge.version = target.version
       WHERE target.objective_id = ?
         AND challenge.is_frozen = 1
       ORDER BY a.started_at, a.id`,
    )
    .all(objectiveId);
  return AttemptSchema.array().parse(rows);
}
