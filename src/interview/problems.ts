/**
 * Problem bank for coding and system design drills.
 *
 * Provides types, DB-backed queries, and generation helpers that produce
 * interview-style problems from concept files.
 */

import type { Database } from "better-sqlite3";
import { createProblem, getProblemsByConcept } from "../db/database.js";
import type { Problem } from "../db/types.js";
import type { ConceptFile } from "../knowledge/types.js";

// ─── Exported types ────────────────────────────────────────────────────────

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
}

export interface CodingProblem {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  testCases: TestCase[];
  conceptId: string | null;
  source: string | null;
  externalId: string | null;
}

export interface DesignRubric {
  requirements: string[];   // what to evaluate in requirements phase
  highLevel: string[];      // what to evaluate in architecture phase
  deepDive: string[];       // what to evaluate in deep-dive phase
  tradeOffs: string[];      // what to evaluate in trade-offs phase
}

export interface SystemDesignProblem {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  rubric: DesignRubric;
  conceptId: string | null;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function isCodingProblem(p: Problem): boolean {
  return p.type === "coding";
}

function isSystemDesignProblem(p: Problem): boolean {
  return p.type === "system-design";
}

function parseTestCases(raw: Record<string, unknown>[]): TestCase[] {
  return raw.map((tc) => ({
    input: String(tc.input ?? ""),
    expectedOutput: String(tc.expectedOutput ?? tc.expected_output ?? ""),
    ...(tc.description !== undefined ? { description: String(tc.description) } : {}),
  }));
}

function parseRubric(raw: string | null): DesignRubric {
  if (!raw) {
    return { requirements: [], highLevel: [], deepDive: [], tradeOffs: [] };
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    requirements: Array.isArray(parsed.requirements) ? parsed.requirements.map(String) : [],
    highLevel: Array.isArray(parsed.highLevel) ? parsed.highLevel.map(String) : [],
    deepDive: Array.isArray(parsed.deepDive) ? parsed.deepDive.map(String) : [],
    tradeOffs: Array.isArray(parsed.tradeOffs) ? parsed.tradeOffs.map(String) : [],
  };
}

function parseTags(raw: string | string[]): string[] {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

function rowToCodingProblem(row: Problem): CodingProblem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty,
    tags: parseTags(row.tags),
    testCases: parseTestCases(row.test_cases as Record<string, unknown>[]),
    conceptId: row.concept_id,
    source: row.source,
    externalId: row.external_id,
  };
}

function rowToSystemDesignProblem(row: Problem): SystemDesignProblem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty,
    tags: parseTags(row.tags),
    rubric: parseRubric(row.rubric),
    conceptId: row.concept_id,
  };
}

// ─── Query functions ───────────────────────────────────────────────────────

/**
 * Fetch coding problems from the database, optionally filtering by concept,
 * difficulty, and limiting the result count.
 */
export function getCodingProblems(
  db: Database,
  options?: { conceptId?: string; difficulty?: number; limit?: number },
): CodingProblem[] {
  let rows: Problem[];

  if (options?.conceptId) {
    rows = getProblemsByConcept(db, options.conceptId).filter(isCodingProblem);
  } else {
    rows = db
      .prepare(`SELECT * FROM problems WHERE type = 'coding' ORDER BY difficulty`)
      .all() as Problem[];
  }

  if (options?.difficulty !== undefined) {
    rows = rows.filter((r) => r.difficulty === options.difficulty);
  }

  if (options?.limit !== undefined) {
    rows = rows.slice(0, options.limit);
  }

  return rows.map(rowToCodingProblem);
}

/**
 * Fetch system-design problems from the database, optionally filtering by
 * concept, difficulty, and limiting the result count.
 */
export function getSystemDesignProblems(
  db: Database,
  options?: { conceptId?: string; difficulty?: number; limit?: number },
): SystemDesignProblem[] {
  let rows: Problem[];

  if (options?.conceptId) {
    rows = getProblemsByConcept(db, options.conceptId).filter(isSystemDesignProblem);
  } else {
    rows = db
      .prepare(`SELECT * FROM problems WHERE type = 'system-design' ORDER BY difficulty`)
      .all() as Problem[];
  }

  if (options?.difficulty !== undefined) {
    rows = rows.filter((r) => r.difficulty === options.difficulty);
  }

  if (options?.limit !== undefined) {
    rows = rows.slice(0, options.limit);
  }

  return rows.map(rowToSystemDesignProblem);
}

// ─── Generation functions ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Generate a coding problem from a concept file.
 *
 * Derives the problem title and description from the concept summary and key
 * points.  Generates test cases from the concept's practice questions and key
 * points so the problem is grounded in the material.
 */
