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
    id: "database_index_tradeoff",
    title: "Explain a trade-off beyond the familiar example domain",
    priorContext: "An ad-hoc conversation about a read-heavy orders table. The learner knows an index can reduce rows examined for a lookup and asks why indexing every column is not the default. No tracked episode exists.",
    learnerMessage: "I get why an index helps a lookup. Why not index every column? Explain the write and storage trade-offs with the orders table. No quiz.",
    review: [
      "Answers the actual trade-off instead of restarting the lookup introduction.",
      "Connects inserts, updates and deletes to maintaining relevant index entries, with storage costs and query-specific benefit.",
      "Uses the orders example and avoids an unconditional claim that more indexes always improve reads or always harm every write equally.",
      "Honors the no-quiz request without creating learner state or claiming mastery.",
    ],
  },
  {
    id: "recursion_missing_model",
    title: "Teach an identified missing relationship instead of interrogating",
    priorContext: "An ad-hoc recursion lesson used sum(3) calling sum(2), then sum(1), with sum(0) returning 0. The learner can follow calls toward the base case but cannot explain how earlier calls finish. No assessment is active.",
    learnerMessage: "I can follow the calls down to zero, but I don't understand how the earlier calls get their answers. Please teach that part before asking me to predict anything.",
    review: [
      "Explains the pending addition in each caller and how the returned value lets that caller finish.",
      "Traces a small return path with consistent values rather than repeating only the base-case definition.",
      "Addresses the stated gap directly without a diagnostic interrogation or prediction exercise.",
      "Does not confuse a clear explanation with evidence of independent learner performance.",
    ],
  },
  {
    id: "requested_depth",
    title: "Give requested depth without arbitrary response-length optimization",
    priorContext: "An ad-hoc browser discussion established that a closure retains access to bindings from its lexical scope. The learner wants a deeper connection to event callbacks. No Learning OS profile or assessment is involved.",
    learnerMessage: "Go deeper: use a counter captured by two callbacks to explain why both can see updates. Then show how capturing a copied value differs. I want the mechanism, not just a short definition. Explain without a quiz.",
    review: [
      "Distinguishes shared access to a mutable binding from a separately captured snapshot value.",
      "Provides a small internally consistent example or trace for both cases and connects the observed difference to the mechanism.",
      "Gives the requested depth without substituting a terse glossary or unrelated closure topics.",
      "Honors explanation-only and does not claim durable mastery from reading the example.",
    ],
  },
  {
    id: "research_unavailable",
    title: "Preserve useful teaching when current API research is unavailable",
    priorContext: "An ad-hoc programming lesson. The learner asks about a framework's latest API, but the teacher has no network access, no versioned local documentation and no installed project. The teacher cannot verify a current release. No tracked episode exists.",
    learnerMessage: "Show me how the latest version of an agent framework saves progress. If you cannot check its current API, explain the mechanism and mark what you cannot verify. No installation and no quiz.",
    review: [
      "Discloses that the current release and API cannot be verified under the supplied capabilities.",
      "Still explains persistence and resume conceptually without inventing an API signature, citation or retrieval.",
      "Distinguishes a conceptual example from verified current executable code.",
      "Honors the no-installation and no-quiz constraints and creates no learner state.",
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
