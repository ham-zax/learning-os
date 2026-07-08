# System Design: Payment Gateway (Airwallex-style)

## Problem Statement
Design a cross-border payment processing system that handles currency conversion, transaction processing, and settlement across multiple countries.

## Requirements

### Functional
- Process payments in 100+ currencies
- Real-time FX rate lookup and conversion
- Idempotent transaction processing
- Transaction status tracking
- Webhook notifications to merchants

### Non-Functional
- **Availability:** 99.99% (52 min downtime/year)
- **Latency:** p99 < 500ms for payment initiation
- **Throughput:** 10,000 TPS peak
- **Consistency:** Strong for financial data, eventual for analytics

## High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Merchant    │────▶│  API Gateway │────▶│  Payment Service │
│  (Client)    │     │  (Rate Limit)│     │  (Orchestrator)  │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────┐
                    │                              │                          │
                    ▼                              ▼                          ▼
           ┌───────────────┐            ┌──────────────┐           ┌──────────────┐
           │ FX Service    │            │ Ledger       │           │ Notification │
           │ (Rate Lookup) │            │ Service      │           │ Service      │
           └───────────────┘            └──────────────┘           └──────────────┘
                    │                              │
                    ▼                              ▼
           ┌───────────────┐            ┌──────────────┐
           │ Rate Provider │            │ Database     │
           │ (External API)│            │ (PostgreSQL) │
           └───────────────┘            └──────────────┘
```

## Core Components

### 1. API Gateway
- **Rate limiting:** Token bucket per merchant
- **Authentication:** API key + HMAC signature
- **Idempotency:** Client-generated idempotency key
- **Routing:** Path-based routing to services

### 2. Payment Service (Orchestrator)
- **State machine:** `CREATED → PROCESSING → COMPLETED/FAILED`
- **Saga pattern:** Distributed transaction across services
- **Retry logic:** Exponential backoff with dead letter queue

```python
class PaymentStateMachine:
    STATES = {
        'CREATED': ['PROCESSING'],
        'PROCESSING': ['COMPLETED', 'FAILED'],
        'FAILED': ['RETRYING'],
        'RETRYING': ['PROCESSING', 'DEAD'],
    }
```

### 3. FX Service
- **Caching:** Redis with 5s TTL for rates
- **Fallback:** Multiple rate providers (primary + backup)
- **Rate locking:** Lock rate for 30s during transaction

```
Rate Lookup Flow:
1. Check Redis cache (5s TTL)
2. If miss → call primary provider
3. If primary fails → call backup provider
4. Cache result with TTL
5. Return rate + timestamp + provider
```

### 4. Ledger Service (CQRS + Event Sourcing)
- **Command side:** Process debit/credit commands
- **Query side:** Optimized read models for balance/history
- **Event store:** Immutable append-only log

```
Event: PaymentCompleted
  - transaction_id: "txn_123"
  - debit: {account: "merchant_A", amount: 100, currency: "USD"}
  - credit: {account: "merchant_B", amount: 92, currency: "EUR"}
  - fx_rate: 0.92
  - timestamp: "2026-06-22T10:00:00Z"
```

## Key Design Decisions

### Idempotency
```
Client sends: idempotency_key = "merchant_txn_123"

Server flow:
1. Check if key exists in Redis/DB
2. If exists → return cached response
3. If not → process payment, store key + response
4. Return response

Storage: Redis with 24h TTL + DB for durability
```

### Exactly-Once Semantics
- **At-least-once delivery** + **idempotent processing** = exactly-once
- Use message deduplication in Kafka/SQS
- Database unique constraints on transaction_id

### Rate Locking
```
Problem: Rate changes between quote and execution

Solution:
1. Quote: Return rate + lock_id + expiry (30s)
2. Execute: Include lock_id, verify rate hasn't changed
3. If rate changed: Reject, request new quote

Storage: Redis with TTL = lock duration
```

## Database Design

### Transactions Table
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    source_amount DECIMAL(20,8),
    source_currency VARCHAR(3),
    target_amount DECIMAL(20,8),
    target_currency VARCHAR(3),
    fx_rate DECIMAL(20,8),
    status VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    INDEX idx_merchant_status (merchant_id, status),
    INDEX idx_created (created_at)
);
```

### Event Store
```sql
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(50),
    event_type VARCHAR(50),
    event_data JSONB,
    version INT,
    created_at TIMESTAMP,
    UNIQUE(aggregate_id, version)
);
```

## Scaling Considerations

### Database Sharding
- **Shard key:** merchant_id (most queries are per-merchant)
- **Cross-shard:** Use event sourcing for consistency
- **Read replicas:** For analytics and reporting

### Caching Strategy
```
L1: Application cache (in-memory, 1s TTL)
L2: Redis (5s TTL for rates, 24h for idempotency)
L3: Database (source of truth)
```

### Message Queue
- **Kafka:** For event sourcing and audit log
- **SQS:** For webhook delivery (retry with backoff)
- **Dead letter:** Failed messages for manual review

## Monitoring & Alerting

### Key Metrics
- Transaction success rate (target: >99.9%)
- p99 latency (target: <500ms)
- FX rate staleness (target: <5s)
- Queue depth (alert if >10k)

### Distributed Tracing
```
Trace: txn_123
├── API Gateway: 10ms
├── Payment Service: 50ms
│   ├── FX Service: 20ms
│   └── Ledger Service: 30ms
└── Notification Service: 5ms (async)
```

## Failure Scenarios

| Failure | Impact | Mitigation |
|---------|--------|------------|
| FX provider down | Can't quote rates | Backup provider, cached rates |
| Database down | Can't process | Read replicas, circuit breaker |
| Network partition | Partial failures | Saga compensation, retry |
| Rate spike | Stale quotes | Short TTL, rate locking |

## Interview Tips
1. **Start with requirements** — Don't jump to architecture
2. **Draw the diagram** — Visual helps organize thinking
3. **Call out trade-offs** — Consistency vs availability, latency vs durability
4. **Mention Airwallex context** — Cross-border, multi-currency, high volume
5. **Discuss failure modes** — What breaks and how to handle it
