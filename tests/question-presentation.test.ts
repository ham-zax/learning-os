import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database.js";
import { createTeacherKernel } from "../src/teacher.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("question presentation", () => {
  let root: string;
  let dbPath: string;
  let db: ReturnType<typeof createDatabase>;
  let kernel: ReturnType<typeof createTeacherKernel>;
  let sessionId: number;
  let attemptId: number;
  const contextText = '```js\nasync function task() { console.log("A"); await 0; console.log("B"); }\ntask();\nconsole.log("end");\n```';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-presentation-"));
    dbPath = join(root, "tutor.db");
    const fixture = createKernelFixture(dbPath);
    db = fixture.db;
    ({ sessionId, attemptId } = fixture.openPracticeAttempt());
    kernel = createTeacherKernel(db);
  });
  afterEach(() => {
    if (db.open) db.close();
    rmSync(root, { recursive: true, force: true });
  });

  function requireRepair() {
    kernel.submitAttempt(attemptId, { responseText: "I do not know." });
    kernel.recordAssessment(attemptId, {
      evaluatorType: "agent", assessmentBasis: "frozen_rubric",
      objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: "incorrect",
        criteriaMet: [], criteriaUnmet: ["mechanism"], rationale: "Missing mechanism." }],
    });
    kernel.recordExposure(sessionId, {
      attemptId, objectiveIds: [OBJECTIVE_ID], exposureType: "answer_revealed",
      teachingMaterial: { content: "SOLUTION: the continuation runs after synchronous work." },
      requireReconstruction: true,
    });
  }

  it("resumes a replaced reconstruction question with context, without replaying the solution", () => {
    requireRepair();
    const evidence = db.prepare("SELECT * FROM evidence_events").all();
    const cards = db.prepare("SELECT * FROM review_cards").all();
    const first = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "Explain all the ordering and queue behavior.",
    });
    const replacement = kernel.replaceAttemptSubquestion(attemptId, {
      seq: first.seq, promptText: 'Why does "end" appear before "B"?', questionChunking: "atomic",
    });
    const before = kernel.getSessionQuestionPresentation(sessionId);
    expect(before).toMatchObject({ kind: "question", purpose: "reconstruction",
      seq: replacement.seq, contextText, questionChunking: "atomic" });
    expect(before).toMatchObject({
      markdown: `We paused at a short reconstruction after the explanation.\n\n${contextText}\n\nWhy does "end" appear before "B"?`,
    });
    expect(JSON.stringify(before)).not.toContain("SOLUTION");
    expect(kernel.getSessionQuestionPresentation(sessionId)).toEqual(before);
    db.close();
    db = createDatabase(dbPath);
    kernel = createTeacherKernel(db);
    const continued = kernel.getStudyContinuation({ goalId: GOAL_ID, now: "2026-09-14T00:00:00Z" });
    expect(continued).toMatchObject({ kind: "resume", presentation: before });
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions).toMatchObject([
      { seq: first.seq, response_text: null, superseded_at: expect.any(String) },
      { seq: replacement.seq, response_text: null, superseded_at: null },
    ]);
    expect(() => kernel.answerAttemptSubquestion(attemptId, { seq: first.seq, responseText: "Late" }))
      .toThrow("not pending");
    expect(() => kernel.resolveSessionReconstruction(sessionId, { outcome: "completed", responseText: "Bypassed" }))
      .toThrow("unanswered reconstruction question");
    kernel.answerAttemptSubquestion(attemptId, { seq: replacement.seq, responseText: "It yields." });
    expect(kernel.getSessionQuestionPresentation(sessionId)).toMatchObject({ kind: "answered" });
    kernel.resolveSessionReconstruction(sessionId, { outcome: "completed", responseText: "It yields." });
    expect(kernel.getSessionQuestionPresentation(sessionId)).toEqual({ kind: "not_waiting" });
    expect(db.prepare("SELECT * FROM evidence_events").all()).toEqual(evidence);
    expect(db.prepare("SELECT * FROM review_cards").all()).toEqual(cards);
  });

  it("reports missing preparation, inherits chunking and rolls back invalid replacements", () => {
    expect(kernel.getSessionQuestionPresentation(sessionId)).toMatchObject({ kind: "needs_question" });
    const first = kernel.openAttemptSubquestion(attemptId, { promptText: "First?", questionChunking: "atomic" });
    expect(kernel.getSessionQuestionPresentation(sessionId)).toMatchObject({ kind: "needs_context", seq: first.seq });
    expect(() => kernel.replaceAttemptSubquestion(attemptId, { seq: first.seq, promptText: " " })).toThrow();
    const fixed = kernel.replaceAttemptSubquestion(attemptId, { seq: first.seq, promptText: "First?", contextText });
    expect(fixed.question_chunking).toBe("atomic");
    expect(() => kernel.replaceAttemptSubquestion(attemptId, { seq: first.seq, promptText: "Stale?" }))
      .toThrow("not pending");
    kernel.answerAttemptSubquestion(attemptId, { seq: fixed.seq, responseText: "Answer" });
    const next = kernel.openAttemptSubquestion(attemptId, { contextText, promptText: "Necessary second part?" });
    expect(next.question_chunking).toBe("atomic");
    kernel.answerAttemptSubquestion(attemptId, { seq: next.seq, responseText: "Answer two" });
    kernel.submitAttempt(attemptId, { responseText: "Both parts" });
  });

  it("permits reconstruction opt-out with a pending question and retains it without an answer", () => {
    requireRepair();
    const question = kernel.openAttemptSubquestion(attemptId, { contextText, promptText: "Explain the repair?" });
    kernel.resolveSessionReconstruction(sessionId, { outcome: "opted_out" });
    expect(kernel.getSessionQuestionPresentation(sessionId)).toEqual({ kind: "not_waiting" });
    expect(db.prepare("SELECT response_text FROM attempt_subquestions WHERE seq = ?").get(question.seq))
      .toEqual({ response_text: null });
    expect(() => kernel.answerAttemptSubquestion(attemptId, { seq: question.seq, responseText: "Late" }))
      .toThrow();
  });
});
