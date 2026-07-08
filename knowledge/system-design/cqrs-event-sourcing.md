---
tags:
  - system-design
  - airwallex
  - architecture
aliases:
  - CQRS
  - Event Sourcing
  - event-sourced
last-updated: 2026-06-22
type: concept
---

# CQRS + Event Sourcing — Interview Guide

> [!tip] Airwallex's Auticuro wallet uses this pattern. Expect it in system design rounds.

## The Problem It Solves

Traditional CRUD: one model handles reads AND writes. Works fine until:
- Read and write patterns diverge (reads need denormalized views, writes need strict validation)
- You need an audit trail (financial systems REQUIRE this)
- You need to replay state (debugging, compliance, point-in-time recovery)

## CQRS (Command Query Responsibility Segregation)

**Core idea:** Separate the write model (commands) from the read model (queries).

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│  Command API │────▶│  Write Model │
│              │     │  (POST/PUT)  │     │  (normalized)│
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                                          ┌─────▼──────┐
                                          │   Event     │
                                          │   Store     │
                                          └─────┬──────┘
                                                │
┌─────────────┐     ┌──────────────┐     ┌──────▼───────┐
│   Client     │────▶│  Query API   │────▶│  Read Model  │
│              │     │  (GET)       │     │ (denormalized│
└─────────────┘     └──────────────┘     │  for queries)│
                                          └──────────────┘
```

**Why separate?**
- Write model: optimized for validation, consistency, business rules
- Read model: optimized for fast queries, can be denormalized, cached
- They can scale independently (reads usually 10-100x more than writes)

## Event Sourcing

**Core idea:** Instead of storing current state, store ALL events that led to current state.

**Traditional approach:**
```
Account balance = $500  (just the current value)
```

**Event Sourcing approach:**
```
Event 1: AccountCreated(id=123, balance=0)
Event 2: MoneyDeposited(id=123, amount=1000)
Event 3: MoneyWithdrawn(id=123, amount=500)
→ Current balance = 0 + 1000 - 500 = $500
```

**Why?**
- **Audit trail:** Every change is recorded (financial compliance)
- **Time travel:** Reconstruct state at any point in time
- **Debugging:** Replay events to understand what happened
- **Event-driven:** Other services can subscribe to events

## How They Work Together

CQRS + Event Sourcing are often combined:

1. **Commands** produce **events** (write side)
2. Events are stored in **event store** (append-only log)
3. Events are projected into **read models** (query side)
4. Read models are denormalized views optimized for specific queries

```
Command: TransferMoney(from=A, to=B, amount=100)
  ↓
Event: MoneyTransferred(from=A, to=B, amount=100, timestamp=...)
  ↓
Event Store: [append event to log]
  ↓
Projection 1: Update Account A balance view (-100)
Projection 2: Update Account B balance view (+100)
Projection 3: Update transaction history view
```

## Airwallex Context: Auticuro

Auticuro is Airwallex's wallet service. Key facts:
- **91.1% Rust** — high performance
- **CQRS + Event Sourcing** — every wallet transaction is an event
- **Raft consensus** — distributed agreement for consistency
- **P99 < 20ms @ 10K TPS** — latency-sensitive

**Why this pattern for a wallet?**
- Financial regulations require audit trails
- Need to reconstruct balance at any point in time
- Multiple views of the same data (balance, history, analytics)
- High throughput reads (balance checks) vs writes (transactions)

## Interview Talking Points

**When asked "Design a payment system" or "Design a multi-currency wallet":**

1. "I'd use CQRS to separate the write path (transactions) from the read path (balance queries)"
2. "For the write model, I'd use Event Sourcing — every transaction is an immutable event"
3. "This gives us an audit trail for compliance, and we can replay events for debugging"
4. "Read models can be denormalized for fast queries — e.g., a materialized view for balance"
5. "For consistency, we'd use Raft consensus or a strong consistency model"

**Common follow-ups:**
- "How do you handle eventual consistency?" → Projections catch up; use read-your-writes for critical paths
- "What if the event store is down?" → Write-ahead log, replication, circuit breaker
- "How do you handle schema evolution?" → Event versioning, upcasting

## Quick Reference

| Concept | What | Why |
|---------|------|-----|
| CQRS | Separate read/write models | Scale independently, optimize each |
| Event Sourcing | Store events, not state | Audit trail, time travel, event-driven |
| Event Store | Append-only log of events | Immutable, ordered, replayable |
| Projection | Transform events into read views | Denormalized for fast queries |
| Raft Consensus | Distributed agreement protocol | Strong consistency across nodes |

## Related
- [[knowledge/system-design/event-driven-architecture|Event-Driven Architecture]]
- [[knowledge/airwallex-interview-prep|Airwallex Interview Prep]]
