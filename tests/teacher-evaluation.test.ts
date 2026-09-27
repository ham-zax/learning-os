import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createConcept, createDatabase, createTopic, setGoalObjective } from "../src/db/database.js";
import { createTeacherKernel } from "../src/teacher.js";
import { assessorCases, publicAssessorCases, scoreAssessorSubmission } from "../src/evaluation/assessment-calibration.js";
import { inspectTeacherScenario, prepareTeacherScenario, teacherScenarios } from "../src/evaluation/teacher-scenarios.js";
import { codingCourseFile } from "../src/knowledge/courses.js";
import { buildCalibratedPredictionChallenge, findCalibratedPredictionCase,
  loadCalibratedPredictionPack } from "../src/knowledge/challenge-calibration.js";

const dirs: string[] = [];
const backendCourse = fileURLToPath(new URL("../knowledge/backend-systems", import.meta.url));
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function prepare(id: Parameters<typeof prepareTeacherScenario>[0]) {
  const dir = mkdtempSync(join(tmpdir(), "learning-os-teacher-eval-test-"));
  dirs.push(dir);
  const path = join(dir, "tutor.db");
  return { path, prepared: prepareTeacherScenario(id, path) };
}

describe("teacher evaluation scenarios", () => {
  it("selects, freezes, presents, resumes, verifies, and assesses one calibrated episode", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-full-episode-"));
    dirs.push(dir);
    const path = join(dir, "tutor.db");
    const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
    const conceptId = "database-transactions-and-concurrent-correctness";
    const objectiveId = `${conceptId}:predict`;
    const goalId = "full-episode-goal";
    let attemptId: number;
    let sessionId: number;
    let questionSeq: number;

    const firstDb = createDatabase(path);
    try {
      createTopic(firstDb, { id: goalId, name: "Synthetic full episode" });
      createConcept(firstDb, { id: conceptId, topicId: goalId, title: conceptId });
      const kernel = createTeacherKernel(firstDb);
      kernel.createLearningObjective({ id: objectiveId, conceptId, capabilityId: "predict" });
      setGoalObjective(firstDb, { goalId, objectiveId, importance: "core", targetReadiness: "guided" });
      const continuation = kernel.getStudyContinuation({ goalId, now: new Date().toISOString(), oneEpisode: true });
      expect(continuation.kind).toBe("recommend");
      if (continuation.kind !== "recommend") throw new Error("Expected selected intent");
      const intent = continuation.item.intent;
      const selected = findCalibratedPredictionCase(knowledgeRoot, intent, kernel.getChallenge);
      expect(selected).toMatchObject({ packId: "transaction-predict", caseId: "last-seat-baseline" });
      if (!selected) throw new Error("Expected a matching calibrated case");
      const pack = loadCalibratedPredictionPack(knowledgeRoot, selected.packId);
      const item = pack.cases.find((candidate) => candidate.id === selected.caseId)!;
      const built = buildCalibratedPredictionChallenge({ knowledgeRoot, ...selected,
        intent, challengeId: "full-episode-transaction" });
      kernel.registerChallenge(built.challenge, intent);
      sessionId = kernel.createSession(intent.goalId, intent.deliveryContext).id;
      attemptId = kernel.openAttempt(built.challenge.id, 1, sessionId).attempt.id;
      questionSeq = kernel.openAttemptSubquestion(attemptId, {
        contextText: built.challenge.publicPrompt.slice(0, -(item.question.length + 2)),
        promptText: item.question, questionChunking: "default",
      }).seq;
      expect(kernel.getSessionQuestionPresentation(sessionId)).toMatchObject({
        kind: "question", seq: questionSeq,
      });
    } finally {
      firstDb.close();
    }

    const secondDb = createDatabase(path);
    try {
      const kernel = createTeacherKernel(secondDb);
      const continuation = kernel.getStudyContinuation({ goalId, now: new Date().toISOString(), oneEpisode: true });
      expect(continuation.kind).toBe("resume");
      if (continuation.kind !== "resume") throw new Error("Expected durable resumed attempt");
      expect(continuation.presentation).toMatchObject({ kind: "question", seq: questionSeq });
      const responseText = "A:accepted; B:accepted; decisions:[true,true]; seats:-1. Both checked before either decremented.";
      kernel.submitAttempt(attemptId, { questionSeq, responseText });
      const source = codingCourseFile(backendCourse, "challenges/database-transactions-predict/baseline.mjs");
      const output = execFileSync(process.execPath, [source], { encoding: "utf8", timeout: 3000 }).trim().split("\n");
      kernel.recordAssessment(attemptId, { evaluatorType: "agent", assessmentBasis: "deterministic_execution",
        verificationOutput: { outcome: "passed", basis: "Node ESM execution after response",
          summary: output.join(", "), details: { stdout: output } },
        objectiveResults: [{ objectiveId, result: "correct",
          criteriaMet: ["observable_outcome", "invariant_boundary"], criteriaUnmet: [],
          rationale: "Correct output and check-before-decrement explanation." }] });
      kernel.completeSessionFeedback(sessionId);
      expect(kernel.resumeSession(sessionId).pendingAction).toBe("none");
      expect(kernel.getObjectiveEvidenceReceipt(objectiveId).evidenceHistory).toHaveLength(1);
      expect(secondDb.prepare("SELECT response_text FROM attempts WHERE id = ?").get(attemptId))
        .toMatchObject({ response_text: responseText });
      expect(secondDb.prepare("SELECT response_text FROM attempt_subquestions WHERE seq = ?").get(questionSeq))
        .toMatchObject({ response_text: responseText });
    } finally {
      secondDb.close();
    }
  });

  it("offers twelve replayable episodes including blocker, transfer, and backend counterexamples", () => {
    expect(teacherScenarios).toHaveLength(12);
    for (const id of ["im_stuck", "transfer_answer", "calibrated_transaction_wrong_model",
      "calibrated_idempotency_ambiguous"]) {
      expect(teacherScenarios.some((scenario) => scenario.id === id)).toBe(true);
    }
  });

  it.each([
    ["calibrated_transaction_answer", "database-transactions-and-concurrent-correctness"],
    ["calibrated_idempotency_model_error", "retries-idempotency-and-uncertain-outcomes"],
  ] as const)("seeds %s from a selected intent and freezes a resumable prediction", (id, conceptId) => {
    const { path, prepared } = prepare(id);
    const db = createDatabase(path);
    try {
      const continuation = createTeacherKernel(db).getStudyContinuation({
        goalId: prepared.goalId, now: new Date().toISOString(), oneEpisode: true,
      });
      expect(continuation.kind).toBe("resume");
      if (continuation.kind !== "resume") throw new Error("Expected resumed calibrated attempt");
      const active = continuation.session.activeAttemptState;
      expect(active?.authoringContract).toMatchObject({
        conceptId, capabilityId: "predict", taskForm: "runtime_trace", novelty: "same",
      });
      expect(active?.challenge.verification).toEqual({ required: true, basis: "deterministic_execution" });
      expect(active?.subquestions).toHaveLength(1);
      expect(active?.subquestions[0]?.response_text).toBeNull();
      expect(prepared.initialEvidenceCount).toBe(0);
      expect(prepared.initialExposureCount).toBe(0);
    } finally {
      db.close();
    }
  });

  it("checks a complete resumed transaction prediction through durable evidence", () => {
    const { path, prepared } = prepare("calibrated_transaction_answer");
    const response = teacherScenarios.find((item) => item.id === prepared.id)!.learnerMessage;
    const db = createDatabase(path);
    try {
      const kernel = createTeacherKernel(db);
      const resumed = kernel.getStudyContinuation({ goalId: prepared.goalId,
        now: new Date().toISOString(), oneEpisode: true });
      if (resumed.kind !== "resume") throw new Error("Expected saved question");
      expect(resumed.session.activeAttemptState?.authoringContract?.objectiveId).toBe(prepared.objectiveId);
      kernel.submitAttempt(prepared.attemptId, {
        questionSeq: prepared.initialQuestionSeq!, responseText: response,
      });
      const source = codingCourseFile(backendCourse, "challenges/database-transactions-predict/baseline.mjs");
      const output = execFileSync(process.execPath, [source], { encoding: "utf8", timeout: 3000 }).trim().split("\n");
      expect(output).toEqual(["A:accepted", "B:accepted", "decisions:[true,true]", "seats:-1"]);
      kernel.recordAssessment(prepared.attemptId, { evaluatorType: "agent",
        assessmentBasis: "deterministic_execution",
        verificationOutput: { outcome: "passed", basis: "Node ESM execution after response",
          summary: output.join(", "), details: { stdout: output.join("\n") } },
        objectiveResults: [{ objectiveId: prepared.objectiveId, result: "correct",
          criteriaMet: ["observable_outcome", "invariant_boundary"], criteriaUnmet: [],
          rationale: "Predicts both accepted reservations and identifies the split check/update boundary." }] });
      kernel.completeSessionFeedback(prepared.sessionId);
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("checks a resumed retry prediction with correct output and faulty reasoning", () => {
    const { path, prepared } = prepare("calibrated_idempotency_model_error");
    const response = teacherScenarios.find((item) => item.id === prepared.id)!.learnerMessage;
    const db = createDatabase(path);
    try {
      const kernel = createTeacherKernel(db);
      const resumed = kernel.getStudyContinuation({ goalId: prepared.goalId,
        now: new Date().toISOString(), oneEpisode: true });
      if (resumed.kind !== "resume") throw new Error("Expected saved question");
      kernel.submitAttempt(prepared.attemptId, {
        questionSeq: prepared.initialQuestionSeq!, responseText: response,
      });
      const source = codingCourseFile(backendCourse, "challenges/retries-idempotency-predict/new-key-baseline.mjs");
      const output = execFileSync(process.execPath, [source], { encoding: "utf8", timeout: 3000 }).trim().split("\n");
      expect(output).toEqual(["retry:10", "total:10"]);
      kernel.recordAssessment(prepared.attemptId, { evaluatorType: "agent",
        assessmentBasis: "deterministic_execution",
        verificationOutput: { outcome: "passed", basis: "Node ESM execution after response",
          summary: output.join(", "), details: { stdout: output } },
        objectiveResults: [{ objectiveId: prepared.objectiveId, result: "partially_correct",
          criteriaMet: [], criteriaUnmet: ["observable_outcome", "identity_boundary"],
          rationale: "The output is right, but a new ID misses the completed-result Map and applies another effect." }] });
      kernel.recordExposure(prepared.sessionId, { attemptId: prepared.attemptId,
        objectiveIds: [prepared.objectiveId], exposureType: "explanation_shown",
        teachingMaterial: { content: "The retry uses a new operation ID. The Map looks up by ID, so it misses and applies a second effect." },
        requireReconstruction: true });
      kernel.openAttemptSubquestion(prepared.attemptId, { contextText: "The response was lost before the retry.",
        promptText: "Why did a second effect occur despite the completed Map?", questionChunking: "default" });
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("checks a wrong last-seat model without promoting it to correct evidence", () => {
    const { path, prepared } = prepare("calibrated_transaction_wrong_model");
    const response = teacherScenarios.find((item) => item.id === prepared.id)!.learnerMessage;
    const db = createDatabase(path);
    try {
      const kernel = createTeacherKernel(db);
      kernel.submitAttempt(prepared.attemptId, { questionSeq: prepared.initialQuestionSeq!, responseText: response });
      const source = codingCourseFile(backendCourse, "challenges/database-transactions-predict/baseline.mjs");
      const output = execFileSync(process.execPath, [source], { encoding: "utf8", timeout: 3000 }).trim().split("\n");
      kernel.recordAssessment(prepared.attemptId, { evaluatorType: "agent",
        assessmentBasis: "deterministic_execution",
        verificationOutput: { outcome: "passed", basis: "Node ESM execution after response",
          summary: output.join(", "), details: { stdout: output } },
        objectiveResults: [{ objectiveId: prepared.objectiveId, result: "incorrect",
          criteriaMet: [], criteriaUnmet: ["observable_outcome", "invariant_boundary"],
          rationale: "Both checks precede either decrement, so the serialized model predicts the wrong decisions." }] });
      kernel.recordExposure(prepared.sessionId, { attemptId: prepared.attemptId,
        objectiveIds: [prepared.objectiveId], exposureType: "explanation_shown",
        teachingMaterial: { content: "Both callers pass the availability check before either decrements; both can accept one seat." },
        requireReconstruction: true });
      kernel.openAttemptSubquestion(prepared.attemptId, { contextText: "The two callers each wait after checking stock.",
        promptText: "Why did both reservations succeed?", questionChunking: "default" });
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("keeps an ambiguous retry answer and an unclear blocker out of assessment", () => {
    const stuck = prepare("im_stuck");
    expect(inspectTeacherScenario(stuck.path, stuck.prepared).every((check) => check.passed)).toBe(true);

    const { path, prepared } = prepare("calibrated_idempotency_ambiguous");
    const db = createDatabase(path);
    try {
      const kernel = createTeacherKernel(db);
      kernel.answerAttemptSubquestion(prepared.attemptId, { seq: prepared.initialQuestionSeq!,
        responseText: teacherScenarios.find((item) => item.id === prepared.id)!.learnerMessage });
      kernel.openAttemptSubquestion(prepared.attemptId, { contextText: "The caller retries after losing a response.",
        promptText: "Which effect runs again, and what final total do you predict?", questionChunking: "default" });
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("records a correct changed-surface answer as transfer evidence", () => {
    const { path, prepared } = prepare("transfer_answer");
    const response = teacherScenarios.find((item) => item.id === prepared.id)!.learnerMessage;
    const db = createDatabase(path);
    try {
      const kernel = createTeacherKernel(db);
      const resumed = kernel.getStudyContinuation({ goalId: prepared.goalId,
        now: new Date().toISOString(), oneEpisode: true });
      expect(resumed.kind).toBe("resume");
      kernel.submitAttempt(prepared.attemptId, { questionSeq: prepared.initialQuestionSeq!, responseText: response });
      kernel.recordAssessment(prepared.attemptId, { evaluatorType: "agent", assessmentBasis: "frozen_rubric",
        objectiveResults: [{ objectiveId: prepared.objectiveId, result: "correct",
          criteriaMet: ["mechanism"], criteriaUnmet: [],
          rationale: "Identifies independent completions and latest-request publication authority." }] });
      kernel.completeSessionFeedback(prepared.sessionId);
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("seeds every case as isolated resumable public teacher state", () => {
    for (const scenario of teacherScenarios) {
      const { path, prepared } = prepare(scenario.id);
      const db = createDatabase(path);
      try {
        const continuation = createTeacherKernel(db).getStudyContinuation({
          goalId: prepared.goalId, now: new Date().toISOString(), oneEpisode: true,
        });
        expect(continuation.kind).toBe("resume");
        expect(prepared.initialExposureCount).toBe(0);
      } finally {
        db.close();
      }
      const checks = inspectTeacherScenario(path, prepared);
      // A blocker question is visible conversation, not a database mutation.
      expect(checks.some((check) => !check.passed)).toBe(scenario.id !== "im_stuck");
    }
  });

  it("detects closure of a sufficient answer without extra assessment work", () => {
    const { path, prepared } = prepare("correct_cold_answer");
    const db = createDatabase(path);
    try {
      createTeacherKernel(db).completeSessionFeedback(prepared.sessionId);
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("detects a neutral-size replacement structurally and preserves the old question", () => {
    const { path, prepared } = prepare("question_too_large");
    const db = createDatabase(path);
    try {
      createTeacherKernel(db).replaceAttemptSubquestion(prepared.attemptId, {
        seq: prepared.initialQuestionSeq!,
        contextText: 'async function task() { console.log("A"); await 0; console.log("B"); }\ntask();\nconsole.log("end");',
        promptText: "Which part of task runs before it reaches await?",
        questionChunking: "atomic", scopeCriterionId: "mechanism",
        scopeNote: "Identify the synchronous prefix without giving the answer.",
      });
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("refuses to overwrite an existing evaluation database", () => {
    const { path } = prepare("resumed_answer");
    expect(() => prepareTeacherScenario("resumed_answer", path)).toThrow(/already exists/);
  });
});

describe("assessor calibration", () => {
  const gold = () => ({ decisions: assessorCases.map((item) => ({ caseId: item.id, ...item.expected })) });

  it("presents backend code and its frozen criteria without answer keys", () => {
    const publicCases = publicAssessorCases();
    const transaction = publicCases.find((item) => item.id === "transaction_stale_write_wrong_model");
    const idempotency = publicCases.find((item) => item.id === "idempotency_overlap_wrong_model");
    expect(transaction?.criteria.map((criterion) => criterion.id))
      .toEqual(["observable_outcome", "invariant_boundary"]);
    expect(transaction?.context).toContain("seats");
    expect(transaction?.context).toContain("Can the final seat count by itself prove");
    expect(idempotency?.criteria.map((criterion) => criterion.id))
      .toEqual(["observable_outcome", "identity_boundary"]);
    expect(idempotency?.context).toContain("completed");
    expect(idempotency?.context).toContain("Do both calls perform an effect?");
    expect(JSON.stringify(publicCases)).not.toContain("expectedOutput");
    expect(JSON.stringify(publicCases)).not.toContain("wrongModels");
  });

  it("counts backend right-output wrong-model grades as false correct", () => {
    const candidate = gold();
    for (const caseId of ["transaction_stale_write_wrong_model", "idempotency_overlap_wrong_model"]) {
      const decision = candidate.decisions.find((item) => item.caseId === caseId)!;
      decision.result = "correct";
      decision.criteriaMet = ["observable_outcome", caseId.startsWith("transaction")
        ? "invariant_boundary" : "identity_boundary"];
      decision.criteriaUnmet = [];
    }
    const score = scoreAssessorSubmission(candidate);
    expect(score.falseCorrect).toBe(2);
    expect(score.cases.filter((item) => !item.passed).map((item) => item.caseId))
      .toEqual(["transaction_stale_write_wrong_model", "idempotency_overlap_wrong_model"]);
  });

  it("treats denial of a second effect as unmet under the frozen outcome criterion", () => {
    const candidate = gold();
    const decision = candidate.decisions.find((item) => item.caseId === "idempotency_overlap_wrong_model")!;
    decision.criteriaMet = [];
    decision.criteriaUnmet = ["observable_outcome", "identity_boundary"];
    const score = scoreAssessorSubmission(candidate);
    expect(score.cases.find((item) => item.caseId === decision.caseId)?.passed).toBe(true);
  });

  it("spots false correct grades and missing cases", () => {
    const candidate = gold();
    candidate.decisions = candidate.decisions.filter((item) => item.caseId !== "unreadable_response");
    candidate.decisions.find((item) => item.caseId === "right_order_wrong_model")!.result = "correct";
    candidate.decisions.find((item) => item.caseId === "ambiguous_later")!.action = "assess";
    candidate.decisions.find((item) => item.caseId === "ambiguous_later")!.result = "correct";
    candidate.decisions.find((item) => item.caseId === "ambiguous_later")!.criteriaMet = ["order", "mechanism"];
    candidate.decisions.find((item) => item.caseId === "ambiguous_later")!.criteriaUnmet = [];
    const score = scoreAssessorSubmission(candidate);
    expect(score.falseCorrect).toBe(2);
    expect(score.cases.find((item) => item.caseId === "right_order_wrong_model")?.passed).toBe(false);
    expect(score.cases.find((item) => item.caseId === "unreadable_response")?.errors).toContain("missing decision");
  });

  it("accepts equivalent criterion ordering and rejects duplicate decisions", () => {
    const candidate = gold();
    candidate.decisions.find((item) => item.caseId === "complete_causal_answer")!.criteriaMet = ["mechanism", "order"];
    expect(scoreAssessorSubmission(candidate).passed).toBe(assessorCases.length);
    candidate.decisions.push(candidate.decisions[0]!);
    expect(() => scoreAssessorSubmission(candidate)).toThrow(/Duplicate assessor case/);
  });
});
