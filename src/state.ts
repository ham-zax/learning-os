/**
 * Concept state management with SM-2 integration.
 *
 * Bridges the SM-2 spaced-repetition algorithm with the persistence layer,
 * providing higher-level operations for reviewing concepts, querying due
 * items, generating topic summaries, and bootstrapping topics from manifests.
 */

import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import {
  getConcept,
  getConceptsByTopic,
  getDueConcepts as dbGetDueConcepts,
  updateConcept,
  createConcept,
  createTopic,
  getTopic,
} from "./db/database.js";
import type { Concept, Topic } from "./db/types.js";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve a concept by ID with its SM-2 state parsed from the DB row.
 *
 * The Concept type from the DB already contains ef, interval, repetitions,
 * next_review, last_grade, and status as properly typed fields (the Zod
 * schemas in types.ts handle JSON-to-array coercion).  This function simply
 * wraps getConcept and throws if the concept is missing so callers can rely
 * on a non-null result.
 */
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

/**
 * Get all concepts that are due for review: next_review is today or earlier,
 * or next_review has never been set (unseen / brand-new concepts).
 *
 * Ordered so that overdue items (NULL next_review) come first, then by
 * next_review ascending.
 */
export function getDueConcepts(
  db: Database.Database,
  topicId?: string,
): Concept[] {
  const today = todayISO();
  if (topicId) {
    return db
      .prepare(
        `SELECT * FROM concepts
         WHERE topic_id = @topicId
           AND (next_review <= @today OR next_review IS NULL)
         ORDER BY
           CASE WHEN next_review IS NULL THEN 0 ELSE 1 END,
           next_review ASC`,
      )
      .all({ topicId, today }) as Concept[];
  }
  return db
    .prepare(
      `SELECT * FROM concepts
       WHERE (next_review <= @today OR next_review IS NULL)
       ORDER BY
         CASE WHEN next_review IS NULL THEN 0 ELSE 1 END,
         next_review ASC`,
    )
    .all({ today }) as Concept[];
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
  const today = todayISO();

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

  // Due = next_review <= today OR next_review IS NULL
  // Overdue = next_review IS NULL (never reviewed) OR next_review < today
  let dueCount = 0;
  let overdueCount = 0;

  for (const c of concepts) {
    if (c.next_review === null || c.next_review <= today) {
      dueCount++;
    }
    if (c.next_review === null || c.next_review < today) {
      overdueCount++;
    }
  }

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
 * New concepts start as "unseen" with ef 2.5, interval 0, repetitions 0.
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

    // Set SM-2 defaults explicitly (createConcept already uses DB defaults,
    // but we set them here for clarity and in case defaults change).
    updateConcept(db, entry.id, {
      status: "unseen",
      ef: 2.5,
      interval: 0,
      repetitions: 0,
    });
  }
}
