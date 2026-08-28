/**
 * System design drill — phased interview simulation.
 *
 * Walks through four phases (requirements, high-level, deep-dive, trade-offs),
 * persists the candidate response on a frozen interview attempt, then optionally assesses the
 * exact frozen rubric through a trusted evaluator.
 */

import type { Database } from "better-sqlite3";
import { getSystemDesignProblems } from "./problems.js";
import type { SystemDesignProblem } from "./problems.js";
import { assessDesignAgainstRubric } from "../llm/grader.js";
import type {
  DesignCriterionAssessment,
  DesignRubricAssessment,
  DesignSubmission,
} from "../llm/grader.js";
import type { LLMClient } from "../llm/client.js";
import type { Novelty } from "../db/types.js";
import { getAttempt, getChallenge, openAttempt, submitAttempt } from "../kernel/foundation.js";
import { recordAssessment } from "../kernel/evidence.js";
import { prepareInterviewChallenge } from "./evidence.js";

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
  /** Challenge novelty is independent from interview delivery context. */
  novelty?: Novelty;
}

export interface DesignDrillState {
  problem: SystemDesignProblem;
  objectiveId: string;
  challengeId: string;
  challengeVersion: number;
  attemptId: number;
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
  objectiveId: string;
  attemptId: number;
  timeSpentSeconds: number;
  assessmentStatus: "pending" | "recorded";
  criteria: DesignCriterionAssessment[];
  feedback: string;
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

function frozenDesignCriteria(problem: SystemDesignProblem) {
  const phases = ["requirements", "highLevel", "deepDive", "tradeOffs"] as const;
  return phases.flatMap((phase) =>
    problem.rubric[phase].map((description, index) => ({
      id: `${phase}-${index + 1}`,
      description,
    })),
  );
}

function combinedResponse(state: DesignDrillState): string {
  return [
    "## Requirements\n" + state.phases.requirements,
    "## High-Level Design\n" + state.phases.highLevel,
    "## Deep Dive\n" + state.phases.deepDive,
    "## Trade-Offs\n" + state.phases.tradeOffs,
  ].join("\n\n");
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
    }).filter((candidate) => candidate.conceptId !== null);
    if (candidates.length > 0) {
      problem = pickRandom(candidates);
    }
  }

  if (!problem) {
    // Last resort: grab any system-design problem.
    const all = getSystemDesignProblems(db).filter((candidate) => candidate.conceptId !== null);
    if (all.length === 0) {
      throw new Error("No system design problems found in the database. Seed problems first.");
    }
    problem = pickRandom(all);
  }

  if (!problem.conceptId) {
    throw new Error(
      `System design problem ${problem.id} is not mapped to a concept and cannot produce authoritative interview evidence.`,
    );
  }

  const criteria = frozenDesignCriteria(problem);
  const phaseLimits = {
    requirements: config?.phaseTimeLimitMinutes?.requirements ?? DEFAULT_PHASE_LIMITS.requirements,
    highLevel: config?.phaseTimeLimitMinutes?.highLevel ?? DEFAULT_PHASE_LIMITS.highLevel,
    deepDive: config?.phaseTimeLimitMinutes?.deepDive ?? DEFAULT_PHASE_LIMITS.deepDive,
    tradeOffs: config?.phaseTimeLimitMinutes?.tradeOffs ?? DEFAULT_PHASE_LIMITS.tradeOffs,
  };
  const prepared = prepareInterviewChallenge(db, {
    problemId: problem.id,
    conceptId: problem.conceptId,
    capabilityId: "design",
    taskForm: "design",
    publicPrompt: `${problem.title}\n\n${problem.description}`,
    novelty: config?.novelty,
    timeBudgetMinutes: Object.values(phaseLimits).reduce((sum, minutes) => sum + minutes, 0),
    criteria,
    verificationRequired: false,
    verificationBasis: "frozen_rubric",
  });
  const opened = openAttempt(db, prepared.challenge.id, prepared.challenge.version);

  return {
    problem,
    objectiveId: prepared.objectiveId,
    challengeId: prepared.challenge.id,
    challengeVersion: prepared.challenge.version,
    attemptId: opened.attempt.id,
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
    throw new Error("Drill is already complete. Call assessDesignDrill to get results.");
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
    submitAttempt(db, state.attemptId, { responseText: combinedResponse(updated) });
  }

  return updated;
}

