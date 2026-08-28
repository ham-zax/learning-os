/**
 * Quiz mode — retrieval practice generator.
 *
 * Generates quiz batches from concept files. Each batch contains one
 * random practice question per concept (falling back to key-point-based
 * generation if none exist). This module produces prompts only; it does
 * not interact with the user or mutate state.
 */

import type { ConceptFile } from "../../knowledge/types.js";

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface QuizQuestion {
  conceptId: string;
  conceptTitle: string;
  question: string;
  questionIndex: number; // 1-based within the generated batch
  difficulty: number;
  surfaceId: string;
}

export interface QuizBatch {
  questions: QuizQuestion[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COUNT = 5;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a batch of quiz questions from concept files.
 *
 * Selection strategy:
 * - Pick 1 random practice question per concept.
 * - If a concept has no practice questions, generate one from its key points.
 * - Due concepts appear first, followed by interleaved reviewed concepts.
 *
 * @param concepts  Concept files to draw questions from.
 * @param count     Maximum number of questions (default 5).
 * @returns         A QuizBatch with ordered learner-facing questions.
 */
export function generateQuizBatch(
  concepts: ConceptFile[],
  count: number = DEFAULT_COUNT,
): QuizBatch {
  const selected = concepts.slice(0, count);
  const questions: QuizQuestion[] = selected.map((concept, index) =>
    buildQuestion(concept, index + 1),
  );

  return { questions };
}

// ─── Internals ───────────────────────────────────────────────────────────────

/**
 * Build a single QuizQuestion from a concept file.
 * Prefers a random practice question; falls back to generating one from key points.
 */
function buildQuestion(concept: ConceptFile, questionIndex: number): QuizQuestion {
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
