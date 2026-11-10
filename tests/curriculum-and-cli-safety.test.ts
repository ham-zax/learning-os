import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import {
  createConcept,
  createDatabase,
  createTopic,
  getConceptsByTopic,
  updateConcept,
} from "../src/db/database.js";
import { ingestFromSource } from "../src/ingest/orchestrator.js";
import { createLearningObjective } from "../src/kernel/foundation.js";
import {
  PACKAGED_KNOWLEDGE_DIR,
  portableKnowledgeRef,
  resolveConceptFile,
  resolveKnowledgeDir,
} from "../src/knowledge/resolve-concept-file.js";
import { validateManifest } from "../src/knowledge/validator.js";
import { loadKnowledgeCatalog } from "../src/onboarding/catalog.js";
import { getRevisionNoteContext } from "../src/revision-notes.js";
import { initializeTopic } from "../src/state.js";
import { exportToAnkiString } from "../src/sync/anki-export.js";
import { runSync } from "./helpers/spawn.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const knowledgeRoot = join(repoRoot, "knowledge");
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const cliPath = join(repoRoot, "src", "cli.ts");

const directories: string[] = [];
const databases: Database.Database[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "curriculum-cli-safety-"));
  directories.push(dir);
  return dir;
}

function memoryDb(): Database.Database {
  const db = createDatabase(":memory:");
  databases.push(db);
  return db;
}

afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("curriculum portability, CLI error handling, ingest bounds, and Anki export", () => {
  it("normalizes foreign checkout paths and resolves concept files across layouts", () => {
    expect(
      portableKnowledgeRef(
        "/home/hamza/repo/learning-os/knowledge/backend-systems/concepts/idempotency-and-retry-safety.md",
      ),
    ).toBe("backend-systems/concepts/idempotency-and-retry-safety.md");

    expect(
      portableKnowledgeRef(
        "C:\\Users\\alice\\learning-os\\knowledge\\foundry\\concepts\\gas-optimization.md",
      ),
    ).toBe("foundry/concepts/gas-optimization.md");

    const resolvedBackend = resolveConceptFile(
      knowledgeRoot,
      "backend-systems",
      "architecture-boundaries-and-scaling",
      "/home/hamza/repo/learning-os/knowledge/backend-systems/concepts/architecture-boundaries-and-scaling.md",
    );
    expect(resolvedBackend).toBe(
      join(knowledgeRoot, "backend-systems", "concepts", "architecture-boundaries-and-scaling.md"),
    );

    const resolvedCodingInterview = resolveConceptFile(
      knowledgeRoot,
      "coding-interview",
      "arrays-hashing",
      null,
    );
    expect(resolvedCodingInterview).toBe(
      join(knowledgeRoot, "coding-interview", "arrays-hashing", "concept.md"),
    );
  });

  it("falls back to packaged knowledge directory when cwd lacks ./knowledge and rejects symlink escapes", () => {
    const emptyWorkspace = tempDir();
    expect(resolveKnowledgeDir(undefined, emptyWorkspace)).toBe(resolve(PACKAGED_KNOWLEDGE_DIR));

    const customKnowledge = join(emptyWorkspace, "knowledge");
    const outside = tempDir();
    mkdirSync(join(customKnowledge, "topic"), { recursive: true });
    writeFileSync(join(outside, "secret.md"), "# secret\n");
    symlinkSync(outside, join(customKnowledge, "topic", "concepts"));

    expect(() =>
      resolveConceptFile(customKnowledge, "topic", "secret", "topic/concepts/secret.md"),
    ).toThrow(/Symlink/i);
  });

  it("initializes all 9 repository curriculum topics with portable concept file_paths and catalog materialRefs", () => {
    const catalog = loadKnowledgeCatalog(knowledgeRoot);
    const topicIds = catalog.topics.map((topic) => topic.topicId).sort();
    expect(topicIds).toEqual([
      "backend-systems",
      "coding-interview",
      "foundry",
      "frontend-revision",
      "kubernetes",
      "llm",
      "spring-framework",
      "system-design",
      "trader",
    ]);

    for (const topic of catalog.topics) {
      expect(topic.concepts.length).toBeGreaterThan(0);
      for (const concept of topic.concepts) {
        expect(concept.materialRefs.length).toBeGreaterThan(0);
      }

      const db = memoryDb();
      initializeTopic(
        db,
        topic.topicId,
        join(knowledgeRoot, topic.topicId, "manifest.json"),
      );

      const stored = getConceptsByTopic(db, topic.topicId);
      expect(stored).toHaveLength(topic.concepts.length);
      for (const concept of stored) {
        expect(concept.file_path).toBeTruthy();
        expect(isAbsolute(concept.file_path!)).toBe(false);
        expect(concept.file_path!.startsWith(`${topic.topicId}/`)).toBe(true);
        expect(
          resolveConceptFile(knowledgeRoot, topic.topicId, concept.id, concept.file_path),
        ).toBeTruthy();
      }
    }
  });

  it("exits cleanly with status 1 and no unhandled stack trace when no profile is selected", () => {
    const workspace = tempDir();
    for (const args of [["stats"], ["due"], ["continue", "missing-goal"]]) {
      const result = runSync(tsxBin, [cliPath, ...args], {
        cwd: workspace,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/No learner profile is selected/);
      expect(result.stderr).not.toMatch(/at openProfileDatabase/);
    }
  });

  it("bounds manual ingestion slugs, skips punctuation-only lines, and deduplicates prerequisites", async () => {
    const longHeading = `# ${"distributed consensus protocol verification ".repeat(5)}`;
    const material = [
      "---",
      "***",
      "# Retries and Backoff",
      "# Retries and Backoff",
      longHeading,
      "- Idempotency Keys",
    ].join("\n");

    const result = await ingestFromSource({
      topic: "resilience",
      source: { type: "manual", data: material },
    });

    expect(result.validationErrors).toEqual([]);
    expect(result.concepts.map((concept) => concept.id)).toHaveLength(3);
    for (const concept of result.concepts) {
      expect(concept.id.length).toBeGreaterThan(0);
      expect(concept.id.length).toBeLessThanOrEqual(80);
      expect(concept.id).not.toMatch(/^-|-$/);
    }

    const validation = validateManifest({
      topicId: "resilience",
      topicName: "Resilience",
      concepts: result.concepts.map((concept) => ({
        id: concept.id,
        title: concept.title,
        prerequisites: concept.prerequisites,
        difficulty: concept.difficulty,
      })),
    });
    expect(validation.valid).toBe(true);
  });

  it("sanitizes Anki tag whitespace and strips foreign host prefixes from exported and revision-note refs", () => {
    const db = memoryDb();
    createTopic(db, { id: "backend-systems", name: "Backend Systems" });
    createConcept(db, {
      id: "idempotency",
      topicId: "backend-systems",
      title: "Idempotency",
      difficulty: 3,
      tags: ["distributed systems", "retry\tsafety", "clean-tag"],
    });
    updateConcept(db, "idempotency", {
      file_path:
        "/home/hamza/repo/learning-os/knowledge/backend-systems/concepts/idempotency-and-retry-safety.md",
    });

    const tsv = exportToAnkiString(db, "backend-systems");
    const columns = tsv.split("\t");
    expect(columns).toHaveLength(3);
    expect(columns[1]).toContain(
      "See: backend-systems/concepts/idempotency-and-retry-safety.md",
    );
    expect(columns[1]).not.toContain("/home/hamza/");
    const tags = columns[2]!.split(" ");
    expect(tags).toContain("distributed-systems");
    expect(tags).toContain("retry-safety");
    expect(tags).toContain("clean-tag");

    createLearningObjective(db, {
      id: "idempotency:explain",
      conceptId: "idempotency",
      capabilityId: "explain",
      title: "Explain idempotency",
    });
    const bundle = getRevisionNoteContext(db, {
      scope: { kind: "objective", objectiveId: "idempotency:explain" },
    });
    expect(bundle.knowledgeRefs).toEqual([
      expect.objectContaining({
        conceptId: "idempotency",
        filePath: "backend-systems/concepts/idempotency-and-retry-safety.md",
      }),
    ]);
  });
});
