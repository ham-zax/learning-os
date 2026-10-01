import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichConcept, enrichConcepts } from "../src/ingest/enricher.js";
import type { ConceptProposal } from "../src/knowledge/types.js";
import type { LLMClient } from "../src/llm/client.js";

const proposal: ConceptProposal = { id: "transactions", title: "Transactions", difficulty: 3,
  prerequisites: [], estimatedMinutes: 30, source: "manual" };
afterEach(() => vi.useRealTimers());

describe("enrichment boundaries", () => {
  it("identifies templates and rejects malformed model output instead of coercing it", async () => {
    expect((await enrichConcept(null, proposal, "Databases")).provenance).toEqual({ source: "template", reason: "unconfigured" });
    const client: LLMClient = { isConfigured: () => true, complete: async () => JSON.stringify({ keyPoints: [{}] }) };
    expect((await enrichConcept(client, proposal, "Databases")).provenance).toEqual({ source: "template", reason: "invalid_response" });
  });

  it("caps batches and metadata before spending any provider calls", async () => {
    const complete = vi.fn();
    const client: LLMClient = { isConfigured: () => true, complete };
    await expect(enrichConcepts(client, Array(101).fill(proposal), "Databases")).rejects.toThrow("100 concepts");
    await expect(enrichConcept(client, { ...proposal, title: "x".repeat(501) }, "Databases")).rejects.toThrow("size limits");
    expect(complete).not.toHaveBeenCalled();
  });

  it("aborts stalled provider work at the deadline and records the fallback reason", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const client: LLMClient = { isConfigured: () => true, complete: (_prompt, options) => {
      signal = options?.signal;
      return new Promise(() => {});
    } };
    const pending = enrichConcept(client, proposal, "Databases");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(signal?.aborted).toBe(true);
    expect((await pending).provenance).toEqual({ source: "template", reason: "provider_failure" });
  });
});
