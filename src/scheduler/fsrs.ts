import {
  Rating,
  TypeConvert,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type CardInput,
  type FSRSParameters,
  type Grade,
} from "ts-fsrs";
import type { ReviewRating, SchedulerSnapshot } from "./types.js";
import { SCHEDULER_VERSION } from "./types.js";

const CURRENT_PARAMETERS: FSRSParameters = generatorParameters({
  enable_fuzz: false,
});

function toJsonRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function ratingToGrade(rating: ReviewRating): Grade {
  switch (rating) {
    case "Again":
      return Rating.Again;
    case "Hard":
      return Rating.Hard;
    case "Good":
      return Rating.Good;
  }
}

function parametersFromSnapshot(snapshot: SchedulerSnapshot): FSRSParameters {
  if (snapshot.schedulerVersion !== SCHEDULER_VERSION) {
    throw new Error(`Unsupported scheduler version: ${snapshot.schedulerVersion}`);
  }
  return generatorParameters(snapshot.parameters as Partial<FSRSParameters>);
}

function cardFromJson(cardJson: Record<string, unknown>): Card {
  return TypeConvert.card(cardJson as unknown as CardInput);
}

export function getCurrentSchedulerSnapshot(): SchedulerSnapshot {
  return {
    schedulerVersion: SCHEDULER_VERSION,
    parameters: toJsonRecord(CURRENT_PARAMETERS),
  };
}

export function applyReviewRating(
  cardJson: Record<string, unknown> | null,
  reviewedAt: string,
  rating: ReviewRating,
  snapshot: SchedulerSnapshot,
): { cardJson: Record<string, unknown>; dueAt: string } {
  const scheduler = fsrs(parametersFromSnapshot(snapshot));
  const card = cardJson === null
    ? createEmptyCard(reviewedAt)
    : cardFromJson(cardJson);
  const next = scheduler.next(card, reviewedAt, ratingToGrade(rating)).card;

  return {
    cardJson: toJsonRecord(next),
    dueAt: next.due.toISOString(),
  };
}
