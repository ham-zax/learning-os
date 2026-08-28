---
id: provenance-chain
title: The Provenance Chain
difficulty: 3
prerequisites: [audit-log, table-classification]
tags: [mechanics, knowledge, invariants]
---

## Summary
Every fact in foundry can be traced back to the bytes that produced it: `fact → document_version → raw_capture → task_run → target + actor`. The chain is **complete by construction, not by convention** — and it survives the 7-day run prune because the actor and run ids are denormalized onto the rows at write time.

## Key Points
- Chain: `fact → document_version → raw_capture (actor_id, run_id) → target`. `run_id` resolves to full run detail via the `RunCompleted` event.
- `raw_captures` are **content-addressed**; the body lives in the object store (R2), never the database. 90-day expiry in R2.
- `documents` have a `canonical_key` per kind — cross-source identity. `document_versions` are one observed state, tied to the capture that **first** produced it.
- **`document_version_captures`** (added 2026-08-04, FDY-041) is a join table: the same posting from two sources collapses to one version by the `(document_id, content_hash)` unique index, and one version holds one capture id — so the second source's bytes would be unreachable without it.
- **Retraction of a fact is a `valid_to` timestamp, never a delete.** Facts carry `valid_from`/`valid_to`, confidence, and `origin`.
- Provenance is what taint is computed from — the security model reuses this chain rather than inventing its own.

## Deep Dive
The FDY-041 story is the best worked example in the repo of a spec meeting reality. P3's exit criterion said: *the same posting ingested from two sources yields one document with **two** capture provenances.* But byte-identical content from two sources collapses to a single version via the `(document_id, content_hash)` unique index, and a version has one `raw_capture_id` column — so the second source's bytes became unreachable. A single column simply could not satisfy the criterion. The fix keeps the column as *the version's birth certificate* and adds a join table as *the complete list*. Both readings are legitimate; the mistake was making one column serve both.

"Retraction is a `valid_to` timestamp, never a delete" is the same instinct as append-only audit. A fact that turned out to be wrong is itself information — when you believed it, on what basis, and when you stopped. Deleting it destroys the ability to explain a decision made while it was believed true.

Content-addressing raw captures gives deduplication and integrity together: the same bytes fetched twice hash to the same key, and a hash mismatch is detectable corruption. Keeping bodies out of Postgres keeps the OLTP database small enough to back up nightly.

## Practice Questions
1. Recite the provenance chain from a fact back to its origin.
2. `task_runs` prune at 7 days. How does a two-year-old fact still name the actor that fetched it?
3. What problem did `document_version_captures` solve, and why couldn't the existing column solve it?
4. A fact turns out to be wrong. What happens to the row, and why not delete it?
5. Where does a raw capture's body live, and what does content-addressing buy?

## Common Misconceptions
- "Provenance is a nice-to-have for debugging" → It is the asset the security model is built on: taint is computed from this chain.
- "Retracting a fact deletes it" → It sets `valid_to`. Never a delete.
- "raw_captures store the body" → The body goes to the object store; the row holds the hash and the R2 key.
- "One document version has one capture" → It has one *birth* capture plus a join table listing all captures that produced that content.

## References
- `docs/sdd/data-model.md` §5–§6
- `docs/adr/0010-knowledge-store-and-search.md`, `0021-run-record-durability.md`
- `docs/techspec/knowledge-schema.md` §2.3
