/**
 * Database row types and Zod schemas for the tutor engine.
 *
 * Each table gets:
 *   1. A Zod schema that validates/coerces raw DB rows (SQLite stores
 *      JSON arrays as TEXT, booleans as 0/1, etc.)
 *   2. A TypeScript type inferred from the schema so the two never drift.
 *
 * The schemas are written for *DB → app* conversion.  When writing back,
 * call `.parse()` to ensure invariants hold before INSERT/UPDATE.
 */

import { z } from "zod";

// ─── Shared enums / constants ───────────────────────────────────────────────

export const ConceptStatus = z.enum([
  "unseen",
  "learning",
  "reviewing",
  "mastered",
]);
export type ConceptStatus = z.infer<typeof ConceptStatus>;

export const SessionMode = z.enum([
  "learn",
  "review",
  "quiz",
  "interview",
  "practice",
]);
export type SessionMode = z.infer<typeof SessionMode>;

export const ReviewMode = z.enum([
  "learn",
  "review",
  "quiz",
  "interview",
  "practice",
]);
export type ReviewMode = z.infer<typeof ReviewMode>;

export const ProblemType = z.enum([
  "coding",
  "conceptual",
  "mcq",
  "short-answer",
  "system-design",
]);
export type ProblemType = z.infer<typeof ProblemType>;

export const GapSource = z.enum(["job-hunter", "manual", "feed"]);
export type GapSource = z.infer<typeof GapSource>;

export const SignalSource = z.enum([
  "ai-feeds",
  "hn",
  "arxiv",
  "github",
  "manual",
]);
export type SignalSource = z.infer<typeof SignalSource>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * SQLite stores JSON arrays as TEXT.  This schema accepts either a parsed
 * array or a JSON string and always yields `string[]`.
 */
const jsonArrayOfStrings = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (typeof v === "string" ? JSON.parse(v) : v))
  .pipe(z.array(z.string()));

/**
 * Same pattern for arrays of arbitrary objects (e.g. test_cases).
 */
const jsonArrayOfObjects = z
  .union([z.string(), z.array(z.record(z.unknown()))])
  .transform((v) => (typeof v === "string" ? JSON.parse(v) : v))
  .pipe(z.array(z.record(z.unknown())));

// ─── topics ─────────────────────────────────────────────────────────────────

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: z.number().int().default(1),
  goal: z.string().nullable().default(null),
  deadline: z.string().nullable().default(null),
  created_at: z.string().nullable().default(null),
  last_session: z.string().nullable().default(null),
});
export type Topic = z.infer<typeof TopicSchema>;

// ─── concepts ───────────────────────────────────────────────────────────────

export const ConceptSchema = z.object({
  id: z.string(),
  topic_id: z.string(),
  title: z.string(),
  difficulty: z.number().int().default(1),
  prerequisites: jsonArrayOfStrings.default([]),
  tags: jsonArrayOfStrings.default([]),
  file_path: z.string().nullable().default(null),
  status: ConceptStatus.default("unseen"),
  ef: z.number().default(2.5),
  interval: z.number().int().default(0),
  repetitions: z.number().int().default(0),
  next_review: z.string().nullable().default(null),
  last_grade: z.number().int().nullable().default(null),
  source: z.string().nullable().default(null),
  source_id: z.string().nullable().default(null),
  created_at: z.string().nullable().default(null),
});
export type Concept = z.infer<typeof ConceptSchema>;

// ─── sessions ───────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  id: z.number().int(),
  topic_id: z.string(),
  mode: SessionMode,
  started_at: z.string().nullable().default(null),
  ended_at: z.string().nullable().default(null),
  concepts_reviewed: jsonArrayOfStrings.default([]),
});
export type Session = z.infer<typeof SessionSchema>;

// ─── reviews ────────────────────────────────────────────────────────────────

export const ReviewSchema = z.object({
  id: z.number().int(),
  session_id: z.number().int().nullable().default(null),
  concept_id: z.string(),
  grade: z.number().int(),
  mode: ReviewMode,
  response: z.string().nullable().default(null),
  feedback: z.string().nullable().default(null),
  created_at: z.string().nullable().default(null),
});
export type Review = z.infer<typeof ReviewSchema>;

// ─── synced_gaps ────────────────────────────────────────────────────────────

export const SyncedGapSchema = z.object({
  id: z.number().int(),
  job_id: z.string(),
  skill: z.string(),
  frequency: z.number().int().default(1),
  source: GapSource.default("job-hunter"),
  synced_at: z.string().nullable().default(null),
});
export type SyncedGap = z.infer<typeof SyncedGapSchema>;

// ─── synced_signals ─────────────────────────────────────────────────────────

export const SyncedSignalSchema = z.object({
  id: z.number().int(),
  source_id: z.string(),
  title: z.string(),
  url: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  concept_ids: jsonArrayOfStrings.default([]),
  source: SignalSource.default("ai-feeds"),
  synced_at: z.string().nullable().default(null),
});
export type SyncedSignal = z.infer<typeof SyncedSignalSchema>;

// ─── problems ───────────────────────────────────────────────────────────────

export const ProblemSchema = z.object({
  id: z.string(),
  type: ProblemType,
  title: z.string(),
  description: z.string(),
  difficulty: z.number().int().default(1),
  tags: jsonArrayOfStrings.default([]),
  test_cases: jsonArrayOfObjects.default([]),
  rubric: z.string().nullable().default(null),
  concept_id: z.string().nullable().default(null),
  source: z.string().nullable().default(null),
  external_id: z.string().nullable().default(null),
});
export type Problem = z.infer<typeof ProblemSchema>;

// ─── attempts ───────────────────────────────────────────────────────────────

export const AttemptSchema = z.object({
  id: z.number().int(),
  problem_id: z.string(),
  response: z.string(),
  score: z.number().nullable().default(null),
  feedback: z.string().nullable().default(null),
  time_spent_seconds: z.number().int().nullable().default(null),
  created_at: z.string().nullable().default(null),
});
export type Attempt = z.infer<typeof AttemptSchema>;

// ─── Schema registry (convenient for generic helpers) ───────────────────────

export const schemas = {
  topics: TopicSchema,
  concepts: ConceptSchema,
  sessions: SessionSchema,
  reviews: ReviewSchema,
  synced_gaps: SyncedGapSchema,
  synced_signals: SyncedSignalSchema,
  problems: ProblemSchema,
  attempts: AttemptSchema,
} as const;

export type TableName = keyof typeof schemas;

/** Row type for a given table name. */
export type RowOf<T extends TableName> = z.infer<(typeof schemas)[T]>;
