import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createConcept, createDatabase, createTopic, setGoalObjective } from "../src/db/database.js";
import { createTeacherKernel } from "../src/teacher.js";
import { assessorCases, publicAssessorCases, scoreAssessorSubmission } from "../src/evaluation/assessment-calibration.js";
import { adviseOnReply, inspectTeacherScenario, prepareTeacherScenario, teacherScenarios } from "../src/evaluation/teacher-scenarios.js";
import { codingCourseFile } from "../src/knowledge/courses.js";
import { buildCalibratedPredictionChallenge, findCalibratedPredictionCase,
  loadCalibratedPredictionPack } from "../src/knowledge/challenge-calibration.js";
import { runFile, runSync } from "./helpers/spawn.js";

const dirs: string[] = [];
const backendCourse = fileURLToPath(new URL("../knowledge/backend-systems", import.meta.url));
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const scaffoldBeforeResponse = new Set<string>([
  "scaffold_interrupted_after_presentation", "scaffold_completion_return_to_frozen", "scaffold_assisted_answer_closure",
]);
const unchangedStateIsCorrect = new Set<string>([
  "im_stuck", "scaffold_interrupted_after_presentation", "scaffold_completion_return_to_frozen",
]);

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
      const output = runFile(source);
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

  it("offers sixteen replayable episodes including blocker, transfer, backend counterexamples and scaffold continuity", () => {
    expect(teacherScenarios).toHaveLength(16);
    for (const id of ["im_stuck", "transfer_answer", "calibrated_transaction_wrong_model",
      "calibrated_idempotency_ambiguous", "scaffold_interrupted_after_presentation",
      "scaffold_completion_return_to_frozen", "scaffold_assisted_answer_closure",
      "scaffold_declined_further_instruction"]) {
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
      const output = runFile(source);
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
      const output = runFile(source);
      expect(output).toEqual(["retry:10", "total:10"]);
      kernel.recordAssessment(prepared.attemptId, { evaluatorType: "agent",
        assessmentBasis: "deterministic_execution",
        verificationOutput: { outcome: "passed", basis: "Node ESM execution after response",
          summary: output.join(", "), details: { stdout: output } },
        objectiveResults: [{ objectiveId: prepared.objectiveId, result: "incorrect",
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
      const output = runFile(source);
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
        // Scaffold scenarios start after one recorded presentation; every other case starts with no exposure.
        expect(prepared.initialExposureCount).toBe(scaffoldBeforeResponse.has(scenario.id) ? 1 : 0);
      } finally {
        db.close();
      }
      const checks = inspectTeacherScenario(path, prepared);
      // These cases correctly require no database mutation: the right conversation leaves state unchanged.
      expect(checks.some((check) => !check.passed)).toBe(!unchangedStateIsCorrect.has(scenario.id));
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

describe("scaffold revision-friction and fresh-session continuity", () => {
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");

  it.each([
    ["scaffold_interrupted_after_presentation", "worked_example"],
    ["scaffold_completion_return_to_frozen", "completion"],
  ] as const)("restarts %s with exact material, the pending question and no duplicate state", (id, stage) => {
    const { path, prepared } = prepare(id);
    expect(prepared.scaffolds).toHaveLength(1);
    expect(prepared.scaffolds![0]).toMatchObject({ stage });

    // Two independent fresh sessions: each reopens the database and reads only public kernel state.
    for (let restart = 0; restart < 2; restart++) {
      const db = createDatabase(path);
      try {
        const kernel = createTeacherKernel(db);
        const resumed = kernel.getStudyContinuation({ goalId: prepared.goalId,
          now: new Date().toISOString(), oneEpisode: true });
        expect(resumed.kind).toBe("resume");
        const replay = kernel.getSessionScaffoldPresentations(prepared.sessionId);
        expect(replay).toHaveLength(1);
        expect(replay[0]).toMatchObject({ stage, attemptId: prepared.attemptId,
          teachingArtifactId: prepared.scaffolds![0]!.teachingArtifactId });
        expect(sha(replay[0]!.markdown)).toBe(prepared.scaffolds![0]!.sha256);
        expect(replay[0]!.markdown).not.toMatch(/Solution:|teacher|answer key/i);
        const question = kernel.getSessionQuestionPresentation(prepared.sessionId);
        expect(question).toMatchObject({ kind: "question", seq: prepared.initialQuestionSeq });
        expect(db.prepare("SELECT COUNT(*) AS n FROM exposure_events").get()).toEqual({ n: prepared.initialExposureCount });
        expect(db.prepare("SELECT COUNT(*) AS n FROM evidence_events").get()).toEqual({ n: 0 });
        expect(db.prepare("SELECT COUNT(*) AS n FROM attempts").get()).toEqual({ n: 1 });
      } finally {
        db.close();
      }
    }
    expect(inspectTeacherScenario(path, prepared).every((check) => check.passed)).toBe(true);
  });

  it("detects a duplicate scaffold presentation after a restart", () => {
    const { path, prepared } = prepare("scaffold_interrupted_after_presentation");
    const db = createDatabase(path);
    try {
      const kernel = createTeacherKernel(db);
      kernel.prepareScaffoldPresentation(prepared.sessionId, { packId: "database-transactions-predict", stage: "worked_example" });
    } finally {
      db.close();
    }
    const checks = inspectTeacherScenario(path, prepared);
    expect(checks.find((check) => check.label.startsWith("no duplicate"))?.passed).toBe(false);
  });

  it("closes a sufficient assisted answer as assisted evidence without extending a review card", () => {
    const { path, prepared } = prepare("scaffold_assisted_answer_closure");
    const response = teacherScenarios.find((item) => item.id === prepared.id)!.learnerMessage;
    const db = createDatabase(path);
    try {
      const kernel = createTeacherKernel(db);
      kernel.submitAttempt(prepared.attemptId, { questionSeq: prepared.initialQuestionSeq!, responseText: response });
      const source = codingCourseFile(backendCourse, "challenges/database-transactions-predict/baseline.mjs");
      const output = runFile(source);
      kernel.recordAssessment(prepared.attemptId, { evaluatorType: "agent",
        assessmentBasis: "deterministic_execution",
        verificationOutput: { outcome: "passed", basis: "Node ESM execution after response",
          summary: output.join(", "), details: { stdout: output } },
        objectiveResults: [{ objectiveId: prepared.objectiveId, result: "correct",
          criteriaMet: ["observable_outcome", "invariant_boundary"], criteriaUnmet: [],
          rationale: "Predicts both accepted reservations and the split check/update boundary, after a completion exercise." }] });
      kernel.completeSessionFeedback(prepared.sessionId);
    } finally {
      db.close();
    }
    const checks = inspectTeacherScenario(path, prepared);
    expect(checks.filter((check) => !check.passed)).toEqual([]);
    expect(checks.map((check) => check.label)).toContain("one correct assessment recorded as assisted, not valid retrieval");
  });

  it("closes a declined-instruction episode without an unrequested exposure or mandatory reconstruction", () => {
    const { path, prepared } = prepare("scaffold_declined_further_instruction");
    const before = inspectTeacherScenario(path, prepared);
    expect(before.find((check) => check.label.startsWith("feedback episode closed"))?.passed).toBe(false);
    const db = createDatabase(path);
    try {
      createTeacherKernel(db).completeSessionFeedback(prepared.sessionId);
    } finally {
      db.close();
    }
    expect(inspectTeacherScenario(path, prepared).filter((check) => !check.passed)).toEqual([]);
  });

  it("shows that leaving a declined step open arms a review_gap repair obligation, and that closing removes it", () => {
    const { path, prepared } = prepare("scaffold_declined_further_instruction");
    const open = createDatabase(path);
    try {
      const kernel = createTeacherKernel(open);
      const resumed = kernel.getStudyContinuation({ goalId: prepared.goalId,
        now: new Date().toISOString(), oneEpisode: true });
      expect(resumed.kind).toBe("resume");
      expect(kernel.getSessionFeedback(prepared.sessionId).nextAction).toBe("review_gap");
    } finally {
      open.close();
    }
    const stale = inspectTeacherScenario(path, prepared);
    expect(stale.find((check) => check.label.startsWith("decline left no review_gap"))?.passed).toBe(false);

    const closing = createDatabase(path);
    try {
      createTeacherKernel(closing).completeSessionFeedback(prepared.sessionId);
    } finally {
      closing.close();
    }
    expect(inspectTeacherScenario(path, prepared).find((check) => check.label.startsWith("decline left no review_gap"))?.passed).toBe(true);
    const after = createDatabase(path);
    try {
      const next = createTeacherKernel(after).getStudyContinuation({ goalId: prepared.goalId,
        now: new Date().toISOString(), oneEpisode: true });
      expect(next.kind).not.toBe("resume");
      expect(after.prepare("SELECT COUNT(*) AS n FROM exposure_events").get()).toEqual({ n: 0 });
      expect(after.prepare("SELECT COUNT(*) AS n FROM evidence_events").get()).toEqual({ n: 1 });
    } finally {
      after.close();
    }
  });

  it("flags a declined episode where the teacher forced instruction anyway", () => {
    const { path, prepared } = prepare("scaffold_declined_further_instruction");
    const db = createDatabase(path);
    try {
      createTeacherKernel(db).recordExposure(prepared.sessionId, { attemptId: prepared.attemptId,
        objectiveIds: [prepared.objectiveId], exposureType: "explanation_shown",
        teachingMaterial: { content: "Unrequested explanation." }, requireReconstruction: true });
    } finally {
      db.close();
    }
    const failed = inspectTeacherScenario(path, prepared).filter((check) => !check.passed).map((check) => check.label);
    expect(failed).toEqual(expect.arrayContaining(["no unrequested instruction recorded", "reconstruction not required"]));
  });
});

describe("advisory reply heuristics", () => {
  const flagsFor = (reply: string) => {
    const { path, prepared } = prepare("scaffold_interrupted_after_presentation");
    return adviseOnReply(path, prepared, reply).map((item) => item.flag);
  };

  it("stays quiet on a reply that discloses assistance and uses only recorded wording", () => {
    expect(flagsFor("Your connection dropped after I recorded a worked example for this attempt, so it is assisted. Did it come through? The pending question is the same one.")).toEqual([]);
  });

  it("flags repeated sentences, unrecorded mechanism wording and a missing assistance mention", () => {
    const stutter = "This is the same pending question about the last seat as before. This is the same pending question about the last seat as before.";
    expect(flagsFor(stutter)).toEqual(expect.arrayContaining(["repeated_sentences", "no_mention_of_prior_assistance"]));
    expect(flagsFor("It is a classic check-then-act problem, so tell me what happens. The attempt is assisted.")).toContain("mechanism_wording_not_in_any_exposure");
  });

  it("flags a verbatim echo of the recorded scaffold but not wording the exposure contains", () => {
    const { path, prepared } = prepare("scaffold_interrupted_after_presentation");
    const db = createDatabase(path);
    let body: string;
    try {
      body = (db.prepare("SELECT content FROM teaching_artifacts").get() as { content: string }).content;
    } finally {
      db.close();
    }
    expect(adviseOnReply(path, prepared, `Recorded and assisted: ${body}`).map((item) => item.flag)).toContain("recorded_material_echoed");
    expect(adviseOnReply(path, prepared, "The earlier example mentioned a stale decision; this attempt is assisted.").map((item) => item.flag))
      .not.toContain("mechanism_wording_not_in_any_exposure");
  });

  it("is advisory in the inspect command: it prints flags and does not change the exit code", () => {
    const { path, prepared } = prepare("scaffold_interrupted_after_presentation");
    const dir = join(path, "..");
    writeFileSync(join(dir, "scenario.json"), JSON.stringify({ prepared }));
    const reply = join(dir, "reply.txt");
    writeFileSync(reply, "Classic check-then-act, nothing else to add here at all today.");
    const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
    const result = runSync(join(repo, "node_modules", ".bin", "tsx"),
      [join(repo, "src", "evaluation", "cli.ts"), "inspect", dir, reply], { cwd: dir, encoding: "utf8" });
    const output = JSON.parse(result.stdout as string);
    expect(result.status).toBe(0);
    expect(output.passed).toBe(output.total);
    expect(output.replyAdvisories.advisory).toBe(true);
    expect(output.replyAdvisories.flags.map((item: { flag: string }) => item.flag)).toContain("mechanism_wording_not_in_any_exposure");
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
