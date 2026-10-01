import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKernelFixture, GOAL_ID } from "./helpers/kernel-fixture.js";
import { runSync } from "./helpers/spawn.js";

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
    return runSync(tsxBin, [cliPath, "--db", databasePath, ...args], { cwd: root, encoding: "utf8" });
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
      "listScaffoldPacks", "getScaffoldMaterial", "prepareScaffoldPresentation", "getSessionScaffoldPresentations",
    ]));
  });

  it("discovers scaffolds outside the repository working directory", () => {
    const result = run("listScaffoldPacks");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).map((pack: { packId: string }) => pack.packId)).toEqual([
      "js-async-await-predict", "retries-idempotency-predict",
    ]);
  });

  it("reports unknown methods and invalid JSON as a JSON error with a failing exit code", () => {
    const missingValue = runSync(tsxBin, [cliPath, "listPreparationContexts", "--profile"], { cwd: root, encoding: "utf8" });
    for (const result of [run("noSuchMethod"), run("getSessionFeedback", "not json"), missingValue]) {
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stderr)).toHaveProperty("error");
    }
  });

  it("does not echo malformed learner input and rejects inherited object methods", () => {
    const secret = "private-learner-response";
    const invalid = run("submitAttempt", secret);
    expect(JSON.parse(invalid.stderr)).toMatchObject({ code: "INVALID_JSON", operation: "kernel", retryable: false });
    expect(invalid.stderr).not.toContain(secret);
    const inherited = run("constructor");
    expect(inherited.status).toBe(1);
    expect(JSON.parse(inherited.stderr)).toMatchObject({ code: "UNKNOWN_METHOD" });
  });
});
