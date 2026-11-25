---
id: queue-delivery-and-worker-failure
title: "Queue delivery and worker failure"
difficulty: 3
prerequisites: ["resource-saturation-and-backpressure"]
tags: [coding-course, revision-first]
---

# Queue delivery and worker failure

## Summary
Separate publisher confirmation, broker delivery, business side-effect execution, and consumer acknowledgement. Because a worker can crash between applying a side effect and sending its acknowledgement, message queues provide at-least-once (or at-most-once) transport delivery — never magic exactly-once business effects.

## Key Points
- **Four distinct boundaries:** (1) publisher confirms message persisted in broker, (2) broker delivers message to worker, (3) worker performs the business side effect, (4) worker acknowledges (`ack`) the broker.
- **Auto-ack / ack-before-effect (`at-most-once`):** if the worker crashes after acknowledging but before finishing the work, the job is silently lost.
- **Ack-after-effect (`at-least-once`):** if the worker applies the effect and crashes or loses its lease before the `ack` reaches the broker, the broker redelivers the message to another worker — causing duplicate execution unless the effect is idempotent.
- **Poison messages & visibility timeouts:** a failing message retried indefinitely starves workers; cap delivery attempts and route unrecoverable messages to a dead-letter queue (DLQ) with observability.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Asynchronous background tasks decoupled from an immediate UI click response (`202 Accepted` + status polling).
- **Breaks when assumed:** Moving slow work to a queue does not eliminate failure — it shifts failure handling from a synchronous HTTP error into worker crashes, redeliveries, visibility timeouts, and duplicate-effect protection.

## Deep Dive
When a worker pulls a "charge invoice" job, calls the payment gateway, and gets OOM-killed 5 ms before calling `channel.ack(msg)`, the broker sees an unacknowledged delivery and redelivers the job to a healthy worker. Neither RabbitMQ nor SQS can roll back the external side effect or know whether it ran. Transport acknowledgement only tracks *message custody*; preventing duplicate business effects belongs to the downstream owner via idempotency and durable state coordination.

## Common Misconceptions
- Treating broker acknowledgements or "exactly-once queue" marketing claims as proof an external business side effect ran once.
- Acknowledging messages immediately upon receipt and assuming the worker will always stay alive to finish them.

## Practice Questions
- A worker writes to Postgres and crashes right before sending `ack` to the broker. What happens next, and which boundary is responsible for preventing a duplicate effect?
- Contrast the failure mode of `ack-before-work` vs `ack-after-work` when a worker restarts mid-job.

## Sources
- [RabbitMQ acknowledgements and confirms](https://www.rabbitmq.com/docs/confirms)

## Course route
[Queue delivery, retries and uncertain outcomes](../units/b04.md)
