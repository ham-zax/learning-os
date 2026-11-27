import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type Database from "better-sqlite3";
import { z } from "zod";
import { createDatabase, getGoal, getGoalBookmark } from "../db/database.js";
import {
  AssessmentResultSchema,
  ChallengeSpecSchema,
  DeliveryContext,
  EvidenceRevisionAction,
  ExposureType,
  HintScopeSchema,
  ObjectiveAssessmentResultSchema,
  PracticalWorkPreference,
  TeachingArtifactFormat,
} from "../db/types.js";
import { OperationError, parseRequestInput } from "../errors.js";
import { getAttempt } from "../kernel/foundation.js";
import {
  buildCalibratedPredictionChallenge,
  findCalibratedPredictionCase,
  loadCalibratedPredictionPack,
  verifyPackagedPredictionChallenge,
} from "../knowledge/challenge-calibration.js";
import { ScaffoldStageSchema } from "../knowledge/scaffolds.js";
import { getActiveProfile, listProfiles, openProfileDatabase } from "../profile/index.js";
import { getDueObjectives } from "../scheduler/index.js";
import {
  deriveConfidenceFeedbackDirective,
  type LearnerConfidence,
} from "../teacher-pedagogy.js";
import { createTeacherKernel } from "../teacher.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolRuntimeContext {
  dataDir?: string;
  knowledgeRoot?: string;
  /** Allow callers to pass raw filesystem `dbPath`. Defaults to true for local stdio/tests; set false on remote HTTP. */
  allowDbPath?: boolean;
}

const DEFAULT_KNOWLEDGE_ROOT = fileURLToPath(new URL("../../knowledge", import.meta.url));
const DEFAULT_DATA_DIR = fileURLToPath(new URL("../../data", import.meta.url));

const DbSelectorFields = {
  profile: z.string().min(1).optional(),
  dbPath: z.string().min(1).optional(),
};

const SubquestionInputSchema = z.union([
  z
    .object({
      promptText: z.string().min(1),
      contextText: z.string().min(1).optional(),
      questionChunking: z.literal("default").optional(),
    })
    .strict(),
  z
    .object({
      promptText: z.string().min(1),
      contextText: z.string().min(1).optional(),
      questionChunking: z.literal("atomic"),
      scopeCriterionId: z.string().min(1),
      scopeNote: z.string().min(1),
    })
    .strict(),
]);

const SUBQUESTION_JSON_SCHEMA = {
  type: "object",
  required: ["promptText"],
  additionalProperties: false,
  properties: {
    promptText: { type: "string", minLength: 1 },
    contextText: { type: "string", minLength: 1 },
    questionChunking: { type: "string", enum: ["default", "atomic"] },
    scopeCriterionId: { type: "string", minLength: 1 },
    scopeNote: { type: "string", minLength: 1 },
  },
  allOf: [
    {
      if: { properties: { questionChunking: { const: "atomic" } }, required: ["questionChunking"] },
      then: { required: ["scopeCriterionId", "scopeNote"] },
      else: { not: { anyOf: [{ required: ["scopeCriterionId"] }, { required: ["scopeNote"] }] } },
    },
  ],
};

const ASSESSMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["evaluatorType", "assessmentBasis", "objectiveResults"],
  properties: {
    evaluatorType: { type: "string", enum: ["kernel", "agent", "llm", "human"] },
    assessmentBasis: {
      type: "string",
      enum: ["deterministic_execution", "frozen_rubric", "human", "mixed"],
      description: "Must match commitment.gradingBasis.",
    },
    verificationOutput: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["outcome", "basis", "summary"],
      properties: {
        outcome: { type: "string", enum: ["passed", "failed", "not_run"] },
        basis: { type: "string", minLength: 1 },
        summary: { type: "string", minLength: 1 },
        details: {
          type: "object",
          properties: {
            stdout: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
            },
          },
        },
      },
      description: "Required when verificationRequired=true. Pass verificationOutput returned by action='verify' directly.",
    },
    objectiveResults: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["objectiveId", "result", "criteriaMet", "criteriaUnmet", "rationale"],
        properties: {
          objectiveId: { type: "string", minLength: 1 },
          result: { type: "string", enum: ["correct", "partially_correct", "incorrect", "ungradable"] },
          criteriaMet: { type: "array", items: { type: "string", minLength: 1 } },
          criteriaUnmet: { type: "array", items: { type: "string", minLength: 1 } },
          claimObservations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["claimId", "criterionId", "disposition"],
              properties: {
                claimId: { type: "string", minLength: 1 },
                criterionId: { type: "string", minLength: 1 },
                disposition: { type: "string", enum: ["observed", "cleared"] },
                kind: { type: "string", enum: ["misconception", "error_claim"] },
                description: { type: "string", minLength: 1 },
                correctionStrategy: { type: "string", minLength: 1 },
                isBlocking: { type: "boolean" },
              },
            },
          },
          misconceptionsObserved: { type: "array", items: { type: "string", minLength: 1 } },
          misconceptionsCleared: { type: "array", items: { type: "string", minLength: 1 } },
          rationale: { type: "string", minLength: 1 },
        },
      },
    },
  },
};

const STUDY_SUBMIT_ACTIONS = [
  "verify",
  "assess",
  "revise",
  "teach_first",
  "clarify",
  "split",
  "reconstruct",
  "close_feedback",
  "park",
  "unpark",
  "abandon",
] as const;

const STUDY_HELP_KINDS = ["exposure", "scaffold", "hint"] as const;

const STUDY_NOTES_ACTIONS = [
  "get_context",
  "save",
  "list",
  "get",
  "evidence_receipt",
] as const;

