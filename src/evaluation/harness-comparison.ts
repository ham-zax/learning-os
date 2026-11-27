import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const traceText = z.string().trim().min(1).max(1000);

export const HarnessTraceEventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("file_read"),
      eventId: traceText.optional(),
      path: traceText,
      timestamp: traceText.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tool_call"),
      eventId: traceText.optional(),
      retryOf: traceText.optional(),
      tool: traceText,
      action: traceText.optional(),
      status: z.enum(["ok", "error"]),
      errorCode: traceText.optional(),
      elapsedMs: z.number().finite().nonnegative().optional(),
      timestamp: traceText.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("cost"),
      tokens: z.number().int().nonnegative().optional(),
      elapsedMs: z.number().finite().nonnegative().optional(),
    })
    .strict(),
]);

export type HarnessTraceEvent = z.infer<typeof HarnessTraceEventSchema>;

export const HarnessTraceSchema = z
  .object({
    harness: traceText.optional(),
    coverage: z.enum(["full", "partial", "unknown"]).default("unknown"),
    fileReadCoverage: z.enum(["full", "partial", "unknown"]).optional(),
    expectedInstructionPaths: z.array(traceText).optional(),
    events: z.array(HarnessTraceEventSchema),
  })
  .strict();

export type HarnessTrace = z.infer<typeof HarnessTraceSchema>;

export interface TraceSummary {
  traceStatus: "observed" | "unknown";
  coverage: "full" | "partial" | "unknown";
  instructionAccess: {
    status: "observed" | "partial" | "unknown";
    observedPaths: string[];
    expectedPaths?: string[];
    missingExpectedPaths?: string[];
  };
  toolCalls: {
    total: number;
    succeeded: number;
    failed: number;
    linkedRetries: number;
    recoveredLinkedRetries: number;
    byTool: Record<string, { total: number; failed: number }>;
  } | null;
  measuredCosts: {
    tokens?: number;
    runElapsedMs?: number;
    toolElapsedMs?: number;
  } | null;
  note: string;
}

function normalizeTracePath(value: string): string {
  return value.replace(/\\/gu, "/").replace(/^\.\//u, "");
}

function tracePathMatches(observed: string, expected: string): boolean {
  const normObserved = normalizeTracePath(observed);
  const normExpected = normalizeTracePath(expected);
  return normObserved === normExpected || normObserved.endsWith(`/${normExpected}`);
}

/**
 * Summarize an optional exported harness trace into factual access, retry, and cost counts.
 * Never infers instruction reads from hashes, never infers retries without explicit `retryOf`
 * correlation, never double-counts tool and run durations, and returns explicit null/unknown
 * fields when no trace is supplied.
 */
export function summarizeHarnessTrace(rawTrace: unknown): TraceSummary {
  if (rawTrace === undefined || rawTrace === null) {
    return {
      traceStatus: "unknown",
      coverage: "unknown",
      instructionAccess: {
        status: "unknown",
        observedPaths: [],
      },
      toolCalls: null,
      measuredCosts: null,
      note: "No harness trace supplied; instruction reads, tool calls, and trace costs are unknown.",
    };
  }

  const trace = HarnessTraceSchema.parse(rawTrace);
  const effectiveFileReadCoverage = trace.fileReadCoverage ?? trace.coverage;
  const observedPaths: string[] = [];
  const seenPaths = new Set<string>();
  const byTool: Record<string, { total: number; failed: number }> = {};

  let totalCalls = 0;
  let failedCalls = 0;
  let linkedRetries = 0;
  let recoveredLinkedRetries = 0;
  const failedEventIds = new Set<string>();

  let totalTokens: number | undefined;
  let runElapsedMs: number | undefined;
  let toolElapsedMs: number | undefined;

  for (const event of trace.events) {
    if (event.kind === "file_read") {
      const normalized = normalizeTracePath(event.path);
      if (!seenPaths.has(normalized)) {
        seenPaths.add(normalized);
        observedPaths.push(normalized);
      }
      continue;
    }

    if (event.kind === "tool_call") {
      totalCalls += 1;
      const toolKey = event.action ? `${event.tool}:${event.action}` : event.tool;
      const bucket = byTool[toolKey] ?? { total: 0, failed: 0 };
      bucket.total += 1;
      if (event.status === "error") {
        failedCalls += 1;
        bucket.failed += 1;
        if (event.eventId) {
          failedEventIds.add(event.eventId);
        }
      }
      if (event.retryOf && failedEventIds.has(event.retryOf)) {
        linkedRetries += 1;
        if (event.status === "ok") {
          recoveredLinkedRetries += 1;
        }
      }
      byTool[toolKey] = bucket;
      if (event.elapsedMs !== undefined) {
        toolElapsedMs = (toolElapsedMs ?? 0) + event.elapsedMs;
      }
      continue;
    }

    if (event.kind === "cost") {
      if (event.tokens !== undefined) {
        totalTokens = (totalTokens ?? 0) + event.tokens;
      }
      if (event.elapsedMs !== undefined) {
        runElapsedMs = (runElapsedMs ?? 0) + event.elapsedMs;
      }
    }
  }

  const instructionStatus: "observed" | "partial" | "unknown" =
    effectiveFileReadCoverage === "full"
      ? "observed"
      : observedPaths.length > 0
        ? "partial"
        : "unknown";

  const expectedPaths = trace.expectedInstructionPaths?.map(normalizeTracePath);
  const missingExpectedPaths =
    expectedPaths && effectiveFileReadCoverage === "full"
      ? expectedPaths.filter(
          (expected) => !observedPaths.some((observed) => tracePathMatches(observed, expected)),
        )
      : undefined;

  return {
    traceStatus: trace.coverage === "unknown" ? "unknown" : "observed",
    coverage: trace.coverage,
    instructionAccess: {
      status: instructionStatus,
      observedPaths,
      ...(expectedPaths ? { expectedPaths } : {}),
      ...(missingExpectedPaths ? { missingExpectedPaths } : {}),
    },
    toolCalls: {
      total: totalCalls,
      succeeded: totalCalls - failedCalls,
      failed: failedCalls,
      linkedRetries,
      recoveredLinkedRetries,
      byTool,
    },
    measuredCosts: {
      ...(totalTokens !== undefined ? { tokens: totalTokens } : {}),
      ...(runElapsedMs !== undefined ? { runElapsedMs } : {}),
      ...(toolElapsedMs !== undefined ? { toolElapsedMs } : {}),
    },
    note:
      "Observed file_read events establish instruction access only; missingExpectedPaths is computed only under full file-read coverage, retries require explicit retryOf correlation, and toolElapsedMs is kept separate from runElapsedMs.",
  };
}

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
  trace: HarnessTraceSchema.optional(),
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
  const includeTrace = baseline.trace !== undefined || candidate.trace !== undefined;
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
    ...(includeTrace
      ? {
          traceEvidence: {
            descriptiveOnly: true,
            baseline: summarizeHarnessTrace(baseline.trace),
            candidate: summarizeHarnessTrace(candidate.trace),
          },
        }
      : {}),
    regressions: dimensions.filter((item) => item.change === "regressed").map((item) => item.dimension),
    unresolved: dimensions.filter((item) => item.change === "unresolved").map((item) => item.dimension),
    limitation: "This report compares supplied judgments, not observed learning gains. Hashes and review evidence are caller-supplied, not provenance attestations. A favorable comparison never authorizes promotion, overrides failed or uncertain integrity checks, or proves generalization or retention.",
  };
}
