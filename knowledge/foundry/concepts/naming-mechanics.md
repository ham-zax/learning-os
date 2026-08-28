---
id: naming-mechanics
title: Naming Mechanics
difficulty: 1
prerequisites: [platform-nouns]
tags: [vocabulary, conventions, foundation]
---

## Summary
Foundry's small conventions are load-bearing: prefixed ULIDs for ids, `action:resourceType` for permissions, `foundry_<area>_<name>` for metrics, Postgres schemas as the layer seam, ISO-8601 UTC timestamps, and empty collections as `[]` rather than null.

## Key Points
- IDs are **prefixed ULIDs** — `usr_…`, `run_…`, `doc_…`. Sortable and greppable; **a bare UUID in a log is a defect.**
- Permissions are `action:resourceType` strings — `dispatch:crawl-target`, `read:audit`.
- Metrics are `foundry_<area>_<name>`.
- Postgres schemas are the seam: `platform`, `crawl`, `knowledge`, `matching`, `app_jobs`, one migration folder each.
- Timestamps are ISO-8601 UTC with milliseconds. Empty collections are `[]`, never null.
- Every owned row carries `tenant_id NOT NULL DEFAULT 'default'`.

## Deep Dive
Prefixed ULIDs are the convention that pays back most often. Two properties: they sort lexicographically by creation time, and the prefix tells you what you are looking at without a join. When you are debugging a causation chain across an audit log, an events stream and a run table, being able to read `run_01J…` and know instantly what it is — and to sort a pile of them chronologically without parsing — is the difference between a five-minute and a fifty-minute investigation. That is why the spec calls a bare UUID in a log a *defect* rather than a style nit.

`action:resourceType` permissions matter because they compose with the opaque Resource pair. A permission names a verb and a *type*, and the tenant scope handles the instance-level question — which keeps the permission table small and readable.

The `[]`-never-null rule is a serialization discipline. Null and empty mean different things at a boundary, and once an API has shipped both, every consumer grows a defensive branch.

## Practice Questions
1. What id format does foundry use, and name its two useful properties.
2. What does the spec say about finding a bare UUID in a log line?
3. What shape is a permission string? Give an example.
4. Why insist on `[]` instead of null for empty collections?

## Common Misconceptions
- "ULID vs UUID is a taste question" → Sortability and the greppable prefix are the point; the spec treats a bare UUID in a log as a defect.
- "The prefix is cosmetic" → It removes a lookup when reading logs and audit rows.
- "tenant_id is dead weight in a single-tenant system" → It is the *designed-for* seam (ADR-0003). Single tenant today; the column exists so multi-tenant is not a migration.

## References
- `docs/glossary.md` §5 — Naming mechanics
- `docs/sdd/data-model.md` §1 — Conventions
