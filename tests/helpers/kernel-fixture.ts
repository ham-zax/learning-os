import type Database from "better-sqlite3";
import {
  createConcept,
  createDatabase,
  createSession,
  createTopic,
  setGoalObjective,
  setGoalPreparation,
} from "../../src/db/database.js";
import {
  createLearningObjective,
  openAttempt,
  registerChallenge,
} from "../../src/kernel/foundation.js";

export const GOAL_ID = "goal";
export const CONCEPT_ID = "concept";
export const OBJECTIVE_ID = "concept:explain";
export const CHALLENGE_ID = "challenge";

export interface KernelFixture {
  db: Database.Database;
  openPracticeAttempt(): { sessionId: number; attemptId: number };
}

export function createKernelFixture(dbPath = ":memory:"): KernelFixture {
  const db = createDatabase(dbPath);
  createTopic(db, { id: GOAL_ID, name: "Goal" });
  createConcept(db, { id: CONCEPT_ID, topicId: GOAL_ID, title: "Concept" });
  createLearningObjective(db, {
    id: OBJECTIVE_ID,
    conceptId: CONCEPT_ID,
    capabilityId: "explain",
  });
  setGoalObjective(db, {
    goalId: GOAL_ID,
    objectiveId: OBJECTIVE_ID,
    importance: "core",
    targetReadiness: "guided",
  });
  setGoalPreparation(db, {
    goalId: GOAL_ID,
    purpose: "interview",
    minutesPerDay: 30,
    daysPerWeek: 5,
    confirmedAt: "2026-08-30T00:00:00.000Z",
  });
  registerChallenge(db, {
    id: CHALLENGE_ID,
    version: 1,
    publicPrompt: "Explain the mechanism.",
    taskForm: "explanation",
    deliveryContext: "practice",
    targets: [
      {
        objectiveId: OBJECTIVE_ID,
        novelty: "same",
        criterionIds: ["mechanism"],
      },
    ],
    rubric: {
      id: "challenge-rubric",
      version: 1,
      criteria: [
        {
          id: "mechanism",
          objectiveId: OBJECTIVE_ID,
          required: true,
          description: "Explains the mechanism",
        },
      ],
    },
    verification: { required: false, basis: "frozen_rubric" },
  });

  return {
    db,
    openPracticeAttempt() {
      const session = createSession(db, { topicId: GOAL_ID, mode: "practice" });
      const opened = openAttempt(db, CHALLENGE_ID, 1, session.id);
      return { sessionId: session.id, attemptId: opened.attempt.id };
    },
  };
}
