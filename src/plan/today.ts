import type Database from "better-sqlite3";
import {
  getActiveGoalStudyFocusEpisode,
  getGoalObjectives,
  getGoalPreparation,
  getTopic,
} from "../db/database.js";
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
  /** Remaining active-study budget. Planned item minutes are reservation estimates, not consumed time. */
  availableMinutes: number;
  now: string;
  /** Bound returned work for episode-by-episode orchestration. Pass 1 to request only the next move. */
  maxItems?: number;
  /** Optional per-call focus override. When omitted, durable goal study focus is used. */
  focusObjectiveIds?: readonly string[];
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
  /** Estimated capacity reservation for planning; never authoritative elapsed study time. */
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
  blockingMisconceptionCount: number;
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

const MIN_TASK_START_MINUTES: Record<TaskForm, number> = {
  explanation: 1,
  runtime_trace: 2,
  implementation: 10,
  debugging: 5,
  design: 10,
};

const MAX_INITIAL_DIAGNOSTICS_PER_MISSION = 1;

const IMPORTANCE_RANK: Record<GoalObjective["importance"], number> = {
  core: 0,
  important: 1,
  supporting: 2,
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
              projection.blocking_misconception_count,
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
        blocking_misconception_count: number;
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
    blockingMisconceptionCount: row.blocking_misconception_count,
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

function canInterruptStudyFocus(
  state: GoalObjectiveState,
  eligibleRetestKeys: ReadonlySet<string>,
): boolean {
  return (
    state.blockingMisconceptionCount > 0 ||
    state.weaknesses.some(
      (weakness) => weakness.lifecycle === "recurring" || weakness.lifecycle === "retest",
    ) ||
    eligibleResolvedWeaknesses(state, eligibleRetestKeys).length > 0 ||
    transferEligibleNow(state)
  );
}

function diagnosticBlocksTransfer(state: GoalObjectiveState): boolean {
  return state.diagnosticPending && state.initialDiagnosticKind !== "transfer_check";
}

function transferEligibleNow(state: GoalObjectiveState): boolean {
  return (
    state.config.require_transfer &&
    state.transferState !== "demonstrated" &&
    readinessMeets(state.readiness, state.config.target_readiness) &&
    !state.recentFailure &&
    !activeWeakness(state) &&
    !diagnosticBlocksTransfer(state)
  );
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
      !options.suppressTransfer && transferEligibleNow(state) ? "required" : "none",
    retestEligibleWeaknessKeys: options.suppressRetest
      ? []
      : eligibleResolvedWeaknesses(state, eligibleRetestKeys),
  };
}

type FocusPrerequisitePlan = {
  preferredObjectiveIds: Set<string>;
  extraCandidates: ObjectiveSelectionCandidate[];
};

