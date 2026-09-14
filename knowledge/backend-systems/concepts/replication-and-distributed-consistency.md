---
id: replication-and-distributed-consistency
title: "Replication and distributed consistency"
difficulty: 3
prerequisites: ["retries-idempotency-and-uncertain-outcomes","state-ownership-and-cache-consistency"]
tags: [coding-course, revision-first]
---

# Replication and distributed consistency

## Summary
Specify what a successful write acknowledges and what a later read is allowed to observe. Replication lag, failover and partitions can affect visibility and availability differently.

## Common Misconceptions
- Equating replication with immediate consistency or a replica with a backup.

## Practice Questions
- A client writes then reads another replica. State the desired guarantee and one mechanism or restriction that could provide it.

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[PostgreSQL standby and replication behaviour](https://www.postgresql.org/docs/current/warm-standby.html) is the primary reference for replay visibility, acknowledgement and failover. [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) addresses a different boundary and must not be used alone as proof of replica freshness. The exercise is original; state the selected system's actual guarantees.

## Course route
[Replication, integration and interview transfer](../units/b07.md)
