import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { z } from "zod";
import { createDatabase } from "../db/database.js";
import {
  AssessmentResultSchema,
  ChallengeSpecSchema,
  DeliveryContext,
  ExposureType,
  HintScopeSchema,
  PracticalWorkPreference,
  TeachingArtifactFormat,
} from "../db/types.js";
import { OperationError } from "../errors.js";
import {
  buildCalibratedPredictionChallenge,
  findCalibratedPredictionCase,
  loadCalibratedPredictionPack,
} from "../knowledge/challenge-calibration.js";
import { ScaffoldStageSchema } from "../knowledge/scaffolds.js";
import { getActiveProfile, listProfiles, openProfileDatabase } from "../profile/index.js";
import { getDueObjectives } from "../scheduler/index.js";
import { createTeacherKernel } from "../teacher.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolRuntimeContext {
  dataDir?: string;
  knowledgeRoot?: string;
}

const DEFAULT_KNOWLEDGE_ROOT = fileURLToPath(new URL("../../knowledge", import.meta.url));
const DEFAULT_DATA_DIR = fileURLToPath(new URL("../../data", import.meta.url));

const DbSelectorFields = {
  profile: z.string().min(1).optional(),
  dbPath: z.string().min(1).optional(),
};

const SubquestionInputSchema = z.union([
  z.object({
    promptText: z.string().min(1),
    contextText: z.string().min(1).optional(),
    questionChunking: z.literal("default").optional(),
  }).strict(),
  z.object({
    promptText: z.string().min(1),
    contextText: z.string().min(1).optional(),
    questionChunking: z.literal("atomic"),
    scopeCriterionId: z.string().min(1),
    scopeNote: z.string().min(1),
  }).strict(),
]);

const StudyNextInputSchema = z.object({
  ...DbSelectorFields,
  goalId: z.string().min(1).optional(),
  now: z.string().min(1).optional(),
  availableMinutes: z.number().int().positive().optional(),
  oneEpisode: z.boolean().optional(),
  practicalWork: PracticalWorkPreference.optional(),
  retestEligibleWeaknessKeys: z.array(z.string().min(1)).optional(),
  mainDeliveryContext: DeliveryContext.optional(),
  transferDeliveryContext: DeliveryContext.optional(),
  autoOpenCalibrated: z.boolean().optional(),
  challengeSpec: ChallengeSpecSchema.optional(),
  promptText: z.string().min(1).optional(),
  contextText: z.string().min(1).optional(),
}).strict();

const StudySubmitInputSchema = z.discriminatedUnion("action", [
  z.object({
    ...DbSelectorFields,
    action: z.literal("assess"),
    attemptId: z.number().int().positive(),
    responseText: z.string().min(1),
    questionSeq: z.number().int().positive().optional(),
    activeTimeSeconds: z.number().int().nonnegative().optional(),
    artifactRef: z.record(z.string(), z.unknown()).optional(),
    assessment: AssessmentResultSchema,
    closeIfComplete: z.boolean().default(true),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("clarify"),
    attemptId: z.number().int().positive(),
    seq: z.number().int().positive(),
    responseText: z.string().min(1),
    followUpQuestion: SubquestionInputSchema,
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("split"),
    attemptId: z.number().int().positive(),
    seq: z.number().int().positive(),
    promptText: z.string().min(1),
    scopeCriterionId: z.string().min(1),
    scopeNote: z.string().min(1),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("reconstruct"),
    sessionId: z.number().int().positive(),
    outcome: z.enum(["completed", "opted_out"]),
    responseText: z.string().min(1).optional(),
    questionSeq: z.number().int().positive().optional(),
    activeTimeSeconds: z.number().int().nonnegative().optional(),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("close_feedback"),
    sessionId: z.number().int().positive(),
    activeTimeSeconds: z.number().int().nonnegative().optional(),
  }).strict(),
]);

const StudyHelpInputSchema = z.discriminatedUnion("kind", [
  z.object({
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
  }).strict(),
  z.object({
    ...DbSelectorFields,
    kind: z.literal("scaffold"),
    sessionId: z.number().int().positive(),
    packId: z.string().min(1),
    stage: ScaffoldStageSchema,
    requireReconstruction: z.boolean().optional(),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    kind: z.literal("hint"),
    attemptId: z.number().int().positive(),
    level: z.number().int().min(1).max(5),
    scope: HintScopeSchema,
  }).strict(),
]);

