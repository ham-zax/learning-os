import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { EvidenceResult } from "../db/types.js";
import { loadCalibratedPredictionPack } from "../knowledge/challenge-calibration.js";
import type { CalibratedPredictionPackId } from "../knowledge/challenge-calibration.js";
import { codingCourseFile } from "../knowledge/courses.js";

const asyncCriteria = [
  { id: "order", description: "Predicts A, end, B in that order." },
  { id: "mechanism", description: "Explains that the call runs to its first await before its continuation is suspended." },
] as const;

export interface AssessorCase {
  id: string;
  response: string;
  context: string;
  criteria: readonly { id: string; description: string }[];
  expected: {
    action: "assess" | "clarify";
    result?: z.infer<typeof EvidenceResult>;
    criteriaMet?: readonly string[];
    criteriaUnmet?: readonly string[];
  };
  reason: string;
}

const asyncContext = [
  'async function task() { console.log("A"); await 0; console.log("B"); }',
  "task();",
  'console.log("end");',
  "Question: What is the output order, and why?",
].join("\n");

const asyncCases: readonly Omit<AssessorCase, "criteria">[] = [
  { id: "complete_causal_answer", context: asyncContext,
    response: "A, end, B. Calling task runs A immediately. await suspends the rest, so end runs before B.",
    expected: { action: "assess", result: "correct", criteriaMet: ["order", "mechanism"], criteriaUnmet: [] },
    reason: "Both the observed order and causal distinction are present." },
  { id: "order_without_reason", context: asyncContext, response: "A, end, B.",
    expected: { action: "assess", result: "partially_correct", criteriaMet: ["order"], criteriaUnmet: ["mechanism"] },
    reason: "The order is right; the frozen explanation criterion is unproven." },
  { id: "right_order_wrong_model", context: asyncContext,
    response: "A, end, B, because async tasks are queued but the console flushes A first.",
    expected: { action: "assess", result: "partially_correct", criteriaMet: ["order"], criteriaUnmet: ["mechanism"] },
    reason: "A correct order does not rescue an incorrect causal model." },
  { id: "whole_call_deferred", context: asyncContext,
    response: "end, A, B. The async keyword queues the whole function for later.",
    expected: { action: "assess", result: "incorrect", criteriaMet: [], criteriaUnmet: ["order", "mechanism"] },
    reason: "Both the prediction and model conflict with the frozen criteria." },
  { id: "alternative_correct_wording", context: asyncContext,
    response: "The function executes its first log before returning a promise at the await. The outer log follows; the continuation prints B afterward. So A/end/B.",
    expected: { action: "assess", result: "correct", criteriaMet: ["order", "mechanism"], criteriaUnmet: [] },
    reason: "Equivalent causal wording satisfies both criteria." },
  { id: "ambiguous_later", context: asyncContext, response: "Later.",
    expected: { action: "clarify" },
    reason: "The referent is unclear; a neutral clarification is cheaper than guessing an assessment." },
  { id: "unreadable_response", context: asyncContext, response: "[inaudible recording]",
    expected: { action: "assess", result: "ungradable", criteriaMet: [], criteriaUnmet: [] },
    reason: "The response cannot establish a model or a misconception." },
  { id: "retrieval_absence", context: asyncContext, response: "I don't remember how await affects the call.",
    expected: { action: "assess", result: "incorrect", criteriaMet: [], criteriaUnmet: ["order", "mechanism"] },
    reason: "No criterion is demonstrated, but this does not justify inventing a specific misconception." },
];

const knowledgeRoot = fileURLToPath(new URL("../../knowledge", import.meta.url));

function calibratedAssessorCase(
  packId: CalibratedPredictionPackId,
  calibrationCaseId: string,
  id: string,
  response: string,
  expected: AssessorCase["expected"],
  reason: string,
): AssessorCase {
  const pack = loadCalibratedPredictionPack(knowledgeRoot, packId);
  const item = pack.cases.find((candidate) => candidate.id === calibrationCaseId);
  if (!item) throw new Error(`Missing calibrated assessor case: ${packId}/${calibrationCaseId}`);
  const course = packId === "async-predict" ? "frontend-revision" : "backend-systems";
  const directory = packId === "transaction-predict" ? "database-transactions-predict"
    : packId === "idempotency-predict" ? "retries-idempotency-predict" : "js-async-await-predict";
  const source = codingCourseFile(join(knowledgeRoot, course), `challenges/${directory}/${item.source}`);
  const code = readFileSync(source, "utf8").trimEnd();
  return {
    id, response, expected, reason,
    context: `${pack.environment}\n\n\`\`\`js\n${code}\n\`\`\`\n\n${item.question}`,
    criteria: item.criteria.map(({ id: criterionId, description }) => ({ id: criterionId, description })),
  };
}

