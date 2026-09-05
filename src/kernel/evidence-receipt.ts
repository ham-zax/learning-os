import type Database from "better-sqlite3";
import {
  EvidenceEventSchema,
  EvidenceRevisionAction,
} from "../db/types.js";
import type {
  ChallengeCriterion,
  DeliveryContext,
  EvidenceEvent,
  EvidenceResult,
  EvaluatorType,
  ExposureEvent,
  Novelty,
  ObjectiveProjection,
  TaskForm,
  VerificationBasis,
  VerificationOutput,
  WeaknessProjection,
} from "../db/types.js";
import {
  getAttempt,
  getChallenge,
  getExposureEventsByObjective,
  getLearningObjective,
  getObjectiveProjection,
} from "./foundation.js";
import { getWeaknessProjections } from "./evidence.js";

export interface EvidenceReceiptChallengeSurface {
  challengeId: string;
  version: number;
  publicPrompt: string;
  taskForm: TaskForm;
  deliveryContext: DeliveryContext;
  timeBudgetMinutes: number | null;
  criteria: ChallengeCriterion[];
}

export interface ObjectiveEvidenceReceiptEvent {
  evidenceEventId: string;
  supersedesEventId: string | null;
  attemptId: number | null;
  effective: boolean;
  latestRevisionAction: "invalidate" | "restore" | null;
  latestRevisionReason: string | null;
  latestRevisionAt: string | null;
  attempt: {
    attemptId: number;
    responseText: string | null;
    artifactRef: Record<string, unknown> | null;
    verificationOutput: VerificationOutput | null;
  } | null;
  challenge: EvidenceReceiptChallengeSurface;
  result: EvidenceResult;
  hintLevel: number;
  novelty: Novelty;
  retrievalValid: boolean;
  delayAnchorAt: string | null;
  delaySeconds: number | null;
  assessmentBasis: VerificationBasis;
  evaluatorType: EvaluatorType;
  criteria: EvidenceEvent["criteria_json"];
  observedErrors: string[];
  rationale: string;
  performedAt: string;
}

export interface ObjectiveEvidenceReceiptExposure {
  seq: number;
  challengeId: string | null;
  challengeVersion: number | null;
  attemptId: number | null;
  exposureType: ExposureEvent["exposure_type"];
  sourceRef: string | null;
  teachingArtifactId: string | null;
  materialStatus: "available" | "historical_unavailable";
  occurredAt: string;
}

export interface ObjectiveEvidenceReceipt {
  objective: {
    objectiveId: string;
    conceptId: string;
    capabilityId: string;
  };
  projection: ObjectiveProjection;
  weaknesses: WeaknessProjection[];
  evidenceHistory: ObjectiveEvidenceReceiptEvent[];
  exposures: ObjectiveEvidenceReceiptExposure[];
  authority: {
    evidenceHistory: "authoritative_history";
    exposures: "authoritative_history";
    projection: "rebuildable_view";
    weaknesses: "rebuildable_view";
  };
  limitations: string[];
}

type EvidenceHistoryRow = Record<string, unknown> & {
  latest_revision_action: unknown;
  latest_revision_reason: unknown;
  latest_revision_at: unknown;
};

