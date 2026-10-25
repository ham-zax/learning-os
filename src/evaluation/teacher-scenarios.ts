import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDatabase, createConcept, createTopic, setGoalObjective } from "../db/database.js";
import { buildCalibratedPredictionChallenge, findCalibratedPredictionCase,
  loadCalibratedPredictionPack } from "../knowledge/challenge-calibration.js";
import type { CalibratedPredictionPackId } from "../knowledge/challenge-calibration.js";
import { createTeacherKernel } from "../teacher.js";
import { getSessionFeedback } from "../kernel/feedback.js";

const GOAL_ID = "teacher-eval-goal";
const OBJECTIVE_ID = "async-prefix:explain";
const KNOWLEDGE_ROOT = fileURLToPath(new URL("../../knowledge", import.meta.url));
const CONTEXT = [
  "```js",
  'async function task() { console.log("A"); await 0; console.log("B"); }',
  "task();",
  'console.log("end");',
  "```",
].join("\n");

export type TeacherScenarioId =
  | "correct_cold_answer"
  | "ambiguous_answer"
  | "causal_model_error"
  | "question_too_large"
  | "im_stuck"
  | "resumed_answer"
  | "transfer_answer"
  | "answer_requested"
  | "calibrated_transaction_answer"
  | "calibrated_transaction_wrong_model"
  | "calibrated_idempotency_model_error"
  | "calibrated_idempotency_ambiguous"
  | "calibrated_cache_stale_fill_answer"
  | "calibrated_cache_stale_fill_wrong_model"
  | "calibrated_promises_missing_return_answer"
  | "calibrated_promises_wrong_model"
  | "calibrated_this_binding_wrong_model"
  | "calibrated_this_binding_answer"
  | "calibrated_idempotency_answer"
  | "calibrated_overlap_idempotency_answer"
  | "calibrated_async_nested_calls_answer"
  | "calibrated_username_race_wrong_model"
  | "calibrated_validation_transfer_answer"
  | "reconstruction_completed_closure"
  | "scaffold_interrupted_after_presentation"
  | "scaffold_completion_return_to_frozen"
  | "scaffold_assisted_answer_closure"
  | "scaffold_declined_further_instruction";

const SCAFFOLD_PACK_ID = "database-transactions-predict";
type ScaffoldScenarioId = "scaffold_interrupted_after_presentation" | "scaffold_completion_return_to_frozen"
  | "scaffold_assisted_answer_closure";

export interface TeacherScenario {
  id: TeacherScenarioId;
  title: string;
  learnerMessage: string;
  startingPoint: string;
  review: readonly string[];
}

