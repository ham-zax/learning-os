import type Database from "better-sqlite3";
import { getGoalPreparation, getTopic } from "../db/database.js";
import type { DeliveryContext } from "../db/types.js";
import { listResumableSessions } from "../kernel/foundation.js";
import type { ResumedSession } from "../kernel/foundation.js";
import { getTodayMission } from "../plan/today.js";
import type { DailyMission, DailyMissionItem, OneEpisodeMission } from "../plan/today.js";

export interface StudyContinuationInput {
  goalId: string;
  now: string;
  availableMinutes?: number;
  /** Explicit one-episode request; mutually exclusive with availableMinutes. */
  oneEpisode?: boolean;
  retestEligibleWeaknessKeys?: readonly string[];
  mainDeliveryContext?: DeliveryContext;
  transferDeliveryContext?: DeliveryContext;
}

export type StudyContinuation =
  | {
      kind: "resume";
      session: ResumedSession;
      additionalResumableSessionIds: number[];
    }
  | {
      kind: "needs_budget";
      goalId: string;
      suggestedMinutes: number | null;
    }
  | {
      kind: "recommend";
      mission: DailyMission | OneEpisodeMission;
      item: DailyMissionItem;
    }
  | {
      kind: "no_action";
      mission: DailyMission | OneEpisodeMission;
    };

export function getStudyContinuation(
  db: Database.Database,
  input: StudyContinuationInput,
): StudyContinuation {
  if (!getTopic(db, input.goalId)) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }

  if (input.oneEpisode && input.availableMinutes !== undefined) {
    throw new Error("Choose oneEpisode or availableMinutes, not both");
  }
  const resumable = listResumableSessions(db, input.goalId);
  const requiredReconstruction = resumable.find((entry) => entry.reconstructionRequired);
  const session = requiredReconstruction ?? resumable[0];
  if (session) {
    return {
      kind: "resume",
      session,
      additionalResumableSessionIds: resumable
        .filter((entry) => entry.session.id !== session.session.id)
        .map((entry) => entry.session.id),
    };
  }

  if (input.availableMinutes === undefined && !input.oneEpisode) {
    return {
      kind: "needs_budget",
      goalId: input.goalId,
      suggestedMinutes: getGoalPreparation(db, input.goalId)?.minutes_per_day ?? null,
    };
  }

  const mission = getTodayMission(db, {
    goalId: input.goalId,
    now: input.now,
    availableMinutes: input.oneEpisode ? null : input.availableMinutes!,
    maxItems: 1,
    retestEligibleWeaknessKeys: input.retestEligibleWeaknessKeys,
    mainDeliveryContext: input.mainDeliveryContext,
    transferDeliveryContext: input.transferDeliveryContext,
  });
  const [item] = mission.items;
  return item ? { kind: "recommend", mission, item } : { kind: "no_action", mission };
}
