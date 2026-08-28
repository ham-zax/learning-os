/**
 * Topic/concept state helpers.
 *
 * Legacy concept scheduling columns remain readable provenance, while active
 * due queries use objective-level review cards.
 */

import { readFileSync } from "node:fs";
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

interface ManifestEntry {
  id: string;
  title: string;
  difficulty: number;
  prerequisites?: string[];
  tags?: string[];
  source?: string;
  sourceId?: string;
}

interface Manifest {
  topicId: string;
  topicName: string;
  concepts: ManifestEntry[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Retrieve concept metadata, including preserved legacy scheduling fields. */
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
 * Legacy concept scheduling columns retain their database defaults for provenance.
 */
export function initializeTopic(
  db: Database.Database,
  topicId: string,
  manifestPath: string,
): void {
  const raw = readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(raw) as Manifest;
  if (typeof manifest.topicId !== "string" || manifest.topicId.trim().length === 0) {
    throw new Error("Manifest topicId must be a non-empty string");
  }
  if (manifest.topicId !== topicId) {
    throw new Error(`Manifest topicId ${manifest.topicId} does not match requested topic ${topicId}`);
  }
  if (typeof manifest.topicName !== "string" || manifest.topicName.trim().length === 0) {
    throw new Error("Manifest topicName must be a non-empty string");
  }
  if (!Array.isArray(manifest.concepts)) {
    throw new Error("Manifest concepts must be an array");
  }

  const conceptIds = new Set<string>();
  for (const entry of manifest.concepts) {
    if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
      throw new Error("Manifest concept IDs must be non-empty strings");
    }
    if (conceptIds.has(entry.id)) {
      throw new Error(`Duplicate concept ID in manifest: ${entry.id}`);
    }
    conceptIds.add(entry.id);
    if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
      throw new Error(`Manifest concept ${entry.id} title must be a non-empty string`);
    }
    if (!Number.isInteger(entry.difficulty) || entry.difficulty < 1 || entry.difficulty > 5) {
      throw new Error(`Manifest concept ${entry.id} difficulty must be an integer from 1 to 5`);
    }
    if (entry.prerequisites !== undefined && !Array.isArray(entry.prerequisites)) {
      throw new Error(`Manifest concept ${entry.id} prerequisites must be an array`);
    }
    for (const prerequisite of entry.prerequisites ?? []) {
      if (!conceptIds.has(prerequisite) && !manifest.concepts.some((candidate) => candidate.id === prerequisite)) {
        throw new Error(`Manifest concept ${entry.id} references unknown prerequisite ${prerequisite}`);
      }
    }
  }

  // Create topic if it doesn't exist
  const existing = getTopic(db, topicId);
  if (!existing) {
    createTopic(db, {
      id: topicId,
      name: manifest.topicName,
    });
  }

  // Create concepts that don't already exist
  for (const entry of manifest.concepts) {
    const existingConcept = getConcept(db, entry.id);
    if (existingConcept) {
      if (existingConcept.topic_id !== topicId) {
        throw new Error(
          `Concept ID ${entry.id} already belongs to topic ${existingConcept.topic_id}; concept IDs are global within a learner profile`,
        );
      }
      continue;
    }

    createConcept(db, {
      id: entry.id,
      topicId,
      title: entry.title,
      difficulty: entry.difficulty,
      prerequisites: entry.prerequisites,
      tags: entry.tags,
      source: entry.source,
      sourceId: entry.sourceId,
    });

  }
}
