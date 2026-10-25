import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const judgment = z.object({
  verdict: z.enum(["meets", "concern", "uncertain"]),
  evidence: text,
}).strict();
const conditions = z.object({
  scenarioSha256: sha256,
  initialStateSha256: sha256.nullable(), // null for a DB-free ad-hoc case
  model: text,
  modelOptions: text,
  toolPermissions: text,
  sourceSnapshot: text,
}).strict();
const run = z.object({
  runId: text,
  harnessSha256: sha256,
  replySha256: sha256,
  conditions,
  quality: z.object({
    accuracy: judgment,
    causalClarity: judgment,
    adaptation: judgment,
    learnerAgency: judgment,
    assessmentHonesty: judgment,
  }).strict(),
  integrity: z.object({
    verdict: z.enum(["pass", "fail", "uncertain"]),
    evidence: text,
  }).strict(),
  costs: z.object({
    toolCalls: z.number().int().nonnegative().optional(),
    tokens: z.number().int().nonnegative().optional(),
    elapsedMs: z.number().finite().nonnegative().optional(),
  }).strict(),
}).strict();

export const harnessComparisonSchema = z.object({
  caseId: text,
  split: z.enum(["development", "held_out"]),
  rubricRevision: text,
  reviewer: z.object({ id: text, blinded: z.boolean() }).strict(),
  baseline: run,
  candidate: run,
}).strict();

/** Compare supplied reviews, never infer teaching quality from prose or costs. */
export function compareTeacherHarnesses(input: unknown) {
  const receipt = harnessComparisonSchema.parse(input);
  const { baseline, candidate } = receipt;
  const mismatches = (Object.keys(baseline.conditions) as (keyof typeof conditions.shape)[])
    .filter((key) => baseline.conditions[key] !== candidate.conditions[key]);
  if (mismatches.length) {
    throw new Error(`Unmatched comparison conditions: ${mismatches.join(", ")}`);
  }
  if (baseline.runId === candidate.runId) throw new Error("Comparison requires distinct runs");
  if (baseline.harnessSha256 === candidate.harnessSha256) {
    throw new Error("Comparison requires distinct harness snapshots");
  }
  const dimensions = (Object.keys(baseline.quality) as (keyof typeof baseline.quality)[])
    .map((dimension) => {
      const before = baseline.quality[dimension];
      const after = candidate.quality[dimension];
      const change = before.verdict === "uncertain" || after.verdict === "uncertain"
        ? "unresolved" : before.verdict === after.verdict ? "unchanged"
          : after.verdict === "meets" ? "improved" : "regressed";
      return { dimension, change, baseline: before, candidate: after };
    });
  return {
    caseId: receipt.caseId,
    split: receipt.split,
    rubricRevision: receipt.rubricRevision,
    reviewer: receipt.reviewer,
    runs: { baseline: baseline.runId, candidate: candidate.runId },
    provenance: {
      conditions: baseline.conditions,
      baseline: { harnessSha256: baseline.harnessSha256, replySha256: baseline.replySha256 },
      candidate: { harnessSha256: candidate.harnessSha256, replySha256: candidate.replySha256 },
    },
    status: "human_review_required" as const,
    dimensions,
    integrity: { baseline: baseline.integrity, candidate: candidate.integrity },
    costs: { descriptiveOnly: true, baseline: baseline.costs, candidate: candidate.costs },
    regressions: dimensions.filter((item) => item.change === "regressed").map((item) => item.dimension),
    unresolved: dimensions.filter((item) => item.change === "unresolved").map((item) => item.dimension),
    limitation: "This report compares supplied judgments, not observed learning gains. Hashes and review evidence are caller-supplied, not provenance attestations. A favorable comparison never authorizes promotion, overrides failed or uncertain integrity checks, or proves generalization or retention.",
  };
}
