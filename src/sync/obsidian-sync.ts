/**
 * Obsidian vault sync for concept material plus objective-level learner state.
 *
 * Legacy scalar concept mastery/SM-2 columns are provenance only and are not
 * exported as current progress.
 */

import type Database from "better-sqlite3";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getConceptsByTopic, getTopic } from "../db/database.js";
import type { Concept, DurabilityState, Readiness, TransferState } from "../db/types.js";
import { listRevisionNotes } from "../revision-notes.js";
import type { RevisionNoteSnapshot } from "../revision-notes.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ObsidianSyncOptions {
  db: Database.Database;
  topicId: string;
  vaultPath: string;
  /** Subdirectory within vault for tutor notes. Default: "tutor" */
  subfolder?: string;
}

export interface SyncResult {
  synced: number;
  revisionNotesSynced: number;
  outputPath: string;
}

export interface ObsidianObjectiveState {
  objectiveId: string;
  capabilityId: string;
  readiness: Readiness;
  transferState: TransferState;
  durabilityState: DurabilityState;
  dueAt: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sync concept material and objective-level learner state to an Obsidian vault.
 *
 * Creates/updates concept notes with reusable metadata plus current objective
 * readiness, transfer, durability, and due state.
 *
 * @returns SyncResult with count and output path
 */
export async function syncToObsidian(options: ObsidianSyncOptions): Promise<SyncResult> {
  const { db, topicId, vaultPath, subfolder = "tutor" } = options;

  const topic = getTopic(db, topicId);
  if (!topic) {
    throw new Error(`Topic "${topicId}" not found.`);
  }

  const concepts = getConceptsByTopic(db, topicId);
  if (concepts.length === 0) {
    return { synced: 0, revisionNotesSynced: 0, outputPath: join(vaultPath, subfolder, topicId) };
  }

  const outputDir = join(vaultPath, subfolder, topicId);
  await mkdir(outputDir, { recursive: true });

  const objectiveState = loadObjectiveStateByConcept(db, topicId);

  // Write each concept as a note
  for (const concept of concepts) {
    const content = buildObsidianNote(concept, topicId, objectiveState.get(concept.id) ?? []);
    const filePath = join(outputDir, `${concept.id}.md`);
    await writeFile(filePath, content, "utf-8");
  }

  // Write profile-local revision-note snapshots that draw on this topic.
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const revisionNotes = listRevisionNotes(db).filter((note) =>
    note.sourceRefs.conceptIds.some((conceptId) => conceptIds.has(conceptId)),
  );
  if (revisionNotes.length > 0) {
    const revisionDir = join(outputDir, "_revision-notes");
    await mkdir(revisionDir, { recursive: true });
    for (const note of revisionNotes) {
      await writeFile(
        join(revisionDir, `${note.id}.md`),
        buildRevisionNoteExport(note),
        "utf-8",
      );
    }
  }

  // Write a summary/index note
  const summaryContent = buildSummaryNote(topic.name, topicId, concepts, objectiveState);
  await writeFile(join(outputDir, "_index.md"), summaryContent, "utf-8");

  return {
    synced: concepts.length,
    revisionNotesSynced: revisionNotes.length,
    outputPath: outputDir,
  };
}

/**
 * Generate Obsidian markdown for a single concept (no file write).
 */
export function buildObsidianNoteContent(
  concept: Concept,
  topicId: string,
  objectiveState: readonly ObsidianObjectiveState[] = [],
): string {
  return buildObsidianNote(concept, topicId, objectiveState);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function loadObjectiveStateByConcept(
  db: Database.Database,
  topicId: string,
): Map<string, ObsidianObjectiveState[]> {
  const rows = db
    .prepare(
      `SELECT objective.concept_id,
              objective.id AS objective_id,
              objective.capability_id,
              projection.readiness,
              projection.transfer_state,
              projection.durability_state,
              card.due_at
       FROM learning_objectives objective
       JOIN objective_projections projection ON projection.objective_id = objective.id
       JOIN concepts concept ON concept.id = objective.concept_id
       LEFT JOIN review_cards card ON card.objective_id = objective.id
       WHERE concept.topic_id = ?
       ORDER BY objective.concept_id, objective.capability_id`,
    )
    .all(topicId) as Array<{
    concept_id: string;
    objective_id: string;
    capability_id: string;
    readiness: Readiness;
    transfer_state: TransferState;
    durability_state: DurabilityState;
    due_at: string | null;
  }>;

  const result = new Map<string, ObsidianObjectiveState[]>();
  for (const row of rows) {
    const values = result.get(row.concept_id) ?? [];
    values.push({
      objectiveId: row.objective_id,
      capabilityId: row.capability_id,
      readiness: row.readiness,
      transferState: row.transfer_state,
      durabilityState: row.durability_state,
      dueAt: row.due_at,
    });
    result.set(row.concept_id, values);
  }
  return result;
}

function buildRevisionNoteExport(note: RevisionNoteSnapshot): string {
  return [
    "---",
    `revision_note_id: "${note.id}"`,
    `title: ${JSON.stringify(note.title)}`,
    `generated_at: "${note.generatedAt}"`,
    `stale: ${note.stale ? "true" : "false"}`,
    `scope_kind: "${note.scope.kind}"`,
    "---",
    "",
    note.markdown.trim(),
    "",
  ].join("\n");
}

function safeJsonParse(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildObsidianNote(
  concept: Concept,
  topicId: string,
  objectiveState: readonly ObsidianObjectiveState[],
): string {
  const conceptTags = safeJsonParse(concept.tags);
  const tags = [topicId, `difficulty/${concept.difficulty}`, ...conceptTags];
  const prerequisites = safeJsonParse(concept.prerequisites);

  const lines = [
    "---",
    `id: "${concept.id}"`,
    `title: "${concept.title}"`,
    `difficulty: ${concept.difficulty}`,
    `objective_count: ${objectiveState.length}`,
    `tags:`,
    ...[...new Set(tags)].map((tag) => `  - ${tag}`),
    "---",
    "",
    `# ${concept.title}`,
    "",
    `**Difficulty:** ${concept.difficulty}/5`,
    "",
  ];

  if (prerequisites.length > 0) {
    lines.push("## Prerequisites", "");
    for (const prereq of prerequisites) lines.push(`- [[${prereq}]]`);
    lines.push("");
  }

  lines.push("## Learning Objectives", "");
  if (objectiveState.length === 0) {
    lines.push("No objective-level learner state has been recorded yet.", "");
  } else {
    lines.push(
      "| Capability | Readiness | Transfer | Durability | Due |",
      "|---|---|---|---|---|",
    );
    for (const objective of objectiveState) {
      lines.push(
        `| ${objective.capabilityId} | ${objective.readiness} | ${objective.transferState} | ${objective.durabilityState} | ${objective.dueAt ?? "—"} |`,
      );
    }
    lines.push("");
  }

  if (conceptTags.length > 0) {
    lines.push("## Tags", "", conceptTags.map((tag) => `\`${tag}\``).join(" "), "");
  }

  return lines.join("\n");
}

function buildSummaryNote(
  topicName: string,
  topicId: string,
  concepts: Concept[],
  objectiveState: ReadonlyMap<string, readonly ObsidianObjectiveState[]>,
): string {
  const readiness = { unknown: 0, exposed: 0, guided: 0, independent: 0 };
  let totalObjectives = 0;
  for (const objectives of objectiveState.values()) {
    for (const objective of objectives) {
      readiness[objective.readiness] += 1;
      totalObjectives += 1;
    }
  }

  const lines = [
    "---",
    `topic: "${topicName}"`,
    `topic_id: "${topicId}"`,
    `total_concepts: ${concepts.length}`,
    `total_objectives: ${totalObjectives}`,
    `tags:`,
    `  - tutor`,
    `  - ${topicId}`,
    "---",
    "",
    `# ${topicName} — Progress`,
    "",
    "## Objective Readiness",
    "",
    "| Readiness | Count |",
    "|---|---:|",
    `| Unknown | ${readiness.unknown} |`,
    `| Exposed | ${readiness.exposed} |`,
    `| Guided | ${readiness.guided} |`,
    `| Independent | ${readiness.independent} |`,
    `| **Total** | **${totalObjectives}** |`,
    "",
    "## Concepts",
    "",
  ];

  for (const concept of concepts) {
    const objectives = objectiveState.get(concept.id) ?? [];
    const summary = objectives.length === 0
      ? "no objectives yet"
      : objectives.map((objective) => `${objective.capabilityId}:${objective.readiness}`).join(", ");
    lines.push(`- [[${concept.id}]] — ${concept.title} — ${summary}`);
  }
  lines.push("");

  return lines.join("\n");
}
