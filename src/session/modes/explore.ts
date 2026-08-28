/**
 * Explore mode — guided discovery.
 *
 * Generates a Socratic sequence of prompts for exploring a concept.
 * This module does NOT interact with the user directly; it returns
 * structured prompts that the CLI or agent can present.
 *
 * Protocol (from SKILL.md):
 *   1. Present concept title only. Ask: "What do you already know?"
 *   2. Ask learner to predict before revealing details.
 *   3. Use Socratic questions — never state facts directly.
 *   4. Reveal incrementally: summary -> key points -> deep dive.
 *   5. End with an assessable learner restatement in their own words.
 *
 * Assessment is owned by the Learning OS kernel, not this presentation module.
 */

import type { ConceptFile } from "../../knowledge/types.js";

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface ExploreStep {
  type: "question" | "reveal";
  content: string;
  section?: string; // which section of the concept file this relates to
}

export interface ExploreSequence {
  conceptId: string;
  title: string;
  steps: ExploreStep[];
  assessmentPrompt: string;
  surfaceId: "restatement";
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate the full sequence of prompts for exploring a concept.
 *
 * The caller presents each step in order, collecting the learner's
 * responses between question steps and showing reveal content directly.
 */
export function generateExploreSequence(concept: ConceptFile): ExploreSequence {
  const { frontmatter, summary, keyPoints, deepDive } = concept;
  const { id, title } = frontmatter;

  const steps: ExploreStep[] = [];

  // Step 1: Activate prior knowledge
  steps.push({
    type: "question",
    content: `What do you already know about **${title}**?`,
  });

  // Step 2: Predict before reveal
  steps.push({
    type: "question",
    content: `Before I reveal the details, what do you think **${title}** means or involves?`,
  });

  // Step 3: Reveal summary
  steps.push({
    type: "reveal",
    content: summary,
    section: "summary",
  });

  // Step 4: Socratic follow-up on summary
  steps.push({
    type: "question",
    content: `Based on that summary, why do you think **${title}** matters? What problems might it solve?`,
  });

  // Step 5: Reveal key points
  steps.push({
    type: "reveal",
    content: formatKeyPoints(keyPoints),
    section: "keyPoints",
  });

  // Step 6: Reflect on key points
  steps.push({
    type: "question",
    content:
      "Which of these points surprised you? Why do you think that one stood out?",
  });

  // Step 7: Reveal deep dive
  steps.push({
    type: "reveal",
    content: deepDive,
    section: "deepDive",
  });

  const assessmentPrompt =
    `Now, can you restate **${title}** in your own words? ` +
    "Explain it as if teaching someone who has never heard of it.";

  return {
    conceptId: id,
    title,
    steps,
    assessmentPrompt,
    surfaceId: "restatement",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format an array of key points into a markdown numbered list.
 */
function formatKeyPoints(keyPoints: string[]): string {
  return keyPoints.map((point, i) => `${i + 1}. ${point}`).join("\n");
}
