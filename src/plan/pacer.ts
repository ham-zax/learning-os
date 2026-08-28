/**
 * Adaptive pacing based on SM-2 session history.
 *
 * Analyzes recent sessions to determine the learner's pace, recommends
 * session scope (concept count + duration), and detects trends.
 */

import type Database from "better-sqlite3";

// ─── Exported types ──────────────────────────────────────────────────────────

export interface PacingData {
  /** Average seconds spent per concept across recent sessions. */
  averageReviewTime: number;
  /** Fraction of reviews graded >= 3 (0-1). */
  successRate: number;
  /** Mean SM-2 grade across recent reviews (0-5). */
  averageGrade: number;
  /** Recommended number of concepts for the next session. */
  conceptsPerSession: number;
  /** Recommended session duration in minutes. */
  sessionDurationMinutes: number;
  /** Whether the learner is trending up, down, or holding steady. */
  trend: "improving" | "stable" | "struggling";
}

export interface PacingAdjustment {
  /** Human-readable explanation for the adjustment. */
  reason: string;
  /** Original requested concept count. */
  originalConcepts: number;
  /** Adjusted concept count. */
  adjustedConcepts: number;
  /** Original requested duration in minutes. */
  originalMinutes: number;
  /** Adjusted duration in minutes. */
  adjustedMinutes: number;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

interface SessionStats {
  sessionId: number;
  conceptCount: number;
  durationSeconds: number;
  grades: number[];
}

/** Query recent sessions for a topic and compute per-session stats. */
function getSessionStats(
  db: Database.Database,
  topicId: string,
  sessionCount: number,
): SessionStats[] {
  const sessions = db
    .prepare(
      `SELECT id, started_at, ended_at, concepts_reviewed
       FROM sessions
       WHERE topic_id = ?
         AND ended_at IS NOT NULL
       ORDER BY started_at DESC
       LIMIT ?`,
    )
    .all(topicId, sessionCount) as Array<{
    id: number;
    started_at: string | null;
    ended_at: string | null;
    concepts_reviewed: string;
  }>;

  const reviewStmt = db.prepare(
    `SELECT grade FROM reviews WHERE session_id = ? ORDER BY created_at`,
  );

  const stats: SessionStats[] = [];

  for (const session of sessions) {
    const conceptIds: string[] = JSON.parse(session.concepts_reviewed);
    const conceptCount = conceptIds.length || 1; // avoid div-by-zero

    let durationSeconds = 0;
    if (session.started_at && session.ended_at) {
      const start = new Date(session.started_at).getTime();
      const end = new Date(session.ended_at).getTime();
      durationSeconds = Math.max(0, (end - start) / 1000);
    }

    const rows = reviewStmt.all(session.id) as Array<{ grade: number }>;
    const grades = rows.map((r) => r.grade);

    stats.push({ sessionId: session.id, conceptCount, durationSeconds, grades });
  }

  // Return oldest-first so trend analysis works naturally
  return stats.reverse();
}

/** Split stats into two halves and determine the learning trend. */
function detectTrend(stats: SessionStats[]): "improving" | "stable" | "struggling" {
  if (stats.length < 2) return "stable";

  const mid = Math.floor(stats.length / 2);
  const firstHalf = stats.slice(0, mid);
  const secondHalf = stats.slice(mid);

  const avgRate = (group: SessionStats[]): number => {
    const allGrades = group.flatMap((s) => s.grades);
    if (allGrades.length === 0) return 0;
    return allGrades.filter((g) => g >= 3).length / allGrades.length;
  };

  const avgGrade = (group: SessionStats[]): number => {
    const allGrades = group.flatMap((s) => s.grades);
    if (allGrades.length === 0) return 0;
    return allGrades.reduce((sum, g) => sum + g, 0) / allGrades.length;
  };

  const rateDelta = avgRate(secondHalf) - avgRate(firstHalf);
  const gradeDelta = avgGrade(secondHalf) - avgGrade(firstHalf);

  // A delta of ~0.15 or more in either metric signals a meaningful shift
  const THRESHOLD = 0.15;

  if (rateDelta > THRESHOLD || gradeDelta > THRESHOLD) return "improving";
  if (rateDelta < -THRESHOLD || gradeDelta < -THRESHOLD) return "struggling";
  return "stable";
}

// ─── Baseline constants ─────────────────────────────────────────────────────

/** Default concepts per session when no history exists. */
const BASE_CONCEPTS = 8;
/** Default session duration in minutes when no history exists. */
const BASE_MINUTES = 30;
/** Minimum recommended concepts per session. */
const MIN_CONCEPTS = 3;
/** Maximum recommended concepts per session. */
const MAX_CONCEPTS = 20;
/** Minimum recommended session duration in minutes. */
const MIN_MINUTES = 10;
/** Maximum recommended session duration in minutes. */
const MAX_MINUTES = 60;

// ─── Exported functions ─────────────────────────────────────────────────────

/**
 * Analyze recent session history for a topic to determine the learner's pace.
 *
 * Looks at the last `sessionCount` completed sessions (default 5), computes
 * per-session metrics, and derives overall pacing recommendations.
 */
export function analyzePacing(
  db: Database.Database,
  topicId: string,
  sessionCount = 5,
): PacingData {
  const stats = getSessionStats(db, topicId, sessionCount);

  // No completed sessions yet — return sensible defaults
  if (stats.length === 0) {
    return {
      averageReviewTime: 0,
      successRate: 0,
      averageGrade: 0,
      conceptsPerSession: BASE_CONCEPTS,
      sessionDurationMinutes: BASE_MINUTES,
      trend: "stable",
    };
  }

  // Aggregate across all sessions
  const allGrades = stats.flatMap((s) => s.grades);
  const totalReviewSeconds = stats.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalConcepts = stats.reduce((sum, s) => sum + s.conceptCount, 0);

  const averageReviewTime =
    totalConcepts > 0 ? totalReviewSeconds / totalConcepts : 0;
  const successRate =
    allGrades.length > 0
      ? allGrades.filter((g) => g >= 3).length / allGrades.length
      : 0;
  const averageGrade =
    allGrades.length > 0
      ? allGrades.reduce((sum, g) => sum + g, 0) / allGrades.length
      : 0;
  const trend = detectTrend(stats);

  // Compute recommended concepts from observed pace
  const avgConceptsPerSession =
    stats.reduce((sum, s) => sum + s.conceptCount, 0) / stats.length;
  const avgSessionMinutes =
    stats.reduce((sum, s) => sum + s.durationSeconds, 0) / stats.length / 60;

  // Start from observed averages, apply trend adjustment
  let recommendedConcepts = Math.round(avgConceptsPerSession);
  let recommendedMinutes = Math.round(avgSessionMinutes);

  if (trend === "struggling") {
    recommendedConcepts = Math.max(
      MIN_CONCEPTS,
      Math.round(recommendedConcepts * 0.75),
    );
    recommendedMinutes = Math.min(
      MAX_MINUTES,
      Math.round(recommendedMinutes * 1.15),
    );
  } else if (trend === "improving") {
    recommendedConcepts = Math.min(
      MAX_CONCEPTS,
      Math.round(recommendedConcepts * 1.1),
    );
  }

  return {
    averageReviewTime,
    successRate,
    averageGrade,
    conceptsPerSession: clamp(recommendedConcepts, MIN_CONCEPTS, MAX_CONCEPTS),
    sessionDurationMinutes: clamp(
      recommendedMinutes,
      MIN_MINUTES,
      MAX_MINUTES,
    ),
    trend,
  };
}

/**
 * Given pacing data and requested session parameters, produce an adjusted
 * scope that accounts for the learner's current state.
 */
export function adjustSessionScope(
  pacing: PacingData,
  requestedConcepts: number,
  requestedMinutes: number,
): PacingAdjustment {
  let adjustedConcepts = requestedConcepts;
  let adjustedMinutes = requestedMinutes;
  let reason = "No adjustment needed — pace is steady.";

  if (pacing.trend === "struggling") {
    // Pull back: fewer concepts, more time per concept
    adjustedConcepts = Math.max(
      MIN_CONCEPTS,
      Math.round(requestedConcepts * 0.7),
    );
    adjustedMinutes = Math.min(
      MAX_MINUTES,
      Math.round(requestedMinutes * 1.2),
    );
    reason =
      "Success rate or grades trending down — reduced concept count and extended time to avoid overload.";
  } else if (pacing.trend === "improving") {
    // Nudge up slightly
    adjustedConcepts = Math.min(
      MAX_CONCEPTS,
      Math.round(requestedConcepts * 1.15),
    );
    reason =
      "Performance trending up — slightly increased concept count to maintain challenge.";
  }

  return {
    reason,
    originalConcepts: requestedConcepts,
    adjustedConcepts,
    originalMinutes: requestedMinutes,
    adjustedMinutes,
  };
}

/**
 * Combined analysis that returns recommended session parameters and focus.
 *
 * Merges pacing analysis with current due-concept counts and topic phase
 * to produce a single actionable recommendation.
 */
export function getNextSessionRecommendation(
  db: Database.Database,
  topicId: string,
): { concepts: number; minutes: number; focus: "new" | "review" | "mixed" } {
  const pacing = analyzePacing(db, topicId);

  // Count due concepts (next_review <= today or NULL)
  const now = new Date().toISOString().slice(0, 10);
  const dueRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM concepts
       WHERE topic_id = ?
         AND (next_review <= ? OR next_review IS NULL)
         AND status != 'unseen'`,
    )
    .get(topicId, now) as { cnt: number };
  const dueCount = dueRow.cnt;

  // Count unseen concepts
  const unseenRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM concepts
       WHERE topic_id = ?
         AND status = 'unseen'`,
    )
    .get(topicId) as { cnt: number };
  const unseenCount = unseenRow.cnt;

  // Determine focus
  let focus: "new" | "review" | "mixed";
  if (dueCount === 0 && unseenCount > 0) {
    focus = "new";
  } else if (unseenCount === 0 && dueCount > 0) {
    focus = "review";
  } else {
    focus = "mixed";
  }

  // Use pacing-recommended concepts as the baseline, capped by what's available
  const totalAvailable = dueCount + unseenCount;
  const baseConcepts = pacing.conceptsPerSession;
  const concepts = clamp(
    Math.min(baseConcepts, totalAvailable),
    totalAvailable > 0 ? 1 : 0,
    MAX_CONCEPTS,
  );

  // Estimate minutes: use observed average per-concept time when available,
  // otherwise fall back to the pacing recommendation
  let minutes: number;
  if (pacing.averageReviewTime > 0) {
    minutes = Math.round((pacing.averageReviewTime * concepts) / 60);
  } else {
    minutes = pacing.sessionDurationMinutes;
  }
  minutes = clamp(minutes, MIN_MINUTES, MAX_MINUTES);

  return { concepts, minutes, focus };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
