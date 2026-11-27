import type Database from "better-sqlite3";
import {
  getGoal,
  getGoalBookmark,
  getGoalPreparation,
  getInteractionPreferences,
  getPracticalWorkPolicy,
} from "../db/database.js";
import type { GoalBookmark, PracticalWorkPolicy } from "../db/database.js";
import { PracticalWorkPreference } from "../db/types.js";
import type {
  ChallengeCriterion,
  DeliveryContext,
  VerificationBasis,
  VerificationOutput,
} from "../db/types.js";
import { getEffectiveEvidenceEventsByObjective } from "../kernel/evidence.js";
import { listResumableSessions } from "../kernel/foundation.js";
import type { ResumedSession } from "../kernel/foundation.js";
import { getSessionQuestionPresentation } from "../kernel/questions.js";
import type { QuestionPresentation } from "../kernel/questions.js";
import { getSessionFeedback } from "../kernel/feedback.js";
import type { SessionFeedback } from "../kernel/feedback.js";
import { getDurablePreparationContext } from "../onboarding/apply.js";
import { getTodayMission } from "../plan/today.js";
import type { DailyMission, DailyMissionItem, OneEpisodeMission } from "../plan/today.js";
import { derivePedagogyDirective } from "../teacher-pedagogy.js";
import type { PedagogyDirective } from "../teacher-pedagogy.js";

export interface StudyContinuationInput {
  /** Goal ID; when omitted, defaults to the profile's sole goal. */
  goalId?: string;
  /** Current ISO-8601 instant; defaults to current wall clock when omitted. */
  now?: string;
  availableMinutes?: number;
  /** Explicit one-episode request; mutually exclusive with availableMinutes. */
  oneEpisode?: boolean;
  /** When true, resume a parked unsubmitted session instead of bypassing it. */
  resumeParked?: boolean;
  /** Read-only planning choice before a session exists; save it when creating that session. */
  practicalWork?: PracticalWorkPreference;
  retestEligibleWeaknessKeys?: readonly string[];
  mainDeliveryContext?: DeliveryContext;
  transferDeliveryContext?: DeliveryContext;
  /** Optional knowledge root used to load manifest confusableWith links for discrimination hints. */
  knowledgeRoot?: string;
}

export type ContinuationActionId =
  | "verify"
  | "assess"
  | "revise"
  | "clarify"
  | "split"
  | "teach_first"
  | "park"
  | "unpark"
  | "abandon"
  | "exposure"
  | "reconstruct"
  | "close_feedback"
  | "finish_session"
  | "set_budget_or_one_episode"
  | "open_recommended_challenge"
  | "explain_no_action";

export interface SubmittedAttemptWork {
  attemptId: number;
  responseText: string | null;
  artifactRef: Record<string, unknown> | null;
  verificationOutput: VerificationOutput | null;
  submittedAt: string | null;
}

export interface AnsweredSubquestionSummary {
  seq: number;
  purpose: "response" | "reconstruction";
  promptText: string;
  responseText: string;
  answeredAt: string | null;
}

export interface PendingCorrectionTarget {
  objectiveId: string;
  latestEvidenceEventId: string;
}

export interface ResumeCommitment {
  sessionId: number;
  goalId: string;
  mode: DeliveryContext;
  attemptId: number | null;
  challengeId: string | null;
  challengeVersion: number | null;
  publicPrompt: string | null;
  objectiveIds: string[];
  phase: ResumedSession["phase"];
  pendingAction: ResumedSession["pendingAction"];
  nextFeedbackAction: SessionFeedback["nextAction"];
  reconstructionRequired: boolean;
  verificationRequired: boolean;
  verificationBasis: VerificationBasis | null;
  gradingBasis: VerificationBasis | null;
  hasAssistance: boolean;
  exposureCount: number;
  hintCount: number;
  pendingQuestionSeq: number | null;
  answeredSubquestions: AnsweredSubquestionSummary[];
  criteria: ChallengeCriterion[];
  /** True once the active attempt has been submitted (use `assess` without re-submitting responseText). */
  alreadySubmitted: boolean;
  /** Present once the learner has submitted work. */
  submittedWork?: SubmittedAttemptWork;
  /** Present when an assessed target was invalidated and must be revised rather than re-submitted. */
  correctionTargets?: PendingCorrectionTarget[];
}

