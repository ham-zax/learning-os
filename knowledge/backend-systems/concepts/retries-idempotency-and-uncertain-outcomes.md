---
id: retries-idempotency-and-uncertain-outcomes
title: "Retries, idempotency and uncertain outcomes"
difficulty: 3
prerequisites: ["queue-delivery-and-worker-failure"]
tags: [coding-course, revision-first]
---

# Retries, idempotency and uncertain outcomes

## Summary
A timeout means the outcome may be unknown. A stable operation identity and an atomic decision about its effect make safe retries possible within a stated scope and retention window.

## Common Misconceptions
- Generating a new idempotency key for every retry or checking a completed flag only after concurrent effects start.

## Practice Questions
- Use the retry lab to separate sequential duplicate handling from concurrent duplicate handling; then add a restart boundary conceptually.

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[RabbitMQ acknowledgements and confirms](https://www.rabbitmq.com/docs/confirms) explains transport acknowledgement boundaries. [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) provides a concrete operation-key/result-reuse contract for comparison, not a universal exactly-once guarantee. No live external transaction is needed; the course case is original.

## Course route
[Queue delivery, retries and uncertain outcomes](../units/b04.md)
