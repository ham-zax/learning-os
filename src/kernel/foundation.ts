import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  AttemptSchema,
  CapabilitySchema,
  ChallengeAttemptDispositionRowSchema,
  ChallengeAuthoringContractRowSchema,
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
  SessionSchema,
  TeachingArtifactFormat,
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
  Session,
  SessionPendingAction,
  SessionPhase,
  ChallengeAttemptDispositionRow,
} from "../db/types.js";
import {
  getActiveGoalStudyFocusEpisode,
  getGoalObjective,
  getGoalObjectives,
} from "../db/database.js";
import {
  ChallengeAuthoringContractSchema,
  ChallengeIntentSchema,
  challengeAuthoringContract,
} from "../selection/types.js";
import type {
  ChallengeAuthoringContract,
  ChallengeIntent,
} from "../selection/types.js";

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
  /** Reliable active learner time known so far; omit when unknown. */
  activeTimeSeconds?: number;
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
  teachingMaterial: {
    content: string;
    format?: "text" | "markdown";
  };
  /** Mark answer-bearing causal/foundational repair as requiring reconstruction before closure. */
  requireReconstruction?: boolean;
}

export interface CompleteSessionFeedbackInput {
  /** Total reliable active time for this interaction episode; omit when unknown. */
  activeTimeSeconds?: number;
}

export interface ResolveSessionReconstructionInput extends CompleteSessionFeedbackInput {
  outcome: "completed" | "opted_out";
}

export interface ResumableAttempt {
  attempt: Attempt;
  challenge: ChallengeSpec;
  authoringContract: ChallengeAuthoringContract | null;
  hintObservations: HintObservation[];
  exposureEvents: ExposureEvent[];
  effectiveEvidenceIds: string[];
}

export interface ResumedSession {
  session: Session;
  phase: SessionPhase;
  pendingAction: SessionPendingAction;
  activeChallenge: ChallengeSpec | null;
  activeAttempt: Attempt | null;
  activeAttemptState: ResumableAttempt | null;
  reconstructionRequired: boolean;
  unresolvedVerificationAttempts: ResumableAttempt[];
  unresolvedAssessmentAttempts: ResumableAttempt[];
}

function requireNonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  return value;
}

function validateActiveTimeSeconds(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("activeTimeSeconds must be a non-negative integer when supplied");
  }
  return value;
}

