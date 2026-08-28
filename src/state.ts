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
  phase: number;
  total: number;
  unseen: number;
  learning: number;
  reviewing: number;
  mastered: number;
  dueCount: number;
  overdueCount: number;
  lastSession: string | null;
}

interface ManifestEntry {
  id: string;
  title: string;
  difficulty?: number;
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

/** Get concepts whose explain objective has an effective due review card. */
export function getDueConcepts(
  db: Database.Database,
  topicId?: string,
): Concept[] {
  return getDueObjectives(db, { topicId, capabilityId: "explain" })
    .map((due) => getConcept(db, due.conceptId))
    .filter((concept): concept is Concept => concept !== undefined);
}

/**
 * Build a read-only summary for a topic: concept counts by status and
 * due/overdue counts.
 */
export function getTopicSummary(
  db: Database.Database,
  topicId: string,
): TopicSummary {
  const topic = getTopic(db, topicId);
  if (!topic) {
    throw new Error(`Topic not found: ${topicId}`);
  }

  const concepts = getConceptsByTopic(db, topicId);
  const now = new Date().toISOString();

  // Count by status
  let unseen = 0;
  let learning = 0;
  let reviewing = 0;
  let mastered = 0;

  for (const c of concepts) {
    switch (c.status) {
      case "unseen":
        unseen++;
        break;
      case "learning":
        learning++;
        break;
      case "reviewing":
        reviewing++;
        break;
      case "mastered":
        mastered++;
        break;
    }
  }

  const dueObjectives = getDueObjectives(db, {
    topicId,
    capabilityId: "explain",
    asOf: now,
  });
  const dueCount = dueObjectives.length;
  const overdueCount = dueObjectives.filter((due) => due.dueAt < now).length;

  const total = concepts.length;

  return {
    topic: topic.name,
    phase: topic.phase,
    total,
    unseen,
    learning,
    reviewing,
    mastered,
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
  const manifest: Manifest = JSON.parse(raw);

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
    if (existingConcept) continue;

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
