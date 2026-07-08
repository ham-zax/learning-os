/**
 * Job-hunter integration adapter.
 *
 * Read-only access to the job-hunter SQLite database.  Provides helpers for
 * querying job listings, applications, interview prep, learning resources,
 * and computing skill-gap analysis.
 */

import Database from "better-sqlite3";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillGap {
  skill: string;
  frequency: number; // how many saved/applied jobs mention it
  resources: LearningResource[]; // matching learning resources
}

export interface LearningResource {
  id: number;
  skill: string;
  title: string;
  url: string;
  type: string;
  provider: string;
  durationHours: number | null;
  free: boolean;
  difficulty: string | null;
}

export interface JobListing {
  uid: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  finalScore: number | null;
  tags: string[];
  status: string;
}

export interface InterviewPrep {
  id: number;
  listingUid: string;
  type: string;
  content: string;
  generatedAt: string;
  reviewed: boolean;
}

interface RawListingRow {
  uid: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  final_score: number | null;
  tags: string | null; // JSON string
  status: string;
}

interface RawInterviewPrepRow {
  id: number;
  listing_uid: string;
  type: string;
  content: string;
  generated_at: string;
  reviewed: number; // 0 or 1
}

interface RawLearningResourceRow {
  id: number;
  skill: string;
  title: string;
  url: string;
  type: string;
  provider: string;
  duration_hours: number | null;
  free: number; // 0 or 1
  difficulty: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToListing(row: RawListingRow): JobListing {
  return {
    uid: row.uid,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    description: row.description,
    finalScore: row.final_score,
    tags: parseJsonArray(row.tags),
    status: row.status,
  };
}

function rowToInterviewPrep(row: RawInterviewPrepRow): InterviewPrep {
  return {
    id: row.id,
    listingUid: row.listing_uid,
    type: row.type,
    content: row.content,
    generatedAt: row.generated_at,
    reviewed: row.reviewed === 1,
  };
}

function rowToLearningResource(row: RawLearningResourceRow): LearningResource {
  return {
    id: row.id,
    skill: row.skill,
    title: row.title,
    url: row.url,
    type: row.type,
    provider: row.provider,
    durationHours: row.duration_hours,
    free: row.free === 1,
    difficulty: row.difficulty,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open (read-only) connection to the job-hunter SQLite database.
 *
 * @param dbPath - Absolute or relative path to the `.db` file.
 *                 Defaults to `data/job_hunter.db` relative to cwd.
 */
export function openJobHunterDb(dbPath?: string): Database.Database {
  const resolved = resolve(dbPath ?? "data/job_hunter.db");
  const db = new Database(resolved, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

/**
 * Compute skill gaps from saved and applied job listings.
 *
 * Parses the `tags` JSON column across all saved/applied jobs, counts
 * frequency, and joins with `learning_resources` for matching skills.
 *
 * If `jobId` is provided the analysis is scoped to that single listing.
 */
export function getSkillGaps(db: Database.Database, jobId?: string): SkillGap[] {
  // 1. Fetch relevant listings ------------------------------------------------
  let listingRows: RawListingRow[];
  if (jobId) {
    const stmt = db.prepare(
      `SELECT uid, title, company, location, url, description,
              final_score, tags, status
         FROM listings
        WHERE uid = ? AND status IN ('saved', 'applied')`
    );
    listingRows = stmt.all(jobId) as unknown as RawListingRow[];
  } else {
    const stmt = db.prepare(
      `SELECT uid, title, company, location, url, description,
              final_score, tags, status
         FROM listings
        WHERE status IN ('saved', 'applied')`
    );
    listingRows = stmt.all() as unknown as RawListingRow[];
  }

  // 2. Count skill frequency across all matching jobs -------------------------
  const frequency = new Map<string, number>();
  for (const row of listingRows) {
    const tags = parseJsonArray(row.tags);
    for (const tag of tags) {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) continue;
      frequency.set(normalized, (frequency.get(normalized) ?? 0) + 1);
    }
  }

  if (frequency.size === 0) return [];

  // 3. Fetch all learning resources once --------------------------------------
  const allResourcesStmt = db.prepare(
    `SELECT id, skill, title, url, type, provider,
            duration_hours, free, difficulty
       FROM learning_resources`
  );
  const allResources = allResourcesStmt.all() as unknown as RawLearningResourceRow[];
  const resourcesBySkill = new Map<string, LearningResource[]>();
  for (const r of allResources) {
    const key = r.skill.trim().toLowerCase();
    const list = resourcesBySkill.get(key) ?? [];
    list.push(rowToLearningResource(r));
    resourcesBySkill.set(key, list);
  }

  // 4. Build SkillGap array --------------------------------------------------
  const gaps: SkillGap[] = [];
  for (const [skill, count] of frequency) {
    gaps.push({
      skill,
      frequency: count,
      resources: resourcesBySkill.get(skill) ?? [],
    });
  }

  // Sort by frequency descending
  gaps.sort((a, b) => b.frequency - a.frequency);
  return gaps;
}

/**
 * Return all listings whose status is "saved".
 */
export function getSavedJobs(db: Database.Database): JobListing[] {
  const stmt = db.prepare(
    `SELECT uid, title, company, location, url, description,
            final_score, tags, status
       FROM listings
      WHERE status = 'saved'
      ORDER BY final_score DESC NULLS LAST`
  );
  const rows = stmt.all() as unknown as RawListingRow[];
  return rows.map(rowToListing);
}

/**
 * Return all listings whose status is "applied".
 */
export function getAppliedJobs(db: Database.Database): JobListing[] {
  const stmt = db.prepare(
    `SELECT uid, title, company, location, url, description,
            final_score, tags, status
       FROM listings
      WHERE status = 'applied'
      ORDER BY final_score DESC NULLS LAST`
  );
  const rows = stmt.all() as unknown as RawListingRow[];
  return rows.map(rowToListing);
}

/**
 * Fetch interview prep entries for a specific listing.
 */
export function getInterviewPrep(
  db: Database.Database,
  listingUid: string
): InterviewPrep[] {
  const stmt = db.prepare(
    `SELECT id, listing_uid, type, content, generated_at, reviewed
       FROM interview_prep
      WHERE listing_uid = ?
      ORDER BY generated_at DESC`
  );
  const rows = stmt.all(listingUid) as unknown as RawInterviewPrepRow[];
  return rows.map(rowToInterviewPrep);
}

/**
 * Fetch learning resources, optionally filtered by skill name.
 */
export function getLearningResources(
  db: Database.Database,
  skill?: string
): LearningResource[] {
  if (skill) {
    const stmt = db.prepare(
      `SELECT id, skill, title, url, type, provider,
              duration_hours, free, difficulty
         FROM learning_resources
        WHERE LOWER(skill) = LOWER(?)
        ORDER BY title`
    );
    const rows = stmt.all(skill) as unknown as RawLearningResourceRow[];
    return rows.map(rowToLearningResource);
  }

  const stmt = db.prepare(
    `SELECT id, skill, title, url, type, provider,
            duration_hours, free, difficulty
       FROM learning_resources
      ORDER BY skill, title`
  );
  const rows = stmt.all() as unknown as RawLearningResourceRow[];
  return rows.map(rowToLearningResource);
}
