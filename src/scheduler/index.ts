import type Database from "better-sqlite3";
import {
  ReviewCardSchema,
  ReviewEventSchema,
  type EvidenceEvent,
  type ReviewCard,
  type ReviewEvent,
} from "../db/types.js";
import { applyReviewRating, getCurrentSchedulerSnapshot } from "./fsrs.js";
import { mapEvidenceToReviewRating } from "./rating-mapper.js";
import {
  REVIEW_RATING_MAPPER_VERSION,
  type DueObjective,
  type SchedulerSnapshot,
} from "./types.js";

export function appendReviewEventForEvidence(
  db: Database.Database,
  evidence: EvidenceEvent,
): ReviewEvent | null {
  const rating = mapEvidenceToReviewRating(evidence);
  if (rating === null) return null;

  const existing = db
    .prepare(`SELECT * FROM review_events WHERE evidence_event_id = ?`)
    .get(evidence.id);
  if (existing !== undefined) {
    return ReviewEventSchema.parse(existing);
  }

  const snapshot = getCurrentSchedulerSnapshot();
  const info = db
    .prepare(
      `INSERT INTO review_events (
         objective_id,
         evidence_event_id,
         rating,
         mapper_version,
         reviewed_at,
         scheduler_version,
         parameters_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      evidence.objective_id,
      evidence.id,
      rating,
      REVIEW_RATING_MAPPER_VERSION,
      evidence.performed_at,
      snapshot.schedulerVersion,
      JSON.stringify(snapshot.parameters),
    );

  const row = db
    .prepare(`SELECT * FROM review_events WHERE seq = ?`)
    .get(Number(info.lastInsertRowid));
  return ReviewEventSchema.parse(row);
}

export function getReviewEventsByObjective(
  db: Database.Database,
  objectiveId: string,
): ReviewEvent[] {
  return ReviewEventSchema.array().parse(
    db
      .prepare(
        `SELECT * FROM review_events
         WHERE objective_id = ?
         ORDER BY reviewed_at, seq`,
      )
      .all(objectiveId),
  );
}

export function getEffectiveReviewEvents(
  db: Database.Database,
  objectiveId: string,
): ReviewEvent[] {
  return ReviewEventSchema.array().parse(
    db
      .prepare(
        `SELECT review.*
         FROM review_events review
         JOIN evidence_events evidence
           ON evidence.id = review.evidence_event_id
          AND evidence.objective_id = review.objective_id
         WHERE review.objective_id = ?
           AND COALESCE((
             SELECT revision.action
             FROM evidence_revisions revision
             WHERE revision.evidence_event_id = evidence.id
             ORDER BY revision.seq DESC
             LIMIT 1
           ), 'restore') <> 'invalidate'
         ORDER BY review.reviewed_at, review.seq`,
      )
      .all(objectiveId),
  );
}

export function getObjectiveReviewCard(
  db: Database.Database,
  objectiveId: string,
): ReviewCard | undefined {
  const row = db
    .prepare(`SELECT * FROM review_cards WHERE objective_id = ?`)
    .get(objectiveId);
  return row === undefined ? undefined : ReviewCardSchema.parse(row);
}

export function rebuildObjectiveReviewCard(
  db: Database.Database,
  objectiveId: string,
): ReviewCard | undefined {
  const reviews = getEffectiveReviewEvents(db, objectiveId);
  if (reviews.length === 0) {
    db.prepare(`DELETE FROM review_cards WHERE objective_id = ?`).run(objectiveId);
    return undefined;
  }

  let cardJson: Record<string, unknown> | null = null;
  let dueAt = reviews[0].reviewed_at;
  let highestSeq = 0;

  for (const review of reviews) {
    const snapshot: SchedulerSnapshot = {
      schedulerVersion: review.scheduler_version,
      parameters: review.parameters_json,
    };
    const applied = applyReviewRating(
      cardJson,
      review.reviewed_at,
      review.rating,
      snapshot,
    );
    cardJson = applied.cardJson;
    dueAt = applied.dueAt;
    highestSeq = Math.max(highestSeq, review.seq);
  }

  const lastReview = reviews[reviews.length - 1];
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO review_cards (
       objective_id,
       due_at,
       card_json,
       last_rating,
       source_review_seq,
       scheduler_version,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(objective_id) DO UPDATE SET
       due_at = excluded.due_at,
       card_json = excluded.card_json,
       last_rating = excluded.last_rating,
       source_review_seq = excluded.source_review_seq,
       scheduler_version = excluded.scheduler_version,
       updated_at = excluded.updated_at`,
  ).run(
    objectiveId,
    dueAt,
    JSON.stringify(cardJson),
    lastReview.rating,
    highestSeq,
    lastReview.scheduler_version,
    updatedAt,
  );

  return getObjectiveReviewCard(db, objectiveId)!;
}

export function getDueObjectives(
  db: Database.Database,
  options: {
    topicId?: string;
    capabilityId?: string;
    asOf?: string;
  } = {},
): DueObjective[] {
  const asOf = options.asOf ?? new Date().toISOString();
  const rows = db
    .prepare(
      `SELECT objective.id AS objective_id,
              objective.concept_id,
              objective.capability_id,
              concept.topic_id,
              concept.title AS concept_title,
              card.due_at,
              card.card_json,
              card.last_rating,
              card.source_review_seq,
              card.scheduler_version,
              card.updated_at
       FROM review_cards card
       JOIN learning_objectives objective ON objective.id = card.objective_id
       JOIN concepts concept ON concept.id = objective.concept_id
       WHERE card.due_at <= @asOf
         AND (@topicId IS NULL OR concept.topic_id = @topicId)
         AND (@capabilityId IS NULL OR objective.capability_id = @capabilityId)
       ORDER BY card.due_at, objective.id`,
    )
    .all({
      asOf,
      topicId: options.topicId ?? null,
      capabilityId: options.capabilityId ?? null,
    }) as Array<{
    objective_id: string;
    concept_id: string;
    capability_id: string;
    topic_id: string;
    concept_title: string;
    due_at: string;
    card_json: string;
    last_rating: string | null;
    source_review_seq: number;
    scheduler_version: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    objectiveId: row.objective_id,
    conceptId: row.concept_id,
    capabilityId: row.capability_id,
    topicId: row.topic_id,
    conceptTitle: row.concept_title,
    dueAt: row.due_at,
    card: ReviewCardSchema.parse({
      objective_id: row.objective_id,
      due_at: row.due_at,
      card_json: row.card_json,
      last_rating: row.last_rating,
      source_review_seq: row.source_review_seq,
      scheduler_version: row.scheduler_version,
      updated_at: row.updated_at,
    }),
  }));
}
