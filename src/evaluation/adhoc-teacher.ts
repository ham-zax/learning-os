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
