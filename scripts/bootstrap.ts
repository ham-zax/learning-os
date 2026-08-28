/**
 * One-shot bootstrap: reads manifest files and initializes topics + concepts
 * in the SQLite database. Safe to re-run — skips existing records.
 *
 * Usage: npx tsx scripts/bootstrap.ts
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createDatabase } from "../src/db/database.js";
import { initializeTopic } from "../src/state.js";

const DB_PATH = resolve("./data/tutor.db");

interface RawManifest {
  topic?: string;
  topicId?: string;
  topicName?: string;
  concepts: Array<{
    id: string;
    title: string;
    difficulty?: number;
    prerequisites?: string[];
    tags?: string[];
    file?: string;
  }>;
}

/** Normalize a manifest to the format `initializeTopic` expects. */
function normalize(manifest: RawManifest): {
  topicId: string;
  topicName: string;
  concepts: Array<{
    id: string;
    title: string;
    difficulty?: number;
    prerequisites?: string[];
    tags?: string[];
  }>;
} {
  const topicId = manifest.topicId ?? manifest.topic ?? "";
  const topicName =
    manifest.topicName ??
    (topicId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "));

  const concepts = manifest.concepts.map((c) => ({
    id: c.id,
    title: c.title,
    difficulty: c.difficulty,
    prerequisites: c.prerequisites,
    tags: c.tags,
  }));

  return { topicId, topicName, concepts };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const db = createDatabase(DB_PATH);

const manifests = [
  resolve("./knowledge/manifest.json"),
  resolve("./knowledge/spring-framework/manifest.json"),
];

for (const manifestPath of manifests) {
  try {
    const raw: RawManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const { topicId, topicName, concepts } = normalize(raw);

    if (!topicId) {
      console.error(`ERROR: manifest at ${manifestPath} has no topicId/topic field`);
      continue;
    }

    // Write a temp normalized manifest so initializeTopic can consume it
    const normalized = { topicId, topicName, concepts };
    const tmpPath = `/tmp/bootstrap-${topicId}.json`;
    writeFileSync(tmpPath, JSON.stringify(normalized, null, 2));

    initializeTopic(db, topicId, tmpPath);
    console.log(`Bootstrapped: ${topicId} (${concepts.length} concepts)`);
    unlinkSync(tmpPath);
  } catch (err) {
    console.error(`Failed to bootstrap ${manifestPath}:`, err instanceof Error ? err.message : err);
  }
}

// Show final state
console.log("\n--- Final DB state ---");
const topics = db.prepare("SELECT id, name, phase FROM topics ORDER BY id").all() as Array<{ id: string; name: string; phase: number }>;
for (const t of topics) {
  const count = db.prepare("SELECT COUNT(*) as c FROM concepts WHERE topic_id = ?").get(t.id) as { c: number };
  console.log(`  ${t.id}: "${t.name}" phase=${t.phase} concepts=${count.c}`);
}

db.close();
