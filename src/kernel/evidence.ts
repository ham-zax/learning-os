import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  AssessmentResultSchema,
  ClaimObservationSchema,
  ClaimSchema,
  EvidenceEventSchema,
  EvidenceRevisionAction,
  EvidenceRevisionSchema,
  ObjectiveAssessmentResultSchema,
  ObjectiveProjectionSchema,
  VerificationOutputSchema,
  WeaknessProjectionSchema,
} from "../db/types.js";
import type {
  AssessmentResult,
  AssessmentResultInput,
  Attempt,
  ChallengeSpec,
  Claim,
  ClaimKind,
  ClaimObservation,
  EvidenceEvent,
  EvidenceRevision,
  Misconception,
  ObjectiveAssessmentResult,
  ObjectiveProjection,
  VerificationOutput,
  WeaknessProjection,
} from "../db/types.js";
import {
  appendReviewEventForEvidence,
  advanceObjectiveReviewCard,
  rebuildObjectiveReviewCard,
} from "../scheduler/index.js";
import { parseRequestInput } from "../errors.js";
import {
  advanceSessionToFeedback,
  getAttempt,
  getChallenge,
  getChallengeAttemptDisposition,
  getHintObservationsForAttempt,
  syncSessionAfterEvidenceChange,
} from "./foundation.js";

const PROJECTOR_VERSION = "v2";
const WEAKNESS_PROJECTOR_VERSION = "v2";
const DURABILITY_FLOOR_SECONDS = 7 * 24 * 60 * 60;

export interface CreateClaimInput {
  id: string;
  conceptId: string;
  kind?: ClaimKind;
  description: string;
  correctionStrategy?: string;
  isBlocking?: boolean;
}

export type CreateMisconceptionInput = Omit<CreateClaimInput, "kind">;

export interface EvidenceClaimObservationSummary {
  claimId: string;
  kind: ClaimKind;
  criterionId: string;
  disposition: "observed" | "cleared";
  description: string;
  isBlocking: boolean;
}

export interface AssessmentCommitResult {
  evidenceEvents: EvidenceEvent[];
  projections: ObjectiveProjection[];
  weaknesses: WeaknessProjection[];
}

export interface ReviseEvidenceInput {
  action: "invalidate" | "restore";
  reason: string;
  correctedObjectiveResult?: ObjectiveAssessmentResult;
}

export interface EvidenceRevisionResult {
  revision: EvidenceRevision;
  replacementEvent: EvidenceEvent | null;
  projection: ObjectiveProjection;
  weaknesses: WeaknessProjection[];
}

type EffectiveObservation = {
  observation: ClaimObservation;
  claimKind: ClaimKind;
  sourcePerformedAt: string;
  sourceEventSeq: number;
  isBlocking: boolean;
};

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  return trimmed;
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate values`);
  }
}

function attemptOrThrow(db: Database.Database, attemptId: number): Attempt {
  const attempt = getAttempt(db, attemptId);
  if (!attempt) {
    throw new Error(`Attempt not found: ${attemptId}`);
  }
  return attempt;
}

function challengeForAttemptOrThrow(
  db: Database.Database,
  attempt: Attempt,
): ChallengeSpec {
  if (attempt.challenge_id === null || attempt.challenge_version === null) {
    throw new Error(`Attempt is not backed by a frozen challenge: ${attempt.id}`);
  }
  const challenge = getChallenge(db, attempt.challenge_id, attempt.challenge_version);
  if (!challenge) {
    throw new Error(
      `Frozen challenge not found for attempt ${attempt.id}: ${attempt.challenge_id}@${attempt.challenge_version}`,
    );
  }
  return challenge;
}

function evidenceEventOrThrow(db: Database.Database, evidenceEventId: string): EvidenceEvent {
  const row = db.prepare(`SELECT * FROM evidence_events WHERE id = ?`).get(evidenceEventId);
  if (row === undefined) {
    throw new Error(`Evidence event not found: ${evidenceEventId}`);
  }
  return EvidenceEventSchema.parse(row);
}

function latestRevisionAction(
  db: Database.Database,
  evidenceEventId: string,
): "invalidate" | "restore" | null {
  const row = db
    .prepare(
      `SELECT action
       FROM evidence_revisions
       WHERE evidence_event_id = ?
       ORDER BY seq DESC
       LIMIT 1`,
    )
    .get(evidenceEventId) as { action: "invalidate" | "restore" } | undefined;
  return row?.action ?? null;
}

export function isEvidenceEffective(
  db: Database.Database,
  evidenceEventId: string,
): boolean {
  evidenceEventOrThrow(db, evidenceEventId);
  return latestRevisionAction(db, evidenceEventId) !== "invalidate";
}

export function getEvidenceEvent(
  db: Database.Database,
  evidenceEventId: string,
): EvidenceEvent | undefined {
  const row = db.prepare(`SELECT * FROM evidence_events WHERE id = ?`).get(evidenceEventId);
  return row === undefined ? undefined : EvidenceEventSchema.parse(row);
}

export function getEffectiveEvidenceEventsByObjective(
  db: Database.Database,
  objectiveId: string,
): EvidenceEvent[] {
  const rows = db
    .prepare(
      `SELECT evidence.*
       FROM evidence_events evidence
       WHERE evidence.objective_id = ?
         AND COALESCE((
           SELECT revision.action
           FROM evidence_revisions revision
           WHERE revision.evidence_event_id = evidence.id
           ORDER BY revision.seq DESC
           LIMIT 1
         ), 'restore') <> 'invalidate'
       ORDER BY evidence.performed_at, evidence.seq`,
    )
    .all(objectiveId);
  return EvidenceEventSchema.array().parse(rows);
}

export function createClaim(
  db: Database.Database,
  input: CreateClaimInput,
): Claim {
  const id = requireNonEmpty(input.id, "Claim id");
  const conceptId = requireNonEmpty(input.conceptId, "Claim concept id");
  const description = requireNonEmpty(input.description, "Claim description");
  const kind: ClaimKind = input.kind ?? "error_claim";
  const correctionStrategy = input.correctionStrategy?.trim() || null;
  const createdAt = new Date().toISOString();

  if (!db.prepare(`SELECT 1 FROM concepts WHERE id = ?`).get(conceptId)) {
    throw new Error(`Concept not found: ${conceptId}`);
  }

  db.prepare(
    `INSERT INTO claims (
       id, concept_id, kind, description, correction_strategy, is_blocking, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, conceptId, kind, description, correctionStrategy, input.isBlocking ? 1 : 0, createdAt);

  return getClaim(db, id)!;
}

