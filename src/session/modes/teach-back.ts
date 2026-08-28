/**
 * Teach-back mode: the learner explains a concept back to the tutor.
 *
 * Protocol (from SKILL.md):
 *   1. Pick a concept the learner has reviewed at least once
 *   2. Say: "Explain {concept} to me like I'm new to this"
 *   3. Play confused: ask follow-up questions on every vague term
 *   4. Challenge: "You said '{vague phrase}' — what specifically does that mean?"
 *   5. Grade based on clarity, accuracy, depth (0-5)
 *
 * This module generates prompts for the tutor to play the confused junior dev.
 */

import type { ConceptFile } from "../../knowledge/types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeachBackSession {
  conceptId: string;
  conceptTitle: string;
  openingPrompt: string;
  challengePrompts: string[]; // generic challenges for vague statements
  gradingPrompt: string;
}

// ─── Generic Challenge Templates ─────────────────────────────────────────────

const CHALLENGE_TEMPLATES: ((phrase: string, conceptTitle: string) => string)[] =
  [
    (phrase) =>
      `You said '${phrase}' — what specifically does that mean in this context?`,
    (_phrase, _conceptTitle) =>
      `Can you give me a concrete example of that?`,
    (_phrase, _conceptTitle) =>
      `What would happen if this worked differently?`,
    (phrase, conceptTitle) =>
      `You mentioned ${phrase} — how does that relate to ${conceptTitle}?`,
    (phrase) =>
      `I'm still confused about ${phrase} — can you rephrase?`,
  ];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a full teach-back session for a concept.
 *
 * Produces the opening prompt (asking the learner to explain), a set of
 * generic challenge templates, and a grading prompt the LLM can use to
 * evaluate the learner's explanation at the end.
 */
export function generateTeachBackSession(concept: ConceptFile): TeachBackSession {
  const { title, id } = concept.frontmatter;

  const openingPrompt =
    `Explain **${title}** to me like I'm new to this topic. ` +
    `I'm a junior developer and I want to really understand it — don't just ` +
    `recite definitions, help me get the intuition.`;

  const challengePrompts = CHALLENGE_TEMPLATES.map((template) =>
    template("{phrase}", title),
  );

  const gradingPrompt = buildGradingPrompt(concept, "{userExplanation}");

  return {
    conceptId: id,
    conceptTitle: title,
    openingPrompt,
    challengePrompts,
    gradingPrompt,
  };
}

/**
 * Generate a specific challenge for a vague statement the learner made.
 *
 * Picks the most appropriate challenge template based on the statement length
 * and content, then fills in the actual phrase.
 */
export function generateChallenge(vagueStatement: string): string {
  const trimmed = vagueStatement.trim();

  // Short fragments are likely technical terms — ask for a concrete example
  if (trimmed.split(/\s+/).length <= 3) {
    return `You mentioned ${trimmed} — can you give me a concrete example of that?`;
  }

  // Longer vague statements — ask them to be more specific
  return `You said '${trimmed}' — can you be more specific?`;
}

/**
 * Generate a grading prompt for the LLM to evaluate a teach-back explanation.
 *
 * The prompt instructs the LLM to grade on a 0-5 scale across four criteria:
 * clarity, accuracy, depth, and use of examples.
 */
export function getTeachBackGradingPrompt(
  concept: ConceptFile,
  userExplanation: string,
): string {
  return buildGradingPrompt(concept, userExplanation);
}

// ─── Internals ───────────────────────────────────────────────────────────────

/**
 * Build the full grading prompt given a concept and the learner's explanation.
 */
function buildGradingPrompt(
  concept: ConceptFile,
  userExplanation: string,
): string {
  const { title } = concept.frontmatter;

  const keyPointsBlock =
    concept.keyPoints.length > 0
      ? concept.keyPoints.map((p) => `- ${p}`).join("\n")
      : "(no key points listed)";

  const misconceptionsBlock =
    concept.misconceptions.length > 0
      ? concept.misconceptions.map((m) => `- ${m}`).join("\n")
      : "(no known misconceptions listed)";

  return [
    `You are grading a learner's teach-back explanation of **${title}**.`,
    ``,
    `## Reference Material`,
    `**Summary:** ${concept.summary}`,
    ``,
    `**Key points (the learner should cover most of these):**`,
    keyPointsBlock,
    ``,
    `**Common misconceptions (penalize if the learner states any of these):**`,
    misconceptionsBlock,
    ``,
    `## Learner's Explanation`,
    userExplanation,
    ``,
    `## Grading Criteria (each scored 0-5)`,
    `1. **Clarity** — Is the explanation easy to follow? Does it avoid unnecessary jargon?`,
    `2. **Accuracy** — Are the claims factually correct? No misconceptions?`,
    `3. **Depth** — Does it go beyond surface-level definitions? Does it explain *why*, not just *what*?`,
    `4. **Use of examples** — Does it include concrete examples or analogies?`,
    ``,
    `## Output Format`,
    `Respond with a JSON object:`,
    `{"clarity": <0-5>, "accuracy": <0-5>, "depth": <0-5>, "examples": <0-5>, "overall": <0-5>, "feedback": "<1-2 sentence summary>"}`,
    ``,
    `"overall" should be the weighted average (accuracy and depth count more than examples).`,
    `Be encouraging but honest. A score of 3 means "adequate", 4 means "good", 5 means "could teach others".`,
  ].join("\n");
}
