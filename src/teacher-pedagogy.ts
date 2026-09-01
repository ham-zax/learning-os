import type { DurablePreparationObjective } from "./onboarding/apply.js";
import type { ChallengeIntent } from "./selection/types.js";

export type PedagogyInteractionForm =
  | "free_recall"
  | "brain_dump"
  | "mcq_quiz"
  | "prediction"
  | "model_construction"
  | "thought_experiment"
  | "implementation_attempt"
  | "debug_localization";

export type ScaffoldPosture = "independent" | "prompted" | "guided";

export interface PedagogyStep {
  form: PedagogyInteractionForm;
  purpose: string;
  questionCount?: number;
}

export interface PedagogyRecommendation {
  interaction: PedagogyStep;
  scaffoldPosture: ScaffoldPosture;
  commitBeforeReveal: boolean;
  questionChunking: "default" | "atomic";
  maxProbeTurns: number;
  onImpasse: "teach_minimum_then_reconstruct" | "finish_assessment_then_debrief";
  reason: string;
}

export interface PedagogyRecommendationInput {
  intent: ChallengeIntent;
  objective?: DurablePreparationObjective | null;
  interactionPreferences?: {
    questionChunking: "default" | "atomic";
  } | null;
}

function scaffoldPosture(
  intent: ChallengeIntent,
  objective: DurablePreparationObjective | null | undefined,
): ScaffoldPosture {
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
  switch (objective.readiness) {
    case "independent":
    case "unknown":
      return "independent";
    case "guided":
      return "prompted";
    case "exposed":
      return "guided";
  }
}

function impasseAction(intent: ChallengeIntent): PedagogyRecommendation["onImpasse"] {
  return intent.deliveryContext === "interview" || intent.deliveryContext === "mock"
    ? "finish_assessment_then_debrief"
    : "teach_minimum_then_reconstruct";
}

function step(
  form: PedagogyInteractionForm,
  purpose: string,
  questionCount?: number,
): PedagogyStep {
  return { form, purpose, questionCount };
}

function capabilityFallback(intent: ChallengeIntent): PedagogyStep {
  switch (intent.capabilityId) {
    case "explain":
      return step("free_recall", "Ask one compact question that exposes the learner's current model.");
    case "predict":
      return step("prediction", "Commit to one observable outcome before reveal.");
    case "implement":
      return step("implementation_attempt", "Attempt the smallest implementation that still exercises the selected objective.");
    case "debug":
      return step("debug_localization", "Identify the first discriminating observation or test before proposing repair.");
    case "design":
      return step("model_construction", "Build only the ownership, invariant, or flow needed to answer this design question.");
  }
}

function dueRetrievalInteraction(intent: ChallengeIntent): { interaction: PedagogyStep; reason: string } {
  if (intent.capabilityId === "predict") {
    return {
      interaction: step("prediction", "Use one fresh prediction for clean retrieval."),
      reason: "Due retrieval should be short and answer-hidden by default.",
    };
  }

  return {
    interaction: step("free_recall", "Retrieve the governing mechanism without answer choices or priming."),
    reason: "Due retrieval should normally be one compact open recall, not a mandatory quiz batch.",
  };
}

function transferInteraction(intent: ChallengeIntent): PedagogyStep {
  switch (intent.capabilityId) {
    case "implement":
      return step("implementation_attempt", "Implement on a changed surface without revealing the prior mapping.");
    case "debug":
      return step("debug_localization", "Localize a changed-surface failure without revealing the prior analogy.");
    case "predict":
      return step("prediction", "Commit to the changed-surface outcome before reveal.");
    case "explain":
    case "design":
      return step("thought_experiment", "Use one changed-surface scenario that preserves the underlying principle.");
  }
}

function weaknessInteraction(intent: ChallengeIntent): PedagogyStep {
  if (intent.capabilityId === "implement") {
    return step("implementation_attempt", "Isolate the selected weakness in one discriminating implementation task.");
  }
  if (intent.capabilityId === "debug") {
    return step("debug_localization", "Isolate the selected weakness in one discriminating failure surface.");
  }
  return step("model_construction", "Expose the selected weakness with the smallest model that distinguishes the competing explanations.");
}

export function derivePedagogyRecommendation(
  input: PedagogyRecommendationInput,
): PedagogyRecommendation {
  const { intent, objective } = input;
  const questionChunking = input.interactionPreferences?.questionChunking ?? "default";
  const posture = scaffoldPosture(intent, objective);
  let interaction: PedagogyStep;
  let reason: string;

  if (
    intent.reasonKind === "due_retrieval" &&
    (intent.capabilityId === "explain" || intent.capabilityId === "predict")
  ) {
    ({ interaction, reason } = dueRetrievalInteraction(intent));
  } else if (
    intent.reasonKind === "new_objective" &&
    intent.capabilityId === "explain" &&
    intent.deliveryContext !== "interview" &&
    intent.deliveryContext !== "mock"
  ) {
    interaction = step("brain_dump", "Ask one compact prompt that exposes the learner's current model without priming it.");
    reason = "Start a new explanation objective with one compact elicitation. Expand into pattern noticing, guided discovery, or direct teaching only if the learner's response shows that extra structure is useful.";
  } else if (intent.reasonKind === "transfer_needed") {
    interaction = transferInteraction(intent);
    reason = "Transfer should preserve the selected capability while changing the surface enough to prevent recognition-only success.";
  } else if (intent.weakness) {
    interaction = weaknessInteraction(intent);
    reason = `The selected ${intent.weakness.lifecycle} weakness should be discriminated directly rather than hidden inside generic questioning.`;
  } else if (
    intent.reasonKind === "reinforcement" &&
    intent.capabilityId === "explain"
  ) {
    interaction = step("mcq_quiz", "Use a short three-item discrimination check for variety without turning reinforcement into a long quiz.", 3);
    reason = "Explanation reinforcement may use a short recognition check; longer 4-5 item quiz batches are better reserved for an explicit learner request or a dedicated revision round.";
  } else {
    interaction = capabilityFallback(intent);
    reason = `Use the default ${intent.capabilityId} interaction repertoire for this selected challenge.`;
  }

  return {
    interaction,
    scaffoldPosture: posture,
    commitBeforeReveal:
      intent.capabilityId === "predict" ||
      intent.capabilityId === "debug" ||
      interaction.form === "thought_experiment",
    questionChunking,
    maxProbeTurns: 1,
    onImpasse: impasseAction(intent),
    reason,
  };
}
