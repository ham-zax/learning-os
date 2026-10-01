import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase, createProblem } from "../src/db/database.js";
import { getAttempt } from "../src/kernel/foundation.js";
import { getAttemptSubquestions, getSessionQuestionPresentation } from "../src/kernel/questions.js";
import { assessDesignDrill, getPhasePrompt, resumeDesignDrill, startDesignDrill, submitPhase } from "../src/interview/system-design.js";
import { CONCEPT_ID, createKernelFixture } from "./helpers/kernel-fixture.js";

function addProblem(db: ReturnType<typeof createDatabase>) {
  createProblem(db, {
    id: "design-problem", type: "system-design", title: "Design a Queue", description: "Deliver queued work reliably.",
    conceptId: CONCEPT_ID, difficulty: 3,
    rubric: JSON.stringify({ requirements: ["Delivery requirements"], highLevel: ["Queue and workers"], deepDive: ["component: queue storage"], tradeOffs: ["Delivery trade-offs"] }),
  });
}

describe("durable system design phases", () => {
  it("requires durable completion before assessment, even if caller state says complete", async () => {
    const { db } = createKernelFixture();
    try {
      addProblem(db);
      const state = startDesignDrill(db, { problemId: "design-problem" });
      await expect(assessDesignDrill(null, db, { ...state, currentPhase: "complete" })).rejects.toThrow('"requirements" phase');
      expect(getAttempt(db, state.attemptId)?.submitted_at).toBeNull();
    } finally { db.close(); }
  });

  it("resumes each saved phase from frozen state after a fresh database open", () => {
    const root = mkdtempSync(join(tmpdir(), "learning-os-design-"));
    const path = join(root, "tutor.db");
    let db: ReturnType<typeof createDatabase> | undefined;
    try {
      db = createKernelFixture(path).db;
      addProblem(db);
      let state = startDesignDrill(db, { problemId: "design-problem" });
      const attemptId = state.attemptId;
      const sessionId = state.sessionId;
      const answers = ["Require at-least-once delivery.", "Queue plus worker pool.", "Persist a log and acknowledge completion.", "Deduplicate retries at consumers."];
      const nextPhases = ["highLevel", "deepDive", "tradeOffs", "complete"];
      for (let index = 0; index < answers.length; index++) {
        const prior = state;
        state = submitPhase(db, state, answers[index]);
        expect(state.currentPhase).toBe(nextPhases[index]);
        expect(() => submitPhase(db!, prior, "stale duplicate")).toThrow();
        db.prepare("UPDATE problems SET title = 'Changed', description = 'Changed', rubric = '{}' WHERE id = 'design-problem'").run();
        db.close();
        db = createDatabase(path);
        state = resumeDesignDrill(db, attemptId);
        expect(state.problem.title).toBe("Design a Queue");
        expect(state.problem.rubric.deepDive).toEqual(["component: queue storage"]);
        expect(state.currentPhase).toBe(nextPhases[index]);
        expect(getAttemptSubquestions(db, attemptId).filter((q) => q.response_text !== null)).toHaveLength(index + 1);
        if (state.currentPhase !== "complete") {
          expect(getAttempt(db, attemptId)?.submitted_at).toBeNull();
          expect(getSessionQuestionPresentation(db, sessionId)).toMatchObject({ kind: "question", promptText: expect.stringContaining(getPhasePrompt(state).prompt) });
        }
      }
      expect(getAttempt(db, attemptId)?.response_text).toContain(answers[0]);
      expect(getAttempt(db, attemptId)?.response_text).toContain(answers[3]);
      expect(getAttempt(db, attemptId)?.submitted_at).not.toBeNull();
      expect(db.prepare("SELECT COUNT(*) AS count FROM evidence_events").get()).toEqual({ count: 0 });
      expect(db.prepare("SELECT COUNT(*) AS count FROM review_cards").get()).toEqual({ count: 0 });
    } finally { db?.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it("rolls back empty phase answers without advancing durable state", () => {
    const { db } = createKernelFixture();
    try {
      addProblem(db);
      const state = startDesignDrill(db, { problemId: "design-problem" });
      expect(() => submitPhase(db, state, "  ")).toThrow();
      expect(resumeDesignDrill(db, state.attemptId).currentPhase).toBe("requirements");
      expect(getAttemptSubquestions(db, state.attemptId)).toHaveLength(1);
      expect(getAttemptSubquestions(db, state.attemptId)[0].response_text).toBeNull();
    } finally { db.close(); }
  });
});
