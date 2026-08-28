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
import { getProblem } from "../db/database.js";
import { VerificationOutputSchema } from "../db/types.js";
import type { Novelty, Problem, VerificationOutput } from "../db/types.js";
import { getAttempt, getChallenge, openAttempt, submitAttempt } from "../kernel/foundation.js";
import { recordAssessment } from "../kernel/evidence.js";
import { createInterviewSessionForConcept, prepareInterviewChallenge } from "./evidence.js";

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
  /** Challenge novelty is independent from interview delivery context. */
  novelty?: Novelty;
}

export interface CodingDrillState {
  problem: CodingProblem;
  sessionId: number;
  objectiveId: string;
  challengeId: string;
  challengeVersion: number;
  attemptId: number;
  language: string;
  /** Epoch ms when the drill started (Date.now()). */
  startedAt: number;
  /** Time limit in milliseconds. */
  timeLimitMs: number;
}

export interface CodingVerificationRequest {
  problemId: string;
  attemptId: number;
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
  objectiveId: string;
  attemptId: number;
  /** Wall-clock seconds the candidate spent. */
  timeSpentSeconds: number;
  /** Whether the submission finished within the time limit. */
  withinTimeLimit: boolean;
  /** Exact handoff an external/local execution worker can act on. */
  verificationRequest: CodingVerificationRequest;
  /** Null means executable correctness is not verified. */
  verificationOutput: VerificationOutput | null;
  assessmentStatus: "pending" | "recorded";
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
    attemptId: state.attemptId,
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
    }).filter((candidate) => candidate.conceptId !== null);
    if (candidates.length > 0) {
      problem = pickRandom(candidates);
    } else {
      // No concept-linked problem — fall back to random by difficulty
      const fallback = getCodingProblems(db, {
        difficulty: config.difficulty,
      }).filter((candidate) => candidate.conceptId !== null);
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
    }).filter((candidate) => candidate.conceptId !== null);
    if (candidates.length === 0) {
      throw new Error(
        `No coding problems available${config?.difficulty ? ` at difficulty ${config.difficulty}` : ""}.`,
      );
    }
    problem = pickRandom(candidates);
  }

  if (!problem.conceptId) {
    throw new Error(
      `Coding problem ${problem.id} is not mapped to a concept and cannot produce authoritative interview evidence.`,
    );
  }

  const language = config?.language ?? DEFAULT_LANGUAGE;
  const prepared = prepareInterviewChallenge(db, {
    problemId: problem.id,
    conceptId: problem.conceptId,
    capabilityId: "implement",
    taskForm: "implementation",
    publicPrompt: `${problem.title}\n\n${problem.description}`,
    novelty: config?.novelty,
    timeBudgetMinutes: timeLimitMinutes,
    criteria: [
      {
        id: "implementation-verification",
        description:
          "The submitted implementation passes the frozen executable verifier for this coding challenge.",
      },
    ],
    verificationRequired: true,
    verificationBasis: "deterministic_execution",
  });
  const sessionId = createInterviewSessionForConcept(db, problem.conceptId);
  const opened = openAttempt(db, prepared.challenge.id, prepared.challenge.version, sessionId);

  return {
    problem,
    sessionId,
    objectiveId: prepared.objectiveId,
    challengeId: prepared.challenge.id,
    challengeVersion: prepared.challenge.version,
    attemptId: opened.attempt.id,
    language,
    startedAt: Date.now(),
    timeLimitMs,
  };
}

export function assessCodingAttempt(
  db: Database,
  attemptId: number,
  evidence: CodingVerificationEvidence,
): VerificationOutput {
  const attempt = getAttempt(db, attemptId);
  if (!attempt || attempt.submitted_at === null) {
    throw new Error(`Submitted coding attempt not found: ${attemptId}`);
  }
  if (attempt.challenge_id === null || attempt.challenge_version === null) {
    throw new Error(`Coding attempt is not attached to a frozen challenge: ${attemptId}`);
  }

  const challenge = getChallenge(db, attempt.challenge_id, attempt.challenge_version);
  if (
    !challenge ||
    challenge.deliveryContext !== "interview" ||
    challenge.taskForm !== "implementation" ||
    challenge.targets.length !== 1 ||
    challenge.rubric.criteria.length !== 1 ||
    !challenge.verification.required ||
    challenge.verification.basis !== "deterministic_execution"
  ) {
    throw new Error(`Attempt is not a single-objective verified coding interview: ${attemptId}`);
  }

  const verificationOutput = normalizeVerificationEvidence(evidence)!;
  const target = challenge.targets[0];
  const criterion = challenge.rubric.criteria[0];
  const passed = verificationOutput.outcome === "passed";

  recordAssessment(db, attemptId, {
    evaluatorType: "agent",
    assessmentBasis: "deterministic_execution",
    verificationOutput,
    objectiveResults: [
      {
        objectiveId: target.objectiveId,
        result: passed ? "correct" : "incorrect",
        criteriaMet: passed ? [criterion.id] : [],
        criteriaUnmet: passed ? [] : [criterion.id],
        rationale: verificationOutput.summary,
      },
    ],
  });

  return verificationOutput;
}

/**
 * Persist a coding submission first, then optionally attach real deterministic verification and
 * qualitative LLM feedback. Missing verification leaves the authoritative assessment pending.
 */
export async function submitCodingSolution(
  client: LLMClient | null,
  db: Database,
  state: CodingDrillState,
  code: string,
  options?: CodingSubmissionOptions,
): Promise<CodingDrillResult> {
  const lang = options?.language ?? state.language;
  const elapsedMs = Date.now() - state.startedAt;
  const timeSpentSeconds = Math.round(elapsedMs / 1000);
  const withinTimeLimit = elapsedMs <= state.timeLimitMs;

  submitAttempt(db, state.attemptId, {
    responseText: code,
    artifactRef: { kind: "inline_code", language: lang },
  });

  const verificationRequest = createCodingVerificationRequest(
    state,
    code,
    lang,
    options?.verification?.verifierReference,
  );
  const verificationOutput = options?.verification
    ? assessCodingAttempt(db, state.attemptId, options.verification)
    : null;

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

  return {
    problemId: state.problem.id,
    objectiveId: state.objectiveId,
    attemptId: state.attemptId,
    timeSpentSeconds,
    withinTimeLimit,
    verificationRequest,
    verificationOutput,
    assessmentStatus: verificationOutput ? "recorded" : "pending",
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

  lines.push(`Assessment:   ${result.assessmentStatus.toUpperCase()}`);

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
