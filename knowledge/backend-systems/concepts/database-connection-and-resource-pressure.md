---
id: database-connection-and-resource-pressure
title: "Database connection and resource pressure"
difficulty: 3
prerequisites: ["resource-saturation-and-backpressure", "database-transactions-and-concurrent-correctness"]
tags: [coding-course, revision-first]
---

# Database connection and resource pressure

## Summary
Separate connection-pool acquisition wait, actual SQL execution time, and lock/transaction wait. Database connections are bounded resources held for a transaction or checkout lifetime; long or leaked transactions can exhaust the pool while database CPU looks almost idle.

## Key Points
- A slow DB call breaks into three distinct intervals: **waiting for a free pool slot**, **waiting on a row/table lock**, and **executing the query** (CPU/disk I/O).
- Holding a transaction open across slow external HTTP calls or forgetting to release a client (`idle in transaction`) pins a pool slot and blocks other requests even when individual SQL queries take 2 ms.
- Blindly raising pool size across N app replicas (`N × pool_size`) often worsens throughput by multiplying Postgres backend memory overhead, context switching, and lock contention.
- Pool sizing and connection pooling layers (e.g., transaction pooling) must be reasoned about alongside transaction duration and active query concurrency (`pg_stat_activity`).

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Browser per-origin connection limits where stalled requests queue behind occupied slots.
- **Breaks when assumed:** Calling an external API inside a frontend `async` handler only holds one client promise; doing that same `await fetch(...)` inside an open SQL transaction holds a scarce shared database connection and any row locks for the entire external round-trip.

## Deep Dive
When pool wait time spikes while query duration and Postgres CPU remain low, the pool is saturated by **connection hold time**, not compute. Check active vs `idle in transaction` sessions, transaction duration distributions, and pool checkout-to-release time. Shortening transaction scope (never performing network I/O inside `BEGIN ... COMMIT`), fixing leaked error-path releases, and setting `idle_in_transaction_session_timeout` address the root cause; raising pool limits without diagnosing hold time merely shifts the saturation point into Postgres itself.

## Common Misconceptions
- Increasing application connection-pool size as the default fix for pool-acquisition timeouts.
- Assuming low database CPU rules out database-layer contention or connection exhaustion.

## Practice Questions
- Pool acquisition wait rises sharply, individual SQL queries take 3 ms, and Postgres CPU is at 15%. What measurement distinguishes `idle in transaction` hold time from lock waits or leaked connections?
- You have 8 API replicas each with a pool of 50 connections against a 4-vCPU Postgres instance. What failure mode appears under burst load?

## Sources
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

## Course route
[Transactions and connection pressure](../units/b02.md)
