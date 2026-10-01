import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createProfile } from "../src/profile/index.js";
import { inspectProfileHealth } from "../src/diagnostics.js";

describe("operator diagnostics", () => {
  it("reports integrity without changing the profile or exposing learner contents", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "learning-os-doctor-"));
    try {
      createProfile({ id: "test", displayName: "Private Learner" }, { dataDir });
      const databasePath = join(dataDir, "profiles", "test", "tutor.db");
      const before = readFileSync(databasePath);
      const health = inspectProfileHealth("test", { dataDir });
      expect(health).toMatchObject({ healthy: true, profileId: "test", integrity: ["ok"], foreignKeyViolationCount: 0 });
      expect(JSON.stringify(health)).not.toContain("Private Learner");
      expect(readFileSync(databasePath)).toEqual(before);
    } finally { rmSync(dataDir, { recursive: true, force: true }); }
  });
});
