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

function moveToRequiredReconstruction(dbPath = ":memory:") {
  const fixture = createKernelFixture(dbPath);
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
        responseText: "  The mechanism changes state because of an input.\n",
        activeTimeSeconds: 600,
      });

      expect(getAttempt(state.db, state.attemptId)?.time_spent_seconds).toBe(600);
      expect(getAttempt(state.db, state.attemptId)?.reconstruction_response_text)
        .toBe("  The mechanism changes state because of an input.\n");
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
      expect(getAttempt(state.db, state.attemptId)?.reconstruction_response_text).toBeNull();
    } finally {
      state.db.close();
    }
  });

  it("preserves reconstruction after reopening without adding independent evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "learning-os-reconstruction-"));
    const dbPath = join(root, "tutor.db");
    let db: ReturnType<typeof createDatabase> | undefined;
    try {
      const state = moveToRequiredReconstruction(dbPath);
      db = state.db;
      const evidenceBefore = db.prepare("SELECT * FROM evidence_events").all();
      const cardsBefore = db.prepare("SELECT * FROM review_cards").all();
      db.close();
      db = createDatabase(dbPath);
      expect(resumeSession(db, state.sessionId).reconstructionRequired).toBe(true);
      resolveSessionReconstruction(db, state.sessionId, {
        outcome: "completed",
        responseText: "An input causes a transition from the prior state to the next.",
      });
      db.close();
      db = createDatabase(dbPath);
      expect(getAttempt(db, state.attemptId)?.reconstruction_response_text)
        .toBe("An input causes a transition from the prior state to the next.");
      expect(db.prepare("SELECT * FROM evidence_events").all()).toEqual(evidenceBefore);
      expect(db.prepare("SELECT * FROM review_cards").all()).toEqual(cardsBefore);
      expect(() => db!.prepare(
        "UPDATE attempts SET reconstruction_response_text = 'replacement' WHERE id = ?",
      ).run(state.attemptId)).toThrow("immutable");
    } finally {
      if (db?.open) db.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps reconstruction required and active time unchanged when completion is invalid", () => {
    const state = moveToRequiredReconstruction();
    try {
      for (const input of [
        { outcome: "completed", activeTimeSeconds: 600 },
        { outcome: "completed", responseText: " \n", activeTimeSeconds: 600 },
        { outcome: "opted_out", responseText: "fabricated", activeTimeSeconds: 600 },
        { outcome: "not_required", activeTimeSeconds: 600 },
      ]) {
        // Model/JS callers can bypass TypeScript; validate the runtime boundary too.
        expect(() => resolveSessionReconstruction(state.db, state.sessionId, JSON.parse(JSON.stringify(input))))
          .toThrow();
        expect(getSession(state.db, state.sessionId)?.reconstruction_status).toBe("required");
        expect(getAttempt(state.db, state.attemptId)).toMatchObject({
          time_spent_seconds: null,
          reconstruction_response_text: null,
        });
      }
    } finally {
      state.db.close();
    }
  });
});
