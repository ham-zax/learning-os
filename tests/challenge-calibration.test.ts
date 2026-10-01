import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createConcept, createDatabase, createTopic, setGoalObjective } from "../src/db/database.js";
import { buildCalibratedAsyncPredictChallenge, loadAsyncPredictCalibration } from "../src/knowledge/challenge-calibration.js";
import { codingCourseFile } from "../src/knowledge/courses.js";
import { createTeacherKernel } from "../src/teacher.js";
import { runFile } from "./helpers/spawn.js";

const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
const courseDirectory = fileURLToPath(new URL("../knowledge/frontend-revision", import.meta.url));
const caseDirectory = "challenges/js-async-await-predict";

describe("calibrated js-async-await prediction examples", () => {
  it("matches every frozen answer key to executable Node output and discriminates wrong models", () => {
    const pack = loadAsyncPredictCalibration(knowledgeRoot);
    expect(pack.cases.map((item) => item.novelty)).toEqual(["same", "variant", "transfer"]);
    expect(new Set(pack.cases.map((item) => item.surface)).size).toBe(pack.cases.length);
    for (const item of pack.cases) {
      const source = codingCourseFile(courseDirectory, `${caseDirectory}/${item.source}`);
      const actual = runFile(source);
      expect(actual).toEqual(item.expectedOutput);
      expect(item.criteria.map((criterion) => criterion.id)).toEqual(["output_order", "suspension_boundary"]);
      for (const wrong of item.wrongModels) {
        if (wrong.predictedOutput) expect(wrong.predictedOutput).not.toEqual(actual);
        if (wrong.predictedFinal) expect(wrong.predictedFinal).not.toBe(actual.at(-1)?.split(": ").at(-1));
        if (wrong.predictedFirstUpdate) expect(wrong.predictedFirstUpdate).not.toBe(actual[0]);
      }
    }
  });

  it("builds a learner-safe challenge under the selected imported objective and requires real verification", () => {
    const db = createDatabase(":memory:");
    try {
      createTopic(db, { id: "goal", name: "Frontend revision" });
      createConcept(db, { id: "js-async-await", topicId: "goal", title: "async/await" });
      const kernel = createTeacherKernel(db);
      kernel.createLearningObjective({ id: "imported-async-predict", conceptId: "js-async-await", capabilityId: "predict" });
      setGoalObjective(db, { goalId: "goal", objectiveId: "imported-async-predict",
        importance: "core", targetReadiness: "guided" });
      const continuation = kernel.getStudyContinuation({ goalId: "goal", now: new Date().toISOString(), oneEpisode: true });
      expect(continuation.kind).toBe("recommend");
      if (continuation.kind !== "recommend") throw new Error("Expected a selected intent");
      const intent = continuation.item.intent;
      expect(intent).toMatchObject({ conceptId: "js-async-await", capabilityId: "predict",
        taskForm: "runtime_trace", novelty: "same" });

      const built = buildCalibratedAsyncPredictChallenge({ knowledgeRoot, intent,
        caseId: "async-prefix-baseline", challengeId: "selected-async-baseline", timeBudgetMinutes: 5 });
      const baselinePath = codingCourseFile(courseDirectory, `${caseDirectory}/baseline.mjs`);
      const source = readFileSync(baselinePath, "utf8").trimEnd();
      expect(built.challenge.publicPrompt).toContain(source);
      expect(built.challenge.publicPrompt).not.toContain("expectedOutput");
      expect(built.challenge.publicPrompt).not.toContain(built.calibration.wrongModels[0]!.claim);
      expect(built.challenge.targets).toEqual([{ objectiveId: intent.objectiveId,
        novelty: intent.novelty, criterionIds: ["output_order", "suspension_boundary"] }]);
      expect(built.challenge.verification).toEqual({ required: true, basis: "deterministic_execution" });
      expect(built.challenge.timeBudgetMinutes).toBe(5);
      for (const item of loadAsyncPredictCalibration(knowledgeRoot).cases) {
        const candidate = buildCalibratedAsyncPredictChallenge({ knowledgeRoot,
          intent: { ...intent, novelty: item.novelty, requiresChangedSurface: item.novelty !== "same" },
          caseId: item.id, challengeId: `candidate-${item.id}` });
        expect(candidate.challenge.publicPrompt).toContain(readFileSync(
          codingCourseFile(courseDirectory, `${caseDirectory}/${item.source}`), "utf8").trimEnd());
        expect(candidate.challenge.publicPrompt).not.toContain(item.wrongModels[0]!.claim);
      }
      kernel.registerChallenge(built.challenge, intent);
      expect(kernel.getChallengeAuthoringContract(built.challenge.id, 1)).toMatchObject({
        objectiveId: intent.objectiveId, novelty: "same", taskForm: "runtime_trace",
      });

      const sessionId = kernel.createSession("goal", intent.deliveryContext).id;
      const attemptId = kernel.openAttempt(built.challenge.id, 1, sessionId).attempt.id;
      kernel.submitAttempt(attemptId, { responseText: "inside-start, outside, inside-end; task suspends at await." });
      const assessment = { evaluatorType: "agent" as const, assessmentBasis: "deterministic_execution" as const,
        objectiveResults: [{ objectiveId: intent.objectiveId, result: "correct" as const,
          criteriaMet: ["output_order", "suspension_boundary"], rationale: "Correct order and suspension boundary." }] };
      expect(() => kernel.recordAssessment(attemptId, assessment)).toThrow(/verification output/);
      const actualOutput = runFile(baselinePath);
      expect(actualOutput).toEqual(built.calibration.expectedOutput);
      const committed = kernel.recordAssessment(attemptId, { ...assessment,
        verificationOutput: { outcome: "passed", basis: "Node ESM execution after learner response",
          summary: actualOutput.join(", "), details: { output: actualOutput } } });
      expect(committed.evidenceEvents[0]?.result).toBe("correct");

      expect(() => buildCalibratedAsyncPredictChallenge({ knowledgeRoot,
        intent: { ...intent, novelty: "variant" }, caseId: "async-prefix-baseline",
        challengeId: "wrong-novelty" })).toThrow(/does not match selected novelty/);
      expect(() => buildCalibratedAsyncPredictChallenge({ knowledgeRoot,
        intent: { ...intent, capabilityId: "explain" }, caseId: "async-prefix-baseline",
        challengeId: "wrong-capability" })).toThrow(/does not match/);
    } finally {
      db.close();
    }
  });
});
