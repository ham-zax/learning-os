import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

/**
 * Descriptive reporting for a bounded learning-outcome pilot.
 *
 * This module reads existing evidence and attempts through read-only connections. It writes no
 * evidence, cards, schedules, or mastery state, and it estimates no causal effect.
 */

const ref = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/, "Use an anonymized identifier of letters, digits, dot, underscore or dash");
const evidenceRef = z.object({ evidenceId: z.string().trim().min(1).max(200) }).strict();
const isoInstant = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO date or timestamp");

export const OutcomeConditionSchema = z.enum(["current_teaching", "curated_scaffold"]);
export type OutcomeCondition = z.infer<typeof OutcomeConditionSchema>;

const EntrySchema = z.object({
  entryId: ref,
  learnerRef: ref,
  objectiveRef: ref,
  condition: OutcomeConditionSchema,
  database: ref,
  /** Free-form design labels reported verbatim for stratification; never used in any score. */
  taskDesign: z.object({
    form: z.string().trim().min(1).max(60).optional(),
    difficulty: z.string().trim().min(1).max(60).optional(),
    order: z.string().trim().min(1).max(60).optional(),
  }).strict().default({}),
  baseline: evidenceRef,
  /** Null until the learner returns; a missing follow-up is reported, never treated as success. */
  followUp: evidenceRef.nullable(),
  intendedFollowUpDate: isoInstant,
  studyTime: z.object({
    /** Attempts in the same database that make up the study period for this entry. */
    attemptIds: z.array(z.number().int().positive()).max(500),
    /** Share of declared attempts that must carry recorded time before the total is used. */
    minimumCoverage: z.number().min(0).max(1).default(1),
  }).strict(),
}).strict();

export const OutcomeManifestSchema = z.object({
  version: z.literal(1),
  pilotId: ref,
  /** Alias -> database file; relative paths resolve against the manifest's directory. */
  databases: z.record(ref, z.string().trim().min(1).max(1000)),
  /** Optional: where held-out task text lives. Must stay outside curriculum discovery. */
  heldOutMaterialsDirectory: z.string().trim().min(1).max(1000).optional(),
  entries: z.array(EntrySchema).min(1).max(500),
}).strict().superRefine((manifest, context) => {
  const seen = new Set<string>();
  manifest.entries.forEach((entry, index) => {
    if (seen.has(entry.entryId)) {
      context.addIssue({ code: "custom", path: ["entries", index, "entryId"], message: `Duplicate entryId ${entry.entryId}` });
    }
    seen.add(entry.entryId);
    if (!(entry.database in manifest.databases)) {
      context.addIssue({ code: "custom", path: ["entries", index, "database"], message: `Unknown database alias ${entry.database}` });
    }
  });
});
export type OutcomeManifest = z.infer<typeof OutcomeManifestSchema>;

