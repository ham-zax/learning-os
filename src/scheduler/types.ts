import type { ReviewCard, ReviewEvent, ReviewRating } from "../db/types.js";

export const REVIEW_RATING_MAPPER_VERSION = "v1";
export const SCHEDULER_VERSION = "ts-fsrs@5.4.1";

export interface SchedulerSnapshot {
  schedulerVersion: string;
  parameters: Record<string, unknown>;
}

export interface DueObjective {
  objectiveId: string;
  conceptId: string;
  capabilityId: string;
  topicId: string;
  conceptTitle: string;
  dueAt: string;
  card: ReviewCard;
}

export type { ReviewCard, ReviewEvent, ReviewRating };
