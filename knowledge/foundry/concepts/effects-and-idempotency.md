---
id: effects-and-idempotency
title: Effects and Idempotency
difficulty: 3
prerequisites: [dispatch-spine]
tags: [mechanics, invariants, dispatch]
---

## Summary
Every external side effect — http, llm, email — gets a row in the `effects` ledger keyed by an idempotency key. A retried run consults the ledger before acting, so a retry never re-performs a completed effect. Effects also carry a **risk class**: `read | record | act | spend`.

## Key Points
- `effects` columns: `run_id`, `idempotency_key`, `kind (http|llm|email|…)`, `target`, `status`, `response_hash`.
- A retried run **checks the ledger before re-performing**.
- Risk classes: `read` (fetch within the target's policy), `record` (uow writes into service schemas), `act` (leaves the platform — email, message, form submission), `spend` (crosses a meter threshold).
- **Crawl and ingest contracts are granted no `act` effects at all.**
- `effects` is an *operational* table — pruned at 7 days, which bounds how long an idempotency window may be.
- Retry logic and the effects ledger are platform code every service inherits rather than reimplements.

## Deep Dive
Idempotency is the "I" in ADR-0002's replacement for read-only safety. Once you accept that the platform performs real external effects, retries become dangerous: the lease can expire mid-run, the worker can crash after sending an email but before committing, and the run will be re-queued. Without a ledger, the second attempt sends the email again.

The ledger makes the effect itself the unit of idempotency rather than the run. A run may legitimately re-execute; the effects it already completed are skipped by key. This is what lets the queue be aggressive about re-queuing crashed work — the recovery path is safe by construction.

Risk classes are the join between this machinery and the containment model. Classifying every effect means the system can state a policy like "an `act` effect with tainted inputs requires escalation" and *enforce* it at a boundary, rather than trusting each handler to notice. And the strongest form of that policy is a grant that simply does not exist: crawl and ingest contracts get **no `act` effects at all**, so the code paths that touch attacker-controlled text cannot email anyone even if fully compromised.

## Practice Questions
1. A worker crashes after sending an email but before committing. What stops the retry from sending it twice?
2. Name the four risk classes and give an example of each.
3. Why are crawl and ingest contracts granted zero `act` effects?
4. `effects` prunes at 7 days. What does that constrain?
5. Why is the *effect* the unit of idempotency rather than the run?

## Common Misconceptions
- "Idempotency is the handler's job" → It is platform code every service inherits, backed by a ledger.
- "A retried run redoes everything" → It consults the effects ledger and skips completed effects.
- "Risk class is documentation" → It gates escalation for tainted `act`/`spend` effects at a boundary.

## References
- `docs/sdd/data-model.md` §4 — effects
- `docs/adr/0002-foundry-mutates-and-dispatches.md`
- `docs/adr/0018-prompt-injection-containment.md`
- `packages/tasks/src/{effects,ctx-effect,hash}.ts`