export interface LoadedOutcomeManifest {
  manifest: OutcomeManifest;
  /** Resolved absolute database paths by alias. */
  databasePaths: Record<string, string>;
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export function parseOutcomeManifest(
  raw: unknown,
  options: { baseDirectory: string; knowledgeRoot: string },
): LoadedOutcomeManifest {
  const manifest = OutcomeManifestSchema.parse(raw);
  const knowledgeRoot = resolve(options.knowledgeRoot);
  if (manifest.heldOutMaterialsDirectory !== undefined) {
    const directory = resolve(options.baseDirectory, manifest.heldOutMaterialsDirectory);
    if (isInside(knowledgeRoot, directory)) {
      throw new Error("Held-out evaluation materials must stay outside the curriculum knowledge directory");
    }
  }
  const databasePaths = Object.fromEntries(Object.entries(manifest.databases)
    .map(([alias, path]) => [alias, resolve(options.baseDirectory, path)]));
  return { manifest, databasePaths };
}

export function loadOutcomeManifest(manifestPath: string, knowledgeRoot: string): LoadedOutcomeManifest {
  const path = resolve(manifestPath);
  return parseOutcomeManifest(JSON.parse(readFileSync(path, "utf8")), {
    baseDirectory: dirname(path), knowledgeRoot,
  });
}

// ---------------------------------------------------------------------------------------------

/** Coarse pilot convention applied to frozen-rubric results; `ungradable` is never scored. */
const RESULT_SCORE: Record<string, number | undefined> = { correct: 1, partially_correct: 0.5, incorrect: 0 };

export type FollowUpStatus =
  | "independent" | "assisted" | "invalidated" | "ungradable"
  | "not_returned" | "pending" | "reference_not_found";

export interface ResolvedEvidence {
  evidenceId: string;
  /** Present when the manifest reference was corrected; the effective replacement was used. */
  correctedFrom: string | null;
  result: string;
  score: number | null;
  independent: boolean;
  hintLevel: number;
  preResponseExposures: number;
  performedAt: string;
  objectiveId: string;
}

export interface TimeSummary {
  declaredAttempts: number;
  attemptsWithRecordedTime: number;
  /** Fraction of declared attempts with recorded time; null when none were declared. */
  coverage: number | null;
  /** Sum over attempts that have recorded time. A lower bound when coverage is incomplete. */
  recordedSeconds: number;
  /** Total used for rates; null (unknown) unless coverage meets the entry's minimum. */
  usableSeconds: number | null;
  status: "adequate" | "inadequate_coverage" | "none_declared";
}

export interface OutcomeEntryReport {
  entryId: string;
  learnerRef: string;
  objectiveRef: string;
  condition: OutcomeCondition;
  taskDesign: { form?: string; difficulty?: string; order?: string };
  baseline: { status: "independent" | "assisted" | "invalidated" | "ungradable" | "reference_not_found";
    evidence: ResolvedEvidence | null };
  followUp: { status: FollowUpStatus; evidence: ResolvedEvidence | null };
  intendedFollowUpDate: string;
  /** Actual elapsed time between the baseline and follow-up assessments, when both exist. */
  elapsedDays: number | null;
  /** Positive when the follow-up happened after the intended date. */
  daysAfterIntendedDate: number | null;
  studyTime: TimeSummary;
  /** Simple later-minus-earlier score difference; only when both assessments were independent and scored. */
  simpleChange: number | null;
  /** simpleChange per recorded active minute; null when time is unknown, zero or the change is unavailable. */
  gainPerStudyMinute: number | null;
  notes: string[];
}

export interface ConditionSummary {
  condition: OutcomeCondition;
  entries: number;
  followUps: Record<FollowUpStatus, number>;
  /** Means are over the stated n only; non-returners and assisted follow-ups are excluded, never counted as zero. */
  meanBaselineScore: { n: number; mean: number | null };
  meanDelayedIndependentScore: { n: number; mean: number | null };
  meanSimpleChange: { n: number; mean: number | null };
  meanGainPerStudyMinute: { n: number; mean: number | null };
  meanStudyMinutes: { n: number; mean: number | null };
}

export interface LearningOutcomeReport {
  pilotId: string;
  asOf: string;
  entries: OutcomeEntryReport[];
  conditions: ConditionSummary[];
  analysis: {
    scoring: string;
    baselineAdjustment: "not_performed";
    causalClaim: "none";
  };
  limitations: string[];
}

function latestRevisionIsInvalidation(db: Database.Database, evidenceId: string): boolean {
  const row = db.prepare(`SELECT action FROM evidence_revisions WHERE evidence_event_id = ? ORDER BY seq DESC LIMIT 1`)
    .get(evidenceId) as { action: string } | undefined;
  return row?.action === "invalidate";
}

interface EvidenceRow {
  id: string; objective_id: string; attempt_id: number | null; result: string;
  hint_level: number; retrieval_valid: number; performed_at: string;
}

type Resolution =
  | { kind: "found"; row: EvidenceRow; correctedFrom: string | null }
  | { kind: "invalidated" }
  | { kind: "not_found" };

/** Follows invalidation and corrected-replacement links to the evidence that is currently effective. */
function resolveEffectiveEvidence(db: Database.Database, evidenceId: string): Resolution {
  let currentId = evidenceId;
  const visited = new Set<string>();
  while (!visited.has(currentId) && visited.size < 25) {
    visited.add(currentId);
    const row = db.prepare(`SELECT id, objective_id, attempt_id, result, hint_level, retrieval_valid, performed_at
      FROM evidence_events WHERE id = ?`).get(currentId) as EvidenceRow | undefined;
    if (!row) return currentId === evidenceId ? { kind: "not_found" } : { kind: "invalidated" };
    if (!latestRevisionIsInvalidation(db, row.id)) {
      return { kind: "found", row, correctedFrom: currentId === evidenceId ? null : evidenceId };
    }
    const replacement = db.prepare(`SELECT id FROM evidence_events WHERE supersedes_event_id = ? ORDER BY seq DESC LIMIT 1`)
      .get(row.id) as { id: string } | undefined;
    if (!replacement) return { kind: "invalidated" };
    currentId = replacement.id;
  }
  return { kind: "invalidated" };
}

function describeEvidence(db: Database.Database, row: EvidenceRow, correctedFrom: string | null): ResolvedEvidence {
  const attempt = row.attempt_id === null ? undefined : db.prepare(`SELECT started_at, submitted_at FROM attempts WHERE id = ?`)
    .get(row.attempt_id) as { started_at: string; submitted_at: string | null } | undefined;
  const exposures = attempt?.submitted_at
    ? (db.prepare(`SELECT COUNT(*) AS count FROM exposure_events
        WHERE objective_id = ? AND occurred_at >= ? AND occurred_at <= ?`)
      .get(row.objective_id, attempt.started_at, attempt.submitted_at) as { count: number }).count
    : 0;
  return {
    evidenceId: row.id, correctedFrom, result: row.result, score: RESULT_SCORE[row.result] ?? null,
    // The kernel's own retrieval validity already requires no hint, no pre-response exposure and a frozen challenge.
    independent: row.retrieval_valid === 1 && row.hint_level === 0 && exposures === 0,
    hintLevel: row.hint_level, preResponseExposures: exposures,
    performedAt: row.performed_at, objectiveId: row.objective_id,
  };
}

function classify(resolution: Resolution, db: Database.Database):
  { status: "independent" | "assisted" | "invalidated" | "ungradable" | "reference_not_found"; evidence: ResolvedEvidence | null } {
  if (resolution.kind === "not_found") return { status: "reference_not_found", evidence: null };
  if (resolution.kind === "invalidated") return { status: "invalidated", evidence: null };
  const evidence = describeEvidence(db, resolution.row, resolution.correctedFrom);
  if (evidence.score === null) return { status: "ungradable", evidence };
  return { status: evidence.independent ? "independent" : "assisted", evidence };
}

function summarizeTime(db: Database.Database, attemptIds: readonly number[], minimumCoverage: number): TimeSummary {
  const unique = [...new Set(attemptIds)];
  if (unique.length === 0) {
    return { declaredAttempts: 0, attemptsWithRecordedTime: 0, coverage: null, recordedSeconds: 0,
      usableSeconds: null, status: "none_declared" };
  }
  const rows = db.prepare(`SELECT id, time_spent_seconds FROM attempts WHERE id IN (${unique.map(() => "?").join(",")})`)
    .all(...unique) as Array<{ id: number; time_spent_seconds: number | null }>;
  // An attempt that is absent or has NULL time is unknown. Unknown is never converted to zero.
  const timed = rows.filter((row) => row.time_spent_seconds !== null && row.time_spent_seconds >= 0);
  const recordedSeconds = timed.reduce((sum, row) => sum + row.time_spent_seconds!, 0);
  const coverage = timed.length / unique.length;
  const adequate = coverage >= minimumCoverage;
  return { declaredAttempts: unique.length, attemptsWithRecordedTime: timed.length, coverage, recordedSeconds,
    usableSeconds: adequate ? recordedSeconds : null, status: adequate ? "adequate" : "inadequate_coverage" };
}

const DAY_MS = 86_400_000;
const round = (value: number, places = 4) => Math.round(value * 10 ** places) / 10 ** places;

function openReadOnly(path: string): Database.Database {
  return new Database(path, { readonly: true, fileMustExist: true });
}

export function summarizeLearningOutcomes(
  loaded: LoadedOutcomeManifest,
  options: { asOf?: string } = {},
): LearningOutcomeReport {
  const asOf = options.asOf ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(asOf))) throw new Error("asOf must be an ISO date or timestamp");
  const connections = new Map<string, Database.Database>();
  const reports: OutcomeEntryReport[] = [];
  try {
    for (const entry of loaded.manifest.entries) {
      let db = connections.get(entry.database);
      if (!db) {
        db = openReadOnly(loaded.databasePaths[entry.database]!);
        connections.set(entry.database, db);
      }
      const notes: string[] = [];
      const baseline = classify(resolveEffectiveEvidence(db, entry.baseline.evidenceId), db);
      let followUp: OutcomeEntryReport["followUp"];
      if (entry.followUp === null) {
        const due = Date.parse(entry.intendedFollowUpDate) <= Date.parse(asOf);
        followUp = { status: due ? "not_returned" : "pending", evidence: null };
      } else {
        followUp = classify(resolveEffectiveEvidence(db, entry.followUp.evidenceId), db);
      }
      if (baseline.evidence?.correctedFrom) notes.push("Baseline reference was corrected; the effective replacement is used.");
      if (followUp.evidence?.correctedFrom) notes.push("Follow-up reference was corrected; the effective replacement is used.");
      if (baseline.status === "assisted") notes.push("Baseline was assisted; it is excluded from change calculations.");
      if (followUp.status === "assisted") notes.push("Follow-up was assisted; it is not reported as independent success.");

      let elapsedDays: number | null = null;
      let daysAfterIntended: number | null = null;
      let consistent = true;
      if (baseline.evidence && followUp.evidence) {
        if (baseline.evidence.objectiveId !== followUp.evidence.objectiveId) {
          consistent = false; notes.push("Baseline and follow-up evidence belong to different objectives; change is not computed.");
        }
        const elapsedMs = Date.parse(followUp.evidence.performedAt) - Date.parse(baseline.evidence.performedAt);
        if (elapsedMs < 0) {
          consistent = false; notes.push("Follow-up evidence precedes the baseline; change is not computed.");
        } else {
          elapsedDays = round(elapsedMs / DAY_MS, 2);
        }
      }
      if (followUp.evidence) {
        daysAfterIntended = round((Date.parse(followUp.evidence.performedAt) - Date.parse(entry.intendedFollowUpDate)) / DAY_MS, 2);
      }

      const studyTime = summarizeTime(db, entry.studyTime.attemptIds, entry.studyTime.minimumCoverage);
      if (studyTime.status === "inadequate_coverage") notes.push("Recorded study time covers too few declared attempts; time is reported as unknown.");
      if (studyTime.status === "none_declared") notes.push("No study attempts were declared; time is unknown.");

      const changeAvailable = consistent && baseline.status === "independent" && followUp.status === "independent"
        && baseline.evidence!.score !== null && followUp.evidence!.score !== null;
      const simpleChange = changeAvailable ? round(followUp.evidence!.score! - baseline.evidence!.score!) : null;
      let gainPerStudyMinute: number | null = null;
      if (simpleChange !== null && studyTime.usableSeconds !== null) {
        if (studyTime.usableSeconds > 0) gainPerStudyMinute = round(simpleChange / (studyTime.usableSeconds / 60));
        else notes.push("Recorded study time is zero seconds; gain per minute is undefined.");
      }

      reports.push({
        entryId: entry.entryId, learnerRef: entry.learnerRef, objectiveRef: entry.objectiveRef,
        condition: entry.condition, taskDesign: entry.taskDesign, baseline, followUp,
        intendedFollowUpDate: entry.intendedFollowUpDate, elapsedDays, daysAfterIntendedDate: daysAfterIntended,
        studyTime, simpleChange, gainPerStudyMinute, notes,
      });
    }
  } finally {
    for (const db of connections.values()) db.close();
  }

  const mean = (values: number[]) => ({ n: values.length,
    mean: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null });
  const conditions = OutcomeConditionSchema.options.map((condition): ConditionSummary => {
    const rows = reports.filter((report) => report.condition === condition);
    const statuses: Record<FollowUpStatus, number> = { independent: 0, assisted: 0, invalidated: 0, ungradable: 0,
      not_returned: 0, pending: 0, reference_not_found: 0 };
    for (const row of rows) statuses[row.followUp.status] += 1;
    return {
      condition, entries: rows.length, followUps: statuses,
      meanBaselineScore: mean(rows.filter((row) => row.baseline.status === "independent").map((row) => row.baseline.evidence!.score!)),
      meanDelayedIndependentScore: mean(rows.filter((row) => row.followUp.status === "independent").map((row) => row.followUp.evidence!.score!)),
      meanSimpleChange: mean(rows.flatMap((row) => row.simpleChange === null ? [] : [row.simpleChange])),
      meanGainPerStudyMinute: mean(rows.flatMap((row) => row.gainPerStudyMinute === null ? [] : [row.gainPerStudyMinute])),
      meanStudyMinutes: mean(rows.flatMap((row) => row.studyTime.usableSeconds === null ? [] : [row.studyTime.usableSeconds / 60])),
    };
  });

  return {
    pilotId: loaded.manifest.pilotId, asOf, entries: reports, conditions,
    analysis: {
      scoring: "correct=1, partially_correct=0.5, incorrect=0; ungradable is unscored. Follow-ups count as independent only when the kernel recorded valid retrieval with no hint and no pre-response exposure.",
      baselineAdjustment: "not_performed", causalClaim: "none",
    },
    limitations: [
      "simpleChange is later minus earlier score. It is not baseline-adjusted; an adjusted estimate needs a separate, prespecified model.",
      "Means are descriptive over the stated n. Assisted, invalidated, pending and non-returned follow-ups are excluded from score means and listed in counts, not treated as success or zero.",
      "Study time comes from attempts.time_spent_seconds and is used only when declared attempts meet the entry's minimum coverage. Unknown time is not zero and is never replaced by wall-clock duration.",
      "Differences between conditions are not a causal estimate. Task difficulty, order, learner differences and sample size are not controlled here.",
    ],
  };
}
