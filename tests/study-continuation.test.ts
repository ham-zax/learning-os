import type Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession, createTopic, setGoalObjective } from "../src/db/database.js";
import { recordAssessment } from "../src/kernel/evidence.js";
import {
  completeSessionFeedback,
  createLearningObjective,
  getChallenge,
  openAttempt,
  registerChallenge,
  submitAttempt,
} from "../src/kernel/foundation.js";
import { getObjectiveReviewCard, rebuildObjectiveReviewCard } from "../src/scheduler/index.js";
import { getStudyContinuation } from "../src/study/continuation.js";
import {
  CHALLENGE_ID,
  createKernelFixture,
  CONCEPT_ID,
  GOAL_ID,
  OBJECTIVE_ID,
} from "./helpers/kernel-fixture.js";

function countAttempts(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS count FROM attempts").get() as { count: number }).count;
}

describe("study continuation", () => {
  afterEach(() => vi.useRealTimers());
  it("selects a long task in episode mode while retaining actual minute limits", () => {
    const fixture = createKernelFixture();
    try {
      setGoalObjective(fixture.db, { goalId: GOAL_ID, objectiveId: OBJECTIVE_ID, isActive: false });
      const implementationId = `${CONCEPT_ID}:implement`;
      createLearningObjective(fixture.db, {
        id: implementationId, conceptId: CONCEPT_ID, capabilityId: "implement",
      });
      setGoalObjective(fixture.db, { goalId: GOAL_ID, objectiveId: implementationId, importance: "core" });
      const input = { goalId: GOAL_ID, now: "2026-09-14T00:00:00.000Z" };

      expect(getStudyContinuation(fixture.db, { ...input, availableMinutes: 5 }).kind).toBe("no_action");
      expect(getStudyContinuation(fixture.db, { ...input, oneEpisode: true })).toMatchObject({
        kind: "recommend",
        item: { objectiveId: implementationId },
        mission: {
          workLimit: "one_episode", availableMinutes: null, plannedMinutes: null, unallocatedMinutes: null,
        },
      });
      expect(countAttempts(fixture.db)).toBe(0);
    } finally {
      fixture.db.close();
    }
  });

  it("resumes in episode mode and rejects conflicting bounds even with unfinished work", () => {
    const fixture = createKernelFixture();
    try {
      const { sessionId } = fixture.openPracticeAttempt();
      const input = { goalId: GOAL_ID, now: "2026-09-14T00:00:00.000Z", oneEpisode: true };
      expect(getStudyContinuation(fixture.db, input)).toMatchObject({
        kind: "resume", session: { session: { id: sessionId } },
      });
      expect(() => getStudyContinuation(fixture.db, { ...input, availableMinutes: 30 }))
        .toThrow("Choose oneEpisode or availableMinutes");
      expect(countAttempts(fixture.db)).toBe(1);
    } finally {
      fixture.db.close();
    }
  });

  it("resumes unfinished work before asking for a budget", () => {
    const fixture = createKernelFixture();
    try {
      const { sessionId } = fixture.openPracticeAttempt();

      expect(
        getStudyContinuation(fixture.db, {
          goalId: GOAL_ID,
          now: "2026-08-30T02:00:00.000Z",
        }),
      ).toMatchObject({
        kind: "resume",
        session: {
          session: { id: sessionId },
          pendingAction: "collect_response",
        },
        additionalResumableSessionIds: [],
      });
    } finally {
      fixture.db.close();
    }
  });

  it("reports older resumable sessions without displacing the newest", () => {
    const fixture = createKernelFixture();
    try {
      const older = fixture.openPracticeAttempt();
      const newer = fixture.openPracticeAttempt();

      expect(
        getStudyContinuation(fixture.db, {
          goalId: GOAL_ID,
          now: "2026-08-30T02:00:00.000Z",
        }),
      ).toMatchObject({
        kind: "resume",
        session: { session: { id: newer.sessionId } },
        additionalResumableSessionIds: [older.sessionId],
      });
    } finally {
      fixture.db.close();
    }
  });

  it("asks for remaining active-study time when no work is resumable", () => {
    const fixture = createKernelFixture();
    try {
      expect(
        getStudyContinuation(fixture.db, {
          goalId: GOAL_ID,
          now: "2026-08-30T02:00:00.000Z",
        }),
      ).toEqual({
        kind: "needs_budget",
        goalId: GOAL_ID,
        suggestedMinutes: 30,
        practicalWork: { preference: "ask_first", source: "default" },
      });
    } finally {
      fixture.db.close();
    }
  });

  it("returns one recommendation without opening an attempt", () => {
    const fixture = createKernelFixture();
    try {
      expect(countAttempts(fixture.db)).toBe(0);
      const result = getStudyContinuation(fixture.db, {
        goalId: GOAL_ID,
        now: "2026-08-30T02:00:00.000Z",
        availableMinutes: 20,
      });

      expect(result.kind).toBe("recommend");
      if (result.kind === "recommend") {
        expect(result.mission.items).toHaveLength(1);
        expect(result.item).toBe(result.mission.items[0]);
      }
      expect(countAttempts(fixture.db)).toBe(0);
    } finally {
      fixture.db.close();
    }
  });

  it("returns no action when the goal has no active objective", () => {
    const fixture = createKernelFixture();
    try {
      setGoalObjective(fixture.db, {
        goalId: GOAL_ID,
        objectiveId: OBJECTIVE_ID,
        isActive: false,
      });

      const result = getStudyContinuation(fixture.db, {
        goalId: GOAL_ID,
        now: "2026-08-30T02:00:00.000Z",
        availableMinutes: 20,
      });
      expect(result.kind).toBe("no_action");
      if (result.kind === "no_action") {
        expect(result.mission.items).toEqual([]);
      }
    } finally {
      fixture.db.close();
    }
  });

  it("rejects an unknown goal", () => {
    const fixture = createKernelFixture();
    try {
      expect(() =>
        getStudyContinuation(fixture.db, {
          goalId: "missing",
          now: "2026-08-30T02:00:00.000Z",
        }),
      ).toThrow("Goal topic not found: missing");
    } finally {
      fixture.db.close();
    }
  });

  it("defaults goalId and now when omitted on a single-goal profile", () => {
    const fixture = createKernelFixture();
    try {
      expect(getStudyContinuation(fixture.db)).toEqual({
        kind: "needs_budget",
        goalId: GOAL_ID,
        suggestedMinutes: 30,
        practicalWork: { preference: "ask_first", source: "default" },
      });

      const recommendation = getStudyContinuation(fixture.db, { oneEpisode: true });
      expect(recommendation.kind).toBe("recommend");
    } finally {
      fixture.db.close();
    }
  });

  it("rejects omitted goalId with available IDs when multiple goals exist", () => {
    const fixture = createKernelFixture();
    try {
      createTopic(fixture.db, { id: "goal-two", name: "Second Goal" });
      const now = "2026-09-01T00:00:00.000Z";
      fixture.db.prepare(
        `INSERT INTO goal_preparation (goal_id, purpose, confirmed_at, created_at, updated_at)
         VALUES (?, 'interview', ?, ?, ?)`,
      ).run("goal-two", now, now, now);

      expect(() => getStudyContinuation(fixture.db)).toThrow(/Multiple goals found.*goal-two/);
    } finally {
      fixture.db.close();
    }
  });

  it("auto-promotes a once-resolved weakness to retest after 7 days once due, then graduates it after confirmation", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00.000Z"));
    const fixture = createKernelFixture();
    try {
      const db = fixture.db;
      const baseChallenge = getChallenge(db, CHALLENGE_ID, 1)!;
      registerChallenge(db, { ...baseChallenge, id: "challenge-v2", publicPrompt: "Explain the mechanism in a variant case." });
      registerChallenge(db, { ...baseChallenge, id: "challenge-v3", publicPrompt: "Explain the mechanism on a third surface." });

      const first = fixture.openPracticeAttempt();
      vi.setSystemTime(new Date("2026-09-01T10:05:00.000Z"));
      submitAttempt(db, first.attemptId, { responseText: "Wrong model." });
      recordAssessment(db, first.attemptId, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [{
          objectiveId: OBJECTIVE_ID,
          result: "incorrect",
          criteriaMet: [],
          criteriaUnmet: ["mechanism"],
          observedErrors: ["stale_read_assumption"],
          rationale: "Missed interleaving.",
        }],
      });
      completeSessionFeedback(db, first.sessionId);

      // Resolve once on a second distinct challenge
      vi.setSystemTime(new Date("2026-09-02T10:00:00.000Z"));
      const s2 = createSession(db, { topicId: GOAL_ID, mode: "practice" });
      const a2 = openAttempt(db, "challenge-v2", 1, s2.id).attempt;
      vi.setSystemTime(new Date("2026-09-02T10:05:00.000Z"));
      submitAttempt(db, a2.id, { responseText: "Corrected model." });
      recordAssessment(db, a2.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [{
          objectiveId: OBJECTIVE_ID,
          result: "correct",
          criteriaMet: ["mechanism"],
          criteriaUnmet: [],
          rationale: "Explained interleaving once.",
        }],
      });
      completeSessionFeedback(db, s2.id);

      // Verify FSRS fuzzing remains deterministically replayable
      const cardBefore = getObjectiveReviewCard(db, OBJECTIVE_ID)!;
      const cardRebuilt = rebuildObjectiveReviewCard(db, OBJECTIVE_ID)!;
      expect(cardRebuilt.due_at).toBe(cardBefore.due_at);
      expect(cardRebuilt.card_json).toEqual(cardBefore.card_json);

      // After >= 7 days and once FSRS due date has arrived, auto-retest fires
      const afterDelay = new Date(
        Math.max(Date.parse(cardBefore.due_at), Date.parse("2026-09-12T10:05:00.000Z")),
      ).toISOString();
      const autoRetest = getStudyContinuation(db, {
        goalId: GOAL_ID,
        now: afterDelay,
        oneEpisode: true,
      });
      expect(autoRetest).toMatchObject({
        kind: "recommend",
        item: {
          intent: {
            reasonKind: "resolved_weakness_retest",
            novelty: "variant",
            weakness: { isRetest: true, lifecycle: "resolved" },
          },
        },
      });

      // Explicit empty retest list opts out of auto-retest
      const optedOut = getStudyContinuation(db, {
        goalId: GOAL_ID,
        now: afterDelay,
        oneEpisode: true,
        retestEligibleWeaknessKeys: [],
      });
      expect(optedOut).toMatchObject({
        kind: "recommend",
        item: {
          intent: {
            reasonKind: expect.not.stringMatching("resolved_weakness_retest"),
          },
        },
      });

      // Passing a second distinct post-error challenge graduates the weakness out of auto-retest
      vi.setSystemTime(new Date("2026-09-12T11:00:00.000Z"));
      const s3 = createSession(db, { topicId: GOAL_ID, mode: "practice" });
      const a3 = openAttempt(db, "challenge-v3", 1, s3.id).attempt;
      vi.setSystemTime(new Date("2026-09-12T11:05:00.000Z"));
      submitAttempt(db, a3.id, { responseText: "Confirmed on new surface." });
      recordAssessment(db, a3.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [{
          objectiveId: OBJECTIVE_ID,
          result: "correct",
          criteriaMet: ["mechanism"],
          criteriaUnmet: [],
          rationale: "Confirmed across second surface.",
        }],
      });
      completeSessionFeedback(db, s3.id);

      const cardAfterConfirm = getObjectiveReviewCard(db, OBJECTIVE_ID)!;
      const laterReviewAt = new Date(
        Math.max(Date.parse(cardAfterConfirm.due_at), Date.parse("2026-09-30T11:05:00.000Z")),
      ).toISOString();
      const postGraduation = getStudyContinuation(db, {
        goalId: GOAL_ID,
        now: laterReviewAt,
        oneEpisode: true,
      });
      expect(postGraduation).toMatchObject({
        kind: "recommend",
        item: {
          intent: {
            reasonKind: "due_retrieval",
            deliveryContext: "review",
          },
        },
      });
    } finally {
      fixture.db.close();
    }
  });
});
