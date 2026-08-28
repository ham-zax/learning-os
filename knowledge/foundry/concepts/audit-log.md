---
id: audit-log
title: The Audit Log, Correlation and Causation
difficulty: 3
prerequisites: [unit-of-work]
tags: [invariants, mechanics, audit]
---

## Summary
`platform.audit_log` is the company's memory: append-only, immutable, with a monotonic sequence. Every row carries who acted (`actor_id` + `actor_kind`), what was acted on (opaque `resource_type`/`resource_id`), and **two** distinct lineage ids — `correlation_id` for the originating request and `causation_id` for the immediate parent. Retention is forever. Audit is not logs.

## Key Points
- Columns: `seq`, `at`, `tenant_id`, `actor_id`, `actor_kind`, `action`, `resource_type`, `resource_id`, `correlation_id`, `causation_id`, `before`/`after` JSONB diffs, `note`.
- **Correlation ≠ causation.** Correlation is the originating request carried end to end; causation is the *immediate* parent in the chain request → run → sub-run → mutation. Both are required.
- Written in the same transaction as the mutation, by the uow. No other write path.
- **PII never enters audit diffs** (ADR-0024): tables flagged `piiBearing` get **field-names-only** diffs with reference pointers, not values. No crypto-shredding.
- Retention: **forever**. Audit lives in Postgres; diagnostics live in Loki for 14 days.
- `events` is a separate append-only stream (`seq, at, tenant_id, kind, payload, correlation_id`) that reporting and crew agents read — never the OLTP tables.

## Deep Dive
The stated purpose is causation from a 3am mutation back to the 5pm button press. That is why two ids are mandatory rather than one. With correlation alone you can gather everything that came from one request but not reconstruct the tree. With causation alone you can walk one hop up but not group a whole request. You need both to answer "what caused this?" *and* "what else did that cause?"

The PII rule is the interesting trade-off. An audit log that stores before/after values is maximally useful and maximally dangerous — it is immutable, so a personal value written into it can never be erased, which collides directly with erasure obligations. ADR-0024's answer is to keep the *shape* of the change (which fields changed) and drop the values on PII-bearing tables, with a reference pointer to where the value lives in mutable storage. Crypto-shredding — encrypting audit values and throwing away keys — was considered and rejected.

Keep audit and logs firmly separate in your head. They have different retention (forever vs 14 days), different storage (Postgres vs Loki), and different purposes (accountability vs diagnosis). A missing log line is an inconvenience; a missing audit row is a hole in the company's history.

## Practice Questions
**Live state, verified 2026-08-16 — read this before you rely on the events stream.** `packages/events/src/index.ts` is literally `export {};` — 11 bytes. `architecture.md` §1 lists the BI event stream under "Platform owns," and the data model specifies its columns and its emitters, but the package is empty. This is an **undelivered** capability rather than a future feature, and it is the clearest example in the repo of the rule you will need constantly: **the spec describes the design, the code describes today.** When they disagree, neither is lying — check which one you are standing on.

1. Explain correlation id versus causation id. Why does the system need both?
2. A user asks you to erase their personal data. What does the audit log contain about them, and why was it designed that way?
3. What is the retention policy for audit, and how does it differ from logs?
4. Reporting needs to count documents ingested per day. Which table does it read, and which must it not read?

## Common Misconceptions
- "Audit and logs are the same thing at different verbosity" → Different store, different retention, different purpose. Audit is forever in Postgres.
- "Correlation id is enough" → It groups but cannot reconstruct the tree. Causation gives the immediate parent.
- "Audit diffs record before/after values" → Only where meaningful, and on `piiBearing` tables it is field names plus reference pointers, never values.
- "Crypto-shredding solves PII in audit" → Considered and rejected in ADR-0024.

## References
- `docs/sdd/data-model.md` §3 — Audit + causation
- `docs/adr/0024-pii-audit-diffs-erasure.md`
- `docs/sdd/observability.md` §1 — audit vs logs
