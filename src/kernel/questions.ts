import type Database from "better-sqlite3";
import { AttemptSchema, AttemptSubquestionSchema, SessionSchema } from "../db/types.js";
import type { AttemptSubquestion, Session } from "../db/types.js";

type QuestionPurpose = AttemptSubquestion["purpose"];
type QuestionChunking = AttemptSubquestion["question_chunking"];

interface PreparedSubquestionInput {
  promptText: string;
  contextText: string;
}

export type OpenAttemptSubquestionInput =
  | (PreparedSubquestionInput & {
      questionChunking: "default";
      scopeCriterionId?: never;
      scopeNote?: never;
    })
  | (PreparedSubquestionInput & {
      questionChunking: "atomic";
      /** One frozen criterion this question targets. */
      scopeCriterionId: string;
      /** What a sufficient answer to this scoped question would demonstrate. */
      scopeNote: string;
    });

export interface AnswerAttemptSubquestionInput {
  seq: number;
  responseText: string;
}

export type ReplaceAttemptSubquestionInput = OpenAttemptSubquestionInput & { seq: number };

export type QuestionPresentation =
  | { kind: "not_waiting" }
  | { kind: "needs_question"; purpose: QuestionPurpose }
  | { kind: "answered"; purpose: QuestionPurpose; seq: number }
  | {
      kind: "question";
      purpose: QuestionPurpose;
      seq: number;
      questionChunking: QuestionChunking;
      scopeCriterionId: string | null;
      scopeNote: string | null;
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

function frozenCriterionIds(db: Database.Database, attemptId: number): Set<string> {
  const row = db.prepare("SELECT * FROM attempts WHERE id = ?").get(attemptId);
  if (!row) throw new Error(`Attempt not found: ${attemptId}`);
  const attempt = AttemptSchema.parse(row);
  if (attempt.challenge_id === null || attempt.challenge_version === null) {
    throw new Error(`Attempt is not attached to a frozen challenge: ${attemptId}`);
  }
  const rows = db.prepare(
    `SELECT criterion_id FROM challenge_criteria WHERE challenge_id = ? AND version = ?`,
  ).all(attempt.challenge_id, attempt.challenge_version) as Array<{ criterion_id: string }>;
  return new Set(rows.map((entry) => entry.criterion_id));
}

function prepareSubquestion(
  db: Database.Database,
  attemptId: number,
  input: OpenAttemptSubquestionInput,
): {
  prompt: string;
  context: string;
  chunking: QuestionChunking;
  scopeCriterionId: string | null;
  scopeNote: string | null;
} {
  const prompt = nonempty(input.promptText, "Subquestion prompt");
  const context = nonempty(input.contextText, "Task context");
  if (input.questionChunking !== "default" && input.questionChunking !== "atomic") {
    throw new Error("Subquestion chunking must be default or atomic");
  }
  if (input.questionChunking === "default") {
    if (input.scopeCriterionId !== undefined || input.scopeNote !== undefined) {
      throw new Error("Default subquestions must not carry atomic scope metadata");
    }
    return {
      prompt, context, chunking: "default", scopeCriterionId: null, scopeNote: null,
    };
  }

  const criterion = nonempty(input.scopeCriterionId, "Subquestion scope criterion");
  const note = nonempty(input.scopeNote, "Subquestion scope note");
  if (!frozenCriterionIds(db, attemptId).has(criterion)) {
    throw new Error(`Subquestion scope criterion is not part of the frozen challenge: ${criterion}`);
  }
  return {
    prompt, context, chunking: "atomic", scopeCriterionId: criterion, scopeNote: note,
  };
}

function insertPreparedSubquestion(
  db: Database.Database,
  attemptId: number,
  purpose: QuestionPurpose,
  prepared: ReturnType<typeof prepareSubquestion>,
): AttemptSubquestion {
  const info = db.prepare(`INSERT INTO attempt_subquestions
    (attempt_id, prompt_text, context_text, purpose, question_chunking, scope_criterion_id, scope_note, opened_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      attemptId, prepared.prompt, prepared.context, purpose, prepared.chunking,
      prepared.scopeCriterionId, prepared.scopeNote, new Date().toISOString(),
    );
  return AttemptSubquestionSchema.parse(
    db.prepare("SELECT * FROM attempt_subquestions WHERE seq = ?").get(Number(info.lastInsertRowid)),
  );
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
  return db.transaction(() => {
    const purpose = activePurpose(db, attemptId);
    if (pendingQuestion(db, attemptId)) throw new Error(`Attempt ${attemptId} already has a pending subquestion`);
    const prepared = prepareSubquestion(db, attemptId, input);
    return insertPreparedSubquestion(db, attemptId, purpose, prepared);
  })();
}

export function replaceAttemptSubquestion(
  db: Database.Database,
  attemptId: number,
  input: ReplaceAttemptSubquestionInput,
): AttemptSubquestion {
  return db.transaction(() => {
    const old = expectedPending(db, attemptId, input.seq);
    const prepared = prepareSubquestion(db, attemptId, input);
    db.prepare("UPDATE attempt_subquestions SET superseded_at = ? WHERE seq = ?")
      .run(new Date().toISOString(), old.seq);
    return insertPreparedSubquestion(db, attemptId, old.purpose, prepared);
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
    const orientation = purpose === "reconstruction"
      ? "We paused at a short reconstruction after the explanation."
      : "Here is the question we paused on.";
    return {
      kind: "question", purpose, seq: question.seq,
      questionChunking: question.question_chunking,
      scopeCriterionId: question.scope_criterion_id,
      scopeNote: question.scope_note,
      contextText: question.context_text,
      promptText: question.prompt_text,
      markdown: `${orientation}\n\n${question.context_text}\n\n${question.prompt_text}`,
    };
  })();
}
