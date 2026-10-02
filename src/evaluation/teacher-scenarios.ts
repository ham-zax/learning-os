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
    learnerMessage: "Later.",
    startingPoint: "A question is pending; the learner's new answer has an unclear referent.",
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
    startingPoint: "A worked example for the pending last-seat prediction was recorded and shown, then the session was interrupted. The frozen question is still unanswered.",
    review: [
      "Replays the exact persisted worked example (via the session's scaffold presentations) instead of generating a new lesson.",
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

function prepareCalibratedScenario(
  db: Database.Database,
  id: "calibrated_transaction_answer" | "calibrated_transaction_wrong_model"
    | "calibrated_idempotency_model_error" | "calibrated_idempotency_ambiguous" | ScaffoldScenarioId,
): PreparedTeacherScenario {
  const packId: CalibratedPredictionPackId = id.startsWith("calibrated_idempotency")
    ? "idempotency-predict" : "transaction-predict";
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
  const item = pack.cases.find((candidate) => candidate.id === selected.caseId)!;
  const challengeId = `teacher-eval-${packId}-${item.id}`;
  const built = buildCalibratedPredictionChallenge({ knowledgeRoot: KNOWLEDGE_ROOT,
    packId, intent, caseId: item.id, challengeId });
  kernel.registerChallenge(built.challenge, intent);
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

    if (id === "correct_cold_answer" || id === "causal_model_error" || id === "scaffold_declined_further_instruction") {
      const correct = id === "correct_cold_answer";
      kernel.submitAttempt(attemptId, { responseText: correct
        ? "A runs at the call; await suspends B, so end appears before B."
        : "All of task runs later because async defers the entire function." });
      kernel.recordAssessment(attemptId, { evaluatorType: "agent", assessmentBasis: "frozen_rubric",
        objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: correct ? "correct" : "incorrect",
          criteriaMet: correct ? ["mechanism"] : [], criteriaUnmet: correct ? [] : ["mechanism"],
          rationale: correct ? "Identifies the synchronous prefix and suspended continuation."
            : "Treats the entire async function as deferred." }] });
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

function scaffoldExposureRows(db: Database.Database) {
  return db.prepare(`SELECT exposure.teaching_artifact_id, artifact.content
    FROM exposure_events exposure JOIN teaching_artifacts artifact ON artifact.id = exposure.teaching_artifact_id
    WHERE exposure.source_ref LIKE 'knowledge/%/scaffold/%.md' ORDER BY exposure.seq`)
    .all() as Array<{ teaching_artifact_id: string; content: string }>;
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
      case "calibrated_idempotency_model_error": {
        const transaction = prepared.id.startsWith("calibrated_transaction");
        const wrongTransaction = prepared.id === "calibrated_transaction_wrong_model";
        const packId = transaction ? "transaction-predict" : "idempotency-predict";
        const expectedOutput = loadCalibratedPredictionPack(KNOWLEDGE_ROOT, packId).cases[0]!.expectedOutput;
        const boundaryCriterion = transaction ? "invariant_boundary" : "identity_boundary";
        const expectedMet = transaction && !wrongTransaction ? ["observable_outcome", boundaryCriterion] : [];
        const expectedUnmet = transaction && !wrongTransaction ? [] : ["observable_outcome", boundaryCriterion];
        const correctAssessment = evidence.length === 1 &&
          evidence[0]?.result === (transaction && !wrongTransaction ? "correct" : "incorrect") &&
          JSON.stringify([...(criteria?.met ?? [])].sort()) === JSON.stringify([...expectedMet].sort()) &&
          JSON.stringify([...(criteria?.unmet ?? [])].sort()) === JSON.stringify([...expectedUnmet].sort());
        return [
          { label: "saved question answered with exact learner response",
            passed: initial?.response_text === expectedResponse && attempt?.response_text === expectedResponse },
          { label: "deterministic output recorded after submission",
            passed: verification?.outcome === "passed" &&
              JSON.stringify(verifiedLines) === JSON.stringify(expectedOutput) },
          { label: "one objective assessed against both frozen criteria", passed: correctAssessment },
          ...(transaction && !wrongTransaction ? [
            { label: "feedback episode closed without a bonus question",
              passed: session.phase === "complete" && questions.length === 1 && count(db, "attempts") === 1 },
          ] : [
            { label: "repair exposure recorded", passed: exposureCount > prepared.initialExposureCount },
            { label: "reconstruction pending on same attempt", passed: session.reconstruction_status === "required" &&
              activeQuestions.length === 1 && activeQuestions[0]?.purpose === "reconstruction" && questions.length === 2 },
          ]),
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
          { label: "original answer preserved", passed: initial?.response_text === "Later." },
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
        const scaffoldExposures = scaffoldExposureRows(db);
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
              count(db, "attempts") === prepared.initialAttemptCount && scaffoldExposureRows(db).length === 1 &&
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