function persistActiveTime(
  db: Database.Database,
  attemptId: number | null,
  activeTimeSeconds: number | undefined,
): void {
  if (activeTimeSeconds === undefined) return;
  if (attemptId === null) {
    throw new Error("Active study time requires an active attempt");
  }
  db.prepare(`UPDATE attempts SET time_spent_seconds = ? WHERE id = ?`)
    .run(activeTimeSeconds, attemptId);
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

function validateChallengeAgainstAuthoringContract(
  db: Database.Database,
  spec: ChallengeSpec,
  contract: ChallengeAuthoringContract,
): void {
  if (spec.taskForm !== contract.taskForm) {
    throw new Error(`Challenge task form does not match authoring contract: ${spec.taskForm}/${contract.taskForm}`);
  }
  if (spec.deliveryContext !== contract.deliveryContext) {
    throw new Error(
      `Challenge delivery context does not match authoring contract: ${spec.deliveryContext}/${contract.deliveryContext}`,
    );
  }
  if (spec.targets.length !== 1 || spec.targets[0]?.objectiveId !== contract.objectiveId) {
    throw new Error(`Challenge targets must match the single selected objective ${contract.objectiveId}`);
  }
  if (spec.targets[0].novelty !== contract.novelty) {
    throw new Error(
      `Challenge novelty does not match authoring contract: ${spec.targets[0].novelty}/${contract.novelty}`,
    );
  }
  const objective = LearningObjectiveSchema.parse(
    db.prepare(`SELECT * FROM learning_objectives WHERE id = ?`).get(contract.objectiveId),
  );
  if (objective.concept_id !== contract.conceptId || objective.capability_id !== contract.capabilityId) {
    throw new Error(`Challenge authoring contract does not match objective identity: ${contract.objectiveId}`);
  }
}

function assertCurrentGoalAuthorizesIntent(
  db: Database.Database,
  contract: ChallengeAuthoringContract,
): void {
  const goalId = contract.goalId;
  const direct = getGoalObjective(db, goalId, contract.objectiveId);
  if (direct) {
    if (direct.is_active) return;
    throw new Error(
      `Selected challenge intent is no longer authorized by current goal scope: ${goalId}/${contract.objectiveId}`,
    );
  }

  const focus = getActiveGoalStudyFocusEpisode(db, goalId);
  if (!focus) {
    throw new Error(
      `Selected challenge intent is no longer authorized by current goal scope: ${goalId}/${contract.objectiveId}`,
    );
  }

  const activeGoalObjectiveIds = new Set(
    getGoalObjectives(db, goalId).map((objective) => objective.objective_id),
  );
  if (focus.target_objective_ids.some((objectiveId) => !activeGoalObjectiveIds.has(objectiveId))) {
    throw new Error(
      `Selected challenge intent cannot use stale study focus ${focus.id}: one or more focus targets are no longer active`,
    );
  }

  if (focus.resolved_objective_ids.includes(contract.objectiveId)) return;

  const focusTargetConceptIds = new Set(
    focus.target_objective_ids
      .map((objectiveId) => getLearningObjective(db, objectiveId)?.concept_id)
      .filter((conceptId): conceptId is string => conceptId !== undefined),
  );
  const focusResolvedConceptIds = new Set(
    focus.resolved_objective_ids
      .map((objectiveId) => getLearningObjective(db, objectiveId)?.concept_id)
      .filter((conceptId): conceptId is string => conceptId !== undefined),
  );
  if (
    !focusTargetConceptIds.has(contract.conceptId) &&
    focusResolvedConceptIds.has(contract.conceptId)
  ) {
    return;
  }

  throw new Error(
    `Selected challenge intent is no longer authorized by current goal scope: ${goalId}/${contract.objectiveId}`,
  );
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
  intent?: ChallengeIntent,
): ChallengeSpec {
  const spec = ChallengeSpecSchema.parse(input);
  const authoringContract = intent === undefined
    ? null
    : challengeAuthoringContract(ChallengeIntentSchema.parse(intent));
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
    if (authoringContract) {
      assertCurrentGoalAuthorizesIntent(db, authoringContract);
      validateChallengeAgainstAuthoringContract(db, spec, authoringContract);
    }

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

    if (authoringContract) {
      db.prepare(
        `INSERT INTO challenge_authoring_contracts (
           challenge_id, version, contract_version, intent_json, created_at
         ) VALUES (?, ?, ?, ?, ?)`,
      ).run(
        spec.id,
        spec.version,
        authoringContract.contractVersion,
        JSON.stringify(authoringContract),
        now,
      );
    }

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

export function getChallengeAuthoringContract(
  db: Database.Database,
  challengeId: string,
  version: number,
): ChallengeAuthoringContract | null {
  const raw = db
    .prepare(
      `SELECT * FROM challenge_authoring_contracts
       WHERE challenge_id = ? AND version = ?`,
    )
    .get(challengeId, version);
  if (raw === undefined) return null;
  const row = ChallengeAuthoringContractRowSchema.parse(raw);
  const parsed = ChallengeAuthoringContractSchema.parse(JSON.parse(row.intent_json));
  if (parsed.contractVersion !== row.contract_version) {
    throw new Error(`Challenge authoring contract version mismatch: ${challengeId}@${version}`);
  }
  return parsed;
}

export function getAttempt(
  db: Database.Database,
  attemptId: number,
): Attempt | undefined {
  const row = db.prepare(`SELECT * FROM attempts WHERE id = ?`).get(attemptId);
  return row === undefined ? undefined : AttemptSchema.parse(row);
}

export function getChallengeAttemptDisposition(
  db: Database.Database,
  attemptId: number,
): ChallengeAttemptDispositionRow | null {
  const row = db
    .prepare(`SELECT * FROM challenge_attempt_dispositions WHERE attempt_id = ?`)
    .get(attemptId);
  return row === undefined ? null : ChallengeAttemptDispositionRowSchema.parse(row);
}

export function openAttempt(
  db: Database.Database,
  challengeId: string,
  version: number,
  sessionId: number,
): OpenedAttempt {
  return db.transaction(() => {
    const challenge = getFrozenChallengeOrThrow(db, challengeId, version);
    const authoringContract = getChallengeAuthoringContract(db, challenge.id, challenge.version);
    const session = SessionSchema.parse(
      db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId),
    );
    if (authoringContract) {
      if (session.topic_id !== authoringContract.goalId) {
        throw new Error(
          `Session goal ${session.topic_id} does not match selected challenge goal ${authoringContract.goalId}`,
        );
      }
      assertCurrentGoalAuthorizesIntent(db, authoringContract);
    }
    if (session.reconstruction_status === "required") {
      throw new Error(
        `Session ${sessionId} requires learner reconstruction or explicit opt-out before another attempt can open`,
      );
    }
    if (session.mode !== challenge.deliveryContext) {
      throw new Error(
        `Session delivery context ${session.mode} does not match challenge ${challenge.deliveryContext}`,
      );
    }

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
    db.prepare(
      `UPDATE sessions
       SET phase = 'awaiting_response',
           pending_action = 'collect_response',
           active_challenge_id = ?,
           active_challenge_version = ?,
           active_attempt_id = ?,
           reconstruction_status = 'not_required'
       WHERE id = ?`,
    ).run(challenge.id, challenge.version, attempt.id, sessionId);

    return {
      attempt,
      challenge: learnerVisibleChallenge(challenge),
    };
  })();
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

    const activeTimeSeconds = validateActiveTimeSeconds(input.activeTimeSeconds);
    const submittedAt = new Date().toISOString();
    const update = db
      .prepare(
        `UPDATE attempts
         SET response_text = ?, artifact_ref_json = ?, time_spent_seconds = ?, submitted_at = ?
         WHERE id = ? AND submitted_at IS NULL`,
      )
      .run(
        input.responseText ?? null,
        input.artifactRef === undefined ? null : JSON.stringify(input.artifactRef),
        activeTimeSeconds ?? null,
        submittedAt,
        attemptId,
      );
    if (update.changes !== 1) {
      throw new Error(`Attempt could not be submitted: ${attemptId}`);
    }

    const submitted = getAttemptOrThrow(db, attemptId);
    if (submitted.session_id !== null && submitted.challenge_id !== null && submitted.challenge_version !== null) {
      const challenge = getFrozenChallengeOrThrow(
        db,
        submitted.challenge_id,
        submitted.challenge_version,
      );
      db.prepare(
        `UPDATE sessions
         SET phase = ?, pending_action = ?,
             active_challenge_id = ?, active_challenge_version = ?, active_attempt_id = ?
         WHERE id = ?`,
      ).run(
        challenge.verification.required ? "awaiting_verification" : "awaiting_assessment",
        challenge.verification.required ? "run_verification" : "assess_response",
        challenge.id,
        challenge.version,
        submitted.id,
        submitted.session_id,
      );
    }

    return submitted;
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
  if (!input.teachingMaterial) {
    throw new Error("Exposure requires learner-visible teaching material");
  }
  if (input.objectiveIds.length === 0) {
    throw new Error("Exposure must name at least one learning objective");
  }
  if (new Set(input.objectiveIds).size !== input.objectiveIds.length) {
    throw new Error("Exposure objective scope contains duplicate objective IDs");
  }
  if (input.requireReconstruction && (sessionId === null || input.attemptId === undefined)) {
    throw new Error("Reconstruction-required exposure must identify its session and attempt");
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
      if (input.requireReconstruction) {
        const session = SessionSchema.parse(
          db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId!),
        );
        if (attempt.session_id !== sessionId || session.active_attempt_id !== attempt.id) {
          throw new Error("Reconstruction-required exposure must target the active session attempt");
        }
        if (session.phase !== "feedback" || session.pending_action !== "present_feedback") {
          throw new Error("Reconstruction can be required only during the feedback phase");
        }
      }
    }

    const occurredAt = new Date().toISOString();
    const content = requireNonEmpty(input.teachingMaterial.content, "Teaching artifact content");
    const format = TeachingArtifactFormat.parse(input.teachingMaterial.format ?? "markdown");
    const teachingArtifactId = randomUUID();
    db.prepare(
      `INSERT INTO teaching_artifacts (id, content, content_format, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(teachingArtifactId, content, format, occurredAt);

    const insert = db.prepare(
      `INSERT INTO exposure_events (
         objective_id,
         session_id,
         challenge_id,
         challenge_version,
         attempt_id,
         exposure_type,
         source_ref,
         teaching_artifact_id,
         occurred_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        teachingArtifactId,
        occurredAt,
      );
      const row = db
        .prepare(`SELECT * FROM exposure_events WHERE seq = ?`)
        .get(Number(info.lastInsertRowid));
      events.push(ExposureEventSchema.parse(row));
    }
    if (input.requireReconstruction) {
      const update = db.prepare(
        `UPDATE sessions SET reconstruction_status = 'required'
         WHERE id = ? AND phase = 'feedback' AND active_attempt_id = ?`,
      ).run(sessionId!, input.attemptId!);
      if (update.changes !== 1) {
        throw new Error("Could not persist reconstruction requirement for feedback episode");
      }
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

export function effectiveEvidenceIdsForAttempt(db: Database.Database, attemptId: number): string[] {
  return (db
    .prepare(
      `SELECT evidence.id
       FROM evidence_events evidence
       WHERE evidence.attempt_id = ?
         AND COALESCE((
           SELECT revision.action
           FROM evidence_revisions revision
           WHERE revision.evidence_event_id = evidence.id
           ORDER BY revision.seq DESC
           LIMIT 1
         ), 'restore') <> 'invalidate'
       ORDER BY evidence.seq`,
    )
    .all(attemptId) as Array<{ id: string }>).map((row) => row.id);
}

function attemptHasCompleteEffectiveAssessment(
  db: Database.Database,
  attempt: Attempt,
  challenge: ChallengeSpec,
): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT evidence.objective_id) AS count
       FROM evidence_events evidence
       WHERE evidence.attempt_id = ?
         AND COALESCE((
           SELECT revision.action
           FROM evidence_revisions revision
           WHERE revision.evidence_event_id = evidence.id
           ORDER BY revision.seq DESC
           LIMIT 1
         ), 'restore') <> 'invalidate'`,
    )
    .get(attempt.id) as { count: number };
  return row.count === challenge.targets.length;
}

function resumableAttempt(
  db: Database.Database,
  attempt: Attempt,
  challenge: ChallengeSpec,
): ResumableAttempt {
  const exposureRows = db
    .prepare(`SELECT * FROM exposure_events WHERE attempt_id = ? ORDER BY occurred_at, seq`)
    .all(attempt.id);
  return {
    attempt,
    challenge,
    authoringContract: getChallengeAuthoringContract(db, challenge.id, challenge.version),
    hintObservations: getHintObservationsForAttempt(db, attempt.id),
    exposureEvents: ExposureEventSchema.array().parse(exposureRows),
    effectiveEvidenceIds: effectiveEvidenceIdsForAttempt(db, attempt.id),
  };
}

function unresolvedAttemptsForSession(db: Database.Database, sessionId: number): {
  verification: ResumableAttempt[];
  assessment: ResumableAttempt[];
} {
  const attempts = AttemptSchema.array().parse(
    db.prepare(
      `SELECT * FROM attempts
       WHERE session_id = ? AND submitted_at IS NOT NULL AND challenge_id IS NOT NULL
       ORDER BY submitted_at, id`,
    ).all(sessionId),
  );
  const verification: ResumableAttempt[] = [];
  const assessment: ResumableAttempt[] = [];

  for (const attempt of attempts) {
    if (getChallengeAttemptDisposition(db, attempt.id) !== null) continue;
    const challenge = getFrozenChallengeOrThrow(
      db,
      attempt.challenge_id!,
      attempt.challenge_version!,
    );
    if (attemptHasCompleteEffectiveAssessment(db, attempt, challenge)) continue;
    const item = resumableAttempt(db, attempt, challenge);
    if (challenge.verification.required && attempt.verification_output_json === null) {
      verification.push(item);
    } else {
      assessment.push(item);
    }
  }
  return { verification, assessment };
}

export function advanceSessionToFeedback(db: Database.Database, attemptId: number): void {
  const attempt = getAttemptOrThrow(db, attemptId);
  if (attempt.session_id === null || attempt.challenge_id === null || attempt.challenge_version === null) return;
  const session = SessionSchema.parse(
    db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(attempt.session_id),
  );
  const reconstructionStatus =
    session.active_attempt_id === attempt.id && session.reconstruction_status === "required"
      ? "required"
      : "not_required";
  db.prepare(
    `UPDATE sessions
     SET phase = 'feedback', pending_action = 'present_feedback',
         active_challenge_id = ?, active_challenge_version = ?, active_attempt_id = ?,
         reconstruction_status = ?
     WHERE id = ?`,
  ).run(
    attempt.challenge_id,
    attempt.challenge_version,
    attempt.id,
    reconstructionStatus,
    attempt.session_id,
  );
}

export function syncSessionAfterEvidenceChange(db: Database.Database, attemptId: number): void {
  const attempt = getAttemptOrThrow(db, attemptId);
  if (attempt.session_id === null || attempt.challenge_id === null || attempt.challenge_version === null) return;
  const challenge = getFrozenChallengeOrThrow(db, attempt.challenge_id, attempt.challenge_version);
  if (attemptHasCompleteEffectiveAssessment(db, attempt, challenge)) {
    advanceSessionToFeedback(db, attemptId);
    return;
  }
  const awaitingVerification = challenge.verification.required && attempt.verification_output_json === null;
  db.prepare(
    `UPDATE sessions
     SET phase = ?, pending_action = ?,
         active_challenge_id = ?, active_challenge_version = ?, active_attempt_id = ?,
         reconstruction_status = 'not_required'
     WHERE id = ?`,
  ).run(
    awaitingVerification ? "awaiting_verification" : "awaiting_assessment",
    awaitingVerification ? "run_verification" : "assess_response",
    challenge.id,
    challenge.version,
    attempt.id,
    attempt.session_id,
  );
}

function setSessionToNextUnresolvedOrComplete(
  db: Database.Database,
  sessionId: number,
  markEnded: boolean,
): void {
  const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
  const now = new Date().toISOString();
  if (session.active_attempt_id !== null) {
    const active = getAttemptOrThrow(db, session.active_attempt_id);
    if (active.submitted_at === null) {
      db.prepare(
        `UPDATE sessions
         SET ended_at = CASE WHEN ? THEN COALESCE(ended_at, ?) ELSE ended_at END,
             phase = 'awaiting_response', pending_action = 'collect_response'
         WHERE id = ?`,
      ).run(markEnded ? 1 : 0, now, sessionId);
      return;
    }
  }

  const unresolved = unresolvedAttemptsForSession(db, sessionId);
  const next = unresolved.verification[0] ?? unresolved.assessment[0];
  if (next) {
    const needsVerification = unresolved.verification.includes(next);
    db.prepare(
      `UPDATE sessions
       SET ended_at = CASE WHEN ? THEN COALESCE(ended_at, ?) ELSE ended_at END,
           phase = ?, pending_action = ?,
           active_challenge_id = ?, active_challenge_version = ?, active_attempt_id = ?,
           reconstruction_status = 'not_required'
       WHERE id = ?`,
    ).run(
      markEnded ? 1 : 0,
      now,
      needsVerification ? "awaiting_verification" : "awaiting_assessment",
      needsVerification ? "run_verification" : "assess_response",
      next.challenge.id,
      next.challenge.version,
      next.attempt.id,
      sessionId,
    );
    return;
  }

  db.prepare(
    `UPDATE sessions
     SET ended_at = CASE WHEN ? THEN COALESCE(ended_at, ?) ELSE ended_at END,
         phase = 'complete', pending_action = 'none',
         active_challenge_id = NULL, active_challenge_version = NULL, active_attempt_id = NULL
     WHERE id = ?`,
  ).run(markEnded ? 1 : 0, now, sessionId);
}

export function abandonUnsubmittedSession(
  db: Database.Database,
  sessionId: number,
): Session {
  return db.transaction(() => {
    const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
    if (session.active_attempt_id === null) {
      throw new Error(`Session ${sessionId} has no active unsubmitted attempt to abandon`);
    }
    const attempt = getAttemptOrThrow(db, session.active_attempt_id);
    if (attempt.submitted_at !== null) {
      throw new Error(`Session ${sessionId} active attempt is already submitted`);
    }
    const unresolved = unresolvedAttemptsForSession(db, sessionId);
    if (unresolved.verification.length > 0 || unresolved.assessment.length > 0) {
      throw new Error(`Session ${sessionId} has submitted work that must finish its evidence lifecycle`);
    }
    db.prepare(
      `UPDATE sessions
       SET ended_at = COALESCE(ended_at, ?),
           phase = 'complete', pending_action = 'none',
           active_challenge_id = NULL, active_challenge_version = NULL, active_attempt_id = NULL
       WHERE id = ?`,
    ).run(new Date().toISOString(), sessionId);
    return SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
  })();
}

export function finishSessionInteraction(db: Database.Database, sessionId: number): void {
  const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
  if (session.phase === "feedback" && session.pending_action === "present_feedback") {
    db.prepare(`UPDATE sessions SET ended_at = COALESCE(ended_at, ?) WHERE id = ?`)
      .run(new Date().toISOString(), sessionId);
    return;
  }
  setSessionToNextUnresolvedOrComplete(db, sessionId, true);
}

export function closeSessionAfterRejectedAttempt(
  db: Database.Database,
  sessionId: number,
  attemptId: number,
): Session {
  const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
  if (session.active_attempt_id !== attemptId) {
    throw new Error(`Session ${sessionId} active attempt is not ${attemptId}`);
  }
  db.prepare(
    `UPDATE sessions
     SET ended_at = COALESCE(ended_at, ?),
         phase = 'complete', pending_action = 'none',
         active_challenge_id = NULL, active_challenge_version = NULL, active_attempt_id = NULL,
         reconstruction_status = 'not_required'
     WHERE id = ?`,
  ).run(new Date().toISOString(), sessionId);
  return SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
}

export function completeSessionFeedback(
  db: Database.Database,
  sessionId: number,
  input: CompleteSessionFeedbackInput = {},
): void {
  db.transaction(() => {
    const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
    if (session.phase !== "feedback" || session.pending_action !== "present_feedback") {
      throw new Error(`Session ${sessionId} is not awaiting feedback completion`);
    }
    if (session.reconstruction_status === "required") {
      throw new Error(
        `Session ${sessionId} requires learner reconstruction or explicit opt-out before feedback can close`,
      );
    }
    persistActiveTime(
      db,
      session.active_attempt_id,
      validateActiveTimeSeconds(input.activeTimeSeconds),
    );
    setSessionToNextUnresolvedOrComplete(db, sessionId, true);
  })();
}

export function resolveSessionReconstruction(
  db: Database.Database,
  sessionId: number,
  input: ResolveSessionReconstructionInput,
): Session {
  return db.transaction(() => {
    const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
    if (session.phase !== "feedback" || session.pending_action !== "present_feedback") {
      throw new Error(`Session ${sessionId} is not in feedback`);
    }
    if (session.reconstruction_status !== "required") {
      throw new Error(`Session ${sessionId} does not require reconstruction`);
    }
    const activeTimeSeconds = validateActiveTimeSeconds(input.activeTimeSeconds);
    persistActiveTime(db, session.active_attempt_id, activeTimeSeconds);
    db.prepare(`UPDATE sessions SET reconstruction_status = ? WHERE id = ?`)
      .run(input.outcome, sessionId);
    setSessionToNextUnresolvedOrComplete(db, sessionId, true);
    return SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
  })();
}

export function resumeSession(db: Database.Database, sessionId: number): ResumedSession {
  const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
  const unresolved = unresolvedAttemptsForSession(db, sessionId);
  const activeAttempt = session.active_attempt_id === null
    ? null
    : getAttemptOrThrow(db, session.active_attempt_id);
  if (
    (session.active_challenge_id === null) !== (session.active_challenge_version === null) ||
    (session.active_attempt_id === null) !== (session.active_challenge_id === null)
  ) {
    throw new Error(`Session ${sessionId} has inconsistent active restart references`);
  }
  const activeChallenge = session.active_challenge_id === null || session.active_challenge_version === null
    ? null
    : getFrozenChallengeOrThrow(db, session.active_challenge_id, session.active_challenge_version);
  if (
    activeAttempt && activeChallenge &&
    (activeAttempt.session_id !== sessionId ||
      activeAttempt.challenge_id !== activeChallenge.id ||
      activeAttempt.challenge_version !== activeChallenge.version)
  ) {
    throw new Error(`Session ${sessionId} active attempt does not match its frozen challenge reference`);
  }
  const activeAttemptState = activeAttempt && activeChallenge
    ? resumableAttempt(db, activeAttempt, activeChallenge)
    : null;

  let phase = session.phase;
  let pendingAction = session.pending_action;
  if (activeAttempt && activeAttempt.submitted_at === null) {
    phase = "awaiting_response";
    pendingAction = "collect_response";
  } else if (!(phase === "feedback" && pendingAction === "present_feedback")) {
    if (unresolved.verification.length > 0) {
      phase = "awaiting_verification";
      pendingAction = "run_verification";
    } else if (unresolved.assessment.length > 0) {
      phase = "awaiting_assessment";
      pendingAction = "assess_response";
    } else if (session.ended_at !== null) {
      phase = "complete";
      pendingAction = "none";
    }
  }

  return {
    session,
    phase,
    pendingAction,
    activeChallenge,
    activeAttempt,
    activeAttemptState,
    reconstructionRequired: session.reconstruction_status === "required",
    unresolvedVerificationAttempts: unresolved.verification,
    unresolvedAssessmentAttempts: unresolved.assessment,
  };
}

export function listResumableSessions(
  db: Database.Database,
  topicId?: string,
): ResumedSession[] {
  const rows = topicId === undefined
    ? db
        .prepare(
          `SELECT id FROM sessions
           WHERE phase <> 'complete'
           ORDER BY COALESCE(started_at, '') DESC, id DESC`,
        )
        .all()
    : db
        .prepare(
          `SELECT id FROM sessions
           WHERE topic_id = ? AND phase <> 'complete'
           ORDER BY COALESCE(started_at, '') DESC, id DESC`,
        )
        .all(topicId);
  return (rows as Array<{ id: number }>)
    .map((row) => resumeSession(db, row.id))
    .filter((session) => session.phase !== "complete");
}
