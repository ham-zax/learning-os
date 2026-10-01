import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import yaml from "yaml";
import { createDatabase, createTopic, createConcept, getConcept, getTopic } from "../src/db/database.js";
import { initializeTopic } from "../src/state.js";
import { generateConceptFiles } from "../src/ingest/orchestrator.js";
import { loadConcept, loadManifest } from "../src/knowledge/loader.js";
import { validateManifest } from "../src/knowledge/validator.js";
import { resolveContainedPath } from "../src/knowledge/safe-path.js";
import { loadKnowledgeCatalog } from "../src/onboarding/catalog.js";
import { syncToObsidian } from "../src/sync/obsidian-sync.js";
import type { ConceptMap } from "../src/knowledge/types.js";

const directories: string[] = [];
const databases: Database.Database[] = [];
function root(): string { const dir = mkdtempSync(join(tmpdir(), "curriculum-safety-")); directories.push(dir); return dir; }
function database(): Database.Database { const db = createDatabase(":memory:"); databases.push(db); return db; }
function entry(id: string, prerequisites: string[] = []) { return { id, title: id, difficulty: 2, prerequisites }; }
function manifest(dir: string, concepts = [entry("first")]): string {
  const target = join(dir, "manifest.json");
  writeFileSync(target, JSON.stringify({ topicId: "topic", topicName: "Topic", concepts }));
  return target;
}
function conceptMap(ids = ["first"]): ConceptMap {
  return { topic: "Topic", description: "Test", concepts: ids.map((id) => ({ ...entry(id), estimatedMinutes: 10, source: "manual" })) };
}
afterEach(() => { databases.splice(0).forEach((db) => db.close()); directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });

