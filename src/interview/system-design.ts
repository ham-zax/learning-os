/**
 * System design drill — phased interview simulation.
 *
 * Walks through four phases (requirements, high-level, deep-dive, trade-offs),
 * collects the candidate's responses, then grades everything via the LLM grader.
 */

import type { Database } from "better-sqlite3";
import { getSystemDesignProblems } from "./problems.js";
import type { SystemDesignProblem } from "./problems.js";
import { gradeDesignSolution } from "../llm/grader.js";
import type { DesignSubmission, GradingResult } from "../llm/grader.js";
import type { LLMClient } from "../llm/client.js";
import { createLegacyAttempt } from "../db/database.js";

// ─── Exported types ────────────────────────────────────────────────────────

export interface DesignDrillConfig {
  problemId?: string;
  conceptId?: string;
  difficulty?: number;
  phaseTimeLimitMinutes?: {
    requirements?: number; // default 5
    highLevel?: number;    // default 10
    deepDive?: number;     // default 20
    tradeOffs?: number;    // default 10
  };
}

export interface DesignDrillState {
  problem: SystemDesignProblem;
  currentPhase: "requirements" | "highLevel" | "deepDive" | "tradeOffs" | "complete";
  phases: {
    requirements: string;
    highLevel: string;
    deepDive: string;
    tradeOffs: string;
  };
  startedAt: number;
}

export interface DesignDrillResult {
  problemId: string;
  score: number; // 0-100
  timeSpentSeconds: number;
  phaseScores: {
    requirements: number;
    highLevel: number;
    deepDive: number;
    tradeOffs: number;
  };
  feedback: string;
  phaseFeedback: Record<string, string>;
}

