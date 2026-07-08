/**
 * Ingestion pipeline orchestrator.
 *
 * Pulls signals from multiple sources (job-hunter gaps, ai-feeds papers,
 * manual text, URLs) and converts them into concept proposals that can be
 * reviewed and materialized into knowledge files.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";

import {
  getSkillGaps,
  openJobHunterDb,
  type SkillGap,
} from "../integrations/job-hunter.js";

import {
  getHighScoredPapers,
  openAiFeedsDb,
  type ScoredPaper,
} from "../integrations/ai-feeds.js";

import type { ConceptMap, ConceptProposal } from "../knowledge/types.js";
import { validateConcept, type ValidationResult } from "../knowledge/validator.js";

import {
  createConcept,
  getTopic,
  upsertGap,
  upsertSignal,
} from "../db/database.js";

import { enrichConcepts, type EnrichedConcept } from "./enricher.js";
import type { LLMClient } from "../llm/client.js";

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface IngestionSource {
  type: "job-hunter" | "ai-feeds" | "manual" | "url";
  /** URL or raw text content (used for 'url' and 'manual' types). */
  data?: string;
}

export interface IngestionResult {
  topic: string;
  description: string;
  concepts: ConceptProposal[];
  gapsFilled: number;
  signalsUsed: number;
  validationErrors: string[];
}

export interface IngestionOptions {
  topic: string;
  source: IngestionSource;
  jobHunterDbPath?: string;
  aiFeedsDbPath?: string;
  aiFeedsIssuesDir?: string;
  /** User-provided raw text (for manual source type). */
  manualMaterial?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive a kebab-case concept ID from a human-readable label.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Estimate an SM-2 difficulty (1-5) from a free-form difficulty string
 * commonly found in learning resources.
 */
function difficultyFromLabel(label: string | null): number {
  if (!label) return 3;
  const lower = label.toLowerCase();
  if (lower.includes("beginner") || lower.includes("easy")) return 1;
  if (lower.includes("intermediate") || lower.includes("medium")) return 3;
  if (lower.includes("advanced") || lower.includes("hard") || lower.includes("expert")) return 5;
  return 3;
}

/**
 * Estimate study time in minutes based on difficulty.
 */
function estimatedMinutes(difficulty: number): number {
  // ~15 min per difficulty level as a baseline
  return Math.max(15, difficulty * 15);
}

/**
 * Parse user-provided material text into individual concept lines.
 * Expects one concept per line, optionally prefixed with a dash or number.
 */
function parseManualMaterial(material: string): ConceptProposal[] {
  const lines = material
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 0);

  return lines.map((line, idx) => ({
    id: slugify(line),
    title: line,
    prerequisites: idx > 0 ? [slugify(lines[idx - 1])] : [],
    difficulty: 3,
    estimatedMinutes: 45,
    source: "manual" as const,
  }));
}

// ─── Mapping Functions ───────────────────────────────────────────────────────

/**
 * Convert job-hunter skill gaps to concept proposals.
 *
 * Each gap becomes a concept with estimated difficulty based on the
 * gap's frequency (higher frequency = more in-demand = slightly lower
 * difficulty to encourage prioritization).
 */
export function mapGapsToConcepts(
  gaps: SkillGap[],
  topic: string,
): ConceptProposal[] {
  return gaps.map((gap) => {
    // Use difficulty from the first learning resource if available, else
    // derive from frequency: very frequent gaps are likely foundational (easier).
    const resourceDifficulty = gap.resources[0]?.difficulty;
    const difficulty = resourceDifficulty
      ? difficultyFromLabel(resourceDifficulty)
      : gap.frequency >= 5
        ? 2
        : gap.frequency >= 3
          ? 3
          : 4;

    return {
      id: `${slugify(topic)}-${slugify(gap.skill)}`,
      title: gap.skill,
      prerequisites: [],
      difficulty,
      estimatedMinutes: estimatedMinutes(difficulty),
      source: "job-hunter" as const,
    };
  });
}

/**
 * Convert ai-feeds papers to concept proposals.
 *
 * Uses paper title/abstract to create concept IDs and titles.
 * Estimates difficulty from relevance score (higher score = more relevant
 * to user interests, often at their level, so moderate difficulty).
 */
