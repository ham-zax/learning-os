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
const SECTION_HEADINGS = [
  'Summary',
  'Key Points',
  'Deep Dive',
  'Practice Questions',
  'Common Misconceptions',
] as const;

type SectionName = (typeof SECTION_HEADINGS)[number];

/**
 * Split a markdown body (everything after the frontmatter) into a map keyed by
 * section heading name.  The heading line itself is stripped.  Only the five
 * canonical sections are extracted; everything else is discarded.
 */
function splitSections(body: string): Map<SectionName, string> {
  const sections = new Map<SectionName, string>();
  const headingRegex = /^## (.+)$/gm;

  const headings: { name: SectionName; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(body)) !== null) {
    const name = match[1].trim() as SectionName;
    if ((SECTION_HEADINGS as readonly string[]).includes(name)) {
      headings.push({ name, index: match.index });
    }
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

/** Parse a markdown list (lines starting with `- `) into an array of strings. */
function parseListItems(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
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

  // Parse and validate frontmatter via zod.
  const parsedFm = yaml.parse(yamlStr) ?? {};
  const frontmatter: ConceptFrontmatter = ConceptFrontmatterSchema.parse(parsedFm);

  // Extract sections.
  const sections = splitSections(body);

  return {
    frontmatter,
    summary: sections.get('Summary') ?? '',
    keyPoints: parseListItems(sections.get('Key Points') ?? ''),
    deepDive: sections.get('Deep Dive') ?? '',
    practiceQuestions: parseListItems(sections.get('Practice Questions') ?? ''),
    misconceptions: parseListItems(sections.get('Common Misconceptions') ?? ''),
  };
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
