import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createSession } from "../src/db/database.js";
import { submitAndAssess } from "../src/kernel/composite.js";
import { createTeacherKernel } from "../src/teacher.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("submitAndAssess", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  function open() {
    const fixture = createKernelFixture();
    db = fixture.db;
    return fixture.openPracticeAttempt();
  }

  const response = { responseText: "It yields until the awaited task settles." };
  const assessment = {
    evaluatorType: "agent" as const,
    assessmentBasis: "frozen_rubric" as const,
    objectiveResults: [{
      objectiveId: OBJECTIVE_ID,
      result: "correct" as const,
      criteriaMet: ["mechanism"],
      criteriaUnmet: [],
      rationale: "Names the yield point and the resume.",
    }],
  };

  it("submits and assesses in one transaction", () => {
    const { sessionId, attemptId } = open();
    const result = submitAndAssess(db!, attemptId, { response, assessment });
    expect(result.evidenceEvents).toHaveLength(1);
    expect(db!.prepare("SELECT submitted_at, response_text FROM attempts WHERE id = ?").get(attemptId))
      .toMatchObject({ submitted_at: expect.any(String), response_text: response.responseText });
    expect(db!.prepare("SELECT phase FROM sessions WHERE id = ?").get(sessionId))
      .toEqual({ phase: "feedback" });
  });

  it("rolls the submission back when the assessment is rejected", () => {
    const { attemptId } = open();
    expect(() => submitAndAssess(db!, attemptId, {
      response,
      assessment: {
        ...assessment,
        objectiveResults: [{
          ...assessment.objectiveResults[0]!,
          objectiveId: "unknown:objective",
        }],
      },
    })).toThrow();
    expect(db!.prepare("SELECT submitted_at, response_text FROM attempts WHERE id = ?").get(attemptId))
      .toEqual({ submitted_at: null, response_text: null });
    expect(db!.prepare("SELECT COUNT(*) AS n FROM evidence_events").get()).toEqual({ n: 0 });
  });

  it("rejects a second call for the same attempt", () => {
    const { attemptId } = open();
    submitAndAssess(db!, attemptId, { response, assessment });
    expect(() => submitAndAssess(db!, attemptId, { response, assessment }))
      .toThrow(/already submitted/);
  });

  it("rejects a deterministic assessment without a readable output field", () => {
    const fixture = createKernelFixture();
    db = fixture.db;
    const kernel = createTeacherKernel(db);
    const template = kernel.getChallenge("challenge", 1)!;
    kernel.registerChallenge({
      ...template,
      id: "verify-challenge",
      taskForm: "debugging",
      verification: { required: true, basis: "deterministic_execution" },
    });
    const session = createSession(db, { topicId: GOAL_ID, mode: "practice" });
    const { attempt } = kernel.openAttempt("verify-challenge", 1, session.id);
    expect(() => kernel.submitAndAssess(attempt.id, {
      response: { responseText: "It prints A." },
      assessment: {
        evaluatorType: "agent",
        assessmentBasis: "deterministic_execution",
        verificationOutput: {
          outcome: "passed",
          basis: "node",
          summary: "Ran the frozen model.",
          details: { printedLines: ["A"] },
        },
        objectiveResults: [{
          objectiveId: OBJECTIVE_ID,
          result: "correct",
          criteriaMet: ["mechanism"],
          criteriaUnmet: [],
          rationale: "The prediction matches the run.",
        }],
      },
    })).toThrow(/details\.stdout/);
    expect(db.prepare("SELECT submitted_at FROM attempts WHERE id = ?").get(attempt.id))
      .toEqual({ submitted_at: null });
  });
});
