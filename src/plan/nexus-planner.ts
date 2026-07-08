/**
 * LLM-enhanced learning plan generator.
 *
 * Uses the Nexus LLM client to produce smarter learning plans that consider:
 * - Market demand (skill gaps from job-hunter)
 * - Learning dependencies (prerequisite graph)
 * - Optimal session pacing (based on SM-2 history)
 * - Goal-driven prioritization
 *
 * Falls back to the deterministic planner if LLM is not configured.
 */

import type Database from "better-sqlite3";
import type { LLMClient } from "../llm/client.js";
import { generateLearningPlan } from "./planner.js";
import type { LearningPlan, PlanSession } from "../knowledge/types.js";
import type { SkillGap } from "../integrations/job-hunter.js";
import { getConceptsByTopic, getTopic } from "../db/database.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EnhancedPlanOptions {
  db: Database.Database;
  topicId: string;
  goal: string;
  deadline?: string;
  dailyMinutes?: number;
  gaps?: SkillGap[];
  llmClient?: LLMClient | null;
}

export interface PlanRecommendation {
  plan: LearningPlan;
  rationale: string;
  focusAreas: string[];
  estimatedCompletionDate: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an enhanced learning plan using LLM analysis.
 *
 * If the LLM client is available, it analyzes the concept graph, skill gaps,
 * and goal to produce a prioritized plan with rationale. Otherwise, falls
 * back to the deterministic planner.
 */
export async function generateEnhancedPlan(
  options: EnhancedPlanOptions,
): Promise<PlanRecommendation> {
  const { db, topicId, goal, deadline, dailyMinutes = 30, gaps = [], llmClient } = options;

  // Always generate the base plan deterministically
  const basePlan = generateLearningPlan({
    db,
    topicId,
    goal,
    deadline,
    dailyMinutes,
    gaps,
  });

  // If no LLM or no concepts, return the base plan with simple rationale
  if (!llmClient?.isConfigured() || basePlan.sessions.length === 0) {
    return {
      plan: basePlan,
      rationale: gaps.length > 0
        ? `Plan prioritizes ${gaps.length} skill gap(s) from job market data.`
        : `Plan follows prerequisite order with ${dailyMinutes} minutes per day.`,
      focusAreas: gaps.slice(0, 5).map((g) => g.skill),
      estimatedCompletionDate: basePlan.sessions[basePlan.sessions.length - 1]?.targetDate ?? null,
    };
  }

  // Use LLM to enhance the plan with rationale and focus areas
  try {
    const topic = getTopic(db, topicId);
    const concepts = getConceptsByTopic(db, topicId);

    const prompt = buildAnalysisPrompt(
      topic?.name ?? topicId,
      goal,
      concepts.map((c) => ({
        id: c.id,
        title: c.title,
        difficulty: c.difficulty,
        status: c.status,
        prerequisites: c.prerequisites,
      })),
      gaps,
      deadline,
      dailyMinutes,
    );

    const content = await llmClient.complete(prompt, {
      systemPrompt: PLAN_SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 2048,
    });

    if (!content) {
      return { plan: basePlan, rationale: "LLM returned empty response.", focusAreas: [], estimatedCompletionDate: null };
    }

    const analysis = parsePlanAnalysis(content);

    return {
      plan: basePlan,
      rationale: analysis.rationale,
      focusAreas: analysis.focusAreas,
      estimatedCompletionDate: basePlan.sessions[basePlan.sessions.length - 1]?.targetDate ?? null,
    };
  } catch {
    // LLM failed — return base plan
    return {
      plan: basePlan,
      rationale: "LLM analysis unavailable. Plan follows standard prerequisite order.",
      focusAreas: gaps.slice(0, 5).map((g) => g.skill),
      estimatedCompletionDate: basePlan.sessions[basePlan.sessions.length - 1]?.targetDate ?? null,
    };
  }
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const PLAN_SYSTEM_PROMPT = `You are a learning advisor analyzing a study plan. Provide a concise analysis of the plan.

Respond with a JSON object:
{
  "rationale": "2-3 sentences explaining the plan strategy and why concepts are ordered this way",
  "focusAreas": ["area 1", "area 2", "area 3"]
}

Guidelines:
- rationale: explain the prioritization logic (gap-driven, prerequisite-driven, or goal-driven)
- focusAreas: 3-5 specific skill areas the learner should focus on most
- Be practical and actionable

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildAnalysisPrompt(
  topicName: string,
  goal: string,
  concepts: Array<{
    id: string;
    title: string;
    difficulty: number;
    status: string;
    prerequisites: string[];
  }>,
  gaps: SkillGap[],
  deadline?: string,
  dailyMinutes?: number,
): string {
  const lines = [
    `Topic: ${topicName}`,
    `Goal: ${goal}`,
    deadline ? `Deadline: ${deadline}` : "No deadline set",
    `Daily study time: ${dailyMinutes} minutes`,
    ``,
    `Concepts (${concepts.length}):`,
  ];

  for (const c of concepts) {
    const prereqs = c.prerequisites.length > 0 ? ` [prereqs: ${c.prerequisites.join(", ")}]` : "";
    lines.push(`  - ${c.title} (difficulty: ${c.difficulty}/5, status: ${c.status})${prereqs}`);
  }

  if (gaps.length > 0) {
    lines.push("", "Skill gaps from job market:");
    for (const g of gaps.slice(0, 10)) {
      lines.push(`  - ${g.skill} (frequency: ${g.frequency})`);
    }
  }

  return lines.join("\n");
}

// ─── Response Parser ─────────────────────────────────────────────────────────

function parsePlanAnalysis(raw: string): { rationale: string; focusAreas: string[] } {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "Plan follows prerequisite order.",
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.map(String) : [],
    };
  } catch {
    return {
      rationale: "Plan follows prerequisite order.",
      focusAreas: [],
    };
  }
}