const StudyNextInputSchema = z
  .object({
    ...DbSelectorFields,
    goalId: z.string().min(1).optional(),
    now: z.string().min(1).optional(),
    availableMinutes: z.number().int().positive().optional(),
    oneEpisode: z.boolean().optional(),
    resumeParked: z.boolean().optional(),
    practicalWork: PracticalWorkPreference.optional(),
    retestEligibleWeaknessKeys: z.array(z.string().min(1)).optional(),
    mainDeliveryContext: DeliveryContext.optional(),
    transferDeliveryContext: DeliveryContext.optional(),
    autoOpenCalibrated: z.boolean().optional(),
    activateBankItemId: z.string().min(1).optional(),
    challengeSpec: ChallengeSpecSchema.optional(),
    promptText: z.string().min(1).optional(),
    contextText: z.string().min(1).optional(),
  })
  .strict();

const StudySubmitInputSchema = z.union([
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("verify"),
      attemptId: z.number().int().positive(),
      responseText: z.string().min(1).optional(),
      questionSeq: z.number().int().positive().optional(),
      activeTimeSeconds: z.number().int().nonnegative().optional(),
      artifactRef: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("assess"),
      attemptId: z.number().int().positive(),
      responseText: z.string().min(1).optional(),
      questionSeq: z.number().int().positive().optional(),
      activeTimeSeconds: z.number().int().nonnegative().optional(),
      artifactRef: z.record(z.string(), z.unknown()).optional(),
      assessment: AssessmentResultSchema,
      closeIfComplete: z.boolean().default(true),
      learnerConfidence: z.enum(["low", "medium", "high"]).optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("revise"),
      evidenceEventId: z.string().min(1),
      revisionAction: EvidenceRevisionAction,
      reason: z.string().min(1),
      correctedObjectiveResult: ObjectiveAssessmentResultSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("teach_first"),
      sessionId: z.number().int().positive(),
      attemptId: z.number().int().positive(),
      learnerRequestText: z.string().min(1),
      objectiveIds: z.array(z.string().min(1)).min(1).optional(),
      exposureType: z
        .enum(["explanation_shown", "worked_example_shown", "solution_walkthrough", "answer_revealed"])
        .default("explanation_shown"),
      content: z.string().min(1),
      format: TeachingArtifactFormat.default("markdown"),
      sourceRef: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("clarify"),
      attemptId: z.number().int().positive(),
      seq: z.number().int().positive(),
      responseText: z.string().min(1),
      followUpQuestion: SubquestionInputSchema,
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("split"),
      attemptId: z.number().int().positive(),
      seq: z.number().int().positive(),
      promptText: z.string().min(1),
      scopeCriterionId: z.string().min(1),
      scopeNote: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("reconstruct"),
      sessionId: z.number().int().positive(),
      outcome: z.literal("completed"),
      responseText: z.string().min(1),
      questionSeq: z.number().int().positive().optional(),
      activeTimeSeconds: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("reconstruct"),
      sessionId: z.number().int().positive(),
      outcome: z.literal("opted_out"),
      activeTimeSeconds: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("close_feedback"),
      sessionId: z.number().int().positive(),
      activeTimeSeconds: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("park"),
      goalId: z.string().min(1).optional(),
      sessionId: z.number().int().positive().optional(),
      note: z.string().nullable().optional(),
      nextMove: z.string().nullable().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("unpark"),
      goalId: z.string().min(1).optional(),
      note: z.string().nullable().optional(),
      nextMove: z.string().nullable().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("abandon"),
      sessionId: z.number().int().positive(),
    })
    .strict(),
]);

const StudyHelpInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...DbSelectorFields,
      kind: z.literal("exposure"),
      sessionId: z.number().int().positive().nullable(),
      attemptId: z.number().int().positive().optional(),
      objectiveIds: z.array(z.string().min(1)).min(1),
      exposureType: ExposureType,
      content: z.string().min(1),
      format: TeachingArtifactFormat.default("markdown"),
      sourceRef: z.string().min(1).optional(),
      requireReconstruction: z.boolean().optional(),
      reconstructionQuestion: SubquestionInputSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      kind: z.literal("scaffold"),
      sessionId: z.number().int().positive(),
      packId: z.string().min(1),
      stage: ScaffoldStageSchema,
      requireReconstruction: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      kind: z.literal("hint"),
      attemptId: z.number().int().positive(),
      level: z.number().int().min(1).max(5),
      scope: HintScopeSchema,
    })
    .strict(),
]);

const StudyStatusInputSchema = z
  .object({
    ...DbSelectorFields,
    goalId: z.string().min(1).optional(),
    now: z.string().min(1).optional(),
  })
  .strict();

const RevisionNoteScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("profile") }).strict(),
  z.object({ kind: z.literal("goal"), goalId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("concept"), conceptId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("objective"), objectiveId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("session"), sessionId: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("current_focus"), goalId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("focus_episode"), focusEpisodeId: z.string().min(1) }).strict(),
]);

const StudyNotesInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("get_context"),
      scope: RevisionNoteScopeSchema,
      maxInteractions: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("save"),
      scope: RevisionNoteScopeSchema,
      title: z.string().min(1).optional(),
      markdown: z.string().min(1),
      maxInteractions: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("list"),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("get"),
      noteId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ...DbSelectorFields,
      action: z.literal("evidence_receipt"),
      objectiveId: z.string().min(1),
    })
    .strict(),
]);

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "study_next",
    description:
      "Resume an active Learning OS commitment (phase-specific handoff), unpark/resume a parked session, activate a question-bank item, or get the next evidence-driven recommendation. Read-only unless autoOpenCalibrated=true, activateBankItemId, or challengeSpec is provided.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        profile: { type: "string", description: "Managed profile ID (defaults to active profile)." },
        dbPath: { type: "string", description: "Direct SQLite DB path (mutually exclusive with profile)." },
        goalId: { type: "string", description: "Optional goal ID (auto-resolved when sole goal)." },
        now: { type: "string", description: "Optional ISO-8601 instant (defaults to current time)." },
        availableMinutes: { type: "integer", minimum: 1, description: "Remaining active study minutes (mutually exclusive with oneEpisode)." },
        oneEpisode: { type: "boolean", description: "Select exactly one episode without inventing a time budget." },
        resumeParked: { type: "boolean", description: "When true, resume the goal's parked session instead of bypassing it." },
        practicalWork: { type: "string", enum: ["ask_first", "conversation_only"] },
        retestEligibleWeaknessKeys: { type: "array", items: { type: "string" } },
        mainDeliveryContext: { type: "string", enum: ["learn", "practice", "review", "interview", "mock"] },
        transferDeliveryContext: { type: "string", enum: ["learn", "practice", "review", "interview", "mock"] },
        autoOpenCalibrated: {
          type: "boolean",
          description: "When true and recommendation matches a calibrated pack, atomically register challenge, create session, open attempt, and open the first subquestion.",
        },
        activateBankItemId: {
          type: "string",
          description: "Promote a searchable question_bank_items entry into a durable concept, objective, matching frozen challenge, and active goal membership.",
        },
        challengeSpec: {
          type: "object",
          description: "Optional frozen ChallengeSpec to register and open atomically for the recommended intent.",
        },
        promptText: { type: "string", description: "First learner-facing prompt when opening challengeSpec." },
        contextText: { type: "string", description: "Optional context override when opening challengeSpec (defaults to challengeSpec.publicPrompt)." },
      },
    },
  },
  {
    name: "study_submit",
    description:
      "Execute learner turn transitions: 'verify' (run packaged deterministic verification after commitment and return ready verificationOutput), 'assess', 'revise', 'teach_first', 'clarify', 'split', 'reconstruct', 'close_feedback', 'park', 'unpark', or 'abandon'.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      allOf: [
        {
          if: { properties: { action: { const: "verify" } }, required: ["action"] },
          then: { required: ["attemptId"] },
        },
        {
          if: { properties: { action: { const: "assess" } }, required: ["action"] },
          then: { required: ["attemptId", "assessment"] },
        },
        {
          if: { properties: { action: { const: "revise" } }, required: ["action"] },
          then: { required: ["evidenceEventId", "revisionAction", "reason"] },
        },
        {
          if: { properties: { action: { const: "teach_first" } }, required: ["action"] },
          then: { required: ["sessionId", "attemptId", "learnerRequestText", "content"] },
        },
        {
          if: { properties: { action: { const: "clarify" } }, required: ["action"] },
          then: { required: ["attemptId", "seq", "responseText", "followUpQuestion"] },
        },
        {
          if: { properties: { action: { const: "split" } }, required: ["action"] },
          then: { required: ["attemptId", "seq", "promptText", "scopeCriterionId", "scopeNote"] },
        },
        {
          if: { properties: { action: { const: "reconstruct" } }, required: ["action"] },
          then: {
            required: ["sessionId", "outcome"],
            allOf: [
              {
                if: { properties: { outcome: { const: "completed" } }, required: ["outcome"] },
                then: { required: ["responseText"] },
              },
              {
                if: { properties: { outcome: { const: "opted_out" } }, required: ["outcome"] },
                then: { not: { required: ["responseText"] } },
              },
            ],
          },
        },
        {
          if: { properties: { action: { const: "close_feedback" } }, required: ["action"] },
          then: { required: ["sessionId"] },
        },
        {
          if: { properties: { action: { const: "abandon" } }, required: ["action"] },
          then: { required: ["sessionId"] },
        },
      ],
      properties: {
        profile: { type: "string" },
        dbPath: { type: "string" },
        action: { type: "string", enum: [...STUDY_SUBMIT_ACTIONS] },
        goalId: { type: "string" },
        attemptId: { type: "integer", minimum: 1 },
        sessionId: { type: "integer", minimum: 1 },
        seq: { type: "integer", minimum: 1 },
        questionSeq: { type: "integer", minimum: 1 },
        responseText: { type: "string", minLength: 1, description: "Verbatim learner text with zero edits." },
        learnerRequestText: { type: "string", minLength: 1, description: "Verbatim learner teaching request for action='teach_first'." },
        activeTimeSeconds: { type: "integer", minimum: 0 },
        artifactRef: { type: "object" },
        assessment: {
          ...ASSESSMENT_JSON_SCHEMA,
          description:
            "Assessment object for action='assess': { evaluatorType:'agent', assessmentBasis:<commitment.gradingBasis>, verificationOutput?, objectiveResults:[{ objectiveId, result, criteriaMet, criteriaUnmet, claimObservations?, rationale }] }.",
        },
        closeIfComplete: { type: "boolean", default: true },
        learnerConfidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Optional non-evidence self-reported confidence for Butler affirmation or hypercorrection repair.",
        },
        evidenceEventId: { type: "string", minLength: 1 },
        revisionAction: { type: "string", enum: ["invalidate", "restore"] },
        reason: { type: "string", minLength: 1 },
        correctedObjectiveResult: { type: "object" },
        objectiveIds: { type: "array", items: { type: "string", minLength: 1 } },
        exposureType: {
          type: "string",
          enum: ["explanation_shown", "worked_example_shown", "solution_walkthrough", "answer_revealed"],
        },
        content: { type: "string", minLength: 1 },
        format: { type: "string", enum: ["text", "markdown"], default: "markdown" },
        sourceRef: { type: "string", minLength: 1 },
        followUpQuestion: {
          ...SUBQUESTION_JSON_SCHEMA,
          description: "Neutral clarification subquestion for action='clarify'.",
        },
        promptText: { type: "string", minLength: 1, description: "Single-step prompt for action='split'." },
        scopeCriterionId: { type: "string", minLength: 1, description: "Frozen criterion ID for action='split'." },
        scopeNote: { type: "string", minLength: 1, description: "What a sufficient answer demonstrates for action='split'." },
        outcome: { type: "string", enum: ["completed", "opted_out"], description: "Reconstruction outcome for action='reconstruct'." },
        note: { type: ["string", "null"], description: "Learner bookmark note for action='park' or 'unpark'." },
        nextMove: { type: ["string", "null"], description: "Learner preferred next move for action='park' or 'unpark'." },
      },
    },
  },
  {
    name: "study_help",
    description:
      "Pre-display boundary for all answer-bearing teaching help: kind='exposure' (record corrective feedback, explanation, worked example, or answer reveal—optionally with atomic reconstructionQuestion), kind='scaffold' (persist and return a curated worked_example or completion pack), or kind='hint' (record scoped hint level L1-L5).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      allOf: [
        {
          if: { properties: { kind: { const: "exposure" } }, required: ["kind"] },
          then: { required: ["sessionId", "objectiveIds", "exposureType", "content"] },
        },
        {
          if: { properties: { kind: { const: "scaffold" } }, required: ["kind"] },
          then: { required: ["sessionId", "packId", "stage"] },
        },
        {
          if: { properties: { kind: { const: "hint" } }, required: ["kind"] },
          then: { required: ["attemptId", "level", "scope"] },
        },
      ],
      properties: {
        profile: { type: "string", minLength: 1 },
        dbPath: { type: "string", minLength: 1 },
        kind: { type: "string", enum: [...STUDY_HELP_KINDS] },
        sessionId: { type: ["integer", "null"], minimum: 1 },
        attemptId: { type: "integer", minimum: 1 },
        objectiveIds: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        exposureType: {
          type: "string",
          enum: [
            "explanation_shown",
            "answer_revealed",
            "worked_example_shown",
            "corrective_feedback_shown",
            "solution_walkthrough",
          ],
        },
        content: { type: "string", minLength: 1 },
        format: { type: "string", enum: ["text", "markdown"], default: "markdown" },
        sourceRef: { type: "string", minLength: 1 },
        requireReconstruction: { type: "boolean" },
        reconstructionQuestion: SUBQUESTION_JSON_SCHEMA,
        packId: { type: "string", minLength: 1 },
        stage: { type: "string", enum: ["worked_example", "completion"] },
        level: { type: "integer", minimum: 1, maximum: 5 },
        scope: { type: "object" },
      },
    },
  },
  {
    name: "study_status",
    description:
      "Read-only learner dashboard: lists available profiles, active goal progress by readiness, learner bookmark, open resumable sessions, active study focus, due FSRS reviews, active weaknesses, recent revision notes, and metacognitive reliance summary.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        profile: { type: "string" },
        dbPath: { type: "string" },
        goalId: { type: "string" },
        now: { type: "string" },
      },
    },
  },
  {
    name: "study_notes",
    description:
      "Read or save evidence-grounded revision notes and objective evidence receipts: action='get_context' | 'save' | 'list' | 'get' | 'evidence_receipt'.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      allOf: [
        {
          if: { properties: { action: { const: "get_context" } }, required: ["action"] },
          then: { required: ["scope"] },
        },
        {
          if: { properties: { action: { const: "save" } }, required: ["action"] },
          then: { required: ["scope", "markdown"] },
        },
        {
          if: { properties: { action: { const: "get" } }, required: ["action"] },
          then: { required: ["noteId"] },
        },
        {
          if: { properties: { action: { const: "evidence_receipt" } }, required: ["action"] },
          then: { required: ["objectiveId"] },
        },
      ],
      properties: {
        profile: { type: "string" },
        dbPath: { type: "string" },
        action: { type: "string", enum: [...STUDY_NOTES_ACTIONS] },
        scope: { type: "object" },
        title: { type: "string" },
        markdown: { type: "string" },
        noteId: { type: "string" },
        objectiveId: { type: "string" },
        maxInteractions: { type: "integer", minimum: 1 },
      },
    },
  },
];

