/**
 * Adapter for reading the ai-feeds SQLite database and markdown issues.
 *
 * Read-only access to scored papers, user interactions, and learning-issue
 * markdown files from the ai-feeds ecosystem.
 */

import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScoredPaper {
  dedupKey: string;
  id: string;
  title: string;
  abstract: string | null;
  url: string | null;
  pdfUrl: string | null;
  authors: string[];
  categories: string[];
  primaryCategory: string | null;
  published: string | null;
  relevanceScore: number | null;
  scoreExplanation: string | null;
  scoreInterests: string[];
}

export interface LearningIssue {
  title: string;
  filePath: string;
  content: string;
}

// ─── Raw DB row (matches papers table schema) ────────────────────────────────

interface PaperRow {
  dedup_key: string;
  id: string;
  title: string;
  abstract: string | null;
  url: string | null;
  pdf_url: string | null;
  authors: string; // JSON
  categories: string; // JSON
  primary_category: string | null;
  published: string | null;
  updated: string | null;
  sources: string | null; // JSON
  source_ids: string | null; // JSON
  relevance_score: number | null;
  score_explanation: string | null;
  scored_at: string | null;
  score_interests: string | null; // JSON
  first_seen_at: string | null;
  updated_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToScoredPaper(row: PaperRow): ScoredPaper {
  return {
    dedupKey: row.dedup_key,
    id: row.id,
    title: row.title,
    abstract: row.abstract,
    url: row.url,
    pdfUrl: row.pdf_url,
    authors: parseJsonArray(row.authors),
    categories: parseJsonArray(row.categories),
    primaryCategory: row.primary_category,
    published: row.published,
    relevanceScore: row.relevance_score,
    scoreExplanation: row.score_explanation,
    scoreInterests: parseJsonArray(row.score_interests),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Open the ai-feeds SQLite database in read-only mode.
 *
 * @param dbPath - Path to the sqlite file. Defaults to `db/ai-feeds.sqlite`
 *                 relative to the ai-feeds project root (resolved from cwd).
 */
export function openAiFeedsDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? "db/ai-feeds.sqlite";
  const db = new Database(resolvedPath, { readonly: true });
  return db;
}

/**
 * Fetch papers with a relevance score at or above the threshold.
 *
 * Parses JSON fields (authors, categories, score_interests) into arrays.
 * Results are sorted by relevance_score descending.
 *
 * @param minScore - Minimum relevance score (inclusive). Default 7.
 */
export function getHighScoredPapers(
  db: Database.Database,
  minScore = 7,
): ScoredPaper[] {
  const stmt = db.prepare(
    `SELECT * FROM papers
     WHERE relevance_score >= @minScore
     ORDER BY relevance_score DESC`,
  );
  const rows = stmt.all({ minScore }) as PaperRow[];
  return rows.map(rowToScoredPaper);
}

/**
 * Read learning-issue markdown files from a directory.
 *
 * Each .md file is expected to have YAML frontmatter with at least a `title`
 * field. The body is everything after the closing `---` of the frontmatter.
 */
export function getLearningIssues(issuesDir: string): LearningIssue[] {
  const files = readdirSync(issuesDir).filter((f) => f.endsWith(".md"));

  const issues: LearningIssue[] = [];

  for (const file of files) {
    const filePath = join(issuesDir, file);
    const raw = readFileSync(filePath, "utf-8");

    // Split frontmatter from body
    const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!frontmatterMatch) {
      // No frontmatter — treat entire file as content, use filename as title
      issues.push({
        title: file.replace(/\.md$/, ""),
        filePath,
        content: raw,
      });
      continue;
    }

    const frontmatter = parseYaml(frontmatterMatch[1]) as Record<
      string,
      unknown
    >;
    const body = raw.slice(frontmatterMatch[0].length);

    issues.push({
      title:
        typeof frontmatter.title === "string"
          ? frontmatter.title
          : file.replace(/\.md$/, ""),
      filePath,
      content: body,
    });
  }

  return issues;
}

/**
 * Fetch recent papers from the last N days that meet a minimum score.
 *
 * Uses `first_seen_at` to determine recency. Papers without a timestamp
 * are excluded.
 *
 * @param days - Number of days to look back. Default 7.
 * @param minScore - Minimum relevance score (inclusive). Default 5.
 */
export function getRecentPapers(
  db: Database.Database,
  days = 7,
  minScore = 5,
): ScoredPaper[] {
  const stmt = db.prepare(
    `SELECT * FROM papers
     WHERE first_seen_at >= @cutoff
       AND relevance_score >= @minScore
     ORDER BY relevance_score DESC`,
  );

  const cutoff = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rows = stmt.all({ cutoff, minScore }) as PaperRow[];
  return rows.map(rowToScoredPaper);
}
