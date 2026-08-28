/**
 * Coding test drill — timed coding practice with LLM grading.
 *
 * Selects a coding problem (by id, concept, or random difficulty),
 * tracks elapsed time, submits the solution to the LLM grader, and
 * persists the attempt to the database.
 */

import type { Database } from "better-sqlite3";
import type { LLMClient } from "../llm/client.js";
import type { GradingResult, CodingSubmission } from "../llm/grader.js";
import { gradeCodingSolution } from "../llm/grader.js";
import type { CodingProblem } from "./problems.js";
import { getCodingProblems } from "./problems.js";
import { getProblem, createAttempt } from "../db/database.js";
import type { Problem } from "../db/types.js";

/** Minimal row shape accepted by rowToCodingProblem (DB Problem type). */
type ProblemRow = Problem;

// ─── Exported types ────────────────────────────────────────────────────────

export interface CodingDrillConfig {
  /** Specific problem id to load from DB. */
  problemId?: string;
  /** Select a problem linked to this concept. */
  conceptId?: string;
  /** Filter problems by difficulty (1-5). */
  difficulty?: number;
  /** Time limit in minutes. Defaults to 45. */
  timeLimitMinutes?: number;
  /** Programming language. Defaults to 'typescript'. */
  language?: string;
}

export interface CodingDrillState {
  problem: CodingProblem;
  /** Epoch ms when the drill started (Date.now()). */
  startedAt: number;
  /** Time limit in milliseconds. */
  timeLimitMs: number;
}

