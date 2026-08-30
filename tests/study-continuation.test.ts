import type Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { setGoalObjective } from "../src/db/database.js";
import { getStudyContinuation } from "../src/study/continuation.js";
import {
  createKernelFixture,
  GOAL_ID,
  OBJECTIVE_ID,
} from "./helpers/kernel-fixture.js";

function countAttempts(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS count FROM attempts").get() as { count: number }).count;
}

describe("study continuation", () => {
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