describe("curriculum mutation safety", () => {
  it("loads canonical manifests without requiring obsolete fields or file declarations", () => {
    const parsed = loadManifest(manifest(root()));
    expect(parsed.topicId).toBe("topic");
    expect(validateManifest(parsed).valid).toBe(true);
  });

  it.each([
    [entry("first"), entry("second", ["missing"])],
    [entry("first", ["second"]), entry("second", ["first"])],
    [entry("first"), entry("../escape")],
    [entry("first"), entry("second", ["first", 42 as unknown as string])],
  ])("rejects invalid curricula before any mutation (%j)", (...concepts) => {
    const db = database();
    expect(() => initializeTopic(db, "topic", manifest(root(), concepts))).toThrow();
    expect(getTopic(db, "topic")).toBeUndefined();
    expect(getConcept(db, "first")).toBeUndefined();
  });

  it("checks global ownership before adding a topic or earlier entries", () => {
    const db = database();
    createTopic(db, { id: "other", name: "Other" });
    createConcept(db, { id: "second", topicId: "other", title: "Second" });
    expect(() => initializeTopic(db, "topic", manifest(root(), [entry("first"), entry("second")]))).toThrow(/already belongs/);
    expect(getTopic(db, "topic")).toBeUndefined();
    expect(getConcept(db, "first")).toBeUndefined();
  });

  it("rolls back all DB initialization on insertion failure", () => {
    const db = database();
    db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON concepts WHEN NEW.id = 'second' BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    expect(() => initializeTopic(db, "topic", manifest(root(), [entry("first"), entry("second")]))).toThrow(/test failure/);
    expect(getTopic(db, "topic")).toBeUndefined();
    expect(getConcept(db, "first")).toBeUndefined();
  });

  it("never overwrites an existing generated lesson", async () => {
    const db = database(); createTopic(db, { id: "topic", name: "Topic" });
    const dir = root(); mkdirSync(join(dir, "topic", "concepts"), { recursive: true });
    const target = join(dir, "topic", "concepts", "first.md"); writeFileSync(target, "original");
    await expect(generateConceptFiles(db, "topic", conceptMap(), dir)).rejects.toThrow(/already exists/);
    expect(readFileSync(target, "utf8")).toBe("original");
    expect(getConcept(db, "first")).toBeUndefined();
  });

  it("rejects duplicates and traversal before creating files", async () => {
    const db = database(); createTopic(db, { id: "topic", name: "Topic" });
    const dir = root();
    createConcept(db, { id: "second", topicId: "topic", title: "Existing" });
    await expect(generateConceptFiles(db, "topic", conceptMap(["first", "second"]), dir)).rejects.toThrow();
    await expect(generateConceptFiles(db, "topic", conceptMap(["../escape"]), dir)).rejects.toThrow();
    expect(existsSync(join(dir, "topic"))).toBe(false);
  });

  it("uses discoverable topic paths, persists material paths and round trips quoted YAML", async () => {
    const db = database(); createTopic(db, { id: "topic", name: "Topic" });
    const dir = root(); const map = conceptMap();
    map.concepts[0].title = 'A "quoted": title\nwith another line';
    const files = await generateConceptFiles(db, "topic", map, dir);
    expect(files).toEqual([join(dir, "topic", "concepts", "first.md")]);
    expect(getConcept(db, "first")!.file_path).toBe(files[0]);
    expect(loadConcept(files[0]).frontmatter.title).toBe(map.concepts[0].title);
  });

  it("rolls back generated files and all concept rows on DB failure", async () => {
    const db = database(); createTopic(db, { id: "topic", name: "Topic" });
    db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON concepts WHEN NEW.id = 'second' BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    const dir = root();
    await expect(generateConceptFiles(db, "topic", conceptMap(["first", "second"]), dir)).rejects.toThrow(/test failure/);
    expect(getConcept(db, "first")).toBeUndefined();
    expect(existsSync(join(dir, "topic", "concepts", "first.md"))).toBe(false);
    expect(existsSync(join(dir, "topic", "concepts", "second.md"))).toBe(false);
  });

  it("rejects symlink escapes for generation, catalog material and export", async () => {
    const db = database(); createTopic(db, { id: "topic", name: "Topic" });
    const dir = root(); const outside = root(); mkdirSync(join(dir, "topic"));
    symlinkSync(outside, join(dir, "topic", "concepts"));
    manifest(join(dir, "topic"));
    await expect(generateConceptFiles(db, "topic", conceptMap(), dir)).rejects.toThrow(/Symlink/);
    expect(() => loadKnowledgeCatalog(dir)).toThrow(/Symlink/);
    createConcept(db, { id: "first", topicId: "topic", title: "First" });
    const vault = root(); mkdirSync(join(vault, "tutor")); symlinkSync(outside, join(vault, "tutor", "topic"));
    await expect(syncToObsidian({ db, topicId: "topic", vaultPath: vault })).rejects.toThrow(/Symlink/);
    expect(existsSync(join(outside, "first.md"))).toBe(false);
  });

  it("rejects traversal export IDs and serializes arbitrary titles as YAML", async () => {
    const db = database(); createTopic(db, { id: "topic", name: 'Topic "quoted"' });
    createConcept(db, { id: "first", topicId: "topic", title: 'Title "quoted": value' });
    const vault = root();
    await expect(syncToObsidian({ db, topicId: "topic", vaultPath: vault, subfolder: "../escape" })).rejects.toThrow(/escapes/);
    await syncToObsidian({ db, topicId: "topic", vaultPath: vault });
    const raw = readFileSync(join(vault, "tutor", "topic", "first.md"), "utf8");
    expect(yaml.parse(raw.split("---")[1]).title).toBe('Title "quoted": value');
    createConcept(db, { id: "../escape", topicId: "topic", title: "Unsafe" });
    await expect(syncToObsidian({ db, topicId: "topic", vaultPath: vault })).rejects.toThrow(/safe path component/);
  });

  it("handles unknown prerequisites as validation errors", () => {
    const parsed = loadManifest(manifest(root(), [entry("first", ["missing"])]));
    expect(validateManifest(parsed).errors.join(" ")).toMatch(/does not exist/);
  });

  it("rejects existing symlink targets and lexical escapes", () => {
    const dir = root(); const outside = root(); symlinkSync(outside, join(dir, "link"));
    expect(() => resolveContainedPath(dir, "link/file.md")).toThrow(/Symlink/);
    expect(() => resolveContainedPath(dir, "../escape.md")).toThrow(/escapes/);
  });
});
