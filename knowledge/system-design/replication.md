# Replication

## Definition
Database replication copies data across multiple servers to improve availability, fault tolerance, and read throughput. The main challenge is keeping replicas consistent with the primary (leader).

## Key Terms
- **Leader-follower (primary-replica)**: One leader handles writes, followers replicate and serve reads.
- **Multi-leader**: Multiple nodes accept writes — higher availability but conflict resolution needed.
- **Leaderless**: Any node accepts reads/writes (e.g., Dynamo, Cassandra). Uses quorum reads/writes.
- **Synchronous replication**: Leader waits for follower confirmation before acknowledging write. Durable but slow.
- **Asynchronous replication**: Leader doesn't wait — faster but risk of data loss on failover.
- **Semi-synchronous**: At least one follower is synchronous, rest async. Common compromise.
- **Replication lag**: Time between leader write and follower replication. Causes stale reads.
- **Failover**: Promoting a follower to leader when the current leader fails.
- **Split-brain**: Two nodes both think they're leader — leads to data inconsistency.
- **Read replicas**: Followers dedicated to serving read traffic.

## Why It Matters
Replication is fundamental to high availability. Every production database uses it. Interviewers want to hear you reason about consistency vs availability trade-offs in replication strategies.

## Interview Questions
1. "How would you make this database highly available?"
2. "What happens when the primary goes down?"
3. "How do you handle replication lag for read-after-write consistency?"

## Gotchas
- Async replication means failover can lose data — know your durability requirements.
- Split-brain is a real operational risk — need fencing mechanisms or consensus protocols.
- Reading from replicas immediately after writing can return stale data (read-after-write inconsistency).
- Replication doesn't help with write scaling (in leader-follower setup) — only reads.
- Failover isn't instant — there's always a brief unavailability window.
