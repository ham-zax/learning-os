import type Database from "better-sqlite3";
import { getGoalObjectives, getGoalPreparation, getTopic } from "../db/database.js";
import type {
  DeliveryContext,
  GoalObjective,
  GoalTargetReadiness,
  InitialDiagnosticKind,
  Readiness,
  TaskForm,
  TransferState,
  DurabilityState,
  WeaknessLifecycle,
} from "../db/types.js";
import { selectNextChallenge } from "../selection/selector.js";
import type {
  BlockedSelectionCandidate,
  ChallengeIntent,
  ChallengeSelectionResult,
  ObjectiveSelectionCandidate,
  PrerequisiteSelectionPolicy,
} from "../selection/types.js";

export type DailyMissionItemKind = "retrieval" | "main" | "transfer";

export interface RequestedChallengeInput {
  goalId: string;
  objectiveId: string;
  deliveryContext: DeliveryContext;
  now: string;
  prerequisitePolicy?: PrerequisiteSelectionPolicy;
  recentChallengeLimit?: number;
  retestEligibleWeaknessKeys?: readonly string[];
}

export interface TodayMissionInput {
  goalId: string;
  availableMinutes: number;
  now: string;
  prerequisitePolicy?: PrerequisiteSelectionPolicy;
  recentChallengeLimit?: number;
  /** Resolved weakness keys the caller explicitly wants to make retest-eligible today. */
  retestEligibleWeaknessKeys?: readonly string[];
  /** Override forward-progress context. Default is practice; a brand-new objective starts in learn. */
  mainDeliveryContext?: DeliveryContext;
  /** Context for an additional transfer item. Defaults to practice. */
  transferDeliveryContext?: DeliveryContext;
}

export interface DailyMissionItem {
  kind: DailyMissionItemKind;
  objectiveId: string;
  minutes: number;
  reason: string;
  intent: ChallengeIntent;
}

export interface DailyMission {
  missionId: string;
  goalId: string;
  goal: string | null;
  deadlineAt: string | null;
  generatedAt: string;
  availableMinutes: number;
  plannedMinutes: number;
  unallocatedMinutes: number;
  items: DailyMissionItem[];
  blocked: BlockedSelectionCandidate[];
}

type GoalObjectiveState = {
  config: GoalObjective;
  readiness: Readiness;
  transferState: TransferState;
  durabilityState: DurabilityState;
  initialDiagnosticKind: InitialDiagnosticKind | null;
  diagnosticPending: boolean;
  recentFailure: boolean;
  dueAt: string | null;
  weaknesses: Array<{
    key: string;
    lifecycle: WeaknessLifecycle;
  }>;
};

const READINESS_RANK: Record<Readiness, number> = {
  unknown: 0,
  exposed: 1,
  guided: 2,
  independent: 3,
};

const DEFAULT_PREREQUISITE_POLICY: PrerequisiteSelectionPolicy = {
  capabilityId: "explain",
  minimumReadiness: "guided",
};

const DEFAULT_TASK_MINUTES: Record<TaskForm, number> = {
  explanation: 8,
  runtime_trace: 10,
  implementation: 20,
  debugging: 16,
  design: 20,
};

function normalizeInstant(value: string, label: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed.toISOString();
}

function normalizeDeadline(value: string | null): string | null {
  return value === null ? null : normalizeInstant(value, "goal deadline");
}

function deadlineUrgency(deadlineAt: string | null, now: string): number {
  if (deadlineAt === null) return 0;
  const remainingDays =
    (new Date(deadlineAt).getTime() - new Date(now).getTime()) / 86_400_000;
  if (remainingDays <= 0) return 1;
  return 1 / (1 + remainingDays);
}

function readinessMeets(current: Readiness, target: GoalTargetReadiness): boolean {
  return READINESS_RANK[current] >= READINESS_RANK[target];
}

