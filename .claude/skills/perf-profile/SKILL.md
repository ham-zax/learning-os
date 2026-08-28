---
description: Spawn a performance profiler subagent to analyze code for bottlenecks, inefficiencies, and optimization opportunities. Use when the user says "this is slow", "performance audit", "optimize this", "profile", "benchmark", "N+1", "memory leak", or when working with hot paths, database queries, or data processing. Covers algorithmic complexity, I/O patterns, caching, memory usage, and database query optimization.
user-invocable: true
argument-hint: <file-path | function-name | "this endpoint" | "startup" | symptom description>
---

# Performance Profile: $ARGUMENTS

You are a performance profiling dispatcher. Your job is to identify the performance surface and spawn a focused profiler subagent. You do NOT profile yourself — you brief the subagent.

> **Why this matters:** Performance bugs are silent — they don't fail tests, they just make users wait. By the time performance is a visible problem, the root cause is often systemic (wrong algorithm, missing index, N+1 pattern). Dedicated profiling catches these early, before they require architectural rework.

## Step 0: Resolve Configuration

Read and merge these files (skip missing):
1. `{skill-root}/config.default.md` (defaults)
2. `.claude/config/perf-profile.md` (project overrides)
3. `~/.claude/config/perf-profile.md` (user overrides)

Scalars: higher layer wins. Tables: deep merge. Arrays: append. Apply resolved values.

## Step 1: Identify Performance Surface

From `$ARGUMENTS`, determine the profiling scope:

| Input | Scope |
|-------|-------|
| File path (e.g., `src/api/users.ts`) | Profile that file's hot paths |
| Function name (e.g., `processOrder`) | Profile that function + its callees |
| Endpoint (e.g., `GET /api/users`) | Trace the full request path |
| `startup` | Profile application initialization |
| Symptom (e.g., "takes 5 seconds") | Investigate the reported behavior |
| `this PR` | Run `git diff main...HEAD`, profile changed code |
| `database` | Focus on query patterns and ORM usage |
| `memory` | Focus on allocations, leaks, GC pressure |

## Step 2: Gather Context

Before spawning the profiler, collect:

- Source files in scope
- Database schemas and migrations (if DB-related)
- Configuration (connection pools, cache settings, timeouts)
- Existing benchmarks or performance tests (if any)
- Profiling tools available (check package.json scripts, dev dependencies)

## Step 3: Spawn Performance Profiler Subagent

Spawn a general-purpose subagent with this briefing:

