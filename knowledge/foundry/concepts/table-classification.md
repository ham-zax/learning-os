---
id: table-classification
title: Table Classification — System-of-Record, Derived, Operational
difficulty: 3
prerequisites: [audit-log]
tags: [invariants, mechanics, data-model]
---

## Summary
Every table in foundry declares one of three classes, and the class decides its audit and retention behaviour. **System-of-record** tables get their own audit rows. **Derived** tables write through the uow but carry no audit row — the producing run's row covers them, and they must be rebuildable. **Operational** tables (`task_runs`, `effects`) are pruned at 7 days, with the durable record living in events.

## Key Points
- **System-of-record** — audited at aggregate-root level. Examples: `task_defs`, `entities`, `factor_sets`, `agent_sessions`/`session_entries`.
- **Derived** — `fetch_stats`, chunks, `match_results`, projections, `entity_mentions`. Through the uow, no audit row of their own, **must be rebuildable from system-of-record + events**.
- **Operational** — `task_runs`, `effects`. Pruned at 7 days; durable record in `RunCompleted` events plus run-level audit rows.
- **Consequence to remember: retry and idempotency windows must be shorter than 7 days**, because the rows they consult are pruned at 7.
- `cost_entries` is a special case — retained forever but **run-covered** for audit; meter rows never get their own audit entries.
- An **app** table is system-of-record *unless the app declares it a projection*, and the audit-completeness gate holds app schemas to the platform's bar.

## Deep Dive
This is the release valve on the uow's strictness. If every write got its own audit row, ingesting a document would produce hundreds of rows of noise around one meaningful event, and the audit log's value would drown. ADR-0020's answer is granularity: audit at the aggregate root, and only for tables that are the system of record.

The safety condition that makes it sound is **rebuildability**. A derived table can go unaudited precisely because you can regenerate it from audited sources plus the event stream. If a table is not rebuildable, it is not derived — it is system-of-record wearing a disguise, and classifying it wrongly silently punches a hole in the trail.

Operational data (ADR-0021) is the third case: the queue's own bookkeeping is high-volume, short-lived, and would dominate the database. So it prunes at 7 days — but the *durable* record survives as a `RunCompleted` event plus a run-level audit row, and provenance columns are **denormalized at write** (`raw_captures.actor_id`, `document_versions.actor_id`/`run_id`) so a fact's provenance outlives the run row that produced it.

Then the sharp edge: because run and effect rows vanish at 7 days, **any retry or idempotency window longer than 7 days would consult rows that no longer exist.** The spec states the constraint directly. It is the kind of coupling that is obvious once written down and invisible when you are tuning a backoff schedule.

## Practice Questions
**Live state, verified 2026-08-16.** The durability half of ADR-0021 leans on `RunCompleted` events, and `packages/events/src/index.ts` is currently `export {};`. So "operational tables prune at 7 days, the durable record lives in events" is true as a *design* and partially unbuilt as an *implementation*. What does hold today is the denormalization: `raw_captures.actor_id` and `document_versions.actor_id`/`run_id` are written at capture time, so provenance survives the prune independently of the event stream. Know which leg you are standing on before you argue that a record is safe.

1. Name the three classes and say what audit treatment each gets.
2. What property must hold for a table to be legitimately classified as derived?
3. Why must retry and idempotency windows be shorter than 7 days?
4. `task_runs` is pruned at 7 days. How can a fact ingested a year ago still name the actor that fetched it?
5. Your app adds a new table and says nothing about its class. What is it, by default?

## Common Misconceptions
- "Derived tables skip the uow" → They go *through* the uow. They skip only the audit row.
- "Pruning task_runs loses the history" → The durable record is the `RunCompleted` event plus denormalized provenance columns.
- "cost_entries is operational because it's high volume" → Retained forever, but run-covered for audit.
- "App tables are outside the audit regime" → An app table is system-of-record unless declared a projection, held to the same bar.

## References
- `docs/adr/0020-audit-granularity.md`
- `docs/adr/0021-run-record-durability.md`
- `docs/sdd/data-model.md` §3, §5, §6
- `packages/storage/src/classification.ts`