export const teacherScenarios: readonly TeacherScenario[] = [
  {
    id: "correct_cold_answer",
    title: "Close a sufficient cold answer",
    learnerMessage: "Okay, what next?",
    startingPoint: "The submitted answer was assessed correct without help. Feedback is pending.",
    review: [
      "Names what this answer demonstrated without claiming whole-concept mastery.",
      "Gives concise feedback and closes the episode without a bonus question.",
      "Does not open the next attempt before learner acceptance.",
    ],
  },
  {
    id: "ambiguous_answer",
    title: "Clarify ambiguous wording",
    learnerMessage: "It happens later.",
    startingPoint: "A question about which code runs before await is pending; the learner answers that something happens later, but the referent is unclear.",
    review: [
      "Asks one neutral clarification of the same criterion.",
      "Does not supply the async ordering or diagnose a misconception from ambiguous wording.",
      "Preserves the original answer and question identity.",
    ],
  },
  {
    id: "causal_model_error",
    title: "Repair a coherent wrong model",
    learnerMessage: "Can you help me understand where I went wrong?",
    startingPoint: "The learner said the entire async function is deferred. The frozen criterion was assessed incorrect.",
    review: [
      "Repairs the specific synchronous-prefix misconception rather than reteaching the whole topic.",
      "Records the exact answer-bearing material before showing it.",
      "Asks one focused reconstruction question and stops for the learner's answer.",
    ],
  },
  {
    id: "question_too_large",
    title: "Reduce question load without revealing the answer",
    learnerMessage: "This is too much at once. Ask me one thing at a time.",
    startingPoint: "A broad response question is pending on an open attempt.",
    review: [
      "Replaces the pending question with one complete atomic question scoped to the frozen criterion.",
      "Keeps the code context available and does not give the output order or causal explanation.",
      "Does not grade the size complaint as an answer.",
    ],
  },
  {
    id: "im_stuck",
    title: "Diagnose an unclear blocker before teaching",
    learnerMessage: "I'm stuck.",
    startingPoint: "An unanswered async execution question is pending; the blocker is unknown.",
    review: [
      "Asks one short question to distinguish unclear wording, a missing first move, or a missing concept.",
      "Keeps the saved question pending and does not reveal its answer.",
      "Does not assess the learner or record an exposure from this message alone.",
    ],
  },
  {
    id: "resumed_answer",
    title: "Consume an answer on fresh-session resumption",
    learnerMessage: "A prints before end because task runs synchronously until await; B runs afterward.",
    startingPoint: "A question is pending in durable state; this message answers it in a fresh conversation.",
    review: [
      "Records this message against the saved question sequence before assessment.",
      "Does not redisplay the question instead of consuming the answer.",
      "Assesses only the frozen criterion and gives feedback grounded in the response.",
    ],
  },
  {
    id: "transfer_answer",
    title: "Assess a changed-surface async explanation",
    learnerMessage: "Each search has its own await. The old request can finish last and overwrite the newer result; only the latest requested search should be allowed to publish.",
    startingPoint: "A frozen transfer question about competing search requests is pending in durable state.",
    review: [
      "Uses the saved changed-surface question and records the learner's answer.",
      "Assesses the asynchronous ownership explanation under the frozen transfer criterion.",
      "Closes the episode without a bonus question or an invented next objective.",
    ],
  },
  {
    id: "answer_requested",
    title: "Honor an answer request without clean retrieval credit",
    learnerMessage: "Just tell me the answer.",
    startingPoint: "An unanswered question is pending on an open attempt.",
    review: [
      "Honors the request and records the exact answer-bearing material immediately before showing it.",
      "Does not claim the learner demonstrated the mechanism independently.",
      "Keeps the active episode's remaining obligations truthful.",
    ],
  },
  {
    id: "calibrated_transaction_answer",
    title: "Assess a resumed concurrent-reservation prediction",
    learnerMessage: "A:accepted; B:accepted; decisions:[true,true]; seats:-1. Both callers checked the one available seat before either decremented it, so two reservations succeeded and the one-seat rule failed.",
    startingPoint: "A calibrated prediction question is pending in durable state; this message is the learner's answer in a fresh conversation.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "calibrated_transaction_wrong_model",
    title: "Reject a serialized last-seat prediction",
    learnerMessage: "A:accepted; B:rejected; decisions:[true,false]; seats:0. JavaScript is single-threaded, so B must check after A decrements the seat.",
    startingPoint: "The calibrated last-seat question is pending; this answer uses a plausible but wrong serialized model.",
    review: [
      "Runs the frozen source after the prediction and does not grade the wrong model correct.",
      "Explains the check/decrement boundary without claiming this Node model proves PostgreSQL behavior.",
      "Records answer-bearing repair before showing it, then asks one reconstruction question.",
    ],
  },
  {
    id: "calibrated_idempotency_model_error",
    title: "Assess a resumed retry prediction with faulty reasoning",
    learnerMessage: "retry:10; total:10. The Map deduplicated this because it is the same payment; the second effect is just a print artifact.",
    startingPoint: "A calibrated prediction question is pending in durable state; this message is the learner's answer in a fresh conversation.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction; correct output does not make the false causal explanation correct.",
      "Records exact answer-bearing repair before showing it, then asks one reconstruction question and stops.",
    ],
  },
  {
    id: "calibrated_idempotency_ambiguous",
    title: "Clarify an underspecified retry prediction",
    learnerMessage: "It runs again.",
    startingPoint: "A calibrated retry prediction is pending, but the answer does not identify the effect or final total.",
    review: [
      "Asks one neutral clarification under the same frozen criteria.",
      "Preserves the original response and does not reveal the expected output or identity rule.",
      "Does not commit assessment evidence from the ambiguous phrase.",
    ],
  },
  {
    id: "scaffold_interrupted_after_presentation",
    title: "Resume after a recorded scaffold presentation",
    learnerMessage: "Sorry, my connection dropped. Where were we?",
    startingPoint: "A worked example for the pending last-seat prediction was recorded as an exposure, then the connection dropped. It is unknown whether the learner saw it. The frozen question is still unanswered.",
    review: [
      "Names the recorded worked example, discloses that this attempt is therefore assisted, and asks once whether the material came through rather than re-showing it by default.",
      "Restates only the pending frozen question once, without repeating the whole explanation or revealing the answer.",
      "Does not record a second exposure, open another attempt, or treat the interruption as an answer.",
    ],
  },
  {
    id: "scaffold_completion_return_to_frozen",
    title: "Return from a completion exercise to the frozen question",
    learnerMessage: "I finished the completion trace: A:paid, B:paid, decisions:[true,true], balance:-20, because both checked before the lock. I'm ready for the real one.",
    startingPoint: "A completion exercise was shown while the frozen last-seat prediction is still pending. The learner reports finishing the exercise.",
    review: [
      "Gives brief feedback on the completion work as instruction, not as an assessment of the frozen question.",
      "Transitions clearly back to the original frozen prompt without redisplaying the whole exercise.",
      "Does not treat the completion answer as the frozen response, create evidence, or add another exercise.",
    ],
  },
  {
    id: "scaffold_assisted_answer_closure",
    title: "Close a sufficient assisted answer",
    learnerMessage: "A:accepted; B:accepted; decisions:[true,true]; seats:-1. Both callers checked the seat before either decremented it, so the one-seat rule failed.",
    startingPoint: "A completion exercise was shown before this answer to the pending frozen last-seat prediction.",
    review: [
      "Runs the frozen source after the prediction, assesses both criteria, and gives concise feedback grounded in the response.",
      "States that the answer was assisted and does not claim independent retrieval or mastery.",
      "Closes the episode without a bonus question, repeated explanation, or extra exercise.",
    ],
  },
  {
    id: "scaffold_declined_further_instruction",
    title: "Respect a decline of further instruction",
    learnerMessage: "No thanks, I don't want another explanation or exercise right now.",
    startingPoint: "The learner's explanation was assessed incorrect and feedback is pending. No optional instruction has been shown yet.",
    review: [
      "Acknowledges the decline in one short sentence and does not argue for more instruction.",
      "Gives concise feedback on the assessed gap and closes the episode without a mandatory exercise.",
      "Does not record an unrequested exposure, require reconstruction, or imply the gap is resolved.",
    ],
  },
  {
    id: "calibrated_cache_stale_fill_answer",
    title: "Assess a resumed cache-aside stale-fill prediction",
    learnerMessage: "updated to 12; first read: 10; later read: 10; db: 12. The reader read 10 before the update, the cache invalidation ran before the slow fill completed, and the late fill republished the stale 10 into the cache while the database is authoritative at 12.",
    startingPoint: "A calibrated cache-consistency prediction question is pending in durable state; this message is the learner's answer in a fresh conversation.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "calibrated_cache_stale_fill_wrong_model",
    title: "Reject a cache-invalidation prediction that misses the late stale fill",
    learnerMessage: "updated to 12; first read: 10; later read: 12; db: 12. Deleting the cache entry after the database write guarantees that any later read will miss the cache and load the fresh 12 from the database.",
    startingPoint: "The calibrated cache-aside stale-fill question is pending; this answer assumes delete-after-write prevents a slow concurrent reader from republishing stale data.",
    review: [
      "Runs the frozen source after the prediction and does not grade the wrong model correct.",
      "Explains how the in-flight reader's slow fill lands after the delete and repopulates stale 10.",
      "Records answer-bearing repair before showing it, then asks one reconstruction question.",
    ],
  },
  {
    id: "calibrated_promises_missing_return_answer",
    title: "Assess a resumed promise-chain missing-return prediction",
    learnerMessage: "next got undefined; saved draft. The first then callback starts the save but does not return its promise, so it returns undefined and the chained then runs immediately with undefined without waiting for the save.",
    startingPoint: "A calibrated JavaScript promises prediction question is pending in durable state; this message is the learner's answer in a fresh conversation.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "calibrated_this_binding_wrong_model",
    title: "Reject a detached-method prediction that assumes lexical receiver binding",
    learnerMessage: "1; 2; 2. increment is defined on counter, so calling fn() still increments counter.count to 2.",
    startingPoint: "The calibrated JavaScript this-binding question is pending; this answer assumes a detached method retains its defining object as this.",
    review: [
      "Runs the frozen source after the prediction and does not grade the wrong model correct.",
      "Explains that a plain call in strict-mode ESM leaves this undefined so reading this.count throws TypeError.",
      "Records answer-bearing repair before showing it, then asks one reconstruction question.",
    ],
  },
  {
    id: "calibrated_idempotency_answer",
    title: "Assess a resumed idempotent retry prediction with correct effect counting",
    learnerMessage: "retry:10; total:10. The first call recorded key 'payment-7' and total became 5. Because the retry sent a new key 'payment-7-retry', the completed Map lookup misses and the second effect runs, incrementing total to 10.",
    startingPoint: "A calibrated retries and idempotency prediction question is pending in durable state; this message is the learner's answer in a fresh conversation.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "calibrated_this_binding_answer",
    title: "Assess a resumed detached-method prediction with strict-mode receiver awareness",
    learnerMessage: "1; TypeError; 1. In counter.increment(), counter is before the dot so it is the receiver and count increments to 1. In fn(), the function is called without a receiver, so in strict mode this is undefined and reading this.count throws TypeError, leaving count at 1.",
    startingPoint: "The calibrated JavaScript this-binding question is pending in durable state; this message is the learner's answer in a fresh conversation.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "calibrated_promises_wrong_model",
    title: "Reject a promise-chain prediction that assumes synchronous fulfillment of unreturned work",
    learnerMessage: "saved draft; next got draft. A then chain waits for every asynchronous operation started inside the callback, so save finishes before next runs.",
    startingPoint: "The calibrated JavaScript promise-chain question is pending; this answer assumes a then chain waits for unreturned promises created inside callbacks.",
    review: [
      "Runs the frozen source after the prediction and does not grade the wrong model correct.",
      "Explains that without returning the save promise, the first callback returns undefined and the chained then runs immediately.",
      "Records answer-bearing repair before showing it, then asks one reconstruction question.",
    ],
  },
  {
    id: "calibrated_overlap_idempotency_answer",
    title: "Assess an overlapping concurrent retry prediction sharing an operation ID",
    learnerMessage: "results:[5,10]; total:10. Both calls start before either records completion, so both check completed.has(id) when it is empty and both execute the effect, incrementing total twice to 10.",
    startingPoint: "The calibrated idempotency concurrent-overlap challenge is pending in durable state; this answer correctly predicts both calls execute because check-then-act is unshared.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "calibrated_async_nested_calls_answer",
    title: "Assess a nested async-await prediction with separate suspension boundaries",
    learnerMessage: "outer-start; inner-start; outer-middle; top-end; inner-end; outer-end. Calling outer runs outer-start synchronously, then inner runs inner-start up to await 0. When inner suspends, outer logs outer-middle and suspends at await inner. Control returns to top level, logging top-end. Microtasks then drain inner-end followed by outer-end.",
    startingPoint: "The calibrated nested async execution challenge is pending in durable state; this answer correctly traces both synchronous prefixes and continuation order.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "calibrated_username_race_wrong_model",
    title: "Reject a concurrent-claim prediction that assumes Set uniqueness guarantees single-claim success",
    learnerMessage: "A:claimed; decisions:[true,false]; claimed:[\"alex\"]. A Set cannot contain duplicates, so the second client's reservation is rejected.",
    startingPoint: "The calibrated concurrent username-claim challenge is pending; this answer assumes final collection uniqueness serializes the decision.",
    review: [
      "Runs the frozen source after the prediction and does not grade the wrong model correct.",
      "Explains that both clients observe absence before either add, so both decisions return true even though the Set deduplicates storage.",
      "Records answer-bearing repair before showing it, then asks one reconstruction question.",
    ],
  },
  {
    id: "calibrated_validation_transfer_answer",
    title: "Assess an out-of-order async validation transfer prediction",
    learnerMessage: "new: new-valid; old: old-invalid; final: old-invalid. Each validation resumes after its own simulated network delay. Because old settles after new, the stale validation result overwrites the newer field, leaving final as old-invalid.",
    startingPoint: "The calibrated validation transfer challenge is pending in durable state; this answer identifies the race condition publishing stale state.",
    review: [
      "Uses the saved question and exact learner response rather than inventing a new challenge.",
      "Runs the frozen source after the learner prediction and assesses both criteria.",
      "Gives concise grounded feedback and closes the episode without a bonus question.",
    ],
  },
  {
    id: "reconstruction_completed_closure",
    title: "Resolve a pending causal reconstruction and close the episode",
    learnerMessage: "I assumed async defers the whole function body, but the code before the first await runs synchronously during the call, so A and end run before the paused continuation prints B.",
    startingPoint: "An incorrect causal explanation was repaired and a reconstruction question is pending on the active attempt; the learner now supplies the reconstruction.",
    review: [
      "Records the learner's answer against the pending reconstruction question and resolves session reconstruction as completed.",
      "Closes the feedback episode without inventing another assessment or bonus drill.",
      "Does not record a duplicate EvidenceEvent or extra exposure.",
    ],
  },
];

