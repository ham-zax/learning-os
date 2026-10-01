import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createConcept, createDatabase, createTopic, getSession, setGoalObjective } from "../src/db/database.js";
import { buildCalibratedAsyncPredictChallenge } from "../src/knowledge/challenge-calibration.js";
import { getScaffoldMaterial, listScaffoldPacks } from "../src/knowledge/scaffolds.js";
import { createTeacherKernel } from "../src/teacher.js";
import { createTeacherWorkspace } from "../src/workspace.js";
import { runFile } from "./helpers/spawn.js";

const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
const packId = "js-async-await-predict";
const objectiveId = "imported-async-objective";

function fixture(path = ":memory:", deliveryContext: "learn" | "interview" | "mock" = "learn") {
  const db = createDatabase(path);
  const kernel = createTeacherKernel(db, { knowledgeRoot });
  createTopic(db, { id: "goal", name: "Goal" });
  createConcept(db, { id: "js-async-await", topicId: "goal", title: "Async" });
  kernel.createLearningObjective({ id: objectiveId, conceptId: "js-async-await", capabilityId: "predict" });
  setGoalObjective(db, { goalId: "goal", objectiveId, importance: "core", targetReadiness: "guided" });
  const continuation = kernel.getStudyContinuation({ goalId: "goal", now: new Date().toISOString(), oneEpisode: true });
  if (continuation.kind !== "recommend") throw new Error("Expected intent");
  const built = buildCalibratedAsyncPredictChallenge({ knowledgeRoot, intent: continuation.item.intent,
    caseId: "async-prefix-baseline", challengeId: "scaffold-target" });
  kernel.registerChallenge({ ...built.challenge, deliveryContext }, { ...continuation.item.intent, deliveryContext });
  const sessionId = kernel.createSession("goal", deliveryContext).id;
  const attemptId = kernel.openAttempt(built.challenge.id, 1, sessionId).attempt.id;
  const assess = (result: "correct" | "incorrect") => {
    kernel.submitAttempt(attemptId, { responseText: "My committed trace and suspension explanation." });
    const output = runFile(join(knowledgeRoot, "frontend-revision/challenges/js-async-await-predict/baseline.mjs"));
    return kernel.recordAssessment(attemptId, {
      evaluatorType: "agent", assessmentBasis: "deterministic_execution",
      verificationOutput: { outcome: "passed", basis: "Node ESM", summary: output.join(", ") },
      objectiveResults: [{ objectiveId, result,
        criteriaMet: result === "correct" ? ["output_order", "suspension_boundary"] : [],
        criteriaUnmet: result === "incorrect" ? ["output_order", "suspension_boundary"] : [],
        rationale: "Fixture assessment under frozen rubric." }],
    });
  };
  return { db, kernel, sessionId, attemptId, assess };
}

