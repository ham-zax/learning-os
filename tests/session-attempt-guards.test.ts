import { describe, expect, it } from "vitest";
import { createSession, getSession } from "../src/db/database.js";
import { abandonUnsubmittedSession, getAttempt, openAttempt, resumeSession, submitAttempt } from "../src/kernel/foundation.js";
import { CHALLENGE_ID, createKernelFixture, GOAL_ID } from "./helpers/kernel-fixture.js";

describe("session and attempt mutation guards", () => {
  it("rejects malformed session input before creating a row", () => {
    const { db } = createKernelFixture();
    try {
      for (const input of [
        { topicId: GOAL_ID, mode: "bogus" },
        { topicId: 42, mode: "practice" },
        { topicId: GOAL_ID, mode: "practice", practicalWork: null },
      ]) {
        expect(() => createSession(db, input as never)).toThrow();
        expect(db.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 });
      }
    } finally { db.close(); }
  });

  it("preserves the pending attempt while allowing multiple submitted assessments", () => {
    const fixture = createKernelFixture();
    try {
      const { sessionId, attemptId } = fixture.openPracticeAttempt();
      expect(() => openAttempt(fixture.db, CHALLENGE_ID, 1, sessionId)).toThrow("unsubmitted attempt");
      expect(getSession(fixture.db, sessionId)?.active_attempt_id).toBe(attemptId);
      submitAttempt(fixture.db, attemptId, { responseText: "First response" });
      const second = openAttempt(fixture.db, CHALLENGE_ID, 1, sessionId);
      fixture.db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(new Date().toISOString(), sessionId);
      submitAttempt(fixture.db, second.attempt.id, { responseText: "Second response" });
      expect(resumeSession(fixture.db, sessionId).unresolvedAssessmentAttempts).toHaveLength(2);
    } finally { fixture.db.close(); }
  });

  it("cannot revive an abandoned attempt or completed session", () => {
    const fixture = createKernelFixture();
    try {
      const { sessionId, attemptId } = fixture.openPracticeAttempt();
      abandonUnsubmittedSession(fixture.db, sessionId);
      expect(() => submitAttempt(fixture.db, attemptId, { responseText: "Late response" })).toThrow();
      expect(() => openAttempt(fixture.db, CHALLENGE_ID, 1, sessionId)).toThrow("complete");
      expect(getAttempt(fixture.db, attemptId)?.submitted_at).toBeNull();
      expect(getSession(fixture.db, sessionId)?.phase).toBe("complete");
    } finally { fixture.db.close(); }
  });

  it("rejects detached or mismatched response targets without writing a response", () => {
    const fixture = createKernelFixture();
    try {
      const { sessionId, attemptId } = fixture.openPracticeAttempt();
      fixture.db.prepare("UPDATE sessions SET active_attempt_id = NULL WHERE id = ?").run(sessionId);
      expect(() => submitAttempt(fixture.db, attemptId, { responseText: "Detached" })).toThrow("active response target");
      expect(getAttempt(fixture.db, attemptId)?.response_text).toBeNull();
      fixture.db.prepare("UPDATE sessions SET active_attempt_id = ?, active_challenge_version = 2 WHERE id = ?").run(attemptId, sessionId);
      expect(() => submitAttempt(fixture.db, attemptId, { responseText: "Wrong version" })).toThrow("active response target");
      expect(getAttempt(fixture.db, attemptId)?.submitted_at).toBeNull();
    } finally { fixture.db.close(); }
  });
});
