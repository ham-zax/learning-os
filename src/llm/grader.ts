/**
 * LLM-based grading for coding solutions and system design submissions.
 */

import type { LLMClient } from "./client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GradingResult {
  score: number; // 0-100
  breakdown: {
    correctness: number; // 0-100
    efficiency: number; // 0-100
    codeQuality: number; // 0-100 (coding only)
    clarity: number; // 0-100 (system design only)
    scalability: number; // 0-100 (system design only)
    tradeOffs: number; // 0-100 (system design only)
  };
  feedback: string; // detailed feedback
  optimalSolution?: string; // for coding: walkthrough of optimal approach
}

export interface CodingSubmission {
  problem: {
    title: string;
    description: string;
    testCases: { input: string; expectedOutput: string }[];
  };
  code: string;
  language: string;
  timeSpentSeconds: number;
}

export interface DesignSubmission {
  problem: {
    title: string;
    description: string;
    rubric: Record<string, string[]>;
  };
  phases: {
    requirements: string;
    highLevel: string;
    deepDive: string;
    tradeOffs: string;
  };
  timeSpentSeconds: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  "You are a senior technical interviewer. Grade solutions rigorously but fairly.";

const TEMPERATURE = 0.2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampScore(value: unknown): number {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseGradingJSON(raw: string): GradingResult {
  // Strip markdown code fences if present.
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  const parsed = JSON.parse(cleaned);

  const breakdown = parsed.breakdown ?? {};

  return {
    score: clampScore(parsed.score),
    breakdown: {
      correctness: clampScore(breakdown.correctness),
      efficiency: clampScore(breakdown.efficiency),
      codeQuality: clampScore(breakdown.codeQuality),
      clarity: clampScore(breakdown.clarity),
      scalability: clampScore(breakdown.scalability),
      tradeOffs: clampScore(breakdown.tradeOffs),
    },
    feedback: String(parsed.feedback ?? ""),
    optimalSolution: parsed.optimalSolution
      ? String(parsed.optimalSolution)
      : undefined,
  };
}

function formatTestCases(
  testCases: { input: string; expectedOutput: string }[]
): string {
  return testCases
    .map(
      (tc, i) =>
        `Test case ${i + 1}:\n  Input:    ${tc.input}\n  Expected: ${tc.expectedOutput}`
    )
    .join("\n\n");
}

function formatRubric(rubric: Record<string, string[]>): string {
  return Object.entries(rubric)
    .map(
      ([criterion, points]) =>
        `${criterion}:\n${points.map((p) => `  - ${p}`).join("\n")}`
    )
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Coding grading
// ---------------------------------------------------------------------------

function buildCodingPrompt(submission: CodingSubmission): string {
  return `Grade the following coding solution.

## Problem
Title: ${submission.problem.title}

${submission.problem.description}

## Test Cases
${formatTestCases(submission.problem.testCases)}

## Candidate's Solution (${submission.language})
\`\`\`${submission.language}
${submission.code}
\`\`\`

Time spent: ${submission.timeSpentSeconds} seconds

## Grading Instructions
1. Check correctness: does the code handle all test cases? Consider edge cases.
2. Evaluate efficiency: what is the time and space complexity? Is it optimal?
3. Assess code quality: readability, naming, structure, idiomatic usage of ${submission.language}.
4. Provide a detailed feedback string covering strengths and weaknesses.
5. Provide an optimalSolution: a concise walkthrough of the optimal approach (algorithm, complexity, key insight).

Return ONLY a JSON object matching this TypeScript type (no markdown fences, no commentary):

{
  "score": number,           // overall 0-100
  "breakdown": {
    "correctness": number,   // 0-100
    "efficiency": number,    // 0-100
    "codeQuality": number,   // 0-100
    "clarity": 0,
    "scalability": 0,
    "tradeOffs": 0
  },
  "feedback": string,
  "optimalSolution": string
}`;
}

export async function gradeCodingSolution(
  client: LLMClient,
  submission: CodingSubmission
): Promise<GradingResult> {
  const prompt = buildCodingPrompt(submission);

  const raw = await client.complete(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    temperature: TEMPERATURE,
    maxTokens: 4096,
  });

  return parseGradingJSON(raw);
}

// ---------------------------------------------------------------------------
// System design grading
// ---------------------------------------------------------------------------

function buildDesignPrompt(submission: DesignSubmission): string {
  return `Grade the following system design submission.

## Problem
Title: ${submission.problem.title}

${submission.problem.description}

## Rubric
${formatRubric(submission.problem.rubric)}

## Candidate's Response

### Phase 1 — Requirements
${submission.phases.requirements}

### Phase 2 — High-Level Design
${submission.phases.highLevel}

### Phase 3 — Deep Dive
${submission.phases.deepDive}

### Phase 4 — Trade-Offs
${submission.phases.tradeOffs}

Time spent: ${submission.timeSpentSeconds} seconds

## Grading Instructions
1. Evaluate each phase against the rubric criteria.
2. Assess clarity: how well does the candidate communicate ideas, use diagrams, and structure the explanation?
3. Assess scalability: does the design handle growth in traffic, data, and users?
4. Assess trade-offs: does the candidate acknowledge limitations and justify decisions?
5. Provide phase-by-phase feedback in the feedback string.

Return ONLY a JSON object matching this TypeScript type (no markdown fences, no commentary):

{
  "score": number,           // overall 0-100
  "breakdown": {
    "correctness": 0,
    "efficiency": 0,
    "codeQuality": 0,
    "clarity": number,       // 0-100
    "scalability": number,   // 0-100
    "tradeOffs": number      // 0-100
  },
  "feedback": string
}`;
}

export async function gradeDesignSolution(
  client: LLMClient,
  submission: DesignSubmission
): Promise<GradingResult> {
  const prompt = buildDesignPrompt(submission);

  const raw = await client.complete(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    temperature: TEMPERATURE,
    maxTokens: 4096,
  });

  return parseGradingJSON(raw);
}
