import type Database from "better-sqlite3";
import { EvidenceEventSchema } from "../db/types.js";
import type { ChallengeCriterion, EvidenceEvent } from "../db/types.js";
import { resumeSession } from "./foundation.js";

export interface FeedbackObjective {
  objectiveId: string;
  evidenceEventId: string;
  result: EvidenceEvent["result"];
  criteria: Array<ChallengeCriterion & { status: "met" | "unmet" | "unassessed" }>;
  rationale: string;
  observedErrors: string[];
  retrievalValid: boolean;
  hintLevel: number;
  novelty: EvidenceEvent["novelty"];
}

export interface SessionFeedback {
  attemptId: number | null;
  nextAction: "none" | "collect_response" | "run_verification" | "assess_response"
    | "complete_feedback" | "review_gap" | "review_ungradable" | "reconstruct";
  reason: string;
  /** Private assessment context, present only after assessment; not a question payload. */
  objectives: FeedbackObjective[];
}

/** Derives the next feedback step from effective evidence; never grades text or changes state. */
export function getSessionFeedback(db: Database.Database, sessionId: number): SessionFeedback {
  const resumed = resumeSession(db, sessionId);
  const base = { attemptId: resumed.activeAttempt?.id ?? null, objectives: [] };
  switch (resumed.pendingAction) {
    case "none":
      return { ...base, nextAction: "none", reason: "No active answer needs feedback." };
    case "collect_response":
      return { ...base, nextAction: "collect_response", reason:
        "Await or interpret the saved answer. Clarify ambiguous wording before grading; ambiguity alone is not a failure." };
    case "run_verification":
      return { ...base, nextAction: "run_verification", reason: "Executable verification is required before assessment." };
    case "assess_response":
      // A correction can leave some targets assessed and others unresolved.
      // Keep the surviving effective results visible below.
      break;
  }

  const state = resumed.activeAttemptState;
  if (!state) throw new Error(`Session ${sessionId} feedback has no active attempt`);
  const getEvidence = db.prepare(`SELECT * FROM evidence_events WHERE id = ?`);
  const events = state.effectiveEvidenceIds.map((id) => EvidenceEventSchema.parse(getEvidence.get(id)));
  const objectives: FeedbackObjective[] = events.map((event) => ({
    objectiveId: event.objective_id,
    evidenceEventId: event.id,
    result: event.result,
    criteria: state.challenge.rubric.criteria
      .filter((criterion) => criterion.objectiveId === event.objective_id)
      .map((criterion) => ({
        ...criterion,
        status: event.criteria_json.met.includes(criterion.id) ? "met"
          : event.criteria_json.unmet.includes(criterion.id) ? "unmet" : "unassessed",
      })),
    rationale: event.rationale,
    observedErrors: event.observed_errors_json,
    retrievalValid: event.retrieval_valid,
    hintLevel: event.hint_level,
    novelty: event.novelty,
  }));
  const assessed = { attemptId: state.attempt.id, objectives };
  if (resumed.reconstructionRequired) {
    return { ...assessed, nextAction: "reconstruct", reason:
      "The recorded explanation requires reconstruction. Use the saved question; this is assisted learning, not new retrieval evidence." };
  }
  if (objectives.length !== state.challenge.targets.length) {
    return { ...assessed, nextAction: "assess_response", reason:
      "Effective assessment is incomplete. Preserve surviving results; inspect evidence receipts and use the correction lifecycle for targets with assessment history rather than resubmitting the attempt's assessment." };
  }
  if (objectives.some((objective) => objective.result === "ungradable")) {
    return { ...assessed, nextAction: "review_ungradable", reason:
      "Some work could not be assessed. Explain the assessment limitation; do not infer a misconception from it." };
  }
  if (objectives.every((objective) => objective.result === "correct")) {
    return { ...assessed, nextAction: "complete_feedback", reason:
      "The frozen targets are satisfied. State what this answer demonstrated and close this feedback step without another question." };
  }
  return { ...assessed, nextAction: "review_gap", reason:
    "Address the assessed gap. Correct a slip briefly; a demonstrated causal misconception needs recorded teaching and focused reconstruction." };
}
