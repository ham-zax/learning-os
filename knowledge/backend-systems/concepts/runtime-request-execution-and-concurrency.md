---
id: runtime-request-execution-and-concurrency
title: "Runtime request execution and concurrency"
difficulty: 3
prerequisites: []
tags: [coding-course, revision-first]
---

# Runtime request execution and concurrency

## Summary
Trace each request through executing, waiting and resuming. In Node, asynchronous I/O can permit overlap; CPU work in a JavaScript callback still occupies its execution thread.

## Common Misconceptions
- Equating async with parallel CPU execution or all waiting with CPU load.

## Practice Questions
- A CPU-heavy callback and a slow database call both delay requests. Predict which metrics distinguish them.

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[Node.js: Event loop and worker pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) The course summary is original; inspect the focused primary reference when the distinction is subtle or version-sensitive.

## Course route
[Runtime, concurrency and backpressure](../units/b01.md)