describe("curated scaffold presentation", () => {
  it("discovers optional packs through the workspace and separates teacher answers", () => {
    const workspace = createTeacherWorkspace({ knowledgeRoot });
    expect(workspace.listScaffoldPacks().map((pack) => pack.packId)).toEqual([
      "js-async-await-predict", "retries-idempotency-predict",
    ]);
    const material = workspace.getScaffoldMaterial("async-predict", "completion");
    expect(material.packId).toBe(packId);
    expect(material.teacherOnly.notes).toContain("Solution:");
    expect(material.learnerMarkdown).not.toContain(material.teacherOnly.notes);
    expect(material.exposureType).toBe("explanation_shown");
  });

  it.each(["worked_example", "completion"] as const)("persists %s before return without evidence or scheduling", (stage) => {
    const state = fixture();
    try {
      const cards = state.db.prepare("SELECT * FROM review_cards").all();
      const response = state.kernel.prepareScaffoldPresentation(state.sessionId, { packId, stage });
      const artifact = state.db.prepare("SELECT content FROM teaching_artifacts WHERE id = ?")
        .get(response.teachingArtifactId);
      expect(artifact).toEqual({ content: response.markdown });
      expect(state.db.prepare("SELECT objective_id FROM exposure_events").all()).toEqual([{ objective_id: objectiveId }]);
      expect(response).not.toHaveProperty("teacherOnly");
      expect(response).not.toHaveProperty("expectedOutput");
      expect(state.db.prepare("SELECT * FROM evidence_events").all()).toEqual([]);
      expect(state.db.prepare("SELECT * FROM review_cards").all()).toEqual(cards);
      expect(getSession(state.db, state.sessionId)?.phase).toBe("awaiting_response");
      const committed = state.assess("correct");
      expect(committed.evidenceEvents[0].retrieval_valid).toBe(false);
      expect(state.db.prepare("SELECT * FROM review_cards").all()).toEqual(cards);
    } finally { state.db.close(); }
  });

  it("rejects wrong objectives, inactive targets and invalid reconstruction without partial writes", () => {
    const state = fixture();
    try {
      for (const input of [
        { packId: "retries-idempotency-predict", stage: "completion" as const },
        { packId, stage: "worked_example" as const, requireReconstruction: true },
        { packId, stage: "bad" },
      ]) {
        expect(() => state.kernel.prepareScaffoldPresentation(state.sessionId, input as never)).toThrow();
      }
      expect(() => state.kernel.prepareScaffoldPresentation(9999, { packId, stage: "completion" })).toThrow();
      state.kernel.abandonUnsubmittedSession(state.sessionId);
      expect(() => state.kernel.prepareScaffoldPresentation(state.sessionId, { packId, stage: "completion" })).toThrow();
      expect(state.db.prepare("SELECT * FROM exposure_events").all()).toEqual([]);
      expect(state.db.prepare("SELECT * FROM teaching_artifacts").all()).toEqual([]);
    } finally { state.db.close(); }
  });

  it.each(["interview", "mock"] as const)("defers %s instruction until feedback", (context) => {
    const state = fixture(":memory:", context);
    try {
      expect(() => state.kernel.prepareScaffoldPresentation(state.sessionId, { packId, stage: "worked_example" }))
        .toThrow(/only during feedback/);
      expect(state.db.prepare("SELECT * FROM exposure_events").all()).toEqual([]);
      const committed = state.assess("incorrect");
      expect(committed.evidenceEvents[0].retrieval_valid).toBe(true);
      expect(state.kernel.prepareScaffoldPresentation(state.sessionId, { packId, stage: "worked_example" }))
        .toHaveProperty("markdown");
      expect(state.db.prepare("SELECT retrieval_valid FROM evidence_events").get()).toEqual({ retrieval_valid: 1 });
    } finally { state.db.close(); }
  });

  it("replays exact persisted instruction and required repair after restart without curriculum access", () => {
    const root = mkdtempSync(join(tmpdir(), "learning-os-scaffold-resume-"));
    let db: ReturnType<typeof createDatabase> | undefined;
    try {
      const path = join(root, "tutor.db");
      const state = fixture(path);
      db = state.db;
      state.assess("incorrect");
      const response = state.kernel.prepareScaffoldPresentation(state.sessionId,
        { packId, stage: "worked_example", requireReconstruction: true });
      db.close();
      db = createDatabase(path);
      const kernel = createTeacherKernel(db, { knowledgeRoot: join(root, "missing-curriculum") });
      expect(kernel.resumeSession(state.sessionId).reconstructionRequired).toBe(true);
      expect(kernel.getSessionScaffoldPresentations(state.sessionId)).toMatchObject([
        { markdown: response.markdown, teachingArtifactId: response.teachingArtifactId },
      ]);
      expect(() => kernel.completeSessionFeedback(state.sessionId, {})).toThrow(/reconstruction/);
      expect(db.prepare("SELECT COUNT(*) AS count FROM evidence_events").get()).toEqual({ count: 1 });
    } finally { if (db?.open) db.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it("rejects malformed manifests, mismatched objectives and traversal", () => {
    const root = mkdtempSync(join(tmpdir(), "learning-os-scaffold-invalid-"));
    try {
      const directory = "frontend-revision/challenges/js-async-await-predict";
      cpSync(join(knowledgeRoot, directory), join(root, directory), { recursive: true });
      const manifestPath = join(root, directory, "scaffold/scaffold.json");
      const original = JSON.parse(readFileSync(manifestPath, "utf8"));
      for (const change of [
        { ...original, extra: "unexpected" },
        { ...original, objective: { ...original.objective, conceptId: "wrong-concept" } },
        { ...original, stages: { ...original.stages, completion: { ...original.stages.completion, material: "../calibration.json" } } },
      ]) {
        writeFileSync(manifestPath, JSON.stringify(change));
        expect(() => getScaffoldMaterial(root, packId, "completion")).toThrow();
      }
      expect(() => listScaffoldPacks(root)).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
