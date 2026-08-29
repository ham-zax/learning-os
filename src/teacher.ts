import type Database from "better-sqlite3";
import {
  clearGoalStudyFocus,
  createSession,
  getGoalObjectives,
  setGoalObjective,
  setGoalStudyFocus,
} from "./db/database.js";
import type {
  ChallengeSpecInput,
  DeliveryContext,
} from "./db/types.js";
import {
  abandonUnsubmittedSession,
  completeSessionFeedback,
  createLearningObjective,
  finishSessionInteraction,
  getChallenge,
  getLearningObjective,
  listCapabilities,
  listResumableSessions,
  openAttempt,
  recordExposure,
  recordHintUse,
  registerChallenge,
  resumeSession,
  submitAttempt,
} from "./kernel/foundation.js";
import type {
  LearningObjectiveInput,
  RecordExposureInput,
  RecordHintUseInput,
  SubmitAttemptInput,
} from "./kernel/foundation.js";
import {
  recordAssessment,
  reviseEvidence,
} from "./kernel/evidence.js";
import type { ReviseEvidenceInput } from "./kernel/evidence.js";
import type { AssessmentResultInput } from "./db/types.js";
import { getTodayMission, resolveRequestedChallenge } from "./plan/today.js";
import type { RequestedChallengeInput, TodayMissionInput } from "./plan/today.js";
import type { SetGoalObjectiveInput, SetGoalStudyFocusInput } from "./db/database.js";
import {
  getDurablePreparationContext,
  listDurablePreparationContexts,
} from "./onboarding/apply.js";

/**
 * Bind the provider-neutral Learning OS kernel to one database handle.
 *
 * ChatGPT is the preferred V1 teacher client, but nothing in this contract
 * depends on provider conversation IDs, transcripts, or tool state. A fresh
 * compatible teacher can continue from getTodayMission() + resumeSession().
 */
export function createTeacherKernel(db: Database.Database) {
  return {
    getTodayMission: (input: TodayMissionInput) => getTodayMission(db, input),
    resolveRequestedChallenge: (input: RequestedChallengeInput) =>
      resolveRequestedChallenge(db, input),
    listPreparationContexts: () => listDurablePreparationContexts(db),
    getPreparationContext: (goalId: string) => getDurablePreparationContext(db, goalId),
    setGoalObjective: (input: SetGoalObjectiveInput) => setGoalObjective(db, input),
    setGoalStudyFocus: (input: SetGoalStudyFocusInput) => setGoalStudyFocus(db, input),
    clearGoalStudyFocus: (goalId: string) => clearGoalStudyFocus(db, goalId),
    getGoalObjectives: (goalId: string, includeInactive = false) =>
      getGoalObjectives(db, goalId, { includeInactive }),
    listCapabilities: () => listCapabilities(db),
    createLearningObjective: (input: LearningObjectiveInput) =>
      createLearningObjective(db, input),
    getLearningObjective: (objectiveId: string) => getLearningObjective(db, objectiveId),
    createSession: (topicId: string, mode: DeliveryContext) =>
      createSession(db, { topicId, mode }),
    getChallenge: (challengeId: string, version: number) =>
      getChallenge(db, challengeId, version),
    registerChallenge: (challenge: ChallengeSpecInput) => registerChallenge(db, challenge),
    openAttempt: (challengeId: string, version: number, sessionId: number | null = null) =>
      openAttempt(db, challengeId, version, sessionId),
    recordHintUse: (attemptId: number, input: RecordHintUseInput) =>
      recordHintUse(db, attemptId, input),
    recordExposure: (sessionId: number | null, input: RecordExposureInput) =>
      recordExposure(db, sessionId, input),
    submitAttempt: (attemptId: number, input: SubmitAttemptInput) =>
      submitAttempt(db, attemptId, input),
    recordAssessment: (attemptId: number, assessment: AssessmentResultInput) =>
      recordAssessment(db, attemptId, assessment),
    reviseEvidence: (evidenceEventId: string, input: ReviseEvidenceInput) =>
      reviseEvidence(db, evidenceEventId, input),
    listResumableSessions: (topicId?: string) => listResumableSessions(db, topicId),
    resumeSession: (sessionId: number) => resumeSession(db, sessionId),
    abandonUnsubmittedSession: (sessionId: number) => abandonUnsubmittedSession(db, sessionId),
    finishSessionInteraction: (sessionId: number) => finishSessionInteraction(db, sessionId),
    completeSessionFeedback: (sessionId: number) => completeSessionFeedback(db, sessionId),
  };
}

export type TeacherKernel = ReturnType<typeof createTeacherKernel>;
