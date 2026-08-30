import type Database from "better-sqlite3";
import { getGoalPreparation, getTopic } from "../db/database.js";
import type { DeliveryContext } from "../db/types.js";
import { listResumableSessions } from "../kernel/foundation.js";
import type { ResumedSession } from "../kernel/foundation.js";
import { getTodayMission } from "../plan/today.js";
import type { DailyMission, DailyMissionItem } from "../plan/today.js";

export interface StudyContinuationInput {
  goalId: string;
  now: string;
  availableMinutes?: number;
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
      mission: DailyMission;
      item: DailyMissionItem;
    }
  | {
      kind: "no_action";
      mission: DailyMission;
    };

export function getStudyContinuation(
  db: Database.Database,
  input: StudyContinuationInput,
): StudyContinuation {
  if (!getTopic(db, input.goalId)) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }

  const resumable = listResumableSessions(db, input.goalId);
  const [session, ...additional] = resumable;
  if (session) {
    return {
      kind: "resume",
      session,
      additionalResumableSessionIds: additional.map((entry) => entry.session.id),
    };
  }

  if (input.availableMinutes === undefined) {
    return {
      kind: "needs_budget",
      goalId: input.goalId,
      suggestedMinutes: getGoalPreparation(db, input.goalId)?.minutes_per_day ?? null,
    };
  }

  const mission = getTodayMission(db, {
    goalId: input.goalId,
    now: input.now,
    availableMinutes: input.availableMinutes,
    maxItems: 1,
    retestEligibleWeaknessKeys: input.retestEligibleWeaknessKeys,
    mainDeliveryContext: input.mainDeliveryContext,
    transferDeliveryContext: input.transferDeliveryContext,
  });
  const [item] = mission.items;
  return item ? { kind: "recommend", mission, item } : { kind: "no_action", mission };
}