export type StudyContinuation = {
  practicalWork: PracticalWorkPolicy | { preference: PracticalWorkPreference; source: "request" };
  bookmark: GoalBookmark | null;
  allowedActions: ContinuationActionId[];
} & (
  | {
      kind: "resume";
      commitment: ResumeCommitment;
      presentation: QuestionPresentation;
      feedback: SessionFeedback;
      additionalResumableSessionIds: number[];
    }
  | {
      kind: "needs_budget";
      goalId: string;
      suggestedMinutes: number | null;
    }
  | {
      kind: "recommend";
      mission: DailyMission | OneEpisodeMission;
      item: DailyMissionItem;
      pedagogy: PedagogyDirective;
    }
  | {
      kind: "no_action";
      mission: DailyMission | OneEpisodeMission;
    }
);

function resolveDefaultGoalId(db: Database.Database): string {
  const goals = db
    .prepare(`SELECT id FROM goals ORDER BY confirmed_at DESC, id`)
    .all() as Array<{ id: string }>;
  if (goals.length === 1) return goals[0]!.id;
  if (goals.length > 1) {
    throw new Error(
      `Multiple goals found (${goals.map((row) => row.id).join(", ")}); specify goalId.`,
    );
  }

  const activeGoals = db
    .prepare(`SELECT DISTINCT goal_id FROM goal_objectives WHERE is_active = 1 ORDER BY goal_id`)
    .all() as Array<{ goal_id: string }>;
  if (activeGoals.length === 1) return activeGoals[0]!.goal_id;
  if (activeGoals.length > 1) {
    throw new Error(
      `Multiple active goals found (${activeGoals.map((row) => row.goal_id).join(", ")}); specify goalId.`,
    );
  }

  throw new Error("No goals found in this profile; onboard a goal first.");
}

function findCorrectionTargets(
  db: Database.Database,
  attemptId: number,
  objectiveIds: readonly string[],
  effectiveObjectiveIds: ReadonlySet<string>,
): PendingCorrectionTarget[] {
  const missing = objectiveIds.filter((id) => !effectiveObjectiveIds.has(id));
  if (missing.length === 0) return [];
  const stmt = db.prepare(
    `SELECT id FROM evidence_events
     WHERE attempt_id = ? AND objective_id = ?
     ORDER BY seq DESC
     LIMIT 1`,
  );
  const targets: PendingCorrectionTarget[] = [];
  for (const objectiveId of missing) {
    const row = stmt.get(attemptId, objectiveId) as { id: string } | undefined;
    if (row) {
      targets.push({ objectiveId, latestEvidenceEventId: row.id });
    }
  }
  return targets;
}

