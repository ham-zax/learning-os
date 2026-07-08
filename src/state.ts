/**
 * Concept state management with SM-2 integration.
 *
 * Bridges the SM-2 spaced-repetition algorithm with the persistence layer,
 * providing higher-level operations for reviewing concepts, querying due
 * items, generating topic summaries, and bootstrapping topics from manifests.
 */

import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { sm2, updateStatus, type SM2Result } from "./sm2.js";
import {
  getConcept,
  getConceptsByTopic,
  getDueConcepts as dbGetDueConcepts,
  updateConcept,
  createConcept,
  createTopic,
  getTopic,
  updateTopic,
  createReview,
} from "./db/database.js";
import type { Concept, Topic, ConceptStatus } from "./db/types.js";

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
 * Run an SM-2 review on a concept: update easiness factor, interval,
 * repetitions, next-review date, and status, then persist the changes
 * and record a review row.
 *
 * @returns The SM-2 result (ef, interval, repetitions, nextReview) after
 *          the algorithm has been applied.
 */
export function updateConceptAfterReview(
  db: Database.Database,
  conceptId: string,
  grade: number,
  mode: string,
): SM2Result {
  const concept = getConceptState(db, conceptId);
  const today = todayISO();

  // Run SM-2 algorithm
  const result = sm2(grade, concept.ef, concept.interval, concept.repetitions, today);

  // Derive new status
  const newStatus: ConceptStatus = updateStatus(
    concept.status,
    grade,
    result.repetitions,
    result.interval,
  );

  // Persist updated concept fields
  updateConcept(db, conceptId, {
    ef: result.ef,
    interval: result.interval,
    repetitions: result.repetitions,
    next_review: result.nextReview,
    last_grade: grade,
    status: newStatus,
  });

  // Record the review (no session association here; callers can link later)
  createReview(db, {
    sessionId: null,
    conceptId,
    grade,
    mode,
  });

  return result;
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
 * Build a summary for a topic: concept counts by status, due/overdue counts,
 * and a suggestion for phase advancement.
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

  // Phase auto-advance check: if 80% of concepts are at reviewing/mastered
  // with ef > 2.3, suggest bumping the phase.
  const total = concepts.length;
  const mature = reviewing + mastered;
  if (total > 0 && mature / total >= 0.8) {
    const highEfCount = concepts.filter(
      (c) =>
        (c.status === "reviewing" || c.status === "mastered") && c.ef > 2.3,
    ).length;
    if (highEfCount / total >= 0.8 && topic.phase < 5) {
      updateTopic(db, topicId, { phase: topic.phase + 1 });
      return getTopicSummary(db, topicId); // re-read with updated phase
    }
  }

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
