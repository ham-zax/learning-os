import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  listCalibratedPredictionPacks,
  loadCalibratedPredictionPack,
} from "../src/knowledge/challenge-calibration.js";
import { runFile } from "./helpers/spawn.js";

const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
const packs = listCalibratedPredictionPacks(knowledgeRoot);

// Every discovered pack is verified here, so a new pack needs no bespoke test.
describe("discovered calibrated prediction packs", () => {
  it("discovers the original packs", () => {
    expect(packs.map((pack) => pack.id)).toEqual(expect.arrayContaining([
      "database-transactions-predict",
      "js-async-await-predict",
      "retries-idempotency-predict",
    ]));
  });

  it.each(packs)("$id answer keys match real execution and wrong models differ", (location) => {
    const pack = loadCalibratedPredictionPack(knowledgeRoot, location.id);
    expect(new Set(pack.cases.map((item) => item.surface)).size).toBe(pack.cases.length);
    for (const item of pack.cases) {
      const source = join(knowledgeRoot, location.course, location.directory, item.source);
      const actual = runFile(source);
      expect(actual, `${location.id}/${item.id}`).toEqual(item.expectedOutput);
      for (const wrong of item.wrongModels) {
        if (wrong.predictedOutput) expect(wrong.predictedOutput).not.toEqual(actual);
        if (wrong.predictedFinal) expect(wrong.predictedFinal).not.toBe(actual.at(-1)?.split(": ").at(-1));
        if (wrong.predictedFirstUpdate) expect(wrong.predictedFirstUpdate).not.toBe(actual[0]);
      }
    }
  });

  it("skips an incomplete draft without breaking published packs", () => {
    const root = mkdtempSync(join(tmpdir(), "learning-os-packs-"));
    try {
      cpSync(knowledgeRoot, root, { recursive: true });
      const draft = join(root, "frontend-revision", "challenges", "broken-draft");
      cpSync(join(root, "frontend-revision", "challenges", "js-promises-predict"), draft, { recursive: true });
      writeFileSync(join(draft, "calibration.json"), JSON.stringify({ draft: true, cases: [] }));
      expect(listCalibratedPredictionPacks(root).map((pack) => pack.id)).not.toContain("broken-draft");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
