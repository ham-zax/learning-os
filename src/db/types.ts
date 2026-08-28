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

export const DeliveryContext = z.enum([
  "learn",
  "practice",
  "review",
  "interview",
  "mock",
]);
export type DeliveryContext = z.infer<typeof DeliveryContext>;

export const TaskForm = z.enum([
  "explanation",
  "runtime_trace",
  "implementation",
  "debugging",
  "design",
]);
export type TaskForm = z.infer<typeof TaskForm>;

export const Novelty = z.enum(["same", "variant", "transfer"]);
export type Novelty = z.infer<typeof Novelty>;

export const VerificationBasis = z.enum([
  "deterministic_execution",
  "frozen_rubric",
  "human",
  "mixed",
]);
export type VerificationBasis = z.infer<typeof VerificationBasis>;

export const HintScopeKind = z.enum(["objective", "criteria", "all_targets"]);
export type HintScopeKind = z.infer<typeof HintScopeKind>;

export const ExposureType = z.enum([
  "explanation_shown",
  "answer_revealed",
  "worked_example_shown",
  "corrective_feedback_shown",
  "solution_walkthrough",
]);
export type ExposureType = z.infer<typeof ExposureType>;

export const Readiness = z.enum(["unknown", "exposed", "guided", "independent"]);
export type Readiness = z.infer<typeof Readiness>;

export const TransferState = z.enum([
  "untested",
  "not_demonstrated",
  "demonstrated",
  "contradicted",
]);
export type TransferState = z.infer<typeof TransferState>;

export const DurabilityState = z.enum([
  "untested",
  "not_demonstrated",
  "demonstrated",
  "contradicted",
]);
export type DurabilityState = z.infer<typeof DurabilityState>;

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
  .transform((v: string | string[]) => (typeof v === "string" ? JSON.parse(v) : v))
  .pipe(z.array(z.string()));

/**
 * Same pattern for arrays of arbitrary objects (e.g. test_cases).
 */
const jsonArrayOfObjects = z
  .union([z.string(), z.array(z.record(z.unknown()))])
  .transform((v: string | Record<string, unknown>[]) =>
    typeof v === "string" ? JSON.parse(v) : v,
  )
  .pipe(z.array(z.record(z.unknown())));

const jsonRecord = z
  .union([z.string(), z.record(z.unknown())])
  .transform((v: string | Record<string, unknown>) =>
    typeof v === "string" ? JSON.parse(v) : v,
  )
  .pipe(z.record(z.unknown()));

const sqliteBoolean = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .transform((v: boolean | number) => (typeof v === "boolean" ? v : v === 1));

// ─── challenge contract ─────────────────────────────────────────────────────

export const ChallengeTargetSchema = z.object({
  objectiveId: z.string().min(1),
  novelty: Novelty,
  criterionIds: z.array(z.string().min(1)).min(1),
}).strict();
export type ChallengeTarget = z.infer<typeof ChallengeTargetSchema>;

export const ChallengeCriterionSchema = z.object({
  id: z.string().min(1),
  objectiveId: z.string().min(1),
  required: z.boolean(),
  description: z.string().min(1),
  acceptableVariants: z.array(z.string()).default([]),
}).strict();
export type ChallengeCriterion = z.infer<typeof ChallengeCriterionSchema>;

export const ChallengeRubricSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  criteria: z.array(ChallengeCriterionSchema).min(1),
}).strict();
export type ChallengeRubric = z.infer<typeof ChallengeRubricSchema>;

export const HintLadderSchema = z.object({
  L1: z.string().min(1).optional(),
  L2: z.string().min(1).optional(),
  L3: z.string().min(1).optional(),
  L4: z.string().min(1).optional(),
  L5: z.string().min(1).optional(),
}).strict();
export type HintLadder = z.infer<typeof HintLadderSchema>;

export const VerificationSpecSchema = z.object({
  required: z.boolean(),
  basis: VerificationBasis,
}).strict();
export type VerificationSpec = z.infer<typeof VerificationSpecSchema>;

export const ChallengeSpecSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  sourceProblemId: z.string().min(1).nullable().optional(),
  publicPrompt: z.string().min(1),
  taskForm: TaskForm,
  deliveryContext: DeliveryContext,
  timeBudgetMinutes: z.number().int().positive().nullable().optional(),
  targets: z.array(ChallengeTargetSchema).min(1),
  rubric: ChallengeRubricSchema,
  hintLadder: HintLadderSchema.default({}),
  verification: VerificationSpecSchema,
  privateSolutionRef: z.string().min(1).nullable().optional(),
}).strict();
export type ChallengeSpec = z.infer<typeof ChallengeSpecSchema>;
export type ChallengeSpecInput = z.input<typeof ChallengeSpecSchema>;

export const HintScopeSchema = z.union([
  z.object({ objectiveId: z.string().min(1) }).strict(),
  z.object({ criterionIds: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ allTargets: z.literal(true) }).strict(),
]);
export type HintScope = z.infer<typeof HintScopeSchema>;

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

// ─── kernel objective identity ───────────────────────────────────────────────

export const CapabilitySchema = z.object({
  id: z.string(),
  description: z.string(),
  is_core: sqliteBoolean,
  created_at: z.string(),
});
export type Capability = z.infer<typeof CapabilitySchema>;