export interface RelianceSummary {
  totalGradableEvidence: number;
  cleanIndependentCorrect: number;
  assistedOrHinted: number;
  independentSuccessRate: number | null;
}

function computeRelianceSummary(db: Database.Database, objectiveId?: string): RelianceSummary {
  const whereObjective = objectiveId ? "AND evidence.objective_id = ?" : "";
  const sql = `
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN evidence.retrieval_valid = 1 AND evidence.hint_level = 0 AND evidence.result = 'correct' THEN 1 ELSE 0 END), 0) AS clean_independent,
      COALESCE(SUM(CASE WHEN evidence.retrieval_valid = 0 OR evidence.hint_level > 0 THEN 1 ELSE 0 END), 0) AS assisted
    FROM evidence_events evidence
    WHERE evidence.result <> 'ungradable'
      ${whereObjective}
      AND COALESCE((
        SELECT revision.action
        FROM evidence_revisions revision
        WHERE revision.evidence_event_id = evidence.id
        ORDER BY revision.seq DESC
        LIMIT 1
      ), 'restore') <> 'invalidate'
  `;
  const row = (objectiveId ? db.prepare(sql).get(objectiveId) : db.prepare(sql).get()) as {
    total: number;
    clean_independent: number;
    assisted: number;
  };
  return {
    totalGradableEvidence: row.total,
    cleanIndependentCorrect: row.clean_independent,
    assistedOrHinted: row.assisted,
    independentSuccessRate:
      row.total === 0 ? null : Number((row.clean_independent / row.total).toFixed(2)),
  };
}

function openTargetDatabase(
  selector: { profile?: string; dbPath?: string },
  context: McpToolRuntimeContext,
): { db: Database.Database; resolvedProfileId: string | null } {
  if (selector.profile && selector.dbPath) {
    throw new OperationError("INVALID_ARGUMENT", "Use either profile or dbPath, not both.");
  }
  if (selector.dbPath && context.allowDbPath === false) {
    throw new OperationError(
      "INVALID_ARGUMENT",
      "Direct dbPath access is disabled on this remote MCP endpoint; specify a managed profile ID instead.",
    );
  }
  const dataDir = context.dataDir ?? DEFAULT_DATA_DIR;
  if (selector.dbPath) {
    return { db: createDatabase(selector.dbPath), resolvedProfileId: null };
  }
  const active = selector.profile ? null : getActiveProfile({ dataDir });
  const db = openProfileDatabase(selector.profile, { dataDir });
  return { db, resolvedProfileId: selector.profile ?? active?.id ?? null };
}