export const assessorCases: readonly AssessorCase[] = [
  ...asyncCases.map((item) => ({ ...item, criteria: asyncCriteria })),
  calibratedAssessorCase("transaction-predict", "last-seat-baseline", "transaction_last_seat_correct",
    "A:accepted; B:accepted; decisions:[true,true]; seats:-1. Both callers checked the single available seat before either decremented it. Two successful reservations violate the one-seat rule.",
    { action: "assess", result: "correct", criteriaMet: ["observable_outcome", "invariant_boundary"], criteriaUnmet: [] },
    "The output and broken invariant are both explained."),
  calibratedAssessorCase("transaction-predict", "stale-write-variant", "transaction_stale_write_wrong_model",
    "A:accepted; B:accepted; decisions:[true,true]; seats:0. Since the final count is nonnegative, only one client really got the seat; the other accepted line is harmless.",
    { action: "assess", result: "partially_correct", criteriaMet: ["observable_outcome"], criteriaUnmet: ["invariant_boundary"] },
    "The lines are predicted, but the conclusion denies the duplicate successful decision."),
  calibratedAssessorCase("transaction-predict", "last-seat-baseline", "transaction_last_seat_serialized",
    "A:accepted; B:rejected; decisions:[true,false]; seats:0. JavaScript is single-threaded, so B checks after A decrements.",
    { action: "assess", result: "incorrect", criteriaMet: [], criteriaUnmet: ["observable_outcome", "invariant_boundary"] },
    "It misses the interleaving across await and the resulting capacity violation."),
  calibratedAssessorCase("transaction-predict", "last-seat-baseline", "transaction_ambiguous",
    "The second result is different.",
    { action: "clarify" },
    "The result and reason are too underspecified to assess against either criterion."),
  calibratedAssessorCase("idempotency-predict", "new-key-baseline", "idempotency_new_key_correct",
    "retry:10; total:10. The first effect happened even though its response was lost. The retry uses a new operation ID, so the completed Map misses it and applies the effect again.",
    { action: "assess", result: "correct", criteriaMet: ["observable_outcome", "identity_boundary"], criteriaUnmet: [] },
    "The output and operation-identity boundary are both explained."),
  calibratedAssessorCase("idempotency-predict", "overlap-variant", "idempotency_overlap_wrong_model",
    "results:[5,10]; total:10. The Map deduplicated by ID, so only one effect happened; the second number is just logging noise.",
    { action: "assess", result: "partially_correct", criteriaMet: [], criteriaUnmet: ["observable_outcome", "identity_boundary"] },
    "The printed values are right, but the frozen outcome criterion also requires two effects, which this answer denies."),
  calibratedAssessorCase("idempotency-predict", "new-key-baseline", "idempotency_new_key_deduped",
    "retry:5; total:5. It is the same intended payment and amount, so the retry is recognized despite its new ID.",
    { action: "assess", result: "incorrect", criteriaMet: [], criteriaUnmet: ["observable_outcome", "identity_boundary"] },
    "A new operation ID misses the process-local completed lookup."),
  calibratedAssessorCase("idempotency-predict", "new-key-baseline", "idempotency_ambiguous",
    "Same key?",
    { action: "clarify" },
    "It asks about identity without predicting or explaining the result."),
];

export const AssessorDecisionSchema = z.discriminatedUnion("action", [
  z.object({ caseId: z.string().min(1), action: z.literal("clarify") }).strict(),
  z.object({ caseId: z.string().min(1), action: z.literal("assess"),
    result: EvidenceResult,
    criteriaMet: z.array(z.string().min(1)),
    criteriaUnmet: z.array(z.string().min(1)),
  }).strict(),
]);
export type AssessorDecision = z.infer<typeof AssessorDecisionSchema>;

export const AssessorSubmissionSchema = z.object({
  decisions: z.array(AssessorDecisionSchema),
}).strict();

export interface CaseScore {
  caseId: string;
  passed: boolean;
  errors: string[];
}

export interface CalibrationScore {
  passed: number;
  total: number;
  falseCorrect: number;
  cases: CaseScore[];
}

function sameIds(actual: readonly string[], expected: readonly string[]): boolean {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.length === sortedExpected.length &&
    sortedActual.every((id, index) => id === sortedExpected[index]);
}

/** Structural agreement only. A reviewer must still inspect rationales and question wording. */
export function scoreAssessorSubmission(input: unknown): CalibrationScore {
  const submission = AssessorSubmissionSchema.parse(input);
  const byId = new Map<string, AssessorDecision>();
  for (const decision of submission.decisions) {
    if (byId.has(decision.caseId)) throw new Error(`Duplicate assessor case: ${decision.caseId}`);
    byId.set(decision.caseId, decision);
  }
  const known = new Set(assessorCases.map((item) => item.id));
  for (const id of byId.keys()) {
    if (!known.has(id)) throw new Error(`Unknown assessor case: ${id}`);
  }
  let falseCorrect = 0;
  const cases = assessorCases.map((item): CaseScore => {
    const decision = byId.get(item.id);
    const errors: string[] = [];
    if (decision?.action === "assess" && decision.result === "correct" && item.expected.result !== "correct") {
      falseCorrect++;
    }
    if (!decision) errors.push("missing decision");
    else if (decision.action !== item.expected.action) errors.push(`action ${decision.action}; expected ${item.expected.action}`);
    else if (decision.action === "assess") {
      if (decision.result !== item.expected.result) errors.push(`result ${decision.result}; expected ${item.expected.result}`);
      if (!sameIds(decision.criteriaMet, item.expected.criteriaMet ?? [])) errors.push("criteriaMet differs");
      if (!sameIds(decision.criteriaUnmet, item.expected.criteriaUnmet ?? [])) errors.push("criteriaUnmet differs");
    }
    return { caseId: item.id, passed: errors.length === 0, errors };
  });
  return { passed: cases.filter((item) => item.passed).length, total: cases.length, falseCorrect, cases };
}

export function publicAssessorCases() {
  return assessorCases.map(({ id, context, response, criteria }) => ({ id, context, response, criteria }));
}