export function mapPapersToConcepts(
  papers: ScoredPaper[],
  topic: string,
): ConceptProposal[] {
  return papers.map((paper) => {
    // Higher relevance score suggests the paper is closely matched to the
    // user's current level. Map score bands to difficulty:
    //   score >= 9  -> difficulty 2 (well-matched, accessible)
    //   score >= 7  -> difficulty 3 (moderate stretch)
    //   score >= 5  -> difficulty 4 (challenging)
    //   else        -> difficulty 5 (advanced)
    const score = paper.relevanceScore ?? 5;
    let difficulty: number;
    if (score >= 9) difficulty = 2;
    else if (score >= 7) difficulty = 3;
    else if (score >= 5) difficulty = 4;
    else difficulty = 5;

    const title = paper.title.length > 120
      ? paper.title.slice(0, 117) + "..."
      : paper.title;

    return {
      id: `${slugify(topic)}-${slugify(title)}`,
      title,
      prerequisites: [],
      difficulty,
      estimatedMinutes: estimatedMinutes(difficulty),
      source: "ai-feeds" as const,
    };
  });
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Main entry point for the ingestion pipeline.
 *
 * Based on `source.type`, reads signals from the appropriate external source,
 * maps them to concept proposals, and returns the proposed concept map for
 * user approval.
 */
export async function ingestFromSource(
  options: IngestionOptions,
): Promise<IngestionResult> {
  const { topic, source } = options;
  let concepts: ConceptProposal[] = [];
  let gapsFilled = 0;
  let signalsUsed = 0;
  const validationErrors: string[] = [];

  switch (source.type) {
    case "job-hunter": {
      const db = openJobHunterDb(options.jobHunterDbPath);
      try {
        const gaps = getSkillGaps(db);
        concepts = mapGapsToConcepts(gaps, topic);
        gapsFilled = gaps.length;
      } finally {
        db.close();
      }
      break;
    }

    case "ai-feeds": {
      const db = openAiFeedsDb(options.aiFeedsDbPath);
      try {
        const papers = getHighScoredPapers(db);
        concepts = mapPapersToConcepts(papers, topic);
        signalsUsed = papers.length;
      } finally {
        db.close();
      }
      break;
    }

    case "manual": {
      const material = options.manualMaterial ?? source.data;
      if (!material) {
        validationErrors.push("No material provided for manual ingestion.");
        break;
      }
      concepts = parseManualMaterial(material);
      break;
    }

    case "url": {
      const url = source.data;
      if (!url) {
        validationErrors.push("No URL provided for url ingestion.");
        break;
      }
      // Fetch the URL content and parse it similarly to manual material
      try {
        const response = await fetch(url);
        if (!response.ok) {
          validationErrors.push(
            `Failed to fetch URL: ${response.status} ${response.statusText}`,
          );
          break;
        }
        const text = await response.text();
        // Strip HTML tags for a rough text extraction
        const plainText = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, "\n")
          .replace(/&[a-z]+;/gi, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        concepts = parseManualMaterial(plainText);
      } catch (err) {
        validationErrors.push(
          `Error fetching URL: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      break;
    }

    default:
      validationErrors.push(`Unknown source type: ${String(source.type)}`);
  }

  // Deduplicate by ID (keep first occurrence)
  const seen = new Set<string>();
  const deduped: ConceptProposal[] = [];
  for (const c of concepts) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      deduped.push(c);
    }
  }

  return {
    topic,
    description: `Ingested from ${source.type} — ${deduped.length} concept(s) proposed.`,
    concepts: deduped,
    gapsFilled,
    signalsUsed,
    validationErrors,
  };
}

// ─── File Generation ─────────────────────────────────────────────────────────

/**
 * Generate markdown concept files from an approved concept map.
 *
 * Creates files in `knowledgeDir/concepts/`, validates each generated file,
 * registers concepts in the database, and returns the list of created file
 * paths.
 *
 * If an LLM client is provided, concept content is enriched with full
 * educational material (summary, key points, deep dive, practice questions).
 * Otherwise, static template content is used.
 */
export async function generateConceptFiles(
  db: Database.Database,
  topicId: string,
  conceptMap: ConceptMap,
  knowledgeDir: string,
  llmClient?: LLMClient | null,
): Promise<string[]> {
  // Ensure the topic exists
  const topic = getTopic(db, topicId);
  if (!topic) {
    throw new Error(`Topic "${topicId}" does not exist.`);
  }

  const conceptsDir = join(knowledgeDir, "concepts");
  await mkdir(conceptsDir, { recursive: true });

  // Enrich concepts with LLM if client is available
  let enrichmentMap: Map<string, EnrichedConcept> | null = null;
  if (llmClient) {
    enrichmentMap = await enrichConcepts(
      llmClient,
      conceptMap.concepts,
      conceptMap.topic,
    );
  }

  const createdFiles: string[] = [];
  const allErrors: string[] = [];

  for (const proposal of conceptMap.concepts) {
    const fileName = `${proposal.id}.md`;
    const filePath = join(conceptsDir, fileName);

    // Get enriched content or use static fallback
    const enriched = enrichmentMap?.get(proposal.id);
    const tags = [slugify(conceptMap.topic)];

    const summary = enriched?.summary ?? `${proposal.title} — a concept within the ${conceptMap.topic} domain.`;
    const keyPoints = enriched?.keyPoints ?? [proposal.title];
    const deepDive = enriched?.deepDive ?? `This concept needs to be fleshed out. Source: ${proposal.source}.`;
    const practiceQuestions = enriched?.practiceQuestions ?? [`What is ${proposal.title}?`];
    const misconceptions = enriched?.misconceptions ?? [];

    // Build the markdown content
    const content = [
      "---",
      `id: "${proposal.id}"`,
      `title: "${proposal.title}"`,
      `difficulty: ${proposal.difficulty}`,
      `prerequisites: [${proposal.prerequisites.map((p) => `"${p}"`).join(", ")}]`,
      `tags: [${tags.map((t) => `"${t}"`).join(", ")}]`,
      "---",
      "",
      `## Summary`,
      "",
      summary,
      "",
      `## Key Points`,
      "",
      ...keyPoints.map((kp) => `- ${kp}`),
      "",
      `## Deep Dive`,
      "",
      deepDive,
      "",
      `## Practice Questions`,
      "",
      ...practiceQuestions.map((pq, i) => `${i + 1}. ${pq}`),
      "",
      `## Common Misconceptions`,
      "",
      ...misconceptions.map((m) => `- ${m}`),
      misconceptions.length === 0 ? `- No misconceptions documented yet.` : "",
      "",
    ].filter(Boolean).join("\n");

    // Validate the generated content
    const conceptFile = {
      frontmatter: {
        id: proposal.id,
        title: proposal.title,
        difficulty: proposal.difficulty,
        prerequisites: proposal.prerequisites,
        tags,
      },
      summary,
      keyPoints,
      deepDive,
      practiceQuestions,
      misconceptions,
    };

    const validation: ValidationResult = validateConcept(conceptFile);
    if (!validation.valid) {
      allErrors.push(
        `Validation failed for "${proposal.id}": ${validation.errors.join("; ")}`,
      );
      continue;
    }

    // Write the file
    await writeFile(filePath, content, "utf-8");
    createdFiles.push(filePath);

    // Register in the database
    createConcept(db, {
      id: proposal.id,
      topicId,
      title: proposal.title,
      difficulty: proposal.difficulty,
      prerequisites: proposal.prerequisites,
      tags,
      source: proposal.source,
      sourceId: proposal.id,
    });
  }

  if (allErrors.length > 0) {
    throw new Error(
      `Some concepts failed validation:\n${allErrors.join("\n")}`,
    );
  }

  return createdFiles;
}

// ─── Sync Functions ──────────────────────────────────────────────────────────

/**
 * Pull skill gaps from the job-hunter database and store them in the
 * tutor's `synced_gaps` table.
 *
 * @returns Number of gaps synced.
 */
export async function syncGaps(
  db: Database.Database,
  jobHunterDbPath: string,
): Promise<number> {
  const sourceDb = openJobHunterDb(jobHunterDbPath);
  try {
    const gaps = getSkillGaps(sourceDb);
    let count = 0;

    for (const gap of gaps) {
      upsertGap(db, {
        jobId: `global-${slugify(gap.skill)}`,
        skill: gap.skill,
        frequency: gap.frequency,
        source: "job-hunter",
      });
      count++;
    }

    return count;
  } finally {
    sourceDb.close();
  }
}

/**
 * Pull high-scored papers from the ai-feeds database and store them in
 * the tutor's `synced_signals` table.
 *
 * @returns Number of signals synced.
 */
export async function syncSignals(
  db: Database.Database,
  aiFeedsDbPath: string,
  minScore?: number,
): Promise<number> {
  const sourceDb = openAiFeedsDb(aiFeedsDbPath);
  try {
    const papers = getHighScoredPapers(sourceDb, minScore ?? 7);
    let count = 0;

    for (const paper of papers) {
      upsertSignal(db, {
        sourceId: paper.dedupKey,
        title: paper.title,
        url: paper.url ?? paper.pdfUrl ?? undefined,
        score: paper.relevanceScore ?? undefined,
        source: "ai-feeds",
      });
      count++;
    }

    return count;
  } finally {
    sourceDb.close();
  }
}