export interface PreparedTeacherScenario {
  id: TeacherScenarioId;
  goalId: string;
  objectiveId: string;
  sessionId: number;
  attemptId: number;
  initialQuestionSeq: number | null;
  initialEvidenceCount: number;
  initialExposureCount: number;
  /** Present only for scenarios that start after a recorded scaffold presentation. */
  scaffolds?: Array<{ stage: "worked_example" | "completion"; sourceRef: string;
    teachingArtifactId: string; sha256: string }>;
  initialReviewCardCount?: number;
  initialAttemptCount?: number;
}

function count(db: Database.Database, table: "evidence_events" | "exposure_events" | "attempt_subquestions" | "attempts" | "review_cards"): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

type CalibratedScenarioId =
  | "calibrated_transaction_answer"
  | "calibrated_transaction_wrong_model"
  | "calibrated_idempotency_model_error"
  | "calibrated_idempotency_ambiguous"
  | "calibrated_idempotency_answer"
  | "calibrated_overlap_idempotency_answer"
  | "calibrated_async_nested_calls_answer"
  | "calibrated_username_race_wrong_model"
  | "calibrated_validation_transfer_answer"
  | "calibrated_cache_stale_fill_answer"
  | "calibrated_cache_stale_fill_wrong_model"
  | "calibrated_promises_missing_return_answer"
  | "calibrated_promises_wrong_model"
  | "calibrated_this_binding_wrong_model"
  | "calibrated_this_binding_answer"
  | ScaffoldScenarioId;