export function assessDesignAttempt(
  db: Database,
  attemptId: number,
  evaluatorType: "llm" | "agent" | "human",
  assessment: DesignRubricAssessment,
): DesignRubricAssessment {
  const attempt = getAttempt(db, attemptId);
  if (!attempt || attempt.submitted_at === null) {
    throw new Error(`Submitted design attempt not found: ${attemptId}`);
  }
  if (attempt.challenge_id === null || attempt.challenge_version === null) {
    throw new Error(`Design attempt is not attached to a frozen challenge: ${attemptId}`);
  }
  const challenge = getChallenge(db, attempt.challenge_id, attempt.challenge_version);
  if (
    !challenge ||
    challenge.deliveryContext !== "interview" ||
    challenge.taskForm !== "design" ||
    challenge.targets.length !== 1 ||
    challenge.verification.required ||
    challenge.verification.basis !== "frozen_rubric"
  ) {
    throw new Error(`Attempt is not a single-objective frozen-rubric design interview: ${attemptId}`);
  }

  const expectedIds = challenge.rubric.criteria.map((criterion) => criterion.id);
  const returnedIds = assessment.criteria.map((criterion) => criterion.criterionId);
  if (
    returnedIds.length !== expectedIds.length ||
    new Set(returnedIds).size !== returnedIds.length ||
    expectedIds.some((criterionId) => !returnedIds.includes(criterionId))
  ) {
    throw new Error("Design assessment must classify every frozen criterion exactly once");
  }
  if (assessment.criteria.some((criterion) => criterion.rationale.trim().length === 0)) {
    throw new Error("Design assessment must provide a rationale for every frozen criterion");
  }

  const byId = new Map(assessment.criteria.map((criterion) => [criterion.criterionId, criterion]));
  const criteriaMet = expectedIds.filter((criterionId) => byId.get(criterionId)!.met);
  const criteriaUnmet = expectedIds.filter((criterionId) => !byId.get(criterionId)!.met);
  const result = criteriaUnmet.length === 0
    ? "correct"
    : criteriaMet.length > 0
      ? "partially_correct"
      : "incorrect";
  const rationale = expectedIds
    .map((criterionId) => `${criterionId}: ${byId.get(criterionId)!.rationale}`)
    .join("\n");

  recordAssessment(db, attemptId, {
    evaluatorType,
    assessmentBasis: "frozen_rubric",
    verificationOutput: null,
    objectiveResults: [
      {
        objectiveId: challenge.targets[0].objectiveId,
        result,
        criteriaMet,
        criteriaUnmet,
        rationale,
      },
    ],
  });

  return assessment;
}

/** Assess a completed, already-persisted design attempt when an evaluator is available. */
export async function assessDesignDrill(
  client: LLMClient | null,
  db: Database,
  state: DesignDrillState,
): Promise<DesignDrillResult> {
  if (state.currentPhase !== "complete") {
    throw new Error(
      `Cannot assess — drill is still in the "${state.currentPhase}" phase. Submit all phases first.`,
    );
  }

  const timeSpentSeconds = Math.round((Date.now() - state.startedAt) / 1000);
  if (!client) {
    return {
      problemId: state.problem.id,
      objectiveId: state.objectiveId,
      attemptId: state.attemptId,
      timeSpentSeconds,
      assessmentStatus: "pending",
      criteria: [],
      feedback: "",
    };
  }

  const challenge = getChallenge(db, state.challengeId, state.challengeVersion);
  if (!challenge) {
    throw new Error(`Frozen design challenge not found: ${state.challengeId}@${state.challengeVersion}`);
  }
  const submission: DesignSubmission = {
    problem: {
      title: state.problem.title,
      description: state.problem.description,
      criteria: challenge.rubric.criteria.map((criterion) => ({
        id: criterion.id,
        description: criterion.description,
        required: criterion.required,
      })),
    },
    phases: { ...state.phases },
    timeSpentSeconds,
  };
  const assessment = await assessDesignAgainstRubric(client, submission);
  assessDesignAttempt(db, state.attemptId, "llm", assessment);

  return {
    problemId: state.problem.id,
    objectiveId: state.objectiveId,
    attemptId: state.attemptId,
    timeSpentSeconds,
    assessmentStatus: "recorded",
    criteria: assessment.criteria,
    feedback: assessment.feedback,
  };
}

/** Format rubric-based design assessment without synthetic numeric phase scores. */
export function formatDesignResult(result: DesignDrillResult): string {
  const minutes = Math.floor(result.timeSpentSeconds / 60);
  const seconds = result.timeSpentSeconds % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  const lines = [
    `System Design Drill — ${result.problemId}`,
    `Time: ${timeStr}`,
    `Assessment: ${result.assessmentStatus.toUpperCase()}`,
  ];

  if (result.assessmentStatus === "pending") {
    lines.push("No trusted rubric evaluator is available; the submitted attempt remains pending.");
    return lines.join("\n");
  }

  lines.push("", "Frozen criterion assessment:");
  for (const criterion of result.criteria) {
    lines.push(
      `  ${criterion.met ? "MET" : "UNMET"} ${criterion.criterionId}: ${criterion.rationale}`,
    );
  }
  if (result.feedback) {
    lines.push("", "Feedback:", result.feedback);
  }

  return lines.join("\n");
}
