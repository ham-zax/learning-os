/**
 * One public write for a final learner answer plus its assessment.
 *
 * `submitAttempt` and `recordAssessment` each open their own transaction. Wrapping both
 * in one outer transaction makes the pair atomic: if the assessment is rejected, the
 * submission is rolled back too. The attempt never sits submitted but unassessed.
 *
 * Use this when the answer is final and the verification output is already known. Use
 * `submitAttempt` alone for a partial turn that still needs verification.
 */
import type Database from "better-sqlite3";
import type { AssessmentResultInput, Attempt } from "../db/types.js";
import { recordAssessment } from "./evidence.js";
import type { AssessmentCommitResult } from "./evidence.js";
import { getSessionFeedback } from "./feedback.js";
import { completeSessionFeedback, submitAttempt } from "./foundation.js";
import type { SubmitAttemptInput } from "./foundation.js";

export interface SubmitAndAssessInput {
  response: SubmitAttemptInput;
  assessment: AssessmentResultInput;
  /** When true and the assessed feedback step is complete (all frozen targets correct, no reconstruction required), close feedback in the same transaction. */
  closeIfComplete?: boolean;
}

export type SubmitAndAssessResult = AssessmentCommitResult & {
  attempt: Attempt;
  feedbackClosed?: boolean;
};

export function submitAndAssess(
  db: Database.Database,
  attemptId: number,
  input: SubmitAndAssessInput,
): SubmitAndAssessResult {
  if (!input?.response || !input?.assessment) {
    throw new Error("submitAndAssess requires { response, assessment }");
  }
  const basis = input.assessment.assessmentBasis;
  const verification = input.assessment.verificationOutput;
  if ((basis === "deterministic_execution" || basis === "mixed") && verification) {
    const details = verification.details ?? {};
    const recorded = [details.stdout, details.output].some(
      (value) =>
        typeof value === "string" ||
        (Array.isArray(value) && value.every((line) => typeof line === "string")),
    );
    if (!recorded) {
      throw new Error(
        "Deterministic verification must record the run output in details.stdout or details.output",
      );
    }
  }
  return db.transaction(() => {
    const attempt = submitAttempt(db, attemptId, input.response);
    const assessment = recordAssessment(db, attemptId, input.assessment);
    let feedbackClosed = false;
    if (input.closeIfComplete && attempt.session_id !== null) {
      const feedback = getSessionFeedback(db, attempt.session_id);
      if (feedback.nextAction === "complete_feedback") {
        completeSessionFeedback(db, attempt.session_id, {
          activeTimeSeconds: input.response.activeTimeSeconds,
        });
        feedbackClosed = true;
      }
    }
    return input.closeIfComplete !== undefined
      ? { attempt, ...assessment, feedbackClosed }
      : { attempt, ...assessment };
  })();
}