export const LearningObjectiveSchema = z.object({
  id: z.string(),
  concept_id: z.string(),
  capability_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LearningObjective = z.infer<typeof LearningObjectiveSchema>;

export const ObjectiveProjectionSchema = z.object({
  objective_id: z.string(),
  readiness: Readiness,
  historical_highest_readiness: Readiness,
  transfer_state: TransferState,
  durability_state: DurabilityState,
  blocking_misconception_count: z.number().int().nonnegative(),
  recent_failure: sqliteBoolean,
  last_qualifying_evidence_at: z.string().nullable().default(null),
  last_event_seq: z.number().int().nonnegative(),
  projector_version: z.string(),
  rebuilt_at: z.string(),
});
export type ObjectiveProjection = z.infer<typeof ObjectiveProjectionSchema>;

// ─── sessions ───────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  id: z.number().int(),
  topic_id: z.string(),
  mode: DeliveryContext,
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
  mode: DeliveryContext,
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

// ─── frozen challenge persistence ───────────────────────────────────────────

export const ChallengeVersionRowSchema = z.object({
  challenge_id: z.string(),
  version: z.number().int().positive(),
  source_problem_id: z.string().nullable().default(null),
  public_prompt: z.string(),
  task_form: TaskForm,
  delivery_context: DeliveryContext,
  time_budget_minutes: z.number().int().positive().nullable().default(null),
  rubric_id: z.string(),
  rubric_version: z.number().int().positive(),
  hint_ladder_json: jsonRecord,
  verification_required: sqliteBoolean,
  verification_basis: VerificationBasis,
  private_solution_ref: z.string().nullable().default(null),
  is_frozen: sqliteBoolean,
  created_at: z.string(),
});
export type ChallengeVersionRow = z.infer<typeof ChallengeVersionRowSchema>;

export const ChallengeTargetRowSchema = z.object({
  challenge_id: z.string(),
  version: z.number().int().positive(),
  objective_id: z.string(),
  novelty: Novelty,
  criterion_ids_json: jsonArrayOfStrings,
  position: z.number().int().nonnegative(),
});
export type ChallengeTargetRow = z.infer<typeof ChallengeTargetRowSchema>;

export const ChallengeCriterionRowSchema = z.object({
  challenge_id: z.string(),
  version: z.number().int().positive(),
  criterion_id: z.string(),
  objective_id: z.string(),
  required: sqliteBoolean,
  description: z.string(),
  acceptable_variants_json: jsonArrayOfStrings,
  position: z.number().int().nonnegative(),
});
export type ChallengeCriterionRow = z.infer<typeof ChallengeCriterionRowSchema>;

// ─── attempts ───────────────────────────────────────────────────────────────

export const AttemptSchema = z.object({
  id: z.number().int(),
  problem_id: z.string().nullable().default(null),
  challenge_id: z.string().nullable().default(null),
  challenge_version: z.number().int().positive().nullable().default(null),
  session_id: z.number().int().nullable().default(null),
  response_text: z.string().nullable().default(null),
  artifact_ref_json: jsonRecord.nullable().default(null),
  score: z.number().nullable().default(null),
  feedback: z.string().nullable().default(null),
  time_spent_seconds: z.number().int().nullable().default(null),
  started_at: z.string(),
  submitted_at: z.string().nullable().default(null),
  created_at: z.string(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

// ─── interaction provenance ─────────────────────────────────────────────────

export const HintObservationSchema = z.object({
  seq: z.number().int(),
  attempt_id: z.number().int(),
  level: z.number().int().min(1).max(5),
  scope_kind: HintScopeKind,
  objective_id: z.string().nullable().default(null),
  criterion_ids_json: jsonArrayOfStrings.nullable().default(null),
  recorded_at: z.string(),
});
export type HintObservation = z.infer<typeof HintObservationSchema>;

export const ExposureEventSchema = z.object({
  seq: z.number().int(),
  objective_id: z.string(),
  session_id: z.number().int().nullable().default(null),
  challenge_id: z.string().nullable().default(null),
  challenge_version: z.number().int().positive().nullable().default(null),
  attempt_id: z.number().int().nullable().default(null),
  exposure_type: ExposureType,
  source_ref: z.string().nullable().default(null),
  occurred_at: z.string(),
});
export type ExposureEvent = z.infer<typeof ExposureEventSchema>;

// ─── Schema registry (convenient for generic helpers) ───────────────────────

export const schemas = {
  topics: TopicSchema,
  concepts: ConceptSchema,
  capabilities: CapabilitySchema,
  learning_objectives: LearningObjectiveSchema,
  objective_projections: ObjectiveProjectionSchema,
  sessions: SessionSchema,
  reviews: ReviewSchema,
  synced_gaps: SyncedGapSchema,
  synced_signals: SyncedSignalSchema,
  problems: ProblemSchema,
  challenge_versions: ChallengeVersionRowSchema,
  challenge_targets: ChallengeTargetRowSchema,
  challenge_criteria: ChallengeCriterionRowSchema,
  attempts: AttemptSchema,
  hint_observations: HintObservationSchema,
  exposure_events: ExposureEventSchema,
} as const;

export type TableName = keyof typeof schemas;

/** Row type for a given table name. */
export type RowOf<T extends TableName> = z.infer<(typeof schemas)[T]>;