function resolveSingleGoalIdOrThrow(db: Database.Database, explicitGoalId?: string): string {
  if (explicitGoalId) {
    if (!getGoal(db, explicitGoalId)) {
      throw new OperationError("INVALID_ARGUMENT", `Goal not found: ${explicitGoalId}`);
    }
    return explicitGoalId;
  }
  const goals = db.prepare(`SELECT id FROM goals ORDER BY confirmed_at DESC, id`).all() as Array<{
    id: string;
  }>;
  if (goals.length === 1) return goals[0]!.id;
  if (goals.length > 1) {
    throw new OperationError(
      "INVALID_ARGUMENT",
      `Multiple goals found (${goals.map((g) => g.id).join(", ")}); specify goalId.`,
    );
  }
  throw new OperationError("INVALID_ARGUMENT", "No goals found in this profile.");
}

function stripQuestionSuffix(publicPrompt: string, question: string): string {
  const suffix = `\n\n${question}`;
  if (publicPrompt.endsWith(suffix)) {
    const trimmed = publicPrompt.slice(0, -suffix.length).trim();
    if (trimmed.length > 0) return trimmed;
  }
  return publicPrompt;
}

function handleStudyNext(
  rawArgs: unknown,
  context: McpToolRuntimeContext,
): Record<string, unknown> {
  const input = parseRequestInput(StudyNextInputSchema, rawArgs ?? {}, { label: "study_next" });
  if (input.autoOpenCalibrated && input.challengeSpec) {
    throw new OperationError(
      "INVALID_ARGUMENT",
      "Use either autoOpenCalibrated or challengeSpec, not both.",
    );
  }
  if (input.challengeSpec && !input.promptText) {
    throw new OperationError(
      "INVALID_ARGUMENT",
      "promptText is required when providing challengeSpec.",
    );
  }
  const knowledgeRoot = context.knowledgeRoot ?? DEFAULT_KNOWLEDGE_ROOT;
  const { db, resolvedProfileId } = openTargetDatabase(input, context);
  try {
    const kernel = createTeacherKernel(db, { knowledgeRoot });

    if (input.activateBankItemId) {
      const targetGoalId =
        input.goalId ??
        (() => {
          const goals = kernel.listGoals();
          return goals.length === 1 ? goals[0]!.id : undefined;
        })();
      const activated = kernel.activateQuestionBankItem({
        itemId: input.activateBankItemId,
        goalId: targetGoalId,
      });
      return {
        profile: resolvedProfileId,
        kind: "bank_item_activated",
        activated,
      };
    }

    const continuation = kernel.getStudyContinuation({
      goalId: input.goalId,
      now: input.now,
      availableMinutes: input.availableMinutes,
      oneEpisode: input.oneEpisode,
      resumeParked: input.resumeParked,
      practicalWork: input.practicalWork,
      retestEligibleWeaknessKeys: input.retestEligibleWeaknessKeys,
      mainDeliveryContext: input.mainDeliveryContext,
      transferDeliveryContext: input.transferDeliveryContext,
    });

    if (continuation.kind !== "recommend") {
      return {
        profile: resolvedProfileId,
        continuation,
      };
    }

    const intent = continuation.item.intent;
    const calibratedMatch = findCalibratedPredictionCase(
      knowledgeRoot,
      intent,
      kernel.getChallenge,
    );
    const availableScaffolds = kernel
      .listScaffoldPacks()
      .filter(
        (pack) =>
          pack.objective.conceptId === intent.conceptId &&
          pack.objective.capabilityId === intent.capabilityId,
      );

    if (input.autoOpenCalibrated && calibratedMatch) {
      const challengeId = `calibrated:${calibratedMatch.packId}:${calibratedMatch.caseId}:${randomUUID().slice(0, 8)}`;
      const pack = loadCalibratedPredictionPack(knowledgeRoot, calibratedMatch.packId);
      const itemCase = pack.cases.find((c) => c.id === calibratedMatch.caseId)!;
      const built = buildCalibratedPredictionChallenge({
        knowledgeRoot,
        packId: calibratedMatch.packId,
        intent,
        caseId: calibratedMatch.caseId,
        challengeId,
        timeBudgetMinutes: continuation.item.minutes || undefined,
      });
      const opened = db.transaction(() => {
        const challenge = kernel.registerChallenge(built.challenge, intent);
        const session = kernel.createSession(
          intent.goalId,
          intent.deliveryContext,
          continuation.practicalWork.preference,
        );
        const attemptResult = kernel.openAttempt(challenge.id, challenge.version, session.id);
        const subquestion = kernel.openAttemptSubquestion(attemptResult.attempt.id, {
          contextText: stripQuestionSuffix(challenge.publicPrompt, itemCase.question),
          promptText: itemCase.question,
          questionChunking: "default",
        });
        return {
          session,
          attempt: attemptResult.attempt,
          challenge,
          subquestion,
          presentation: kernel.getSessionQuestionPresentation(session.id),
          feedback: kernel.getSessionFeedback(session.id),
        };
      })();

      return {
        profile: resolvedProfileId,
        kind: "opened",
        calibratedMatch,
        availableScaffolds,
        intent,
        ...opened,
        teacherOnlyCalibration: built.calibration,
      };
    }

    if (input.challengeSpec) {
      const opened = db.transaction(() => {
        const challenge = kernel.registerChallenge(input.challengeSpec!, intent);
        const session = kernel.createSession(
          intent.goalId,
          intent.deliveryContext,
          continuation.practicalWork.preference,
        );
        const attemptResult = kernel.openAttempt(challenge.id, challenge.version, session.id);
        const subquestion = kernel.openAttemptSubquestion(attemptResult.attempt.id, {
          contextText: input.contextText ?? challenge.publicPrompt,
          promptText: input.promptText!,
          questionChunking: "default",
        });
        return {
          session,
          attempt: attemptResult.attempt,
          challenge,
          subquestion,
          presentation: kernel.getSessionQuestionPresentation(session.id),
          feedback: kernel.getSessionFeedback(session.id),
        };
      })();

      return {
        profile: resolvedProfileId,
        kind: "opened",
        calibratedMatch,
        availableScaffolds,
        intent,
        ...opened,
      };
    }

    return {
      profile: resolvedProfileId,
      continuation,
      calibratedMatch,
      availableScaffolds,
    };
  } finally {
    db.close();
  }
}