export function generateCodingProblem(concept: ConceptFile): CodingProblem {
  const { frontmatter, summary, keyPoints, deepDive, practiceQuestions } = concept;
  const id = `coding-${slugify(frontmatter.id)}`;

  const keyPointsBlock = keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join("\n");
  const description = [
    `## ${frontmatter.title}`,
    "",
    summary,
    "",
    "### Key Concepts to Apply",
    keyPointsBlock,
    "",
    "### Deep Dive Context",
    deepDive.slice(0, 500),
  ].join("\n");

  // Build test cases from practice questions and key points
  const testCases: TestCase[] = [];

  if (practiceQuestions.length > 0) {
    testCases.push(
      ...practiceQuestions.slice(0, 3).map((pq, i) => ({
        input: `scenario_${i + 1}`,
        expectedOutput: `(solution for: ${pq.slice(0, 80)})`,
        description: pq,
      })),
    );
  }

  // Augment with key-point-derived test cases when practice questions are sparse
  if (testCases.length < 3 && keyPoints.length > 0) {
    const remaining = 3 - testCases.length;
    const kpCases = keyPoints.slice(0, remaining).map((kp, i) => ({
      input: `key_point_${testCases.length + i + 1}`,
      expectedOutput: `(demonstrate understanding of: ${kp.slice(0, 80)})`,
      description: `Implement a solution that demonstrates: ${kp}`,
    }));
    testCases.push(...kpCases);
  }

  return {
    id,
    title: `Coding: ${frontmatter.title}`,
    description,
    difficulty: frontmatter.difficulty,
    tags: [...frontmatter.tags],
    testCases,
    conceptId: frontmatter.id,
    source: "generated",
    externalId: null,
  };
}

/**
 * Generate a system design problem from a concept file.
 *
 * Creates a rubric with four evaluation phases derived from the concept's key
 * points (requirements + high-level) and deep dive (deep-dive + trade-offs).
 */
export function generateSystemDesignProblem(concept: ConceptFile): SystemDesignProblem {
  const { frontmatter, summary, keyPoints, deepDive, practiceQuestions } = concept;
  const id = `sysdesign-${slugify(frontmatter.id)}`;

  const keyPointsBlock = keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join("\n");
  const description = [
    `## System Design: ${frontmatter.title}`,
    "",
    summary,
    "",
    "### Key Areas",
    keyPointsBlock,
    "",
    "### Context",
    deepDive.slice(0, 500),
  ].join("\n");

  // Derive rubric from concept content
  const midpoint = Math.ceil(keyPoints.length / 2);
  const firstHalfKP = keyPoints.slice(0, midpoint);
  const secondHalfKP = keyPoints.slice(midpoint);

  const rubric: DesignRubric = {
    requirements: [
      `Identify functional requirements related to: ${firstHalfKP[0] ?? frontmatter.title}`,
      "Define non-functional requirements (scalability, availability, latency)",
      "Clarify constraints and assumptions",
      ...firstHalfKP.slice(1, 3).map((kp) => `Address requirement: ${kp}`),
    ],
    highLevel: [
      `Design architecture covering: ${frontsummary(summary)}`,
      "Define major components and their responsibilities",
      "Sketch data flow between components",
      ...secondHalfKP.slice(0, 2).map((kp) => `Incorporate: ${kp}`),
    ],
    deepDive: [
      ...keyPoints.slice(0, 3).map((kp) => `Deep dive into: ${kp}`),
      "Discuss data model and storage choices",
      "Address consistency and fault-tolerance mechanisms",
    ],
    tradeOffs: [
      "Discuss CAP theorem implications",
      "Compare alternative approaches and justify choices",
      ...practiceQuestions.slice(0, 2).map((pq) => `Evaluate trade-off: ${pq.slice(0, 100)}`),
      "Identify bottlenecks and scaling strategies",
    ],
  };

  return {
    id,
    title: `System Design: ${frontmatter.title}`,
    description,
    difficulty: Math.min(frontmatter.difficulty + 1, 5), // system design is harder
    tags: [...frontmatter.tags, "system-design"],
    rubric,
    conceptId: frontmatter.id,
  };
}

/** Extract a short phrase from a summary for rubric labels. */
function frontsummary(summary: string): string {
  const firstSentence = summary.split(/[.!?]/)[0] ?? summary;
  return firstSentence.slice(0, 100).trim();
}

// ─── Seeding ───────────────────────────────────────────────────────────────

/**
 * Insert a batch of coding or system design problems into the database.
 * Returns the number of problems successfully inserted.
 */
export function seedProblems(
  db: Database,
  problems: (CodingProblem | SystemDesignProblem)[],
): number {
  let count = 0;

  for (const problem of problems) {
    const isCoding = "testCases" in problem;
    const type = isCoding ? "coding" : "system-design";

    createProblem(db, {
      id: problem.id,
      type,
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      tags: problem.tags,
      testCases: isCoding
        ? (problem as CodingProblem).testCases.map((tc) => ({ ...tc } as Record<string, unknown>))
        : [],
      rubric: !isCoding ? JSON.stringify((problem as SystemDesignProblem).rubric) : undefined,
      conceptId: problem.conceptId ?? undefined,
      source: isCoding ? (problem as CodingProblem).source ?? undefined : "generated",
      externalId: isCoding ? (problem as CodingProblem).externalId ?? undefined : undefined,
    });

    count++;
  }

  return count;
}