export interface CodingDrillResult {
  problemId: string;
  /** Overall score 0-100. */
  score: number;
  /** Wall-clock seconds the candidate spent. */
  timeSpentSeconds: number;
  /** Whether the submission finished within the time limit. */
  withinTimeLimit: boolean;
  breakdown: {
    correctness: number;
    efficiency: number;
    codeQuality: number;
  };
  feedback: string;
  optimalSolution: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_TIME_LIMIT_MINUTES = 45;
const DEFAULT_LANGUAGE = "typescript";

// ─── Internal helpers ──────────────────────────────────────────────────────

function parseTestCases(raw: Record<string, unknown>[]): {
  input: string;
  expectedOutput: string;
}[] {
  return raw.map((tc) => ({
    input: String(tc.input ?? ""),
    expectedOutput: String(tc.expectedOutput ?? tc.expected_output ?? ""),
  }));
}

function rowToCodingProblem(row: ProblemRow): CodingProblem {
  const tags: string[] =
    typeof row.tags === "string" ? JSON.parse(row.tags as string) : (row.tags as string[]);
  const testCasesRaw: Record<string, unknown>[] =
    typeof row.test_cases === "string"
      ? JSON.parse(row.test_cases as string)
      : (row.test_cases as Record<string, unknown>[]);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty,
    tags,
    testCases: parseTestCases(testCasesRaw).map((tc, i) => ({
      ...tc,
      description: `Test case ${i + 1}`,
    })),
    conceptId: row.concept_id,
    source: row.source,
    externalId: row.external_id,
  };
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Start a coding drill session.
 *
 * Selection order:
 *   1. If `config.problemId` is provided, load that problem directly.
 *   2. If `config.conceptId` is provided, find a coding problem linked to
 *      that concept (optionally filtered by difficulty). If none exist,
 *      fall through to random selection.
 *   3. Otherwise, pick a random coding problem matching the requested
 *      difficulty (or any difficulty if not specified).
 *
 * @throws if a specific `problemId` is given but not found in the DB.
 */
export function startCodingDrill(
  db: Database,
  config?: CodingDrillConfig,
): CodingDrillState {
  const timeLimitMinutes = config?.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES;
  const timeLimitMs = timeLimitMinutes * 60 * 1000;

  let problem: CodingProblem;

  // 1. Explicit problem id
  if (config?.problemId) {
    const row = getProblem(db, config.problemId);
    if (!row || row.type !== "coding") {
      throw new Error(
        `Coding problem not found or wrong type: ${config.problemId}`,
      );
    }
    problem = rowToCodingProblem(row);
  }
  // 2. Concept-linked problem
  else if (config?.conceptId) {
    const candidates = getCodingProblems(db, {
      conceptId: config.conceptId,
      difficulty: config.difficulty,
    });
    if (candidates.length > 0) {
      problem = pickRandom(candidates);
    } else {
      // No concept-linked problem — fall back to random by difficulty
      const fallback = getCodingProblems(db, {
        difficulty: config.difficulty,
      });
      if (fallback.length === 0) {
        throw new Error(
          `No coding problems available${config.difficulty ? ` at difficulty ${config.difficulty}` : ""}.`,
        );
      }
      problem = pickRandom(fallback);
    }
  }
  // 3. Random by difficulty
  else {
    const candidates = getCodingProblems(db, {
      difficulty: config?.difficulty,
    });
    if (candidates.length === 0) {
      throw new Error(
        `No coding problems available${config?.difficulty ? ` at difficulty ${config.difficulty}` : ""}.`,
      );
    }
    problem = pickRandom(candidates);
  }

  return {
    problem,
    startedAt: Date.now(),
    timeLimitMs,
  };
}

/**
 * Submit a coding solution for grading.
 *
 * 1. Computes wall-clock time spent since `state.startedAt`.
 * 2. Sends the submission to the LLM grader.
 * 3. Persists the attempt in the DB.
 * 4. Returns the graded result.
 */
export async function submitCodingSolution(
  client: LLMClient,
  db: Database,
  state: CodingDrillState,
  code: string,
  language?: string,
): Promise<CodingDrillResult> {
  const lang = language ?? DEFAULT_LANGUAGE;
  const elapsedMs = Date.now() - state.startedAt;
  const timeSpentSeconds = Math.round(elapsedMs / 1000);
  const withinTimeLimit = elapsedMs <= state.timeLimitMs;

  const submission: CodingSubmission = {
    problem: {
      title: state.problem.title,
      description: state.problem.description,
      testCases: state.problem.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
    },
    code,
    language: lang,
    timeSpentSeconds,
  };

  const grading: GradingResult = await gradeCodingSolution(client, submission);

  // Persist attempt
  createAttempt(db, {
    problemId: state.problem.id,
    response: code,
    score: grading.score,
    feedback: grading.feedback,
    timeSpentSeconds,
  });

  return {
    problemId: state.problem.id,
    score: grading.score,
    timeSpentSeconds,
    withinTimeLimit,
    breakdown: {
      correctness: grading.breakdown.correctness,
      efficiency: grading.breakdown.efficiency,
      codeQuality: grading.breakdown.codeQuality,
    },
    feedback: grading.feedback,
    optimalSolution: grading.optimalSolution ?? "",
  };
}

/**
 * Format a coding drill result as a human-readable summary.
 */
export function formatCodingResult(result: CodingDrillResult): string {
  const lines: string[] = [];

  lines.push(`=== Coding Drill Result ===`);
  lines.push(`Problem:  ${result.problemId}`);
  lines.push(`Score:    ${result.score}/100`);
  lines.push(
    `Time:     ${result.timeSpentSeconds}s ${result.withinTimeLimit ? "(within limit)" : "(OVERTIME)"}`,
  );
  lines.push("");

  lines.push("--- Breakdown ---");
  lines.push(`  Correctness:  ${result.breakdown.correctness}/100`);
  lines.push(`  Efficiency:   ${result.breakdown.efficiency}/100`);
  lines.push(`  Code Quality: ${result.breakdown.codeQuality}/100`);
  lines.push("");

  if (result.feedback) {
    lines.push("--- Feedback ---");
    lines.push(result.feedback);
    lines.push("");
  }

  if (result.optimalSolution) {
    lines.push("--- Optimal Solution ---");
    lines.push(result.optimalSolution);
  }

  return lines.join("\n");
}