function handleStudySubmit(
  rawArgs: unknown,
  context: McpToolRuntimeContext,
): Record<string, unknown> {
  const input = parseRequestInput(StudySubmitInputSchema, rawArgs ?? {}, {
    label: "study_submit",
    actionKey: "action",
    allowedActions: STUDY_SUBMIT_ACTIONS,
  });
  const knowledgeRoot = context.knowledgeRoot ?? DEFAULT_KNOWLEDGE_ROOT;
  const { db, resolvedProfileId } = openTargetDatabase(input, context);
  try {
    const kernel = createTeacherKernel(db, { knowledgeRoot });
    switch (input.action) {
      case "verify": {
        let attempt = getAttempt(db, input.attemptId);
        if (!attempt) {
          throw new OperationError("INVALID_ARGUMENT", `Attempt not found: ${input.attemptId}`);
        }
        if (attempt.challenge_id === null || attempt.challenge_version === null) {
          throw new OperationError("INVALID_ARGUMENT", `Attempt ${input.attemptId} has no frozen challenge.`);
        }
        const challengeId = attempt.challenge_id;
        const challengeVersion = attempt.challenge_version;
        const alreadySubmitted = attempt.submitted_at !== null;
        if (alreadySubmitted) {
          if (input.responseText !== undefined && input.responseText !== attempt.response_text) {
            throw new OperationError(
              "INVALID_ARGUMENT",
              "Attempt is already submitted; omit responseText or match the stored response when verifying submitted work.",
            );
          }
          if (input.artifactRef !== undefined && !isDeepStrictEqual(input.artifactRef, attempt.artifact_ref_json)) {
            throw new OperationError(
              "INVALID_ARGUMENT",
              "Attempt is already submitted; omit artifactRef or match the stored artifact when verifying submitted work.",
            );
          }
        } else {
          if (!input.responseText && !input.artifactRef) {
            throw new OperationError(
              "INVALID_ARGUMENT",
              "Commit the learner's response (responseText or artifactRef) before running verification.",
            );
          }
          attempt = kernel.submitAttempt(input.attemptId, {
            responseText: input.responseText,
            questionSeq: input.questionSeq,
            activeTimeSeconds: input.activeTimeSeconds,
            artifactRef: input.artifactRef,
          });
        }
        const challenge = kernel.getChallenge(challengeId, challengeVersion);
        if (!challenge) {
          throw new OperationError("INVALID_ARGUMENT", `Frozen challenge not found for attempt ${input.attemptId}.`);
        }
        const verified = verifyPackagedPredictionChallenge(knowledgeRoot, challenge);
        return {
          profile: resolvedProfileId,
          action: "verify",
          attemptId: attempt.id,
          alreadySubmitted,
          packId: verified.packId,
          caseId: verified.caseId,
          verificationOutput: verified.verificationOutput,
        };
      }
      case "assess": {
        const existingAttempt = getAttempt(db, input.attemptId);
        if (!existingAttempt) {
          throw new OperationError("INVALID_ARGUMENT", `Attempt not found: ${input.attemptId}`);
        }
        let result: ReturnType<typeof kernel.submitAndAssess>;
        if (existingAttempt.submitted_at !== null) {
          if (
            input.responseText !== undefined &&
            input.responseText !== existingAttempt.response_text
          ) {
            throw new OperationError(
              "INVALID_ARGUMENT",
              "Attempt is already submitted; omit responseText or match the stored response when assessing submitted work.",
            );
          }
          if (
            input.artifactRef !== undefined &&
            !isDeepStrictEqual(input.artifactRef, existingAttempt.artifact_ref_json)
          ) {
            throw new OperationError(
              "INVALID_ARGUMENT",
              "Attempt is already submitted; omit artifactRef or match the stored artifact when assessing submitted work.",
            );
          }
          result = db.transaction(() => {
            const assessed = kernel.recordAssessment(input.attemptId, input.assessment);
            let feedbackClosed = false;
            if (input.closeIfComplete && existingAttempt.session_id !== null) {
              const fb = kernel.getSessionFeedback(existingAttempt.session_id);
              if (fb.nextAction === "complete_feedback") {
                kernel.completeSessionFeedback(existingAttempt.session_id, {
                  activeTimeSeconds: input.activeTimeSeconds,
                });
                feedbackClosed = true;
              }
            }
            const refreshed = getAttempt(db, input.attemptId)!;
            return { attempt: refreshed, ...assessed, feedbackClosed };
          })();
        } else {
          if (!input.responseText && !input.artifactRef) {
            throw new OperationError(
              "INVALID_ARGUMENT",
              "responseText or artifactRef is required when submitting and assessing an unsubmitted attempt.",
            );
          }
          result = kernel.submitAndAssess(input.attemptId, {
            closeIfComplete: input.closeIfComplete,
            response: {
              responseText: input.responseText,
              questionSeq: input.questionSeq,
              activeTimeSeconds: input.activeTimeSeconds,
              artifactRef: input.artifactRef,
            },
            assessment: input.assessment,
          });
        }
        const feedback =
          result.attempt.session_id !== null
            ? kernel.getSessionFeedback(result.attempt.session_id)
            : null;
        const primaryObjectiveId = input.assessment.objectiveResults[0]?.objectiveId;
        const primaryResult = input.assessment.objectiveResults[0]?.result ?? null;
        return {
          profile: resolvedProfileId,
          action: "assess",
          ...result,
          feedback,
          relianceSummary: computeRelianceSummary(db, primaryObjectiveId),
          confidenceGuidance: deriveConfidenceFeedbackDirective(
            input.learnerConfidence as LearnerConfidence | undefined,
            primaryResult,
          ),
        };
      }
      case "revise": {
        const revised = kernel.reviseEvidence(input.evidenceEventId, {
          action: input.revisionAction,
          reason: input.reason,
          correctedObjectiveResult: input.correctedObjectiveResult,
        });
        return {
          profile: resolvedProfileId,
          action: "revise",
          ...revised,
        };
      }
      case "teach_first": {
        const teaching = kernel.recordTeachingRequest(input.sessionId, {
          attemptId: input.attemptId,
          learnerRequestText: input.learnerRequestText,
          objectiveIds: input.objectiveIds,
          exposureType: input.exposureType,
          sourceRef: input.sourceRef,
          teachingMaterial: { content: input.content, format: input.format },
        });
        return {
          profile: resolvedProfileId,
          action: "teach_first",
          ...teaching,
        };
      }
      case "clarify": {
        const subquestion = kernel.answerAttemptSubquestion(input.attemptId, {
          seq: input.seq,
          responseText: input.responseText,
          followUpQuestion: input.followUpQuestion,
        });
        return {
          profile: resolvedProfileId,
          action: "clarify",
          subquestion,
        };
      }
      case "split": {
        const subquestion = kernel.replaceAttemptSubquestion(input.attemptId, {
          seq: input.seq,
          promptText: input.promptText,
          questionChunking: "atomic",
          scopeCriterionId: input.scopeCriterionId,
          scopeNote: input.scopeNote,
        });
        return {
          profile: resolvedProfileId,
          action: "split",
          subquestion,
        };
      }
      case "reconstruct": {
        const session =
          input.outcome === "completed"
            ? kernel.resolveSessionReconstruction(input.sessionId, {
                outcome: "completed",
                responseText: input.responseText,
                questionSeq: input.questionSeq,
                activeTimeSeconds: input.activeTimeSeconds,
              })
            : kernel.resolveSessionReconstruction(input.sessionId, {
                outcome: "opted_out",
                activeTimeSeconds: input.activeTimeSeconds,
              });
        return {
          profile: resolvedProfileId,
          action: "reconstruct",
          session,
        };
      }
      case "close_feedback": {
        const session = kernel.completeSessionFeedback(input.sessionId, {
          activeTimeSeconds: input.activeTimeSeconds,
        });
        return {
          profile: resolvedProfileId,
          action: "close_feedback",
          session,
        };
      }
      case "park": {
        const goalId = resolveSingleGoalIdOrThrow(db, input.goalId);
        let sessionId = input.sessionId ?? null;
        if (sessionId === null) {
          const open = kernel.listResumableSessions(goalId);
          sessionId = open[0]?.session.id ?? null;
        }
        const bookmark = kernel.setGoalBookmark(goalId, {
          parkedSessionId: sessionId,
          note: input.note,
          nextMove: input.nextMove,
        });
        return {
          profile: resolvedProfileId,
          action: "park",
          bookmark,
        };
      }
      case "unpark": {
        const goalId = resolveSingleGoalIdOrThrow(db, input.goalId);
        const bookmark = kernel.setGoalBookmark(goalId, {
          parkedSessionId: null,
          note: input.note,
          nextMove: input.nextMove,
        });
        return {
          profile: resolvedProfileId,
          action: "unpark",
          bookmark,
        };
      }
      case "abandon": {
        const session = kernel.abandonUnsubmittedSession(input.sessionId);
        return {
          profile: resolvedProfileId,
          action: "abandon",
          session,
        };
      }
    }
  } finally {
    db.close();
  }
}

