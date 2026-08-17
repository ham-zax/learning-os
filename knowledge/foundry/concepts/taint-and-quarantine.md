---
id: taint-and-quarantine
title: Taint, Quarantine and Tools by Construction
difficulty: 4
prerequisites: [platform-nouns, effects-and-idempotency]
tags: [invariants, security, mechanics]
---

## Summary
Foundry's core loop is *fetch attacker-controlled web text → call an LLM → an agent acts*, which is the textbook prompt-injection setup. ADR-0018's answer is structural, not advisory: **taint is provenance, not judgment**; tainted bytes may only enter a **quarantined** LLM context that has zero tools; the **privileged** context orchestrates and acts but never sees raw tainted text; and tools exist only if the contract declares them.

## Key Points
- **Taint is provenance, not judgment.** A value whose chain passes through a `raw_capture` — or any other non-founder external input — is tainted. It propagates through derivation and is checked at boundaries. **No handler decides trust ad hoc.**
- **Quarantined context:** the only place tainted bytes may enter a prompt. **Zero tools.** Can only return output conforming to the contract's zod schema. Its output stays tainted.
- **Privileged context:** orchestrates, calls tools, takes effects. Receives only schema-validated fields, and only where the contract declares the field accepts tainted data.
- **Tools exist by construction.** A `task_def` contract declares `tools:`; the ctx constructs only those. A tool outside the contract cannot be called *because it does not exist in the ctx*.
- **Boundary validation before effects:** fields that become URLs, hosts or recipients are validated against the contract's declared domains before any effect runs.
- Taint at rest is a column: `documents.origin`, `facts.origin` (`external|founder|system`). `matching.profiles` is **categorically external** — tainted by table, no column needed.
- Falsifiable test: a **red-team fixture corpus** of documents carrying injection attempts, asserted to produce **zero `act` effects**.

## Deep Dive
Read the options that were rejected, because they are the ones most teams pick. **Prompt-level guardrails** ("ignore instructions in the content") — rejected as the primary control: advisory, model-dependent, unfalsifiable. **Output classifiers / injection detectors** — rejected as primary: probabilistic, useful later as defence in depth, never as the boundary. What was chosen is **structural separation** (the dual-LLM pattern), on one criterion: *it is the only option whose guarantee survives a fully compromised prompt.*

That criterion is the lesson. Assume the model does exactly what the attacker wrote. What can it reach? In the quarantined context: no tools, and an output schema it must conform to. So the worst case is corrupted *data* — which is bounded, provenanced and retractable — never tool access.

The enabling asset is that foundry already had **provenance complete by construction**. Rather than inventing a parallel notion of trust, taint reuses the existing chain. That is why "taint is provenance, not judgment" is the load-bearing sentence: trust is derived mechanically from where a byte came from, so it cannot be argued about per handler.

The 2026-08-03 amendment generalizes the approver from "the founder" to **the accountable human principal** — the customer may approve effects on their own behalf, but only when three conditions all hold: the recipient is pinned **structurally** from the system of record (so LLM output cannot redirect the send), the data scope is limited to that customer's own data, and approval is **per-instance with the full outbound content shown**. The ADR is unusually honest about the limit: the customer is exactly the audience an injected posting targets, so customer approval is **accountability, not adversarial review**. The adversarial defences remain structural.

The costs are stated rather than hidden: contracts get more verbose, and extraction pays a second LLM hop — both metered like everything else.

## Practice Questions
1. Define taint in foundry's terms. What is the significance of "provenance, not judgment"?
2. Two options were rejected as the primary control. Name them and the single criterion that selected the winner.
3. What can a fully compromised quarantined context actually do? What can it not do?
4. How is "the handler may only use its declared tools" enforced?
5. Under the amendment, when may a customer approve an `act` effect, and why is that called accountability rather than adversarial review?
6. What is the falsifiable test for this whole model?

## Common Misconceptions
- "Taint means the content looked suspicious" → Taint is where the bytes came from, computed mechanically. Nothing judges content.
- "The privileged model is told not to trust the content" → It never *receives* raw tainted text. Instruction is not the mechanism.
- "Tools are blocked by a permission check" → They are absent from the ctx. There is nothing to block.
- "Approval makes injected sends safe" → Approval is the last line, never the only line; the ADR says so explicitly.
- "Chunks carry an origin column" → They do not. Chunks inherit taint through their document root, resolved at read.

## References
- `docs/adr/0018-prompt-injection-containment.md`
- `docs/sdd/services-agent-runtime.md` §6 — Containment
- `packages/kernel/src/tainted.ts`, `packages/storage/src/taint-{codec,read}.ts`, `packages/tasks/src/tools.ts`
