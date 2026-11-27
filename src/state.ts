/**
 * Topic/concept and goal state helpers.
 *
 * Content topics own curriculum concepts; goals own active learning-objective
 * memberships, bookmarks, and sessions. Both are reported independently.
 */

import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { loadManifest } from "./knowledge/loader.js";
import { validateManifest } from "./knowledge/validator.js";
import { assertSafeId, resolveContainedPath } from "./knowledge/safe-path.js";
import Database from "better-sqlite3";
import {
  getConcept,
  getConceptsByTopic,
  createConcept,
  createTopic,
  getGoal,
  getGoalLastSessionAt,
  getTopic,
  getTopicLastSessionAt,
} from "./db/database.js";
import type { Concept } from "./db/types.js";
import { getDueObjectives } from "./scheduler/index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TopicSummary {
  topicId: string;
  topic: string;
  totalConcepts: number;
  totalObjectives: number;
  unknown: number;
  exposed: number;
  guided: number;
  independent: number;
  dueCount: number;
  overdueCount: number;
  lastSession: string | null;
}

export interface GoalSummary {
  goalId: string;
  goalName: string;
  purpose: string;
  activeObjectives: number;
  totalConfiguredObjectives: number;
  unknown: number;
  exposed: number;
  guided: number;
  independent: number;
  dueCount: number;
  overdueCount: number;
  parkedSessionId: number | null;
  bookmarkNote: string | null;
  lastSession: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Retrieve descriptive concept metadata. */
export function getConceptState(
  db: Database.Database,
  conceptId: string,
): Concept {
  const concept = getConcept(db, conceptId);
  if (!concept) {
    throw new Error(`Concept not found: ${conceptId}`);
  }
  return concept;
}

/** Build a read-only objective-level summary for a content topic. */
export function getTopicSummary(
  db: Database.Database,
  topicId: string,
): TopicSummary {
  const topic = getTopic(db, topicId);
  if (!topic) {
    throw new Error(`Topic not found: ${topicId}`);
  }

  const totalConcepts = getConceptsByTopic(db, topicId).length;
  const readinessRows = db
    .prepare(
      `SELECT projection.readiness, COUNT(*) AS count
       FROM objective_projections projection
       JOIN learning_objectives objective ON objective.id = projection.objective_id
       JOIN concepts concept ON concept.id = objective.concept_id
       WHERE concept.topic_id = ?
       GROUP BY projection.readiness`,
    )
    .all(topicId) as Array<{
    readiness: "unknown" | "exposed" | "guided" | "independent";
    count: number;
  }>;
  const readiness = {
    unknown: 0,
    exposed: 0,
    guided: 0,
    independent: 0,
  };
  for (const row of readinessRows) readiness[row.readiness] = row.count;
  const totalObjectives = Object.values(readiness).reduce((sum, count) => sum + count, 0);

  const now = new Date().toISOString();
  const dueObjectives = getDueObjectives(db, { topicId, asOf: now });
  const dueCount = dueObjectives.length;
  const overdueCount = dueObjectives.filter((due) => due.dueAt < now).length;

  return {
    topicId,
    topic: topic.name,
    totalConcepts,
    totalObjectives,
    ...readiness,
    dueCount,
    overdueCount,
    lastSession: getTopicLastSessionAt(db, topicId),
  };
}

/** Build a read-only summary for a goal across all its active objective memberships. */
export function getGoalSummary(
  db: Database.Database,
  goalId: string,
): GoalSummary {
  const goal = getGoal(db, goalId);
  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`);
  }

  const membershipCounts = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active
       FROM goal_objectives
       WHERE goal_id = ?`,
    )
    .get(goalId) as { total: number; active: number };

  const readinessRows = db
    .prepare(
      `SELECT projection.readiness, COUNT(*) AS count
       FROM objective_projections projection
       JOIN goal_objectives membership ON membership.objective_id = projection.objective_id
       WHERE membership.goal_id = ? AND membership.is_active = 1
       GROUP BY projection.readiness`,
    )
    .all(goalId) as Array<{
    readiness: "unknown" | "exposed" | "guided" | "independent";
    count: number;
  }>;
  const readiness = {
    unknown: 0,
    exposed: 0,
    guided: 0,
    independent: 0,
  };
  for (const row of readinessRows) readiness[row.readiness] = row.count;

  const now = new Date().toISOString();
  const dueRows = db
    .prepare(
      `SELECT card.due_at
       FROM review_cards card
       JOIN goal_objectives membership ON membership.objective_id = card.objective_id
       WHERE membership.goal_id = ? AND membership.is_active = 1 AND card.due_at <= ?`,
    )
    .all(goalId, now) as Array<{ due_at: string }>;
  const dueCount = dueRows.length;
  const overdueCount = dueRows.filter((row) => row.due_at < now).length;

  return {
    goalId: goal.id,
    goalName: goal.name,
    purpose: goal.purpose,
    activeObjectives: membershipCounts.active,
    totalConfiguredObjectives: membershipCounts.total,
    ...readiness,
    dueCount,
    overdueCount,
    parkedSessionId: goal.parked_session_id,
    bookmarkNote: goal.bookmark_note,
    lastSession: getGoalLastSessionAt(db, goalId),
  };
}

/**
 * Bootstrap a topic from a manifest JSON file.
 */
export function initializeTopic(
  db: Database.Database,
  topicId: string,
  manifestPath: string,
): void {
  assertSafeId(topicId, "Topic ID");
  const manifest = loadManifest(manifestPath);
  if (manifest.topicId !== topicId) {
    throw new Error(`Manifest topicId ${manifest.topicId} does not match requested topic ${topicId}`);
  }
  const validation = validateManifest(manifest);
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  const entries = manifest.concepts.map((entry) => {
    const existing = getConcept(db, entry.id);
    if (existing && existing.topic_id !== topicId) {
      throw new Error(`Concept ID ${entry.id} already belongs to topic ${existing.topic_id}; concept IDs are global within a learner profile`);
    }
    const topicDir = dirname(manifestPath);
    const candidates = entry.file
      ? [entry.file]
      : [`${entry.id}.md`, `concepts/${entry.id}.md`, `${entry.id}/concept.md`];
    const paths = candidates.map((candidate) => resolveContainedPath(topicDir, candidate));
    const resolved = paths.find((candidate) => existsSync(candidate)) ?? null;
    const filePath = resolved
      ? `${topicId}/${relative(resolve(topicDir), resolved).split(sep).join("/")}`
      : null;
    return { entry, filePath };
  });

  db.transaction(() => {
    if (!getTopic(db, topicId)) createTopic(db, { id: topicId, name: manifest.topicName });
    for (const { entry, filePath } of entries) {
      const existing = getConcept(db, entry.id);
      if (!existing) {
        createConcept(db, {
          id: entry.id,
          topicId,
          title: entry.title,
          difficulty: entry.difficulty,
          prerequisites: entry.prerequisites,
          tags: entry.tags,
        });
        if (filePath) db.prepare("UPDATE concepts SET file_path = ? WHERE id = ?").run(filePath, entry.id);
      } else if (existing.topic_id !== topicId) {
        throw new Error(`Concept ID ${entry.id} already belongs to topic ${existing.topic_id}`);
      }
    }
  })();
}
