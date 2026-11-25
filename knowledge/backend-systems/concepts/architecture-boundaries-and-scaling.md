---
id: architecture-boundaries-and-scaling
title: "Architecture boundaries and scaling"
difficulty: 4
prerequisites: ["production-latency-localization", "state-ownership-and-cache-consistency", "queue-delivery-and-worker-failure"]
tags: [coding-course, revision-first]
---

# Architecture boundaries and scaling

## Summary
Separate state ownership, workload/failure domains, and scaling boundaries based on measured bottlenecks. Scale the proven bottleneck while keeping authoritative state explicit, bounding overload at admission/queue edges, and deferring premature splits (like arbitrary microservices or sharding) until evidence demands them.

## Key Points
- **Explicit state ownership:** horizontally scaled API replicas must be stateless for correctness-critical data; durable application state and async job metadata live in an authoritative store (e.g., PostgreSQL + durable queue/object storage).
- **Workload & failure isolation:** separate latency-sensitive HTTP requests (<200 ms) from CPU-heavy background work (e.g., 2-second report generation) across an asynchronous queue + dedicated worker pool so bursts in heavy jobs cannot starve API responsiveness.
- **Independent scaling vs. shared bottleneck:** API replicas and report workers scale independently, but both still converge on shared Postgres — adding API replicas does not increase database capacity and can even multiply connection pressure.
- **Bounded overload & deliberate deferral:** cap queue depth, worker concurrency, or per-tenant admission (`429`/`503`) rather than allowing infinite backlog, and explicitly defer costly mechanisms (microservices decomposition, DB sharding, read replicas, new caches) when telemetry does not point to them.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Separating UI responsiveness from heavy computation (similar to offloading CPU work to a Web Worker so interactions stay snappy).
- **Breaks when assumed:** Moving from 1 server process to 8 stateless replicas breaks every process-local assumption — in-memory sessions, local rate-limit counters, local job queues, and local caches stop being shared across requests.

## Deep Dive
When one Node.js + Postgres instance handles both 300–3,000 req/s fast API calls and 2-second CPU-heavy report exports, API `p95` spikes and app CPU hits 100% while Postgres CPU is not yet saturated. The minimal sound evolution keeps a single codebase/authoritative Postgres database, splits out stateless API replicas behind a load balancer, introduces an async job boundary (durable queue + job status table + separate report workers with bounded concurrency/admission), instruments per-tier bottleneck metrics (API CPU/event-loop lag, queue depth/age, worker utilization, Postgres CPU/connections/locks), and deliberately defers domain microservices or database sharding until Postgres or organizational boundaries actually prove to be the bottleneck.

## Common Misconceptions
- Splitting into domain microservices or adding sharding/caches before telemetry demonstrates that boundary is the bottleneck.
- Assuming horizontally scaling stateless API servers solves a shared-database bottleneck or preserves process-local state.

## Practice Questions
- One Node process scales to 8 replicas behind a load balancer. Name three in-memory assumptions that break immediately and the smallest durable owner for each.
- API CPU hits 100% during report-generation bursts while Postgres CPU stays under 30%. Design the first architecture evolution and name one tempting optimization you would deliberately defer.

## Sources
- [Node.js: Event loop and worker pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)

## Course route
[Production diagnosis and architecture boundaries](../units/b06.md)
