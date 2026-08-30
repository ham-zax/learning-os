import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createProfile,
  openProfileDatabase,
  selectProfile,
} from "../src/profile/index.js";
import {
  createKernelFixture,
  GOAL_ID,
} from "./helpers/kernel-fixture.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const cliPath = join(repoRoot, "src", "cli.ts");

describe("continue CLI", () => {
  let root: string;
  let dataDir: string;
  let profileId: string;
  let databasePath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-continue-"));
    dataDir = join(root, "data");
    const profile = createProfile(
      { id: "learner", displayName: "Learner" },
      { dataDir },
    );
    profileId = profile.id;
    databasePath = join(dataDir, "profiles", profile.id, "tutor.db");
    selectProfile(profile.id, { dataDir });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function runContinue(...args: string[]) {
    return spawnSync(tsxBin, [cliPath, "continue", GOAL_ID, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  }

  it("emits one JSON budget request when remaining time is unknown", () => {
    const fixture = createKernelFixture(databasePath);
    fixture.db.close();

    const result = runContinue("--json");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      kind: "needs_budget",
      goalId: GOAL_ID,
      suggestedMinutes: 30,
    });
  });

  it("emits resumable work without requiring minutes", () => {
    const fixture = createKernelFixture(databasePath);
    const { sessionId } = fixture.openPracticeAttempt();
    fixture.db.close();

    const result = runContinue("--json");
    const continuation = JSON.parse(result.stdout) as {
      kind: string;
      session: { session: { id: number }; pendingAction: string };
    };

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(continuation).toMatchObject({
      kind: "resume",
      session: {
        session: { id: sessionId },
        pendingAction: "collect_response",
      },
    });
  });

  it("emits one recommendation without opening an attempt", () => {
    const fixture = createKernelFixture(databasePath);
    fixture.db.close();

    const result = runContinue("--minutes", "20", "--json");
    const continuation = JSON.parse(result.stdout) as {
      kind: string;
      mission: { items: unknown[] };
    };

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(continuation.kind).toBe("recommend");
    expect(continuation.mission.items).toHaveLength(1);

    const db = openProfileDatabase(profileId, { dataDir });
    try {
      const row = db.prepare("SELECT COUNT(*) AS count FROM attempts").get() as {
        count: number;
      };
      expect(row.count).toBe(0);
    } finally {
      db.close();
    }
  });

  it("explains how to supply an unknown budget in human output", () => {
    const fixture = createKernelFixture(databasePath);
    fixture.db.close();

    const result = runContinue();

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Remaining active-study minutes are unknown");
    expect(result.stdout).toContain("--minutes <n>");
  });

  it("rejects malformed minutes even when unfinished work can resume", () => {
    const fixture = createKernelFixture(databasePath);
    fixture.openPracticeAttempt();
    fixture.db.close();

    const result = runContinue("--minutes", "2.5", "--json");

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Available minutes must be a positive integer");
  });
});
