/**
 * Topic/concept state helpers.
 *
 * Concept metadata is descriptive curriculum state; learner progress and due
 * work come from objective evidence/projections and review cards.
 */

import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { loadManifest } from "./knowledge/loader.js";
import { validateManifest } from "./knowledge/validator.js";
import { assertSafeId, resolveContainedPath } from "./knowledge/safe-path.js";
import Database from "better-sqlite3";
import {
  getConcept,
  getConceptsByTopic,
  createConcept,
  createTopic,
  getTopic,
} from "./db/database.js";
import type { Concept, Topic } from "./db/types.js";
import { getDueObjectives } from "./scheduler/index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TopicSummary {
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

/** Build a read-only objective-level summary for a topic. */
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
    topic: topic.name,
    totalConcepts,
    totalObjectives,
    ...readiness,
    dueCount,
    overdueCount,
    lastSession: topic.last_session,
  };
}

/**
 * Bootstrap a topic from a manifest JSON file.
 *
 * The manifest must contain:
 *   - topicId: string
 *   - topicName: string
 *   - concepts: array of { id, title, difficulty?, prerequisites?, tags?, source?, sourceId? }
 *
 * Creates the topic record (skips if already exists) and creates concept
 * records for each manifest entry that does not yet exist in the DB.
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
    const candidates = entry.file ? [entry.file] : [`${entry.id}.md`, `concepts/${entry.id}.md`];
    const paths = candidates.map((candidate) => resolveContainedPath(topicDir, candidate));
    return { entry, filePath: paths.find((candidate) => existsSync(candidate)) ?? null };
  });

  db.transaction(() => {
    if (!getTopic(db, topicId)) createTopic(db, { id: topicId, name: manifest.topicName });
    for (const { entry, filePath } of entries) {
      // Recheck ownership while holding the write transaction: another process
      // may have inserted this global ID after the read-only preflight.
      const existing = getConcept(db, entry.id);
      if (existing && existing.topic_id !== topicId) {
        throw new Error(`Concept ID ${entry.id} already belongs to topic ${existing.topic_id}`);
      }
      if (existing) continue;
      createConcept(db, {
        id: entry.id, topicId, title: entry.title, difficulty: entry.difficulty,
        prerequisites: entry.prerequisites, tags: entry.tags,
        source: entry.source, sourceId: entry.sourceId,
      });
      if (filePath) db.prepare("UPDATE concepts SET file_path = ? WHERE id = ?").run(filePath, entry.id);
    }
  })();
}
