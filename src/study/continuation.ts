import type Database from "better-sqlite3";
import {
  getGoalPreparation,
  getInteractionPreferences,
  getPracticalWorkPolicy,
  getTopic,
} from "../db/database.js";
import type { PracticalWorkPolicy } from "../db/database.js";
import { PracticalWorkPreference } from "../db/types.js";
import type { DeliveryContext } from "../db/types.js";
import { getEffectiveEvidenceEventsByObjective } from "../kernel/evidence.js";
import { listResumableSessions } from "../kernel/foundation.js";
import type { ResumedSession } from "../kernel/foundation.js";
import { getSessionQuestionPresentation } from "../kernel/questions.js";
import type { QuestionPresentation } from "../kernel/questions.js";
import { getSessionFeedback } from "../kernel/feedback.js";
import type { SessionFeedback } from "../kernel/feedback.js";
import { getDurablePreparationContext } from "../onboarding/apply.js";
import { getTodayMission } from "../plan/today.js";
import type { DailyMission, DailyMissionItem, OneEpisodeMission } from "../plan/today.js";
import { derivePedagogyDirective } from "../teacher-pedagogy.js";
import type { PedagogyDirective } from "../teacher-pedagogy.js";

export interface StudyContinuationInput {
  /** Goal topic ID; when omitted, defaults to the profile's sole confirmed or active goal. */
  goalId?: string;
  /** Current ISO-8601 instant; defaults to current wall clock when omitted. */
  now?: string;
  availableMinutes?: number;
  /** Explicit one-episode request; mutually exclusive with availableMinutes. */
  oneEpisode?: boolean;
  /** Read-only planning choice before a session exists; save it when creating that session. */
  practicalWork?: PracticalWorkPreference;
  retestEligibleWeaknessKeys?: readonly string[];
  mainDeliveryContext?: DeliveryContext;
  transferDeliveryContext?: DeliveryContext;
  /** Optional knowledge root used to load manifest confusableWith links for discrimination hints. */
  knowledgeRoot?: string;
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
      pedagogy: PedagogyDirective;
    }
  | {
      kind: "no_action";
      mission: DailyMission | OneEpisodeMission;
    });

function resolveDefaultGoalId(db: Database.Database): string {
  const prepared = db
    .prepare(`SELECT goal_id FROM goal_preparation ORDER BY confirmed_at DESC, goal_id`)
    .all() as Array<{ goal_id: string }>;
  if (prepared.length === 1) return prepared[0]!.goal_id;
  if (prepared.length > 1) {
    throw new Error(
      `Multiple goals found (${prepared.map((row) => row.goal_id).join(", ")}); specify goalId.`,
    );
  }

  const activeGoals = db
    .prepare(`SELECT DISTINCT goal_id FROM goal_objectives WHERE is_active = 1 ORDER BY goal_id`)
    .all() as Array<{ goal_id: string }>;
  if (activeGoals.length === 1) return activeGoals[0]!.goal_id;
  if (activeGoals.length > 1) {
    throw new Error(
      `Multiple active goals found (${activeGoals.map((row) => row.goal_id).join(", ")}); specify goalId.`,
    );
  }

  const topics = db
    .prepare(`SELECT id FROM topics ORDER BY id`)
    .all() as Array<{ id: string }>;
  if (topics.length === 1) return topics[0]!.id;
  if (topics.length > 1) {
    throw new Error(
      `Multiple topics found (${topics.map((row) => row.id).join(", ")}); specify goalId.`,
    );
  }

  throw new Error("No goals found in this profile; onboard a goal first.");
}

export function getStudyContinuation(
  db: Database.Database,
  input: StudyContinuationInput = {},
): StudyContinuation {
  const goalId = input.goalId ?? resolveDefaultGoalId(db);
  const now = input.now ?? new Date().toISOString();
  if (!getTopic(db, goalId)) {
    throw new Error(`Goal topic not found: ${goalId}`);
  }

  if (input.oneEpisode && input.availableMinutes !== undefined) {
    throw new Error("Choose oneEpisode or availableMinutes, not both");
  }
  const requestedPracticalWork = input.practicalWork === undefined
    ? undefined : PracticalWorkPreference.parse(input.practicalWork);
  const resumable = listResumableSessions(db, goalId);
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
      goalId,
      suggestedMinutes: getGoalPreparation(db, goalId)?.minutes_per_day ?? null,
      practicalWork,
    };
  }

  const mission = getTodayMission(db, {
    goalId,
    now,
    availableMinutes: input.oneEpisode ? null : input.availableMinutes!,
    maxItems: 1,
    retestEligibleWeaknessKeys: input.retestEligibleWeaknessKeys,
    mainDeliveryContext: input.mainDeliveryContext,
    transferDeliveryContext: input.transferDeliveryContext,
    practicalWork: practicalWork.preference,
    knowledgeRoot: input.knowledgeRoot,
  });
  const [item] = mission.items;
  if (!item) {
    return { kind: "no_action", mission, practicalWork };
  }
  const prepContext = getDurablePreparationContext(db, item.intent.goalId);
  const prepObjective = prepContext?.objectives.find(
    (candidate) => candidate.objectiveId === item.intent.objectiveId,
  );
  const gradable = getEffectiveEvidenceEventsByObjective(db, item.intent.objectiveId).filter(
    (event) => event.result !== "ungradable",
  );
  let consecutiveFailures = 0;
  for (let i = gradable.length - 1; i >= 0; i -= 1) {
    if (gradable[i]!.result === "correct") break;
    consecutiveFailures += 1;
  }
  const pedagogy = derivePedagogyDirective({
    intent: item.intent,
    objective: prepObjective,
    interactionPreferences: getInteractionPreferences(db),
    consecutiveFailures,
    latestResult: gradable.at(-1)?.result ?? null,
  });
  return { kind: "recommend", mission, item, pedagogy, practicalWork };
}
