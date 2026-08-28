import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type {
  CatalogConcept,
  CatalogResolution,
  CatalogTopic,
  IntakeArea,
  KnowledgeCatalog,
} from "./types.js";
import { normalizeAreaKey } from "./types.js";

type RawManifestConcept = {
  id?: unknown;
  title?: unknown;
  prerequisites?: unknown;
  difficulty?: unknown;
  tags?: unknown;
};

type RawTopicManifest = {
  topicId?: unknown;
  topicName?: unknown;
  description?: unknown;
  concepts?: unknown;
};

function stringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].sort();
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function materialRefs(knowledgeRoot: string, topicDir: string, conceptId: string): string[] {
  const candidates = [
    join(topicDir, `${conceptId}.md`),
    join(topicDir, "concepts", `${conceptId}.md`),
  ];
  const exact = candidates.filter((path) => existsSync(path));
  if (exact.length > 0) {
    return exact.map((path) => relative(knowledgeRoot, path)).sort();
  }

  const topicIndex = join(topicDir, "INDEX.md");
  return existsSync(topicIndex) ? [relative(knowledgeRoot, topicIndex)] : [];
}

function readTopicManifest(knowledgeRoot: string, manifestPath: string): CatalogTopic {
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as RawTopicManifest;
  const topicId = requiredString(raw.topicId, `${manifestPath}: topicId`);
  const topicName = requiredString(raw.topicName, `${manifestPath}: topicName`);
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (!Array.isArray(raw.concepts)) {
    throw new Error(`${manifestPath}: concepts must be an array`);
  }

  const topicDir = dirname(manifestPath);
  const seen = new Set<string>();
  const concepts = (raw.concepts as RawManifestConcept[])
    .map((entry, index): CatalogConcept => {
      const conceptId = requiredString(entry.id, `${manifestPath}: concepts[${index}].id`);
      if (seen.has(conceptId)) throw new Error(`${manifestPath}: duplicate concept id ${conceptId}`);
      seen.add(conceptId);
      const difficulty = Number(entry.difficulty);
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
        throw new Error(`${manifestPath}: invalid difficulty for ${conceptId}`);
      }
      return {
        topicId,
        topicName,
        conceptId,
        title: requiredString(entry.title, `${manifestPath}: ${conceptId}.title`),
        prerequisites: stringArray(entry.prerequisites, `${manifestPath}: ${conceptId}.prerequisites`),
        difficulty,
        tags: stringArray(entry.tags, `${manifestPath}: ${conceptId}.tags`),
        manifestPath: relative(knowledgeRoot, manifestPath),
        materialRefs: materialRefs(knowledgeRoot, topicDir, conceptId),
      };
    })
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId));

  for (const concept of concepts) {
    for (const prerequisite of concept.prerequisites) {
      if (!seen.has(prerequisite)) {
        throw new Error(`${manifestPath}: ${concept.conceptId} references unknown prerequisite ${prerequisite}`);
      }
    }
  }

  return {
    topicId,
    topicName,
    description,
    manifestPath: relative(knowledgeRoot, manifestPath),
    concepts,
  };
}

/** Read-only snapshot of the repository knowledge catalog. No learner state is touched. */
export function loadKnowledgeCatalog(knowledgeRoot: string): KnowledgeCatalog {
  const topics: CatalogTopic[] = [];
  const seenTopicIds = new Map<string, string>();
  const seenConceptIds = new Map<string, string>();
  const entries = readdirSync(knowledgeRoot, { withFileTypes: true }) as Array<{
    name: string;
    isDirectory(): boolean;
  }>;
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(knowledgeRoot, entry.name, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const topic = readTopicManifest(knowledgeRoot, manifestPath);
    const previousTopic = seenTopicIds.get(topic.topicId);
    if (previousTopic) {
      throw new Error(
        `Duplicate catalog topic ID ${topic.topicId}: ${previousTopic} and ${topic.manifestPath}`,
      );
    }
    seenTopicIds.set(topic.topicId, topic.manifestPath);
    for (const concept of topic.concepts) {
      const previousConcept = seenConceptIds.get(concept.conceptId);
      if (previousConcept) {
        throw new Error(
          `Duplicate catalog concept ID ${concept.conceptId}: ${previousConcept} and ${topic.topicId}/${concept.conceptId}`,
        );
      }
      seenConceptIds.set(concept.conceptId, `${topic.topicId}/${concept.conceptId}`);
    }
    topics.push(topic);
  }
  return { topics: topics.sort((left, right) => left.topicId.localeCompare(right.topicId)) };
}

