import { afterEach, describe, expect, it, vi } from "vitest";
import { createTeacherKernel } from "../src/teacher.js";
import type { ChallengeIntent } from "../src/selection/types.js";
import { getObjectiveReviewCard } from "../src/scheduler/index.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("repair followed by selected transfer and scheduled retention", () => {
  afterEach(() => vi.useRealTimers());

  it("changes the repair follow-up surface, tests transfer, then uses the FSRS due card for delayed retrieval", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
    const { db } = createKernelFixture();
    const kernel = createTeacherKernel(db);
    try {
      kernel.setGoalObjective({ goalId: GOAL_ID, objectiveId: OBJECTIVE_ID,
        targetReadiness: "independent", requireTransfer: true, requireDurability: true });
      const template = kernel.getChallenge("challenge", 1)!;
      function next() {
        const result = kernel.getStudyContinuation({ goalId: GOAL_ID, now: new Date().toISOString(), oneEpisode: true,
          practicalWork: "conversation_only" });
        expect(result.kind).toBe("recommend");
        if (result.kind !== "recommend") throw new Error(`Expected selected work, got ${result.kind}`);
        return result.item.intent;
      }
      function open(intent: ChallengeIntent, id: string, prompt: string) {
        kernel.registerChallenge({ ...template, id, publicPrompt: prompt, taskForm: intent.taskForm,
          deliveryContext: intent.deliveryContext,
          targets: [{ objectiveId: OBJECTIVE_ID, novelty: intent.novelty, criterionIds: ["mechanism"] }],
        }, intent);
        const session = kernel.createSession(intent.goalId, intent.deliveryContext, "conversation_only");
        return { sessionId: session.id, attemptId: kernel.openAttempt(id, 1, session.id).attempt.id };
      }
      function answer(attemptId: number, responseText: string, correct: boolean) {
        kernel.submitAttempt(attemptId, { responseText });
        return kernel.recordAssessment(attemptId, {
          evaluatorType: "agent", assessmentBasis: "frozen_rubric",
          objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: correct ? "correct" : "incorrect",
            criteriaMet: correct ? ["mechanism"] : [], criteriaUnmet: correct ? [] : ["mechanism"],
            observedErrors: correct ? [] : ["whole_async_call_deferred"],
            rationale: correct ? "Explains the causal ordering in this situation." : "Defers the synchronous prefix too." }],
        }).evidenceEvents[0]!;
      }

      const original = open(next(), "async-prefix", "Explain what an async call runs before its first await.");
      answer(original.attemptId, "The entire async function is deferred.", false);
      kernel.recordExposure(original.sessionId, {
        attemptId: original.attemptId, objectiveIds: [OBJECTIVE_ID], exposureType: "answer_revealed",
        teachingMaterial: { content: "The call runs its prefix synchronously; only the continuation after await is suspended." },
        requireReconstruction: true,
      });
      const cardAfterRepair = getObjectiveReviewCard(db, OBJECTIVE_ID);
      kernel.resolveSessionReconstruction(original.sessionId, { outcome: "completed",
        responseText: "The prefix runs immediately; await suspends the rest." });
      expect(getObjectiveReviewCard(db, OBJECTIVE_ID)).toEqual(cardAfterRepair);

      vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
      const followupIntent = next();
      expect(followupIntent).toMatchObject({ novelty: "variant", requiresChangedSurface: true });
      expect(followupIntent.avoidRecentChallenges).toEqual(expect.arrayContaining([
        expect.objectContaining({ challengeId: "async-prefix" }),
      ]));
      const followup = open(followupIntent, "await-in-callback",
        "An event callback starts an async function then updates a flag. Explain which side effects can observe the old flag before its first await.");
      answer(followup.attemptId, "Prefix side effects run before the flag update; the continuation resumes after the callback finishes.", true);
      kernel.completeSessionFeedback(followup.sessionId);

      vi.setSystemTime(new Date("2026-09-16T13:00:00Z"));
      // Independence requires two successful distinct frozen tasks, not one repaired answer.
      const confirmationIntent = next();
      expect(confirmationIntent.reasonKind).toBe("due_retrieval");
      const confirmation = open(confirmationIntent, "nested-async-call",
        "An async function calls another async function before reaching its own await. Explain which prefixes finish before control returns to the caller.");
      answer(confirmation.attemptId,
        "The inner prefix runs to its await and returns a promise; the outer prefix then continues to its own await before returning.", true);
      kernel.completeSessionFeedback(confirmation.sessionId);

      vi.setSystemTime(new Date("2026-09-16T14:00:00Z"));
      const transferIntent = next();
      expect(transferIntent).toMatchObject({ reasonKind: "transfer_needed", novelty: "transfer", requiresChangedSurface: true });
      const transfer = open(transferIntent, "stale-search",
        "Two search requests are awaited independently. The older request resolves last. Explain why await alone does not prevent stale results, and the relationship a latest-request guard must enforce.");
      const transferEvidence = answer(transfer.attemptId,
        "Each request suspends its own continuation. Completion order can differ from request order; publish only if this is still the latest requested search.", true);
      expect(transferEvidence).toMatchObject({ novelty: "transfer", retrieval_valid: true });
      kernel.completeSessionFeedback(transfer.sessionId);
      expect(kernel.getObjectiveEvidenceReceipt(OBJECTIVE_ID).projection).toMatchObject({
        transfer_state: "demonstrated", durability_state: "untested",
      });

      const card = getObjectiveReviewCard(db, OBJECTIVE_ID)!;
      const beforeDue = new Date(new Date(card.due_at).getTime() - 1);
      expect(kernel.getStudyContinuation({ goalId: GOAL_ID, now: beforeDue.toISOString(), oneEpisode: true }).kind)
        .toBe("no_action");
      // The learner returns at least eight days later, possibly overdue. Never rewrite a due date.
      vi.setSystemTime(new Date(Math.max(new Date(card.due_at).getTime(), Date.now() + 8 * 86400000)));
      const reviewIntent = next();
      expect(reviewIntent).toMatchObject({ reasonKind: "due_retrieval", deliveryContext: "review", dueAt: card.due_at });
      const review = open(reviewIntent, "late-validation",
        "Two independent async form validations finish out of order. Explain what must hold before a completion updates the current form error.");
      const retained = answer(review.attemptId, "A completion may update the form only if its input version is still current; await orders its own continuation, not other validations.", true);
      expect(retained.delay_seconds).toBeGreaterThanOrEqual(8 * 86400);
      expect(kernel.getObjectiveEvidenceReceipt(OBJECTIVE_ID).projection.durability_state).toBe("demonstrated");
      kernel.completeSessionFeedback(review.sessionId);
    } finally {
      db.close();
    }
  });
});
