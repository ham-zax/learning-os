---
id: database-transactions-and-concurrent-correctness
title: "Database transactions and concurrent correctness"
difficulty: 3
prerequisites: []
tags: [coding-course, revision-first]
---

# Database transactions and concurrent correctness

## Summary
Start with a business invariant and an interleaving. Atomicity and isolation answer different questions. Choose a database-enforced operation or coordination mechanism that protects the invariant.

## Common Misconceptions
- Believing BEGIN/COMMIT alone makes read-then-write logic safe against every concurrent interleaving.

## Practice Questions
- Two buyers see the final item. Show the unsafe interleaving, then state a conditional update or locking design and its retry behavior.

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) The course summary is original; inspect the focused primary reference when the distinction is subtle or version-sensitive.

## Course route
[Transactions and connection pressure](../units/b02.md)
