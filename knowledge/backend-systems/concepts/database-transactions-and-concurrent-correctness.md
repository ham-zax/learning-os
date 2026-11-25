---
id: database-transactions-and-concurrent-correctness
title: "Database transactions and concurrent correctness"
difficulty: 3
prerequisites: ["relational-constraints-and-index-cost"]
tags: [coding-course, revision-first]
---

# Database transactions and concurrent correctness

## Summary
Start with a business invariant and a concrete concurrent interleaving. Atomicity (all-or-nothing rollback) and isolation (preventing concurrent interference) answer different questions; protecting an invariant requires coupling the availability check and mutation atomically at the database boundary.

## Key Points
- A separate `SELECT` followed by `UPDATE` in application code (even inside `BEGIN ... COMMIT` at default `READ COMMITTED`) allows two concurrent transactions to read the same initial stock and both succeed.
- **Conditional atomic update** (`UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0 RETURNING stock`) couples check + decrement in one guarded database step; under Postgres `READ COMMITTED`, a waiting updater re-evaluates the `WHERE` clause against the newly committed row version.
- **Pessimistic locking** (`SELECT ... FOR UPDATE`) serializes concurrent transactions on the target row when multi-step logic must run between read and write.
- A non-negative final value (e.g., `stock = 0` after stale overwrites, or a `Set` containing one username) does **not** prove only one caller received a success response — check both final state and issued decisions.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Recognizing stale-closure / stale-snapshot races (`setCount(count + 1)` vs functional `setCount(c => c + 1)`).
- **Breaks when assumed:** Single-threaded JS `await` races can sometimes be fixed by removing an `await` between check and write; across multiple backend instances talking to Postgres, in-process locks or synchronous JS do nothing — coordination must live at the database boundary.

## Deep Dive
Under PostgreSQL's default `READ COMMITTED` isolation, each statement sees a snapshot of data committed before that statement began. Two transactions running `SELECT stock FROM products WHERE id = 42` both observe `stock = 1`. If both then execute `UPDATE products SET stock = stock - 1 WHERE id = 42 AND stock > 0 RETURNING stock`, Postgres acquires a row lock for transaction A; transaction B blocks until A commits, then re-checks `stock > 0` against the committed `stock = 0` and updates zero rows. The caller derives accepted vs sold-out unambiguously from whether a row was returned.

## Common Misconceptions
- Believing `BEGIN`/`COMMIT` alone prevents lost updates or double-reservation races under `READ COMMITTED`.
- Assuming non-negative final stock or a unique `Set` proves no duplicate success decision was returned.

## Practice Questions
- Two buyers see the final item. Show the unsafe interleaving, then write a conditional update or row-locking design and state how the caller tells success from sold-out.
- Why does fixing an in-memory Node reservation race by removing `await` fail once you run two Node API replicas against PostgreSQL?

## Calibrated teacher examples
- [Concurrent-correctness predictions](../challenges/database-transactions-predict/README.md) cover the selected `predict` capability in an in-memory model.

## Sources
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL: Constraints and indexes](https://www.postgresql.org/docs/current/ddl-constraints.html)

## Course route
[Transactions and connection pressure](../units/b02.md)
