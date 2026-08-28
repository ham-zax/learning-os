/**
 * SQLite database setup, schema creation, and migrations for the tutor engine.
 *
 * Uses better-sqlite3 in WAL mode with PRAGMA user_version for migration tracking.
 */

import Database from "better-sqlite3";
import type {
  Topic,
  Concept,
  Session,
  Review,
  SyncedGap,
  SyncedSignal,
  Problem,
  Attempt,
} from "./types.js";

const CURRENT_VERSION = 1;

// ─── Schema DDL ──────────────────────────────────────────────────────────────

const TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS topics (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phase       INTEGER NOT NULL DEFAULT 1,
    goal        TEXT,
    deadline    TEXT,
    created_at  TEXT,
    last_session TEXT
  );

  CREATE TABLE IF NOT EXISTS concepts (
    id           TEXT PRIMARY KEY,
    topic_id     TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    difficulty   INTEGER NOT NULL DEFAULT 1,
    prerequisites TEXT NOT NULL DEFAULT '[]',
    tags         TEXT NOT NULL DEFAULT '[]',
    file_path    TEXT,
    status       TEXT NOT NULL DEFAULT 'unseen',
    ef           REAL NOT NULL DEFAULT 2.5,
    interval     INTEGER NOT NULL DEFAULT 0,
    repetitions  INTEGER NOT NULL DEFAULT 0,
    next_review  TEXT,
    last_grade   INTEGER,
    source       TEXT,
    source_id    TEXT,
    created_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id         TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    mode             TEXT NOT NULL,
    started_at       TEXT,
    ended_at         TEXT,
    concepts_reviewed TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    grade      INTEGER NOT NULL,
    mode       TEXT NOT NULL,
    response   TEXT,
    feedback   TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS synced_gaps (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id    TEXT NOT NULL,
    skill     TEXT NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 1,
    source    TEXT NOT NULL DEFAULT 'job-hunter',
    synced_at TEXT,
    UNIQUE(job_id, skill)
  );

  CREATE TABLE IF NOT EXISTS synced_signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id   TEXT NOT NULL,
    title       TEXT NOT NULL,
    url         TEXT,
    score       REAL,
    concept_ids TEXT NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL DEFAULT 'ai-feeds',
    synced_at   TEXT,
    UNIQUE(source_id, source)
  );

  CREATE TABLE IF NOT EXISTS problems (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL,
    difficulty   INTEGER NOT NULL DEFAULT 1,
    tags         TEXT NOT NULL DEFAULT '[]',
    test_cases   TEXT NOT NULL DEFAULT '[]',
    rubric       TEXT,
    concept_id   TEXT REFERENCES concepts(id) ON DELETE SET NULL,
    source       TEXT,
    external_id  TEXT
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id          TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    response            TEXT NOT NULL,
    score               REAL,
    feedback            TEXT,
    time_spent_seconds  INTEGER,
    created_at          TEXT
  );
`;

// ─── Indexes ─────────────────────────────────────────────────────────────────

const INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_concepts_topic_id   ON concepts(topic_id);
  CREATE INDEX IF NOT EXISTS idx_concepts_next_review ON concepts(next_review);
  CREATE INDEX IF NOT EXISTS idx_concepts_status      ON concepts(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_topic_id    ON sessions(topic_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_session_id   ON reviews(session_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_concept_id   ON reviews(concept_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_problem_id  ON attempts(problem_id);
  CREATE INDEX IF NOT EXISTS idx_synced_gaps_job_id   ON synced_gaps(job_id);
`;

// ─── Migrations ──────────────────────────────────────────────────────────────

type Migration = {
  version: number;
  up: (db: Database.Database) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(TABLES_SQL);
      db.exec(INDEXES_SQL);
    },
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create (or open) the SQLite database at the given path, enable WAL mode,
 * run any pending migrations, and return the database instance.
 */
export function createDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Performance pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  migrate(db);

  return db;
}

/**
 * Run all pending migrations against the database.  Uses PRAGMA user_version
 * to track which migrations have already been applied.
 */
export function migrate(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    }
  }
}

