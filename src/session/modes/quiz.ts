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
  questionIndex: number; // 1-based
  difficulty: number;
}

export interface QuizBatch {
  questions: QuizQuestion[];
  summaryPrompt: string; // shown after all questions answered
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
 * @returns         A QuizBatch with ordered questions and a summary prompt.
 */
export function generateQuizBatch(
  concepts: ConceptFile[],
  count: number = DEFAULT_COUNT,
): QuizBatch {
  const selected = concepts.slice(0, count);
  const questions: QuizQuestion[] = selected.map((concept, index) =>
    buildQuestion(concept, index + 1),
  );

  return {
    questions,
    summaryPrompt: buildSummaryPrompt(questions.length),
  };
}

/**
 * Generate a brief performance summary after a quiz batch.
 *
 * @param results  Graded results for the batch ({ conceptId, grade }[]).
 * @returns        Human-readable summary string.
 */
export function generateQuizSummary(
  results: { conceptId: string; grade: number }[],
): string {
  if (results.length === 0) {
    return "No questions were answered in this batch.";
  }

  const total = results.length;
  const grades = results.map((r) => r.grade);
  const sum = grades.reduce((a, b) => a + b, 0);
  const avg = sum / total;
  const perfect = grades.filter((g) => g === 5).length;
  const strong = grades.filter((g) => g >= 4).length;
  const weak = grades.filter((g) => g < 3).length;

  const lines: string[] = [
    `## Quiz Summary`,
    ``,
    `**Questions answered:** ${total}`,
    `**Average grade:** ${avg.toFixed(1)} / 5`,
    `**Strong recall (4-5):** ${strong}`,
    `**Needs work (0-2):** ${weak}`,
  ];

  if (perfect > 0) {
    lines.push(`**Perfect scores:** ${perfect}`);
  }

  // Performance commentary
  lines.push("");
  if (avg >= 4.5) {
    lines.push(
      "Excellent work! Your recall is strong. The spaced repetition schedule will keep these concepts fresh.",
    );
  } else if (avg >= 3.5) {
    lines.push(
      "Solid performance. A few concepts need more practice — they will come back sooner in your review queue.",
    );
  } else if (avg >= 2.5) {
    lines.push(
      "Mixed results. Consider reviewing the weaker concepts before your next quiz session.",
    );
  } else {
    lines.push(
      "This batch was tough. The concepts with low grades will return quickly for reinforcement — that is by design.",
    );
  }

  // List weak concepts for attention
  if (weak > 0) {
    const weakIds = results
      .filter((r) => r.grade < 3)
      .map((r) => r.conceptId);
    lines.push("");
    lines.push(`**Concepts to revisit:** ${weakIds.join(", ")}`);
  }

  return lines.join("\n");
}

// ─── Internals ───────────────────────────────────────────────────────────────

/**
 * Build a single QuizQuestion from a concept file.
 * Prefers a random practice question; falls back to generating one from key points.
 */
function buildQuestion(concept: ConceptFile, questionIndex: number): QuizQuestion {
  const { id, title, difficulty } = concept.frontmatter;

  const question =
    concept.practiceQuestions.length > 0
      ? pickRandom(concept.practiceQuestions)
      : generateFromKeyPoints(concept);

  return {
    conceptId: id,
    conceptTitle: title,
    question,
    questionIndex,
    difficulty,
  };
}

/**
 * Pick a random element from an array.
 */
function pickRandom<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

/**
 * Generate a practice question from a concept's key points when no
 * explicit practice questions exist. Picks a random key point and
 * wraps it in a recall prompt.
 */
function generateFromKeyPoints(concept: ConceptFile): string {
  if (concept.keyPoints.length === 0) {
    // Absolute fallback — ask about the concept generally
    return `Explain the key ideas behind "${concept.frontmatter.title}" in your own words.`;
  }

  const point = pickRandom(concept.keyPoints);

  // Strip leading markdown formatting (bullet markers, bold wrappers)
  const cleaned = point
    .replace(/^[-*+]\s*/, "")
    .replace(/^\*\*([^*]+)\*\*:?\s*/, "$1: ")
    .trim();

  return `Explain the following concept: ${cleaned}`;
}

/**
 * Build the prompt shown to the learner after all quiz questions are
 * presented but before grading begins. Sets expectations for the
 * answer-then-grade flow.
 */
function buildSummaryPrompt(questionCount: number): string {
  return [
    `You have answered all ${questionCount} questions in this quiz batch.`,
    ``,
    `For each question above, I will now grade your response on a 0-5 scale:`,
    `- **5** — Perfect recall, articulate explanation`,
    `- **4** — Correct with minor hesitation`,
    `- **3** — Correct but needed significant thinking`,
    `- **2** — Wrong but close`,
    `- **1** — Wrong, minimal relevant knowledge`,
    `- **0** — Complete blank or refused`,
    ``,
    `Your grades will update the spaced repetition schedule. Concepts you struggled with will return sooner.`,
  ].join("\n");
}
