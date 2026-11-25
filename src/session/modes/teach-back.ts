/**
 * Teach-back (Feynman) mode: the learner explains a concept plainly in their
 * own words, gets at most one focused jargon/mechanism probe when an answer is
 * terse or hand-wavy, and then compares against reference material.
 *
 * Protocol:
 *   1. Ask the learner to explain the concept plainly without reciting slogans.
 *   2. If the response relies on vague shorthand or skips the mechanism, ask
 *      one neutral clarification probe targeting that phrase or concrete case.
 *   3. Stop probing when the explanation is already concrete and mechanistic.
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

export interface FeynmanFollowUp {
  reason: "vague_jargon" | "short_answer";
  phrase: string | null;
  prompt: string;
}

/** Upper bound on offline CLI Feynman follow-up probes per concept. */
export const MAX_FEYNMAN_FOLLOWUPS = 1;

// ─── Vague-Jargon Heuristics & Generic Challenge Templates ──────────────────

const VAGUE_PHRASE_PATTERNS: ReadonlyArray<{ pattern: RegExp; label?: string }> = [
  { pattern: /\bunder the hood\b/i },
  { pattern: /\bjust works\b/i },
  { pattern: /\bmagically\b/i },
  { pattern: /\bautomatically\b/i },
  { pattern: /\bhandles?\s+(?:it|everything|that|concurrency|errors|retries)\b/i },
  { pattern: /\btakes?\s+care\s+of\s+(?:it|that|everything)\b/i },
  { pattern: /\bkeeps?\s+(?:it|things|data)\s+(?:consistent|safe|in sync)\b/i },
  { pattern: /\bmakes?\s+(?:it|things)\s+(?:safe|fast|atomic|consistent|scalable)\b/i },
  { pattern: /\bsomehow\b/i },
  { pattern: /\betc\.?(?:\s|$)/i, label: "etc." },
];

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

const MIN_SUBSTANTIVE_WORDS = 12;

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
    `recite definitions, walk through the concrete mechanism in plain language.`;

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
    return `You mentioned '${trimmed}' — what concretely happens there? Can you give a quick example?`;
  }

  // Longer vague statements — ask them to unpack the mechanism specifically
  return `You said '${trimmed}' — what specifically happens step by step?`;
}

/**
 * Inspect an initial teach-back explanation and return one focused Feynman
 * clarification probe when the response leans on vague shorthand or is too
 * terse to show the underlying mechanism. Returns null when the response is
 * already concrete and substantive (honoring the stop rule).
 */
export function selectFeynmanFollowUp(
  responseText: string,
  concept: ConceptFile | null,
): FeynmanFollowUp | null {
  const trimmed = responseText.trim();
  if (!trimmed) return null;

  for (const { pattern, label } of VAGUE_PHRASE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match) {
      const phrase = (label ?? match[0]).trim();
      return {
        reason: "vague_jargon",
        phrase,
        prompt: generateChallenge(phrase),
      };
    }
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_SUBSTANTIVE_WORDS) {
    const title = concept?.frontmatter.title;
    const prompt = title
      ? `That's a compact summary of ${title} — can you walk through one concrete step-by-step example in plain language?`
      : "That's a compact summary — can you walk through one concrete step-by-step example in plain language?";
    return {
      reason: "short_answer",
      phrase: null,
      prompt,
    };
  }

  return null;
}
