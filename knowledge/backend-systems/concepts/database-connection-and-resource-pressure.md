---
id: database-connection-and-resource-pressure
title: "Database connection and resource pressure"
difficulty: 3
prerequisites: ["resource-saturation-and-backpressure"]
tags: [coding-course, revision-first]
---

# Database connection and resource pressure

## Summary
Separate pool acquisition wait, database execution and transaction/lock wait. Connections are held for a lifetime; long transactions can exhaust a pool even when database CPU is modest.

## Common Misconceptions
- Increasing pool size before finding why connections remain occupied.

## Practice Questions
- Pool wait rises, queries are individually fast and CPU is low. What measurement would reveal idle-in-transaction or leaked ownership?

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) The course summary is original; inspect the focused primary reference when the distinction is subtle or version-sensitive.

## Course route
[Transactions and connection pressure](../units/b02.md)