export function getClaim(
  db: Database.Database,
  claimId: string,
): Claim | undefined {
  const row = db.prepare(`SELECT * FROM claims WHERE id = ?`).get(claimId);
  return row === undefined ? undefined : ClaimSchema.parse(row);
}

export function createMisconception(
  db: Database.Database,
  input: CreateMisconceptionInput,
): Misconception {
  return createClaim(db, { ...input, kind: "misconception" });
}

export function getMisconception(
  db: Database.Database,
  misconceptionId: string,
): Misconception | undefined {
  return getClaim(db, misconceptionId);
}

export function getClaimObservationsForEvidence(
  db: Database.Database,
  evidenceEventId: string,
): EvidenceClaimObservationSummary[] {
  const rows = db
    .prepare(
      `SELECT obs.claim_id,
              obs.criterion_id,
              obs.disposition,
              claim.kind,
              claim.description,
              claim.is_blocking
       FROM claim_observations obs
       JOIN claims claim ON claim.id = obs.claim_id
       WHERE obs.evidence_event_id = ?
       ORDER BY obs.seq`,
    )
    .all(evidenceEventId) as Array<{
    claim_id: string;
    criterion_id: string;
    disposition: "observed" | "cleared";
    kind: ClaimKind;
    description: string;
    is_blocking: number;
  }>;
  return rows.map((row) => ({
    claimId: row.claim_id,
    kind: row.kind,
    criterionId: row.criterion_id,
    disposition: row.disposition,
    description: row.description,
    isBlocking: row.is_blocking === 1,
  }));
}

function parseAssessment(input: AssessmentResultInput): AssessmentResult {
  return parseRequestInput(AssessmentResultSchema, input, { label: "assessment" });
}

function validateObjectiveResult(
  db: Database.Database,
  challenge: ChallengeSpec,
  result: ObjectiveAssessmentResult,
): void {
  const target = challenge.targets.find(
    (candidate: ChallengeSpec["targets"][number]) => candidate.objectiveId === result.objectiveId,
  );
  if (!target) {
    throw new Error(`Assessment objective is not a frozen target: ${result.objectiveId}`);
  }

  assertUnique(result.criteriaMet, `criteriaMet for ${result.objectiveId}`);
  assertUnique(result.criteriaUnmet, `criteriaUnmet for ${result.objectiveId}`);
  assertUnique(result.misconceptionsObserved, `misconceptionsObserved for ${result.objectiveId}`);
  assertUnique(result.misconceptionsCleared, `misconceptionsCleared for ${result.objectiveId}`);
  assertUnique(
    result.claimObservations.map((obs) => `${obs.claimId}@${obs.criterionId}`),
    `claimObservations for ${result.objectiveId}`,
  );

  const met = new Set(result.criteriaMet);
  const unmet = new Set(result.criteriaUnmet);
  for (const criterionId of met) {
    if (unmet.has(criterionId)) {
      throw new Error(
        `Assessment criterion cannot be both met and unmet for ${result.objectiveId}: ${criterionId}`,
      );
    }
  }

  const frozenCriteria = new Set(target.criterionIds);
  for (const criterionId of [...met, ...unmet]) {
    if (!frozenCriteria.has(criterionId)) {
      throw new Error(
        `Assessment criterion is not owned by frozen target ${result.objectiveId}: ${criterionId}`,
      );
    }
  }

  if (result.result !== "ungradable") {
    const covered = new Set([...met, ...unmet]);
    if (covered.size !== frozenCriteria.size) {
      throw new Error(
        `Gradable assessment must classify every frozen criterion for ${result.objectiveId}`,
      );
    }
  }

  if (result.result === "correct") {
    const unmetRequired = challenge.rubric.criteria.filter(
      (criterion: ChallengeSpec["rubric"]["criteria"][number]) =>
        criterion.objectiveId === result.objectiveId &&
        criterion.required &&
        unmet.has(criterion.id),
    );
    if (unmetRequired.length > 0) {
      throw new Error(
        `Correct assessment cannot leave required criteria unmet for ${result.objectiveId}: ${unmetRequired
          .map((criterion: ChallengeSpec["rubric"]["criteria"][number]) => criterion.id)
          .join(", ")}`,
      );
    }
  }

  const observedIds = new Set<string>(result.misconceptionsObserved);
  const clearedIds = new Set<string>(result.misconceptionsCleared);
  const linkedUnmetClaims = new Set<string>();
  const linkedMetClaims = new Set<string>();
  const linkedAnyClaims = new Set<string>();
  for (const criterion of challenge.rubric.criteria) {
    if (criterion.objectiveId !== result.objectiveId || criterion.claimIds.length === 0) continue;
    for (const claimId of criterion.claimIds) {
      linkedAnyClaims.add(claimId);
      if (unmet.has(criterion.id)) linkedUnmetClaims.add(claimId);
      if (met.has(criterion.id)) linkedMetClaims.add(claimId);
    }
  }

  for (const obs of result.claimObservations) {
    if (!frozenCriteria.has(obs.criterionId)) {
      throw new Error(
        `Claim observation criterion is not owned by frozen target ${result.objectiveId}: ${obs.criterionId}`,
      );
    }
    if (obs.disposition === "cleared") {
      if (!met.has(obs.criterionId)) {
        throw new Error(
          `Cannot clear claim ${obs.claimId} via unmet/unassessed criterion ${obs.criterionId}`,
        );
      }
      if (linkedUnmetClaims.has(obs.claimId)) {
        throw new Error(
          `Cannot clear claim ${obs.claimId} while another linked criterion is unmet on ${result.objectiveId}`,
        );
      }
    }
    if (obs.disposition === "observed") observedIds.add(obs.claimId);
    else clearedIds.add(obs.claimId);
  }

  for (const misconceptionId of result.misconceptionsCleared) {
    if (linkedUnmetClaims.has(misconceptionId)) {
      throw new Error(
        `Cannot clear misconception ${misconceptionId} while a linked criterion is unmet on ${result.objectiveId}`,
      );
    }
    if (!linkedMetClaims.has(misconceptionId)) {
      throw new Error(
        `Cannot clear misconception ${misconceptionId} without meeting a frozen criterion linked to it on ${result.objectiveId}`,
      );
    }
  }

  for (const claimId of clearedIds) {
    if (observedIds.has(claimId)) {
      throw new Error(
        `Claim/misconception cannot be observed and cleared in one objective result: ${claimId}`,
      );
    }
  }

  const objective = db
    .prepare(`SELECT concept_id FROM learning_objectives WHERE id = ?`)
    .get(result.objectiveId) as { concept_id: string } | undefined;
  if (!objective) {
    throw new Error(`Learning objective not found: ${result.objectiveId}`);
  }

  for (const misconceptionId of [
    ...result.misconceptionsObserved,
    ...result.misconceptionsCleared,
  ]) {
    const claim = db
      .prepare(`SELECT concept_id FROM claims WHERE id = ?`)
      .get(misconceptionId) as { concept_id: string } | undefined;
    if (!claim) {
      throw new Error(`Misconception definition not found: ${misconceptionId}`);
    }
    if (claim.concept_id !== objective.concept_id) {
      throw new Error(
        `Misconception ${misconceptionId} does not belong to objective concept ${objective.concept_id}`,
      );
    }
  }

  for (const obs of result.claimObservations) {
    const existing = db
      .prepare(`SELECT concept_id FROM claims WHERE id = ?`)
      .get(obs.claimId) as { concept_id: string } | undefined;
    if (existing) {
      if (existing.concept_id !== objective.concept_id) {
        throw new Error(
          `Claim ${obs.claimId} does not belong to objective concept ${objective.concept_id}`,
        );
      }
    } else if (obs.kind === "misconception") {
      throw new Error(`Misconception definition not found: ${obs.claimId}`);
    }
  }
}

