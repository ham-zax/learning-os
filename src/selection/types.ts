import type {
  DeliveryContext,
  Novelty,
  Readiness,
  TaskForm,
  WeaknessLifecycle,
} from "../db/types.js";

export type SelectionCapabilityId =
  | "explain"
  | "predict"
  | "implement"
  | "debug"
  | "design";

export type ObjectiveImportance = "core" | "important" | "supporting";
export type TransferSelectionPolicy = "none" | "eligible" | "required";

export interface PrerequisiteSelectionPolicy {
  capabilityId: SelectionCapabilityId;
  minimumReadiness: Readiness;
}

export interface ObjectiveSelectionCandidate {
  objectiveId: string;
  importance: ObjectiveImportance;
  /** Relative caller-supplied urgency. Higher values rank first within a policy tier. */
  urgency: number;
  transfer: TransferSelectionPolicy;
  /** Resolved weakness keys the caller has explicitly made eligible for retest now. */
  retestEligibleWeaknessKeys?: readonly string[];
  /** Non-evidence soft preference used only after higher-authority selection policy. */
  preferred?: boolean;
  /** Real task forms the caller/teacher knows can assess this objective. */
  availableTaskForms?: readonly TaskForm[];
}

export interface ChallengeSelectionInput {
  /** Explicit time input used only for due-card comparison. */
  now: string;
  /** Delivery context requested by the caller; novelty is selected independently. */
  deliveryContext: DeliveryContext;
  prerequisitePolicy: PrerequisiteSelectionPolicy;
  /** Number of most recent attempted frozen challenges to use for diversity decisions. */
  recentChallengeLimit: number;
  candidates: readonly ObjectiveSelectionCandidate[];
}

export interface RecentChallengeRef {
  challengeId: string;
  version: number;
  attemptId: number;
  taskForm: TaskForm;
  novelty: Novelty;
  performedAt: string;
}

export interface SelectedWeaknessContext {
  key: string;
  category: string;
  lifecycle: WeaknessLifecycle;
  isRetest: boolean;
}

export type SelectionReasonKind =
  | "recurring_weakness"
  | "resolved_weakness_retest"
  | "transfer_needed"
  | "due_retrieval"
  | "weak_capability"
  | "new_objective"
  | "reinforcement";

export interface ChallengeIntent {
  objectiveId: string;
  conceptId: string;
  capabilityId: SelectionCapabilityId;
  taskForm: TaskForm;
  deliveryContext: DeliveryContext;
  novelty: Novelty;
  reasonKind: SelectionReasonKind;
  reason: string;
  dueAt: string | null;
  weakness: SelectedWeaknessContext | null;
  requiresChangedSurface: boolean;
  avoidRecentChallenges: RecentChallengeRef[];
}

export interface BlockedSelectionCandidate {
  objectiveId: string;
  conceptId: string;
  blockers: string[];
}

export interface ChallengeSelectionResult {
  intent: ChallengeIntent | null;
  blocked: BlockedSelectionCandidate[];
}
