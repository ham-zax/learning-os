import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { loadCodingCourses } from "../src/knowledge/courses.js";
import { loadConcept, loadManifest } from "../src/knowledge/loader.js";
import { resolveConceptFile } from "../src/knowledge/resolve-concept-file.js";
import { resolveContainedPath } from "../src/knowledge/safe-path.js";
import { getScaffoldMaterial, listScaffoldPacks } from "../src/knowledge/scaffolds.js";
import { validateManifest } from "../src/knowledge/validator.js";
import { loadKnowledgeCatalog } from "../src/onboarding/catalog.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const knowledgeRoot = join(repoRoot, "knowledge");

function verifyManagedProfilePaths(): number {
  const profilesRoot = join(repoRoot, "data", "profiles");
  if (!existsSync(profilesRoot)) return 0;

  let checked = 0;
  for (const entry of readdirSync(profilesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dbPath = join(profilesRoot, entry.name, "tutor.db");
    if (!existsSync(dbPath)) continue;

    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .prepare("SELECT id, topic_id, file_path FROM concepts WHERE file_path IS NOT NULL")
        .all() as Array<{ id: string; topic_id: string; file_path: string }>;
      for (const row of rows) {
        if (
          isAbsolute(row.file_path) ||
          /^[A-Za-z]:[\\/]/.test(row.file_path) ||
          row.file_path.includes("..")
        ) {
          throw new Error(
            `Profile ${entry.name} concept ${row.id} stores non-portable file_path: ${row.file_path}`,
          );
        }
        if (!resolveConceptFile(knowledgeRoot, row.topic_id, row.id, row.file_path)) {
          throw new Error(
            `Profile ${entry.name} concept ${row.id} file_path does not resolve: ${row.file_path}`,
          );
        }
      }
      checked += 1;
    } finally {
      db.close();
    }
  }
  return checked;
}

function main(): void {
  const catalog = loadKnowledgeCatalog(knowledgeRoot);
  if (catalog.topics.length === 0) {
    throw new Error("No curriculum topics discovered under knowledge/.");
  }

  const rootIndex = JSON.parse(
    readFileSync(join(knowledgeRoot, "manifest.json"), "utf8"),
  ) as { topics?: Array<{ id: string; conceptCount: number }> };
  const indexed = new Map(
    (rootIndex.topics ?? []).map((entry) => [entry.id, entry.conceptCount]),
  );

  let totalConcepts = 0;
  const entries = readdirSync(knowledgeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const topicDir = join(knowledgeRoot, entry.name);
    const manifestPath = join(topicDir, "manifest.json");
    if (!existsSync(manifestPath)) continue;

    const manifest = loadManifest(manifestPath);
    if (manifest.topicId !== entry.name) {
      throw new Error(`Manifest topicId ${manifest.topicId} does not match directory ${entry.name}`);
    }
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid manifest ${entry.name}: ${validation.errors.join("; ")}`);
    }
    if (indexed.get(manifest.topicId) !== manifest.concepts.length) {
      throw new Error(
        `Root knowledge/manifest.json mismatch for ${manifest.topicId}: expected ${manifest.concepts.length} concepts, got ${String(indexed.get(manifest.topicId))}`,
      );
    }

    for (const concept of manifest.concepts) {
      if (concept.file) {
        const explicit = resolveContainedPath(topicDir, concept.file);
        if (!existsSync(explicit)) {
          throw new Error(`Manifest ${manifest.topicId} concept ${concept.id} points to missing file ${concept.file}`);
        }
      }
      const resolved = resolveConceptFile(
        knowledgeRoot,
        manifest.topicId,
        concept.id,
        concept.file ? `${manifest.topicId}/${concept.file}` : null,
      );
      if (!resolved) {
        throw new Error(`Missing concept markdown for ${manifest.topicId}/${concept.id}`);
      }
      loadConcept(resolved);
      totalConcepts += 1;
    }
  }

  const courses = loadCodingCourses(knowledgeRoot, catalog);
  if (courses.length < 2) {
    throw new Error(`Expected at least 2 structured coding courses, found ${courses.length}`);
  }

  const scaffolds = listScaffoldPacks(knowledgeRoot);
  for (const pack of scaffolds) {
    getScaffoldMaterial(knowledgeRoot, pack.packId, "worked_example");
    getScaffoldMaterial(knowledgeRoot, pack.packId, "completion");
  }

  const profilesChecked = verifyManagedProfilePaths();

  console.log(
    `Curriculum verification passed (${catalog.topics.length} topics, ${totalConcepts} concepts, ${courses.length} courses, ${scaffolds.length} scaffold packs, ${profilesChecked} profile DBs).`,
  );
}

main();
