---
id: tenant-scope
title: Tenant Scope — No Unscoped Query API
difficulty: 2
prerequisites: [unit-of-work]
tags: [invariants, mechanics, storage]
---

## Summary
Foundry is multi-user and single-tenant today, but built with the tenant seam already in place. Every owned row carries `tenant_id NOT NULL DEFAULT 'default'`, and the data-access layer **requires a scope object to build any query**. There is no unscoped query API. There is no RLS at v1.

## Key Points
- ADR-0003: multi-user, single tenant, with enforced seams.
- Every owned row: `tenant_id NOT NULL DEFAULT 'default'`.
- The data-access layer **requires a scope object** to build a query — being unscoped is not expressible, not merely discouraged.
- No row-level security at v1; the seam is the scope object plus the column.
- Enforced by a dedicated checker: `npm run scoped-read-check`.
- Lives in `packages/storage/src/scope.ts`.

## Deep Dive
This is the "designed-for seam" pattern applied to tenancy, and it is the cheapest instance of it in the repo. The expensive part of going multi-tenant is never the `WHERE` clause — it is finding the several hundred queries that omit it, years after they were written, under time pressure. Adding the column and the mandatory scope object on day one costs almost nothing and converts that migration into a configuration change.

The important word is **required**. The API is shaped so that you cannot build a query without a scope; an unscoped read is not a discouraged practice but an unrepresentable one. That is the same philosophy as the unit-of-work ("there is no other write path") and as tools-by-construction in the containment model ("a tool outside the contract cannot be called because it does not exist"). Once you notice the pattern, you can predict how foundry will solve most new safety problems: **make the unsafe thing impossible to express, then add a CI check that proves nobody found a way around it.**

RLS was deliberately not adopted at v1 — the enforcement lives in the data-access layer instead.

## Practice Questions
1. Is foundry multi-tenant today? What exists anyway, and why?
2. What does the data-access layer require before it will build any query?
3. Name two other places in foundry that use the same "make it unrepresentable" pattern.
4. Which CI script guards this, and what would it catch?

## Common Misconceptions
- "tenant_id is speculative bloat" → It is the designed-for seam; retrofitting it is the expensive part, not adding it.
- "Row-level security enforces this" → No RLS at v1. The scope object and the column are the seam.
- "You can do an unscoped read if you're careful" → There is no unscoped query API to be careful with.

## References
- `docs/adr/0003-multi-user-single-tenant.md`
- `docs/sdd/data-model.md` §1
- `packages/storage/src/scope.ts`, `package.json` → `scoped-read-check`