function getEvidenceHistory(
  db: Database.Database,
  objectiveId: string,
): ObjectiveEvidenceReceiptEvent[] {
  const rows = db
    .prepare(
      `SELECT evidence.*,
              revision.action AS latest_revision_action,
              revision.reason AS latest_revision_reason,
              revision.created_at AS latest_revision_at
       FROM evidence_events evidence
       LEFT JOIN evidence_revisions revision
         ON revision.seq = (
           SELECT candidate.seq
           FROM evidence_revisions candidate
           WHERE candidate.evidence_event_id = evidence.id
           ORDER BY candidate.seq DESC
           LIMIT 1
         )
       WHERE evidence.objective_id = ?
       ORDER BY evidence.performed_at, evidence.seq`,
    )
    .all(objectiveId) as EvidenceHistoryRow[];

  return rows.map((row) => {
    const {
      latest_revision_action: rawRevisionAction,
      latest_revision_reason: rawRevisionReason,
      latest_revision_at: rawRevisionAt,
      ...rawEvidence
    } = row;
    const evidence = EvidenceEventSchema.parse(rawEvidence);
    const latestRevisionAction = rawRevisionAction === null || rawRevisionAction === undefined
      ? null
      : EvidenceRevisionAction.parse(rawRevisionAction);
    const challenge = getChallenge(db, evidence.task_id, evidence.task_version);
    if (!challenge) {
      throw new Error(
        `Frozen challenge not found for evidence ${evidence.id}: ${evidence.task_id}@${evidence.task_version}`,
      );
    }

    const attempt = evidence.attempt_id === null ? null : getAttempt(db, evidence.attempt_id);
    if (evidence.attempt_id !== null && !attempt) {
      throw new Error(`Attempt not found for evidence ${evidence.id}: ${evidence.attempt_id}`);
    }

    return {
      evidenceEventId: evidence.id,
      supersedesEventId: evidence.supersedes_event_id,
      attemptId: evidence.attempt_id,
      effective: latestRevisionAction !== "invalidate",
      latestRevisionAction,
      latestRevisionReason: rawRevisionReason === null || rawRevisionReason === undefined
        ? null
        : String(rawRevisionReason),
      latestRevisionAt: rawRevisionAt === null || rawRevisionAt === undefined
        ? null
        : String(rawRevisionAt),
      attempt: attempt == null
        ? null
        : {
            attemptId: attempt.id,
            responseText: attempt.response_text,
            artifactRef: attempt.artifact_ref_json,
            verificationOutput: attempt.verification_output_json,
          },
      challenge: {
        challengeId: challenge.id,
        version: challenge.version,
        publicPrompt: challenge.publicPrompt,
        taskForm: challenge.taskForm,
        deliveryContext: challenge.deliveryContext,
        timeBudgetMinutes: challenge.timeBudgetMinutes ?? null,
        criteria: challenge.rubric.criteria.filter(
          (criterion) => criterion.objectiveId === objectiveId,
        ),
      },
      result: evidence.result,
      hintLevel: evidence.hint_level,
      novelty: evidence.novelty,
      retrievalValid: evidence.retrieval_valid,
      delayAnchorAt: evidence.delay_anchor_at,
      delaySeconds: evidence.delay_seconds,
      assessmentBasis: evidence.assessment_basis,
      evaluatorType: evidence.evaluator_type,
      criteria: evidence.criteria_json,
      observedErrors: evidence.observed_errors_json,
      rationale: evidence.rationale,
      performedAt: evidence.performed_at,
    };
  });
}

function receiptExposure(exposure: ExposureEvent): ObjectiveEvidenceReceiptExposure {
  return {
    seq: exposure.seq,
    challengeId: exposure.challenge_id,
    challengeVersion: exposure.challenge_version,
    attemptId: exposure.attempt_id,
    exposureType: exposure.exposure_type,
    sourceRef: exposure.source_ref,
    teachingArtifactId: exposure.teaching_artifact_id,
    materialStatus: exposure.teaching_artifact_id === null
      ? "historical_unavailable"
      : "available",
    occurredAt: exposure.occurred_at,
  };
}

/**
 * Return an objective-scoped, read-only audit view for learner-state claims.
 *
 * The receipt deliberately exposes authoritative history separately from the
 * rebuildable projection/weakness views derived from it. It performs no
 * rebuild, correction, scheduling, selection, or persistence work.
 */
export function getObjectiveEvidenceReceipt(
  db: Database.Database,
  objectiveId: string,
): ObjectiveEvidenceReceipt {
  const objective = getLearningObjective(db, objectiveId);
  if (!objective) {
    throw new Error(`Learning objective not found: ${objectiveId}`);
  }
  const projection = getObjectiveProjection(db, objectiveId);
  if (!projection) {
    throw new Error(`Objective projection not found: ${objectiveId}`);
  }

  const evidenceHistory = getEvidenceHistory(db, objectiveId);
  const exposures = getExposureEventsByObjective(db, objectiveId).map(receiptExposure);
  const limitations: string[] = [];
  if (exposures.some((exposure) => exposure.materialStatus === "historical_unavailable")) {
    limitations.push(
      "Some historical exposure rows prove that teaching exposure occurred but do not preserve the exact material shown.",
    );
  }
  limitations.push(
    "V1 support-environment semantics are reconstructed from each frozen challenge prompt/criteria; they are not stored as a separate structured support contract.",
  );

  return {
    objective: {
      objectiveId: objective.id,
      conceptId: objective.concept_id,
      capabilityId: objective.capability_id,
    },
    projection,
    weaknesses: getWeaknessProjections(db, objectiveId),
    evidenceHistory,
    exposures,
    authority: {
      evidenceHistory: "authoritative_history",
      exposures: "authoritative_history",
      projection: "rebuildable_view",
      weaknesses: "rebuildable_view",
    },
    limitations,
  };
}
