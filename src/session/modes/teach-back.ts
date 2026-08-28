/**
 * Teach-back mode: the learner explains a concept back to the tutor.
 *
 * Protocol (from SKILL.md):
 *   1. Pick a concept the learner has reviewed at least once
 *   2. Say: "Explain {concept} to me like I'm new to this"
 *   3. Play confused: ask follow-up questions on every vague term
 *   4. Challenge: "You said '{vague phrase}' — what specifically does that mean?"
 *
 * This module generates learner-facing prompts only. Assessment is owned by
 * the Learning OS kernel against a frozen rubric.
 */

import type { ConceptFile } from "../../knowledge/types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeachBackSession {
  conceptId: string;
  conceptTitle: string;
  openingPrompt: string;
  challengePrompts: string[]; // generic challenges for vague statements
  surfaceId: "teach-back";
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
 * Produces the opening prompt (asking the learner to explain) and a set of
 * generic challenge templates for follow-up interaction.
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

  return {
    conceptId: id,
    conceptTitle: title,
    openingPrompt,
    challengePrompts,
    surfaceId: "teach-back",
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
