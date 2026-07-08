/**
 * Goal-driven learning plan generator.
 *
 * Takes a topic, goal, and optional constraints (deadline, daily time budget,
 * skill gaps from job-hunter) and produces a concrete session schedule
 * following prerequisite order.
 */

import type Database from "better-sqlite3";
import { getConceptsByTopic, getTopic } from "../db/database.js";
import type { Concept } from "../db/types.js";
import type { LearningPlan, PlanSession } from "../knowledge/types.js";
import type { SkillGap } from "../integrations/job-hunter.js";

// ─── Time estimation ────────────────────────────────────────────────────────

/** Minutes per difficulty level when baseMinutes = 1.0. */
const DIFFICULTY_MINUTES: Record<number, number> = {
  1: 3,
  2: 5,
  3: 8,
  4: 12,
  5: 15,
};

/**
 * Estimate session time for a single concept.
 *
 * Looks up the base minutes for the given difficulty (1-5) then multiplies
 * by `baseMinutes` (default 1.0).  Result is rounded to the nearest minute.
 */
export function estimateSessionTime(
  difficulty: number,
  baseMinutes: number = 1.0,
): number {
  const clamped = Math.max(1, Math.min(5, Math.round(difficulty)));
  const base = DIFFICULTY_MINUTES[clamped] ?? 3;
  return Math.round(base * baseMinutes);
}

// ─── Topological sort (Kahn's algorithm) ────────────────────────────────────

/**
 * Sort concepts by prerequisite order using Kahn's algorithm.
 *
 * Returns concept IDs in dependency order (prerequisites before dependents).
 * Throws if a circular dependency is detected.
 */
export function topologicalSort(
  concepts: { id: string; prerequisites: string[] }[],
): string[] {
  const conceptSet = new Set(concepts.map((c) => c.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialise
  for (const c of concepts) {
    inDegree.set(c.id, 0);
    adjacency.set(c.id, []);
  }

  // Build graph — only consider prerequisites that exist in the concept set
  for (const c of concepts) {
    for (const prereq of c.prerequisites) {
      if (!conceptSet.has(prereq)) continue; // skip external/unknown prereqs
      adjacency.get(prereq)!.push(c.id);
      inDegree.set(c.id, (inDegree.get(c.id) ?? 0) + 1);
    }
  }

  // Seed queue with zero-in-degree nodes
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbour of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbour) ?? 1) - 1;
      inDegree.set(neighbour, newDeg);
      if (newDeg === 0) queue.push(neighbour);
    }
  }

  if (sorted.length !== concepts.length) {
    const remaining = concepts
      .filter((c) => !sorted.includes(c.id))
      .map((c) => c.id);
    throw new Error(
      `Circular dependency detected among concepts: ${remaining.join(", ")}`,
    );
  }

  return sorted;
}

// ─── Deadline suggestion ────────────────────────────────────────────────────

/**
 * Estimate how long it will take to cover all concepts and return a
 * suggested deadline as YYYY-MM-DD.
 *
 * Uses the difficulty-to-minutes mapping (with baseMinutes = 1.0) to
 * estimate total study time, then divides by `dailyMinutes` to get
 * the number of calendar days needed.
 */
export function suggestDeadline(
  concepts: { difficulty: number }[],
  dailyMinutes: number,
): string {
  const totalMinutes = concepts.reduce(
    (sum, c) => sum + estimateSessionTime(c.difficulty),
    0,
  );
  const daysNeeded = Math.max(1, Math.ceil(totalMinutes / dailyMinutes));
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysNeeded);
  return deadline.toISOString().slice(0, 10);
}

// ─── Mode assignment ────────────────────────────────────────────────────────

/**
 * Determine the session mode for a concept based on its current status.
 *
 * - unseen / learning  -> explore  (new material)
 * - reviewing          -> quiz     (active recall)
 * - mastered           -> teach-back (consolidation)
 */
function modeForStatus(status: string): PlanSession["mode"] {
  switch (status) {
    case "unseen":
    case "learning":
      return "explore";
    case "reviewing":
      return "quiz";
    case "mastered":
      return "teach-back";
    default:
      return "explore";
  }
}

// ─── Gap prioritisation ─────────────────────────────────────────────────────

/**
 * Score a concept based on how well it matches the provided skill gaps.
 *
 * Returns a priority score (higher = more urgent).  A concept whose title
 * or tags match a gap skill earns the gap's frequency as its score.
 * Concepts with no gap match receive 0.
 */
function gapPriority(concept: Concept, gaps: SkillGap[]): number {
  if (gaps.length === 0) return 0;

  const titleLower = concept.title.toLowerCase();
  const tags: string[] = Array.isArray(concept.tags)
    ? concept.tags.map((t) => t.toLowerCase())
    : [];

  let score = 0;
  for (const gap of gaps) {
    const skill = gap.skill.toLowerCase();
    if (titleLower.includes(skill) || tags.some((t) => t.includes(skill) || skill.includes(t))) {
      score += gap.frequency;
    }
  }
  return score;
}

// ─── Main plan generator ────────────────────────────────────────────────────

/**
 * Generate a learning plan for a topic.
 *
 * 1. Loads all concepts for the topic from the DB.
 * 2. If skill gaps are provided, prioritises matching concepts.
 * 3. Topologically sorts by prerequisites.
 * 4. Estimates per-concept time from difficulty.
 * 5. Packs concepts into sessions respecting the daily minutes budget.
 * 6. If a deadline is provided, back-calculates to fit (may compress sessions).
 * 7. Assigns modes: explore / quiz / teach-back based on concept status.
 */
