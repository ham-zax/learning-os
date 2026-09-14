import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, createProblem } from "../src/db/database.js";
import { startCodingDrill } from "../src/interview/coding.js";
import { createTeacherKernel } from "../src/teacher.js";
import { createKernelFixture, CONCEPT_ID, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("learner control over practical effort", () => {
  let root: string;
  let db: ReturnType<typeof createDatabase>;
  let kernel: ReturnType<typeof createTeacherKernel>;
  const implementationId = `${CONCEPT_ID}:implement`;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-effort-"));
    db = createKernelFixture(join(root, "tutor.db")).db;
    kernel = createTeacherKernel(db);
    kernel.createLearningObjective({ id: implementationId, conceptId: CONCEPT_ID, capabilityId: "implement" });
    kernel.setGoalObjective({ goalId: GOAL_ID, objectiveId: implementationId, importance: "core" });
    kernel.registerChallenge({
      id: "implementation", version: 1, publicPrompt: "Implement a latest-request-wins guard.",
      taskForm: "implementation", deliveryContext: "practice",
      targets: [{ objectiveId: implementationId, novelty: "same", criterionIds: ["guard"] }],
      rubric: { id: "guard", version: 1, criteria: [{ id: "guard", objectiveId: implementationId,
        required: true, description: "Prevents older responses from replacing newer results." }] },
      verification: { required: true, basis: "deterministic_execution" },
    });
  });
  afterEach(() => {
    if (db.open) db.close();
    rmSync(root, { recursive: true, force: true });
  });

  function evidenceState() {
    return ["evidence_events", "objective_projections", "review_cards", "goal_objectives", "exposure_events"]
      .map((table) => db.prepare(`SELECT * FROM ${table}`).all());
  }

  it("persists session declines across reconnection without turning them into lasting preferences or evidence", () => {
    const session = kernel.createSession(GOAL_ID, "practice");
    kernel.openAttempt("implementation", 1, session.id);
    const state = evidenceState();
    kernel.setSessionPracticalWork(session.id, "conversation_only");
    db.close();
    db = createDatabase(join(root, "tutor.db"));
    kernel = createTeacherKernel(db);
    expect(kernel.getStudyContinuation({ goalId: GOAL_ID, now: new Date().toISOString() })).toMatchObject({
      kind: "resume", practicalWork: { preference: "conversation_only", source: "session" },
    });
    kernel.abandonUnsubmittedSession(session.id);
    expect(evidenceState()).toEqual(state);
    expect(kernel.getPracticalWorkPolicy()).toEqual({ preference: "ask_first", source: "default" });
    expect(kernel.getPracticalWorkPolicy(kernel.createSession(GOAL_ID, "practice").id))
      .toEqual({ preference: "ask_first", source: "default" });
  });

  it("defers practical objectives and retains a useful conversational recommendation", () => {
    const state = evidenceState();
    kernel.setInteractionPreferences({ practicalWork: "conversation_only", questionChunking: "atomic" });
    const result = kernel.getStudyContinuation({ goalId: GOAL_ID, now: new Date().toISOString(), oneEpisode: true });
    expect(result).toMatchObject({ kind: "recommend", practicalWork: { preference: "conversation_only", source: "profile" },
      item: { objectiveId: OBJECTIVE_ID }, mission: { deferredPracticalObjectiveIds: [implementationId] } });
    expect(evidenceState()).toEqual(state);
    expect(kernel.getTodayMission({ goalId: GOAL_ID, now: new Date().toISOString(), availableMinutes: 30 })
      .items.every((item) => item.intent.capabilityId !== "implement")).toBe(true);
    kernel.setInteractionPreferences({ inputMode: "speech_to_text" });
    expect(kernel.getPreparationContext(GOAL_ID)?.interactionPreferences).toMatchObject({
      practicalWork: "conversation_only", questionChunking: "atomic", inputMode: "speech_to_text",
    });
  });

  it("does not repeatedly recommend an implementation-only goal after a decline, or erase the unmet goal", () => {
    kernel.setGoalObjective({ goalId: GOAL_ID, objectiveId: OBJECTIVE_ID, isActive: false });
    const state = evidenceState();
    const input = { goalId: GOAL_ID, now: new Date().toISOString(), oneEpisode: true,
      practicalWork: "conversation_only" as const };
    for (let turn = 0; turn < 3; turn++) {
      expect(kernel.getStudyContinuation(input)).toMatchObject({ kind: "no_action",
        practicalWork: { preference: "conversation_only", source: "request" },
        mission: { items: [], deferredPracticalObjectiveIds: [implementationId] } });
    }
    expect(evidenceState()).toEqual(state);
    expect(kernel.getPracticalWorkPolicy()).toEqual({ preference: "ask_first", source: "default" });
  });

  it("requires an explicit change of choice to open practical work while conversation-only", () => {
    kernel.setInteractionPreferences({ practicalWork: "conversation_only" });
    const session = kernel.createSession(GOAL_ID, "practice");
    const state = evidenceState();
    expect(() => kernel.openAttempt("implementation", 1, session.id)).toThrow("conversation-only");
    expect(db.prepare("SELECT * FROM attempts").all()).toEqual([]);
    const conversational = kernel.openAttempt("challenge", 1, session.id);
    expect(conversational.attempt.submitted_at).toBeNull();
    kernel.abandonUnsubmittedSession(session.id);
    const adopted = kernel.createSession(GOAL_ID, "practice", "ask_first");
    kernel.openAttempt("implementation", 1, adopted.id);
    expect(kernel.getPracticalWorkPolicy(adopted.id)).toEqual({ preference: "ask_first", source: "session" });
    expect(kernel.getPracticalWorkPolicy()).toEqual({ preference: "conversation_only", source: "profile" });
    expect(evidenceState()).toEqual(state);
  });

  it("honors explicit coding-drill adoption without changing the standing preference or leaving an idle session", () => {
    kernel.setInteractionPreferences({ practicalWork: "conversation_only" });
    createProblem(db, { id: "guard-problem", type: "coding", title: "Guard stale results",
      description: "Implement a latest-request guard.", conceptId: CONCEPT_ID });
    const drill = startCodingDrill(db, { problemId: "guard-problem" });
    expect(kernel.getPracticalWorkPolicy(drill.sessionId)).toEqual({ preference: "ask_first", source: "session" });
    expect(kernel.getPracticalWorkPolicy()).toEqual({ preference: "conversation_only", source: "profile" });
    expect(kernel.listResumableSessions()).toMatchObject([
      { phase: "awaiting_response", activeAttempt: { id: drill.attemptId } },
    ]);
    expect(db.prepare("SELECT * FROM sessions WHERE phase = 'idle'").all()).toEqual([]);
  });

  it("can select and open conversational debugging while rejecting an execution-required authoring choice", () => {
    kernel.setGoalObjective({ goalId: GOAL_ID, objectiveId: OBJECTIVE_ID, isActive: false });
    kernel.setGoalObjective({ goalId: GOAL_ID, objectiveId: implementationId, isActive: false });
    const objectiveId = `${CONCEPT_ID}:debug`;
    kernel.createLearningObjective({ id: objectiveId, conceptId: CONCEPT_ID, capabilityId: "debug" });
    kernel.setGoalObjective({ goalId: GOAL_ID, objectiveId });
    kernel.setInteractionPreferences({ practicalWork: "conversation_only" });
    const next = kernel.getStudyContinuation({ goalId: GOAL_ID, now: new Date().toISOString(), oneEpisode: true });
    expect(next.kind).toBe("recommend");
    if (next.kind !== "recommend") throw new Error("Expected conversational debugging");
    const template = kernel.getChallenge("challenge", 1)!;
    const challenge = kernel.registerChallenge({ ...template, id: "conversation-debug",
      taskForm: next.item.intent.taskForm, deliveryContext: next.item.intent.deliveryContext,
      publicPrompt: "Explain the stale-result bug without running this code. Two calls use older then newer input; the older request finishes last.\n\nasync function search(query) { const result = await fetch(query); render(await result.json()); }",
      targets: [{ objectiveId, novelty: next.item.intent.novelty, criterionIds: ["race"] }],
      rubric: { id: "race", version: 1, criteria: [{ id: "race", objectiveId, required: true,
        description: "Locates the out-of-order publication and explains its cause." }] },
    }, next.item.intent);
    const session = kernel.createSession(GOAL_ID, next.item.intent.deliveryContext, next.practicalWork.preference);
    expect(kernel.openAttempt(challenge.id, challenge.version, session.id).attempt.submitted_at).toBeNull();
    kernel.registerChallenge({ ...challenge, id: "execution-debug", verification: { required: true, basis: "deterministic_execution" } });
    expect(() => kernel.openAttempt("execution-debug", 1, session.id)).toThrow("conversation-only");
    expect(kernel.resumeSession(session.id).activeAttempt?.challenge_id).toBe("conversation-debug");
  });

  it("also guards execution-required debugging and validates the public preference boundary", () => {
    const template = kernel.getChallenge("challenge", 1)!;
    kernel.registerChallenge({ ...template, id: "debug", taskForm: "debugging",
      verification: { required: true, basis: "deterministic_execution" } });
    const session = kernel.createSession(GOAL_ID, "practice", "conversation_only");
    expect(() => kernel.openAttempt("debug", 1, session.id)).toThrow("conversation-only");
    expect(() => Reflect.apply(kernel.setSessionPracticalWork, kernel, [session.id, "always_code"]))
      .toThrow();
    expect(() => kernel.setSessionPracticalWork(9999, "ask_first")).toThrow("Session not found");
    kernel.setSessionPracticalWork(session.id, null);
    expect(kernel.getPracticalWorkPolicy(session.id)).toEqual({ preference: "ask_first", source: "default" });
  });
});