function loadGoalObjectiveState(
  db: Database.Database,
  config: GoalObjective,
): GoalObjectiveState {
  const row = db
    .prepare(
      `SELECT projection.readiness,
              projection.transfer_state,
              projection.durability_state,
              projection.last_qualifying_evidence_at,
              projection.recent_failure,
              card.due_at
       FROM objective_projections projection
       LEFT JOIN review_cards card ON card.objective_id = projection.objective_id
       WHERE projection.objective_id = ?`,
    )
    .get(config.objective_id) as
    | {
        readiness: Readiness;
        transfer_state: TransferState;
        durability_state: DurabilityState;
        last_qualifying_evidence_at: string | null;
        recent_failure: number;
        due_at: string | null;
      }
    | undefined;
  if (!row) {
    throw new Error(`Goal objective is missing its projection: ${config.objective_id}`);
  }

  const weaknesses = db
    .prepare(
      `SELECT key, lifecycle
       FROM weakness_projections
       WHERE objective_id = ?
       ORDER BY key`,
    )
    .all(config.objective_id) as Array<{ key: string; lifecycle: WeaknessLifecycle }>;

  return {
    config,
    readiness: row.readiness,
    transferState: row.transfer_state,
    durabilityState: row.durability_state,
    initialDiagnosticKind: config.initial_diagnostic_kind,
    diagnosticPending:
      config.initial_diagnostic_kind !== null &&
      (config.initial_diagnostic_kind === "transfer_check"
        ? row.transfer_state === "untested"
        : row.last_qualifying_evidence_at === null),
    recentFailure: row.recent_failure === 1,
    dueAt: row.due_at,
    weaknesses,
  };
}

function activeWeakness(state: GoalObjectiveState): boolean {
  return state.weaknesses.some((weakness) => weakness.lifecycle !== "resolved");
}

function eligibleResolvedWeaknesses(
  state: GoalObjectiveState,
  eligibleKeys: ReadonlySet<string>,
): string[] {
  return state.weaknesses
    .filter(
      (weakness) => weakness.lifecycle === "resolved" && eligibleKeys.has(weakness.key),
    )
    .map((weakness) => weakness.key);
}

function isDue(state: GoalObjectiveState, now: string): boolean {
  return state.dueAt !== null && state.dueAt <= now;
}

function needsForwardProgress(
  state: GoalObjectiveState,
  eligibleRetestKeys: ReadonlySet<string>,
): boolean {
  return (
    !readinessMeets(state.readiness, state.config.target_readiness) ||
    state.recentFailure ||
    activeWeakness(state) ||
    eligibleResolvedWeaknesses(state, eligibleRetestKeys).length > 0 ||
    (state.config.require_transfer && state.transferState !== "demonstrated") ||
    (
      state.config.require_durability &&
      state.durabilityState !== "demonstrated" &&
      state.dueAt === null
    )
  );
}

function isRelevant(
  state: GoalObjectiveState,
  now: string,
  eligibleRetestKeys: ReadonlySet<string>,
): boolean {
  return isDue(state, now) || needsForwardProgress(state, eligibleRetestKeys);
}

function diagnosticBlocksTransfer(state: GoalObjectiveState): boolean {
  return state.diagnosticPending && state.initialDiagnosticKind !== "transfer_check";
}

function candidateFor(
  state: GoalObjectiveState,
  urgency: number,
  eligibleRetestKeys: ReadonlySet<string>,
  options: { suppressTransfer?: boolean; suppressRetest?: boolean } = {},
): ObjectiveSelectionCandidate {
  return {
    objectiveId: state.config.objective_id,
    importance: state.config.importance,
    urgency,
    transfer:
      !options.suppressTransfer &&
      !diagnosticBlocksTransfer(state) &&
      state.config.require_transfer &&
      state.transferState !== "demonstrated"
        ? "required"
        : "none",
    retestEligibleWeaknessKeys: options.suppressRetest
      ? []
      : eligibleResolvedWeaknesses(state, eligibleRetestKeys),
  };
}

function selectIntent(
  db: Database.Database,
  states: readonly GoalObjectiveState[],
  input: TodayMissionInput,
  now: string,
  deadlineAt: string | null,
  deliveryContext: DeliveryContext,
  eligibleRetestKeys: ReadonlySet<string>,
  options: { suppressTransfer?: boolean; suppressRetest?: boolean } = {},
) {
  return selectNextChallenge(db, {
    now,
    deliveryContext,
    prerequisitePolicy: input.prerequisitePolicy ?? DEFAULT_PREREQUISITE_POLICY,
    recentChallengeLimit: input.recentChallengeLimit ?? 5,
    candidates: states.map((state) =>
      candidateFor(
        state,
        deadlineUrgency(deadlineAt, now),
        eligibleRetestKeys,
        options,
      ),
    ),
  });
}

function taskMinutes(intent: ChallengeIntent, available: number): number {
  return Math.min(DEFAULT_TASK_MINUTES[intent.taskForm], available);
}

