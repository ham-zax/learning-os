import { describe, expect, it } from "vitest";
import { createTeacherKernel } from "../src/teacher.js";
import { summarizeDogfoodMetrics } from "../src/evaluation/dogfood-metrics.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("read-only dogfood metrics", () => {
  it("counts observed evidence, revisions, exposure, and abandonment without changing learner state", () => {
    const fixture = createKernelFixture();
    const { db } = fixture;
    const kernel = createTeacherKernel(db);
    try {
      const first = fixture.openPracticeAttempt();
      kernel.submitAttempt(first.attemptId, { responseText: "An input changes the state." });
      const assessment = kernel.recordAssessment(first.attemptId, {
        evaluatorType: "agent", assessmentBasis: "frozen_rubric",
        objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: "correct",
          criteriaMet: ["mechanism"], criteriaUnmet: [], rationale: "Explains the mechanism." }],
      });
      kernel.recordExposure(first.sessionId, { attemptId: first.attemptId,
        objectiveIds: [OBJECTIVE_ID], exposureType: "explanation_shown",
        teachingMaterial: { content: "A state transition follows an input." } });
      kernel.completeSessionFeedback(first.sessionId);
      kernel.reviseEvidence(assessment.evidenceEvents[0]!.id, {
        action: "invalidate", reason: "Synthetic assessment correction.",
      });

      const second = fixture.openPracticeAttempt();
      kernel.abandonUnsubmittedSession(second.sessionId);

      const before = db.totalChanges;
      const summary = summarizeDogfoodMetrics(db, { goalId: GOAL_ID, delayedDays: 7 });
      expect(db.totalChanges).toBe(before);
      expect(summary).toMatchObject({
        goalId: GOAL_ID, delayedDays: 7,
        assessedEvents: 1, effectiveAssessedEvents: 0,
        delayedValidRetrievals: { total: 0, correct: 0 },
        validCorrectTransfers: 0, evidenceRevisions: 1,
        repairExposures: 1, reconstructionAnswers: 0, abandonedEpisodes: 1,
      });
    } finally {
      db.close();
    }
  });

  it("rejects an unknown goal instead of reporting a misleading empty pilot", () => {
    const { db } = createKernelFixture();
    try {
      expect(() => summarizeDogfoodMetrics(db, { goalId: "missing" }))
        .toThrow("Goal not found");
    } finally {
      db.close();
    }
  });
});
