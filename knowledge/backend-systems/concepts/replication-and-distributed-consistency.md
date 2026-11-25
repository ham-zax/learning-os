---
id: replication-and-distributed-consistency
title: "Replication and distributed consistency"
difficulty: 5
prerequisites: ["retries-idempotency-and-uncertain-outcomes", "state-ownership-and-cache-consistency"]
tags: [coding-course, revision-first]
---

# Replication and distributed consistency

## Summary
Specify exactly what a committed write acknowledges (primary WAL only vs synchronous standby) and what a subsequent read is allowed to observe. Asynchronous replication lag, leader failover, and network partitions affect durability, freshness, and availability in distinct ways.

## Key Points
- **Write acknowledgement contract:** asynchronous replication returns success once the primary commits (fast, but recent writes can be lost on abrupt primary failover); synchronous replication waits for standby confirmation (stronger durability, higher write latency, and availability coupling to the standby).
- **Read-after-write & replica lag:** a read routed to an asynchronously lagging replica can legally miss a write the same client just committed on the primary — single-session transaction isolation does not guarantee cross-node replica freshness.
- **Practical consistency mechanisms:** route read-your-write flows to the primary, pin reads to a minimum WAL LSN / commit timestamp, or explicitly declare bounded staleness for analytics/feeds that can tolerate replica lag.
- **Failover under retries:** if a primary crashes mid-request or during promotion, a retried write can hit the newly promoted leader after the original write either committed or vanished — combining replication guarantees with idempotency keys is essential.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Reasoning about eventual UI updates where optimistic client views temporarily diverge from server truth.
- **Breaks when assumed:** A database read replica is neither an instantaneously consistent mirror nor a substitute for point-in-time backups (a bad `DELETE` or `DROP` replicates to standbys within milliseconds).

## Deep Dive
Integrate visibility, acknowledgement, and recovery on a concrete scenario: a user updates billing settings (primary commits), refreshes the page (read hits a standby lagging by 400 ms and shows old settings), and then primary failover happens while a billing retry is in flight. Separate the three contracts clearly: (1) **durability** (what must survive primary loss), (2) **visibility** (which reads require read-your-write vs bounded lag), and (3) **duplication safety** (stable operation identity surviving failover). Name the owner of every guarantee rather than assuming "Postgres replication" provides all three automatically.

## Common Misconceptions
- Equating read replicas with immediate strong consistency or with disaster-recovery backups.
- Using single-node PostgreSQL transaction isolation rules (`READ COMMITTED` / `REPEATABLE READ`) as proof of cross-replica freshness.

## Practice Questions
- A client commits a write to the primary and immediately reads from a read replica, seeing the old value. Explain why, and propose two mechanisms to guarantee read-your-write along with their trade-offs.
- Why does synchronous replication protect against committed-write loss on primary crash, yet still require idempotency keys when a client times out during failover?

## Sources
- [PostgreSQL standby and replication behaviour](https://www.postgresql.org/docs/current/warm-standby.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

## Course route
[Replication, integration and interview transfer](../units/b07.md)
