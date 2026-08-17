---
id: dispatch-spine
title: The Dispatch Spine
difficulty: 3
prerequisites: [platform-nouns]
tags: [mechanics, dispatch, invariants]
---

## Summary
The dispatch spine is the platform's core mechanism: task runs live in Postgres, workers claim them with `FOR UPDATE SKIP LOCKED` and hold a heartbeated lease, and the enqueue happens **in the same transaction as the mutation and the audit row**. There is no Redis. Schedules only enqueue; they never do work.

## Key Points
- Queue is Postgres, not Redis (ADR-0006). Workers poll with `FOR UPDATE SKIP LOCKED`.
- Lease with heartbeat + visibility timeout; release on crash. Expiry re-queues the run.
- States: `queued → leased → running → succeeded | failed | dead`, plus the parked **non-terminal** `awaiting_approval`.
- `awaiting_approval` is parked on a pending ADR-0018 approval — **it is not terminal, so it is never pruned**. An approval gate never fakes a terminal.
- **Schedules only enqueue** — no work in the scheduler process. The single-process nexus pattern is explicitly rejected for platform use.
- Enqueue is in the same transaction as the mutation + audit row: a dispatched task can never exist without its audit trail, and vice versa.
- **Execution lanes:** the leased-worker lane is the only one built, but the handler ctx is **lane-agnostic by contract** — nothing in `packages/` may assume its caller is a leased worker.

## Deep Dive
Choosing Postgres over Redis is what makes the atomic enqueue possible at all. If the queue lived in Redis, enqueuing inside the mutation's transaction would be a distributed-transaction problem, and the guarantee "a dispatched task always has its audit row" would degrade into a best-effort dual write. Putting the queue in the same database turns that guarantee into a property of one `COMMIT`.

`FOR UPDATE SKIP LOCKED` is the pattern that makes a Postgres queue work under concurrency: each poller locks the rows it claims and skips rows already locked, so N workers pull disjoint work without coordinating.

The `awaiting_approval` state repays attention. When ADR-0018's gate requires human approval before an `act` effect, the run has to wait — possibly for hours. The tempting shortcut is to mark it `succeeded` (or `failed`) and start a fresh run on approval. The spec rejects that in one clause: *an approval gate never fakes a terminal*. Two reasons — a false terminal corrupts the record of what happened, and terminal runs are pruned at 7 days, so a run parked for a week would be deleted while still waiting.

The lane note is a seam being held open on purpose. Conversation-shaped apps (tutoring, advising) will need a **synchronous interactive lane** with per-turn budgets, invoked from the api side. The design keeps ctx lane-agnostic *now* so that lane arrives later as a new runner rather than a kernel rewrite — and it will come by ADR, as a deliberately-designed exception to "api never runs tasks."

## Practice Questions
1. Why is the queue in Postgres rather than Redis? Name the guarantee that choice buys.
2. What does `FOR UPDATE SKIP LOCKED` accomplish?
3. `awaiting_approval` is non-terminal. Give both reasons why faking a terminal would be wrong.
4. A schedule fires. What is the scheduler process allowed to do?
5. What does "the handler ctx is lane-agnostic by contract" forbid `packages/` from assuming?

## Common Misconceptions
- "A queue needs Redis for throughput" → Postgres with SKIP LOCKED, chosen so enqueue can share the mutation's transaction.
- "awaiting_approval is a terminal state" → Non-terminal, deliberately, so it is never pruned.
- "The scheduler runs the work" → Schedules only enqueue. The single-process pattern is explicitly rejected.
- "Interactive chat apps will need a kernel rewrite" → ctx is lane-agnostic now so the interactive lane is a new runner, arriving by ADR.

## References
- `docs/sdd/architecture.md` §3 — the dispatch spine
- `docs/adr/0006-task-queue-in-postgres.md`
- `docs/sdd/data-model.md` §4 — Dispatch
- `packages/tasks/src/{lease,poll,park,terminal}.ts`
