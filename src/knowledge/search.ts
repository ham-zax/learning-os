/**
 * Concept search — find related concepts by query string.
 *
 * Queries the tutor's SQLite concepts table using title, tags, and
 * prerequisite matching. No external dependencies beyond the DB layer.
 */

import type Database from "better-sqlite3";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  conceptId: string;
  title: string;
  score: number;
  matchReason: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search for concepts matching a query string.
 *
 * Matching strategy:
 * 1. Exact title match (highest score)
 * 2. Title contains query (medium score)
 * 3. Tag match (medium score)
 * 4. Prerequisite relationship (lower score — finds concepts that have
 *    the query concept as a prerequisite, or that are prerequisites of it)
 *
 * @param db       Tutor database instance
 * @param topicId  Scope search to this topic
 * @param query    Free-text search query
 * @param limit    Max results (default 10)
 */
export function searchConcepts(
  db: Database.Database,
  topicId: string,
  query: string,
  limit: number = 10,
): SearchResult[] {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [];

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // 1. Exact title match
  const exactRows = db
    .prepare(
      `SELECT id, title, tags, prerequisites FROM concepts
       WHERE topic_id = ? AND LOWER(title) = ?`,
    )
    .all(topicId, normalized) as Array<{
    id: string;
    title: string;
    tags: string;
    prerequisites: string;
  }>;

  for (const row of exactRows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      results.push({
        conceptId: row.id,
        title: row.title,
        score: 1.0,
        matchReason: "exact title match",
      });
    }
  }

  // 2. Title contains query
  const titleRows = seen.size > 0
    ? db.prepare(
        `SELECT id, title FROM concepts
         WHERE topic_id = ? AND LOWER(title) LIKE ? AND id NOT IN (${Array.from(seen).map(() => "?").join(",")})`,
      ).all(topicId, `%${normalized}%`, ...seen) as Array<{ id: string; title: string }>
    : db.prepare(
        `SELECT id, title FROM concepts
         WHERE topic_id = ? AND LOWER(title) LIKE ?`,
      ).all(topicId, `%${normalized}%`) as Array<{ id: string; title: string }>;

  for (const row of titleRows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      results.push({
        conceptId: row.id,
        title: row.title,
        score: 0.8,
        matchReason: "title contains query",
      });
    }
  }

  // 3. Tag match — parse JSON tags array and check for substring match
  const allRows = seen.size > 0
    ? db.prepare(
        `SELECT id, title, tags, prerequisites FROM concepts
         WHERE topic_id = ? AND id NOT IN (${Array.from(seen).map(() => "?").join(",")})`,
      ).all(topicId, ...seen) as Array<{ id: string; title: string; tags: string; prerequisites: string }>
    : db.prepare(
        `SELECT id, title, tags, prerequisites FROM concepts WHERE topic_id = ?`,
      ).all(topicId) as Array<{ id: string; title: string; tags: string; prerequisites: string }>;

  for (const row of allRows) {
    if (seen.has(row.id)) continue;
    try {
      const tags: string[] = JSON.parse(row.tags);
      const tagMatch = tags.some((t) => t.toLowerCase().includes(normalized));
      if (tagMatch) {
        seen.add(row.id);
        results.push({
          conceptId: row.id,
          title: row.title,
          score: 0.6,
          matchReason: "tag match",
        });
      }
    } catch {
      // skip malformed tags
    }
  }

  // 4. Prerequisite relationship — find concepts that reference the query in their prerequisites
  for (const row of allRows) {
    if (seen.has(row.id)) continue;
    try {
      const prereqs: string[] = JSON.parse(row.prerequisites);
      const prereqMatch = prereqs.some((p) => p.toLowerCase().includes(normalized));
      if (prereqMatch) {
        seen.add(row.id);
        results.push({
          conceptId: row.id,
          title: row.title,
          score: 0.4,
          matchReason: "prerequisite relationship",
        });
      }
    } catch {
      // skip malformed prerequisites
    }
  }

  // Sort by score descending, then alphabetically
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return results.slice(0, limit);
}

/**
 * Find concepts related to a given concept (by shared tags or prerequisites).
 *
 * Useful for suggesting related material during a tutoring session.
 */
export function findRelatedConcepts(
  db: Database.Database,
  conceptId: string,
  limit: number = 5,
): SearchResult[] {
  const concept = db
    .prepare(`SELECT id, title, topic_id, tags, prerequisites FROM concepts WHERE id = ?`)
    .get(conceptId) as {
    id: string;
    title: string;
    topic_id: string;
    tags: string;
    prerequisites: string;
  } | undefined;

  if (!concept) return [];

  const results: SearchResult[] = [];
  const seen = new Set<string>([conceptId]);

  let tags: string[] = [];
  let prereqs: string[] = [];
  try { tags = JSON.parse(concept.tags); } catch { /* ok */ }
  try { prereqs = JSON.parse(concept.prerequisites); } catch { /* ok */ }

  // Find concepts with overlapping tags
  const allRows = db
    .prepare(
      `SELECT id, title, tags, prerequisites FROM concepts
       WHERE topic_id = ? AND id != ?`,
    )
    .all(concept.topic_id, conceptId) as Array<{
    id: string;
    title: string;
    tags: string;
    prerequisites: string;
  }>;

  for (const row of allRows) {
    if (seen.has(row.id)) continue;
    let rowTags: string[] = [];
    let rowPrereqs: string[] = [];
    try { rowTags = JSON.parse(row.tags); } catch { /* ok */ }
    try { rowPrereqs = JSON.parse(row.prerequisites); } catch { /* ok */ }

    // Tag overlap
    const sharedTags = tags.filter((t) => rowTags.includes(t));
    if (sharedTags.length > 0) {
      seen.add(row.id);
      results.push({
        conceptId: row.id,
        title: row.title,
        score: 0.5 + sharedTags.length * 0.1,
        matchReason: `shared tags: ${sharedTags.join(", ")}`,
      });
      continue;
    }

    // Prerequisite chain: this concept's prereqs or dependents
    if (prereqs.includes(row.id) || rowPrereqs.includes(conceptId)) {
      seen.add(row.id);
      results.push({
        conceptId: row.id,
        title: row.title,
        score: 0.7,
        matchReason: "prerequisite relationship",
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
