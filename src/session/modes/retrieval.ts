/**
 * Retrieval-practice presentation strategy.
 *
 * Generates retrieval batches from concept files. Each batch contains one
 * random practice question per concept (falling back to key-point-based
 * generation if none exist). This module produces prompts only; it does
 * not interact with the user or mutate state.
 */

import type { ConceptFile } from "../../knowledge/types.js";

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface RetrievalQuestion {
  conceptId: string;
  conceptTitle: string;
  question: string;
  questionIndex: number; // 1-based within the generated batch
  difficulty: number;
  surfaceId: string;
}

export interface RetrievalBatch {
  questions: RetrievalQuestion[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COUNT = 5;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a batch of retrieval questions from concept files.
 *
 * Selection strategy:
 * - Pick 1 random practice question per concept.
 * - If a concept has no practice questions, generate one from its key points.
 * - Due concepts appear first, followed by interleaved reviewed concepts.
 *
 * @param concepts  Concept files to draw questions from.
 * @param count     Maximum number of questions (default 5).
 * @returns         A retrieval batch with ordered learner-facing questions.
 */
export function generateRetrievalBatch(
  concepts: ConceptFile[],
  count: number = DEFAULT_COUNT,
): RetrievalBatch {
  const selected = concepts.slice(0, count);
  const questions: RetrievalQuestion[] = selected.map((concept, index) =>
    buildQuestion(concept, index + 1),
  );

  return { questions };
}

// ─── Internals ───────────────────────────────────────────────────────────────

/**
 * Build one retrieval question from a concept file.
 * Prefers a random practice question; falls back to generating one from key points.
 */
function buildQuestion(concept: ConceptFile, questionIndex: number): RetrievalQuestion {
  const { id, title, difficulty } = concept.frontmatter;

  let question: string;
  let surfaceId: string;

  if (concept.practiceQuestions.length > 0) {
    const selectedIndex = randomIndex(concept.practiceQuestions.length);
    question = concept.practiceQuestions[selectedIndex];
    const canonicalIndex = concept.practiceQuestions.findIndex(
      (candidate: string) => candidate === question,
    );
    surfaceId = `practice-question-${canonicalIndex + 1}`;
  } else if (concept.keyPoints.length > 0) {
    const selectedIndex = randomIndex(concept.keyPoints.length);
    const point = concept.keyPoints[selectedIndex];
    const canonicalIndex = concept.keyPoints.findIndex(
      (candidate: string) => candidate === point,
    );
    question = promptFromKeyPoint(point);
    surfaceId = `key-point-${canonicalIndex + 1}`;
  } else {
    question = `Explain the key ideas behind "${title}" in your own words.`;
    surfaceId = "general-explanation";
  }

  return {
    conceptId: id,
    conceptTitle: title,
    question,
    questionIndex,
    difficulty,
    surfaceId,
  };
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

function promptFromKeyPoint(point: string): string {
  const cleaned = point
    .replace(/^[-*+]\s*/, "")
    .replace(/^\*\*([^*]+)\*\*:?\s*/, "$1: ")
    .trim();

  return `Explain the following concept: ${cleaned}`;
}
