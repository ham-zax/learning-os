/**
 * Obsidian vault sync for tutor progress.
 *
 * Syncs mastery progress as YAML frontmatter on concept notes.
 * Creates review schedule notes in the vault.
 */

import type Database from "better-sqlite3";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getConceptsByTopic, getTopic } from "../db/database.js";
import type { Concept } from "../db/types.js";

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
  outputPath: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sync tutor progress to an Obsidian vault.
 *
 * Creates/updates markdown files with YAML frontmatter containing:
 * - Mastery status, EF, interval, next review date
 * - Tags for Obsidian's tag system
 * - Links to related concepts via wikilinks
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
    return { synced: 0, outputPath: join(vaultPath, subfolder, topicId) };
  }

  const outputDir = join(vaultPath, subfolder, topicId);
  await mkdir(outputDir, { recursive: true });

  // Write each concept as a note
  for (const concept of concepts) {
    const content = buildObsidianNote(concept, topicId);
    const filePath = join(outputDir, `${concept.id}.md`);
    await writeFile(filePath, content, "utf-8");
  }

  // Write a summary/index note
  const summaryContent = buildSummaryNote(topic.name, topicId, concepts);
  await writeFile(join(outputDir, "_index.md"), summaryContent, "utf-8");

  return { synced: concepts.length, outputPath: outputDir };
}

/**
 * Generate Obsidian markdown for a single concept (no file write).
 */
export function buildObsidianNoteContent(concept: Concept, topicId: string): string {
  return buildObsidianNote(concept, topicId);
}

// ─── Internal ────────────────────────────────────────────────────────────────

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

function buildObsidianNote(concept: Concept, topicId: string): string {
  const tags = [topicId, `status/${concept.status}`, `difficulty/${concept.difficulty}`];
  const nextReview = concept.next_review ?? "not scheduled";
  const lastGrade = concept.last_grade !== null ? String(concept.last_grade) : "none";
  const prerequisites = safeJsonParse(concept.prerequisites);
  const conceptTags = safeJsonParse(concept.tags);

  const lines = [
    "---",
    `id: "${concept.id}"`,
    `title: "${concept.title}"`,
    `difficulty: ${concept.difficulty}`,
    `status: "${concept.status}"`,
    `ef: ${concept.ef.toFixed(2)}`,
    `interval: ${concept.interval}`,
    `repetitions: ${concept.repetitions}`,
    `next_review: "${nextReview}"`,
    `last_grade: ${lastGrade}`,
    `tags:`,
    ...tags.map((t) => `  - ${t}`),
    "---",
    "",
    `# ${concept.title}`,
    "",
    `**Status:** ${concept.status}`,
    `**Difficulty:** ${concept.difficulty}/5`,
    `**Next Review:** ${nextReview}`,
    `**Easiness Factor:** ${concept.ef.toFixed(2)}`,
    `**Interval:** ${concept.interval} days`,
    "",
  ];

  // Prerequisites as wikilinks
  if (prerequisites.length > 0) {
    lines.push("## Prerequisites", "");
    for (const prereq of prerequisites) {
      lines.push(`- [[${prereq}]]`);
    }
    lines.push("");
  }

  // Tags
  if (conceptTags.length > 0) {
    lines.push("## Tags", "");
    lines.push(conceptTags.map((t) => `\`${t}\``).join(" "));
    lines.push("");
  }

  // SM-2 history
  lines.push(
    "## SM-2 State",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Easiness Factor | ${concept.ef.toFixed(2)} |`,
    `| Interval | ${concept.interval} days |`,
    `| Repetitions | ${concept.repetitions} |`,
    `| Last Grade | ${lastGrade}/5 |`,
    "",
  );

  return lines.join("\n");
}

function buildSummaryNote(topicName: string, topicId: string, concepts: Concept[]): string {
  const statusCounts = { unseen: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const c of concepts) {
    statusCounts[c.status as keyof typeof statusCounts]++;
  }

  const lines = [
    "---",
    `topic: "${topicName}"`,
    `topic_id: "${topicId}"`,
    `total_concepts: ${concepts.length}`,
    `tags:`,
    `  - tutor`,
    `  - ${topicId}`,
    "---",
    "",
    `# ${topicName} — Progress`,
    "",
    `## Overview`,
    "",
    `| Status | Count |`,
    `|--------|-------|`,
    `| Unseen | ${statusCounts.unseen} |`,
    `| Learning | ${statusCounts.learning} |`,
    `| Reviewing | ${statusCounts.reviewing} |`,
    `| Mastered | ${statusCounts.mastered} |`,
    `| **Total** | **${concepts.length}** |`,
    "",
    "## Concepts",
    "",
  ];

  // List concepts with wikilinks, grouped by status
  for (const status of ["unseen", "learning", "reviewing", "mastered"] as const) {
    const group = concepts.filter((c) => c.status === status);
    if (group.length === 0) continue;

    lines.push(`### ${status.charAt(0).toUpperCase() + status.slice(1)}`, "");
    for (const c of group) {
      const nextReview = c.next_review ? ` (due: ${c.next_review})` : "";
      lines.push(`- [[${c.id}]] — ${c.title}${nextReview}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
