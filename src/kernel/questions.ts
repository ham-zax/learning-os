import type Database from "better-sqlite3";
import { getInteractionPreferences } from "../db/database.js";
import { AttemptSchema, AttemptSubquestionSchema, SessionSchema } from "../db/types.js";
import type { AttemptSubquestion, Session } from "../db/types.js";

type QuestionPurpose = AttemptSubquestion["purpose"];
type QuestionChunking = AttemptSubquestion["question_chunking"];

export interface OpenAttemptSubquestionInput {
  promptText: string;
  /** Exact task setup only; omit for legacy callers that have not prepared it. */
  contextText?: string;
  questionChunking?: QuestionChunking;
}

export interface AnswerAttemptSubquestionInput {
  seq: number;
  responseText: string;
}

export interface ReplaceAttemptSubquestionInput extends OpenAttemptSubquestionInput {
  seq: number;
}

export type QuestionPresentation =
  | { kind: "not_waiting" }
  | { kind: "needs_question"; purpose: QuestionPurpose }
  | { kind: "needs_context"; purpose: QuestionPurpose; seq: number }
  | { kind: "answered"; purpose: QuestionPurpose; seq: number }
  | {
      kind: "question";
      purpose: QuestionPurpose;
      seq: number;
      questionChunking: QuestionChunking;
      contextText: string;
      promptText: string;
      markdown: string;
    };

function nonempty(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must not be empty`);
  return value;
}

function validateSeq(seq: number): void {
  if (!Number.isSafeInteger(seq) || seq <= 0) {
    throw new Error("Subquestion sequence must be a positive safe integer");
  }
}

function questionPurpose(session: Session, submitted: boolean): QuestionPurpose | null {
  if (!submitted && session.phase === "awaiting_response" && session.pending_action === "collect_response") {
    return "response";
  }
  if (submitted && session.phase === "feedback" && session.pending_action === "present_feedback"
    && session.reconstruction_status === "required") {
    return "reconstruction";
  }
  return null;
}

function activePurpose(db: Database.Database, attemptId: number): QuestionPurpose {
  const row = db.prepare("SELECT * FROM attempts WHERE id = ?").get(attemptId);
  if (!row) throw new Error(`Attempt not found: ${attemptId}`);
  const attempt = AttemptSchema.parse(row);
  if (attempt.session_id === null || attempt.challenge_id === null) {
    throw new Error(`Attempt is not an active session challenge: ${attemptId}`);
  }
  const session = SessionSchema.parse(db.prepare("SELECT * FROM sessions WHERE id = ?").get(attempt.session_id));
  if (session.active_attempt_id !== attemptId) {
    throw new Error(`Attempt is not the active response target: ${attemptId}`);
  }
  const purpose = questionPurpose(session, attempt.submitted_at !== null);
  if (purpose === null) {
    throw new Error(`Cannot use a subquestion after attempt submission outside required reconstruction: ${attemptId}`);
  }
  return purpose;
}

export function getAttemptSubquestions(db: Database.Database, attemptId: number): AttemptSubquestion[] {
  return AttemptSubquestionSchema.array().parse(
    db.prepare("SELECT * FROM attempt_subquestions WHERE attempt_id = ? ORDER BY seq").all(attemptId),
  );
}

function pendingQuestion(db: Database.Database, attemptId: number): AttemptSubquestion | undefined {
  const row = db.prepare(`SELECT * FROM attempt_subquestions
    WHERE attempt_id = ? AND response_text IS NULL AND superseded_at IS NULL`).get(attemptId);
  return row === undefined ? undefined : AttemptSubquestionSchema.parse(row);
}

function expectedPending(db: Database.Database, attemptId: number, seq: number): AttemptSubquestion {
  validateSeq(seq);
  const purpose = activePurpose(db, attemptId);
  const question = pendingQuestion(db, attemptId);
  if (!question || question.seq !== seq || question.purpose !== purpose) {
    throw new Error(`Subquestion ${seq} is not pending for attempt ${attemptId}`);
  }
  return question;
}

export function openAttemptSubquestion(
  db: Database.Database,
  attemptId: number,
  input: OpenAttemptSubquestionInput,
): AttemptSubquestion {
  const prompt = nonempty(input.promptText, "Subquestion prompt");
  const context = input.contextText === undefined ? null : nonempty(input.contextText, "Task context");
  return db.transaction(() => {
    const purpose = activePurpose(db, attemptId);
    if (pendingQuestion(db, attemptId)) throw new Error(`Attempt ${attemptId} already has a pending subquestion`);
    const previous = db.prepare("SELECT * FROM attempt_subquestions WHERE attempt_id = ? ORDER BY seq DESC LIMIT 1")
      .get(attemptId);
    const chunking = input.questionChunking
      ?? (previous ? AttemptSubquestionSchema.parse(previous).question_chunking : getInteractionPreferences(db).questionChunking);
    const info = db.prepare(`INSERT INTO attempt_subquestions
      (attempt_id, prompt_text, context_text, purpose, question_chunking, opened_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(attemptId, prompt, context, purpose, chunking, new Date().toISOString());
    return AttemptSubquestionSchema.parse(
      db.prepare("SELECT * FROM attempt_subquestions WHERE seq = ?").get(Number(info.lastInsertRowid)),
    );
  })();
}

