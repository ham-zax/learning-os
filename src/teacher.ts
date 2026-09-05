import type Database from "better-sqlite3";
import {
  clearGoalStudyFocus,
  createSession,
  getGoalObjectives,
  getInteractionPreferences,
  getStudyFocusEpisode,
  listGoalStudyFocusEpisodes,
  setInteractionPreferences,
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
  getChallengeAuthoringContract,
  getLearningObjective,
  listCapabilities,
  listResumableSessions,
  openAttempt,
  recordExposure,
  recordHintUse,
  registerChallenge,
  resolveSessionReconstruction,
  resumeSession,
  submitAttempt,
} from "./kernel/foundation.js";
import type {
  CompleteSessionFeedbackInput,
  LearningObjectiveInput,
  RecordExposureInput,
  RecordHintUseInput,
  ResolveSessionReconstructionInput,
  SubmitAttemptInput,
} from "./kernel/foundation.js";
import {
  recordAssessment,
  reviseEvidence,
} from "./kernel/evidence.js";
import { getObjectiveEvidenceReceipt } from "./kernel/evidence-receipt.js";
import type { ReviseEvidenceInput } from "./kernel/evidence.js";
import type { AssessmentResultInput } from "./db/types.js";
import { getTodayMission, resolveRequestedChallenge } from "./plan/today.js";
import type { RequestedChallengeInput, TodayMissionInput } from "./plan/today.js";
import type {
  SetGoalObjectiveInput,
  SetGoalStudyFocusInput,
  SetInteractionPreferencesInput,
} from "./db/database.js";
import type { ChallengeIntent } from "./selection/types.js";
import {
  rejectActiveChallengeAttempt,
} from "./kernel/challenge-rejection.js";
import type { RejectActiveChallengeAttemptInput } from "./kernel/challenge-rejection.js";
import {
  getDurablePreparationContext,
  listDurablePreparationContexts,
} from "./onboarding/apply.js";
import {
  getRevisionNote,
  getRevisionNoteContext,
  listRevisionNotes,
  saveRevisionNote,
} from "./revision-notes.js";
import { getStudyContinuation } from "./study/continuation.js";
import type { StudyContinuationInput } from "./study/continuation.js";
import { derivePedagogyDirective } from "./teacher-pedagogy.js";
import type {
  RevisionNoteContextInput,
  SaveRevisionNoteInput,
} from "./revision-notes.js";

/**
 * Bind the provider-neutral Learning OS kernel to one database handle.
 *
 * ChatGPT is the preferred V1 teacher client, but nothing in this contract
 * depends on provider conversation IDs, transcripts, or tool state. A fresh
 * compatible teacher can continue from getStudyContinuation().
 */
export function createTeacherKernel(db: Database.Database) {
  return {
    getStudyContinuation: (input: StudyContinuationInput) =>
      getStudyContinuation(db, input),
    getTodayMission: (input: TodayMissionInput) => getTodayMission(db, input),
    resolveRequestedChallenge: (input: RequestedChallengeInput) =>
      resolveRequestedChallenge(db, input),
    listPreparationContexts: () => listDurablePreparationContexts(db),
    getPreparationContext: (goalId: string) => getDurablePreparationContext(db, goalId),
    // Tiny, pure execution directive for an already-selected intent.
    // It prevents cross-teacher drift without modeling the teaching process.
    getPedagogyRecommendation: (goalId: string, intent: ChallengeIntent) => {
      const context = getDurablePreparationContext(db, goalId);
      const objective = context?.objectives.find(
        (candidate) => candidate.objectiveId === intent.objectiveId,
      );
      return derivePedagogyDirective({
        intent,
        objective,
        interactionPreferences: getInteractionPreferences(db),
      });
    },
    setInteractionPreferences: (input: SetInteractionPreferencesInput) =>
      setInteractionPreferences(db, input),
    setGoalObjective: (input: SetGoalObjectiveInput) => setGoalObjective(db, input),
    setGoalStudyFocus: (input: SetGoalStudyFocusInput) => setGoalStudyFocus(db, input),
    clearGoalStudyFocus: (goalId: string) => clearGoalStudyFocus(db, goalId),
    getStudyFocusEpisode: (episodeId: string) => getStudyFocusEpisode(db, episodeId),
    listGoalStudyFocusEpisodes: (goalId: string) => listGoalStudyFocusEpisodes(db, goalId),
    getGoalObjectives: (goalId: string, includeInactive = false) =>
      getGoalObjectives(db, goalId, { includeInactive }),
    listCapabilities: () => listCapabilities(db),
    createLearningObjective: (input: LearningObjectiveInput) =>
      createLearningObjective(db, input),
    getLearningObjective: (objectiveId: string) => getLearningObjective(db, objectiveId),
    getObjectiveEvidenceReceipt: (objectiveId: string) =>
      getObjectiveEvidenceReceipt(db, objectiveId),
    getRevisionNoteContext: (input: RevisionNoteContextInput) =>
      getRevisionNoteContext(db, input),
    saveRevisionNote: (input: SaveRevisionNoteInput) => saveRevisionNote(db, input),
    getRevisionNote: (noteId: string) => getRevisionNote(db, noteId),
    listRevisionNotes: () => listRevisionNotes(db),
    createSession: (topicId: string, mode: DeliveryContext) =>
      createSession(db, { topicId, mode }),
    getChallenge: (challengeId: string, version: number) =>
      getChallenge(db, challengeId, version),
    getChallengeAuthoringContract: (challengeId: string, version: number) =>
      getChallengeAuthoringContract(db, challengeId, version),
    registerChallenge: (challenge: ChallengeSpecInput, intent?: ChallengeIntent) =>
      registerChallenge(db, challenge, intent),
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
    rejectActiveChallengeAttempt: (sessionId: number, input: RejectActiveChallengeAttemptInput) =>
      rejectActiveChallengeAttempt(db, sessionId, input),
    finishSessionInteraction: (sessionId: number) => finishSessionInteraction(db, sessionId),
    completeSessionFeedback: (sessionId: number, input: CompleteSessionFeedbackInput = {}) =>
      completeSessionFeedback(db, sessionId, input),
    resolveSessionReconstruction: (sessionId: number, input: ResolveSessionReconstructionInput) =>
      resolveSessionReconstruction(db, sessionId, input),
  };
}

export type TeacherKernel = ReturnType<typeof createTeacherKernel>;