function missionReason(intent: ChallengeIntent, state: GoalObjectiveState): string {
  const gaps: string[] = [];
  if (state.diagnosticPending && state.initialDiagnosticKind !== null) {
    gaps.push(`initial ${state.initialDiagnosticKind} diagnostic pending`);
  }
  if (!readinessMeets(state.readiness, state.config.target_readiness)) {
    gaps.push(`readiness ${state.readiness} < target ${state.config.target_readiness}`);
  }
  if (state.config.require_transfer && state.transferState !== "demonstrated") {
    gaps.push(`transfer ${state.transferState}`);
  }
  if (state.config.require_durability && state.durabilityState !== "demonstrated") {
    gaps.push(`durability ${state.durabilityState}`);
  }
  return gaps.length === 0 ? intent.reason : `${intent.reason} Goal gap: ${gaps.join(", ")}.`;
}

function addBlocked(
  target: Map<string, BlockedSelectionCandidate>,
  blocked: readonly BlockedSelectionCandidate[],
): void {
  for (const item of blocked) {
    const existing = target.get(item.objectiveId);
    if (!existing) {
      target.set(item.objectiveId, {
        objectiveId: item.objectiveId,
        conceptId: item.conceptId,
        blockers: [...item.blockers],
      });
      continue;
    }
    for (const blocker of item.blockers) {
      if (!existing.blockers.includes(blocker)) existing.blockers.push(blocker);
    }
  }
}

function missionId(goalId: string, now: string, availableMinutes: number): string {
  const safeGoal = goalId.replace(/[^A-Za-z0-9_-]+/g, "_");
  return `today_${safeGoal}_${now.slice(0, 10)}_${availableMinutes}`;
}

export function resolveTodayAvailableMinutes(
  db: Database.Database,
  goalId: string,
  explicitMinutes: number | undefined,
  fallbackMinutes: number,
): number {
  const value = explicitMinutes ?? getGoalPreparation(db, goalId)?.minutes_per_day ?? fallbackMinutes;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Available minutes must be a positive integer");
  }
  return value;
}

export function resolveRequestedChallenge(
  db: Database.Database,
  input: RequestedChallengeInput,
): ChallengeSelectionResult {
  if (
    input.recentChallengeLimit !== undefined &&
    (!Number.isInteger(input.recentChallengeLimit) || input.recentChallengeLimit < 0)
  ) {
    throw new Error("recentChallengeLimit must be a non-negative integer");
  }
  const now = normalizeInstant(input.now, "requested challenge time");
  const topic = getTopic(db, input.goalId);
  if (!topic) throw new Error(`Goal topic not found: ${input.goalId}`);
  const config = getGoalObjectives(db, input.goalId).find(
    (candidate) => candidate.objective_id === input.objectiveId,
  );
  if (!config) {
    throw new Error(`Active goal objective not found: ${input.goalId}/${input.objectiveId}`);
  }
  const state = loadGoalObjectiveState(db, config);
  const result = selectNextChallenge(db, {
    now,
    deliveryContext: input.deliveryContext,
    prerequisitePolicy: input.prerequisitePolicy ?? DEFAULT_PREREQUISITE_POLICY,
    recentChallengeLimit: input.recentChallengeLimit ?? 5,
    candidates: [
      candidateFor(
        state,
        deadlineUrgency(normalizeDeadline(topic.deadline), now),
        new Set(input.retestEligibleWeaknessKeys ?? []),
      ),
    ],
  });
  if (!result.intent || !state.diagnosticPending || state.initialDiagnosticKind === null) {
    return result;
  }
  return {
    ...result,
    intent: {
      ...result.intent,
      reason: `Initial ${state.initialDiagnosticKind} diagnostic is pending. ${result.intent.reason}`,
    },
  };
}

