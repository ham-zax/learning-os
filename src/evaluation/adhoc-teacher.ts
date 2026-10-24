import { createHash } from "node:crypto";

/**
 * These prompts are synthetic teaching-policy probes, not copies of private
 * conversation transcripts and not assessable Learning OS learner episodes.
 * Deliberately keep them DB-free: ad-hoc exploration must not invent evidence.
 */
export const adhocTeacherScenarios = [
  {
    id: "changed_question",
    title: "Follow the learner's changed trigonometry question",
    priorContext: "In a previous exchange, the learner understood that on the unit circle cosine gives the horizontal coordinate and sine gives the vertical coordinate. They found further repetitions too slow and want more new insight per turn.",
    learnerMessage: "I understand cosine is how far right and sine how far up. Why do we need the names sine and cosine at all? Why not just x and y? Please don't repeat what I already know.",
    review: [
      "Answers why angle-dependent named functions are useful, rather than re-explaining what x and y mean.",
      "Builds a substantive connection or application beyond the known coordinate fact.",
      "Respects the requested pace and avoids a redundant introductory quiz.",
      "Does not invent durable Learning OS mastery or learner-state operations.",
    ],
  },
  {
    id: "broad_framework_intro",
    title: "Introduce a broad technical framework through a connected causal model",
    priorContext: "A fresh ad-hoc, non-assessed technical teaching session. The learner knows that ordinary JavaScript functions call other functions and has used programming APIs, but has not learned graph-based AI agent orchestration. No Learning OS goal, assessment, or pending question is in scope.",
    learnerMessage: "Use Learning OS and teach me a graph-based AI agent framework. What problem does it solve, how do I build an agent with it, and how do state, branching, and checkpoints fit together?",
    review: [
      "Starts from a concrete agent execution problem and makes the purpose of the graph understandable before accumulating terminology.",
      "Connects multiple substantive concepts into a causal mental model, using the learner's supplied programming knowledge rather than an unrelated glossary.",
      "Controls conceptual density: a useful overview without a definition dump or a full implementation before the core flow is established, and without slowing to one trivial fact.",
      "Uses a diagram, trace, or example only when it actually clarifies a mechanism, with enough explanation to stand without the visual.",
      "May invite one focused construction, prediction, or connection when useful; a sufficient explanation without a question is valid. If it asks a question, it stops without revealing its answer or adding another quiz.",
      "Leaves curriculum, learner proficiency, assessment, and review entirely non-durable; does not claim a check of understanding established mastery.",
    ],
  },
  {
    id: "framework_understood_continue",
    title: "Advance from the demonstrated model instead of restarting the lesson",
    priorContext: "An ad-hoc, non-assessed framework lesson used an order-processing agent: decide → charge tool → decide/finish. The teacher explained nodes, conditional edges, shared state and checkpoint resume, then asked what should survive a pause. The learner has the example in context. No tracked goal or assessment exists.",
    learnerMessage: "The order ID, tool result and next step need to survive, otherwise it might charge again when it resumes. I get how those pieces fit. Continue with how to make the charge safe; don't restart the graph explanation.",
    review: [
      "Briefly acknowledges the demonstrated relationship without claiming mastery or repeating nodes, edges and state from scratch.",
      "Advances to the requested external-side-effect boundary using the same order/charge example.",
      "Distinguishes recovering saved execution state from ensuring a payment is applied once, including the crash window between charging and saving its result.",
      "Explains a concrete safety mechanism such as a stable idempotency key and the payment service's deduplication contract without claiming checkpoints alone guarantee exactly-once effects.",
      "Avoids a redundant comprehension quiz, a prescribed multi-step lesson or durable learner-state operations.",
    ],
  },
  {
    id: "framework_confused_checkpoint",
    title: "Repair one causal misunderstanding without repeating the whole framework",
    priorContext: "An ad-hoc, non-assessed framework lesson used an order-processing agent with a charge tool. The learner has already been introduced to nodes, edges, shared state and checkpoint resume. There is no active tracked challenge or learner evidence. The current discussion is about crashes around tool execution.",
    learnerMessage: "I'm confused. If checkpoints save the state, doesn't that mean the payment can never happen twice? Explain just that connection with the order example. No quiz right now.",
    review: [
      "Addresses the specific inference that saving graph state prevents duplicate external payments, without restarting framework definitions.",
      "Uses a short charge-succeeds → crash-before-checkpoint → retry example to show the missing relationship.",
      "Separates checkpoint recovery from payment-side deduplication or another explicitly bounded side-effect safety mechanism.",
      "Honors the request for explanation without a quiz, prediction prompt or question appended by habit.",
      "Treats the confusion as a conversational observation without scoring, recording evidence, or creating a tracked repair obligation.",
    ],
  },
  {
    id: "knows_basics",
    title: "Honor prior knowledge and move to meditation practice",
    priorContext: "The learner originally asked for meditation from first principles. They subsequently clarified that they already know the basics and want practice, not a restarted beginner explanation. This is an ad-hoc, non-assessed conversation.",
    learnerMessage: "I already know the basics of meditation. Give me a quick refresher and then a practice exercise I can do now.",
    review: [
      "Gives a genuinely brief refresher without restarting from first principles.",
      "Provides immediately actionable practice in the same response.",
      "Does not assign a diagnostic score or claim the learner lacks foundational knowledge.",
      "Keeps the ad-hoc exercise and reflection non-durable unless the learner explicitly opts in.",
    ],
  },
] as const;

export type AdhocTeacherScenarioId = typeof adhocTeacherScenarios[number]["id"];

export function getAdhocTeacherScenario(id: string) {
  return adhocTeacherScenarios.find((scenario) => scenario.id === id) ?? null;
}

/** A provenance/word-count receipt, never an automated pedagogical pass. */
export function inspectAdhocTeacherReply(id: string, reply: string) {
  const scenario = getAdhocTeacherScenario(id);
  if (!scenario) throw new Error(`Unknown ad-hoc teacher scenario: ${id}`);
  if (!reply.trim()) throw new Error("Ad-hoc teacher reply is empty");
  if (Buffer.byteLength(reply, "utf8") > 64 * 1024) {
    throw new Error("Ad-hoc teacher reply exceeds 64 KiB");
  }
  return {
    scenarioId: scenario.id,
    replySha256: createHash("sha256").update(reply, "utf8").digest("hex"),
    wordCount: reply.trim().split(/\s+/u).length,
    reviewCriteria: scenario.review,
    evaluationStatus: "human_review_required" as const,
    limitation: "A supplied text file is not proof of fresh-model provenance. Each criterion needs independent judgment against the actual model reply; this tool neither grades the text nor creates learner state.",
  };
}
