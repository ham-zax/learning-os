---
tags:
  - system-design
  - airwallex
  - fintech
  - payments
aliases:
  - payment-processing
  - cross-border-payments
  - fx-engine
last-updated: 2026-06-22
type: concept
---

# Payment Systems — Interview Guide

> [!tip] Airwallex is a payment company. Domain knowledge shows you understand their business.

## Key Concepts

### Payment Flow (Simplified)

```
Customer → Merchant → Payment Gateway → Acquirer → Card Network → Issuer
                                                           ↓
                                                     Authorization
                                                           ↓
Customer ← Merchant ← Payment Gateway ← Acquirer ← Card Network ← Issuer
```

**Cross-border payment flow:**
```
Sender (AUD) → Airwallex → FX Conversion → Local Rail (FPS/ACH/SEPA) → Receiver (USD)
                    ↓
              Correspondent Bank (if needed)
                    ↓
              SWIFT (for international)
```

### Key Terms

| Term | Meaning | Interview relevance |
|------|---------|-------------------|
| **Acquirer** | Bank that processes merchant payments | Payment flow design |
| **Issuer** | Bank that issued the customer's card | Authorization flow |
| **Settlement** | Actual money transfer between banks | T+1, T+2 delays |
| **Reconciliation** | Matching internal records with bank statements | System design question |
| **Idempotency** | Same operation produces same result | Critical for payments |
| **Double-entry** | Every transaction has debit AND credit | Ledger design |
| **FX Rate** | Exchange rate between currencies | Currency conversion |
| **SWIFT** | International bank messaging network | Cross-border payments |
| **Local Rails** | Domestic payment networks (FPS, ACH, SEPA) | Faster/cheaper than SWIFT |

### Payment States

```
Created → Pending → Authorized → Captured → Settled → Completed
                ↓           ↓          ↓
            Declined    Refunded   Failed
```

### Idempotency (CRITICAL for payments)

**Problem:** What if a network timeout causes a retry? You don't want to charge twice.

**Solution:** Idempotency key
```
Client sends: POST /payments {idempotency_key: "abc123", amount: 100}

Server:
1. Check if "abc123" already exists in idempotency store
2. If yes → return existing result (don't process again)
3. If no → process payment, store result with key "abc123"
```

**Implementation:**
```python
def process_payment(request):
    idempotency_key = request.headers['Idempotency-Key']

    # Check if already processed
    existing = idempotency_store.get(idempotency_key)
    if existing:
        return existing  # Return same result

    # Process payment
    result = do_payment(request)

    # Store result
    idempotency_store.set(idempotency_key, result)
    return result
```

### Reconciliation

**Problem:** Internal records may not match bank statements.

**Why?** Network failures, partial settlements, timing differences, fees.

**Approach:**
1. Export internal transaction records
2. Fetch bank statement
3. Match by amount, date, reference
4. Flag discrepancies
5. Investigate and resolve

### Double-Entry Bookkeeping

**Every transaction has two entries:**
```
Transfer $100 from Account A to Account B:

Account A: -$100 (debit)
Account B: +$100 (credit)

Total debits = Total credits (always balanced)
```

**Why?** Audit trail, error detection, compliance.

## Airwallex Domain Knowledge

### Core Products
1. **Global Account** — Multi-currency account for businesses
2. **FX Conversion** — Real-time currency exchange
3. **Cross-border Payments** — Send money internationally
4. **Card Issuing** — Virtual/physical cards
5. **Payment Acceptance** — Accept payments from customers

### Architecture (from blog/GitHub)
- **Auticuro** — Wallet service (CQRS + Event Sourcing, Rust)
- **AirSkiff** — Stream processing (Flink/Spark)
- **FX Engine** — Real-time rates, forward lock-in, hedging
- **Payment Rail Selection** — SWIFT vs local rails (cost/speed/tradeoff)

### Payment Rail Selection
| Rail | Speed | Cost | Use Case |
|------|-------|------|----------|
| SWIFT | 1-5 days | High | International, large amounts |
| FPS (UK) | Instant | Low | UK domestic |
| ACH (US) | 1-3 days | Low | US domestic |
| SEPA (EU) | 1 day | Low | EU domestic |

**Decision logic:** Choose rail based on corridor, amount, urgency, cost.

## System Design Talking Points

**When asked "Design a payment system":**
1. "I'd separate the payment flow into stages: authorization, capture, settlement"
2. "Use idempotency keys to prevent duplicate charges"
3. "For cross-border, use a payment rail selector based on cost/speed tradeoffs"
4. "Reconciliation engine matches internal records with bank statements"
5. "Event sourcing for audit trail — every state change is an event"

**When asked about currency conversion:**
1. "Model currencies as a graph — each currency is a node, exchange rate is an edge"
2. "Find optimal path using shortest path algorithm (Bellman-Ford)"
3. "Detect arbitrage opportunities (negative cycles)"
4. "Cache rates with TTL — rates change frequently"

## Quick Reference

| Concept | Definition | Why It Matters |
|---------|-----------|----------------|
| Idempotency | Same input → same output | Prevent double charges |
| Double-entry | Debit + Credit for every tx | Audit trail, balance check |
| Reconciliation | Match records with bank | Detect discrepancies |
| Settlement | Actual money transfer | T+1/T+2 delays |
| Event Sourcing | Store events not state | Compliance, debugging |
| CQRS | Separate read/write | Scale, optimize each path |
