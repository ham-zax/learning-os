import type { DurablePreparationObjective } from "./onboarding/apply.js";
import type { ChallengeIntent } from "./selection/types.js";

export type PedagogyInteractionForm =
  | "free_recall"
  | "brain_dump"
  | "mcq_quiz"
  | "prediction"
  | "model_construction"
  | "thought_experiment"
  | "boundary_test"
  | "teach_back"
  | "implementation_attempt"
  | "debug_localization"
  | "debug_autopsy"
  | "reconstruction"
  | "worked_example";

export type ScaffoldPosture = "independent" | "prompted" | "guided" | "worked_example";

export interface PedagogyStep {
  form: PedagogyInteractionForm;
  purpose: string;
  questionCount?: number;
  stopAfterPrompt: boolean;
}

export interface PedagogyRecommendation {
  primaryForm: PedagogyInteractionForm;
  steps: PedagogyStep[];
  scaffoldPosture: ScaffoldPosture;
  commitBeforeReveal: boolean;
  questionChunking: "default" | "atomic";
  reason: string;
}

export interface PedagogyRecommendationInput {
  intent: ChallengeIntent;
  objective?: DurablePreparationObjective | null;
  interactionPreferences?: {
    questionChunking: "default" | "atomic";
  } | null;
}

function stableChecksum(value: string): number {
  let checksum = 0;
  for (const char of value) checksum = (checksum + char.charCodeAt(0)) % 997;
  return checksum;
}

function quizQuestionCount(objectiveId: string): number {
  return stableChecksum(objectiveId) % 2 === 0 ? 4 : 5;
}