export function replaceAttemptSubquestion(
  db: Database.Database,
  attemptId: number,
  input: ReplaceAttemptSubquestionInput,
): AttemptSubquestion {
  return db.transaction(() => {
    const old = expectedPending(db, attemptId, input.seq);
    db.prepare("UPDATE attempt_subquestions SET superseded_at = ? WHERE seq = ?")
      .run(new Date().toISOString(), old.seq);
    return openAttemptSubquestion(db, attemptId, {
      promptText: input.promptText,
      contextText: input.contextText ?? old.context_text ?? undefined,
      questionChunking: input.questionChunking ?? old.question_chunking,
    });
  })();
}

export function answerAttemptSubquestion(
  db: Database.Database,
  attemptId: number,
  input: AnswerAttemptSubquestionInput,
): AttemptSubquestion {
  const response = nonempty(input.responseText, "Subquestion response");
  return db.transaction(() => {
    const question = expectedPending(db, attemptId, input.seq);
    db.prepare("UPDATE attempt_subquestions SET response_text = ?, answered_at = ? WHERE seq = ?")
      .run(response, new Date().toISOString(), question.seq);
    return AttemptSubquestionSchema.parse(
      db.prepare("SELECT * FROM attempt_subquestions WHERE seq = ?").get(question.seq),
    );
  })();
}

/** A small display view. Never synthesize a question from a solution or old answers. */
export function getSessionQuestionPresentation(db: Database.Database, sessionId: number): QuestionPresentation {
  return db.transaction((): QuestionPresentation => {
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    if (!row) throw new Error(`Session not found: ${sessionId}`);
    const session = SessionSchema.parse(row);
    if (session.active_attempt_id === null) return { kind: "not_waiting" };
    const attempt = AttemptSchema.parse(db.prepare("SELECT * FROM attempts WHERE id = ?").get(session.active_attempt_id));
    if (attempt.session_id !== sessionId) throw new Error("Session active attempt belongs to another session");
    const purpose = questionPurpose(session, attempt.submitted_at !== null);
    if (purpose === null) return { kind: "not_waiting" };
    const latest = db.prepare(`SELECT * FROM attempt_subquestions
      WHERE attempt_id = ? AND purpose = ? AND superseded_at IS NULL ORDER BY seq DESC LIMIT 1`)
      .get(attempt.id, purpose);
    if (!latest) return { kind: "needs_question", purpose };
    const question = AttemptSubquestionSchema.parse(latest);
    if (question.response_text !== null) return { kind: "answered", purpose, seq: question.seq };
    if (question.context_text === null) return { kind: "needs_context", purpose, seq: question.seq };
    const orientation = purpose === "reconstruction"
      ? "We paused at a short reconstruction after the explanation."
      : "Here is the question we paused on.";
    return {
      kind: "question", purpose, seq: question.seq,
      questionChunking: question.question_chunking,
      contextText: question.context_text,
      promptText: question.prompt_text,
      markdown: `${orientation}\n\n${question.context_text}\n\n${question.prompt_text}`,
    };
  })();
}
