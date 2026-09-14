import type Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { setGoalObjective } from "../src/db/database.js";
import { createLearningObjective } from "../src/kernel/foundation.js";
import { getStudyContinuation } from "../src/study/continuation.js";
import {
  createKernelFixture,
  CONCEPT_ID,
  GOAL_ID,
  OBJECTIVE_ID,
} from "./helpers/kernel-fixture.js";

function countAttempts(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS count FROM attempts").get() as { count: number }).count;
}

describe("study continuation", () => {
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
});