function shouldUseQuiz(intent: ChallengeIntent): boolean {
  const historySignal = intent.avoidRecentChallenges.reduce(
    (sum, item) => sum + item.attemptId + stableChecksum(item.challengeId),
    0,
  );
  return (stableChecksum(intent.objectiveId) + historySignal) % 2 === 0;
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

function step(
  form: PedagogyInteractionForm,
  purpose: string,
  questionCount?: number,
): PedagogyStep {
  return {
    form,
    purpose,
    questionCount,
    stopAfterPrompt: true,
  };
}

function capabilityFallback(intent: ChallengeIntent): PedagogyStep[] {
  switch (intent.capabilityId) {
    case "explain":
      return [
        step("free_recall", "Retrieve the current model before teaching."),
        step("teach_back", "Make the learner state the mechanism in their own words."),
      ];
    case "predict":
      return [
        step("prediction", "Commit to an observable outcome before reveal."),
        step("boundary_test", "Vary one assumption to test the model boundary."),
      ];
    case "implement":
      return [
        step("implementation_attempt", "Produce an implementation before seeing a worked solution."),
        step("debug_localization", "Localize any failure before repair."),
      ];
    case "debug":
      return [
        step("debug_localization", "Separate observation, hypothesis, and responsible boundary."),
        step("debug_autopsy", "Identify the faulty assumption after assessment."),
      ];
    case "design":
      return [
        step("model_construction", "Construct ownership, boundaries, invariants, and failure paths."),
        step("boundary_test", "Stress the design with a changed constraint or failure."),
      ];
  }
}

function dueRetrievalSteps(intent: ChallengeIntent): { steps: PedagogyStep[]; reason: string } {
  if (shouldUseQuiz(intent)) {
    const count = quizQuestionCount(intent.objectiveId);
    return {
      steps: [
        step("mcq_quiz", "Use several discriminating retrieval items instead of one broad prompt.", count),
        step("teach_back", "After the quiz, require a concise causal explanation of the governing rule."),
      ],
      reason: `This due retrieval rotates to ${count} short discriminating checks before explanation.`,
    };
  }

  if (intent.capabilityId === "predict") {
    return {
      steps: [
        step("prediction", "Use one fresh changed-surface prediction for clean retrieval."),
        step("boundary_test", "Probe the rule with one nearby counterfactual after the prediction."),
      ],
      reason: "This due retrieval rotates away from MCQ recognition toward open prediction.",
    };
  }

  return {
    steps: [
      step("free_recall", "Retrieve the governing mechanism without answer choices or priming."),
      step("teach_back", "Condense the recalled mechanism into a causal explanation."),
    ],
    reason: "This due retrieval rotates away from MCQ recognition toward open recall.",
  };
}

function transferSteps(intent: ChallengeIntent): PedagogyStep[] {
  switch (intent.capabilityId) {
    case "implement":
      return [
        step("implementation_attempt", "Implement on a changed surface without revealing the mapping to the prior solution."),
        step("boundary_test", "Vary one constraint to test whether the implementation preserves the target invariant."),
      ];
    case "debug":
      return [
        step("debug_localization", "Localize a changed-surface failure before receiving the prior analogy."),
        step("thought_experiment", "Test whether the debugging model survives a nearby counterfactual."),
      ];
    case "predict":
      return [
        step("prediction", "Commit to the changed-surface outcome before reveal."),
        step("thought_experiment", "Vary one condition while preserving the same underlying mechanism."),
      ];
    case "explain":
    case "design":
      return [
        step("thought_experiment", "Change the surface while preserving the underlying principle."),
        step("boundary_test", "Ask which assumption makes the transferred reasoning succeed or fail."),
      ];
  }
}

function weaknessSteps(intent: ChallengeIntent): PedagogyStep[] {
  if (intent.capabilityId === "implement") {
    return [
      step("implementation_attempt", "Target the selected weakness with a discriminating implementation surface."),
      step("debug_autopsy", "After assessment, identify the assumption that produced the failure."),
      step("reconstruction", "Rebuild the corrected implementation model before transition."),
    ];
  }
  if (intent.capabilityId === "debug") {
    return [
      step("debug_localization", "Target the selected weakness with a discriminating failure surface."),
      step("debug_autopsy", "After assessment, identify the assumption that produced the failure."),
      step("reconstruction", "Rebuild the corrected debugging model before transition."),
    ];
  }
  return [
    step("model_construction", "Expose the selected weakness through an explicit learner-built model."),
    step("boundary_test", "Use a counterexample that distinguishes the faulty model from the corrected one."),
    step("reconstruction", "Restate the corrected model after feedback."),
  ];
}

export function derivePedagogyRecommendation(
  input: PedagogyRecommendationInput,
): PedagogyRecommendation {
  const { intent, objective } = input;
  const questionChunking = input.interactionPreferences?.questionChunking ?? "default";
  const posture = scaffoldPosture(intent, objective);
  let steps: PedagogyStep[];
  let reason: string;

  if (
    intent.reasonKind === "due_retrieval" &&
    (intent.capabilityId === "explain" || intent.capabilityId === "predict")
  ) {
    ({ steps, reason } = dueRetrievalSteps(intent));
  } else if (intent.reasonKind === "new_objective" && intent.capabilityId === "explain") {
    steps = [
      step("brain_dump", "Externalize the learner's current model without priming it."),
      step("model_construction", "Turn the recalled fragments into an explicit causal model."),
    ];
    reason = "A new explanation objective needs a clean view of the learner's existing model before teaching.";
  } else if (intent.reasonKind === "transfer_needed") {
    steps = transferSteps(intent);
    reason = "Transfer should preserve the selected capability while changing the surface enough to prevent recognition-only success.";
  } else if (intent.weakness) {
    steps = weaknessSteps(intent);
    reason = `The selected ${intent.weakness.lifecycle} weakness should be discriminated directly rather than hidden inside generic questioning.`;
  } else if (
    intent.reasonKind === "reinforcement" &&
    (intent.capabilityId === "explain" || intent.capabilityId === "predict") &&
    shouldUseQuiz(intent)
  ) {
    const count = quizQuestionCount(intent.objectiveId);
    steps = [
      step("mcq_quiz", "Sample several nearby distinctions to avoid rehearsing one memorized surface.", count),
      step("boundary_test", "Probe one near-miss or counterexample after the quiz."),
    ];
    reason = `This reinforcement rotates to ${count} varied checks plus one boundary case.`;
  } else {
    steps = capabilityFallback(intent);
    reason = `Use the default ${intent.capabilityId} interaction repertoire for this selected challenge.`;
  }

  if (posture === "guided" && steps[0]?.form !== "worked_example") {
    steps = [
      step("worked_example", "Supply the minimum structure needed to make productive progress, then withdraw it."),
      ...steps,
    ];
  }

  return {
    primaryForm: steps[0]!.form,
    steps,
    scaffoldPosture: posture,
    commitBeforeReveal:
      intent.capabilityId === "predict" ||
      intent.capabilityId === "debug" ||
      steps.some((candidate) => candidate.form === "thought_experiment"),
    questionChunking,
    reason,
  };
}
