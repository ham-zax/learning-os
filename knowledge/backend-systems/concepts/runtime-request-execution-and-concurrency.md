---
id: runtime-request-execution-and-concurrency
title: "Runtime request execution and concurrency"
difficulty: 2
prerequisites: ["server-request-lifecycle-and-network-boundaries"]
tags: [coding-course, revision-first]
---

# Runtime request execution and concurrency

## Summary
Trace each request through executing, waiting, and resuming. In Node.js, asynchronous I/O permits overlap across concurrent requests, but synchronous JavaScript CPU work still occupies the single event-loop thread and delays every other handler and completion callback.

## Key Points
- Keep three events separate: **issuing** an async I/O operation on the JS thread, **external I/O completion** (OS/DB/network), and **running the JS completion callback** when the thread yields.
- Synchronous code runs to completion before microtasks drain, and microtasks drain before timer/I/O callbacks.
- A later request cannot even *issue* its non-blocking DB query until the single JS thread finishes the current synchronous block.
- External I/O can finish while synchronous CPU work is running, yet its callback stays queued until the JS thread becomes free.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** JavaScript call stack, microtask queue (Promise continuations), and macrotask/timer ordering from browser event-loop intuition.
- **Breaks when assumed:** Blocking the browser main thread freezes *one user's tab*; blocking the Node.js event loop stalls **all** in-flight users sharing that process (both new request handlers and already-finished DB callbacks).

## Deep Dive
When two requests hit a single Node.js process, the OS kernel can accept TCP bytes for request B while request A is spinning in a 100 ms synchronous loop. However, B's handler cannot start — and therefore cannot issue its 40 ms database query — until A yields at t=100 ms. Distinguishing concurrent OS/database activity from serialized JS execution is essential for explaining event-loop lag, tail latency spikes, and why moving CPU work off the API event loop fixes unrelated fast endpoints.

## Common Misconceptions
- Equating `async` I/O with parallel JavaScript CPU execution, or assuming a later request's delegated DB query starts the moment TCP packets arrive.
- Believing external I/O completion preempts running synchronous JavaScript code.

## Practice Questions
- A CPU-heavy callback and a slow database call both delay requests. Predict which metrics distinguish them.
- Request A runs 100 ms of synchronous JSON/crypto work at t=0. Request B arrives at t=10 ms and needs a 40 ms DB query. What is the earliest time B's query can start, and when can B respond?

## Calibrated teacher examples
- [Runtime execution predictions](../challenges/runtime-request-execution-and-concurrency-predict/calibration.json) cover synchronous vs microtask/timer ordering, blocked I/O issuance, and completion vs callback execution.

## Sources
- [Node.js: Event loop and worker pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)

## Course route
[Runtime, concurrency and backpressure](../units/b01.md)
