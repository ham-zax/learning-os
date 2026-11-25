---
id: resource-saturation-and-backpressure
title: "Resource saturation and backpressure"
difficulty: 3
prerequisites: ["runtime-request-execution-and-concurrency", "latency-percentiles-and-capacity-metrics"]
tags: [coding-course, revision-first]
---

# Resource saturation and backpressure

## Summary
Name the bounded resource, where waiting accumulates, and what happens when admission rate exceeds service rate. A queue absorbs short bursts, never sustained overload; without bounded admission or load shedding, queues turn overload into memory exhaustion, timeouts, and retry storms.

## Key Points
- If arrival rate exceeds completion rate continuously (`λ > μ`), an unbounded queue grows without limit while completed throughput stays flat at `μ`.
- Bounded queues plus explicit rejection (`429` / `503` load shedding) cap latency and protect memory without reducing the worker's actual completion rate.
- Retrying timed-out requests against an already saturated bottleneck injects extra demand (**retry amplification**), lengthening queues further while creating zero extra service capacity.
- Every waiting boundary has a real limit (kernel accept backlog, event-loop queue, connection pool waiters, worker queue); never claim which overflows first without knowing the configured bounds.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Debouncing/throttling rapid user input to protect a slow handler from unbounded work.
- **Breaks when assumed:** On the frontend, queuing a few clicks in memory is harmless; on a backend serving thousands of callers, unbounded buffering hides overload until timeouts fire, callers retry, and the process collapses (OOM or cascading failure).

## Deep Dive
Compare two systems serving 1 operation/tick under 2 arrivals/tick. An unbounded queue completes 1/tick while backlog and wait latency grow every tick until callers time out — causing the server to do "goodput" work for callers that already disconnected. A bounded queue (`maxQueue = 2`) still completes the exact same 1/tick, sheds excess arrivals immediately, and keeps latency for admitted requests capped. Backpressure propagates that limit upstream instead of letting work pile up invisibly.

## Common Misconceptions
- Treating an unbounded queue as extra sustained processing capacity.
- Assuming rejecting excess requests reduces throughput below the worker's service rate, or that immediate retries help clear a saturated backlog.

## Practice Questions
- Arrival rate is stable, but each operation starts taking twice as long. What happens to work in progress and waiting, and where can admission be bounded?
- Why can adding automatic client retries without backoff or retry budgets turn a brief latency spike into a prolonged outage?

## Calibrated teacher examples
- [Saturation and backpressure predictions](../challenges/resource-saturation-and-backpressure-predict/calibration.json) cover unbounded queue growth, bounded shedding trade-offs, and retry amplification.

## Sources
- [Node.js: Event loop and worker pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
- [Google SRE Book: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)

## Course route
[Runtime, concurrency and backpressure](../units/b01.md)
