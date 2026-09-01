import { z } from "zod";
import {
  DeliveryContext,
  Novelty,
  TaskForm,
  WeaknessLifecycle,
} from "../db/types.js";
import type { Readiness } from "../db/types.js";

export const SelectionCapabilityIdSchema = z.enum([
  "explain",
  "predict",
  "implement",
  "debug",
  "design",
]);
export type SelectionCapabilityId = z.infer<typeof SelectionCapabilityIdSchema>;

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

export const RecentChallengeRefSchema = z.object({
  challengeId: z.string().min(1),
  version: z.number().int().positive(),
  attemptId: z.number().int().positive(),
  taskForm: TaskForm,
  novelty: Novelty,
  performedAt: z.string().min(1),
}).strict();
export type RecentChallengeRef = z.infer<typeof RecentChallengeRefSchema>;

export const SelectedWeaknessContextSchema = z.object({
  key: z.string().min(1),
  category: z.string().min(1),
  lifecycle: WeaknessLifecycle,
  isRetest: z.boolean(),
}).strict();
export type SelectedWeaknessContext = z.infer<typeof SelectedWeaknessContextSchema>;

export const SelectionReasonKindSchema = z.enum([
  "recurring_weakness",
  "resolved_weakness_retest",
  "transfer_needed",
  "due_retrieval",
  "weak_capability",
  "new_objective",
  "reinforcement",
]);
export type SelectionReasonKind = z.infer<typeof SelectionReasonKindSchema>;

export const ChallengeIntentSchema = z.object({
  objectiveId: z.string().min(1),
  conceptId: z.string().min(1),
  capabilityId: SelectionCapabilityIdSchema,
  taskForm: TaskForm,
  deliveryContext: DeliveryContext,
  novelty: Novelty,
  reasonKind: SelectionReasonKindSchema,
  reason: z.string().min(1),
  dueAt: z.string().nullable(),
  weakness: SelectedWeaknessContextSchema.nullable(),
  requiresChangedSurface: z.boolean(),
  avoidRecentChallenges: z.array(RecentChallengeRefSchema),
}).strict();
export type ChallengeIntent = z.infer<typeof ChallengeIntentSchema>;

export const ChallengeAuthoringContractSchema = ChallengeIntentSchema.extend({
  contractVersion: z.literal(1),
}).strict();
export type ChallengeAuthoringContract = z.infer<typeof ChallengeAuthoringContractSchema>;

export function challengeAuthoringContract(intent: ChallengeIntent): ChallengeAuthoringContract {
  return ChallengeAuthoringContractSchema.parse({ contractVersion: 1, ...intent });
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