const StudyStatusInputSchema = z.object({
  ...DbSelectorFields,
  goalId: z.string().min(1).optional(),
  now: z.string().min(1).optional(),
}).strict();

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
  z.object({
    ...DbSelectorFields,
    action: z.literal("get_context"),
    scope: RevisionNoteScopeSchema,
    maxInteractions: z.number().int().positive().optional(),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("save"),
    scope: RevisionNoteScopeSchema,
    title: z.string().min(1).optional(),
    markdown: z.string().min(1),
    maxInteractions: z.number().int().positive().optional(),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("list"),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("get"),
    noteId: z.string().min(1),
  }).strict(),
  z.object({
    ...DbSelectorFields,
    action: z.literal("evidence_receipt"),
    objectiveId: z.string().min(1),
  }).strict(),
]);

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "study_next",
    description:
      "Resume an active Learning OS session/question/reconstruction or get the next evidence-driven recommendation. Defaults goalId and now automatically. Read-only unless autoOpenCalibrated=true or challengeSpec is provided, in which case challenge registration, session creation, attempt opening, and first subquestion happen atomically in one transaction.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        profile: { type: "string", description: "Managed profile ID (defaults to active profile)." },
        dbPath: { type: "string", description: "Direct SQLite DB path (mutually exclusive with profile)." },
        goalId: { type: "string", description: "Optional goal topic ID (auto-resolved when sole goal)." },
        now: { type: "string", description: "Optional ISO-8601 instant (defaults to current time)." },
        availableMinutes: { type: "integer", minimum: 1, description: "Remaining active study minutes (mutually exclusive with oneEpisode)." },
        oneEpisode: { type: "boolean", description: "Select exactly one episode without inventing a time budget." },
        practicalWork: { type: "string", enum: ["ask_first", "conversation_only"] },
        retestEligibleWeaknessKeys: { type: "array", items: { type: "string" } },
        mainDeliveryContext: { type: "string", enum: ["learn", "practice", "review", "interview", "mock"] },
        transferDeliveryContext: { type: "string", enum: ["learn", "practice", "review", "interview", "mock"] },
        autoOpenCalibrated: {
          type: "boolean",
          description: "When true and recommendation matches a calibrated pack, atomically register challenge, create session, open attempt, and open the first subquestion.",
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
      "Handle learner turn transitions in one atomic call: action='assess' (submit verbatim answer, grade criteria, auto-close if complete), 'clarify' (preserve ambiguous answer and ask neutral follow-up), 'split' (replace pending question with atomic criterion-scoped step), 'reconstruct' (complete or opt out of pending reconstruction), or 'close_feedback' (close complete_feedback or learner-declined review_gap).",
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        profile: { type: "string" },
        dbPath: { type: "string" },
        action: { type: "string", enum: ["assess", "clarify", "split", "reconstruct", "close_feedback"] },
        attemptId: { type: "integer", minimum: 1 },
        sessionId: { type: "integer", minimum: 1 },
        seq: { type: "integer", minimum: 1 },
        questionSeq: { type: "integer", minimum: 1 },
        responseText: { type: "string", description: "Verbatim learner text with zero edits." },
        activeTimeSeconds: { type: "integer", minimum: 0 },
        artifactRef: { type: "object" },
        assessment: { type: "object", description: "AssessmentResult object for action='assess'." },
        closeIfComplete: { type: "boolean", default: true },
        followUpQuestion: { type: "object", description: "Neutral clarification subquestion for action='clarify'." },
        promptText: { type: "string", description: "Single-step prompt for action='split'." },
        scopeCriterionId: { type: "string", description: "Frozen criterion ID for action='split'." },
        scopeNote: { type: "string", description: "What a sufficient answer demonstrates for action='split'." },
        outcome: { type: "string", enum: ["completed", "opted_out"], description: "Reconstruction outcome for action='reconstruct'." },
      },
    },
  },
  {
    name: "study_help",
    description:
      "Pre-display boundary for all answer-bearing teaching help: kind='exposure' (record corrective feedback, explanation, worked example, or answer reveal—optionally with atomic reconstructionQuestion), kind='scaffold' (persist and return a curated worked_example or completion pack), or kind='hint' (record scoped hint level L1-L5).",
    inputSchema: {
      type: "object",
      required: ["kind"],
      properties: {
        profile: { type: "string" },
        dbPath: { type: "string" },
        kind: { type: "string", enum: ["exposure", "scaffold", "hint"] },
        sessionId: { type: ["integer", "null"], minimum: 1 },
        attemptId: { type: "integer", minimum: 1 },
        objectiveIds: { type: "array", items: { type: "string" } },
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
        content: { type: "string" },
        format: { type: "string", enum: ["text", "markdown"], default: "markdown" },
        sourceRef: { type: "string" },
        requireReconstruction: { type: "boolean" },
        reconstructionQuestion: { type: "object" },
        packId: { type: "string" },
        stage: { type: "string", enum: ["worked_example", "completion"] },
        level: { type: "integer", minimum: 1, maximum: 5 },
        scope: { type: "object" },
      },
    },
  },
  {
    name: "study_status",
    description:
      "Read-only learner dashboard: lists available profiles, active goal progress by readiness, open resumable sessions, active study focus, due FSRS reviews, active weaknesses, recent revision notes, and metacognitive reliance summary (clean independent vs. assisted evidence).",
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
      required: ["action"],
      properties: {
        profile: { type: "string" },
        dbPath: { type: "string" },
        action: { type: "string", enum: ["get_context", "save", "list", "get", "evidence_receipt"] },
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
  const dataDir = context.dataDir ?? DEFAULT_DATA_DIR;
  if (selector.dbPath) {
    return { db: createDatabase(selector.dbPath), resolvedProfileId: null };
  }
  const active = selector.profile ? null : getActiveProfile({ dataDir });
  const db = openProfileDatabase(selector.profile, { dataDir });
  return { db, resolvedProfileId: selector.profile ?? active?.id ?? null };
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
  const input = StudyNextInputSchema.parse(rawArgs ?? {});
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
    const continuation = kernel.getStudyContinuation({
      goalId: input.goalId,
      now: input.now,
      availableMinutes: input.availableMinutes,
      oneEpisode: input.oneEpisode,
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
  const input = StudySubmitInputSchema.parse(rawArgs ?? {});
  const knowledgeRoot = context.knowledgeRoot ?? DEFAULT_KNOWLEDGE_ROOT;
  const { db, resolvedProfileId } = openTargetDatabase(input, context);
  try {
    const kernel = createTeacherKernel(db, { knowledgeRoot });
    switch (input.action) {
      case "assess": {
        const result = kernel.submitAndAssess(input.attemptId, {
          closeIfComplete: input.closeIfComplete,
          response: {
            responseText: input.responseText,
            questionSeq: input.questionSeq,
            activeTimeSeconds: input.activeTimeSeconds,
            artifactRef: input.artifactRef,
          },
          assessment: input.assessment,
        });
        const feedback =
          result.attempt.session_id !== null
            ? kernel.getSessionFeedback(result.attempt.session_id)
            : null;
        const primaryObjectiveId = input.assessment.objectiveResults[0]?.objectiveId;
        return {
          profile: resolvedProfileId,
          action: "assess",
          ...result,
          feedback,
          relianceSummary: computeRelianceSummary(db, primaryObjectiveId),
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
        if (input.outcome === "completed" && !input.responseText) {
          throw new OperationError(
            "INVALID_ARGUMENT",
            "responseText is required when reconstruction outcome is 'completed'.",
          );
        }
        if (input.outcome === "opted_out" && input.responseText !== undefined) {
          throw new OperationError(
            "INVALID_ARGUMENT",
            "responseText must not be provided when reconstruction outcome is 'opted_out'.",
          );
        }
        const session =
          input.outcome === "completed"
            ? kernel.resolveSessionReconstruction(input.sessionId, {
                outcome: "completed",
                responseText: input.responseText!,
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
    }
  } finally {
    db.close();
  }
}

function handleStudyHelp(
  rawArgs: unknown,
  context: McpToolRuntimeContext,
): Record<string, unknown> {
  const input = StudyHelpInputSchema.parse(rawArgs ?? {});
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
  const input = StudyStatusInputSchema.parse(rawArgs ?? {});
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
      goalId: entry.session.topic_id,
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
  const input = StudyNotesInputSchema.parse(rawArgs ?? {});
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