function validateAssessmentTargets(
  db: Database.Database,
  challenge: ChallengeSpec,
  assessment: AssessmentResult,
): void {
  assertUnique(
    assessment.objectiveResults.map((result: ObjectiveAssessmentResult) => result.objectiveId),
    "Assessment objective results",
  );

  const frozenTargets = new Set(
    challenge.targets.map((target: ChallengeSpec["targets"][number]) => target.objectiveId),
  );
  const assessedTargets = new Set(
    assessment.objectiveResults.map((result: ObjectiveAssessmentResult) => result.objectiveId),
  );
  if (frozenTargets.size !== assessedTargets.size) {
    throw new Error("Assessment must contain exactly one result for every frozen target objective");
  }
  for (const objectiveId of frozenTargets) {
    if (!assessedTargets.has(objectiveId)) {
      throw new Error(`Assessment is missing frozen target objective: ${objectiveId}`);
    }
  }

  for (const result of assessment.objectiveResults) {
    validateObjectiveResult(db, challenge, result);
  }
}

function normalizeVerificationOutput(
  db: Database.Database,
  attempt: Attempt,
  assessment: AssessmentResult,
): VerificationOutput | null {
  const supplied = assessment.verificationOutput
    ? VerificationOutputSchema.parse(assessment.verificationOutput)
    : null;
  const existing = attempt.verification_output_json
    ? VerificationOutputSchema.parse(attempt.verification_output_json)
    : null;

  if (existing && supplied && JSON.stringify(existing) !== JSON.stringify(supplied)) {
    throw new Error(`Attempt ${attempt.id} already has different immutable verification output`);
  }

  const resolved = existing ?? supplied;
  if (!existing && supplied) {
    db.prepare(`UPDATE attempts SET verification_output_json = ? WHERE id = ?`).run(
      JSON.stringify(supplied),
      attempt.id,
    );
  }
  return resolved;
}

function hasRecordedVerificationStdout(verificationOutput: VerificationOutput): boolean {
  const details = verificationOutput.details ?? {};
  return [details.stdout, details.output].some(
    (value) =>
      typeof value === "string" ||
      (Array.isArray(value) && value.every((line) => typeof line === "string")),
  );
}

function validateVerificationContract(
  challenge: ChallengeSpec,
  assessment: AssessmentResult,
  verificationOutput: VerificationOutput | null,
): void {
  const hasGradableResult = assessment.objectiveResults.some(
    (result: ObjectiveAssessmentResult) => result.result !== "ungradable",
  );
  const executionBasis =
    assessment.assessmentBasis === "deterministic_execution" ||
    assessment.assessmentBasis === "mixed";

  if (hasGradableResult && executionBasis) {
    if (!verificationOutput) {
      throw new Error("Gradable deterministic/mixed assessment requires verification output");
    }
    if (!hasRecordedVerificationStdout(verificationOutput)) {
      throw new Error(
        "Deterministic verification must record the run output in details.stdout or details.output",
      );
    }
  }

  if (hasGradableResult && challenge.verification.required) {
    if (!verificationOutput) {
      throw new Error("Frozen challenge requires deterministic verification output");
    }
    if (!executionBasis) {
      throw new Error(
        "Frozen challenge requiring verification must use deterministic_execution or mixed assessment basis",
      );
    }
  }

  if (hasGradableResult && challenge.gradingBasis && assessment.assessmentBasis !== challenge.gradingBasis) {
    throw new Error(
      `Frozen challenge requires assessmentBasis '${challenge.gradingBasis}', received '${assessment.assessmentBasis}'`,
    );
  }

  // The frozen verification contract is challenge-wide while assessment is
  // objective-specific. Presence/provenance is enforced here; interpreting a
  // failed verifier against each objective's frozen criteria belongs to the
  // assessment surface that produces the objective results.
}