function calibratedPackIdFor(id: CalibratedScenarioId): CalibratedPredictionPackId {
  if (id.startsWith("calibrated_idempotency") || id === "calibrated_overlap_idempotency_answer") return "idempotency-predict";
  if (id.startsWith("calibrated_cache_stale_fill")) return "state-ownership-and-cache-consistency-predict";
  if (id.startsWith("calibrated_promises")) return "js-promises-predict";
  if (id.startsWith("calibrated_this_binding")) return "js-this-binding-predict";
  if (id === "calibrated_async_nested_calls_answer" || id === "calibrated_validation_transfer_answer") return "async-predict";
  return "transaction-predict";
}

function prepareCalibratedScenario(
  db: Database.Database,
  id: CalibratedScenarioId,
): PreparedTeacherScenario {
  const packId: CalibratedPredictionPackId = calibratedPackIdFor(id);
  const pack = loadCalibratedPredictionPack(KNOWLEDGE_ROOT, packId);
  const conceptId = pack.objective.conceptId;
  const objectiveId = `${conceptId}:predict`;
  createTopic(db, { id: GOAL_ID, name: "Synthetic calibrated teacher evaluation" });
  createConcept(db, { id: conceptId, topicId: GOAL_ID, title: conceptId });
  const kernel = createTeacherKernel(db, { knowledgeRoot: KNOWLEDGE_ROOT });
  kernel.createLearningObjective({ id: objectiveId, conceptId, capabilityId: "predict" });
  setGoalObjective(db, { goalId: GOAL_ID, objectiveId, importance: "core", targetReadiness: "guided" });
  const continuation = kernel.getStudyContinuation({ goalId: GOAL_ID,
    now: new Date().toISOString(), oneEpisode: true });
  if (continuation.kind !== "recommend") throw new Error(`Expected selected intent for ${id}`);
  const intent = continuation.item.intent;
  const selected = findCalibratedPredictionCase(KNOWLEDGE_ROOT, intent, kernel.getChallenge);
  if (!selected || selected.packId !== packId) throw new Error(`No calibrated case for ${id}`);
  let targetCaseId = selected.caseId;
  if (id === "calibrated_overlap_idempotency_answer") targetCaseId = "overlap-variant";
  else if (id === "calibrated_async_nested_calls_answer") targetCaseId = "nested-call-variant";
  else if (id === "calibrated_username_race_wrong_model") targetCaseId = "username-transfer";
  else if (id === "calibrated_validation_transfer_answer") targetCaseId = "validation-transfer";
  const item = pack.cases.find((candidate) => candidate.id === targetCaseId)!;
  const alignedIntent = { ...intent, novelty: item.novelty };
  const challengeId = `teacher-eval-${packId}-${item.id}`;
  const built = buildCalibratedPredictionChallenge({ knowledgeRoot: KNOWLEDGE_ROOT,
    packId, intent: alignedIntent, caseId: item.id, challengeId });
  kernel.registerChallenge(built.challenge, alignedIntent);
  const sessionId = kernel.createSession(intent.goalId, intent.deliveryContext).id;
  const attemptId = kernel.openAttempt(challengeId, 1, sessionId).attempt.id;
  const question = kernel.openAttemptSubquestion(attemptId, {
    contextText: built.challenge.publicPrompt.slice(0, -(item.question.length + 2)),
    promptText: item.question, questionChunking: "default",
  });
  const scaffolds: NonNullable<PreparedTeacherScenario["scaffolds"]> = [];
  if (id.startsWith("scaffold_")) {
    // Recorded through the public kernel boundary exactly as a teacher would, before any response.
    const stage = id === "scaffold_interrupted_after_presentation" ? "worked_example" : "completion";
    const shown = kernel.prepareScaffoldPresentation(sessionId, { packId: SCAFFOLD_PACK_ID, stage });
    if (!shown.teachingArtifactId) throw new Error(`Scaffold presentation recorded no artifact for ${id}`);
    scaffolds.push({ stage, sourceRef: shown.sourceRef, teachingArtifactId: shown.teachingArtifactId,
      sha256: createHash("sha256").update(shown.markdown).digest("hex") });
  }
  return { id, goalId: GOAL_ID, objectiveId, sessionId, attemptId,
    initialQuestionSeq: question.seq, initialEvidenceCount: count(db, "evidence_events"),
    initialExposureCount: count(db, "exposure_events"),
    ...(scaffolds.length ? { scaffolds } : {}),
    initialReviewCardCount: count(db, "review_cards"), initialAttemptCount: count(db, "attempts") };
}

