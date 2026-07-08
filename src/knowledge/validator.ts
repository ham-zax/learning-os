import type { ConceptFile, Manifest } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

function combine(results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// validateConcept — quality gate for a single concept file
// ---------------------------------------------------------------------------

export function validateConcept(concept: ConceptFile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Frontmatter completeness
  if (!concept.frontmatter.id || concept.frontmatter.id.trim().length === 0) {
    errors.push('Frontmatter: "id" is missing or empty.');
  }
  if (!concept.frontmatter.title || concept.frontmatter.title.trim().length === 0) {
    errors.push('Frontmatter: "title" is missing or empty.');
  }
  if (
    typeof concept.frontmatter.difficulty !== 'number' ||
    concept.frontmatter.difficulty < 1 ||
    concept.frontmatter.difficulty > 5
  ) {
    errors.push('Frontmatter: "difficulty" must be an integer between 1 and 5.');
  }

  // 2. Summary present and at least 10 characters
  if (!concept.summary || concept.summary.trim().length === 0) {
    errors.push('Summary is missing or empty.');
  } else if (concept.summary.trim().length < 10) {
    errors.push('Summary must be at least 10 characters long.');
  }

  // 3. Key Points: at least 1
  if (!Array.isArray(concept.keyPoints) || concept.keyPoints.length === 0) {
    errors.push('At least one key point is required.');
  }

  // 4. Practice Questions: at least 1
  if (!Array.isArray(concept.practiceQuestions) || concept.practiceQuestions.length === 0) {
    errors.push('At least one practice question is required.');
  }

  // 5. Deep Dive: present and non-empty
  if (!concept.deepDive || concept.deepDive.trim().length === 0) {
    errors.push('Deep dive section is missing or empty.');
  }

  // Warnings (non-blocking)
  if (!Array.isArray(concept.misconceptions) || concept.misconceptions.length === 0) {
    warnings.push('No misconceptions listed — consider adding common pitfalls.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// validateManifest — consistency check for a topic manifest
// ---------------------------------------------------------------------------

export function validateManifest(manifest: Manifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const ids = manifest.concepts.map((c) => c.id);

  // 1. All concept IDs are unique
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Duplicate concept ID: "${id}".`);
    }
    seen.add(id);
  }

  // Build a set of valid IDs for prerequisite lookup
  const idSet = new Set(ids);

  // 2. All prerequisites reference existing concept IDs
  for (const concept of manifest.concepts) {
    for (const prereq of concept.prerequisites) {
      if (!idSet.has(prereq)) {
        errors.push(
          `Concept "${concept.id}" has prerequisite "${prereq}" which does not exist in the manifest.`,
        );
      }
    }
  }

  // 3. No circular prerequisites (topological sort via Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of ids) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const concept of manifest.concepts) {
    for (const prereq of concept.prerequisites) {
      // prereq -> concept edge (prereq must come before concept)
      adjacency.get(prereq)!.push(concept.id);
      inDegree.set(concept.id, (inDegree.get(concept.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processed++;
    for (const neighbour of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbour) ?? 1) - 1;
      inDegree.set(neighbour, newDeg);
      if (newDeg === 0) queue.push(neighbour);
    }
  }

  if (processed < ids.length) {
    errors.push(
      `Circular prerequisite dependency detected. Only ${processed} of ${ids.length} concepts could be topologically sorted.`,
    );
  }

  // 4. All file paths are non-empty
  for (const concept of manifest.concepts) {
    if (!concept.file || concept.file.trim().length === 0) {
      errors.push(`Concept "${concept.id}" has an empty file path.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