export function generateLearningPlan(options: {
  db: Database.Database;
  topicId: string;
  goal: string;
  deadline?: string;       // YYYY-MM-DD
  dailyMinutes?: number;   // default 30
  gaps?: SkillGap[];       // from job-hunter adapter
}): LearningPlan {
  const {
    db,
    topicId,
    goal,
    deadline,
    dailyMinutes = 30,
    gaps = [],
  } = options;

  // 1. Load topic name and concepts
  const topic = getTopic(db, topicId);
  const topicName = topic?.name ?? topicId;

  const dbConcepts = getConceptsByTopic(db, topicId);
  if (dbConcepts.length === 0) {
    return {
      topic: topicName,
      goal,
      deadline: deadline ?? null,
      sessions: [],
    };
  }

  // 2. Prioritise by gap relevance, then by difficulty (easier first for new material)
  const prioritised = [...dbConcepts].sort((a, b) => {
    const gapDiff = gapPriority(b, gaps) - gapPriority(a, gaps);
    if (gapDiff !== 0) return gapDiff;
    return a.difficulty - b.difficulty;
  });

  // 3. Topological sort to respect prerequisites
  const sortedIds = topologicalSort(
    prioritised.map((c) => ({ id: c.id, prerequisites: c.prerequisites ?? [] })),
  );

  // Build lookup maps
  const conceptById = new Map(dbConcepts.map((c) => [c.id, c]));
  const sortedConcepts = sortedIds
    .map((id) => conceptById.get(id)!)
    .filter(Boolean);

  // 4. Estimate time per concept
  const conceptTimes = sortedConcepts.map((c) => ({
    concept: c,
    minutes: estimateSessionTime(c.difficulty),
  }));

  // 5. Determine how many calendar days we have
  let availableDays: number;
  if (deadline) {
    const today = new Date();
    const deadlineDate = new Date(deadline + "T00:00:00");
    availableDays = Math.max(
      1,
      Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    );
  } else {
    // No deadline — use suggestDeadline logic to determine days
    const totalMinutes = conceptTimes.reduce((s, ct) => s + ct.minutes, 0);
    availableDays = Math.max(1, Math.ceil(totalMinutes / dailyMinutes));
  }

  // 6. Pack concepts into sessions
  // If deadline-constrained, compute a per-day time budget that fits everything
  const totalMinutesNeeded = conceptTimes.reduce((s, ct) => s + ct.minutes, 0);
  const naturalDays = Math.ceil(totalMinutesNeeded / dailyMinutes);

  // effectiveDailyMinutes: if deadline is tight, we may need to go over the
  // requested daily budget; otherwise stick to the user's preference.
  const effectiveDailyMinutes =
    deadline && naturalDays > availableDays
      ? Math.ceil(totalMinutesNeeded / availableDays)
      : dailyMinutes;

  const sessions: PlanSession[] = [];
  let sessionNumber = 0;
  let currentDayConcepts: typeof conceptTimes = [];
  let currentDayMinutes = 0;
  let dayIndex = 0;

  for (const ct of conceptTimes) {
    // If adding this concept would exceed today's budget AND we already have
    // something queued, flush the current day into a session.
    if (
      currentDayMinutes > 0 &&
      currentDayMinutes + ct.minutes > effectiveDailyMinutes
    ) {
      sessionNumber++;
      const targetDate = computeTargetDate(deadline, availableDays, dayIndex);
      sessions.push(buildSession(sessionNumber, currentDayConcepts, currentDayMinutes, targetDate));
      dayIndex++;
      currentDayConcepts = [];
      currentDayMinutes = 0;
    }

    currentDayConcepts.push(ct);
    currentDayMinutes += ct.minutes;
  }

  // Flush remaining concepts
  if (currentDayConcepts.length > 0) {
    sessionNumber++;
    const targetDate = computeTargetDate(deadline, availableDays, dayIndex);
    sessions.push(buildSession(sessionNumber, currentDayConcepts, currentDayMinutes, targetDate));
  }

  return {
    topic: topicName,
    goal,
    deadline: deadline ?? null,
    sessions,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Build a PlanSession from a batch of concept-time pairs.
 */
function buildSession(
  sessionNumber: number,
  concepts: { concept: Concept; minutes: number }[],
  totalMinutes: number,
  targetDate: string | null,
): PlanSession {
  // Determine the dominant mode — if any concept is new, the session explores;
  // if all are reviewing, it's a quiz; if all are mastered, teach-back.
  const modes = concepts.map((c) => modeForStatus(c.concept.status));
  const mode = modes.includes("explore")
    ? "explore"
    : modes.includes("quiz")
      ? "quiz"
      : "teach-back";

  return {
    sessionNumber,
    conceptIds: concepts.map((c) => c.concept.id),
    estimatedMinutes: totalMinutes,
    targetDate,
    mode,
  };
}

/**
 * Compute a target date string for a session, distributing sessions
 * evenly across the available days.
 *
 * Returns YYYY-MM-DD or null if no deadline is set.
 */
function computeTargetDate(
  deadline: string | undefined,
  availableDays: number,
  dayIndex: number,
): string | null {
  if (!deadline) return null;

  const start = new Date();
  // Spread sessions across available days
  const dayOffset = Math.min(dayIndex, availableDays - 1);
  const target = new Date(start);
  target.setDate(target.getDate() + dayOffset);
  return target.toISOString().slice(0, 10);
}