export interface InterviewerPrompt {
  phase: string;
  prompt: string;
  followUp?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PHASE_ORDER: DesignDrillState["currentPhase"][] = [
  "requirements",
  "highLevel",
  "deepDive",
  "tradeOffs",
];

const DEFAULT_PHASE_LIMITS: Required<NonNullable<DesignDrillConfig["phaseTimeLimitMinutes"]>> = {
  requirements: 5,
  highLevel: 10,
  deepDive: 20,
  tradeOffs: 10,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function extractFirstComponent(problem: SystemDesignProblem): string {
  // Try to pull a component name from the first rubric deepDive entry.
  const first = problem.rubric.deepDive[0];
  if (first) {
    const match = first.match(/(?:deep dive into|component|service|module)[:\s]*(.+)/i);
    if (match?.[1]) return match[1].trim();
  }
  // Fallback: first tag or the problem title.
  return problem.tags[0] ?? problem.title.replace(/^System Design:\s*/i, "");
}

/** Parse phaseFeedback strings out of the grader's free-form feedback text. */
function parsePhaseFeedback(
  feedback: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  const phases = ["requirements", "highLevel", "deepDive", "tradeOffs"] as const;

  for (const phase of phases) {
    // Look for headings like "Phase 1 — Requirements" or "### Requirements"
    const patterns = [
      new RegExp(
        `(?:(?:phase\\s*\\d+[^\\n]*?${phase})|(?:#{1,4}\\s*${phase}))\\s*[:\\-—]?\\s*\\n([\\s\\S]*?)(?=\\n(?:phase\\s*\\d+|#{1,4}\\s)|$)`,
        "i",
      ),
    ];

    // Also try the human-readable label.
    const labelMap: Record<string, string> = {
      requirements: "requirements",
      highLevel: "high[-\\s]?level",
      deepDive: "deep[-\\s]?dive",
      tradeOffs: "trade[-\\s]?offs",
    };
    const label = labelMap[phase] ?? phase;
    patterns.push(
      new RegExp(
        `(?:(?:phase\\s*\\d+[^\\n]*?${label})|(?:#{1,4}\\s*${label}))\\s*[:\\-—]?\\s*\\n([\\s\\S]*?)(?=\\n(?:phase\\s*\\d+|#{1,4}\\s)|$)`,
        "i",
      ),
    );

    for (const pattern of patterns) {
      const match = feedback.match(pattern);
      if (match?.[1]?.trim()) {
        result[phase] = match[1].trim();
        break;
      }
    }

    // If no structured match, leave it absent — the caller can fall back to
    // the overall feedback.
  }

  return result;
}

/** Distribute an overall score across phases heuristically when per-phase
 *  scores are not available from the grader. */
function distributeScore(
  overall: number,
  phaseFeedback: Record<string, string>,
): DesignDrillResult["phaseScores"] {
  // If we have phase feedback, weight by text length (more detail => better).
  const phases = ["requirements", "highLevel", "deepDive", "tradeOffs"] as const;
  const weights = phases.map((p) => Math.max(1, (phaseFeedback[p] ?? "").length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const scores: Record<string, number> = {};
  let allocated = 0;

  phases.forEach((p, i) => {
    if (i < phases.length - 1) {
      const s = Math.round((weights[i] / totalWeight) * overall);
      scores[p] = Math.max(0, Math.min(100, s));
      allocated += scores[p];
    } else {
      // Last phase absorbs the rounding remainder.
      scores[p] = Math.max(0, Math.min(100, overall - allocated));
    }
  });

  return scores as DesignDrillResult["phaseScores"];
}

// ─── Exported functions ────────────────────────────────────────────────────

/**
 * Select or generate a system design problem and return the initial drill state.
 *
 * Resolution order:
 *   1. If `problemId` is set, look up that problem directly.
 *   2. Otherwise query the DB filtered by `conceptId` / `difficulty`.
 *   3. If no match, pick a random system-design problem from the DB.
 */
export function startDesignDrill(
  db: Database,
  config?: DesignDrillConfig,
): DesignDrillState {
  let problem: SystemDesignProblem | undefined;

  if (config?.problemId) {
    const rows = db
      .prepare(`SELECT * FROM problems WHERE id = ? AND type = 'system-design'`)
      .all(config.problemId) as import("../db/types.js").Problem[];
    if (rows.length > 0) {
      const row = rows[0];
      problem = {
        id: row.id,
        title: row.title,
        description: row.description,
        difficulty: row.difficulty,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
        rubric: row.rubric ? JSON.parse(row.rubric) : { requirements: [], highLevel: [], deepDive: [], tradeOffs: [] },
        conceptId: row.concept_id,
      };
    }
  }

  if (!problem) {
    const candidates = getSystemDesignProblems(db, {
      conceptId: config?.conceptId,
      difficulty: config?.difficulty,
    });
    if (candidates.length > 0) {
      problem = pickRandom(candidates);
    }
  }

  if (!problem) {
    // Last resort: grab any system-design problem.
    const all = getSystemDesignProblems(db);
    if (all.length === 0) {
      throw new Error("No system design problems found in the database. Seed problems first.");
    }
    problem = pickRandom(all);
  }

  return {
    problem,
    currentPhase: "requirements",
    phases: {
      requirements: "",
      highLevel: "",
      deepDive: "",
      tradeOffs: "",
    },
    startedAt: Date.now(),
  };
}

/**
 * Get the interviewer prompt for the current drill phase.
 */
export function getPhasePrompt(state: DesignDrillState): InterviewerPrompt {
  const { problem, currentPhase } = state;

  switch (currentPhase) {
    case "requirements":
      return {
        phase: "requirements",
        prompt: `For the problem "${problem.title}":\n\n${problem.description}\n\nWhat are the functional and non-functional requirements? Consider scalability, availability, latency, and any constraints or assumptions.`,
        followUp: "Can you estimate the scale? How many users, requests per second, data volume?",
      };

    case "highLevel":
      return {
        phase: "highLevel",
        prompt: "Walk me through the high-level architecture. What are the major components, and how does data flow between them?",
        followUp: "How would you sketch this on a whiteboard? What are the key interfaces between components?",
      };

    case "deepDive": {
      const component = extractFirstComponent(problem);
      return {
        phase: "deepDive",
        prompt: `Let's dive deeper into ${component}. How does it work internally? What are the data structures, algorithms, or protocols involved?`,
        followUp: "How does this component handle failure? What happens when it goes down?",
      };
    }

    case "tradeOffs":
      return {
        phase: "tradeOffs",
        prompt: "What trade-offs did you make in this design? What alternatives did you consider, and why did you choose this approach?",
        followUp: "If you had to scale this 10x, what would you change? What are the bottlenecks?",
      };

    case "complete":
      return {
        phase: "complete",
        prompt: "The design drill is complete. Submit your responses for grading.",
      };
  }
}

/**
 * Save the candidate's response for the current phase and advance to the next.
 *
 * Returns the updated state. Once the last phase is submitted, `currentPhase`
 * is set to `"complete"`.
 */
export function submitPhase(
  db: Database,
  state: DesignDrillState,
  response: string,
): DesignDrillState {
  if (state.currentPhase === "complete") {
    throw new Error("Drill is already complete. Call gradeDesignDrill to get results.");
  }

  const updated: DesignDrillState = {
    ...state,
    phases: { ...state.phases },
  };

  // Store the response.
  updated.phases[state.currentPhase] = response;

  // Advance to the next phase.
  const idx = PHASE_ORDER.indexOf(state.currentPhase);
  if (idx < PHASE_ORDER.length - 1) {
    updated.currentPhase = PHASE_ORDER[idx + 1];
  } else {
    updated.currentPhase = "complete";
  }

  return updated;
}

/**
 * Grade all phases via the LLM grader, save the attempt to the DB, and return
 * the graded result with per-phase feedback.
 */
export async function gradeDesignDrill(
  client: LLMClient,
  db: Database,
  state: DesignDrillState,
): Promise<DesignDrillResult> {
  if (state.currentPhase !== "complete") {
    throw new Error(
      `Cannot grade — drill is still in the "${state.currentPhase}" phase. ` +
        "Submit all phases before grading.",
    );
  }

  const timeSpentSeconds = Math.round((Date.now() - state.startedAt) / 1000);

  // Build the submission expected by the grader.
  const submission: DesignSubmission = {
    problem: {
      title: state.problem.title,
      description: state.problem.description,
      rubric: state.problem.rubric as unknown as Record<string, string[]>,
    },
    phases: {
      requirements: state.phases.requirements,
      highLevel: state.phases.highLevel,
      deepDive: state.phases.deepDive,
      tradeOffs: state.phases.tradeOffs,
    },
    timeSpentSeconds,
  };

  const grading: GradingResult = await gradeDesignSolution(client, submission);

  // Try to extract per-phase feedback from the free-form text.
  const phaseFeedback = parsePhaseFeedback(grading.feedback);
  const phaseScores = distributeScore(grading.score, phaseFeedback);

  // Persist the attempt.
  const allResponses = [
    "## Requirements\n" + state.phases.requirements,
    "## High-Level Design\n" + state.phases.highLevel,
    "## Deep Dive\n" + state.phases.deepDive,
    "## Trade-Offs\n" + state.phases.tradeOffs,
  ].join("\n\n");

  createLegacyAttempt(db, {
    problemId: state.problem.id,
    responseText: allResponses,
    score: grading.score,
    feedback: grading.feedback,
    timeSpentSeconds,
  });

  return {
    problemId: state.problem.id,
    score: grading.score,
    timeSpentSeconds,
    phaseScores,
    feedback: grading.feedback,
    phaseFeedback,
  };
}

/**
 * Format a graded drill result as a human-readable summary.
 */
export function formatDesignResult(result: DesignDrillResult): string {
  const minutes = Math.floor(result.timeSpentSeconds / 60);
  const seconds = result.timeSpentSeconds % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const phaseLabels: Record<string, string> = {
    requirements: "Requirements",
    highLevel: "High-Level Design",
    deepDive: "Deep Dive",
    tradeOffs: "Trade-Offs",
  };

  const lines: string[] = [
    `System Design Drill — ${result.problemId}`,
    `Score: ${result.score}/100`,
    `Time: ${timeStr}`,
    "",
    "Phase Scores:",
  ];

  for (const [phase, label] of Object.entries(phaseLabels)) {
    const score = result.phaseScores[phase as keyof typeof result.phaseScores];
    const bar = "█".repeat(Math.round(score / 5)) + "░".repeat(20 - Math.round(score / 5));
    lines.push(`  ${label.padEnd(22)} ${bar} ${score}/100`);
  }

  lines.push("", "Feedback:", result.feedback);

  if (Object.keys(result.phaseFeedback).length > 0) {
    lines.push("", "Phase-by-Phase Feedback:");
    for (const [phase, feedback] of Object.entries(result.phaseFeedback)) {
      const label = phaseLabels[phase] ?? phase;
      lines.push(`  [${label}]`, `  ${feedback}`, "");
    }
  }

  return lines.join("\n");
}