function deriveFocusPrerequisites(
  db: Database.Database,
  goalObjectives: readonly GoalObjective[],
  inactiveGoalObjectiveIds: ReadonlySet<string>,
  focusTargetObjectiveIds: ReadonlySet<string>,
  policy: PrerequisiteSelectionPolicy,
  urgency: number,
): FocusPrerequisitePlan {
  const preferredObjectiveIds = new Set(focusTargetObjectiveIds);
  if (focusTargetObjectiveIds.size === 0) {
    return { preferredObjectiveIds, extraCandidates: [] };
  }

  const goalObjectiveIds = new Set(goalObjectives.map((objective) => objective.objective_id));
  const candidateImportance = new Map<string, GoalObjective["importance"]>();
  const conceptImportance = new Map<string, GoalObjective["importance"]>();
  const queue: Array<{ conceptId: string; importance: GoalObjective["importance"] }> = [];

  const objectiveConcept = db.prepare(
    `SELECT concept_id FROM learning_objectives WHERE id = ?`,
  );
  for (const config of goalObjectives) {
    if (!focusTargetObjectiveIds.has(config.objective_id)) continue;
    const row = objectiveConcept.get(config.objective_id) as { concept_id: string } | undefined;
    if (row) queue.push({ conceptId: row.concept_id, importance: config.importance });
  }

  const conceptRow = db.prepare(`SELECT prerequisites FROM concepts WHERE id = ?`);
  const prerequisiteObjective = db.prepare(
    `SELECT objective.id AS objective_id, projection.readiness
     FROM learning_objectives objective
     JOIN objective_projections projection ON projection.objective_id = objective.id
     WHERE objective.concept_id = ? AND objective.capability_id = ?`,
  );

  while (queue.length > 0) {
    const current = queue.shift()!;
    const previousImportance = conceptImportance.get(current.conceptId);
    if (
      previousImportance !== undefined &&
      IMPORTANCE_RANK[previousImportance] <= IMPORTANCE_RANK[current.importance]
    ) {
      continue;
    }
    conceptImportance.set(current.conceptId, current.importance);

    const row = conceptRow.get(current.conceptId) as { prerequisites: string } | undefined;
    if (!row) continue;
    const prerequisites = JSON.parse(row.prerequisites) as unknown;
    if (!Array.isArray(prerequisites) || prerequisites.some((value) => typeof value !== "string")) {
      throw new Error(`Concept ${current.conceptId} has invalid prerequisites`);
    }

    for (const prerequisiteId of prerequisites) {
      const objective = prerequisiteObjective.get(prerequisiteId, policy.capabilityId) as
        | { objective_id: string; readiness: Readiness }
        | undefined;
      if (!objective) continue;
      if (inactiveGoalObjectiveIds.has(objective.objective_id)) continue;
      if (READINESS_RANK[objective.readiness] >= READINESS_RANK[policy.minimumReadiness]) continue;

      preferredObjectiveIds.add(objective.objective_id);
      const existingImportance = candidateImportance.get(objective.objective_id);
      if (
        existingImportance === undefined ||
        IMPORTANCE_RANK[current.importance] < IMPORTANCE_RANK[existingImportance]
      ) {
        candidateImportance.set(objective.objective_id, current.importance);
      }
      queue.push({ conceptId: prerequisiteId, importance: current.importance });
    }
  }

  return {
    preferredObjectiveIds,
    extraCandidates: [...candidateImportance.entries()]
      .filter(([objectiveId]) => !goalObjectiveIds.has(objectiveId))
      .map(([objectiveId, importance]) => ({
        objectiveId,
        importance,
        urgency,
        transfer: "none" as const,
        preferred: true,
      })),
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
  preferredObjectiveIds: ReadonlySet<string>,
  options: { suppressTransfer?: boolean; suppressRetest?: boolean } = {},
  additionalCandidates: readonly ObjectiveSelectionCandidate[] = [],
) {
  const stateObjectiveIds = new Set(states.map((state) => state.config.objective_id));
  return selectNextChallenge(db, {
    goalId: input.goalId,
    now,
    deliveryContext,
    prerequisitePolicy: input.prerequisitePolicy ?? DEFAULT_PREREQUISITE_POLICY,
    recentChallengeLimit: input.recentChallengeLimit ?? 5,
    candidates: [
      ...states.map((state) => ({
        ...candidateFor(
          state,
          deadlineUrgency(deadlineAt, now),
          eligibleRetestKeys,
          options,
        ),
        preferred: preferredObjectiveIds.has(state.config.objective_id),
      })),
      ...additionalCandidates.filter((candidate) => !stateObjectiveIds.has(candidate.objectiveId)),
    ],
  });
}

function taskMinutes(intent: ChallengeIntent, available: number): number {
  if (available < MIN_TASK_START_MINUTES[intent.taskForm]) return 0;
  return Math.min(DEFAULT_TASK_MINUTES[intent.taskForm], available);
}

function missionReason(
  intent: ChallengeIntent,
  state: GoalObjectiveState,
  softFocused: boolean,
): string {
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
  const reason =
    gaps.length === 0 ? intent.reason : `${intent.reason} Goal gap: ${gaps.join(", ")}.`;
  return softFocused ? `${reason} Current study focus prefers this objective.` : reason;
}

function missionReasonForIntent(
  intent: ChallengeIntent,
  stateByObjective: ReadonlyMap<string, GoalObjectiveState>,
  preferredObjectiveIds: ReadonlySet<string>,
): string {
  const state = stateByObjective.get(intent.objectiveId);
  if (state) {
    return missionReason(intent, state, preferredObjectiveIds.has(intent.objectiveId));
  }
  return `Prerequisite/foundation work needed for the current study focus. ${intent.reason}`;
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

function selectFittingIntent(
  db: Database.Database,
  states: readonly GoalObjectiveState[],
  input: TodayMissionInput,
  now: string,
  deadlineAt: string | null,
  deliveryContext: DeliveryContext,
  eligibleRetestKeys: ReadonlySet<string>,
  preferredObjectiveIds: ReadonlySet<string>,
  availableMinutes: number,
  options: { suppressTransfer?: boolean; suppressRetest?: boolean } = {},
  additionalCandidates: readonly ObjectiveSelectionCandidate[] = [],
): ChallengeSelectionResult {
  const remainingStates = [...states];
  const remainingAdditionalCandidates = [...additionalCandidates];
  const blocked = new Map<string, BlockedSelectionCandidate>();

  while (remainingStates.length > 0 || remainingAdditionalCandidates.length > 0) {
    const result = selectIntent(
      db,
      remainingStates,
      input,
      now,
      deadlineAt,
      deliveryContext,
      eligibleRetestKeys,
      preferredObjectiveIds,
      options,
      remainingAdditionalCandidates,
    );
    addBlocked(blocked, result.blocked);
    if (!result.intent) break;
    if (taskMinutes(result.intent, availableMinutes) > 0) {
      return {
        intent: result.intent,
        blocked: [...blocked.values()].sort((left, right) =>
          left.objectiveId.localeCompare(right.objectiveId),
        ),
      };
    }

    const selectedIndex = remainingStates.findIndex(
      (state) => state.config.objective_id === result.intent!.objectiveId,
    );
    if (selectedIndex >= 0) {
      remainingStates.splice(selectedIndex, 1);
      continue;
    }
    const additionalIndex = remainingAdditionalCandidates.findIndex(
      (candidate) => candidate.objectiveId === result.intent!.objectiveId,
    );
    if (additionalIndex < 0) break;
    remainingAdditionalCandidates.splice(additionalIndex, 1);
  }

  return {
    intent: null,
    blocked: [...blocked.values()].sort((left, right) =>
      left.objectiveId.localeCompare(right.objectiveId),
    ),
  };
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
    goalId: input.goalId,
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
  if (
    input.maxItems !== undefined &&
    (!Number.isInteger(input.maxItems) || input.maxItems <= 0)
  ) {
    throw new Error("maxItems must be a positive integer");
  }

  const now = normalizeInstant(input.now, "mission time");
  const topic = getTopic(db, input.goalId);
  if (!topic) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }
  const deadlineAt = normalizeDeadline(topic.deadline);
  const eligibleRetestKeys = new Set(input.retestEligibleWeaknessKeys ?? []);
  const allGoalObjectives = getGoalObjectives(db, input.goalId, { includeInactive: true });
  const goalObjectives = allGoalObjectives.filter((config) => config.is_active);
  const inactiveGoalObjectiveIds = new Set(
    allGoalObjectives.filter((config) => !config.is_active).map((config) => config.objective_id),
  );
  const activeObjectiveIds = new Set(goalObjectives.map((config) => config.objective_id));
  const activeFocus = getActiveGoalStudyFocusEpisode(db, input.goalId);
  const focusTargetObjectiveIds = new Set(
    input.focusObjectiveIds ?? activeFocus?.target_objective_ids ?? [],
  );
  for (const objectiveId of focusTargetObjectiveIds) {
    if (!activeObjectiveIds.has(objectiveId)) {
      throw new Error(`Study focus objective is not active for goal ${input.goalId}: ${objectiveId}`);
    }
  }
  const prerequisitePolicy = input.prerequisitePolicy ?? DEFAULT_PREREQUISITE_POLICY;
  const focusPlan = deriveFocusPrerequisites(
    db,
    goalObjectives,
    inactiveGoalObjectiveIds,
    focusTargetObjectiveIds,
    prerequisitePolicy,
    deadlineUrgency(deadlineAt, now),
  );
  const preferredObjectiveIds = focusPlan.preferredObjectiveIds;
  const states = goalObjectives
    .map((config) => loadGoalObjectiveState(db, config))
    .filter((state) => isRelevant(state, now, eligibleRetestKeys));
  const stateByObjective = new Map(
    states.map((state) => [state.config.objective_id, state] as const),
  );
  const pendingDiagnosticStates = states.filter(
    (state) =>
      state.diagnosticPending &&
      (focusTargetObjectiveIds.size === 0 || focusTargetObjectiveIds.has(state.config.objective_id)),
  );

  const items: DailyMissionItem[] = [];
  const blocked = new Map<string, BlockedSelectionCandidate>();
  const itemLimit = input.maxItems ?? Number.POSITIVE_INFINITY;
  let remaining = input.availableMinutes;

  // Warm-up is intentionally bounded: routine due retrieval only, max 3 items / 5 minutes.
  // With an active focus, unrelated overdue debt stays in this bounded lane even when that
  // objective also needs ordinary forward progress; it does not displace the focus main block.
  let warmupBudget = Math.min(5, remaining);
  const routineDue = states.filter((state) => {
    if (!isDue(state, now)) return false;
    const outsideFocus =
      focusTargetObjectiveIds.size > 0 &&
      !preferredObjectiveIds.has(state.config.objective_id);
    if (itemLimit === 1 && outsideFocus) return false;
    if (!needsForwardProgress(state, eligibleRetestKeys)) return true;
    return outsideFocus && !canInterruptStudyFocus(state, eligibleRetestKeys);
  });
  const remainingDue = [...routineDue];
  while (
    remainingDue.length > 0 &&
    items.filter((item) => item.kind === "retrieval").length < 3 &&
    items.length < itemLimit &&
    warmupBudget > 0 &&
    remaining > 0
  ) {
    const availableForRetrieval = Math.min(2, warmupBudget, remaining);
    const result = selectFittingIntent(
      db,
      remainingDue,
      input,
      now,
      deadlineAt,
      "review",
      eligibleRetestKeys,
      preferredObjectiveIds,
      availableForRetrieval,
      { suppressTransfer: true, suppressRetest: true },
    );
    addBlocked(blocked, result.blocked);
    if (!result.intent) break;
    const minutes = taskMinutes(result.intent, availableForRetrieval);
    items.push({
      kind: "retrieval",
      objectiveId: result.intent.objectiveId,
      minutes,
      reason: missionReason(
        result.intent,
        stateByObjective.get(result.intent.objectiveId)!,
        preferredObjectiveIds.has(result.intent.objectiveId),
      ),
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
  let plannedDiagnosticCount = 0;
  while (
    remainingDiagnosticStates.length > 0 &&
    remaining >= 5 &&
    plannedDiagnosticCount < MAX_INITIAL_DIAGNOSTICS_PER_MISSION &&
    items.length < itemLimit
  ) {
    const result = selectFittingIntent(
      db,
      remainingDiagnosticStates,
      input,
      now,
      deadlineAt,
      input.mainDeliveryContext ?? "practice",
      eligibleRetestKeys,
      preferredObjectiveIds,
      remaining,
    );
    addBlocked(blocked, result.blocked);
    if (!result.intent) break;
    const minutes = taskMinutes(result.intent, remaining);
    items.push({
      kind: result.intent.novelty === "transfer" ? "transfer" : "main",
      objectiveId: result.intent.objectiveId,
      minutes,
      reason: missionReason(
        result.intent,
        stateByObjective.get(result.intent.objectiveId)!,
        preferredObjectiveIds.has(result.intent.objectiveId),
      ),
      intent: result.intent,
    });
    remaining -= minutes;
    plannedDiagnosticCount += 1;
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
  const transferStates = states.filter(transferEligibleNow);
  const transferPreview =
    transferPressure && transferStates.length > 0 && items.length < itemLimit
      ? selectFittingIntent(
          db,
          transferStates,
          input,
          now,
          deadlineAt,
          input.transferDeliveryContext ?? "practice",
          eligibleRetestKeys,
          preferredObjectiveIds,
          remaining,
        )
      : null;
  if (transferPreview) addBlocked(blocked, transferPreview.blocked);

  const forwardStates = states.filter((state) => needsForwardProgress(state, eligibleRetestKeys));
  const mainForwardStates =
    focusTargetObjectiveIds.size > 0
      ? forwardStates.filter(
          (state) =>
            preferredObjectiveIds.has(state.config.objective_id) ||
            canInterruptStudyFocus(state, eligibleRetestKeys),
        )
      : pendingDiagnosticStates.length > 0
        ? pendingDiagnosticStates
        : forwardStates;
  if (
    !plannedInitialDiagnostics &&
    forwardStates.length > 0 &&
    remaining >= 5 &&
    items.length < itemLimit &&
    (input.availableMinutes >= 20 || items.length === 0)
  ) {
    let result = selectFittingIntent(
      db,
      mainForwardStates,
      input,
      now,
      deadlineAt,
      input.mainDeliveryContext ?? "practice",
      eligibleRetestKeys,
      preferredObjectiveIds,
      remaining,
      {},
      focusPlan.extraCandidates,
    );
    addBlocked(blocked, result.blocked);
    if (
      !result.intent &&
      focusTargetObjectiveIds.size === 0 &&
      mainForwardStates !== forwardStates
    ) {
      result = selectFittingIntent(
        db,
        forwardStates,
        input,
        now,
        deadlineAt,
        input.mainDeliveryContext ?? "practice",
        eligibleRetestKeys,
        preferredObjectiveIds,
        remaining,
        {},
        focusPlan.extraCandidates,
      );
      addBlocked(blocked, result.blocked);
    }
    if (
      input.mainDeliveryContext === undefined &&
      (focusTargetObjectiveIds.size > 0 || pendingDiagnosticStates.length === 0) &&
      result.intent?.reasonKind === "new_objective"
    ) {
      result = selectFittingIntent(
        db,
        mainForwardStates,
        input,
        now,
        deadlineAt,
        "learn",
        eligibleRetestKeys,
        preferredObjectiveIds,
        remaining,
        {},
        focusPlan.extraCandidates,
      );
      addBlocked(blocked, result.blocked);
    }
    if (result.intent) {
      const shouldReserveTransfer =
        items.length + 1 < itemLimit &&
        transferPreview?.intent !== null &&
        transferPreview?.intent !== undefined &&
        result.intent.novelty !== "transfer";
      const transferReserve = shouldReserveTransfer ? Math.min(10, Math.max(0, remaining - 5)) : 0;
      let minutes = taskMinutes(result.intent, remaining - transferReserve);
      if (minutes === 0 && transferReserve > 0) {
        minutes = taskMinutes(result.intent, remaining);
      }
      if (minutes > 0) {
        items.push({
          kind: result.intent.novelty === "transfer" ? "transfer" : "main",
          objectiveId: result.intent.objectiveId,
          minutes,
          reason: missionReasonForIntent(
            result.intent,
            stateByObjective,
            preferredObjectiveIds,
          ),
          intent: result.intent,
        });
        remaining -= minutes;
      }
    }
  }

  const hasTransferItem = items.some((item) => item.intent.novelty === "transfer");
  if (
    !hasTransferItem &&
    transferPreview?.intent &&
    remaining >= 8 &&
    items.length < itemLimit
  ) {
    const minutes = taskMinutes(transferPreview.intent, Math.min(15, remaining));
    if (minutes > 0) {
      items.push({
        kind: "transfer",
        objectiveId: transferPreview.intent.objectiveId,
        minutes,
        reason: missionReason(
          transferPreview.intent,
          stateByObjective.get(transferPreview.intent.objectiveId)!,
          preferredObjectiveIds.has(transferPreview.intent.objectiveId),
        ),
        intent: transferPreview.intent,
      });
      remaining -= minutes;
    }
  }

  // Small sessions still receive one useful item when a full main block is not possible.
  if (!plannedInitialDiagnostics && items.length === 0 && states.length > 0 && remaining > 0) {
    const smallSessionStates =
      focusTargetObjectiveIds.size > 0
        ? states.filter(
            (state) =>
              preferredObjectiveIds.has(state.config.objective_id) ||
              canInterruptStudyFocus(state, eligibleRetestKeys),
          )
        : pendingDiagnosticStates.length > 0
          ? pendingDiagnosticStates
          : states;
    let result = selectFittingIntent(
      db,
      smallSessionStates,
      input,
      now,
      deadlineAt,
      input.mainDeliveryContext ?? "practice",
      eligibleRetestKeys,
      preferredObjectiveIds,
      remaining,
      {},
      focusPlan.extraCandidates,
    );
    addBlocked(blocked, result.blocked);
    if (
      !result.intent &&
      focusTargetObjectiveIds.size === 0 &&
      smallSessionStates !== states
    ) {
      result = selectFittingIntent(
        db,
        states,
        input,
        now,
        deadlineAt,
        input.mainDeliveryContext ?? "practice",
        eligibleRetestKeys,
        preferredObjectiveIds,
        remaining,
        {},
        focusPlan.extraCandidates,
      );
      addBlocked(blocked, result.blocked);
    }
    if (
      input.mainDeliveryContext === undefined &&
      (focusTargetObjectiveIds.size > 0 || pendingDiagnosticStates.length === 0) &&
      result.intent?.reasonKind === "new_objective"
    ) {
      result = selectFittingIntent(
        db,
        smallSessionStates,
        input,
        now,
        deadlineAt,
        "learn",
        eligibleRetestKeys,
        preferredObjectiveIds,
        remaining,
        {},
        focusPlan.extraCandidates,
      );
      addBlocked(blocked, result.blocked);
    }
    if (result.intent) {
      const minutes = taskMinutes(result.intent, remaining);
      items.push({
        kind: result.intent.novelty === "transfer" ? "transfer" : "main",
        objectiveId: result.intent.objectiveId,
        minutes,
        reason: missionReasonForIntent(
          result.intent,
          stateByObjective,
          preferredObjectiveIds,
        ),
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
