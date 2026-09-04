import type { DurablePreparationObjective } from "./onboarding/apply.js";
import type { ChallengeIntent } from "./selection/types.js";

export type PedagogyScaffold = "independent" | "guided";

export interface PedagogyDirective {
  scaffold: PedagogyScaffold;
  commitBeforeReveal: boolean;
  questionChunking: "default" | "atomic";
}

export interface PedagogyDirectiveInput {
  intent: ChallengeIntent;
  objective?: DurablePreparationObjective | null;
  interactionPreferences?: {
    questionChunking: "default" | "atomic";
  } | null;
}

function deriveScaffold(
  intent: ChallengeIntent,
  objective: DurablePreparationObjective | null | undefined,
): PedagogyScaffold {
  if (!objective) return "independent";
  if (
    objective.diagnosticPending ||
    intent.reasonKind === "new_objective" ||
    intent.reasonKind === "due_retrieval" ||
    intent.novelty === "transfer" ||
    intent.deliveryContext === "interview" ||
    intent.deliveryContext === "mock"
  ) {
    return "independent";
  }

  return objective.readiness === "guided" || objective.readiness === "exposed"
    ? "guided"
    : "independent";
}

export function derivePedagogyDirective(
  input: PedagogyDirectiveInput,
): PedagogyDirective {
  return {
    scaffold: deriveScaffold(input.intent, input.objective),
    commitBeforeReveal:
      input.intent.capabilityId === "predict" || input.intent.capabilityId === "debug",
    questionChunking: input.interactionPreferences?.questionChunking ?? "default",
  };
}
