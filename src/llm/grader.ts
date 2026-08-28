/**
 * LLM-based qualitative review for coding solutions and grading for system design submissions.
 */

import type { LLMClient } from "./client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GradingResult {
  score: number; // 0-100 (system design only)
  breakdown: {
    correctness: number;
    efficiency: number;
    codeQuality: number;
    clarity: number; // 0-100 (system design only)
    scalability: number; // 0-100 (system design only)
    tradeOffs: number; // 0-100 (system design only)
  };
  feedback: string;
  optimalSolution?: string;
}

export interface CodingQualitativeFeedback {
  complexityAnalysis: string;
  codeQualityFeedback: string;
  interviewFeedback: string;
  optimalSolution?: string;
}

export interface CodingSubmission {
  problem: {
    title: string;
    description: string;
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

function parseCodingQualitativeJSON(raw: string): CodingQualitativeFeedback {
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  const parsed = JSON.parse(cleaned);

  return {
    complexityAnalysis: String(parsed.complexityAnalysis ?? ""),
    codeQualityFeedback: String(parsed.codeQualityFeedback ?? ""),
    interviewFeedback: String(parsed.interviewFeedback ?? ""),
    optimalSolution: parsed.optimalSolution
      ? String(parsed.optimalSolution)
      : undefined,
  };
}

function buildCodingPrompt(submission: CodingSubmission): string {
  return `Review the following coding solution qualitatively.

## Problem
Title: ${submission.problem.title}

${submission.problem.description}

## Candidate's Solution (${submission.language})
\`\`\`${submission.language}
${submission.code}
\`\`\`

Time spent: ${submission.timeSpentSeconds} seconds

## Review Instructions
1. Do not decide whether executable behavior is correct and do not claim that tests passed or failed. No code execution result is available in this review.
2. Analyze apparent time and space complexity, including trade-offs and assumptions.
3. Review readability, naming, structure, and idiomatic use of ${submission.language}.
4. Comment on reasoning/interview communication that can be inferred from the submitted code, while keeping the feedback explicitly qualitative.
5. Provide an optimalSolution: a concise walkthrough of a strong approach (algorithm, complexity, key insight). This is guidance, not verification of the submitted implementation.

Return ONLY a JSON object matching this TypeScript type (no markdown fences, no commentary):

{
  "complexityAnalysis": string,
  "codeQualityFeedback": string,
  "interviewFeedback": string,
  "optimalSolution": string
}`;
}

export async function reviewCodingSolutionQualitatively(
  client: LLMClient,
  submission: CodingSubmission
): Promise<CodingQualitativeFeedback> {
  const prompt = buildCodingPrompt(submission);

  const raw = await client.complete(prompt, {
    systemPrompt:
      "You are a senior technical interviewer providing qualitative code review. Never represent source inspection as execution or verified correctness.",
    temperature: TEMPERATURE,
    maxTokens: 4096,
  });

  return parseCodingQualitativeJSON(raw);
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
