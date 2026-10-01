import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createConcept, createDatabase, createTopic, setGoalObjective } from "../src/db/database.js";
import { buildCalibratedPredictionChallenge, findCalibratedPredictionCase, loadCalibratedPredictionPack } from "../src/knowledge/challenge-calibration.js";
import type { CalibratedPredictionPackId } from "../src/knowledge/challenge-calibration.js";
import { codingCourseFile } from "../src/knowledge/courses.js";
import { createTeacherKernel } from "../src/teacher.js";
import { runFile } from "./helpers/spawn.js";

const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
const courseDirectory = fileURLToPath(new URL("../knowledge/backend-systems", import.meta.url));
const packs = [
  { id: "transaction-predict", conceptId: "database-transactions-and-concurrent-correctness",
    directory: "challenges/database-transactions-predict" },
  { id: "idempotency-predict", conceptId: "retries-idempotency-and-uncertain-outcomes",
    directory: "challenges/retries-idempotency-predict" },
] as const satisfies ReadonlyArray<{ id: CalibratedPredictionPackId; conceptId: string; directory: string }>;

describe("backend calibrated prediction examples", () => {
  it.each(packs)("finds an eligible $id case and rejects a reused code surface", (config) => {
    const db = createDatabase(":memory:");
    try {
      createTopic(db, { id: "goal", name: "Backend systems" });
      createConcept(db, { id: config.conceptId, topicId: "goal", title: config.conceptId });
      const kernel = createTeacherKernel(db);
      const objectiveId = `imported-${config.id}`;
      kernel.createLearningObjective({ id: objectiveId, conceptId: config.conceptId, capabilityId: "predict" });
      setGoalObjective(db, { goalId: "goal", objectiveId, importance: "core", targetReadiness: "guided" });
      const continuation = kernel.getStudyContinuation({ goalId: "goal", now: new Date().toISOString(), oneEpisode: true });
      if (continuation.kind !== "recommend") throw new Error("Expected a selected intent");
      const intent = continuation.item.intent;
      const baseline = loadCalibratedPredictionPack(knowledgeRoot, config.id).cases[0]!;
      expect(findCalibratedPredictionCase(knowledgeRoot, intent, kernel.getChallenge))
        .toEqual({ packId: config.id, caseId: baseline.id });

      const previous = buildCalibratedPredictionChallenge({ knowledgeRoot, packId: config.id,
        intent, caseId: baseline.id, challengeId: "custom-previous-id" });
      kernel.registerChallenge(previous.challenge, intent);
      const avoidRecentChallenges = [{ challengeId: previous.challenge.id, version: 1, attemptId: 1,
        taskForm: "runtime_trace" as const, novelty: "same" as const,
        performedAt: "2026-09-24T00:00:00.000Z" }];
      expect(findCalibratedPredictionCase(knowledgeRoot,
        { ...intent, avoidRecentChallenges }, kernel.getChallenge)).toBeNull();
      const variant = loadCalibratedPredictionPack(knowledgeRoot, config.id).cases[1]!;
      expect(findCalibratedPredictionCase(knowledgeRoot,
        { ...intent, novelty: "variant", requiresChangedSurface: true, avoidRecentChallenges },
        kernel.getChallenge)).toEqual({ packId: config.id, caseId: variant.id });
      expect(findCalibratedPredictionCase(knowledgeRoot,
        { ...intent, conceptId: "unmatched-concept" }, kernel.getChallenge)).toBeNull();
    } finally {
      db.close();
    }
  });

  it.each(packs)("runs every $id answer key and separates its common wrong predictions", (config) => {
    const pack = loadCalibratedPredictionPack(knowledgeRoot, config.id);
    expect(pack.objective).toEqual({ conceptId: config.conceptId,
      capabilityId: "predict", taskForm: "runtime_trace" });
    expect(pack.cases.map((item) => item.novelty)).toEqual(["same", "variant", "transfer"]);
    expect(new Set(pack.cases.map((item) => item.surface)).size).toBe(3);
    for (const item of pack.cases) {
      const source = codingCourseFile(courseDirectory, `${config.directory}/${item.source}`);
      const actual = runFile(source);
      expect(actual).toEqual(item.expectedOutput);
      expect(item.criteria).toHaveLength(2);
      expect(item.criteria.every((criterion) => criterion.required)).toBe(true);
      for (const wrong of item.wrongModels) {
        if (wrong.predictedOutput) expect(wrong.predictedOutput).not.toEqual(actual);
        if (wrong.predictedFinal) expect(wrong.predictedFinal).not.toBe(actual.at(-1));
        if (wrong.predictedFirstUpdate) expect(wrong.predictedFirstUpdate).not.toBe(actual[0]);
      }
    }
  });

  it.each(packs)("builds $id for the selected imported objective without leaking its answer key", (config) => {
    const db = createDatabase(":memory:");
    try {
      createTopic(db, { id: "goal", name: "Backend systems" });
      createConcept(db, { id: config.conceptId, topicId: "goal", title: config.conceptId });
      const kernel = createTeacherKernel(db);
      const objectiveId = `imported-${config.id}`;
      kernel.createLearningObjective({ id: objectiveId, conceptId: config.conceptId, capabilityId: "predict" });
      setGoalObjective(db, { goalId: "goal", objectiveId, importance: "core", targetReadiness: "guided" });
      const continuation = kernel.getStudyContinuation({ goalId: "goal", now: new Date().toISOString(), oneEpisode: true });
      expect(continuation.kind).toBe("recommend");
      if (continuation.kind !== "recommend") throw new Error("Expected a selected intent");
      const intent = continuation.item.intent;
      const pack = loadCalibratedPredictionPack(knowledgeRoot, config.id);

      for (const item of pack.cases) {
        const selected = { ...intent, novelty: item.novelty, requiresChangedSurface: item.novelty !== "same" };
        const built = buildCalibratedPredictionChallenge({ knowledgeRoot, packId: config.id,
          intent: selected, caseId: item.id, challengeId: `calibrated-${item.id}` });
        const code = readFileSync(codingCourseFile(courseDirectory,
          `${config.directory}/${item.source}`), "utf8").trimEnd();
        expect(built.challenge.publicPrompt).toContain(code);
        expect(built.challenge.publicPrompt).not.toContain(item.wrongModels[0]!.claim);
        expect(built.challenge.publicPrompt).not.toContain("expectedOutput");
        expect(built.challenge.targets).toEqual([{ objectiveId,
          novelty: item.novelty, criterionIds: item.criteria.map((criterion) => criterion.id) }]);
        expect(built.challenge.verification).toEqual({ required: true, basis: "deterministic_execution" });
        expect(built.challenge.privateSolutionRef).toContain(`${config.directory}/calibration.json`);
        if (item.novelty === "same") {
          kernel.registerChallenge(built.challenge, intent);
          expect(kernel.getChallengeAuthoringContract(built.challenge.id, 1)).toMatchObject({
            objectiveId, conceptId: config.conceptId, capabilityId: "predict", novelty: "same",
          });
        }
      }

      expect(() => buildCalibratedPredictionChallenge({ knowledgeRoot, packId: config.id,
        intent: { ...intent, novelty: "variant" }, caseId: pack.cases[0]!.id,
        challengeId: "wrong-novelty" })).toThrow(/does not match selected novelty/);
      const otherPackId = config.id === "transaction-predict" ? "idempotency-predict" : "transaction-predict";
      const otherCase = loadCalibratedPredictionPack(knowledgeRoot, otherPackId).cases[0]!;
      expect(() => buildCalibratedPredictionChallenge({ knowledgeRoot, packId: otherPackId,
        intent, caseId: otherCase.id, challengeId: "wrong-objective" })).toThrow(/does not match the calibrated prediction objective/);
    } finally {
      db.close();
    }
  });
});