function handleStudyHelp(
  rawArgs: unknown,
  context: McpToolRuntimeContext,
): Record<string, unknown> {
  const input = parseRequestInput(StudyHelpInputSchema, rawArgs ?? {}, {
    label: "study_help",
    actionKey: "kind",
    allowedActions: STUDY_HELP_KINDS,
  });
  const knowledgeRoot = context.knowledgeRoot ?? DEFAULT_KNOWLEDGE_ROOT;
  const { db, resolvedProfileId } = openTargetDatabase(input, context);
  try {
    const kernel = createTeacherKernel(db, { knowledgeRoot });
    switch (input.kind) {
      case "exposure": {
        const exposures = kernel.recordExposure(input.sessionId, {
          attemptId: input.attemptId,
          objectiveIds: input.objectiveIds,
          exposureType: input.exposureType,
          sourceRef: input.sourceRef,
          teachingMaterial: { content: input.content, format: input.format },
          requireReconstruction: input.requireReconstruction,
          reconstructionQuestion: input.reconstructionQuestion,
        });
        const presentation =
          input.sessionId !== null
            ? kernel.getSessionQuestionPresentation(input.sessionId)
            : null;
        return {
          profile: resolvedProfileId,
          kind: "exposure",
          exposures,
          presentation,
        };
      }
      case "scaffold": {
        const presented = kernel.prepareScaffoldPresentation(input.sessionId, {
          packId: input.packId,
          stage: input.stage,
          requireReconstruction: input.requireReconstruction,
        });
        return {
          profile: resolvedProfileId,
          kind: "scaffold",
          ...presented,
        };
      }
      case "hint": {
        const observation = kernel.recordHintUse(input.attemptId, {
          level: input.level,
          scope: input.scope,
        });
        return {
          profile: resolvedProfileId,
          kind: "hint",
          observation,
        };
      }
    }
  } finally {
    db.close();
  }
}