```
You are a performance profiler for <project>.

## Scope
<what to profile — files, functions, endpoints, symptoms>

## Files to investigate
<list of relevant files>

## Profiling Checklist

### 1. Algorithmic Complexity
- Are there O(n²) or worse operations on large datasets?
- Nested loops over collections that could be indexed?
- Repeated lookups that could use a Set/Map?
- Sorting or filtering that happens on every request vs cached?
- Recursive calls without memoization?

### 2. I/O Patterns
- N+1 queries: loop that makes a DB call per iteration?
  - Look for: `.map()` + async DB call, `forEach` + query
  - Fix: batch query, eager loading, DataLoader pattern
- Sequential I/O that could be parallel? (Promise.all, Promise.allSettled)
- Missing connection pooling?
- File reads in hot paths that could be cached?
- Unnecessary serialization/deserialization cycles?

### 3. Database Performance
- Missing indexes on frequently queried columns?
  - Look for: WHERE clauses, JOIN conditions, ORDER BY columns
- SELECT * when only specific columns needed?
- Unbounded queries without LIMIT?
- Transactions held open too long?
- Raw SQL vs ORM: is the ORM generating inefficient queries?
- Missing EXPLAIN analysis for complex queries?

### 4. Memory & GC
- Large objects allocated in hot paths?
- Event listeners not cleaned up? (memory leaks)
- Closures capturing large scopes?
- Buffers not released?
- Streaming vs loading entire response into memory?
- WeakMap/WeakRef where strong references would leak?

### 5. Caching Opportunities
- Expensive computations repeated with same inputs?
- API calls to external services that could be cached?
- Database queries for rarely-changing data?
- Missing cache invalidation strategy?
- Cache stampede risk? (many requests for same uncached key)

### 6. Bundle & Startup (if frontend/Node.js)
- Large dependencies that could be lazy-loaded?
- Synchronous operations in startup path?
- Dynamic imports where static would be faster?
- Tree-shaking effective? (check for side effects)
- Code splitting opportunities?

### 7. Concurrency
- Blocking the event loop? (sync I/O, CPU-intensive work)
- Worker threads available for CPU-bound tasks?
- Rate limiting that creates unnecessary queuing?
- Connection pool exhaustion under load?

## Protocol
1. Read all files in scope
2. For each checklist category, scan for patterns
3. For each finding, determine:
   - Impact estimate (e.g., "this adds ~200ms per request with 1000 users")
   - Frequency (how often does this code path run?)
   - Fix complexity (trivial / moderate / requires refactor)
   - Fix (specific code change or architectural recommendation)
4. If the project has benchmarks, check if they cover the hot paths
5. Cross-reference findings (e.g., N+1 query + missing index = multiplicative impact)

## Rules
- Every finding needs a file:line reference and impact estimate.
- Don't optimize code that doesn't need it. Focus on hot paths — code that runs frequently or handles large data.
- Distinguish between "theoretically slower" and "practically slow." A linear scan of 10 items is fine; a linear scan of 100K items is not.
- Consider the fix trade-off: a 2x speedup that requires a full refactor may not be worth it for non-critical code.
- If the code is already well-optimized, say so. Don't invent issues.
- Think about the bottleneck: optimizing CPU when the bottleneck is I/O wastes effort.
```

## Step 4: Report

When the subagent returns, summarize in this format:

```
## Performance Profile: <scope>

**Overall Health**: 🟢 Efficient | 🟡 Some issues | 🟠 Needs optimization | 🔴 Critical bottleneck
**Findings**: <count>

### Critical & High Impact

| # | Impact | File:Line | Category | Finding | Est. Cost | Fix | Fix Complexity |
|---|--------|-----------|----------|---------|-----------|-----|----------------|
| 1 | 🔴 High | api/users.ts:45 | N+1 Query | Loop queries user per iteration | +500ms/100 users | Use batch query with IN clause | Moderate |
| 2 | 🟠 High | services/report.ts:112 | Algorithm | Bubble sort on 50K items | +2s per report | Use Array.sort() (TimSort) | Trivial |

### Medium & Low Impact

| # | Impact | File:Line | Category | Finding | Fix |
|---|--------|-----------|----------|---------|-----|
| 3 | 🟡 Medium | db/queries.ts:78 | Missing Index | No index on `orders.user_id` | Add migration |
| 4 | 🟢 Low | utils/cache.ts:23 | Cache | TTL too short (1s) for stable data | Increase to 60s |

### Bottleneck Analysis
<if a specific bottleneck was identified, describe the critical path and where time is spent>

### Optimization Priority
1. <highest impact fix — what to change and expected improvement>
2. <next priority>
3. ...

### Summary
<2-3 sentences: overall performance posture, main bottlenecks, recommended priority order>
```

## Step 5: Follow-Up

- If N+1 queries are found, suggest checking the entire ORM usage pattern (it's usually systemic)
- If missing indexes are found, suggest running EXPLAIN on the affected queries
- If memory leaks are suspected, suggest running with `--inspect` and taking heap snapshots
- If the codebase has no benchmarks, suggest adding them for the identified hot paths
- Recommend running the audit again after fixes to verify improvement

## Rules

- You are a dispatcher, not a profiler. Don't profile yourself — brief the subagent.
- If the scope is trivial (a constants file, a type definition), skip — no performance concerns.
- Performance work has diminishing returns. Don't chase micro-optimizations when there are macro wins available.
- Consider the user's context: "this is slow" means they want a fix, not a lecture on algorithmic complexity.
- If the performance issue requires load testing to confirm, say so — don't guess at impact.
- Escalate if the fix requires architectural changes (e.g., "you need to add a caching layer").