export function getTodayMission(
  db: Database.Database,
  input: TodayMissionInput,
): DailyMission {
  if (!Number.isInteger(input.availableMinutes) || input.availableMinutes <= 0) {
    throw new Error("availableMinutes must be a positive integer");
  }
  if (
    input.recentChallengeLimit !== undefined &&
    (!Number.isInteger(input.recentChallengeLimit) || input.recentChallengeLimit < 0)
  ) {
    throw new Error("recentChallengeLimit must be a non-negative integer");
  }

  const now = normalizeInstant(input.now, "mission time");
  const topic = getTopic(db, input.goalId);
  if (!topic) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }
  const deadlineAt = normalizeDeadline(topic.deadline);
  const eligibleRetestKeys = new Set(input.retestEligibleWeaknessKeys ?? []);
  const states = getGoalObjectives(db, input.goalId)
    .map((config) => loadGoalObjectiveState(db, config))
    .filter((state) => isRelevant(state, now, eligibleRetestKeys));
  const stateByObjective = new Map(
    states.map((state) => [state.config.objective_id, state] as const),
  );
  const pendingDiagnosticStates = states.filter((state) => state.diagnosticPending);

  const items: DailyMissionItem[] = [];
  const blocked = new Map<string, BlockedSelectionCandidate>();
  let remaining = input.availableMinutes;

  // Warm-up is intentionally bounded: routine due retrieval only, max 3 items / 5 minutes.
  let warmupBudget = Math.min(5, remaining);
  const routineDue = states.filter(
    (state) => isDue(state, now) && !needsForwardProgress(state, eligibleRetestKeys),
  );
  const remainingDue = [...routineDue];
  while (remainingDue.length > 0 && items.filter((item) => item.kind === "retrieval").length < 3) {
    const result = selectIntent(
      db,
      remainingDue,
      input,
      now,
      deadlineAt,
      "review",
      eligibleRetestKeys,
      { suppressTransfer: true, suppressRetest: true },
    );
    addBlocked(blocked, result.blocked);
    if (!result.intent || warmupBudget <= 0 || remaining <= 0) break;
    const minutes = Math.min(2, warmupBudget, remaining);
    if (minutes <= 0) break;
    items.push({
      kind: "retrieval",
      objectiveId: result.intent.objectiveId,
      minutes,
      reason: missionReason(result.intent, stateByObjective.get(result.intent.objectiveId)!),
      intent: result.intent,
    });
    remaining -= minutes;
    warmupBudget -= minutes;
    const index = remainingDue.findIndex(
      (state) => state.config.objective_id === result.intent!.objectiveId,
    );
    if (index >= 0) remainingDue.splice(index, 1);
  }

  const remainingDiagnosticStates = [...pendingDiagnosticStates];
  while (remainingDiagnosticStates.length > 0 && remaining >= 5) {
    const result = selectIntent(
      db,
      remainingDiagnosticStates,
      input,
      now,
      deadlineAt,
      input.mainDeliveryContext ?? "practice",
      eligibleRetestKeys,
    );
    addBlocked(blocked, result.blocked);
    if (!result.intent) break;
    const minutes = taskMinutes(result.intent, remaining);
    if (minutes < 5) break;
    items.push({
      kind: result.intent.novelty === "transfer" ? "transfer" : "main",
      objectiveId: result.intent.objectiveId,
      minutes,
      reason: missionReason(result.intent, stateByObjective.get(result.intent.objectiveId)!),
      intent: result.intent,
    });
    remaining -= minutes;
    const index = remainingDiagnosticStates.findIndex(
      (state) => state.config.objective_id === result.intent!.objectiveId,
    );
    if (index >= 0) remainingDiagnosticStates.splice(index, 1);
  }
  const plannedInitialDiagnostics = items.some(
    (item) => stateByObjective.get(item.objectiveId)?.diagnosticPending === true,
  );

  const transferPressure =
    !plannedInitialDiagnostics &&
    pendingDiagnosticStates.length === 0 &&
    input.availableMinutes >= 30 &&
    (deadlineAt !== null ||
      input.transferDeliveryContext === "interview" ||
      input.transferDeliveryContext === "mock");
  const transferStates = states.filter(
    (state) =>
      state.config.require_transfer &&
      state.transferState !== "demonstrated" &&
      !diagnosticBlocksTransfer(state),
  );
  const transferPreview =
    transferPressure && transferStates.length > 0
      ? selectIntent(
          db,
          transferStates,
          input,
          now,
          deadlineAt,
          input.transferDeliveryContext ?? "practice",
          eligibleRetestKeys,
        )
      : null;
  if (transferPreview) addBlocked(blocked, transferPreview.blocked);

  const forwardStates = states.filter((state) => needsForwardProgress(state, eligibleRetestKeys));
  const preferredForwardStates = pendingDiagnosticStates.length > 0 ? pendingDiagnosticStates : forwardStates;
  if (
    !plannedInitialDiagnostics &&
    forwardStates.length > 0 &&
    remaining >= 5 &&
    (input.availableMinutes >= 20 || items.length === 0)
  ) {
    let result = selectIntent(
      db,
      preferredForwardStates,
      input,
      now,
      deadlineAt,
      input.mainDeliveryContext ?? "practice",
      eligibleRetestKeys,
    );
    addBlocked(blocked, result.blocked);
    if (!result.intent && preferredForwardStates !== forwardStates) {
      result = selectIntent(
        db,
        forwardStates,
        input,
        now,
        deadlineAt,
        input.mainDeliveryContext ?? "practice",
        eligibleRetestKeys,
      );
      addBlocked(blocked, result.blocked);
    }
    if (
      input.mainDeliveryContext === undefined &&
      pendingDiagnosticStates.length === 0 &&
      result.intent?.reasonKind === "new_objective"
    ) {
      result = selectIntent(
        db,
        forwardStates,
        input,
        now,
        deadlineAt,
        "learn",
        eligibleRetestKeys,
      );
      addBlocked(blocked, result.blocked);
    }
    if (result.intent) {
      const shouldReserveTransfer =
        transferPreview?.intent !== null &&
        transferPreview?.intent !== undefined &&
        result.intent.novelty !== "transfer";
      const transferReserve = shouldReserveTransfer ? Math.min(10, Math.max(0, remaining - 5)) : 0;
      const minutes = taskMinutes(result.intent, remaining - transferReserve);
      items.push({
        kind: result.intent.novelty === "transfer" ? "transfer" : "main",
        objectiveId: result.intent.objectiveId,
        minutes,
        reason: missionReason(result.intent, stateByObjective.get(result.intent.objectiveId)!),
        intent: result.intent,
      });
      remaining -= minutes;
    }
  }

  const hasTransferItem = items.some((item) => item.intent.novelty === "transfer");
  if (!hasTransferItem && transferPreview?.intent && remaining >= 8) {
    const minutes = Math.min(15, remaining);
    items.push({
      kind: "transfer",
      objectiveId: transferPreview.intent.objectiveId,
      minutes,
      reason: missionReason(
        transferPreview.intent,
        stateByObjective.get(transferPreview.intent.objectiveId)!,
      ),
      intent: transferPreview.intent,
    });
    remaining -= minutes;
  }

  // Small sessions still receive one useful item when a full main block is not possible.
  if (!plannedInitialDiagnostics && items.length === 0 && states.length > 0 && remaining > 0) {
    const preferredSmallSessionStates = pendingDiagnosticStates.length > 0 ? pendingDiagnosticStates : states;
    let result = selectIntent(
      db,
      preferredSmallSessionStates,
      input,
      now,
      deadlineAt,
      input.mainDeliveryContext ?? "practice",
      eligibleRetestKeys,
    );
    addBlocked(blocked, result.blocked);
    if (!result.intent && preferredSmallSessionStates !== states) {
      result = selectIntent(
        db,
        states,
        input,
        now,
        deadlineAt,
        input.mainDeliveryContext ?? "practice",
        eligibleRetestKeys,
      );
      addBlocked(blocked, result.blocked);
    }
    if (
      input.mainDeliveryContext === undefined &&
      pendingDiagnosticStates.length === 0 &&
      result.intent?.reasonKind === "new_objective"
    ) {
      result = selectIntent(
        db,
        states,
        input,
        now,
        deadlineAt,
        "learn",
        eligibleRetestKeys,
      );
      addBlocked(blocked, result.blocked);
    }
    if (result.intent) {
      const minutes = taskMinutes(result.intent, remaining);
      items.push({
        kind: result.intent.novelty === "transfer" ? "transfer" : "main",
        objectiveId: result.intent.objectiveId,
        minutes,
        reason: missionReason(result.intent, stateByObjective.get(result.intent.objectiveId)!),
        intent: result.intent,
      });
      remaining -= minutes;
    }
  }

  return {
    missionId: missionId(input.goalId, now, input.availableMinutes),
    goalId: input.goalId,
    goal: topic.goal,
    deadlineAt,
    generatedAt: now,
    availableMinutes: input.availableMinutes,
    plannedMinutes: input.availableMinutes - remaining,
    unallocatedMinutes: remaining,
    items,
    blocked: [...blocked.values()].sort((left, right) =>
      left.objectiveId.localeCompare(right.objectiveId),
    ),
  };
}