export function prepareTeacherScenario(id: TeacherScenarioId, dbPath: string): PreparedTeacherScenario {
  if (!teacherScenarios.some((scenario) => scenario.id === id)) {
    throw new Error(`Unknown teacher scenario: ${id}`);
  }
  if (existsSync(dbPath)) throw new Error(`Evaluation database already exists: ${dbPath}`);
  const db = createDatabase(dbPath);
  try {
    if (id === "calibrated_transaction_answer" || id === "calibrated_transaction_wrong_model"
      || id === "calibrated_idempotency_model_error" || id === "calibrated_idempotency_ambiguous"
      || id === "calibrated_idempotency_answer"
      || id === "calibrated_overlap_idempotency_answer"
      || id === "calibrated_async_nested_calls_answer"
      || id === "calibrated_username_race_wrong_model"
      || id === "calibrated_validation_transfer_answer"
      || id === "calibrated_cache_stale_fill_answer" || id === "calibrated_cache_stale_fill_wrong_model"
      || id === "calibrated_promises_missing_return_answer" || id === "calibrated_promises_wrong_model"
      || id === "calibrated_this_binding_wrong_model" || id === "calibrated_this_binding_answer"
      || id === "scaffold_interrupted_after_presentation" || id === "scaffold_completion_return_to_frozen"
      || id === "scaffold_assisted_answer_closure") {
      return prepareCalibratedScenario(db, id);
    }
    createTopic(db, { id: GOAL_ID, name: "Synthetic teacher evaluation" });
    createConcept(db, { id: "async-prefix", topicId: GOAL_ID, title: "Async call execution" });
    const kernel = createTeacherKernel(db);
    kernel.createLearningObjective({ id: OBJECTIVE_ID, conceptId: "async-prefix", capabilityId: "explain" });
    setGoalObjective(db, { goalId: GOAL_ID, objectiveId: OBJECTIVE_ID,
      importance: "core", targetReadiness: "guided" });
    const transfer = id === "transfer_answer";
    const challengeId = transfer ? "async-search-transfer-eval" : "async-prefix-eval";
    kernel.registerChallenge({
      id: challengeId, version: 1,
      publicPrompt: transfer
        ? "Two search requests start in order; the older one finishes last. Explain how an old result can overwrite the latest search and what must guard publication."
        : `${CONTEXT}\nExplain what runs before and after the first await.`,
      taskForm: "explanation", deliveryContext: "practice",
      targets: [{ objectiveId: OBJECTIVE_ID, novelty: transfer ? "transfer" : "same", criterionIds: ["mechanism"] }],
      rubric: { id: "async-prefix-eval-rubric", version: 1, criteria: [{
        id: "mechanism", objectiveId: OBJECTIVE_ID, required: true,
        description: transfer
          ? "Explains independent async completions and a latest-request publication guard."
          : "Distinguishes the synchronous prefix from the continuation suspended by await.",
      }] },
      verification: { required: false, basis: "frozen_rubric" },
    });
    const sessionId = kernel.createSession(GOAL_ID, "practice").id;
    const attemptId = kernel.openAttempt(challengeId, 1, sessionId).attempt.id;
    let initialQuestionSeq: number | null = null;

    if (id === "correct_cold_answer" || id === "causal_model_error" || id === "scaffold_declined_further_instruction"
      || id === "reconstruction_completed_closure") {
      const correct = id === "correct_cold_answer";
      kernel.submitAttempt(attemptId, { responseText: correct
        ? "A runs at the call; await suspends B, so end appears before B."
        : "All of task runs later because async defers the entire function." });
      kernel.recordAssessment(attemptId, { evaluatorType: "agent", assessmentBasis: "frozen_rubric",
        objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: correct ? "correct" : "incorrect",
          criteriaMet: correct ? ["mechanism"] : [], criteriaUnmet: correct ? [] : ["mechanism"],
          rationale: correct ? "Identifies the synchronous prefix and suspended continuation."
            : "Treats the entire async function as deferred." }] });
      if (id === "reconstruction_completed_closure") {
        const events = kernel.recordExposure(sessionId, {
          attemptId,
          objectiveIds: [OBJECTIVE_ID],
          exposureType: "corrective_feedback_shown",
          teachingMaterial: {
            content: "Calling task() runs synchronously up to the first await, so A prints during the call and only the continuation after await is deferred.",
            format: "markdown",
          },
          requireReconstruction: true,
          reconstructionQuestion: {
            contextText: CONTEXT,
            promptText: "What was the wrong assumption about async, and which part of task runs before await?",
            questionChunking: "default",
          },
        });
        if (!events.length) throw new Error("Expected reconstruction exposure event");
        const reconQuestion = db.prepare("SELECT seq FROM attempt_subquestions WHERE attempt_id = ? AND purpose = 'reconstruction' ORDER BY seq DESC LIMIT 1")
          .get(attemptId) as { seq: number } | undefined;
        initialQuestionSeq = reconQuestion?.seq ?? null;
      }
    } else {
      const promptText = transfer
        ? "Why can an older completion overwrite the newer result, and what condition should control publishing?"
        : id === "question_too_large"
        ? "Predict the full output, explain the event-loop ordering, describe the promise lifecycle, and discuss how a nested async call would change things."
        : "Which part of task runs before its first await, and why?";
      const question = kernel.openAttemptSubquestion(attemptId, {
        contextText: transfer
          ? "The learner starts search A, then search B. B's response arrives first; A's response arrives last. Each search awaits its own response before assigning the visible result."
          : CONTEXT,
        promptText, questionChunking: "default",
      });
      initialQuestionSeq = question.seq;
    }

    return { id, goalId: GOAL_ID, objectiveId: OBJECTIVE_ID, sessionId, attemptId,
      initialQuestionSeq, initialEvidenceCount: count(db, "evidence_events"),
      initialExposureCount: count(db, "exposure_events") };
  } finally {
    db.close();
  }
}

