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
import { submitAttempt } from "./foundation.js";
import type { SubmitAttemptInput } from "./foundation.js";

export interface SubmitAndAssessInput {
  response: SubmitAttemptInput;
  assessment: AssessmentResultInput;
}

export type SubmitAndAssessResult = AssessmentCommitResult & { attempt: Attempt };

export function submitAndAssess(
  db: Database.Database,
  attemptId: number,
  input: SubmitAndAssessInput,
): SubmitAndAssessResult {
  if (!input?.response || !input?.assessment) {
    throw new Error("submitAndAssess requires { response, assessment }");
  }
  return db.transaction(() => {
    const attempt = submitAttempt(db, attemptId, input.response);
    const assessment = recordAssessment(db, attemptId, input.assessment);
    return { attempt, ...assessment };
  })();
}
