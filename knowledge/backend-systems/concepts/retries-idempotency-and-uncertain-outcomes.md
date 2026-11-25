---
id: retries-idempotency-and-uncertain-outcomes
title: "Retries, idempotency and uncertain outcomes"
difficulty: 4
prerequisites: ["queue-delivery-and-worker-failure", "database-transactions-and-concurrent-correctness"]
tags: [coding-course, revision-first]
---

# Retries, idempotency and uncertain outcomes

## Summary
A network timeout or dropped response leaves the outcome genuinely unknown — the server may have committed the operation or never seen it. Safe retries require a caller-stable operation identity, atomic coordination for overlapping attempts, durable storage that survives restarts, and an explicit policy for payload mismatches and key retention.

## Key Points
- **Stable operation identity:** the caller must generate one idempotency key per *logical intent* and reuse that exact key across retries; generating a fresh key per HTTP attempt defeats deduplication.
- **Sequential vs. overlapping retries:** checking a `completed` table/map only after effects finish still lets two concurrent requests with the same key race through and execute twice. You need an atomic in-flight claim (`INSERT ... ON CONFLICT` / unique lock) at the durable boundary.
- **Durability scope:** an in-memory `Map` deduplicates within one living process only; a worker restart or load-balanced retry hitting a second replica wipes process-local memory and replays the side effect.
- **Complete contract:** declare key scope (e.g., per tenant + endpoint), payload-conflict behavior (reject if the same key is reused with different parameters), failure handling (whether failed attempts are retryable), and retention window.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Preventing double-submit clicks in a checkout button with a client-generated request ID.
- **Breaks when assumed:** Retrying `GET` requests (like React Query auto-retries) is naturally safe; retrying `POST /charges` or `POST /reservations` after a timeout without a durable server-side idempotency boundary silently duplicates real-world effects.

## Deep Dive
Trace three distinct failure surfaces: (1) a lost response retried with a brand-new key (server cannot recognize it as the same intent), (2) two overlapping retries sharing one key against a completed-only cache (both miss before either records completion), and (3) a redelivered job after a worker crash where process-local deduplication state disappeared. A production idempotency contract binds the key claim atomically to the same durable database transaction as the business mutation (or uses an explicit state machine + outbox when calling external providers).

## Common Misconceptions
- Generating a new idempotency key on every retry attempt, or assuming identical payload amounts deduplicate automatically.
- Checking a completed-results store without an atomic in-flight claim, or storing idempotency keys only in process memory.

## Practice Questions
- Two retries with the same idempotency key arrive concurrently before the first finishes. What fails with a completed-results-only lookup, and how do you fix it atomically?
- What happens if a client reuses an existing idempotency key with a different payment amount, and why must the server reject it?

## Calibrated teacher examples
- [Retry and idempotency predictions](../challenges/retries-idempotency-predict/README.md) cover new-key retries, overlapping duplicates, and worker restarts.

## Sources
- [RabbitMQ acknowledgements and confirms](https://www.rabbitmq.com/docs/confirms)
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)

## Course route
[Queue delivery, retries and uncertain outcomes](../units/b04.md)
