---
id: state-ownership-and-cache-consistency
title: "State ownership and cache consistency"
difficulty: 3
prerequisites: ["database-transactions-and-concurrent-correctness"]
tags: [coding-course, revision-first]
---

# State ownership and cache consistency

## Summary
Identify the single authoritative state owner, every derived cache copy, and the explicit freshness contract. Concurrent reads, writes, and invalidations can interleave to republish obsolete values, and a TTL bounds staleness without providing read-your-write guarantees.

## Key Points
- **Single source of truth:** the primary database owns durable state; a cache is a derived optimization whose failure or eviction must never lose authoritative writes.
- **Stale-fill race (write-then-delete):** Reader misses cache and reads old DB value `10`; Writer updates DB to `12` and deletes the cache key; slow Reader finishes and writes stale `10` back into the cache.
- **Delete-first race (delete-then-write):** Writer deletes cache before a slow DB write; a concurrent Reader misses, reads old DB value `5`, and repopulates `5` before the write lands. Deleting first moves the race window rather than eliminating it.
- **TTL ≠ read-your-write:** a 30-second TTL only caps how long stale data can survive without invalidation; a user who edits their profile at `t=10` still reads the old cached value until `t=30` unless writes invalidate, bypass cache, or use versioned/monotonic keys.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** React Query / SWR concepts of stale-while-revalidate, cache keys, and explicit cache invalidation after mutations.
- **Breaks when assumed:** A browser query cache serves one user in one tab (easy to mutate optimistically); a shared Redis cache serves thousands of concurrent readers and writers across multiple stateless API replicas where overlapping network timings invert read/write order.

## Deep Dive
Stop promising "strong cache consistency" vaguely and state the exact freshness contract: does this endpoint need **read-your-write** (e.g., editing your own profile), **monotonic reads**, or **bounded staleness** (e.g., product catalog with a 60 s TTL)? When cache-aside races matter, compare bounded mitigations — short TTLs, version-checked conditional cache writes (`version > cachedVersion`), write-through, or bypassing the cache for the writer's own immediate read — and state which interleaving each actually eliminates.

## Common Misconceptions
- Assuming deleting a cache entry after (or before) a database write guarantees all subsequent reads see fresh data.
- Treating a TTL cache as a read-your-write mechanism, or assuming cache hits automatically reset fixed TTLs.

## Practice Questions
- Trace how a slow cache-aside read can republish stale data even when the writer updates Postgres first and then deletes the Redis key.
- A user updates their display name and immediately reloads their profile page. Why is a 60-second TTL insufficient, and what is the simplest contract that guarantees read-your-write?

## Calibrated teacher examples
- [Prediction examples and verification](../challenges/state-ownership-and-cache-consistency-predict/README.md) cover stale-fill, delete-first, and TTL freshness contracts.

## Sources
- [Redis cache tracking and invalidation](https://redis.io/docs/latest/develop/clients/client-side-caching/)

## Course route
[State ownership and cache visibility](../units/b03.md)
