import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compareTeacherHarnesses } from "../src/evaluation/harness-comparison.js";
import { runSync } from "./helpers/spawn.js";

function fixture() {
  const quality = {
    accuracy: { verdict: "meets", evidence: "Reply lines 2-4 match the supplied source." },
    causalClarity: { verdict: "meets", evidence: "Reply lines 5-7 explain the counterexample." },
    adaptation: { verdict: "concern", evidence: "Reply lines 1-4 repeat the known basics." },
    learnerAgency: { verdict: "meets", evidence: "No quiz follows the requested explanation." },
    assessmentHonesty: { verdict: "meets", evidence: "Reply makes no mastery claim." },
  };
  const baseline = {
    runId: "baseline-1", harnessSha256: "a".repeat(64), replySha256: "b".repeat(64),
    conditions: {
      scenarioSha256: "c".repeat(64), initialStateSha256: null,
      model: "provider/model", modelOptions: "effort=high", toolPermissions: "read-only",
      sourceSnapshot: "fixture-v1",
    },
    quality,
    integrity: { verdict: "pass", evidence: "Action trace contains no learner-state write." },
    costs: { toolCalls: 1, tokens: 500, elapsedMs: 1000 },
  };
  const candidate = structuredClone(baseline);
  candidate.runId = "candidate-1";
  candidate.harnessSha256 = "d".repeat(64);
  candidate.replySha256 = "e".repeat(64);
  return { caseId: "example", split: "development", rubricRevision: "v1",
    reviewer: { id: "reviewer-1", blinded: true }, baseline, candidate };
}

describe("teacher harness comparison", () => {
  it("exposes comparison through the CLI without treating review concerns as execution failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "learning-os-comparison-"));
    try {
      const input = fixture();
      input.candidate.quality.accuracy.verdict = "concern";
      const path = join(directory, "receipt.json");
      writeFileSync(path, JSON.stringify(input));
      const result = runSync(resolve("node_modules/.bin/tsx"), [resolve("src/evaluation/cli.ts"), "compare-harness", path],
        { encoding: "utf8" });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout as string)).toMatchObject({
        status: "human_review_required", regressions: ["accuracy"],
      });
      writeFileSync(path, "{}");
      expect(runSync(resolve("node_modules/.bin/tsx"), [resolve("src/evaluation/cli.ts"), "compare-harness", path],
        { encoding: "utf8" }).status).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("separates a teaching improvement from increased operating costs", () => {
    const input = fixture();
    input.candidate.quality.adaptation.verdict = "meets";
    input.candidate.costs.toolCalls = 6;
    const report = compareTeacherHarnesses(input);
    expect(report.dimensions.find((item) => item.dimension === "adaptation")?.change).toBe("improved");
    expect(report.costs.candidate.toolCalls).toBe(6);
    expect(report.status).toBe("human_review_required");
    expect(report).not.toHaveProperty("score");
  });

  it("does not let cheap runs or other improvements hide regression or missing evidence", () => {
    const input = fixture();
    input.candidate.quality.accuracy.verdict = "concern";
    input.candidate.quality.causalClarity.verdict = "uncertain";
    input.candidate.quality.adaptation.verdict = "meets";
    input.candidate.costs.toolCalls = 0;
    input.candidate.integrity.verdict = "fail";
    const report = compareTeacherHarnesses(input);
    expect(report.regressions).toEqual(["accuracy"]);
    expect(report.unresolved).toEqual(["causalClarity"]);
    expect(report.integrity.candidate.verdict).toBe("fail");
  });

  it.each(["scenarioSha256", "initialStateSha256", "model", "modelOptions", "toolPermissions", "sourceSnapshot"] as const)
    ("rejects unmatched %s", (field) => {
      const input = fixture();
      Object.assign(input.candidate.conditions, { [field]: field.endsWith("Sha256") ? "f".repeat(64) : "different" });
      expect(() => compareTeacherHarnesses(input)).toThrow(/Unmatched/);
    });

  it("rejects missing judgments and unsupported verdicts rather than treating them as passes", () => {
    const input = fixture();
    const { accuracy: _omitted, ...incomplete } = input.candidate.quality;
    expect(() => compareTeacherHarnesses({ ...input, candidate: { ...input.candidate, quality: incomplete } })).toThrow();
    input.candidate.quality.accuracy.evidence = " ";
    expect(() => compareTeacherHarnesses(input)).toThrow();
    input.candidate.quality.accuracy.evidence = "Source excerpt";
    input.candidate.quality.accuracy.verdict = "S";
    expect(() => compareTeacherHarnesses(input)).toThrow();
  });

  it("rejects reused runs and unchanged harness snapshots", () => {
    const input = fixture();
    input.candidate.runId = input.baseline.runId;
    expect(() => compareTeacherHarnesses(input)).toThrow(/distinct runs/);
    input.candidate.runId = "candidate-1";
    input.candidate.harnessSha256 = input.baseline.harnessSha256;
    expect(() => compareTeacherHarnesses(input)).toThrow(/distinct harness/);
  });
});