// ─── CRUD: Topics ─────────────────────────────────────────────────────────

export function createTopic(
  db: Database.Database,
  input: { id: string; name: string; goal?: string; deadline?: string },
): Topic {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO topics (id, name, goal, deadline, created_at)
     VALUES (@id, @name, @goal, @deadline, @created_at)`,
  ).run({
    id: input.id,
    name: input.name,
    goal: input.goal ?? null,
    deadline: input.deadline ?? null,
    created_at: now,
  });
  return getTopic(db, input.id)!;
}

export function getTopic(
  db: Database.Database,
  id: string,
): Topic | undefined {
  return db.prepare(`SELECT * FROM topics WHERE id = ?`).get(id) as
    | Topic
    | undefined;
}

export function listTopics(db: Database.Database): Topic[] {
  return db.prepare(`SELECT * FROM topics ORDER BY created_at DESC`).all() as Topic[];
}

export function updateTopic(
  db: Database.Database,
  id: string,
  updates: Partial<Pick<Topic, "name" | "goal" | "deadline" | "phase" | "last_session">>,
): void {
  const allowed = ["name", "goal", "deadline", "phase", "last_session"] as const;
  const entries = Object.entries(updates).filter(([k]) =>
    (allowed as readonly string[]).includes(k),
  );
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE topics SET ${sets} WHERE id = @id`).run({ id, ...Object.fromEntries(entries) });
}

// ─── CRUD: Concepts ───────────────────────────────────────────────────────

export function createConcept(
  db: Database.Database,
  input: {
    id: string;
    topicId: string;
    title: string;
    difficulty?: number;
    prerequisites?: string[];
    tags?: string[];
    source?: string;
    sourceId?: string;
  },
): Concept {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO concepts (id, topic_id, title, difficulty, prerequisites, tags, source, source_id, created_at)
     VALUES (@id, @topic_id, @title, @difficulty, @prerequisites, @tags, @source, @source_id, @created_at)`,
  ).run({
    id: input.id,
    topic_id: input.topicId,
    title: input.title,
    difficulty: input.difficulty ?? 1,
    prerequisites: JSON.stringify(input.prerequisites ?? []),
    tags: JSON.stringify(input.tags ?? []),
    source: input.source ?? null,
    source_id: input.sourceId ?? null,
    created_at: now,
  });
  return getConcept(db, input.id)!;
}

/**
 * Parse JSON fields in a concept row.
 * SQLite stores JSON arrays as TEXT, so we need to parse them.
 */
function parseConcept(row: any): Concept {
  if (!row) return row;
  return {
    ...row,
    prerequisites: typeof row.prerequisites === 'string' ? JSON.parse(row.prerequisites) : row.prerequisites ?? [],
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags ?? [],
  };
}

export function getConcept(
  db: Database.Database,
  id: string,
): Concept | undefined {
  const row = db.prepare(`SELECT * FROM concepts WHERE id = ?`).get(id);
  return parseConcept(row) as Concept | undefined;
}

export function getConceptsByTopic(
  db: Database.Database,
  topicId: string,
): Concept[] {
  const rows = db
    .prepare(`SELECT * FROM concepts WHERE topic_id = ? ORDER BY created_at`)
    .all(topicId);
  return rows.map(parseConcept) as Concept[];
}

export function getDueConcepts(
  db: Database.Database,
  topicId?: string,
  today?: string,
): Concept[] {
  const now = today ?? new Date().toISOString().slice(0, 10);
  if (topicId) {
    const rows = db
      .prepare(
        `SELECT * FROM concepts
         WHERE topic_id = ?
           AND (next_review <= ? OR next_review IS NULL)
         ORDER BY next_review ASC`,
      )
      .all(topicId, now);
    return rows.map(parseConcept) as Concept[];
  }
  const rows = db
    .prepare(
      `SELECT * FROM concepts
       WHERE (next_review <= ? OR next_review IS NULL)
       ORDER BY next_review ASC`,
    )
    .all(now);
  return rows.map(parseConcept) as Concept[];
}

export function updateConcept(
  db: Database.Database,
  id: string,
  updates: Partial<
    Pick<
      Concept,
      | "title"
      | "difficulty"
      | "prerequisites"
      | "tags"
      | "file_path"
      | "status"
      | "ef"
      | "interval"
      | "repetitions"
      | "next_review"
      | "last_grade"
      | "source"
      | "source_id"
    >
  >,
): void {
  const allowed = [
    "title",
    "difficulty",
    "prerequisites",
    "tags",
    "file_path",
    "status",
    "ef",
    "interval",
    "repetitions",
    "next_review",
    "last_grade",
    "source",
    "source_id",
  ] as const;
  const entries = Object.entries(updates).filter(([k]) =>
    (allowed as readonly string[]).includes(k),
  );
  if (entries.length === 0) return;
  const serialised = entries.map(([k, v]) => {
    if ((k === "prerequisites" || k === "tags") && Array.isArray(v)) {
      return [k, JSON.stringify(v)];
    }
    return [k, v];
  });
  const sets = serialised.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE concepts SET ${sets} WHERE id = @id`).run({
    id,
    ...Object.fromEntries(serialised),
  });
}

