import type Database from "better-sqlite3";
import { getGoalPreparation, getPracticalWorkPolicy, getTopic } from "../db/database.js";
import type { PracticalWorkPolicy } from "../db/database.js";
import { PracticalWorkPreference } from "../db/types.js";
import type { DeliveryContext } from "../db/types.js";
import { listResumableSessions } from "../kernel/foundation.js";
import type { ResumedSession } from "../kernel/foundation.js";
import { getSessionQuestionPresentation } from "../kernel/questions.js";
import type { QuestionPresentation } from "../kernel/questions.js";
import { getSessionFeedback } from "../kernel/feedback.js";
import type { SessionFeedback } from "../kernel/feedback.js";
import { getTodayMission } from "../plan/today.js";
import type { DailyMission, DailyMissionItem, OneEpisodeMission } from "../plan/today.js";

export interface StudyContinuationInput {
  goalId: string;
  now: string;
  availableMinutes?: number;
  /** Explicit one-episode request; mutually exclusive with availableMinutes. */
  oneEpisode?: boolean;
  /** Read-only planning choice before a session exists; save it when creating that session. */
  practicalWork?: PracticalWorkPreference;
  retestEligibleWeaknessKeys?: readonly string[];
  mainDeliveryContext?: DeliveryContext;
  transferDeliveryContext?: DeliveryContext;
}

export type StudyContinuation = {
  practicalWork: PracticalWorkPolicy | { preference: PracticalWorkPreference; source: "request" };
} & (
  | {
      kind: "resume";
      session: ResumedSession;
      presentation: QuestionPresentation;
      feedback: SessionFeedback;
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
    });

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
  const requestedPracticalWork = input.practicalWork === undefined
    ? undefined : PracticalWorkPreference.parse(input.practicalWork);
  const resumable = listResumableSessions(db, input.goalId);
  const requiredReconstruction = resumable.find((entry) => entry.reconstructionRequired);
  const session = requiredReconstruction ?? resumable[0];
  if (session) {
    return {
      kind: "resume",
      session,
      presentation: getSessionQuestionPresentation(db, session.session.id),
      feedback: getSessionFeedback(db, session.session.id),
      practicalWork: getPracticalWorkPolicy(db, session.session.id),
      additionalResumableSessionIds: resumable
        .filter((entry) => entry.session.id !== session.session.id)
        .map((entry) => entry.session.id),
    };
  }

  const practicalWork = requestedPracticalWork === undefined
    ? getPracticalWorkPolicy(db)
    : { preference: requestedPracticalWork, source: "request" as const };

  if (input.availableMinutes === undefined && !input.oneEpisode) {
    return {
      kind: "needs_budget",
      goalId: input.goalId,
      suggestedMinutes: getGoalPreparation(db, input.goalId)?.minutes_per_day ?? null,
      practicalWork,
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
    practicalWork: practicalWork.preference,
  });
  const [item] = mission.items;
  return item ? { kind: "recommend", mission, item, practicalWork }
    : { kind: "no_action", mission, practicalWork };
}
