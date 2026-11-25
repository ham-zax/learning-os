---
id: relational-constraints-and-index-cost
title: "Relational constraints and index cost"
difficulty: 2
prerequisites: []
tags: [coding-course, foundation, fe-bridge]
---

# Relational constraints and index cost

## Summary
A relational database is not a passive JSON store: constraints (`PRIMARY KEY`, `UNIQUE`, `CHECK`, `FOREIGN KEY`) enforce invariants across all concurrent callers, while indexes determine whether reads and updates touch a few rows or scan entire tables and saturate CPU and locks.

## Key Points
- Schema constraints are the last authoritative guardrail: `CHECK (stock >= 0)` or `UNIQUE (tenant_id, email)` hold even when multiple application replicas race or a bug slips into one endpoint.
- Without a matching B-tree index, a selective lookup (`WHERE tenant_id = $1 AND status = 'open'`) degrades into a sequential scan whose cost grows linearly with table size.
- Indexes are not free: every secondary index adds write amplification (`INSERT`/`UPDATE`/`DELETE` must maintain each index) and consumes memory/disk.
- Slow unindexed queries do not just hurt one request — they hold database CPU, I/O, locks, and connection-pool slots longer, turning a schema gap into an outage under concurrency.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Thinking in normalized entity shapes and `O(1)`/`O(log n)` lookup maps vs `O(n)` array scans.
- **Breaks when assumed:** Client-side form validation or checking `if (!exists)` in JavaScript feels sufficient for a single browser tab, but across concurrent backend requests only database-enforced constraints and atomic operations preserve uniqueness and bounds.

## Deep Dive
When migrating from frontend state to PostgreSQL, treat the schema as an executable contract. A composite index `(tenant_id, created_at DESC)` serves tenant-scoped pagination in milliseconds and keeps lock footprints tiny; omitting `tenant_id` or ordering columns incorrectly forces Postgres to scan and sort far more rows than returned. Pair `EXPLAIN (ANALYZE, BUFFERS)` with constraints so correctness is guaranteed by the database and query cost stays bounded as tables grow.

## Common Misconceptions
- Relying on application-level validation alone to enforce uniqueness or non-negative balances across concurrent requests.
- Adding indexes to every column without accounting for write overhead and composite-key column order.

## Practice Questions
- Why does `if (await findByEmail(email)) throw ...; await insertUser(email)` still allow duplicate emails without a `UNIQUE` constraint?
- A query filters by `WHERE org_id = $1 AND created_at > $2` on a 5M-row table. How does a missing index affect not just that request's latency, but unrelated requests sharing the same database?

## Sources
- [PostgreSQL: Constraints and indexes](https://www.postgresql.org/docs/current/ddl-constraints.html)

## Course route
[Server boundary, relational data and latency metrics](../units/b00.md)
