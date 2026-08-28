import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import {
  ConceptFile,
  ConceptFrontmatter,
  ConceptFrontmatterSchema,
  Manifest,
  ManifestSchema,
} from './types.js';

// ---------------------------------------------------------------------------
// Section helpers
// ---------------------------------------------------------------------------

/** Known section headings we extract from concept markdown files. */
/**
 * Heading aliases per typed field.  Topic packs use different section
 * vocabularies — `knowledge/llm` and `knowledge/kubernetes` use
 * "Summary"/"Key Points"/"Gotchas", `knowledge/system-design` uses
 * "Definition"/"Key Terms"/"Interview Questions" — so each field accepts
 * several headings and takes the first one present.
 */
const SECTION_ALIASES = {
  summary: ['Summary', 'Definition', 'Overview'],
  keyPoints: ['Key Points', 'Key Terms'],
  deepDive: ['Deep Dive', 'Why It Matters'],
  practiceQuestions: ['Practice Questions', 'Interview Questions'],
  misconceptions: ['Common Misconceptions', 'Gotchas'],
} as const;

type SectionName = string;

/**
 * Split a markdown body (everything after the frontmatter) into a map keyed by
 * section heading name, in document order.  The heading line itself is
 * stripped.  Every `##` section is captured so callers can display sections
 * this loader has no typed field for.
 */
function splitSections(body: string): Map<SectionName, string> {
  const sections = new Map<SectionName, string>();
  const headingRegex = /^## (.+)$/gm;

  const headings: { name: SectionName; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(body)) !== null) {
    headings.push({ name: match[1].trim(), index: match.index });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const sectionLineEnd = body.indexOf('\n', start);
    const contentStart = sectionLineEnd === -1 ? start : sectionLineEnd + 1;
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    sections.set(headings[i].name, body.slice(contentStart, end).trim());
  }

  return sections;
}

/** Return the text of the first `# ` heading in a body, if there is one. */
function extractTitle(body: string): string | undefined {
  const match = /^# (.+)$/m.exec(body);
  return match ? match[1].trim() : undefined;
}

/**
 * Parse a markdown list into an array of strings.  Accepts bulleted (`- `,
 * `* `) and numbered (`1. `) items, since topic packs use both — numbered
 * lists are the norm for question sections.
 */
function parseListItems(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .map((line) => /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line)?.[1]?.trim() ?? '')
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

/**
 * Split a file's raw text into frontmatter YAML and the remaining body.
 * Returns `[yamlString, bodyString]`.  If no frontmatter delimiters are found
 * the entire content is treated as the body and yaml is an empty string.
 */
function splitFrontmatter(raw: string): [string, string] {
  const trimmed = raw.replace(/^﻿/, ''); // strip BOM
  if (!trimmed.startsWith('---')) return ['', trimmed];

  const endIndex = trimmed.indexOf('\n---', 3);
  if (endIndex === -1) return ['', trimmed];

  const yamlStr = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 4).trim(); // skip past `\n---`
  return [yamlStr, body];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a single concept markdown file and return a validated ConceptFile.
 *
 * The file is expected to have YAML frontmatter delimited by `---` followed by
 * sections headed with `## Summary`, `## Key Points`, `## Deep Dive`,
 * `## Practice Questions`, and `## Common Misconceptions`.
 *
 * Missing sections default to empty strings / arrays as appropriate.
 */
export function loadConcept(filePath: string): ConceptFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const [yamlStr, body] = splitFrontmatter(raw);

  // Frontmatter is optional — topic packs keep concept metadata in the topic's
  // `manifest.json` instead (see CLAUDE.md).  Anything absent is derived from
  // the file itself so a plain markdown concept file loads without error.
  const parsedFm = (yaml.parse(yamlStr) ?? {}) as Record<string, unknown>;
  const frontmatter: ConceptFrontmatter = ConceptFrontmatterSchema.parse({
    id: parsedFm.id ?? path.basename(filePath, '.md'),
    title: parsedFm.title ?? extractTitle(body) ?? path.basename(filePath, '.md'),
    difficulty: parsedFm.difficulty ?? 3,
    prerequisites: parsedFm.prerequisites ?? [],
    tags: parsedFm.tags ?? [],
  });

  // Extract sections.
  const sections = splitSections(body);

  /** First heading present for a field, or '' when the file has none of them. */
  const pick = (field: keyof typeof SECTION_ALIASES): string => {
    for (const heading of SECTION_ALIASES[field]) {
      const text = sections.get(heading);
      if (text) return text;
    }
    return '';
  };

  return {
    frontmatter,
    summary: pick('summary'),
    keyPoints: parseListItems(pick('keyPoints')),
    deepDive: pick('deepDive'),
    practiceQuestions: parseListItems(pick('practiceQuestions')),
    misconceptions: parseListItems(pick('misconceptions')),
    sections: Object.fromEntries(sections),
  };
}

/**
 * Raw markdown for one of the typed fields, resolving heading aliases.
 *
 * Use this instead of the parsed `keyPoints` / `misconceptions` arrays when
 * displaying content to a learner: concept files nest `###` headings, tables,
 * and code blocks that do not survive being flattened into a list.
 */
export function sectionText(concept: ConceptFile, field: string): string {
  // Callers pass section names produced by the mode modules, which are not
  // typed against SECTION_ALIASES; an unrecognised name yields '' rather than
  // throwing mid-session.
  const aliases: readonly string[] =
    SECTION_ALIASES[field as keyof typeof SECTION_ALIASES] ?? [];
  for (const heading of aliases) {
    const text = concept.sections[heading];
    if (text) return text;
  }
  return '';
}

/** Headings of every section not claimed by one of the typed fields. */
export function extraSectionHeadings(concept: ConceptFile): string[] {
  const claimed = new Set<string>(Object.values(SECTION_ALIASES).flat());
  return Object.keys(concept.sections).filter((h) => !claimed.has(h));
}

/**
 * Load and validate a manifest JSON file.  The manifest describes which
 * concept files belong to a topic and their metadata.
 */
export function loadManifest(manifestPath: string): Manifest {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const parsed = JSON.parse(raw);
  return ManifestSchema.parse(parsed);
}

/**
 * Load every `.md` file in `conceptsDir` as a ConceptFile, sorted by filename
 * for deterministic ordering.
 */
export function loadAllConcepts(conceptsDir: string): ConceptFile[] {
  const entries = fs.readdirSync(conceptsDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name));

  return mdFiles.map((entry) => loadConcept(path.join(conceptsDir, entry.name)));
}