function deriveHintLevel(
  db: Database.Database,
  attemptId: number,
  challenge: ChallengeSpec,
  objectiveId: string,
): number {
  const target = challenge.targets.find(
    (candidate: ChallengeSpec["targets"][number]) => candidate.objectiveId === objectiveId,
  );
  if (!target) {
    throw new Error(`Frozen challenge target not found: ${objectiveId}`);
  }
  const ownedCriteria = new Set(target.criterionIds);
  let level = 0;
  for (const observation of getHintObservationsForAttempt(db, attemptId)) {
    let relevant = false;
    if (observation.scope_kind === "all_targets") {
      relevant = true;
    } else if (observation.scope_kind === "objective") {
      relevant = observation.objective_id === objectiveId;
    } else if (observation.scope_kind === "criteria") {
      relevant = (observation.criterion_ids_json ?? []).some((criterionId: string) =>
        ownedCriteria.has(criterionId),
      );
    }
    if (relevant) {
      level = Math.max(level, observation.level);
    }
  }
  return level;
}

function computeDelay(
  db: Database.Database,
  objectiveId: string,
  currentAttemptId: number,
  performedAt: string,
): { delayAnchorAt: string | null; delaySeconds: number | null } {
  const priorAttempt = db
    .prepare(
      `SELECT CASE
                WHEN attempt.submitted_at IS NOT NULL AND attempt.submitted_at <= ?
                  THEN attempt.submitted_at
                ELSE attempt.started_at
              END AS contact_at
       FROM attempts attempt
       JOIN challenge_targets target
         ON target.challenge_id = attempt.challenge_id
        AND target.version = attempt.challenge_version
       WHERE target.objective_id = ?
         AND attempt.id <> ?
         AND attempt.started_at <= ?
       ORDER BY contact_at DESC, attempt.id DESC
       LIMIT 1`,
    )
    .get(performedAt, objectiveId, currentAttemptId, performedAt) as
    | { contact_at: string }
    | undefined;

  const priorExposure = db
    .prepare(
      `SELECT occurred_at AS contact_at
       FROM exposure_events
       WHERE objective_id = ?
         AND (attempt_id IS NULL OR attempt_id <> ?)
         AND occurred_at <= ?
       ORDER BY occurred_at DESC, seq DESC
       LIMIT 1`,
    )
    .get(objectiveId, currentAttemptId, performedAt) as { contact_at: string } | undefined;

  const contacts = [priorAttempt?.contact_at, priorExposure?.contact_at].filter(
    (value): value is string => value !== undefined,
  );
  if (contacts.length === 0) {
    return { delayAnchorAt: null, delaySeconds: null };
  }

  const delayAnchorAt = contacts.sort().at(-1)!;
  const delaySeconds = Math.max(
    0,
    Math.floor((Date.parse(performedAt) - Date.parse(delayAnchorAt)) / 1000),
  );
  return { delayAnchorAt, delaySeconds };
}

function hasPreResponseExposure(
  db: Database.Database,
  objectiveId: string,
  attempt: Attempt,
  performedAt: string,
): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM exposure_events
         WHERE objective_id = ?
           AND occurred_at >= ?
           AND occurred_at <= ?
           AND NOT (attempt_id IS NOT NULL AND attempt_id < ? AND occurred_at = ?)
         LIMIT 1`,
      )
      .get(objectiveId, attempt.started_at, performedAt, attempt.id, attempt.started_at),
  );
}

function computeRetrievalValid(
  db: Database.Database,
  challenge: ChallengeSpec,
  attempt: Attempt,
  objectiveResult: ObjectiveAssessmentResult,
  hintLevel: number,
  verificationOutput: VerificationOutput | null,
): boolean {
  if (attempt.submitted_at === null) return false;
  if (objectiveResult.result === "ungradable") return false;
  if (hintLevel !== 0) return false;

  const parent = db
    .prepare(
      `SELECT created_at, is_frozen
       FROM challenge_versions
       WHERE challenge_id = ? AND version = ?`,
    )
    .get(challenge.id, challenge.version) as
    | { created_at: string; is_frozen: number }
    | undefined;
  if (!parent || parent.is_frozen !== 1 || parent.created_at > attempt.started_at) {
    return false;
  }

  if (challenge.verification.required && !verificationOutput) {
    return false;
  }

  if (hasPreResponseExposure(db, objectiveResult.objectiveId, attempt, attempt.submitted_at)) {
    return false;
  }

  return true;
}

function insertEvidenceEvent(
  db: Database.Database,
  attempt: Attempt,
  challenge: ChallengeSpec,
  objectiveResult: ObjectiveAssessmentResult,
  evaluatorType: AssessmentResult["evaluatorType"],
  assessmentBasis: AssessmentResult["assessmentBasis"],
  verificationOutput: VerificationOutput | null,
  supersedesEventId: string | null = null,
): EvidenceEvent {
  if (attempt.submitted_at === null) {
    throw new Error(`Attempt must be submitted before assessment: ${attempt.id}`);
  }
  const target = challenge.targets.find(
    (candidate: ChallengeSpec["targets"][number]) =>
      candidate.objectiveId === objectiveResult.objectiveId,
  );
  if (!target) {
    throw new Error(`Frozen challenge target not found: ${objectiveResult.objectiveId}`);
  }

  const hintLevel = deriveHintLevel(db, attempt.id, challenge, objectiveResult.objectiveId);
  const problemId =
    challenge.sourceProblemId &&
    db.prepare(`SELECT 1 FROM problems WHERE id = ?`).get(challenge.sourceProblemId)
      ? challenge.sourceProblemId
      : null;
  const performedAt = attempt.submitted_at;
  const { delayAnchorAt, delaySeconds } = computeDelay(
    db,
    objectiveResult.objectiveId,
    attempt.id,
    performedAt,
  );
  const retrievalValid = computeRetrievalValid(
    db,
    challenge,
    attempt,
    objectiveResult,
    hintLevel,
    verificationOutput,
  );
  const createdAt = new Date().toISOString();
  const id = randomUUID();

  const info = db
    .prepare(
      `INSERT INTO evidence_events (
         id,
         objective_id,
         supersedes_event_id,
         session_id,
         problem_id,
         attempt_id,
         task_id,
         task_version,
         rubric_id,
         rubric_version,
         task_form,
         delivery_context,
         result,
         hint_level,
         novelty,
         retrieval_valid,
         delay_anchor_at,
         delay_seconds,
         assessment_basis,
         evaluator_type,
         criteria_json,
         rationale,
         performed_at,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      objectiveResult.objectiveId,
      supersedesEventId,
      attempt.session_id,
      problemId,
      attempt.id,
      challenge.id,
      challenge.version,
      challenge.rubric.id,
      challenge.rubric.version,
      challenge.taskForm,
      challenge.deliveryContext,
      objectiveResult.result,
      hintLevel,
      target.novelty,
      retrievalValid ? 1 : 0,
      delayAnchorAt,
      delaySeconds,
      assessmentBasis,
      evaluatorType,
      JSON.stringify({ met: objectiveResult.criteriaMet, unmet: objectiveResult.criteriaUnmet }),
      objectiveResult.rationale,
      performedAt,
      createdAt,
    );

  const row = db
    .prepare(`SELECT * FROM evidence_events WHERE seq = ?`)
    .get(Number(info.lastInsertRowid));
  return EvidenceEventSchema.parse(row);
}

