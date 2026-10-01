import { z } from 'zod';
import { assertSafeId } from './safe-path.js';

const SafeIdSchema = z.string().superRefine((value, context) => {
  try { assertSafeId(value); } catch { context.addIssue({ code: z.ZodIssueCode.custom, message: 'ID must be a safe path component' }); }
});

// ---------------------------------------------------------------------------
// ConceptFrontmatter — markdown frontmatter for a single concept file
// ---------------------------------------------------------------------------

export const ConceptFrontmatterSchema = z.object({
  id: SafeIdSchema,
  title: z.string().trim().min(1),
  difficulty: z.number().int().min(1).max(5),
  prerequisites: z.array(SafeIdSchema).default([]),
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
  id: SafeIdSchema,
  title: z.string().trim().min(1),
  file: z.string().min(1).refine((value) => !value.startsWith('/') && !value.includes('\\') && !value.includes('\0') && !value.split('/').includes('..'), 'File must be a contained relative path').optional(), // optional path relative to the topic directory
  source: z.string().optional(),
  sourceId: z.string().optional(),
  prerequisites: z.array(SafeIdSchema).default([]),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()).default([]),
});

export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

// ---------------------------------------------------------------------------
// Manifest — topic manifest (knowledge/manifest.json)
// ---------------------------------------------------------------------------

export const ManifestSchema = z.object({
  topicId: SafeIdSchema,
  topicName: z.string().trim().min(1),
  description: z.string().default(''),
  concepts: z.array(ManifestEntrySchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;

// ---------------------------------------------------------------------------
// ConceptProposal — single proposed concept for ingestion
// ---------------------------------------------------------------------------

export const ConceptProposalSchema = z.object({
  id: SafeIdSchema,
  title: z.string().trim().min(1),
  prerequisites: z.array(SafeIdSchema).default([]),
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
