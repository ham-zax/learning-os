---
id: platform-nouns
title: The Platform Nouns
difficulty: 2
prerequisites: [reserved-vocabulary]
tags: [vocabulary, foundation, dispatch]
---

## Summary
The platform's vocabulary is small and precise. Task is a *kind* of work; TaskRun is one *occurrence*; Dispatch is the act of enqueuing plus the abstraction over where it runs; Actor is who acted; Resource is what was acted on, always as an opaque pair. Effect, Lease, Meter and Risk class complete the set.

## Key Points
- **Task** — a definition, not an occurrence. A row in `platform.task_defs`: name, contract version, handler, default budget, schedule.
- **TaskRun** — one occurrence, with states `queued → leased → running → succeeded | failed | dead`, plus the parked non-terminal `awaiting_approval`.
- **Dispatch** — enqueuing a TaskRun, and the abstraction over *where* it executes (in-process worker, remote worker, or LLM agent) behind one interface.
- **Actor** — who acted: `actor_kind ∈ {human, agent, system}`. Agents are first-class, never folded into `system`.
- **Resource** — what was acted on, as an opaque `(resourceType, resourceId)` pair. The platform never holds a foreign key into a service or app table.
- **Effect** — one external side effect (http, llm, email…), keyed by an idempotency key so a retry never repeats it.
- **Lease** — a time-bounded claim on a TaskRun held with a heartbeat; expiry re-queues the run.
- **Meter** — a unit of consumption recorded against a run: `llm_tokens_in/out`, `embed_tokens`, `proxy_bytes`, `browser_seconds`, `storage_bytes`.
- **Risk class** — per-effect: `read | record | act | spend`.

## Deep Dive
Two of these carry more weight than their one-line definitions suggest.

**Resource being opaque** is what makes the platform survive app deletion. Platform tables reference domain objects only as `(resourceType, resourceId)` strings — never as a foreign key. So the audit log can record "actor X did Y to `posting/psg_01H…`" without the platform schema knowing that postings exist. Delete the app, and the platform still compiles and its data still validates.

**Actor distinguishing `agent` from `system`** is a governance decision, not a taxonomy preference. ADR-0007 states it directly: agents are first-class, not "system". If every agent action were attributed to "system", the audit log could tell you a machine did something but never *which* crew member, and accountability for an autonomous crew would collapse into a single anonymous bucket.

Note also the shape of `Lease`: because a lease is time-bounded and heartbeated, **a crashed worker costs a lease, not a run.** The run returns to the queue when the lease expires. That single property is why the queue needs no separate crash-recovery mechanism.

## Practice Questions
1. Distinguish Task from TaskRun. Which one has a state machine?
2. What is a Resource, technically, and what does that representation make possible?
3. Why is `agent` a separate `actor_kind` rather than a flavour of `system`?
4. A worker process is killed mid-run. Walk through what happens and what it costs.
5. What is a Meter, and name three of them.

## Common Misconceptions
- "TaskRun and Task are the same thing" → Task is the definition (`task_defs`); TaskRun is one occurrence with its own lifecycle and cost.
- "Resource is a foreign key" → It is deliberately an opaque `(type, id)` string pair. No FK from platform to any app table.
- "Agents are a kind of system actor" → Explicitly rejected by ADR-0007. Agents are first-class actors.
- "A crashed worker loses the run" → It loses the *lease*. The run re-queues; completed effects are skipped by idempotency key.

## References
- `docs/glossary.md` §1 — Platform vocabulary
- `docs/sdd/architecture.md` §3 — the dispatch spine
- `docs/adr/0007-audit-and-unit-of-work.md`
