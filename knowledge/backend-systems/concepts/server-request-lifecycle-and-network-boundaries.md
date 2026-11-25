---
id: server-request-lifecycle-and-network-boundaries
title: "Server request lifecycle and network boundaries"
difficulty: 1
prerequisites: []
tags: [coding-course, foundation, fe-bridge]
---

# Server request lifecycle and network boundaries

## Summary
An HTTP request crosses multiple independent boundaries — DNS/TLS, load balancer or reverse proxy, OS TCP accept queue, application runtime, and downstream dependencies — before a response returns. A failure or timeout at one hop does not automatically tell the caller what happened at deeper hops.

## Key Points
- Client timeout or socket reset (`504`, `ECONNRESET`, aborted `fetch`) means the caller stopped waiting, **not** that the server rolled back or never ran the mutation.
- The OS kernel accepts TCP connections and buffers bytes independently of whether the application event loop or worker thread is currently free to run the handler.
- Upstream/downstream timeouts must be budgeted across hops: an inner database or HTTP timeout longer than the proxy timeout wastes server work after the client has already given up.
- Persistent HTTP keep-alive connections reduce handshake cost, while proxies terminate client TLS and multiplex traffic onto backend sockets.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** HTTP verbs, status codes, headers, and CORS preflight mechanics from browser `fetch()`.
- **Breaks when assumed:** In the browser, calling `AbortController.abort()` makes the UI move on cleanly; on the backend, a client disconnect does not magically cancel an in-flight SQL statement or external API call unless cancellation is explicitly wired through.

## Deep Dive
Trace every request along two separate timelines: **transport delivery** (bytes crossing sockets, proxies, and kernel buffers) and **application execution** (handler entry, downstream I/O issuance, database commit, response flush). When a reverse proxy enforces a 5 s timeout while an endpoint takes 7 s to commit a payment, the browser receives `504 Gateway Timeout` at t=5 s, yet the database commits at t=7 s. Separating "the response did not arrive" from "the effect did not happen" is the foundation for safe timeouts, retries, and backpressure.

## Common Misconceptions
- Treating a `504` or client-side `fetch()` timeout as proof that the server aborted the operation.
- Assuming request arrival at the server host means application handler code begins running immediately.

## Practice Questions
- A browser `POST /checkout` times out at the reverse proxy after 5 seconds and shows an error. What are the three distinct server/database states that could still be true?
- Why can an API server report `200 OK` in its own logs for a request where the client received a `504 Gateway Timeout`?

## Sources
- [MDN: Overview of HTTP and connection management](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

## Course route
[Server boundary, relational data and latency metrics](../units/b00.md)
