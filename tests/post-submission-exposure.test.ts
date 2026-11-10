import { afterEach, describe, expect, it, vi } from "vitest";
import { createTeacherKernel } from "../src/teacher.js";
import { getObjectiveReviewCard, getReviewEventsByObjective } from "../src/scheduler/index.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("post-submission exposure causality", () => {
  afterEach(() => vi.useRealTimers());

  it("does not taint retrieval_valid or zero out delay_seconds when post-submission exposure shares the submission millisecond", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    const { db } = createKernelFixture();
    const kernel = createTeacherKernel(db);
    try {
      kernel.setGoalObjective({
        goalId: GOAL_ID,
        objectiveId: OBJECTIVE_ID,
        targetReadiness: "independent",
        requireDurability: true,
      });
      const template = kernel.getChallenge("challenge", 1)!;
      kernel.registerChallenge({ ...template, id: "review-surface", deliveryContext: "review" });

      // Initial baseline attempt on Day 1
      const s1 = kernel.createSession(GOAL_ID, "practice");
      const a1 = kernel.openAttempt("challenge", 1, s1.id).attempt;
      kernel.submitAndAssess(a1.id, {
        closeIfComplete: true,
        response: { responseText: "Initial unaided mechanism explanation." },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{
            objectiveId: OBJECTIVE_ID,
            result: "correct",
            criteriaMet: ["mechanism"],
            criteriaUnmet: [],
            rationale: "Correct initial mechanism.",
          }],
        },
      });

      // Return 8 days later; submit and immediately reveal post-submission reference in the same millisecond
      vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));
      const s2 = kernel.createSession(GOAL_ID, "review");
      const a2 = kernel.openAttempt("review-surface", 1, s2.id).attempt;
      kernel.submitAttempt(a2.id, { responseText: "Delayed unaided explanation." });
      const exposures = kernel.recordExposure(s2.id, {
        attemptId: a2.id,
        objectiveIds: [OBJECTIVE_ID],
        exposureType: "answer_revealed",
        teachingMaterial: { content: "Post-submission reference card.", format: "markdown" },
      });
      expect(exposures[0]!.occurred_at > "2026-09-09T12:00:00.000Z").toBe(true);

      const assessed = kernel.recordAssessment(a2.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [{
          objectiveId: OBJECTIVE_ID,
          result: "correct",
          criteriaMet: ["mechanism"],
          criteriaUnmet: [],
          rationale: "Correct delayed retrieval.",
        }],
      });
      const event = assessed.evidenceEvents[0]!;
      expect(event.retrieval_valid).toBe(true);
      expect(event.delay_seconds).toBe(8 * 86400);
      expect(assessed.projections[0]).toMatchObject({
        readiness: "independent",
        durability_state: "demonstrated",
      });
      expect(getReviewEventsByObjective(db, OBJECTIVE_ID)).toHaveLength(2);
      expect(getObjectiveReviewCard(db, OBJECTIVE_ID)).toBeDefined();
    } finally {
      db.close();
    }
  });

  it("preserves retrieval_valid and delay_seconds when reviseEvidence corrects an attempt after feedback exposure", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    const { db } = createKernelFixture();
    const kernel = createTeacherKernel(db);
    try {
      const s1 = kernel.createSession(GOAL_ID, "practice");
      const a1 = kernel.openAttempt("challenge", 1, s1.id).attempt;
      kernel.submitAndAssess(a1.id, {
        closeIfComplete: true,
        response: { responseText: "Day 1 answer." },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{
            objectiveId: OBJECTIVE_ID,
            result: "correct",
            criteriaMet: ["mechanism"],
            criteriaUnmet: [],
            rationale: "Correct.",
          }],
        },
      });

      vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));
      const template = kernel.getChallenge("challenge", 1)!;
      kernel.registerChallenge({ ...template, id: "challenge-2" });
      const s2 = kernel.createSession(GOAL_ID, "practice");
      const a2 = kernel.openAttempt("challenge-2", 1, s2.id).attempt;
      const misgraded = kernel.submitAndAssess(a2.id, {
        response: { responseText: "Actually valid mechanism." },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{
            objectiveId: OBJECTIVE_ID,
            result: "incorrect",
            criteriaMet: [],
            criteriaUnmet: ["mechanism"],
            rationale: "Initial misgrade.",
          }],
        },
      });
      kernel.recordExposure(s2.id, {
        attemptId: a2.id,
        objectiveIds: [OBJECTIVE_ID],
        exposureType: "corrective_feedback_shown",
        teachingMaterial: { content: "Feedback shown after submission.", format: "markdown" },
      });

      const revised = kernel.reviseEvidence(misgraded.evidenceEvents[0]!.id, {
        action: "invalidate",
        reason: "Grading rubric misread valid answer.",
        correctedObjectiveResult: {
          objectiveId: OBJECTIVE_ID,
          result: "correct",
          criteriaMet: ["mechanism"],
          criteriaUnmet: [],
          misconceptionsObserved: [],
          misconceptionsCleared: [],
          observedErrors: [],
          rationale: "Corrected grade.",
        },
      });
      expect(revised.replacementEvent?.retrieval_valid).toBe(true);
      expect(revised.replacementEvent?.delay_seconds).toBe(9 * 86400);
      expect(revised.projection.durability_state).toBe("demonstrated");
    } finally {
      db.close();
    }
  });

  it("still invalidates retrieval_valid when exposure is recorded before submission in the same millisecond", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    const { db } = createKernelFixture();
    const kernel = createTeacherKernel(db);
    try {
      const s1 = kernel.createSession(GOAL_ID, "practice");
      const a1 = kernel.openAttempt("challenge", 1, s1.id).attempt;
      kernel.recordExposure(s1.id, {
        attemptId: a1.id,
        objectiveIds: [OBJECTIVE_ID],
        exposureType: "explanation_shown",
        teachingMaterial: { content: "Pre-submission explanation.", format: "markdown" },
      });
      const assessed = kernel.submitAndAssess(a1.id, {
        response: { responseText: "Guided answer." },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{
            objectiveId: OBJECTIVE_ID,
            result: "correct",
            criteriaMet: ["mechanism"],
            criteriaUnmet: [],
            rationale: "Assisted answer.",
          }],
        },
      });
      expect(assessed.evidenceEvents[0]!.retrieval_valid).toBe(false);
    } finally {
      db.close();
    }
  });
});
