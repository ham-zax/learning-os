# Sharding (Data Partitioning)

## Definition
Sharding distributes data across multiple database instances (shards) so each shard holds a subset of the data. It's horizontal scaling at the database level — each shard is an independent database that handles a portion of the total workload.

## Key Terms
- **Shard key**: The column used to determine which shard a row belongs to. Critical decision.
- **Range sharding**: Shard by value ranges (e.g., user IDs 1-1M on shard 1, 1M-2M on shard 2).
- **Hash sharding**: Shard by hash of key — uniform distribution but range queries span all shards.
- **Directory sharding**: Lookup table maps keys to shards. Flexible but adds a dependency.
- **Hotspot**: One shard receiving disproportionate traffic (poor shard key choice).
- **Cross-shard query**: Query that needs data from multiple shards — expensive, avoid when possible.
- **Resharding**: Redistributing data when adding/removing shards. Painful — plan for it early.
- **Shard rebalancing**: Moving data between shards to maintain even distribution.

## Why It Matters
When a single database can't handle the write throughput or data volume, sharding is the answer. But it's a one-way door — hard to undo. Interviewers test whether you understand the operational implications.

## Interview Questions
1. "How would you shard a user table with 1 billion rows?"
2. "What shard key would you choose for this system?"
3. "How do you handle cross-shard queries?"

## Gotchas
- Choosing a bad shard key creates hotspots — user_id is often better than country or timestamp.
- Cross-shard joins are expensive — design your data model to minimize them.
- Resharding is a massive operational challenge — consistent hashing helps but doesn't eliminate it.
- Auto-increment IDs break across shards — use UUIDs or Snowflake IDs.
- Transactions across shards are complex — 2PC is slow, saga pattern is eventual consistency.
