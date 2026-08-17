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
 *   5. End with: have learner restate concept in their own words.
 *   6. Grade 0-5 -> run SM-2 -> update state.
 */

import type { ConceptFile } from "../../knowledge/types.js";

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface ExploreStep {
  type: "question" | "reveal" | "prompt";
  content: string;
  section?: string; // which section of the concept file this relates to
}

export interface ExploreSequence {
  conceptId: string;
  title: string;
  steps: ExploreStep[];
  gradingPrompt: string; // final prompt for grading
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

  // Step 8: Restate in own words (this is the graded response)
  steps.push({
    type: "question",
    content:
      `Now, can you restate **${title}** in your own words? Explain it as if teaching someone who has never heard of it.`,
  });

  // Step 9: Grading prompt
  const gradingPrompt = getGradingPrompt(concept, "{{userRestatement}}");
  steps.push({
    type: "prompt",
    content: gradingPrompt,
    section: "grading",
  });

  return {
    conceptId: id,
    title,
    steps,
    gradingPrompt,
  };
}

/**
 * Generate a prompt for the LLM to grade the user's restatement (0-5).
 *
 * The prompt is designed to be sent to an LLM along with the user's
 * restatement. It includes the reference material so the grader can
 * evaluate accuracy and completeness.
 *
 * @param concept         The concept file with all reference content
 * @param userRestatement The learner's restatement to be graded
 */
export function getGradingPrompt(
  concept: ConceptFile,
  userRestatement: string,
): string {
  const { frontmatter, summary, keyPoints, deepDive } = concept;

  return `You are grading a learner's restatement of the concept "${frontmatter.title}".

## Reference Material

**Summary:**
${summary}

**Key Points:**
${formatKeyPoints(keyPoints)}

**Deep Dive:**
${deepDive}

## Learner's Restatement

${userRestatement}

## Grading Criteria

Grade 0-5 using this scale:
- **5 — Perfect**: Accurate, complete, uses own words, demonstrates genuine understanding
- **4 — Good**: Mostly accurate and complete, minor gaps or slightly borrowed phrasing
- **3 — Adequate**: Core idea is correct but missing important details or has minor inaccuracies
- **2 — Partial**: Got the general topic right but key aspects are wrong or missing
- **1 — Minimal**: Mentioned the concept name but restatement is mostly incorrect
- **0 — No recall**: Completely wrong or no attempt

Respond with ONLY a JSON object:
{
  "grade": <0-5>,
  "feedback": "<one sentence explaining the grade>"
}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format an array of key points into a markdown numbered list.
 */
function formatKeyPoints(keyPoints: string[]): string {
  return keyPoints.map((point, i) => `${i + 1}. ${point}`).join("\n");
}