export interface ScenarioCheck { label: string; passed: boolean }

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function scaffoldExposureRows(db: Database.Database, prepared: PreparedTeacherScenario) {
  // The evaluator knows the exact artifacts returned by prepareScaffoldPresentation.
  // After feedback closes, active-session replay intentionally returns no material.
  const expected = new Set(prepared.scaffolds?.map((item) => item.teachingArtifactId) ?? []);
  if (expected.size === 0) return [];
  const rows = db.prepare(`SELECT exposure.teaching_artifact_id, artifact.content
    FROM exposure_events exposure JOIN teaching_artifacts artifact
      ON artifact.id = exposure.teaching_artifact_id
    WHERE exposure.session_id = ? AND exposure.attempt_id = ? ORDER BY exposure.seq`)
    .all(prepared.sessionId, prepared.attemptId) as Array<{ teaching_artifact_id: string; content: string }>;
  return rows.filter((row) => expected.has(row.teaching_artifact_id));
}

export function inspectTeacherScenario(dbPath: string, prepared: PreparedTeacherScenario): ScenarioCheck[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    const session = db.prepare("SELECT phase, reconstruction_status FROM sessions WHERE id = ?")
      .get(prepared.sessionId) as { phase: string; reconstruction_status: string } | undefined;
    if (!session) throw new Error(`Scenario session missing: ${prepared.sessionId}`);
    const questions = db.prepare(`SELECT seq, purpose, question_chunking, scope_criterion_id,
      response_text, superseded_at FROM attempt_subquestions WHERE attempt_id = ? ORDER BY seq`)
      .all(prepared.attemptId) as Array<{ seq: number; purpose: string; question_chunking: string;
        scope_criterion_id: string | null; response_text: string | null; superseded_at: string | null }>;
    const activeQuestions = questions.filter((question) => question.response_text === null && question.superseded_at === null);
    const evidenceCount = count(db, "evidence_events");
    const exposureCount = count(db, "exposure_events");
    const initial = questions.find((question) => question.seq === prepared.initialQuestionSeq);
    const attempt = db.prepare("SELECT response_text, verification_output_json FROM attempts WHERE id = ?")
      .get(prepared.attemptId) as { response_text: string | null; verification_output_json: string | null } | undefined;
    const evidence = db.prepare("SELECT result, novelty, criteria_json FROM evidence_events WHERE attempt_id = ? ORDER BY seq")
      .all(prepared.attemptId) as Array<{ result: string; novelty: string; criteria_json: string }>;
    const criteria = evidence[0] ? JSON.parse(evidence[0].criteria_json) as { met: string[]; unmet: string[] } : null;
    const verification = attempt?.verification_output_json
      ? JSON.parse(attempt.verification_output_json) as { outcome: string; details?: { output?: unknown; stdout?: unknown } }
      : null;
    const rawOutput = verification?.details?.output ?? verification?.details?.stdout;
    const verifiedLines = typeof rawOutput === "string" ? rawOutput.trimEnd().split(/\r?\n/)
      : Array.isArray(rawOutput) && rawOutput.every((line) => typeof line === "string") ? rawOutput : null;
    const expectedResponse = teacherScenarios.find((item) => item.id === prepared.id)?.learnerMessage;

    switch (prepared.id) {
      case "calibrated_transaction_answer":
      case "calibrated_transaction_wrong_model":
      case "calibrated_idempotency_model_error":
      case "calibrated_idempotency_answer":
      case "calibrated_overlap_idempotency_answer":
      case "calibrated_async_nested_calls_answer":
      case "calibrated_username_race_wrong_model":
      case "calibrated_validation_transfer_answer":
      case "calibrated_cache_stale_fill_answer":
      case "calibrated_cache_stale_fill_wrong_model":
      case "calibrated_promises_missing_return_answer":
      case "calibrated_promises_wrong_model":
      case "calibrated_this_binding_wrong_model":
      case "calibrated_this_binding_answer": {
        const packId = calibratedPackIdFor(prepared.id);
        const packCases = loadCalibratedPredictionPack(KNOWLEDGE_ROOT, packId).cases;
        let caseItem = packCases[0]!;
        if (prepared.id === "calibrated_overlap_idempotency_answer" || prepared.id === "calibrated_async_nested_calls_answer") caseItem = packCases[1]!;
        else if (prepared.id === "calibrated_validation_transfer_answer" || prepared.id === "calibrated_username_race_wrong_model") caseItem = packCases[2]!;
        const expectedOutput = caseItem.expectedOutput;
        const allCriteriaIds = caseItem.criteria.map((c) => c.id);
        const isCorrectScenario = prepared.id.endsWith("_answer");
        const expectedMet = isCorrectScenario ? allCriteriaIds : [];
        const expectedUnmet = isCorrectScenario ? [] : allCriteriaIds;
        const correctAssessment = evidence.length === 1 &&
          evidence[0]?.result === (isCorrectScenario ? "correct" : "incorrect") &&
          JSON.stringify([...(criteria?.met ?? [])].sort()) === JSON.stringify([...expectedMet].sort()) &&
          JSON.stringify([...(criteria?.unmet ?? [])].sort()) === JSON.stringify([...expectedUnmet].sort());
        return [
          { label: "saved question answered with exact learner response",
            passed: initial?.response_text === expectedResponse && attempt?.response_text === expectedResponse },
          { label: "deterministic output recorded after submission",
            passed: verification?.outcome === "passed" &&
              JSON.stringify(verifiedLines) === JSON.stringify(expectedOutput) },
          { label: "one objective assessed against both frozen criteria", passed: correctAssessment },
          ...(isCorrectScenario ? [
            { label: "feedback episode closed without a bonus question",
              passed: session.phase === "complete" && questions.length === 1 && count(db, "attempts") === 1 },
          ] : [
            { label: "repair exposure recorded", passed: exposureCount > prepared.initialExposureCount },
            { label: "reconstruction pending on same attempt", passed: session.reconstruction_status === "required" &&
              activeQuestions.length === 1 && activeQuestions[0]?.purpose === "reconstruction" && questions.length === 2 },
          ]),
        ];
      }
      case "reconstruction_completed_closure": {
        const reconRow = db.prepare("SELECT reconstruction_response_text FROM attempts WHERE id = ?")
          .get(prepared.attemptId) as { reconstruction_response_text: string | null } | undefined;
        return [
          { label: "pending reconstruction question answered with learner response",
            passed: initial?.response_text === expectedResponse && reconRow?.reconstruction_response_text === expectedResponse },
          { label: "session reconstruction marked completed and episode closed",
            passed: session.reconstruction_status === "completed" && session.phase === "complete" && activeQuestions.length === 0 },
          { label: "no duplicate evidence or exposure created during closure",
            passed: evidenceCount === prepared.initialEvidenceCount && exposureCount === prepared.initialExposureCount },
        ];
      }
      case "correct_cold_answer":
        return [
          { label: "feedback episode closed", passed: session.phase === "complete" },
          { label: "no bonus question or new attempt", passed: questions.length === 0 && count(db, "attempts") === 1 },
          { label: "no extra evidence or exposure", passed: evidenceCount === prepared.initialEvidenceCount && exposureCount === prepared.initialExposureCount },
        ];
      case "ambiguous_answer":
        return [
          { label: "one follow-up question pending", passed: questions.length === 2 && activeQuestions.length === 1 },
          { label: "original answer preserved", passed: initial?.response_text === "It happens later." },
          { label: "ambiguity did not create evidence or exposure", passed: evidenceCount === 0 && exposureCount === 0 },
        ];
      case "causal_model_error":
        return [
          { label: "repair exposure recorded", passed: exposureCount > prepared.initialExposureCount },
          { label: "reconstruction required and question pending", passed: session.reconstruction_status === "required" && activeQuestions.some((question) => question.purpose === "reconstruction") },
          { label: "repair did not create independent evidence", passed: evidenceCount === prepared.initialEvidenceCount },
        ];
      case "question_too_large":
        return [
          { label: "original question superseded", passed: initial?.superseded_at !== null && initial?.superseded_at !== undefined },
          { label: "one scoped atomic replacement pending", passed: questions.length === 2 && activeQuestions.length === 1 && activeQuestions[0]?.question_chunking === "atomic" && activeQuestions[0]?.scope_criterion_id === "mechanism" },
          { label: "size complaint did not create evidence or exposure", passed: evidenceCount === 0 && exposureCount === 0 },
        ];
      case "im_stuck":
        return [
          { label: "saved question remains pending", passed: questions.length === 1 && activeQuestions.length === 1 },
          { label: "blocker report did not create evidence or exposure", passed: evidenceCount === 0 && exposureCount === 0 },
          { label: "attempt remains unsubmitted", passed: attempt?.response_text === null },
        ];
      case "resumed_answer":
        return [
          { label: "saved question answered with learner's exact response", passed: (() => {
            const expected = teacherScenarios.find((item) => item.id === prepared.id)?.learnerMessage;
            return initial?.response_text === expected && attempt?.response_text === expected;
          })() },
          { label: "answer assessed correctly once", passed: evidenceCount === 1 &&
            (db.prepare("SELECT result FROM evidence_events LIMIT 1").get() as { result: string } | undefined)?.result === "correct" },
          { label: "feedback episode closed", passed: session.phase === "complete" },
          { label: "no replacement question", passed: questions.length === 1 },
        ];
      case "transfer_answer":
        return [
          { label: "saved transfer response preserved", passed: initial?.response_text === expectedResponse && attempt?.response_text === expectedResponse },
          { label: "one correct transfer assessment", passed: evidence.length === 1 && evidence[0]?.result === "correct" && evidence[0]?.novelty === "transfer" && criteria?.met.includes("mechanism") === true },
          { label: "feedback closed without extra work", passed: session.phase === "complete" && questions.length === 1 && count(db, "attempts") === 1 },
        ];
      case "calibrated_idempotency_ambiguous":
        return [
          { label: "ambiguous answer preserved on saved question", passed: initial?.response_text === expectedResponse && attempt?.response_text === null },
          { label: "one neutral follow-up remains pending", passed: questions.length === 2 && activeQuestions.length === 1 && activeQuestions[0]?.purpose === "response" },
          { label: "no assessment or exposure from ambiguity", passed: evidenceCount === 0 && exposureCount === 0 },
        ];
      case "scaffold_interrupted_after_presentation":
      case "scaffold_completion_return_to_frozen": {
        const shown = prepared.scaffolds ?? [];
        const scaffoldExposures = scaffoldExposureRows(db, prepared);
        const interrupted = prepared.id === "scaffold_interrupted_after_presentation";
        return [
          { label: "recorded scaffold material preserved exactly",
            passed: shown.length === 1 && scaffoldExposures.length === 1 &&
              scaffoldExposures[0]?.teaching_artifact_id === shown[0]!.teachingArtifactId &&
              sha256(scaffoldExposures[0]!.content) === shown[0]!.sha256 },
          { label: "no duplicate presentation or exposure", passed: exposureCount === prepared.initialExposureCount },
          { label: "frozen question still pending and unanswered", passed: questions.length === 1 &&
            activeQuestions.length === 1 && initial?.response_text === null && initial?.superseded_at === null &&
            attempt?.response_text === null },
          { label: interrupted ? "interruption created no evidence or attempt"
              : "completion reply was not recorded as the frozen answer or assessed",
            passed: evidenceCount === prepared.initialEvidenceCount && count(db, "attempts") === prepared.initialAttemptCount },
        ];
      }
      case "scaffold_assisted_answer_closure": {
        const packExpected = loadCalibratedPredictionPack(KNOWLEDGE_ROOT, "transaction-predict").cases[0]!.expectedOutput;
        return [
          { label: "saved question answered with exact learner response",
            passed: initial?.response_text === expectedResponse && attempt?.response_text === expectedResponse },
          { label: "deterministic output recorded after submission",
            passed: verification?.outcome === "passed" &&
              JSON.stringify(verifiedLines) === JSON.stringify(packExpected) },
          { label: "one correct assessment recorded as assisted, not valid retrieval",
            passed: evidence.length === 1 && evidence[0]?.result === "correct" &&
              (db.prepare("SELECT retrieval_valid FROM evidence_events WHERE attempt_id = ?")
                .get(prepared.attemptId) as { retrieval_valid: number } | undefined)?.retrieval_valid === 0 &&
              JSON.stringify([...(criteria?.met ?? [])].sort()) === JSON.stringify(["invariant_boundary", "observable_outcome"]) },
          { label: "assisted success did not create or advance a review card",
            passed: count(db, "review_cards") === (prepared.initialReviewCardCount ?? 0) },
          { label: "closed without bonus question, extra attempt or repeated presentation",
            passed: session.phase === "complete" && questions.length === 1 &&
              count(db, "attempts") === prepared.initialAttemptCount && scaffoldExposureRows(db, prepared).length === 1 &&
              exposureCount === prepared.initialExposureCount },
        ];
      }
      case "scaffold_declined_further_instruction":
        return [
          { label: "no unrequested instruction recorded", passed: exposureCount === prepared.initialExposureCount },
          { label: "reconstruction not required", passed: session.reconstruction_status !== "required" },
          { label: "feedback episode closed without extra question or attempt",
            passed: session.phase === "complete" && questions.length === 0 && count(db, "attempts") === 1 },
          // Closure above implies this, but an open session is the harmful state, not an inert one:
          // while phase stays 'feedback', continuation keeps returning it with nextAction 'review_gap',
          // which obliges the next teacher to deliver the repair the learner just declined.
          { label: "decline left no review_gap obligation for the next session",
            passed: session.phase === "complete" ||
              getSessionFeedback(db, prepared.sessionId).nextAction !== "review_gap" },
          { label: "decline created no extra evidence", passed: evidenceCount === prepared.initialEvidenceCount },
        ];
      case "answer_requested":
        return [
          { label: "answer exposure recorded", passed: exposureCount > prepared.initialExposureCount },
          { label: "no independent retrieval evidence", passed: evidenceCount === 0 },
        ];
    }
  } finally {
    db.close();
  }
}

