---
id: data-flow
title: The First Slice, End to End
difficulty: 3
prerequisites: [the-services, dispatch-spine, unit-of-work]
tags: [architecture, mechanics]
---

## Summary
The canonical data flow: a founder or agent hits the api, which does an authz check and opens one uow transaction committing the mutation, the audit row and the enqueue together. A worker leases the run, fetches through the policy router, stores a raw capture, parses to a document version, chunks, embeds, indexes, extracts facts, and emits events. Query time is hybrid search and explainable matching.

## Key Points
- Write side: `founder/agent → api (authz check) → uow[tx]: mutation + audit row + enqueue(task_run)`.
- Work side: `worker: lease run → fetcher (policy-routed) → raw_capture (R2 + hash) → parse → document(version, provenance) → chunk → embed(API) → index(pgvector + FTS) → extract entities/facts → knowledge → emit events → reporting/BI`.
- Query side: `search (FTS + vector, RRF) · match (profile ↔ corpus) → explainable scores`.
- **Every arrow that mutates goes through the unit-of-work.**
- **Every external call carries an idempotency key.**
- **Every step carries the causation id of the original dispatch.**
- The browser never reaches Postgres: every read goes through `apps/api`, so `requirePermission` and the tenant predicate stay on the one gated, audited path.

## Deep Dive
The value of holding this diagram in your head is that it lets you locate any question. "Where does taint enter?" — at `raw_capture`, and it propagates forward from there. "Where does cost get recorded?" — against the run, at every metered step. "Where does the audit row go?" — in the same transaction as the enqueue, before any work happens.

The three closing invariants are the ones to memorise, because they are the questions a reviewer will ask about any change you make: does the mutation go through the uow, does the external call carry an idempotency key, does the step carry causation.

The web rule is a small decision with large consequences. `apps/web` is a BFF and auth edge (ADR-0014, amended twice); the browser never talks to Postgres directly. That keeps exactly one path where `requirePermission` and the tenant predicate are applied — and one path is the only number of paths you can actually audit. Compare ADR-0039: an application's routes are transport-neutral *data* so that an app **cannot** serve a route that skips `requirePermission`. Same idea, one layer up.

Ingestion's atomicity is worth a footnote. ADR-0010 was amended on 2026-08-04: the single-transaction consequence was refined into **three leased runs** with the guarantee *"no partial document observable as complete."* The invariant that mattered was the observability of a half-ingested document, not literal single-transaction ingestion.

## Practice Questions
1. Walk the write path from an api request to an enqueued run. What commits together?
2. List the worker's steps from lease to events.
3. State the three invariants that hold on every arrow of this diagram.
4. Why does the browser never reach Postgres directly?
5. Ingestion is three leased runs, not one transaction. What guarantee replaced atomicity?

## Common Misconceptions
- "The api does the work" → The api mutates and enqueues; workers execute. ("api never runs tasks" holds for the batch lane.)
- "Ingestion is one big transaction" → Three leased runs, guaranteeing no partial document is observable as complete.
- "The web app can query the database for read-only screens" → Every read goes through `apps/api`, so permission and tenant checks stay on one path.

## References
- `docs/sdd/architecture.md` §4 — Data flow
- `docs/sdd/web.md`, `docs/adr/0014-web-stack-nextjs.md`
- `docs/adr/0010-knowledge-store-and-search.md` (amended 2026-08-04)