function buildResumeCommitment(
  db: Database.Database,
  resumed: ResumedSession,
  presentation: QuestionPresentation,
  feedback: SessionFeedback,
): ResumeCommitment {
  const challenge = resumed.activeChallenge;
  const attempt = resumed.activeAttempt;
  const attemptState = resumed.activeAttemptState;
  const exposureCount = attemptState?.exposureEvents.length ?? 0;
  const hintCount = attemptState?.hintObservations.length ?? 0;
  const objectiveIds = challenge ? challenge.targets.map((target) => target.objectiveId) : [];
  const verificationRequired = challenge?.verification.required ?? false;
  const verificationBasis = challenge?.verification.basis ?? null;
  const gradingBasis: VerificationBasis | null = challenge
    ? challenge.gradingBasis ?? (verificationRequired ? challenge.verification.basis : "frozen_rubric")
    : null;

  const answeredSubquestions: AnsweredSubquestionSummary[] = (attemptState?.subquestions ?? [])
    .filter((q) => q.response_text !== null && q.superseded_at === null)
    .map((q) => ({
      seq: q.seq,
      purpose: q.purpose,
      promptText: q.prompt_text,
      responseText: q.response_text!,
      answeredAt: q.answered_at,
    }));

  const commitment: ResumeCommitment = {
    sessionId: resumed.session.id,
    goalId: resumed.session.goal_id,
    mode: resumed.session.mode,
    attemptId: attempt?.id ?? null,
    challengeId: challenge?.id ?? null,
    challengeVersion: challenge?.version ?? null,
    publicPrompt: challenge?.publicPrompt ?? null,
    objectiveIds,
    phase: resumed.phase,
    pendingAction: resumed.pendingAction,
    nextFeedbackAction: feedback.nextAction,
    reconstructionRequired: resumed.reconstructionRequired,
    verificationRequired,
    verificationBasis,
    gradingBasis,
    hasAssistance: exposureCount > 0 || hintCount > 0,
    exposureCount,
    hintCount,
    pendingQuestionSeq: presentation.kind === "question" ? presentation.seq : null,
    answeredSubquestions,
    criteria: challenge ? challenge.rubric.criteria : [],
    alreadySubmitted: attempt?.submitted_at !== null && attempt?.submitted_at !== undefined,
  };

  if (attempt && attempt.submitted_at !== null) {
    commitment.submittedWork = {
      attemptId: attempt.id,
      responseText: attempt.response_text,
      artifactRef: attempt.artifact_ref_json,
      verificationOutput: attempt.verification_output_json,
      submittedAt: attempt.submitted_at,
    };
    if (feedback.nextAction === "run_verification" || feedback.nextAction === "assess_response") {
      const effectiveSet = new Set(feedback.objectives.map((obj) => obj.objectiveId));
      const correctionTargets = findCorrectionTargets(db, attempt.id, objectiveIds, effectiveSet);
      if (correctionTargets.length > 0) {
        commitment.correctionTargets = correctionTargets;
      }
    }
  }

  return commitment;
}

function deriveResumeAllowedActions(
  commitment: ResumeCommitment,
  feedback: SessionFeedback,
): ContinuationActionId[] {
  switch (commitment.nextFeedbackAction) {
    case "collect_response":
      return ["assess", "clarify", "split", "teach_first", "park", "abandon"];
    case "run_verification":
    case "assess_response": {
      const hasExistingHistory =
        feedback.objectives.length > 0 || (commitment.correctionTargets?.length ?? 0) > 0;
      if (hasExistingHistory) return ["revise"];
      if (commitment.verificationRequired && !commitment.submittedWork?.verificationOutput) {
        return ["verify", "assess"];
      }
      return ["assess"];
    }
    case "review_gap":
      return ["exposure", "close_feedback"];
    case "reconstruct":
      return ["reconstruct"];
    case "complete_feedback":
    case "review_ungradable":
      return ["close_feedback"];
    case "none":
      return ["finish_session"];
  }
}

function hasNonEmptyBookmark(bookmark: GoalBookmark): boolean {
  return (
    bookmark.note !== null ||
    bookmark.nextMove !== null ||
    bookmark.parkedSessionId !== null
  );
}

