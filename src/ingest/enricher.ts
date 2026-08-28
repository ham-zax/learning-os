/**
 * LLM-powered concept enrichment.
 *
 * Takes a concept proposal (title + metadata) and generates full educational
 * content: summary, key points, deep dive, practice questions, and common
 * misconceptions.
 *
 * Falls back to static template content if the LLM is not configured.
 */

import type { LLMClient } from "../llm/client.js";
import type { ConceptProposal } from "../knowledge/types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EnrichedConcept {
  summary: string;
  keyPoints: string[];
  deepDive: string;
  practiceQuestions: string[];
  misconceptions: string[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Enrich a concept proposal with full educational content via LLM.
 *
 * If the LLM client is not configured or the call fails, falls back to
 * a static template with placeholder content.
 *
 * @param client   LLM client (from src/llm/client.ts)
 * @param proposal The concept proposal to enrich
 * @param topic    Topic name for context
 */
export async function enrichConcept(
  client: LLMClient | null,
  proposal: ConceptProposal,
  topic: string,
): Promise<EnrichedConcept> {
  if (!client || !client.isConfigured()) {
    return staticFallback(proposal, topic);
  }

  try {
    const content = await client.complete(buildPrompt(proposal, topic), {
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 4096,
    });

    if (!content) {
      return staticFallback(proposal, topic);
    }

    return parseEnrichmentResponse(content, proposal, topic);
  } catch {
    // LLM call failed — fall back to static content
    return staticFallback(proposal, topic);
  }
}

/**
 * Enrich multiple concepts in sequence (not parallel, to avoid rate limits).
 *
 * @param client   Nexus LLM client
 * @param proposals Concepts to enrich
 * @param topic    Topic name
 * @param onProgress  Optional callback after each concept is enriched
 */
export async function enrichConcepts(
  client: LLMClient | null,
  proposals: ConceptProposal[],
  topic: string,
  onProgress?: (index: number, total: number, title: string) => void,
): Promise<Map<string, EnrichedConcept>> {
  const results = new Map<string, EnrichedConcept>();

  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i];
    onProgress?.(i + 1, proposals.length, proposal.title);
    const enriched = await enrichConcept(client, proposal, topic);
    results.set(proposal.id, enriched);
  }

  return results;
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert educator creating learning material for a spaced-repetition tutor.
Generate clear, accurate, and pedagogically effective content for the given concept.

Respond with a JSON object matching this exact structure:
{
  "summary": "2-3 sentence overview of the concept",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "deepDive": "Detailed explanation (3-5 paragraphs) covering how it works, why it matters, and real-world applications",
  "practiceQuestions": ["question 1", "question 2", "question 3"],
  "misconceptions": ["misconception 1", "misconception 2"]
}

Guidelines:
- summary: concise, captures the essence in 2-3 sentences
- keyPoints: exactly 5, each one sentence, covering the most important aspects
- deepDive: thorough explanation suitable for someone learning the topic, use concrete examples
- practiceQuestions: test understanding, not just recall. Mix "what" and "why" questions
- misconceptions: common errors or oversimplifications learners make

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildPrompt(proposal: ConceptProposal, topic: string): string {
  const parts = [
    `Generate educational content for the concept "${proposal.title}" within the topic "${topic}".`,
    ``,
    `Difficulty: ${proposal.difficulty}/5`,
    `Estimated study time: ${proposal.estimatedMinutes} minutes`,
  ];

  if (proposal.prerequisites.length > 0) {
    parts.push(`Prerequisites: ${proposal.prerequisites.join(", ")}`);
  }

  parts.push(
    ``,
    `The content should be appropriate for difficulty level ${proposal.difficulty} (1=beginner, 5=expert).`,
  );

  return parts.join("\n");
}

// ─── Response Parser ─────────────────────────────────────────────────────────

function parseEnrichmentResponse(
  raw: string,
  proposal: ConceptProposal,
  topic: string,
): EnrichedConcept {
  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : fallbackSummary(proposal, topic),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : fallbackKeyPoints(proposal),
      deepDive: typeof parsed.deepDive === "string" ? parsed.deepDive : fallbackDeepDive(proposal, topic),
      practiceQuestions: Array.isArray(parsed.practiceQuestions) ? parsed.practiceQuestions.map(String) : fallbackQuestions(proposal),
      misconceptions: Array.isArray(parsed.misconceptions) ? parsed.misconceptions.map(String) : [],
    };
  } catch {
    // JSON parse failed — use fallback
    return staticFallback(proposal, topic);
  }
}

// ─── Static Fallback ─────────────────────────────────────────────────────────

function staticFallback(proposal: ConceptProposal, topic: string): EnrichedConcept {
  return {
    summary: fallbackSummary(proposal, topic),
    keyPoints: fallbackKeyPoints(proposal),
    deepDive: fallbackDeepDive(proposal, topic),
    practiceQuestions: fallbackQuestions(proposal),
    misconceptions: [],
  };
}

function fallbackSummary(proposal: ConceptProposal, topic: string): string {
  return `${proposal.title} is a key concept in ${topic}. It requires approximately ${proposal.estimatedMinutes} minutes to study at difficulty level ${proposal.difficulty}/5.`;
}

function fallbackKeyPoints(proposal: ConceptProposal): string[] {
  return [
    `Core idea: ${proposal.title}`,
    `Difficulty level: ${proposal.difficulty}/5`,
    `Study time: ~${proposal.estimatedMinutes} minutes`,
    `Part of the ${proposal.source} learning track`,
    proposal.prerequisites.length > 0
      ? `Builds on: ${proposal.prerequisites.join(", ")}`
      : "Foundational concept — no prerequisites",
  ];
}

function fallbackDeepDive(proposal: ConceptProposal, topic: string): string {
  return [
    `${proposal.title} is an important concept within ${topic}.`,
    `This concept has a difficulty rating of ${proposal.difficulty}/5, suggesting it requires ${proposal.difficulty <= 2 ? "basic" : proposal.difficulty <= 3 ? "intermediate" : "advanced"} understanding.`,
    `To master this concept, focus on understanding the fundamental principles and how they connect to related topics.`,
    `Practice applying this concept in real scenarios to build intuition.`,
  ].join("\n\n");
}

function fallbackQuestions(proposal: ConceptProposal): string[] {
  return [
    `What is ${proposal.title} and why is it important?`,
    `How does ${proposal.title} relate to other concepts in this topic?`,
    `Give an example of when you would use ${proposal.title} in practice.`,
  ];
}