function criterionForLegacyMisconception(
  challenge: ChallengeSpec,
  result: ObjectiveAssessmentResult,
  claimId: string,
  disposition: "observed" | "cleared",
): string {
  const targetCriteria = challenge.rubric.criteria.filter(
    (c) => c.objectiveId === result.objectiveId,
  );
  const metSet = new Set(result.criteriaMet);
  const unmetSet = new Set(result.criteriaUnmet);

  if (disposition === "cleared") {
    const linkedMet = targetCriteria.find(
      (c) => c.claimIds.includes(claimId) && metSet.has(c.id),
    );
    if (linkedMet) return linkedMet.id;
    throw new Error(
      `Cannot clear misconception ${claimId} without meeting a frozen criterion linked to it on ${result.objectiveId}`,
    );
  }

  const linkedUnmet = targetCriteria.find(
    (c) => c.claimIds.includes(claimId) && unmetSet.has(c.id),
  );
  if (linkedUnmet) return linkedUnmet.id;
  if (result.criteriaUnmet.length > 0) return result.criteriaUnmet[0]!;
  const linkedAny = targetCriteria.find((c) => c.claimIds.includes(claimId));
  if (linkedAny) return linkedAny.id;
  return targetCriteria[0]!.id;
}

function appendClaimObservations(
  db: Database.Database,
  challenge: ChallengeSpec,
  evidence: EvidenceEvent,
  result: ObjectiveAssessmentResult,
): void {
  const objective = db
    .prepare(`SELECT concept_id FROM learning_objectives WHERE id = ?`)
    .get(result.objectiveId) as { concept_id: string };
  const insert = db.prepare(
    `INSERT INTO claim_observations (
       claim_id,
       objective_id,
       evidence_event_id,
       criterion_id,
       disposition,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  // Compute exactly ONE order-independent disposition per claim for this evidence event.
  // If any criterion linked to a claim failed ("observed"), the claim stays "observed"
  // regardless of rubric ordering.
  const perClaim = new Map<
    string,
    {
      disposition: "observed" | "cleared";
      criterionId: string;
      definition?: {
        kind: ClaimKind;
        description: string;
        correctionStrategy?: string;
        isBlocking: boolean;
      };
    }
  >();

  const mergeClaim = (
    claimId: string,
    criterionId: string,
    disposition: "observed" | "cleared",
    definition?: {
      kind: ClaimKind;
      description: string;
      correctionStrategy?: string;
      isBlocking: boolean;
    },
  ) => {
    const existing = perClaim.get(claimId);
    if (!existing) {
      perClaim.set(claimId, { disposition, criterionId, definition });
      return;
    }
    if (disposition === "observed" && existing.disposition !== "observed") {
      perClaim.set(claimId, {
        disposition: "observed",
        criterionId,
        definition: definition ?? existing.definition,
      });
    } else if (!existing.definition && definition) {
      existing.definition = definition;
    }
  };

  for (const obs of result.claimObservations) {
    mergeClaim(obs.claimId, obs.criterionId, obs.disposition, {
      kind: obs.kind ?? "error_claim",
      description: obs.description ?? obs.claimId,
      correctionStrategy: obs.correctionStrategy,
      isBlocking: obs.isBlocking ?? false,
    });
  }

  for (const misconceptionId of result.misconceptionsObserved) {
    const criterionId = criterionForLegacyMisconception(
      challenge,
      result,
      misconceptionId,
      "observed",
    );
    mergeClaim(misconceptionId, criterionId, "observed");
  }
  for (const misconceptionId of result.misconceptionsCleared) {
    const criterionId = criterionForLegacyMisconception(
      challenge,
      result,
      misconceptionId,
      "cleared",
    );
    mergeClaim(misconceptionId, criterionId, "cleared");
  }

  // Propagate frozen criterion -> claim links in an order-independent manner.
  const metSet = new Set(result.criteriaMet);
  const unmetSet = new Set(result.criteriaUnmet);
  for (const criterion of challenge.rubric.criteria) {
    if (criterion.objectiveId !== result.objectiveId || criterion.claimIds.length === 0) continue;
    const disposition = unmetSet.has(criterion.id)
      ? "observed"
      : metSet.has(criterion.id)
        ? "cleared"
        : null;
    if (!disposition) continue;
    for (const claimId of criterion.claimIds) {
      mergeClaim(claimId, criterion.id, disposition);
    }
  }

  for (const [claimId, entry] of perClaim) {
    if (!getClaim(db, claimId)) {
      createClaim(db, {
        id: claimId,
        conceptId: objective.concept_id,
        kind: entry.definition?.kind ?? "error_claim",
        description: entry.definition?.description ?? claimId,
        correctionStrategy: entry.definition?.correctionStrategy,
        isBlocking: entry.definition?.isBlocking ?? false,
      });
    }
    insert.run(
      claimId,
      result.objectiveId,
      evidence.id,
      entry.criterionId,
      entry.disposition,
      evidence.created_at,
    );
  }
}

export function getEffectiveClaimObservations(
  db: Database.Database,
  objectiveId: string,
): EffectiveObservation[] {
  const rows = db
    .prepare(
      `SELECT observation.*,
              claim.kind AS claim_kind,
              evidence.performed_at AS source_performed_at,
              evidence.seq AS source_event_seq,
              claim.is_blocking AS is_blocking
       FROM claim_observations observation
       JOIN evidence_events evidence ON evidence.id = observation.evidence_event_id
       JOIN claims claim ON claim.id = observation.claim_id
       WHERE observation.objective_id = ?
         AND COALESCE((
           SELECT revision.action
           FROM evidence_revisions revision
           WHERE revision.evidence_event_id = evidence.id
           ORDER BY revision.seq DESC
           LIMIT 1
         ), 'restore') <> 'invalidate'
       ORDER BY evidence.performed_at, evidence.seq, observation.seq`,
    )
    .all(objectiveId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    observation: ClaimObservationSchema.parse(row),
    claimKind: row.claim_kind as ClaimKind,
    sourcePerformedAt: String(row.source_performed_at),
    sourceEventSeq: Number(row.source_event_seq),
    isBlocking: Number(row.is_blocking) === 1,
  }));
}

function readinessRank(readiness: ObjectiveProjection["readiness"]): number {
  switch (readiness) {
    case "unknown":
      return 0;
    case "exposed":
      return 1;
    case "guided":
      return 2;
    case "independent":
      return 3;
    default:
      throw new Error(`Unknown readiness value: ${String(readiness)}`);
  }
}

function maxReadiness(
  left: ObjectiveProjection["readiness"],
  right: ObjectiveProjection["readiness"],
): ObjectiveProjection["readiness"] {
  return readinessRank(left) >= readinessRank(right) ? left : right;
}

function computeTransferState(events: EvidenceEvent[]): ObjectiveProjection["transfer_state"] {
  const qualifying = events.filter(
    (event) =>
      event.novelty === "transfer" &&
      event.hint_level === 0 &&
      event.retrieval_valid &&
      event.result !== "ungradable",
  );
  if (qualifying.length === 0) return "untested";
  const latest = qualifying.at(-1)!;
  if (latest.result === "correct") return "demonstrated";
  return qualifying.slice(0, -1).some((event) => event.result === "correct")
    ? "contradicted"
    : "not_demonstrated";
}

function computeDurabilityState(
  events: EvidenceEvent[],
): ObjectiveProjection["durability_state"] {
  const qualifying = events.filter(
    (event) =>
      event.retrieval_valid &&
      event.hint_level === 0 &&
      event.result !== "ungradable" &&
      event.delay_anchor_at !== null &&
      event.delay_seconds !== null &&
      event.delay_seconds >= DURABILITY_FLOOR_SECONDS,
  );
  if (qualifying.length === 0) return "untested";
  const latest = qualifying.at(-1)!;
  if (latest.result === "correct") return "demonstrated";
  return qualifying.slice(0, -1).some((event) => event.result === "correct")
    ? "contradicted"
    : "not_demonstrated";
}

function computeProjection(
  objectiveId: string,
  events: EvidenceEvent[],
  observations: EffectiveObservation[],
): ObjectiveProjection {
  const observationsByEvidence = new Map<string, EffectiveObservation[]>();
  for (const observation of observations) {
    const list = observationsByEvidence.get(observation.observation.evidence_event_id) ?? [];
    list.push(observation);
    observationsByEvidence.set(observation.observation.evidence_event_id, list);
  }

  const activeBlocking = new Map<string, boolean>();
  let blockingMisconceptionCount = 0;
  let historicalHighest: ObjectiveProjection["readiness"] = "unknown";
  let hasGradable = false;
  let hasUsefulSuccess = false;
  const latestUnaided: EvidenceEvent[] = [];
  let currentReadiness: ObjectiveProjection["readiness"] = "unknown";

  for (const event of events) {
    if (event.result !== "ungradable") {
      hasGradable = true;
      if ((event.result === "correct" || event.result === "partially_correct") &&
          ((event.hint_level >= 1 && event.hint_level <= 4) ||
           (event.hint_level === 0 && event.retrieval_valid))) {
        hasUsefulSuccess = true;
      }
      if (event.hint_level === 0 && event.retrieval_valid) {
        latestUnaided.push(event);
        if (latestUnaided.length > 2) latestUnaided.shift();
      }
    }
    for (const observation of observationsByEvidence.get(event.id) ?? []) {
      if (observation.isBlocking) {
        const id = observation.observation.claim_id;
        const wasActive = activeBlocking.get(id) ?? false;
        const isActive = observation.observation.disposition === "observed";
        blockingMisconceptionCount += Number(isActive) - Number(wasActive);
        activeBlocking.set(id, isActive);
      }
    }
    currentReadiness = !hasGradable ? "unknown" : !hasUsefulSuccess ? "exposed" : "guided";
    if (hasUsefulSuccess && latestUnaided.length === 2 && blockingMisconceptionCount === 0) {
      const [previous, latest] = latestUnaided;
      if (previous.result === "correct" && latest.result === "correct" &&
          (previous.task_id !== latest.task_id || previous.task_version !== latest.task_version)) {
        currentReadiness = "independent";
      }
    }
    historicalHighest = maxReadiness(historicalHighest, currentReadiness);
  }

  const gradable = events.filter((event) => event.result !== "ungradable");
  const latestGradable = gradable.at(-1);
  const rebuiltAt = new Date().toISOString();

  return ObjectiveProjectionSchema.parse({
    objective_id: objectiveId,
    readiness: currentReadiness,
    historical_highest_readiness: historicalHighest,
    transfer_state: computeTransferState(events),
    durability_state: computeDurabilityState(events),
    blocking_misconception_count: blockingMisconceptionCount,
    recent_failure:
      latestGradable !== undefined && latestGradable.result !== "correct" ? 1 : 0,
    last_qualifying_evidence_at: latestGradable?.performed_at ?? null,
    last_event_seq: events.reduce((max, event) => Math.max(max, event.seq), 0),
    projector_version: PROJECTOR_VERSION,
    rebuilt_at: rebuiltAt,
  });
}

function persistProjection(db: Database.Database, projection: ObjectiveProjection): void {
  const update = db
    .prepare(
      `UPDATE objective_projections
       SET readiness = ?,
           historical_highest_readiness = ?,
           transfer_state = ?,
           durability_state = ?,
           blocking_misconception_count = ?,
           recent_failure = ?,
           last_qualifying_evidence_at = ?,
           last_event_seq = ?,
           projector_version = ?,
           rebuilt_at = ?
       WHERE objective_id = ?`,
    )
    .run(
      projection.readiness,
      projection.historical_highest_readiness,
      projection.transfer_state,
      projection.durability_state,
      projection.blocking_misconception_count,
      projection.recent_failure ? 1 : 0,
      projection.last_qualifying_evidence_at,
      projection.last_event_seq,
      projection.projector_version,
      projection.rebuilt_at,
      projection.objective_id,
    );
  if (update.changes !== 1) {
    throw new Error(`Objective projection row not found: ${projection.objective_id}`);
  }
}

function rebuildWeaknessesInternal(
  db: Database.Database,
  objectiveId: string,
  observations: EffectiveObservation[],
): WeaknessProjection[] {
  const rebuiltAt = new Date().toISOString();
  const rows: Array<{
    key: string;
    category: string;
    lifecycle: "new" | "recurring" | "improving" | "resolved" | "retest";
    lastEventSeq: number;
  }> = [];

  const claimGroups = new Map<string, EffectiveObservation[]>();
  for (const observation of observations) {
    const list = claimGroups.get(observation.observation.claim_id) ?? [];
    list.push(observation);
    claimGroups.set(observation.observation.claim_id, list);
  }
  for (const [claimId, history] of claimGroups) {
    const observedCount = history.filter(
      (item) => item.observation.disposition === "observed",
    ).length;
    if (observedCount === 0) continue;
    const latest = history.at(-1)!;
    const prefix = latest.claimKind === "misconception" ? "misconception" : "claim";
    const lifecycle =
      latest.observation.disposition === "cleared"
        ? "resolved"
        : observedCount >= 2
          ? "recurring"
          : "new";
    rows.push({
      key: `${objectiveId}:${prefix}:${encodeURIComponent(claimId)}`,
      category: `${prefix}:${claimId}`,
      lifecycle,
      lastEventSeq: Math.max(...history.map((item) => item.sourceEventSeq)),
    });
  }

  db.prepare(`DELETE FROM weakness_projections WHERE objective_id = ?`).run(objectiveId);
  const insert = db.prepare(
    `INSERT INTO weakness_projections (
       key, objective_id, category, lifecycle, last_event_seq, projector_version, rebuilt_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of rows) {
    insert.run(
      row.key,
      objectiveId,
      row.category,
      row.lifecycle,
      row.lastEventSeq,
      WEAKNESS_PROJECTOR_VERSION,
      rebuiltAt,
    );
  }

  return WeaknessProjectionSchema.array().parse(
    db
      .prepare(
        `SELECT * FROM weakness_projections
         WHERE objective_id = ?
         ORDER BY category`,
      )
      .all(objectiveId),
  );
}

function rebuildObjectiveStateInternal(
  db: Database.Database,
  objectiveId: string,
): { projection: ObjectiveProjection; weaknesses: WeaknessProjection[] } {
  const events = getEffectiveEvidenceEventsByObjective(db, objectiveId);
  const observations = getEffectiveClaimObservations(db, objectiveId);
  const projection = computeProjection(objectiveId, events, observations);
  persistProjection(db, projection);
  const weaknesses = rebuildWeaknessesInternal(db, objectiveId, observations);
  return { projection, weaknesses };
}

export function rebuildObjectiveState(
  db: Database.Database,
  objectiveId: string,
): { projection: ObjectiveProjection; weaknesses: WeaknessProjection[] } {
  return db.transaction(() => rebuildObjectiveStateInternal(db, objectiveId))();
}

export function getWeaknessProjections(
  db: Database.Database,
  objectiveId: string,
): WeaknessProjection[] {
  return WeaknessProjectionSchema.array().parse(
    db
      .prepare(
        `SELECT * FROM weakness_projections
         WHERE objective_id = ?
         ORDER BY category`,
      )
      .all(objectiveId),
  );
}

export function recordAssessment(
  db: Database.Database,
  attemptId: number,
  input: AssessmentResultInput,
): AssessmentCommitResult {
  const assessment = parseAssessment(input);

  return db.transaction(() => {
    let attempt = attemptOrThrow(db, attemptId);
    if (attempt.submitted_at === null) {
      throw new Error(`Attempt must be submitted before assessment: ${attemptId}`);
    }
    if (getChallengeAttemptDisposition(db, attemptId) !== null) {
      throw new Error(`Voided/rejected attempt cannot be assessed: ${attemptId}`);
    }
    const challenge = challengeForAttemptOrThrow(db, attempt);
    validateAssessmentTargets(db, challenge, assessment);

    const verificationOutput = normalizeVerificationOutput(db, attempt, assessment);
    attempt = attemptOrThrow(db, attemptId);
    validateVerificationContract(challenge, assessment, verificationOutput);

    for (const objectiveResult of assessment.objectiveResults) {
      const existing = db
        .prepare(
          `SELECT evidence.id
           FROM evidence_events evidence
           WHERE evidence.attempt_id = ?
             AND evidence.objective_id = ?
           ORDER BY evidence.seq DESC
           LIMIT 1`,
        )
        .get(attemptId, objectiveResult.objectiveId) as { id: string } | undefined;
      if (existing) {
        throw new Error(
          `Attempt objective already has assessment history; use reviseEvidence(): ${attemptId}/${objectiveResult.objectiveId}`,
        );
      }
    }

    const evidenceEvents: EvidenceEvent[] = [];
    for (const objectiveResult of assessment.objectiveResults) {
      const evidence = insertEvidenceEvent(
        db,
        attempt,
        challenge,
        objectiveResult,
        assessment.evaluatorType,
        assessment.assessmentBasis,
        verificationOutput,
      );
      appendClaimObservations(db, challenge, evidence, objectiveResult);
      evidenceEvents.push(evidence);
    }

    const projections: ObjectiveProjection[] = [];
    const weaknesses: WeaknessProjection[] = [];
    for (const objectiveResult of assessment.objectiveResults) {
      const rebuilt = rebuildObjectiveStateInternal(db, objectiveResult.objectiveId);
      projections.push(rebuilt.projection);
      weaknesses.push(...rebuilt.weaknesses);
    }

    for (const evidence of evidenceEvents) {
      const reviewEvent = appendReviewEventForEvidence(db, evidence);
      if (reviewEvent) {
        advanceObjectiveReviewCard(db, reviewEvent);
      }
    }

    advanceSessionToFeedback(db, attemptId);
    return { evidenceEvents, projections, weaknesses };
  })();
}

function appendRevision(
  db: Database.Database,
  evidenceEventId: string,
  action: "invalidate" | "restore",
  reason: string,
): EvidenceRevision {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO evidence_revisions (evidence_event_id, action, reason, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(evidenceEventId, action, reason, createdAt);
  const row = db
    .prepare(`SELECT * FROM evidence_revisions WHERE seq = ?`)
    .get(Number(info.lastInsertRowid));
  return EvidenceRevisionSchema.parse(row);
}

function ensureRestoreHasNoConflict(
  db: Database.Database,
  evidence: EvidenceEvent,
): void {
  if (evidence.attempt_id === null) return;
  const conflict = db
    .prepare(
      `SELECT other.id
       FROM evidence_events other
       WHERE other.attempt_id = ?
         AND other.objective_id = ?
         AND other.id <> ?
         AND COALESCE((
           SELECT revision.action
           FROM evidence_revisions revision
           WHERE revision.evidence_event_id = other.id
           ORDER BY revision.seq DESC
           LIMIT 1
         ), 'restore') <> 'invalidate'
       LIMIT 1`,
    )
    .get(evidence.attempt_id, evidence.objective_id, evidence.id) as { id: string } | undefined;
  if (conflict) {
    throw new Error(
      `Restoring ${evidence.id} would conflict with effective replacement ${conflict.id}`,
    );
  }
}

export function reviseEvidence(
  db: Database.Database,
  evidenceEventId: string,
  input: ReviseEvidenceInput,
): EvidenceRevisionResult {
  const action = EvidenceRevisionAction.parse(input.action);
  const reason = requireNonEmpty(input.reason, "Evidence revision reason");
  if (action === "restore" && input.correctedObjectiveResult !== undefined) {
    throw new Error("correctedObjectiveResult is only allowed with invalidate");
  }
  const corrected = input.correctedObjectiveResult
    ? ObjectiveAssessmentResultSchema.parse(input.correctedObjectiveResult)
    : undefined;

  return db.transaction(() => {
    const evidence = evidenceEventOrThrow(db, evidenceEventId);
    const disposition = evidence.attempt_id === null
      ? null
      : getChallengeAttemptDisposition(db, evidence.attempt_id);
    if (disposition && (action === "restore" || corrected !== undefined)) {
      throw new Error(
        `Voided/rejected attempt evidence cannot be restored or replaced: ${evidence.attempt_id}`,
      );
    }
    const effective = latestRevisionAction(db, evidence.id) !== "invalidate";

    if (action === "invalidate" && !effective) {
      throw new Error(`Evidence is already invalidated: ${evidence.id}`);
    }
    if (action === "restore" && effective) {
      throw new Error(`Evidence is already effective: ${evidence.id}`);
    }
    if (action === "restore") {
      ensureRestoreHasNoConflict(db, evidence);
    }

    const revision = appendRevision(db, evidence.id, action, reason);
    let replacementEvent: EvidenceEvent | null = null;

    if (action === "invalidate" && corrected) {
      if (evidence.attempt_id === null) {
        throw new Error("Corrected replacement requires attempt-backed evidence");
      }
      if (corrected.objectiveId !== evidence.objective_id) {
        throw new Error("Corrected replacement must target the same objective");
      }

      const attempt = attemptOrThrow(db, evidence.attempt_id);
      const challenge = challengeForAttemptOrThrow(db, attempt);
      validateObjectiveResult(db, challenge, corrected);
      const verificationOutput = attempt.verification_output_json
        ? VerificationOutputSchema.parse(attempt.verification_output_json)
        : null;
      validateVerificationContract(
        challenge,
        AssessmentResultSchema.parse({
          evaluatorType: evidence.evaluator_type,
          assessmentBasis: evidence.assessment_basis,
          verificationOutput,
          objectiveResults: [corrected],
        }),
        verificationOutput,
      );

      replacementEvent = insertEvidenceEvent(
        db,
        attempt,
        challenge,
        corrected,
        evidence.evaluator_type,
        evidence.assessment_basis,
        verificationOutput,
        evidence.id,
      );
      appendClaimObservations(db, challenge, replacementEvent, corrected);
    }

    const rebuilt = rebuildObjectiveStateInternal(db, evidence.objective_id);
    if (replacementEvent) {
      appendReviewEventForEvidence(db, replacementEvent);
    }
    rebuildObjectiveReviewCard(db, evidence.objective_id);
    if (evidence.attempt_id !== null) {
      syncSessionAfterEvidenceChange(db, evidence.attempt_id);
    }

    return {
      revision,
      replacementEvent,
      projection: rebuilt.projection,
      weaknesses: rebuilt.weaknesses,
    };
  })();
}