export function getStudyContinuation(
  db: Database.Database,
  input: StudyContinuationInput = {},
): StudyContinuation {
  const goalId = input.goalId ?? resolveDefaultGoalId(db);
  const now = input.now ?? new Date().toISOString();
  const goal = getGoal(db, goalId);
  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`);
  }

  if (input.oneEpisode && input.availableMinutes !== undefined) {
    throw new Error("Choose oneEpisode or availableMinutes, not both");
  }
  const requestedPracticalWork =
    input.practicalWork === undefined
      ? undefined
      : PracticalWorkPreference.parse(input.practicalWork);

  const rawBookmark = getGoalBookmark(db, goalId);
  const bookmark = hasNonEmptyBookmark(rawBookmark) ? rawBookmark : null;
  const parkedId = rawBookmark.parkedSessionId;

  const resumable = listResumableSessions(db, goalId);
  const requiredReconstruction = resumable.find((entry) => entry.reconstructionRequired);
  const unresolvedSubmitted = resumable.find(
    (entry) =>
      entry.unresolvedVerificationAttempts.length > 0 ||
      entry.unresolvedAssessmentAttempts.length > 0 ||
      entry.phase === "awaiting_verification" ||
      entry.phase === "awaiting_assessment" ||
      entry.phase === "feedback",
  );
  const candidateSession =
    requiredReconstruction ??
    unresolvedSubmitted ??
    (input.resumeParked && parkedId !== null
      ? resumable.find((entry) => entry.session.id === parkedId)
      : resumable.find((entry) => entry.session.id !== parkedId));

  if (candidateSession) {
    const presentation = getSessionQuestionPresentation(db, candidateSession.session.id);
    const feedback = getSessionFeedback(db, candidateSession.session.id);
    const commitment = buildResumeCommitment(db, candidateSession, presentation, feedback);
    const allowedActions = deriveResumeAllowedActions(commitment, feedback);
    return {
      kind: "resume",
      commitment,
      presentation,
      feedback,
      practicalWork: getPracticalWorkPolicy(db, candidateSession.session.id),
      bookmark,
      allowedActions,
      additionalResumableSessionIds: resumable
        .filter((entry) => entry.session.id !== candidateSession.session.id)
        .map((entry) => entry.session.id),
    };
  }

  const practicalWork =
    requestedPracticalWork === undefined
      ? getPracticalWorkPolicy(db)
      : { preference: requestedPracticalWork, source: "request" as const };

  if (input.availableMinutes === undefined && !input.oneEpisode) {
    const allowedActions: ContinuationActionId[] = ["set_budget_or_one_episode"];
    if (parkedId !== null) allowedActions.push("unpark");
    return {
      kind: "needs_budget",
      goalId,
      suggestedMinutes: getGoalPreparation(db, goalId)?.minutes_per_day ?? null,
      practicalWork,
      bookmark,
      allowedActions,
    };
  }

  const mission = getTodayMission(db, {
    goalId,
    now,
    availableMinutes: input.oneEpisode ? null : input.availableMinutes!,
    maxItems: 1,
    retestEligibleWeaknessKeys: input.retestEligibleWeaknessKeys,
    mainDeliveryContext: input.mainDeliveryContext,
    transferDeliveryContext: input.transferDeliveryContext,
    practicalWork: practicalWork.preference,
    knowledgeRoot: input.knowledgeRoot,
  });
  const [item] = mission.items;
  if (!item) {
    const allowedActions: ContinuationActionId[] = ["explain_no_action"];
    if (parkedId !== null) allowedActions.push("unpark");
    return { kind: "no_action", mission, practicalWork, bookmark, allowedActions };
  }
  const prepContext = getDurablePreparationContext(db, item.intent.goalId);
  const prepObjective = prepContext?.objectives.find(
    (candidate) => candidate.objectiveId === item.intent.objectiveId,
  );
  const gradable = getEffectiveEvidenceEventsByObjective(db, item.intent.objectiveId).filter(
    (event) => event.result !== "ungradable",
  );
  let consecutiveFailures = 0;
  for (let i = gradable.length - 1; i >= 0; i -= 1) {
    if (gradable[i]!.result === "correct") break;
    consecutiveFailures += 1;
  }
  const pedagogy = derivePedagogyDirective({
    intent: item.intent,
    objective: prepObjective,
    interactionPreferences: getInteractionPreferences(db),
    consecutiveFailures,
    latestResult: gradable.at(-1)?.result ?? null,
  });
  const allowedActions: ContinuationActionId[] = ["open_recommended_challenge"];
  if (parkedId !== null) allowedActions.push("unpark");
  return { kind: "recommend", mission, item, pedagogy, practicalWork, bookmark, allowedActions };
}