function handleStudyStatus(
  rawArgs: unknown,
  context: McpToolRuntimeContext,
): Record<string, unknown> {
  const input = parseRequestInput(StudyStatusInputSchema, rawArgs ?? {}, { label: "study_status" });
  const knowledgeRoot = context.knowledgeRoot ?? DEFAULT_KNOWLEDGE_ROOT;
  const dataDir = context.dataDir ?? DEFAULT_DATA_DIR;
  const now = input.now ?? new Date().toISOString();

  let profiles: Array<{ id: string; displayName: string; isActive: boolean }> = [];
  let activeProfileId: string | null = null;
  if (!input.dbPath) {
    try {
      activeProfileId = getActiveProfile({ dataDir })?.id ?? null;
      const listed = listProfiles({ dataDir });
      profiles = listed.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isActive: p.id === activeProfileId,
      }));
    } catch {
      profiles = [];
    }
  }

  const { db, resolvedProfileId } = openTargetDatabase(input, context);
  try {
    const kernel = createTeacherKernel(db, { knowledgeRoot });
    const contexts = kernel.listPreparationContexts();
    const activeGoal = input.goalId
      ? contexts.find((c) => c.goalId === input.goalId) ?? kernel.getPreparationContext(input.goalId)
      : contexts[0] ?? null;

    const openSessions = kernel.listResumableSessions(activeGoal?.goalId).map((entry) => ({
      sessionId: entry.session.id,
      goalId: entry.session.goal_id,
      mode: entry.session.mode,
      phase: entry.phase,
      pendingAction: entry.pendingAction,
      reconstructionRequired: entry.reconstructionRequired,
      activeAttemptId: entry.activeAttempt?.id ?? null,
    }));

    const activeObjectives = activeGoal?.objectives.filter((obj) => obj.isActive) ?? [];
    const byReadiness: Record<string, number> = {
      unknown: 0,
      exposed: 0,
      guided: 0,
      independent: 0,
    };
    for (const obj of activeObjectives) {
      byReadiness[obj.readiness] = (byReadiness[obj.readiness] ?? 0) + 1;
    }

    const dueObjectives = getDueObjectives(db, { asOf: now }).map((due) => ({
      objectiveId: due.objectiveId,
      conceptId: due.conceptId,
      capabilityId: due.capabilityId,
      dueAt: due.dueAt,
      lastRating: due.card.last_rating,
    }));

    const activeWeaknesses = db
      .prepare(
        `SELECT objective_id, key, category, lifecycle
         FROM weakness_projections
         WHERE lifecycle <> 'resolved'
         ORDER BY lifecycle, objective_id, category
         LIMIT 20`,
      )
      .all() as Array<{
        objective_id: string;
        key: string;
        category: string;
        lifecycle: string;
      }>;

    const recentRevisionNotes = kernel.listRevisionNotes().slice(0, 5).map((note) => ({
      id: note.id,
      scopeKind: note.scope.kind,
      title: note.title,
      generatedAt: note.generatedAt,
      stale: note.stale,
    }));

    const bookmark = activeGoal ? getGoalBookmark(db, activeGoal.goalId) : null;

    return {
      profiles,
      activeProfileId,
      profile: resolvedProfileId,
      now,
      goal: activeGoal
        ? {
            goalId: activeGoal.goalId,
            goalName: activeGoal.goalName,
            targetOutcome: activeGoal.targetOutcome,
            deadlineAt: activeGoal.deadlineAt,
            studyFocus: activeGoal.studyFocus,
            bookmark,
            totalActiveObjectives: activeObjectives.length,
            byReadiness,
          }
        : null,
      openSessions,
      dueCount: dueObjectives.length,
      dueObjectives,
      activeWeaknesses,
      reliance: computeRelianceSummary(db),
      recentRevisionNotes,
    };
  } finally {
    db.close();
  }
}

function handleStudyNotes(
  rawArgs: unknown,
  context: McpToolRuntimeContext,
): Record<string, unknown> {
  const input = parseRequestInput(StudyNotesInputSchema, rawArgs ?? {}, {
    label: "study_notes",
    actionKey: "action",
    allowedActions: STUDY_NOTES_ACTIONS,
  });
  const knowledgeRoot = context.knowledgeRoot ?? DEFAULT_KNOWLEDGE_ROOT;
  const { db, resolvedProfileId } = openTargetDatabase(input, context);
  try {
    const kernel = createTeacherKernel(db, { knowledgeRoot });
    switch (input.action) {
      case "get_context":
        return {
          profile: resolvedProfileId,
          context: kernel.getRevisionNoteContext({
            scope: input.scope,
            maxInteractions: input.maxInteractions,
          }),
        };
      case "save": {
        const noteContext = kernel.getRevisionNoteContext({
          scope: input.scope,
          maxInteractions: input.maxInteractions,
        });
        return {
          profile: resolvedProfileId,
          note: kernel.saveRevisionNote({
            context: noteContext,
            title: input.title,
            markdown: input.markdown,
          }),
        };
      }
      case "list":
        return {
          profile: resolvedProfileId,
          notes: kernel.listRevisionNotes(),
        };
      case "get":
        return {
          profile: resolvedProfileId,
          note: kernel.getRevisionNote(input.noteId) ?? null,
        };
      case "evidence_receipt":
        return {
          profile: resolvedProfileId,
          receipt: kernel.getObjectiveEvidenceReceipt(input.objectiveId),
        };
    }
  } finally {
    db.close();
  }
}

export function callLearningOsTool(
  name: string,
  rawArgs: unknown,
  context: McpToolRuntimeContext = {},
): Record<string, unknown> {
  switch (name) {
    case "study_next":
      return handleStudyNext(rawArgs, context);
    case "study_submit":
      return handleStudySubmit(rawArgs, context);
    case "study_help":
      return handleStudyHelp(rawArgs, context);
    case "study_status":
      return handleStudyStatus(rawArgs, context);
    case "study_notes":
      return handleStudyNotes(rawArgs, context);
    default:
      throw new OperationError("UNKNOWN_TOOL", `Unknown Learning OS MCP tool: ${name}`);
  }
}
