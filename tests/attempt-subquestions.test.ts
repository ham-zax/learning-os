import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database.js";
import { createTeacherKernel } from "../src/teacher.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("durable attempt subquestions", () => {
  let root: string;
  let dbPath: string;
  let db: ReturnType<typeof createDatabase>;
  let kernel: ReturnType<typeof createTeacherKernel>;
  let sessionId: number;
  let attemptId: number;
  const contextText = "Task context.";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-subquestions-"));
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

  it("resumes answered and pending questions with exact text and assistance after reopening", () => {
    const promptText = "  What triggers the transition?\n";
    const responseText = "  An input.\n";
    const first = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText, questionChunking: "default",
    });
    kernel.answerAttemptSubquestion(attemptId, { seq: first.seq, responseText });
    const second = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "What changes?", questionChunking: "default",
    });
    kernel.recordExposure(sessionId, {
      attemptId,
      objectiveIds: [OBJECTIVE_ID],
      exposureType: "explanation_shown",
      teachingMaterial: { content: "Consider the state before and after the input." },
    });
    db.close();
    db = createDatabase(dbPath);
    kernel = createTeacherKernel(db);

    const continuation = kernel.getStudyContinuation({
      goalId: GOAL_ID,
      now: "2026-09-14T00:00:00.000Z",
      oneEpisode: true,
    });
    expect(continuation.kind).toBe("resume");
    if (continuation.kind !== "resume") throw new Error("Expected resumed work");
    const resumed = continuation.session.activeAttemptState!;
    expect(resumed.subquestions).toMatchObject([
      { seq: first.seq, prompt_text: promptText, response_text: responseText },
      { seq: second.seq, response_text: null, answered_at: null },
    ]);
    expect(resumed.exposureEvents).toHaveLength(1);
    expect(db.prepare("SELECT * FROM evidence_events").all()).toEqual([]);
    expect(db.prepare("SELECT * FROM review_cards").all()).toEqual([]);

    kernel.answerAttemptSubquestion(attemptId, { seq: second.seq, responseText: "The state." });
    kernel.submitAttempt(attemptId, { responseText: "An input changes the state." });
    expect(kernel.resumeSession(sessionId).pendingAction).toBe("assess_response");
    expect(() => kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "Another?", questionChunking: "default",
    }))
      .toThrow("after attempt submission");
  });

  it("rejects a stale answer instead of applying it to the next pending question", () => {
    const first = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "First part?", questionChunking: "default",
    });
    kernel.answerAttemptSubquestion(attemptId, { seq: first.seq, responseText: "First answer" });
    const second = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "Second part?", questionChunking: "default",
    });

    expect(() => kernel.answerAttemptSubquestion(attemptId, {
      seq: first.seq,
      responseText: "Retried first answer",
    })).toThrow("is not pending");
    expect(() => kernel.answerAttemptSubquestion(attemptId, {
      seq: second.seq + 100,
      responseText: "Answer for another question",
    })).toThrow("is not pending");
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions).toMatchObject([
      { seq: first.seq, response_text: "First answer" },
      { seq: second.seq, response_text: null },
    ]);
  });

  it("blocks premature submission but allows the learner to abandon without answering", () => {
    const pending = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "First part?", questionChunking: "default",
    });
    expect(() => kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "Second part?", questionChunking: "default",
    }))
      .toThrow("already has a pending subquestion");
    expect(() => kernel.submitAttempt(attemptId, { responseText: "Partial" }))
      .toThrow("unanswered subquestion");
    kernel.abandonUnsubmittedSession(sessionId);
    expect(kernel.listResumableSessions(GOAL_ID)).toEqual([]);
    expect(() => kernel.answerAttemptSubquestion(attemptId, {
      seq: pending.seq,
      responseText: "Late answer",
    })).toThrow("not the active response target");
    expect(db.prepare("SELECT * FROM evidence_events").all()).toEqual([]);
  });

  it("keeps persisted prompt identity and recorded answers immutable", () => {
    const question = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "First part?", questionChunking: "default",
    });
    expect(() => db.prepare("UPDATE attempt_subquestions SET seq = seq + 100 WHERE seq = ?")
      .run(question.seq)).toThrow("identity is immutable");
    expect(() => db.prepare("UPDATE attempt_subquestions SET prompt_text = 'New prompt' WHERE seq = ?")
      .run(question.seq)).toThrow("identity is immutable");
    kernel.answerAttemptSubquestion(attemptId, { seq: question.seq, responseText: "Original" });
    expect(() => db.prepare("UPDATE attempt_subquestions SET response_text = 'Replacement' WHERE seq = ?")
      .run(question.seq)).toThrow("answered exactly once");
    expect(() => db.prepare("DELETE FROM attempt_subquestions WHERE seq = ?")
      .run(question.seq)).toThrow("durable interaction observations");
  });

  it("rejects an unsupported historical schema instead of replaying migrations", () => {
    db.pragma("user_version = 20");
    db.close();

    expect(() => createDatabase(dbPath)).toThrow(
      "Unsupported learner database schema v20. Learning OS now requires schema v21",
    );
  });
});
