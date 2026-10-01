import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTopic } from "../src/db/database.js";
import { backupProfile, createProfile, listProfiles, openProfileDatabase, restoreProfile, selectProfile, getActiveProfile } from "../src/profile/index.js";

const repoRoot = resolve(".");

function child(code: string): ChildProcess {
  return spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Waits for a child, bounded by an explicit deadline.
 *
 * `once(process, "exit")` alone can hang forever when the child neither exits
 * nor errors, which wedges the worker and reports unrelated tests as failures.
 */
async function result(process: ChildProcess, timeoutMs = 30_000): Promise<{ code: number | null; stderr: string }> {
  let stderr = "";
  process.stderr!.on("data", (chunk) => { stderr += String(chunk); });
  const exited = once(process, "exit");
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`Child process exceeded its ${timeoutMs}ms budget`)), timeoutMs);
    timer.unref();
  });
  const [code] = await Promise.race([exited, timeout]) as [number | null];
  return { code, stderr };
}

describe("profile recovery and registry coordination", () => {
  let root: string;
  let dataDir: string;
  const children: ChildProcess[] = [];
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-recovery-"));
    dataDir = join(root, "data");
  });
  afterEach(async () => {
    await Promise.all(children.splice(0).map(async (process) => {
      if (process.exitCode === null && process.signalCode === null) {
        const exited = once(process, "exit");
        process.kill("SIGKILL");
        await exited;
      }
    }));
    rmSync(root, { recursive: true, force: true });
  });

  it("preserves every profile across simultaneous registry writers", async () => {
    const writers = Array.from({ length: 6 }, (_, i) => child(`
      import { createProfile } from './src/profile/index.ts';
      createProfile({ id: 'writer-${i}', displayName: 'Writer ${i}' }, {dataDir: ${JSON.stringify(dataDir)}});
    `));
    children.push(...writers);
    // `map(result)` would forward the array index as the budget, so bind it explicitly.
    const outcomes = await Promise.all(writers.map((writer) => result(writer)));
    expect(outcomes).toEqual(writers.map(() => ({ code: 0, stderr: "" })));
    expect(listProfiles({ dataDir })).toHaveLength(6);
  }, 15000);

  it("does not steal a suspended live SQLite writer lock, and releases it after a crash", async () => {
    createProfile({ id: "original", displayName: "Original" }, { dataDir });
    const holder = child(`
      import Database from 'better-sqlite3';
      const db = new Database(${JSON.stringify(join(dataDir, "profiles", "registry.json.lock.db"))});
      db.exec('BEGIN IMMEDIATE');
      console.log('locked');
      setInterval(() => {}, 1000);
    `);
    children.push(holder);
    await once(holder.stdout!, "data");
    holder.kill("SIGSTOP");
    const old = new Date(Date.now() - 60_000);
    utimesSync(join(dataDir, "profiles", "registry.json.lock.db"), old, old);
    const contender = child(`
      import { createProfile } from './src/profile/index.ts';
      createProfile({ id: 'blocked', displayName: 'Blocked' }, {dataDir: ${JSON.stringify(dataDir)}});
    `);
    children.push(contender);
    const outcome = await result(contender);
    expect(outcome.code).not.toBe(0);
    expect(outcome.stderr).toContain("database is locked");
    expect(listProfiles({ dataDir }).map((profile) => profile.id)).toEqual(["original"]);
    const exited = once(holder, "exit");
    holder.kill("SIGKILL");
    await exited;
    expect(createProfile({ id: "after-crash", displayName: "After crash" }, { dataDir }).id).toBe("after-crash");
  }, 15000);

  it("backs up committed WAL state and restores a private, new, unselected profile", async () => {
    createProfile({ id: "learner", displayName: "Learner", description: "Synthetic" }, { dataDir });
    selectProfile("learner", { dataDir });
    const db = openProfileDatabase("learner", { dataDir });
    try {
      createTopic(db, { id: "durable-goal", name: "Synthetic goal" });
      const snapshot = join(root, "snapshot");
      const backup = await backupProfile(snapshot, undefined, { dataDir });
      createTopic(db, { id: "after-backup", name: "Later goal" });
      const restored = restoreProfile(snapshot, { id: "restored", displayName: "Recovered" }, { dataDir });
      expect(backup.manifest.profile.id).toBe("learner");
      expect(getActiveProfile({ dataDir })?.id).toBe("learner");
      expect(restored.description).toBe("Synthetic");
      const recovered = openProfileDatabase(restored.id, { dataDir });
      try {
        expect(recovered.prepare("SELECT id FROM topics ORDER BY id").all()).toEqual([{ id: "durable-goal" }]);
      } finally { recovered.close(); }
      expect(statSync(snapshot).mode & 0o777).toBe(0o700);
      expect(statSync(join(snapshot, "tutor.db")).mode & 0o777).toBe(0o600);
      expect(statSync(join(dataDir, "profiles", "restored", "tutor.db")).mode & 0o777).toBe(0o600);
      expect(() => restoreProfile(snapshot, { id: "learner", displayName: "Overwrite" }, { dataDir })).toThrow("already exists");
      await expect(backupProfile(snapshot, "learner", { dataDir })).rejects.toThrow("already exists");
    } finally { db.close(); }
  });

  it("rejects altered snapshots without registering or leaving a profile directory", async () => {
    createProfile({ id: "learner", displayName: "Learner" }, { dataDir });
    const snapshot = join(root, "snapshot");
    await backupProfile(snapshot, "learner", { dataDir });
    writeFileSync(join(snapshot, "tutor.db"), "corrupted");
    expect(() => restoreProfile(snapshot, { id: "invalid", displayName: "Invalid" }, { dataDir })).toThrow("checksum mismatch");
    expect(listProfiles({ dataDir }).map((profile) => profile.id)).toEqual(["learner"]);
    expect(() => statSync(join(dataDir, "profiles", "invalid"))).toThrow();
  });

  it.each(["schema", "foreign-key"])("rejects a checksum-valid snapshot with invalid %s", async (invalid) => {
    createProfile({ id: "learner", displayName: "Learner" }, { dataDir });
    const snapshot = join(root, "snapshot");
    await backupProfile(snapshot, "learner", { dataDir });
    const path = join(snapshot, "tutor.db");
    const db = new Database(path);
    if (invalid === "schema") db.exec("DROP TABLE concepts");
    else {
      db.pragma("foreign_keys = OFF");
      db.prepare("INSERT INTO concepts (id, topic_id, title) VALUES ('orphan', 'missing', 'Orphan')").run();
    }
    db.close();
    const manifestPath = join(snapshot, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.database.sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(() => restoreProfile(snapshot, { id: "invalid", displayName: "Invalid" }, { dataDir })).toThrow();
    expect(listProfiles({ dataDir })).toHaveLength(1);
  });
});
