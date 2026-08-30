import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTopic } from "../src/db/database.js";
import {
  checkpointProfileDatabase,
  createProfile,
  openProfileDatabase,
  selectProfile,
} from "../src/profile/index.js";

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
});
