/**
 * Anki TSV export for tutor concepts.
 *
 * Exports concepts as tab-separated values compatible with Anki's import
 * feature. Each concept becomes a card with front (title) and back (summary).
 * SM-2 state is included as tags.
 */

import type Database from "better-sqlite3";
import { writeFile } from "node:fs/promises";
import { getConceptsByTopic } from "../db/database.js";
import type { Concept } from "../db/types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnkiCard {
  front: string;
  back: string;
  tags: string[];
}

export interface AnkiExportOptions {
  db: Database.Database;
  topicId: string;
  outputPath: string;
  includeStatus?: boolean; // default true — add status as tag
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Export concepts as Anki TSV format.
 *
 * Format: front\tback\ttags (tab-separated)
 * - front: concept title
 * - back: summary + key points
 * - tags: topic + status + difficulty
 *
 * @returns Number of cards exported
 */
export async function exportToAnki(options: AnkiExportOptions): Promise<number> {
  const { db, topicId, outputPath, includeStatus = true } = options;

  const concepts = getConceptsByTopic(db, topicId);
  if (concepts.length === 0) return 0;

  const cards: AnkiCard[] = concepts.map((c) => conceptToCard(c, topicId, includeStatus));

  const tsv = cards
    .map((card) => [
      escapeTsv(card.front),
      escapeTsv(card.back),
      card.tags.join(" "),
    ].join("\t"))
    .join("\n");

  await writeFile(outputPath, tsv, "utf-8");
  return cards.length;
}

/**
 * Export concepts as Anki TSV string (for piping or further processing).
 */
export function exportToAnkiString(
  db: Database.Database,
  topicId: string,
  includeStatus: boolean = true,
): string {
  const concepts = getConceptsByTopic(db, topicId);
  const cards = concepts.map((c) => conceptToCard(c, topicId, includeStatus));

  return cards
    .map((card) => [
      escapeTsv(card.front),
      escapeTsv(card.back),
      card.tags.join(" "),
    ].join("\t"))
    .join("\n");
}

// ─── Internal ────────────────────────────────────────────────────────────────

function conceptToCard(concept: Concept, topicId: string, includeStatus: boolean): AnkiCard {
  const tags: string[] = [topicId];

  if (includeStatus) {
    tags.push(`status::${concept.status}`);
  }

  tags.push(`difficulty::${concept.difficulty}`);

  // Parse JSON fields (DB stores as strings)
  const conceptTags: string[] = Array.isArray(concept.tags) ? concept.tags : safeJsonParse(concept.tags as unknown as string);
  const prerequisites: string[] = Array.isArray(concept.prerequisites) ? concept.prerequisites : safeJsonParse(concept.prerequisites as unknown as string);

  // Add tags from concept
  for (const tag of conceptTags) {
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  // Build back content from available fields
  const backParts: string[] = [];
  if (concept.file_path) {
    backParts.push(`See: ${concept.file_path}`);
  }
  if (prerequisites.length > 0) {
    backParts.push(`Prerequisites: ${prerequisites.join(", ")}`);
  }
  backParts.push(`EF: ${concept.ef.toFixed(2)} | Interval: ${concept.interval}d`);

  return {
    front: concept.title,
    back: backParts.join("\n"),
    tags,
  };
}

function safeJsonParse(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escapeTsv(text: string): string {
  // Anki TSV: replace tabs and newlines with spaces
  return text.replace(/[\t\n\r]/g, " ").trim();
}
