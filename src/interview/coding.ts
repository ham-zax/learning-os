/**
 * Coding test drill — timed coding practice with external verification and optional LLM feedback.
 *
 * The coding surface never treats source inspection as executable correctness. A compatible
 * agent may run a real verifier in the local workspace and return A2's VerificationOutput;
 * legacy descriptive `test_cases` remain explicitly unverified.
 */

import type { Database } from "better-sqlite3";
import type { LLMClient } from "../llm/client.js";
import type { CodingQualitativeFeedback, CodingSubmission } from "../llm/grader.js";
import { reviewCodingSolutionQualitatively } from "../llm/grader.js";
import type { CodingProblem } from "./problems.js";
import { getCodingProblems } from "./problems.js";
import { getProblem, createLegacyAttempt } from "../db/database.js";
import { VerificationOutputSchema } from "../db/types.js";
import type { Problem, VerificationOutput } from "../db/types.js";

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

export interface CodingVerificationRequest {
  problemId: string;
  artifact: {
    language: string;
    code: string;
  };
  verifier:
    | { kind: "external"; reference: string }
    | {
        kind: "unavailable";
        reason: "descriptive_test_cases" | "no_verification_spec";
        summary: string;
      };
}

export interface CodingVerificationEvidence {
  /** Reference to the real local verifier/spec used by the execution worker. */
  verifierReference: string;
  /** Deterministic result returned by that worker, using A2's stable contract. */
  output: VerificationOutput;
}

export interface CodingSubmissionOptions {
  language?: string;
  verification?: CodingVerificationEvidence;
}