// ─── CRUD: Sessions ───────────────────────────────────────────────────────

export function createSession(
  db: Database.Database,
  input: { topicId: string; mode: string },
): Session {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO sessions (topic_id, mode, started_at)
       VALUES (@topic_id, @mode, @started_at)`,
    )
    .run({
      topic_id: input.topicId,
      mode: input.mode,
      started_at: now,
    });
  return getSession(db, Number(info.lastInsertRowid))!;
}

export function getSession(
  db: Database.Database,
  id: number,
): Session | undefined {
  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as
    | Session
    | undefined;
}

export function updateSession(
  db: Database.Database,
  id: number,
  updates: { endedAt?: string; conceptsReviewed?: string[] },
): void {
  const entries: [string, unknown][] = [];
  if (updates.endedAt !== undefined) {
    entries.push(["ended_at", updates.endedAt]);
  }
  if (updates.conceptsReviewed !== undefined) {
    entries.push(["concepts_reviewed", JSON.stringify(updates.conceptsReviewed)]);
  }
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE sessions SET ${sets} WHERE id = @id`).run({
    id,
    ...Object.fromEntries(entries),
  });
}

// ─── CRUD: Reviews ────────────────────────────────────────────────────────

export function createReview(
  db: Database.Database,
  input: {
    sessionId: number | null;
    conceptId: string;
    grade: number;
    mode: string;
    response?: string;
    feedback?: string;
  },
): Review {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO reviews (session_id, concept_id, grade, mode, response, feedback, created_at)
       VALUES (@session_id, @concept_id, @grade, @mode, @response, @feedback, @created_at)`,
    )
    .run({
      session_id: input.sessionId,
      concept_id: input.conceptId,
      grade: input.grade,
      mode: input.mode,
      response: input.response ?? null,
      feedback: input.feedback ?? null,
      created_at: now,
    });
  return db
    .prepare(`SELECT * FROM reviews WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as Review;
}

export function getReviewsBySession(
  db: Database.Database,
  sessionId: number,
): Review[] {
  return db
    .prepare(`SELECT * FROM reviews WHERE session_id = ? ORDER BY created_at`)
    .all(sessionId) as Review[];
}

// ─── CRUD: Synced Gaps ────────────────────────────────────────────────────

