import { z } from 'zod';

// ---------------------------------------------------------------------------
// ConceptFrontmatter — markdown frontmatter for a single concept file
// ---------------------------------------------------------------------------

export const ConceptFrontmatterSchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: z.number().int().min(1).max(5),
  prerequisites: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;

// ---------------------------------------------------------------------------
// ConceptFile — full parsed concept markdown file
// ---------------------------------------------------------------------------

export const ConceptFileSchema = z.object({
  frontmatter: ConceptFrontmatterSchema,
  summary: z.string(),
  keyPoints: z.array(z.string()),
  deepDive: z.string(),
  practiceQuestions: z.array(z.string()),
  misconceptions: z.array(z.string()),
  /**
   * Raw markdown of each recognised `##` section, keyed by heading.  Concept
   * files use nested `###` headings, tables, and code blocks that flatten
   * badly into `keyPoints`; callers that display content to the learner should
   * render from here so the original formatting survives.
   */
  sections: z.record(z.string()).default({}),
});

export type ConceptFile = z.infer<typeof ConceptFileSchema>;

// ---------------------------------------------------------------------------
// ManifestEntry — single concept listed in a topic manifest
// ---------------------------------------------------------------------------

export const ManifestEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  file: z.string(), // path relative to concepts/
  prerequisites: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()).default([]),
});

export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

// ---------------------------------------------------------------------------
// Manifest — topic manifest (knowledge/manifest.json)
// ---------------------------------------------------------------------------

export const ManifestSchema = z.object({
  topic: z.string(),
  version: z.string(),
  description: z.string(),
  concepts: z.array(ManifestEntrySchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;

// ---------------------------------------------------------------------------
// ConceptProposal — single proposed concept for ingestion
// ---------------------------------------------------------------------------

export const ConceptProposalSchema = z.object({
  id: z.string(),
  title: z.string(),
  prerequisites: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int().positive(),
  source: z.enum(['manual', 'job-hunter', 'ai-feeds', 'generated']),
});

export type ConceptProposal = z.infer<typeof ConceptProposalSchema>;

// ---------------------------------------------------------------------------
// ConceptMap — proposed topic decomposition for ingestion
// ---------------------------------------------------------------------------

export const ConceptMapSchema = z.object({
  topic: z.string(),
  description: z.string(),
  concepts: z.array(ConceptProposalSchema),
});

export type ConceptMap = z.infer<typeof ConceptMapSchema>;

// ---------------------------------------------------------------------------
// PlanSession — single planned study session
// ---------------------------------------------------------------------------

export const PlanSessionSchema = z.object({
  sessionNumber: z.number().int().positive(),
  conceptIds: z.array(z.string()),
  estimatedMinutes: z.number().int().positive(),
  targetDate: z.string().nullable().default(null),
  mode: z.enum(['explore', 'quiz', 'teach-back']),
});

export type PlanSession = z.infer<typeof PlanSessionSchema>;

// ---------------------------------------------------------------------------
// LearningPlan — full session schedule
// ---------------------------------------------------------------------------

export const LearningPlanSchema = z.object({
  topic: z.string(),
  goal: z.string(),
  deadline: z.string().nullable().default(null),
  sessions: z.array(PlanSessionSchema),
});

export type LearningPlan = z.infer<typeof LearningPlanSchema>;
