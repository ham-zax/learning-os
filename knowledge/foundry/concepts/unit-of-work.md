---
id: unit-of-work
title: The Unit of Work
difficulty: 3
prerequisites: [platform-nouns]
tags: [invariants, mechanics, storage]
---

## Summary
There is exactly one write API in foundry. One unit-of-work opens a transaction, performs the mutation, writes the `audit_log` row, and — when applicable — enqueues task runs and emits events, all atomically. There is no second write path, and that is enforced by lint and by a dynamic harness, not by review.

## Key Points
- One uow transaction commits: **the state change + its audit row + any enqueue + any event**, together.
- `audit_log` is append-only and immutable — **no UPDATE/DELETE grants, ever**.
- Enforcement is CI: static lint bans raw writers outside `packages/storage`; a dynamic harness asserts every write across the API surface committed alongside an audit row.
- Lives in `packages/storage/src/uow.ts`.
- The uow is a **deliberate bottleneck**. Bulk ingest gets batch-shaped uow *variants* — never exemptions.
- The events stream for BI and crew feedback loops falls out of the same choke point for free.

## Deep Dive
The argument in ADR-0007 is worth reconstructing, because it explains a lot of the repo's shape. A company run by an agent crew is only governable if history is complete: who did what, caused by what, costing what. Audit completeness is therefore an *architectural property* — if any code path can write domain state without its audit row, the trail is silently incomplete. And silence is the problem: you cannot tell a complete trail from an incomplete one by inspection.

That leads to a strong conclusion: completeness cannot be a convention. It has to be structural. Hence one write path, and hence the enforcement being a build gate rather than a review checklist.

ADR-0002 supplies the other half. Pilot, foundry's sibling, gets its safety from being read-only by design. Foundry cannot be read-only — it must create users, dispatch crawls, call LLMs, send email, eventually take payment. So the ADR states that the safety pilot gets from "never writes" must be **replaced by something, not merely dropped**. That replacement is the sentence worth memorising: *"read-only safety" becomes "auditable, idempotent, budgeted, reversible effects."*

Notice how the four properties map onto machinery: auditable → the uow; idempotent → the effects ledger; budgeted → the cost meter; reversible → append-only history plus retraction-by-`valid_to` rather than delete.

## Practice Questions
1. What exactly commits together inside one uow transaction?
2. Why is audit completeness described as an architectural property rather than a discipline?
3. Foundry gave up pilot's "read-only" safety. What four properties replace it?
4. A bulk ingest path needs to write 10,000 rows. What is it allowed to do, and what is it not allowed to do?
5. Where is the uow enforced, and by what two mechanisms?

## Common Misconceptions
- "High-volume paths can bypass the uow for performance" → They get batch-shaped uow variants, explicitly never exemptions.
- "The audit row is written after the mutation" → Same transaction. Either both land or neither does.
- "Review catches missing audit rows" → Rejected. Enforcement is a static lint plus a dynamic completeness harness.

## References
- `docs/adr/0007-audit-and-unit-of-work.md`
- `docs/adr/0002-foundry-mutates-and-dispatches.md`
- `packages/storage/src/uow.ts`
