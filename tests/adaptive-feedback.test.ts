import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database.js";
import { createTeacherKernel } from "../src/teacher.js";
import { createKernelFixture, CONCEPT_ID, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("adaptive feedback through the teacher boundary", () => {
  let root: string;
  let db: ReturnType<typeof createDatabase>;
  let kernel: ReturnType<typeof createTeacherKernel>;
  let sessionId: number;
  let attemptId: number;
  const contextText = '```js\nasync function task() { console.log("A"); await 0; console.log("B"); }\ntask();\nconsole.log("end");\n```';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-feedback-"));
    const fixture = createKernelFixture(join(root, "tutor.db"));
    db = fixture.db;
    ({ sessionId, attemptId } = fixture.openPracticeAttempt());
    kernel = createTeacherKernel(db);
  });
  afterEach(() => {
    if (db.open) db.close();
    rmSync(root, { recursive: true, force: true });
  });

  function assess(result: "correct" | "incorrect" | "ungradable") {
    return kernel.recordAssessment(attemptId, {
      evaluatorType: "agent", assessmentBasis: "frozen_rubric",
      objectiveResults: [{
        objectiveId: OBJECTIVE_ID, result,
        criteriaMet: result === "correct" ? ["mechanism"] : [],
        criteriaUnmet: result === "incorrect" ? ["mechanism"] : [],
        rationale: result === "correct" ? "Distinguishes the synchronous prefix from the suspended continuation."
          : result === "incorrect" ? "Treats the whole async call as deferred."
            : "The recording does not contain an assessable response.",
      }],
    }).evidenceEvents[0]!;
  }

  function reopen() {
    db.close();
    db = createDatabase(join(root, "tutor.db"));
    kernel = createTeacherKernel(db);
    return kernel.getStudyContinuation({ goalId: GOAL_ID, now: new Date().toISOString() });
  }

  it("closes a sufficient answer without another question or a whole-concept mastery claim", () => {
    kernel.submitAttempt(attemptId, { responseText: "A runs synchronously; await suspends the rest, so end precedes B." });
    const evidence = assess("correct");
    const cards = db.prepare("SELECT * FROM review_cards").all();
    expect(reopen()).toMatchObject({ kind: "resume", feedback: {
      nextAction: "complete_feedback", attemptId,
      objectives: [{ evidenceEventId: evidence.id, result: "correct", retrievalValid: true,
        criteria: [{ id: "mechanism", status: "met", description: "Explains the mechanism" }] }],
    } });
    kernel.completeSessionFeedback(sessionId);
    expect(kernel.resumeSession(sessionId).phase).toBe("complete");
    expect(kernel.getSessionFeedback(sessionId).nextAction).toBe("none");
    expect(db.prepare("SELECT * FROM attempt_subquestions").all()).toEqual([]);
    expect(db.prepare("SELECT * FROM review_cards").all()).toEqual(cards);
  });

  it("keeps an ambiguous answer ungraded through a neutral clarification and fresh connection", () => {
    const question = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: "When does task's body run?", questionChunking: "atomic",
      scopeCriterionId: "mechanism", scopeNote: "Distinguish the prefix from the continuation.",
    });
    kernel.answerAttemptSubquestion(attemptId, { seq: question.seq, responseText: "Later." });
    const clarification = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: 'Which part of task do you mean by "later"?', questionChunking: "atomic",
      scopeCriterionId: "mechanism", scopeNote: "Resolve which code the learner's statement refers to, without supplying the mechanism.",
    });
    expect(reopen()).toMatchObject({ kind: "resume",
      presentation: { kind: "question", seq: clarification.seq, promptText: 'Which part of task do you mean by "later"?' },
      feedback: { nextAction: "collect_response", objectives: [] },
    });
    expect(db.prepare("SELECT * FROM evidence_events").all()).toEqual([]);
    expect(db.prepare("SELECT * FROM exposure_events").all()).toEqual([]);
    expect(db.prepare("SELECT * FROM hint_observations").all()).toEqual([]);
    const response = "I mean B. A runs at the call; await queues the continuation after end.";
    kernel.answerAttemptSubquestion(attemptId, { seq: clarification.seq, responseText: response });
    kernel.submitAttempt(attemptId, { responseText: `Later.\nClarification: ${response}` });
    assess("correct");
    expect(kernel.getSessionFeedback(sessionId)).toMatchObject({ nextAction: "complete_feedback",
      objectives: [{ retrievalValid: true, hintLevel: 0 }] });
  });

  it("requires recorded reconstruction for a demonstrated model error without adding retrieval evidence", () => {
    kernel.submitAttempt(attemptId, { responseText: "All of task runs later because it is async." });
    assess("incorrect");
    expect(kernel.getSessionFeedback(sessionId)).toMatchObject({ nextAction: "review_gap",
      objectives: [{ criteria: [{ id: "mechanism", status: "unmet" }], rationale: "Treats the whole async call as deferred." }] });
    kernel.recordExposure(sessionId, {
      attemptId, objectiveIds: [OBJECTIVE_ID], exposureType: "answer_revealed",
      teachingMaterial: { content: "Calling task runs A synchronously; await suspends the continuation that prints B." },
      requireReconstruction: true,
    });
    const question = kernel.openAttemptSubquestion(attemptId, {
      contextText, promptText: 'Does "A" appear before or after "end", and what causes that ordering?',
      questionChunking: "atomic", scopeCriterionId: "mechanism",
      scopeNote: "Reconstruct the synchronous prefix of an async call.",
    });
    const evidence = db.prepare("SELECT * FROM evidence_events").all();
    const cards = db.prepare("SELECT * FROM review_cards").all();
    expect(reopen()).toMatchObject({ kind: "resume", feedback: { nextAction: "reconstruct",
      reason: "Use the saved question and ask the learner to explain the idea in their own words. This is practice, not a new test." },
      presentation: { kind: "question", seq: question.seq, questionChunking: "atomic" } });
    expect(() => kernel.completeSessionFeedback(sessionId)).toThrow(/reconstruction/);
    const responseText = "A is before end because the call runs synchronously until await.";
    kernel.answerAttemptSubquestion(attemptId, { seq: question.seq, responseText });
    kernel.resolveSessionReconstruction(sessionId, { outcome: "completed", responseText });
    expect(kernel.resumeSession(sessionId).phase).toBe("complete");
    expect(db.prepare("SELECT * FROM evidence_events").all()).toEqual(evidence);
    expect(db.prepare("SELECT * FROM review_cards").all()).toEqual(cards);
  });

  it("closes a correct assisted answer without representing it as independent retrieval", () => {
    kernel.recordHintUse(attemptId, { level: 1, scope: { allTargets: true } });
    kernel.submitAttempt(attemptId, { responseText: "The prefix is synchronous; await suspends the rest." });
    assess("correct");
    expect(kernel.getSessionFeedback(sessionId)).toMatchObject({ nextAction: "complete_feedback",
      objectives: [{ hintLevel: 1, retrievalValid: false }] });
    kernel.completeSessionFeedback(sessionId);
    expect(kernel.getObjectiveEvidenceReceipt(OBJECTIVE_ID).projection.readiness).toBe("guided");
    expect(db.prepare("SELECT * FROM review_cards").all()).toEqual([]);
  });

  it("separates inability to assess from a demonstrated misconception", () => {
    kernel.submitAttempt(attemptId, { responseText: "[inaudible]" });
    assess("ungradable");
    expect(kernel.getSessionFeedback(sessionId)).toMatchObject({ nextAction: "review_ungradable",
      objectives: [{ result: "ungradable", criteria: [{ status: "unassessed" }] }] });
    expect(kernel.resumeSession(sessionId).reconstructionRequired).toBe(false);
  });

  it("keeps surviving targets visible when only one part of a multi-target assessment is invalidated", () => {
    kernel.abandonUnsubmittedSession(sessionId);
    const otherObjectiveId = `${CONCEPT_ID}:predict`;
    kernel.createLearningObjective({ id: otherObjectiveId, conceptId: CONCEPT_ID, capabilityId: "predict" });
    const template = kernel.getChallenge("challenge", 1)!;
    kernel.registerChallenge({ ...template, id: "multi-target",
      targets: [...template.targets, { objectiveId: otherObjectiveId, novelty: "same", criterionIds: ["ordering"] }],
      rubric: { ...template.rubric, id: "multi-rubric", criteria: [...template.rubric.criteria,
        { id: "ordering", objectiveId: otherObjectiveId, required: true, description: "Predicts the ordering." }] },
    });
    sessionId = kernel.createSession(GOAL_ID, "practice").id;
    attemptId = kernel.openAttempt("multi-target", 1, sessionId).attempt.id;
    kernel.submitAttempt(attemptId, { responseText: "A, end, B: the call runs to await, then yields." });
    const assessment = kernel.recordAssessment(attemptId, { evaluatorType: "agent", assessmentBasis: "frozen_rubric",
      objectiveResults: [
        { objectiveId: OBJECTIVE_ID, result: "correct", criteriaMet: ["mechanism"], rationale: "Explains the yield." },
        { objectiveId: otherObjectiveId, result: "correct", criteriaMet: ["ordering"], rationale: "Predicts the order." },
      ] });
    kernel.reviseEvidence(assessment.evidenceEvents[0]!.id, { action: "invalidate", reason: "Mechanism assessment needs review." });
    const feedback = kernel.getSessionFeedback(sessionId);
    expect(feedback.nextAction).toBe("assess_response");
    expect(feedback.objectives).toHaveLength(1);
    expect(feedback.objectives[0]).toMatchObject({ objectiveId: otherObjectiveId,
      evidenceEventId: assessment.evidenceEvents[1]!.id, result: "correct", criteria: [{ id: "ordering", status: "met" }] });
    expect(reopen()).toMatchObject({ kind: "resume", feedback });
    kernel.reviseEvidence(assessment.evidenceEvents[0]!.id, { action: "restore", reason: "Original mechanism assessment verified." });
    expect(kernel.getSessionFeedback(sessionId).nextAction).toBe("complete_feedback");
  });

  it("uses corrected evidence and returns to assessment after invalidation", () => {
    kernel.submitAttempt(attemptId, { responseText: "A runs at the call; await suspends B." });
    const mistaken = assess("incorrect");
    const correction = kernel.reviseEvidence(mistaken.id, { action: "invalidate", reason: "The evaluator misread the response.",
      correctedObjectiveResult: { objectiveId: OBJECTIVE_ID, result: "correct", criteriaMet: ["mechanism"], criteriaUnmet: [],
        misconceptionsObserved: [], misconceptionsCleared: [], observedErrors: [], rationale: "The distinction was present." } });
    expect(kernel.getSessionFeedback(sessionId)).toMatchObject({ nextAction: "complete_feedback",
      objectives: [{ evidenceEventId: correction.replacementEvent!.id, rationale: "The distinction was present." }] });
    expect(kernel.getSessionFeedback(sessionId).objectives).toHaveLength(1);
    kernel.reviseEvidence(correction.replacementEvent!.id, { action: "invalidate", reason: "Re-evaluation requested." });
    expect(kernel.getSessionFeedback(sessionId)).toMatchObject({ nextAction: "assess_response", objectives: [] });
  });
});
