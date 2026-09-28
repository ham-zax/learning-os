import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKernelFixture, GOAL_ID } from "./helpers/kernel-fixture.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const cliPath = join(repoRoot, "src", "kernel-cli.ts");

describe("kernel JSON CLI", () => {
  let root: string;
  let databasePath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-kernel-cli-"));
    databasePath = join(root, "tutor.db");
    createKernelFixture(databasePath).db.close();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run(...args: string[]) {
    return spawnSync(tsxBin, [cliPath, "--db", databasePath, ...args], { cwd: root, encoding: "utf8" });
  }

  it("passes JSON arguments to the named kernel method and prints one JSON result", () => {
    const result = run("getStudyContinuation",
      JSON.stringify({ goalId: GOAL_ID, now: new Date().toISOString(), oneEpisode: true }));
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ kind: "recommend" });
  });

  it("lists kernel methods and the calibrated pack helpers", () => {
    const result = run("methods");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expect.arrayContaining([
      "submitAttempt", "recordExposure", "findCalibratedCase", "buildCalibratedChallenge",
    ]));
  });

  it("reports unknown methods and invalid JSON as a JSON error with a failing exit code", () => {
    for (const result of [run("noSuchMethod"), run("getSessionFeedback", "not json")]) {
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stderr)).toHaveProperty("error");
    }
  });
});
