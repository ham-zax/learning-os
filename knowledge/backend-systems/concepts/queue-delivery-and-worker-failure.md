---
id: queue-delivery-and-worker-failure
title: "Queue delivery and worker failure"
difficulty: 3
prerequisites: []
tags: [coding-course, revision-first]
---

# Queue delivery and worker failure

## Summary
Distinguish publisher acceptance, delivery, side-effect execution and consumer acknowledgement. A crash between the effect and acknowledgement can lead to redelivery.

## Common Misconceptions
- Treating broker acknowledgement as proof an external business effect happened exactly once.

## Practice Questions
- The worker performs the effect and disconnects before acknowledging. What may happen next, and which boundary owns duplication safety?

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[RabbitMQ acknowledgements and confirms](https://www.rabbitmq.com/docs/confirms) The course summary is original; inspect the focused primary reference when the distinction is subtle or version-sensitive.

## Course route
[Queue delivery, retries and uncertain outcomes](../units/b04.md)
