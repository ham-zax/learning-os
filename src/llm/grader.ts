/**
 * LLM-based qualitative review for coding solutions and grading for system design submissions.
 */

import type { LLMClient } from "./client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
    criteria: Array<{
      id: string;
      description: string;
      required: boolean;
    }>;
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

const TEMPERATURE = 0.2;

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
// System design rubric assessment
// ---------------------------------------------------------------------------

export interface DesignCriterionAssessment {
  criterionId: string;
  met: boolean;
  rationale: string;
}

export interface DesignRubricAssessment {
  criteria: DesignCriterionAssessment[];
  feedback: string;
}

function parseDesignAssessmentJSON(raw: string): DesignRubricAssessment {
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const criteria = Array.isArray(parsed.criteria) ? parsed.criteria : [];

  return {
    criteria: criteria.map((entry) => {
      const value = entry as Record<string, unknown>;
      if (typeof value.met !== "boolean") {
        throw new Error("Design rubric assessment criterion must classify met as boolean");
      }
      return {
        criterionId: String(value.criterionId ?? ""),
        met: value.met,
        rationale: String(value.rationale ?? ""),
      };
    }),
    feedback: String(parsed.feedback ?? ""),
  };
}

function buildDesignPrompt(submission: DesignSubmission): string {
  const criteria = submission.problem.criteria
    .map(
      (criterion) =>
        `- ${criterion.id} [${criterion.required ? "required" : "optional"}]: ${criterion.description}`,
    )
    .join("\n");

  return `Assess the following system design submission against the frozen rubric only.

## Problem
Title: ${submission.problem.title}

${submission.problem.description}

## Frozen Criteria
${criteria}

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

## Assessment Instructions
1. Classify every frozen criterion exactly once as met or unmet.
2. Use only the frozen criterion descriptions above; do not invent new success criteria from the response.
3. Give a concise rationale for each classification.
4. Provide optional overall feedback, but do not return a numeric score.

Return ONLY JSON matching this shape:
{
  "criteria": [
    { "criterionId": string, "met": boolean, "rationale": string }
  ],
  "feedback": string
}`;
}

export async function assessDesignAgainstRubric(
  client: LLMClient,
  submission: DesignSubmission,
): Promise<DesignRubricAssessment> {
  const raw = await client.complete(buildDesignPrompt(submission), {
    systemPrompt:
      "You are a system design evaluator. Assess only the frozen rubric criteria supplied by the caller and classify every criterion explicitly.",
    temperature: TEMPERATURE,
    maxTokens: 4096,
  });

  return parseDesignAssessmentJSON(raw);
}
