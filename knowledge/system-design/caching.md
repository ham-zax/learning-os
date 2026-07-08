# Caching

## Definition
Caching stores frequently accessed data in a fast-access storage layer (typically in-memory) to reduce latency and database load. The trade-off is staleness — cached data may not reflect the latest state.

## Key Terms
- **Cache-aside (lazy loading)**: App checks cache first, on miss reads DB and populates cache.
- **Write-through**: Writes go to cache and DB simultaneously — consistent but slower writes.
- **Write-behind (write-back)**: Writes go to cache, async flush to DB — fast but risk of data loss.
- **TTL (Time To Live)**: Expiration time for cached entries.
- **Cache invalidation**: Removing or updating stale entries. Famously one of the two hard problems.
- **Cache hit/miss**: Hit = data found in cache. Miss = must fetch from source.
- **Eviction policy**: LRU (Least Recently Used), LFU (Least Frequently Used), FIFO.
- **Hot key**: A single cache key receiving disproportionate traffic.
- **Cache stampede**: Many threads simultaneously miss and all hit the DB.
- **Redis vs Memcached**: Redis = rich data structures, persistence, pub/sub. Memcached = simpler, multi-threaded.

## Why It Matters
Caching is the single highest-ROI optimization for read-heavy systems. A well-placed cache can reduce DB load by 90%+ and cut latency from 100ms to 1ms. Interviewers expect you to propose caching early.

## Interview Questions
1. "Where would you place a cache in this architecture?"
2. "How do you handle cache invalidation?"
3. "What happens when your cache goes down?"

## Gotchas
- "There are only two hard things: cache invalidation and naming things." — Invalidation is genuinely hard.
- Not having a cache-aside strategy leads to thundering herd on cold start.
- Caching stale data without TTL or invalidation leads to bugs that are hard to debug.
- Forgetting that caches are ephemeral — never use cache as primary data store.
- Hot keys can overwhelm a single cache node — need key distribution strategy.
