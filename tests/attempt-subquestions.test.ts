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
    const first = kernel.openAttemptSubquestion(attemptId, { promptText });
    kernel.answerAttemptSubquestion(attemptId, { seq: first.seq, responseText });
    const second = kernel.openAttemptSubquestion(attemptId, { promptText: "What changes?" });
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
    expect(() => kernel.openAttemptSubquestion(attemptId, { promptText: "Another?" }))
      .toThrow("after attempt submission");
  });

  it("rejects a stale answer instead of applying it to the next pending question", () => {
    const first = kernel.openAttemptSubquestion(attemptId, { promptText: "First part?" });
    kernel.answerAttemptSubquestion(attemptId, { seq: first.seq, responseText: "First answer" });
    const second = kernel.openAttemptSubquestion(attemptId, { promptText: "Second part?" });

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
    const pending = kernel.openAttemptSubquestion(attemptId, { promptText: "First part?" });
    expect(() => kernel.openAttemptSubquestion(attemptId, { promptText: "Second part?" }))
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
    const question = kernel.openAttemptSubquestion(attemptId, { promptText: "First part?" });
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

  it("migrates a version 16 database with an active attempt without inventing observations", () => {
    // Remove only migration 17's additions to recreate its pre-migration schema.
    db.exec(`
      DROP TABLE attempt_subquestions;
      DROP TRIGGER attempts_reconstruction_response_requires_submission;
      DROP TRIGGER attempts_reconstruction_response_immutable;
      ALTER TABLE attempts DROP COLUMN reconstruction_response_text;
      PRAGMA user_version = 16;
    `);
    const attemptsBefore = db.prepare<[], Record<string, unknown>>("SELECT * FROM attempts").all();
    const sessionsBefore = db.prepare("SELECT * FROM sessions").all();
    db.close();
    db = createDatabase(dbPath);
    kernel = createTeacherKernel(db);
    expect(db.pragma("user_version", { simple: true })).toBe(19);
    expect(db.prepare("SELECT * FROM attempts").all()).toEqual(
      attemptsBefore.map((attempt) => ({ ...attempt, reconstruction_response_text: null })),
    );
    expect(db.prepare("SELECT * FROM sessions").all()).toEqual(sessionsBefore);
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions).toEqual([]);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    kernel.openAttemptSubquestion(attemptId, { promptText: "Continue the interrupted task?" });
  });
});
