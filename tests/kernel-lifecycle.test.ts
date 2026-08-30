import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase, getSession } from "../src/db/database.js";
import {
  completeSessionFeedback,
  getAttempt,
  listResumableSessions,
  recordExposure,
  resolveSessionReconstruction,
  resumeSession,
  submitAttempt,
} from "../src/kernel/foundation.js";
import { recordAssessment } from "../src/kernel/evidence.js";
import {
  createKernelFixture,
  GOAL_ID,
  OBJECTIVE_ID,
} from "./helpers/kernel-fixture.js";

function moveToRequiredReconstruction() {
  const fixture = createKernelFixture();
  const { sessionId, attemptId } = fixture.openPracticeAttempt();
  submitAttempt(fixture.db, attemptId, { responseText: "I do not know." });
  recordAssessment(fixture.db, attemptId, {
    evaluatorType: "agent",
    assessmentBasis: "frozen_rubric",
    objectiveResults: [
      {
        objectiveId: OBJECTIVE_ID,
        result: "incorrect",
        criteriaMet: [],
        criteriaUnmet: ["mechanism"],
        rationale: "The mechanism is missing.",
      },
    ],
  });
  recordExposure(fixture.db, sessionId, {
    attemptId,
    objectiveIds: [OBJECTIVE_ID],
    exposureType: "answer_revealed",
    teachingMaterial: {
      content: "The mechanism is a causal state transition.",
    },
    requireReconstruction: true,
  });
  return { ...fixture, sessionId, attemptId };
}

describe("durable kernel lifecycle", () => {
  it("resumes an unsubmitted attempt after reopening its database", () => {
    const root = mkdtempSync(join(tmpdir(), "learning-os-lifecycle-"));
    const dbPath = join(root, "tutor.db");
    let reopened: ReturnType<typeof createDatabase> | undefined;
    try {
      const fixture = createKernelFixture(dbPath);
      const { sessionId, attemptId } = fixture.openPracticeAttempt();
      fixture.db.close();

      reopened = createDatabase(dbPath);
      expect(listResumableSessions(reopened, GOAL_ID)).toMatchObject([
        {
          session: { id: sessionId },
          phase: "awaiting_response",
          pendingAction: "collect_response",
          activeAttempt: { id: attemptId, submitted_at: null },
        },
      ]);
    } finally {
      reopened?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resumes submitted rubric work at assessment", () => {
    const fixture = createKernelFixture();
    try {
      const { sessionId, attemptId } = fixture.openPracticeAttempt();
      submitAttempt(fixture.db, attemptId, { responseText: "A state transition." });

      expect(resumeSession(fixture.db, sessionId)).toMatchObject({
        phase: "awaiting_assessment",
        pendingAction: "assess_response",
        activeAttempt: { id: attemptId },
      });
    } finally {
      fixture.db.close();
    }
  });

  it("blocks feedback closure until reconstruction and stores only reliable active time", () => {
    const state = moveToRequiredReconstruction();
    try {
      expect(() => completeSessionFeedback(state.db, state.sessionId)).toThrow(
        "requires learner reconstruction",
      );

      resolveSessionReconstruction(state.db, state.sessionId, {
        outcome: "completed",
        activeTimeSeconds: 600,
      });

      expect(getAttempt(state.db, state.attemptId)?.time_spent_seconds).toBe(600);
      expect(getSession(state.db, state.sessionId)).toMatchObject({
        phase: "complete",
        reconstruction_status: "completed",
      });
      expect(listResumableSessions(state.db, GOAL_ID)).toEqual([]);
    } finally {
      state.db.close();
    }
  });

  it("records an explicit reconstruction opt-out truthfully", () => {
    const state = moveToRequiredReconstruction();
    try {
      resolveSessionReconstruction(state.db, state.sessionId, {
        outcome: "opted_out",
      });

      expect(getSession(state.db, state.sessionId)).toMatchObject({
        phase: "complete",
        reconstruction_status: "opted_out",
      });
      expect(getAttempt(state.db, state.attemptId)?.time_spent_seconds).toBeNull();
    } finally {
      state.db.close();
    }
  });
});
