---
id: latency-percentiles-and-capacity-metrics
title: "Latency percentiles and capacity metrics"
difficulty: 1
prerequisites: ["server-request-lifecycle-and-network-boundaries"]
tags: [coding-course, foundation, fe-bridge]
---

# Latency percentiles and capacity metrics

## Summary
Backend performance under multi-user concurrency cannot be judged from averages alone. Tail percentiles (`p95`, `p99`), the split between service time and queueing wait, and the difference between utilization and saturation reveal overload before systems collapse.

## Key Points
- **Percentiles:** `p50` (median) reflects a typical request; `p95` means 95% of requests finished at or below that time and the slowest 5% took longer. Averages mask severe tail spikes.
- **Latency composition:** total latency = **queueing wait** + **service time**. Under overload, service time can stay flat while queueing wait grows nonlinearly.
- **Utilization vs. saturation:** utilization is the fraction of a resource currently busy (e.g., 85% DB CPU); saturation is the amount of extra work forced to wait because the resource cannot serve it immediately (queue depth, event-loop lag, pool waiters).
- **Little's Law (`L = λ × W`):** in-flight concurrency (`L`) equals arrival rate (`λ`) times average time in system (`W`). If latency doubles at constant traffic, in-flight requests and held connections double too.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Measuring performance distributions (Core Web Vitals uses p75) rather than relying on one local dev run.
- **Breaks when assumed:** A single browser tab rarely queues behind 500 other users' requests. On a backend, high utilization (80–95%) on a shared CPU, event loop, or DB pool causes tail latency (`p95`/`p99`) to explode even when `p50` still looks acceptable.

## Deep Dive
Suppose 95% of API requests execute in 20 ms while 5% trigger a 2-second report or wait behind a saturated resource. Mean latency is ~119 ms — misleadingly calm — while `p95` jumps straight to ~2,000 ms, and any page making 5 parallel API calls has a `1 - 0.95^5 ≈ 23%` chance of hitting at least one tail-slow call. Reading `p50`/`p95`/`p99` alongside throughput, error rate, and saturation (queue depth / CPU / pool wait) lets you spot which tier is running out of headroom.

## Common Misconceptions
- Treating average latency as representative of user experience under bursty or bimodal workloads.
- Confusing high resource utilization (e.g., 75% CPU) with saturation, or assuming latency scales linearly up to 100% utilization.

## Practice Questions
- If API `p50` stays at 25 ms while `p95` jumps from 80 ms to 2,400 ms during bursts, what does that tell you compared to both `p50` and `p95` jumping together?
- Using `L = λ × W`, what happens to the number of simultaneously open DB connections if request rate stays constant at 200 req/s but average transaction hold time rises from 10 ms to 100 ms?

## Sources
- [Google SRE Book: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)

## Course route
[Server boundary, relational data and latency metrics](../units/b00.md)