export function allCatalogConcepts(catalog: KnowledgeCatalog): CatalogConcept[] {
  return catalog.topics.flatMap((topic) => topic.concepts);
}

const SUGGESTION_STOP_WORDS = new Set(["a", "an", "and", "for", "of", "or", "the", "to", "vs", "with"]);

function suggestionTokens(value: string): Set<string> {
  return new Set(
    normalizeAreaKey(value)
      .split("-")
      .filter((token) => token.length >= 3 && !SUGGESTION_STOP_WORDS.has(token)),
  );
}

function suggestedCatalogConcepts(concepts: readonly CatalogConcept[], label: string): CatalogConcept[] {
  const normalized = normalizeAreaKey(label);
  const inputTokens = suggestionTokens(label);
  if (!normalized || inputTokens.size === 0) return [];

  return concepts
    .filter((concept) => {
      const conceptId = normalizeAreaKey(concept.conceptId);
      const title = normalizeAreaKey(concept.title);
      const candidateTokens = new Set([
        ...suggestionTokens(concept.conceptId),
        ...suggestionTokens(concept.title),
      ]);
      const containment = normalized.includes(conceptId) || normalized.includes(title);
      const candidateFullyNamed =
        candidateTokens.size > 0 && [...candidateTokens].every((token) => inputTokens.has(token));
      const sharedTokenCount = [...candidateTokens].filter((token) => inputTokens.has(token)).length;
      const partialOverlap =
        sharedTokenCount > 0 && inputTokens.size >= 2 && candidateTokens.size >= 2;
      return containment || candidateFullyNamed || partialOverlap;
    })
    .sort(
      (left, right) =>
        left.topicId.localeCompare(right.topicId) || left.conceptId.localeCompare(right.conceptId),
    )
    .slice(0, 5);
}

export function resolveCatalogArea(catalog: KnowledgeCatalog, area: IntakeArea): CatalogResolution {
  const concepts = allCatalogConcepts(catalog);

  if (area.topicId && area.conceptId) {
    const concept = concepts.find(
      (candidate) => candidate.topicId === area.topicId && candidate.conceptId === area.conceptId,
    );
    return concept ? { kind: "concept", concept } : { kind: "missing", suggestedConceptId: area.conceptId };
  }

  if (area.conceptId) {
    const matches = concepts.filter((candidate) => candidate.conceptId === area.conceptId);
    if (matches.length === 1) return { kind: "concept", concept: matches[0] };
    if (matches.length > 1) return { kind: "ambiguous", concepts: matches };
    return { kind: "missing", suggestedConceptId: area.conceptId };
  }

  const normalized = normalizeAreaKey(area.label);
  const conceptMatches = concepts.filter(
    (candidate) =>
      normalizeAreaKey(candidate.conceptId) === normalized ||
      normalizeAreaKey(candidate.title) === normalized,
  );
  if (conceptMatches.length === 1) return { kind: "concept", concept: conceptMatches[0] };
  if (conceptMatches.length > 1) return { kind: "ambiguous", concepts: conceptMatches };

  const topicMatches = catalog.topics.filter(
    (topic) =>
      normalizeAreaKey(topic.topicId) === normalized || normalizeAreaKey(topic.topicName) === normalized,
  );
  if (topicMatches.length === 1) return { kind: "topic", topic: topicMatches[0] };

  const suggestions = suggestedCatalogConcepts(concepts, area.label);
  if (suggestions.length > 0) return { kind: "ambiguous", concepts: suggestions };

  return { kind: "missing", suggestedConceptId: normalized || "unnamed-concept" };
}
