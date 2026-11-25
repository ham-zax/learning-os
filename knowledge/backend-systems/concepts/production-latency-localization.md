---
id: production-latency-localization
title: "Production latency localization"
difficulty: 4
prerequisites: ["resource-saturation-and-backpressure", "runtime-request-execution-and-concurrency", "database-connection-and-resource-pressure"]
tags: [coding-course, revision-first]
---

# Production latency localization

## Summary
Localize production slowdowns by decomposing a request into causal spans — proxy queue, handler CPU/event-loop wait, connection-pool wait, SQL execution/lock wait, downstream HTTP calls, and serialization — and choosing one observation that falsifies competing hypotheses before proposing a fix.

## Key Points
- **Decompose before guessing:** split end-to-end latency into non-overlapping spans so you see *where* time was spent (waiting vs executing, local process vs database vs external dependency).
- **Falsifiable hypotheses:** every candidate cause predicts a distinct metric signature — event-loop lag + high app CPU points to JS blocking; flat query duration + rising pool wait points to connection hold time; rising DB CPU + seq scans points to query/index pressure.
- **Tail vs. mean traps:** p99 can spike after a deploy while average query time stays flat (e.g., occasional lock contention, cold cache misses, GC pauses, or bursty report endpoints blocking the event loop).
- **Evidence before architecture changes:** never jump straight to adding Redis, replicas, or microservices before measurements localize the bottleneck tier.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Reading Chrome DevTools Network waterfalls and Performance flamegraphs to separate scripting, layout, and network wait.
- **Breaks when assumed:** In the browser you can reproduce locally in one tab; in production backend incidents, latency emerges from multi-user contention (locks, pools, shared event loop, upstream queues) that only distributed traces (OpenTelemetry spans) and resource saturation metrics reveal.

## Deep Dive
Suppose `p99` API latency jumps from 120 ms to 1,900 ms after a deployment while average Postgres query duration stays 4 ms. Rather than listing six random fixes, inspect one slow request trace alongside tier metrics: if `app.handler` starts 1,400 ms after ingress with high event-loop delay, the Node thread is blocked; if `db.pool.acquire` takes 1,500 ms while `db.query` takes 4 ms, connections are held too long; if `db.query` itself takes 1,500 ms with lock waits, row/table contention is the culprit. One discriminating measurement collapses the hypothesis space immediately.

## Common Misconceptions
- Listing a laundry list of optimizations (caching, sharding, bigger instances) instead of naming the measurement that separates competing root causes.
- Treating a single high aggregate dashboard number as proof of causation without checking request-path spans.

## Practice Questions
- API `p99` jumps to 2 seconds under load while average DB query time stays 5 ms and DB CPU stays 20%. Name two competing hypotheses and the single measurement that separates them.
- Why can an endpoint's own handler code look fast in unit benchmarks yet show 900 ms spans in production traces?

## Sources
- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- [Node.js execution and blocking](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)

## Course route
[Production diagnosis and architecture boundaries](../units/b06.md)