export function upsertGap(
  db: Database.Database,
  input: { jobId: string; skill: string; frequency?: number; source?: string },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO synced_gaps (job_id, skill, frequency, source, synced_at)
     VALUES (@job_id, @skill, @frequency, @source, @synced_at)
     ON CONFLICT(job_id, skill) DO UPDATE SET
       frequency = excluded.frequency,
       source = excluded.source,
       synced_at = excluded.synced_at`,
  ).run({
    job_id: input.jobId,
    skill: input.skill,
    frequency: input.frequency ?? 1,
    source: input.source ?? "job-hunter",
    synced_at: now,
  });
}

export function getGaps(
  db: Database.Database,
  jobId?: string,
): SyncedGap[] {
  if (jobId) {
    return db
      .prepare(`SELECT * FROM synced_gaps WHERE job_id = ? ORDER BY skill`)
      .all(jobId) as SyncedGap[];
  }
  return db.prepare(`SELECT * FROM synced_gaps ORDER BY job_id, skill`).all() as SyncedGap[];
}

// ─── CRUD: Synced Signals ─────────────────────────────────────────────────

export function upsertSignal(
  db: Database.Database,
  input: {
    sourceId: string;
    title: string;
    url?: string;
    score?: number;
    source?: string;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO synced_signals (source_id, title, url, score, source, synced_at)
     VALUES (@source_id, @title, @url, @score, @source, @synced_at)
     ON CONFLICT(source_id, source) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       score = excluded.score,
       synced_at = excluded.synced_at`,
  ).run({
    source_id: input.sourceId,
    title: input.title,
    url: input.url ?? null,
    score: input.score ?? null,
    source: input.source ?? "ai-feeds",
    synced_at: now,
  });
}

export function getSignals(
  db: Database.Database,
  minScore?: number,
): SyncedSignal[] {
  if (minScore !== undefined) {
    return db
      .prepare(
        `SELECT * FROM synced_signals WHERE score >= ? ORDER BY score DESC`,
      )
      .all(minScore) as SyncedSignal[];
  }
  return db
    .prepare(`SELECT * FROM synced_signals ORDER BY score DESC`)
    .all() as SyncedSignal[];
}

// ─── CRUD: Problems ───────────────────────────────────────────────────────

export function createProblem(
  db: Database.Database,
  input: {
    id: string;
    type: string;
    title: string;
    description: string;
    difficulty?: number;
    tags?: string[];
    testCases?: Record<string, unknown>[];
    rubric?: string;
    conceptId?: string;
    source?: string;
    externalId?: string;
  },
): Problem {
  db.prepare(
    `INSERT INTO problems (id, type, title, description, difficulty, tags, test_cases, rubric, concept_id, source, external_id)
     VALUES (@id, @type, @title, @description, @difficulty, @tags, @test_cases, @rubric, @concept_id, @source, @external_id)`,
  ).run({
    id: input.id,
    type: input.type,
    title: input.title,
    description: input.description,
    difficulty: input.difficulty ?? 1,
    tags: JSON.stringify(input.tags ?? []),
    test_cases: JSON.stringify(input.testCases ?? []),
    rubric: input.rubric ?? null,
    concept_id: input.conceptId ?? null,
    source: input.source ?? null,
    external_id: input.externalId ?? null,
  });
  return getProblem(db, input.id)!;
}

export function getProblem(
  db: Database.Database,
  id: string,
): Problem | undefined {
  return db.prepare(`SELECT * FROM problems WHERE id = ?`).get(id) as
    | Problem
    | undefined;
}

export function getProblemsByConcept(
  db: Database.Database,
  conceptId: string,
): Problem[] {
  return db
    .prepare(`SELECT * FROM problems WHERE concept_id = ? ORDER BY difficulty`)
    .all(conceptId) as Problem[];
}

// ─── CRUD: Attempts ───────────────────────────────────────────────────────

export function createAttempt(
  db: Database.Database,
  input: {
    problemId: string;
    response: string;
    score?: number;
    feedback?: string;
    timeSpentSeconds?: number;
  },
): Attempt {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO attempts (problem_id, response, score, feedback, time_spent_seconds, created_at)
       VALUES (@problem_id, @response, @score, @feedback, @time_spent_seconds, @created_at)`,
    )
    .run({
      problem_id: input.problemId,
      response: input.response,
      score: input.score ?? null,
      feedback: input.feedback ?? null,
      time_spent_seconds: input.timeSpentSeconds ?? null,
      created_at: now,
    });
  return db
    .prepare(`SELECT * FROM attempts WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as Attempt;
}

export function getAttemptsByProblem(
  db: Database.Database,
  problemId: string,
): Attempt[] {
  return db
    .prepare(`SELECT * FROM attempts WHERE problem_id = ? ORDER BY created_at`)
    .all(problemId) as Attempt[];
}
