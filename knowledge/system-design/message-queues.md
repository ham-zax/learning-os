# Message Queues

## Definition
A message queue is an intermediary that enables asynchronous communication between services. Producers send messages to a queue, and consumers process them independently. This decouples services, handles load spikes, and enables reliable event processing.

## Key Terms
- **Producer**: Service that sends messages to the queue.
- **Consumer**: Service that reads and processes messages.
- **Queue vs Topic**: Queue = point-to-point (one consumer). Topic = pub/sub (multiple subscribers).
- **At-most-once delivery**: Message delivered once or not at all — may lose messages.
- **At-least-once delivery**: Message delivered at least once — may have duplicates. Most common.
- **Exactly-once delivery**: Ideal but hard — requires idempotent consumers + deduplication.
- **Dead letter queue (DLQ)**: Where failed/unprocessable messages go for manual review.
- **Backpressure**: When consumers can't keep up — queue grows, may need scaling or throttling.
- **Kafka**: Distributed log — durable, ordered, high-throughput. Good for event streaming.
- **RabbitMQ**: Traditional message broker — flexible routing, good for task queues.
- **SQS**: AWS managed queue — simple, scales automatically.
- **Idempotency**: Processing the same message multiple times produces the same result.

## Why It Matters
Message queues are the backbone of microservice architectures. They handle async workflows, decouple services, and smooth out traffic spikes. Interviewers test whether you know when to use sync vs async communication.

## Interview Questions
1. "How would you handle a spike in order processing?"
2. "What's the difference between Kafka and RabbitMQ?"
3. "How do you ensure messages aren't lost?"

## Gotchas
- At-least-once means consumers MUST be idempotent — duplicates will happen.
- Kafka maintains message order per partition, not globally — design partition keys carefully.
- DLQs are essential — without them, poison messages block the queue forever.
- Don't use message queues for request-response — they're for fire-and-forget or event-driven patterns.
- Consumer group scaling: Kafka = partition count limits parallelism. RabbitMQ = competing consumers.
