import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runFile, runSource } from "./helpers/spawn.js";

const packs = [
  { directory: "frontend-revision/challenges/js-async-await-predict", completionReplacement: null },
  { directory: "backend-systems/challenges/retries-idempotency-predict", completionReplacement: "dispatch-23" },
  { directory: "frontend-revision/challenges/js-promises-predict", completionReplacement: null },
  { directory: "backend-systems/challenges/database-transactions-predict", completionReplacement: null },
] as const;

function output(source: string): string[] {
  return runSource(source);
}

function codeBlock(markdown: string): string {
  const match = markdown.match(/```js\n([\s\S]*?)\n```/);
  if (!match) throw new Error("Missing executable lesson code block");
  return match[1]!;
}


describe("standalone transaction-debug scaffold content", () => {
  const root = new URL("../knowledge/backend-systems/scaffolds/database-transactions-debug/", import.meta.url);
  const read = (name: string) => readFileSync(new URL(name, root), "utf8");
  const manifest = JSON.parse(read("scaffold.json")) as {
    objective: { conceptId: string; capabilityId: string; taskForm: string };
    stages: { worked_example: { material: string; teacherNotes: string };
      completion: { material: string; teacherNotes: string } };
    checks: Array<{ source: string; expectedOutput: string[] }>;
  };

  it("verifies real buggy and corrected traces with the same decision-bearing inputs", () => {
    expect(manifest.objective).toEqual({
      conceptId: "database-transactions-and-concurrent-correctness",
      capabilityId: "debug", taskForm: "debugging",
    });
    expect(manifest.checks.map((check) => check.source)).toEqual([
      "worked-example.mjs", "completion-buggy.mjs", "completion-solution.mjs",
    ]);
    for (const check of manifest.checks) {
      const actual = runFile(decodeURIComponent(new URL(check.source, root).pathname));
      expect(actual).toEqual(check.expectedOutput);
    }
    expect(manifest.checks[1]!.expectedOutput).toEqual([
      "decisions:[true,true]", "remaining:3 booked:5", "invariant:false",
    ]);
    expect(manifest.checks[2]!.expectedOutput).toEqual([
      "decisions:[true,true]", "remaining:1 booked:5", "invariant:true",
    ]);
  });

  it("matches the worked walkthrough to executable code and its displayed trace", () => {
    const material = read(manifest.stages.worked_example.material);
    const source = codeBlock(material);
    expect(source.trim()).toBe(read("worked-example.mjs").trim());
    expect(output(source)).toEqual(manifest.checks[0]!.expectedOutput);
    expect(material.match(/```text\n([\s\S]*?)\n```/)?.[1]?.split("\n"))
      .toEqual(manifest.checks[0]!.expectedOutput);
    expect(material).toContain("Invariant:");
    expect(material).toContain("serial control");
  });

  it("keeps the completion fix hidden and verifies both candidate expressions", () => {
    const material = read(manifest.stages.completion.material);
    const prompt = codeBlock(material);
    expect(prompt).toContain("FILL_WRITE");
    expect(prompt).not.toContain("remaining = remaining - quantity");
    expect(prompt.replace("FILL_WRITE", "snapshot - quantity").trim())
      .toBe(read("completion-buggy.mjs").trim());
    expect(prompt.replace("FILL_WRITE", "remaining - quantity").trim())
      .toBe(read("completion-solution.mjs").trim());
    expect(output(prompt.replace("FILL_WRITE", "snapshot - quantity")))
      .toEqual(manifest.checks[1]!.expectedOutput);
    expect(output(prompt.replace("FILL_WRITE", "remaining - quantity")))
      .toEqual(manifest.checks[2]!.expectedOutput);
    expect(material).toContain("________");
    for (const stage of [manifest.stages.worked_example, manifest.stages.completion]) {
      const shown = read(stage.material);
      expect(shown).not.toContain(stage.teacherNotes);
      expect(shown).not.toMatch(/Solution:|teacher|answer key/i);
    }
    expect(read(manifest.stages.completion.material)).not.toContain("invariant:true");
  });
});

describe("curated scaffold content", () => {
  for (const pack of packs) {
    const root = new URL(`../knowledge/${pack.directory}/`, import.meta.url);
    const scaffoldRoot = new URL("scaffold/", root);
    const read = (name: string) => readFileSync(new URL(name, scaffoldRoot), "utf8");
    const manifest = JSON.parse(read("scaffold.json")) as {
      objective: { conceptId: string; capabilityId: string; taskForm: string };
      stages: { worked_example: { material: string; teacherNotes: string }; completion: { material: string; teacherNotes: string } };
      checks: Array<{ source: string; expectedOutput: string[] }>;
    };

    it(`${pack.directory}: executes every checked source and matches its objective`, () => {
      const calibration = JSON.parse(readFileSync(new URL("calibration.json", root), "utf8")) as {
        objective: typeof manifest.objective;
        cases: Array<{ source: string }>;
      };
      expect(manifest.objective).toEqual(calibration.objective);
      expect(manifest.checks).toHaveLength(2);
      for (const check of manifest.checks) {
        const source = read(check.source);
        const actual = runFile(decodeURIComponent(new URL(check.source, scaffoldRoot).pathname));
        expect(actual).toEqual(check.expectedOutput);
        for (const assessment of calibration.cases) {
          const heldOutSource = readFileSync(new URL(assessment.source, root), "utf8");
          expect(source.trim()).not.toBe(heldOutSource.trim());
        }
      }
    });

    it(`${pack.directory}: verifies the exact worked example shown to the learner`, () => {
      const markdown = read(manifest.stages.worked_example.material);
      const source = codeBlock(markdown);
      const check = manifest.checks.find((item) => item.source === "worked-example.mjs")!;
      expect(source.trim()).toBe(read(check.source).trim());
      expect(output(source)).toEqual(check.expectedOutput);
      const shownTrace = markdown.match(/```text\n([\s\S]*?)\n```/)?.[1];
      expect(shownTrace?.split("\n")).toEqual(check.expectedOutput);
    });

    it(`${pack.directory}: resolves completion code to the separately verified teacher solution`, () => {
      const markdown = read(manifest.stages.completion.material);
      const source = codeBlock(markdown);
      const resolved = pack.completionReplacement === null
        ? source : source.replace("FILL_RETRY_KEY", pack.completionReplacement);
      const check = manifest.checks.find((item) => item.source === "completion-solution.mjs")!;
      expect(resolved.trim()).toBe(read(check.source).trim());
      expect(output(resolved)).toEqual(check.expectedOutput);
      expect(markdown).toContain("________");
      expect(markdown).toMatch(/reason|Explain/);
    });

    it(`${pack.directory}: keeps teacher answers and notes out of learner material`, () => {
      for (const stage of [manifest.stages.worked_example, manifest.stages.completion]) {
        const markdown = read(stage.material);
        expect(markdown).not.toContain(stage.teacherNotes);
        expect(markdown).not.toMatch(/Solution:|teacher|answer key/i);
      }
      const expected = manifest.checks.find((item) => item.source === "completion-solution.mjs")!.expectedOutput;
      const shownTrace = read(manifest.stages.completion.material).match(/```text\n([\s\S]*?)\n```/)![1]!.split("\n");
      expect(shownTrace).toHaveLength(expected.length);
      for (const line of expected.slice(1)) expect(shownTrace).not.toContain(line);
    });
  }
});