export interface ReplyAdvisory { flag: string; detail: string }

// Wording the transaction pack's frozen question asks the learner to derive. A lexical heuristic only.
const TRANSACTION_MECHANISM_TERMS = ["check-then-act", "check then act", "interleav", "no lock", "stale", "before either", "both callers"];

/**
 * Advisory, lexical checks on a saved learner-facing reply. They never gate: a paraphrase evades them and
 * harmless wording can trip them. A human reads the reply; these only point at where to look.
 */
export function adviseOnReply(dbPath: string, prepared: PreparedTeacherScenario, reply: string): ReplyAdvisory[] {
  const flags: ReplyAdvisory[] = [];
  const normalized = reply.replace(/\s+/g, " ").toLowerCase();

  const sentences = reply.split(/(?<=[.!?])\s+|\n+/).map((item) => item.trim().toLowerCase()).filter((item) => item.split(" ").length >= 8);
  const repeated = [...new Set(sentences.filter((item, index) => sentences.indexOf(item) !== index))];
  if (repeated.length) flags.push({ flag: "repeated_sentences", detail: `${repeated.length} sentence(s) of 8+ words appear more than once` });

  const db = new Database(dbPath, { readonly: true });
  try {
    const bodies = (db.prepare(`SELECT DISTINCT artifact.content FROM exposure_events exposure
      JOIN teaching_artifacts artifact ON artifact.id = exposure.teaching_artifact_id`).all() as Array<{ content: string }>)
      .map((row) => row.content);
    const recorded = bodies.join(" ").replace(/\s+/g, " ").toLowerCase();

    const scaffoldLines = scaffoldExposureRows(db, prepared).flatMap((row) => row.content.split("\n"))
      .map((line) => line.trim().toLowerCase()).filter((line) => line.length >= 40);
    const echoed = scaffoldLines.filter((line) => normalized.includes(line.replace(/\s+/g, " ")));
    if (echoed.length >= 2) flags.push({ flag: "recorded_material_echoed", detail: `${echoed.length} long lines of the recorded scaffold appear verbatim` });

    if (prepared.id.startsWith("scaffold_")) {
      const unrecorded = TRANSACTION_MECHANISM_TERMS.filter((term) => normalized.includes(term) && !recorded.includes(term));
      if (unrecorded.length) flags.push({ flag: "mechanism_wording_not_in_any_exposure",
        detail: `reply uses ${unrecorded.map((term) => `"${term}"`).join(", ")} but no recorded exposure contains it` });
      if (prepared.scaffolds?.length && !/\b(assisted|not clean|guidance|worked example|completion|recorded|earlier)\b/.test(normalized)) {
        flags.push({ flag: "no_mention_of_prior_assistance", detail: "reply never mentions the recorded guidance or that the attempt is assisted" });
      }
    }
  } finally {
    db.close();
  }
  return flags;
}
