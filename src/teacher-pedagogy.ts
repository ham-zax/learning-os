import type { DurablePreparationObjective } from "./onboarding/apply.js";
import type { ChallengeIntent } from "./selection/types.js";

export type PedagogyScaffold = "independent" | "guided";
export type PedagogyStage = "worked_example" | "completion" | "independent" | "transfer";
export type LearnerConfidence = "low" | "medium" | "high";
export type ConfidenceFeedbackDirective =
  | "confirm_uncertain_success"
  | "hypercorrection_repair"
  | "none";

export interface PedagogyDirective {
  /** Legacy binary field preserved for compatibility ("guided" when stage is worked_example or completion). */
  scaffold: PedagogyScaffold;
  /** 4-stage adaptive fading ladder grounded in preparation_strategy and observed performance. */
  stage: PedagogyStage;
  /** Optional guidance based on non-evidence learnerConfidence metadata (Butler 2008 / hypercorrection). */
  confidenceGuidance: ConfidenceFeedbackDirective;
  commitBeforeReveal: boolean;
  questionChunking: "default" | "atomic";
}

export interface PedagogyDirectiveInput {
  intent: ChallengeIntent;
  objective?: DurablePreparationObjective | null;
  interactionPreferences?: {
    questionChunking: "default" | "atomic";
  } | null;
  /** Recent consecutive non-correct gradable attempts on this objective (used for ZPD step-down). */
  consecutiveFailures?: number;
  /** Optional non-evidence self-reported confidence from the learner; never affects readiness or FSRS. */
  learnerConfidence?: LearnerConfidence | null;
  /** Latest gradable outcome when computing post-answer confidence guidance. */
  latestResult?: "correct" | "partially_correct" | "incorrect" | "ungradable" | null;
}

function deriveStage(
  intent: ChallengeIntent,
  objective: DurablePreparationObjective | null | undefined,
  consecutiveFailures: number,
): PedagogyStage {
  if (intent.deliveryContext === "interview" || intent.deliveryContext === "mock") {
    return intent.novelty === "transfer" ? "transfer" : "independent";
  }

  if (intent.novelty === "transfer") {
    return "transfer";
  }

  if (!objective) {
    return consecutiveFailures >= 2 ? "completion" : "independent";
  }

  // Diagnostic checks and due FSRS reviews always probe independently.
  if (objective.diagnosticPending || intent.reasonKind === "due_retrieval") {
    return "independent";
  }

  // ZPD step-down: 2+ consecutive misses step down to completion scaffolding
  // rather than repeating cold failure.
  if (consecutiveFailures >= 2) {
    return "completion";
  }

  // Expertise-reversal fix: honor preparation_strategy on new/unknown objectives.
  if (intent.reasonKind === "new_objective" || objective.readiness === "unknown") {
    if (objective.strategy === "learn") {
      return "worked_example";
    }
    if (objective.strategy === "transfer_practice") {
      return "transfer";
    }
    // diagnose_first, refresh, or unset -> probe independently first.
    return "independent";
  }

  if (objective.readiness === "exposed") {
    return "completion";
  }

  if (objective.readiness === "guided") {
    // Once guided, fade to independent on variant/retest unless recently failing.
    return intent.reasonKind === "recurring_weakness" ? "completion" : "independent";
  }

  return "independent";
}

export function deriveConfidenceFeedbackDirective(
  learnerConfidence: LearnerConfidence | null | undefined,
  latestResult: PedagogyDirectiveInput["latestResult"],
): ConfidenceFeedbackDirective {
  if (!learnerConfidence || !latestResult || latestResult === "ungradable") {
    return "none";
  }
  if (learnerConfidence === "low" && latestResult === "correct") {
    return "confirm_uncertain_success";
  }
  if (learnerConfidence === "high" && latestResult === "incorrect") {
    return "hypercorrection_repair";
  }
  return "none";
}

export function derivePedagogyDirective(
  input: PedagogyDirectiveInput,
): PedagogyDirective {
  const stage = deriveStage(
    input.intent,
    input.objective,
    input.consecutiveFailures ?? 0,
  );
  const scaffold: PedagogyScaffold =
    stage === "worked_example" || stage === "completion" ? "guided" : "independent";
  return {
    scaffold,
    stage,
    confidenceGuidance: deriveConfidenceFeedbackDirective(
      input.learnerConfidence,
      input.latestResult,
    ),
    commitBeforeReveal:
      input.intent.capabilityId === "predict" || input.intent.capabilityId === "debug",
    questionChunking: input.interactionPreferences?.questionChunking ?? "default",
  };
}
