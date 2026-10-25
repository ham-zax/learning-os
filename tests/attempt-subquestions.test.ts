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

  it("answers and submits one pending question atomically with identical response text", () => {
    const question = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "What changes?", questionChunking: "default",
    });
    const responseText = "  The state changes.\nSecond line.  ";

    const submitted = kernel.submitAttempt(attemptId, {
      questionSeq: question.seq, responseText,
    });

    expect(submitted.response_text).toBe(responseText);
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions[0]?.response_text)
      .toBe(responseText);
    expect(kernel.resumeSession(sessionId).pendingAction).toBe("assess_response");
  });

  it("leaves the question and attempt untouched when combined submission fails", () => {
    const question = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "What changes?", questionChunking: "default",
    });

    expect(() => kernel.submitAttempt(attemptId, {
      questionSeq: question.seq + 1, responseText: "An answer",
    })).toThrow("is not pending");
    expect(() => kernel.submitAttempt(attemptId, {
      questionSeq: question.seq, responseText: "An answer", activeTimeSeconds: -1,
    })).toThrow("activeTimeSeconds must be a non-negative integer");
    expect(() => kernel.submitAttempt(attemptId, {
      questionSeq: question.seq, artifactRef: { kind: "text" },
    })).toThrow("questionSeq requires responseText");
    db.exec(`CREATE TEMP TRIGGER reject_submission BEFORE UPDATE OF submitted_at ON attempts
      WHEN NEW.submitted_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'submission rejected'); END;`);
    expect(() => kernel.submitAttempt(attemptId, {
      questionSeq: question.seq, responseText: "An answer",
    })).toThrow("submission rejected");

    const resumed = kernel.resumeSession(sessionId);
    expect(resumed.activeAttemptState?.subquestions[0]?.response_text).toBeNull();
    expect(resumed.activeAttemptState?.attempt.submitted_at).toBeNull();
    expect(resumed.pendingAction).toBe("collect_response");
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

  it("inherits contextText automatically and opens followUpQuestion atomically in answerAttemptSubquestion", () => {
    const q1 = kernel.openAttemptSubquestion(attemptId, {
      contextText,
      promptText: "What does the script print?",
      questionChunking: "default",
    });
    const res = kernel.answerAttemptSubquestion(attemptId, {
      seq: q1.seq,
      responseText: "Maybe 10 or 12?",
      followUpQuestion: {
        promptText: "Which single output are you committing to?",
        questionChunking: "default",
      },
    });
    expect(res.seq).toBe(q1.seq + 1);
    expect(res.context_text).toBe(contextText);
    expect(res.prompt_text).toBe("Which single output are you committing to?");

    const allAfterAnswer = kernel.resumeSession(sessionId).activeAttemptState?.subquestions ?? [];
    expect(allAfterAnswer[0]?.response_text).toBe("Maybe 10 or 12?");

    const replaced = kernel.replaceAttemptSubquestion(attemptId, {
      seq: res.seq,
      promptText: "First step only: what is x?",
      questionChunking: "default",
    });
    expect(replaced.context_text).toBe(contextText);
    expect(replaced.prompt_text).toBe("First step only: what is x?");
  });

  it("inherits the frozen prompt for the first question and defaults to ordinary chunking", () => {
    const frozenPrompt = kernel.resumeSession(sessionId).activeChallenge!.publicPrompt;
    const question = kernel.openAttemptSubquestion(attemptId, { promptText: "What changes?" });
    expect(question.context_text).toBe(frozenPrompt);
    expect(question.question_chunking).toBe("default");
  });

  it.each([undefined, null, "", "  "])("inherits the previous context for %j", (context) => {
    const first = kernel.openAttemptSubquestion(attemptId, { contextText, promptText: "First part?" });
    const next = kernel.answerAttemptSubquestion(attemptId, {
      seq: first.seq, responseText: "Partial answer",
      followUpQuestion: { contextText: context, promptText: "Which part?" },
    });
    expect(next.context_text).toBe(contextText);
  });

  it("preserves a literal null expression as task context and inherits it unchanged", () => {
    const first = kernel.openAttemptSubquestion(attemptId, { contextText: "null", promptText: "What value is this?" });
    expect(first.context_text).toBe("null");
    const next = kernel.answerAttemptSubquestion(attemptId, {
      seq: first.seq, responseText: "Unsure",
      followUpQuestion: { promptText: "Which type?" },
    });
    expect(next.context_text).toBe("null");
  });

  it("rejects invalid context types instead of silently inheriting", () => {
    expect(() => kernel.openAttemptSubquestion(attemptId, {
      contextText: 42 as unknown as string, promptText: "What changes?",
    })).toThrow("Task context must be a string");
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions).toEqual([]);
  });

  it.each([
    { scopeNote: "One part" },
    { questionChunking: "default", scopeNote: "One part" },
    { scopeCriterionId: "mechanism" },
  ])("rejects default-question scope metadata: %j", (metadata) => {
    expect(() => kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "What changes?", ...metadata,
    } as never)).toThrow();
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions).toEqual([]);
  });

  it("rolls back the original answer when opening its follow-up fails", () => {
    const first = kernel.openAttemptSubquestion(attemptId, { contextText, promptText: "First part?" });
    expect(() => kernel.answerAttemptSubquestion(attemptId, {
      seq: first.seq, responseText: "Partial answer",
      followUpQuestion: { promptText: "Which part?", questionChunking: "atomic",
        scopeCriterionId: "not-a-frozen-criterion", scopeNote: "One part" },
    })).toThrow("not part of the frozen challenge");
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions).toMatchObject([
      { seq: first.seq, response_text: null, answered_at: null },
    ]);
    expect(kernel.resumeSession(sessionId).activeAttemptState?.subquestions).toHaveLength(1);
  });

  it("rejects null chunking instead of treating it as omitted", () => {
    expect(() => kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "What changes?", questionChunking: null,
    } as never)).toThrow("Subquestion chunking must be default or atomic");
  });

  it("rejects an unsupported historical schema instead of replaying migrations", () => {
    db.pragma("user_version = 21");
    db.close();

    expect(() => createDatabase(dbPath)).toThrow(
      "Unsupported learner database schema v21. Learning OS now requires schema v23",
    );
  });
});