export interface CodingDrillResult {
  problemId: string;
  /** Wall-clock seconds the candidate spent. */
  timeSpentSeconds: number;
  /** Whether the submission finished within the time limit. */
  withinTimeLimit: boolean;
  /** Exact handoff an external/local execution worker can act on. */
  verificationRequest: CodingVerificationRequest;
  /** Null means executable correctness is not verified. */
  verificationOutput: VerificationOutput | null;
  /** Optional LLM commentary; never correctness authority. */
  qualitativeFeedback: CodingQualitativeFeedback | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_TIME_LIMIT_MINUTES = 45;
const DEFAULT_LANGUAGE = "typescript";

// ─── Internal helpers ──────────────────────────────────────────────────────

function parseDescriptiveTestCases(raw: Record<string, unknown>[]): {
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
    testCases: parseDescriptiveTestCases(testCasesRaw).map((tc, i) => ({
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

function normalizeVerificationEvidence(
  evidence: CodingVerificationEvidence | undefined,
): VerificationOutput | null {
  if (!evidence) return null;

  const verifierReference = evidence.verifierReference.trim();
  if (!verifierReference) {
    throw new Error("Coding verification requires a real verifier reference");
  }

  const output = VerificationOutputSchema.parse(evidence.output);
  if (/^(llm|language model|model inspection)\b/i.test(output.basis.trim())) {
    throw new Error("LLM inspection is not a deterministic coding verification basis");
  }

  return VerificationOutputSchema.parse({
    ...output,
    details: {
      ...output.details,
      verifierReference,
    },
  });
}

function formatQualitativeFeedback(feedback: CodingQualitativeFeedback): string {
  return [
    `Complexity: ${feedback.complexityAnalysis}`,
    `Code quality: ${feedback.codeQualityFeedback}`,
    `Interview feedback: ${feedback.interviewFeedback}`,
  ].join("\n");
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Build the coding-side handoff for a compatible local execution worker.
 *
 * `verifierReference` must identify a real executable verifier/spec already known by the
 * caller (for example, a frozen private assessment reference). Legacy `test_cases` do not
 * become executable merely because they contain input/output-shaped strings.
 */
export function createCodingVerificationRequest(
  state: CodingDrillState,
  code: string,
  language: string = DEFAULT_LANGUAGE,
  verifierReference?: string,
): CodingVerificationRequest {
  const reference = verifierReference?.trim();
  const verifier: CodingVerificationRequest["verifier"] = reference
    ? { kind: "external", reference }
    : state.problem.testCases.length > 0
      ? {
          kind: "unavailable",
          reason: "descriptive_test_cases",
          summary: "Stored test_cases are descriptive examples, not an executable verifier specification.",
        }
      : {
          kind: "unavailable",
          reason: "no_verification_spec",
          summary: "No executable verifier specification is available for this coding problem.",
        };

  return {
    problemId: state.problem.id,
    artifact: { language, code },
    verifier,
  };
}

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
 * Submit a coding solution with optional deterministic verification and qualitative review.
 *
 * Verification must already have happened in the agent/local repository environment. This
 * legacy interview path intentionally does not persist VerificationOutput as evidence; B2 will
 * converge interview attempts onto the frozen challenge/assessment kernel contracts.
 */
export async function submitCodingSolution(
  client: LLMClient | null,
  db: Database,
  state: CodingDrillState,
  code: string,
  options?: CodingSubmissionOptions,
): Promise<CodingDrillResult> {
  const lang = options?.language ?? DEFAULT_LANGUAGE;
  const elapsedMs = Date.now() - state.startedAt;
  const timeSpentSeconds = Math.round(elapsedMs / 1000);
  const withinTimeLimit = elapsedMs <= state.timeLimitMs;
  const verificationOutput = normalizeVerificationEvidence(options?.verification);
  const verificationRequest = createCodingVerificationRequest(
    state,
    code,
    lang,
    options?.verification?.verifierReference,
  );

  const submission: CodingSubmission = {
    problem: {
      title: state.problem.title,
      description: state.problem.description,
    },
    code,
    language: lang,
    timeSpentSeconds,
  };

  const qualitativeFeedback = client
    ? await reviewCodingSolutionQualitatively(client, submission)
    : null;

  // Legacy persistence retained pending B2 interview convergence. A qualitative LLM review is
  // stored only as feedback; it does not populate the legacy numeric score or evidence semantics.
  createLegacyAttempt(db, {
    problemId: state.problem.id,
    responseText: code,
    feedback: qualitativeFeedback ? formatQualitativeFeedback(qualitativeFeedback) : undefined,
    timeSpentSeconds,
  });

  return {
    problemId: state.problem.id,
    timeSpentSeconds,
    withinTimeLimit,
    verificationRequest,
    verificationOutput,
    qualitativeFeedback,
  };
}

/**
 * Format a coding drill result as a human-readable summary.
 */
export function formatCodingResult(result: CodingDrillResult): string {
  const lines: string[] = [];

  lines.push(`=== Coding Drill Result ===`);
  lines.push(`Problem:      ${result.problemId}`);
  lines.push(
    `Time:         ${result.timeSpentSeconds}s ${result.withinTimeLimit ? "(within limit)" : "(OVERTIME)"}`,
  );

  if (result.verificationOutput) {
    lines.push(`Verification: ${result.verificationOutput.outcome.toUpperCase()}`);
    lines.push(`Basis:        ${result.verificationOutput.basis}`);
    lines.push(`Summary:      ${result.verificationOutput.summary}`);
  } else {
    lines.push("Verification: UNVERIFIED");
    lines.push(`Reason:       ${result.verificationRequest.verifier.kind === "unavailable"
      ? result.verificationRequest.verifier.summary
      : "No deterministic verification output was supplied."}`);
  }

  if (result.qualitativeFeedback) {
    lines.push("");
    lines.push("--- Qualitative LLM Feedback (not verification) ---");
    lines.push(formatQualitativeFeedback(result.qualitativeFeedback));

    if (result.qualitativeFeedback.optimalSolution) {
      lines.push("");
      lines.push("--- Suggested Approach ---");
      lines.push(result.qualitativeFeedback.optimalSolution);
    }
  }

  return lines.join("\n");
}
