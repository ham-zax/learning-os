import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTopic } from "../src/db/database.js";
import {
  checkpointProfileDatabase,
  createProfile,
  openProfileDatabase,
  selectProfile,
} from "../src/profile/index.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const cliPath = join(repoRoot, "src", "cli.ts");

describe("profile database checkpoint", () => {
  let root: string;
  let dataDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-checkpoint-"));
    dataDir = join(root, "data");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("checkpoints a named canonical profile and reports integrity", () => {
    const profile = createProfile(
      { id: "learner", displayName: "Learner" },
      { dataDir },
    );
    const db = openProfileDatabase(profile.id, { dataDir });
    createTopic(db, { id: "goal", name: "Goal" });
    db.close();

    expect(checkpointProfileDatabase(profile.id, { dataDir })).toMatchObject({
      profile: { id: profile.id },
      databasePath: join(dataDir, "profiles", profile.id, "tutor.db"),
      integrity: "ok",
      walFramesRemaining: 0,
    });
  });

  it("uses the active profile when no profile ID is supplied", () => {
    const profile = createProfile(
      { id: "active", displayName: "Active Learner" },
      { dataDir },
    );
    selectProfile(profile.id, { dataDir });

    expect(checkpointProfileDatabase(undefined, { dataDir }).profile.id).toBe(profile.id);
  });

  it("rejects an unknown profile", () => {
    expect(() => checkpointProfileDatabase("missing", { dataDir })).toThrow(
      "Profile not found: missing",
    );
  });

  it("checkpoints a profile through the CLI", () => {
    const profile = createProfile(
      { id: "cli-learner", displayName: "CLI Learner" },
      { dataDir },
    );
    selectProfile(profile.id, { dataDir });

    const result = spawnSync(
      tsxBin,
      [cliPath, "profile", "checkpoint", profile.id],
      { cwd: root, encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`Checkpointed profile ${profile.id}`);
    expect(result.stdout).toContain("Integrity: ok");
    expect(result.stdout).toContain("WAL frames remaining: 0");
  });
});
