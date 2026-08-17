---
id: metering-and-budget
title: Metering and Budget
difficulty: 2
prerequisites: [dispatch-spine]
tags: [mechanics, cost, dispatch]
---

## Summary
Every run records what it consumed in `cost_entries` — LLM tokens, embedding tokens, proxy bytes, browser seconds, storage bytes. Finance and engineering read the same numbers. Budget refusal happens at lease time against a task definition's daily ceiling, and per-run via a budget tracker that aborts on crossing.

## Key Points
- Meters: `llm_tokens_in/out`, `embed_tokens`, `proxy_bytes`, `browser_seconds`, `storage_bytes`.
- `cost_entries`: `run_id, meter, quantity, unit_cost_usd?, at`. Summed per run / day / task_def.
- **"Finance reads the same numbers as engineering"** — one measurement, not two systems.
- `cost_entries` is retained forever but **run-covered** for audit: meter rows never get their own audit entries.
- Enforcement points: `packages/tasks/src/budget.ts` refuses at **lease time** on a def's daily ceiling; agent-runtime's `BudgetTracker` aborts on a **per-run** cross; `kernel/errors.ts` maps `BUDGET_EXCEEDED: 402`.
- On budget exceeded, the run stops at the ceiling, **partial work commits with audit**, and an alert fires.
- Per-customer enforcement is the part that does not exist yet.

## Deep Dive
The design claim worth internalising is that cost is a first-class run property, not an observability afterthought. Because the meter row is written against the run, the same query answers "what did this run cost", "what does this task type cost per day", and "what is our monthly LLM spend". A separate finance pipeline reading vendor invoices would drift from engineering's view within a month.

Note the failure behaviour. On budget exceeded, the run does **not** roll back — it stops at the ceiling and **commits partial work with its audit row**. That follows directly from the uow: whatever was written was written inside a transaction with its audit row, so it is real and attributable. Discarding it would create the one thing the design refuses — state that happened but is not recorded, or work that is recorded as never having happened.

Be careful about the STATUS-level claim "metering exists; enforcement doesn't." That was true once and is now only true *per-customer*: def-level daily ceilings and per-run aborts both exist in code. This is a good example of a live document lagging the codebase — and of why the repo's own rule is that when STATUS disagrees with the code or the tickets, the code and tickets win.

## Practice Questions
1. Name three meters and say where the rows live.
2. A run crosses its budget mid-way. What happens to the work it already did, and why?
3. Where are the two enforcement points, and what does each check?
4. What HTTP status does `BUDGET_EXCEEDED` map to?
5. Why is it a design goal that finance and engineering read the same numbers?

## Common Misconceptions
- "Budget enforcement doesn't exist yet" → Def-level daily ceilings and per-run aborts exist. **Per-customer** enforcement is what is missing.
- "Exceeding budget rolls the run back" → It stops at the ceiling and commits partial work with audit.
- "Cost tracking is an observability concern" → It is a run property in the system of record, retained forever.

## References
- `docs/sdd/data-model.md` §4 — cost_entries
- `docs/sdd/architecture.md` §3, §7
- `packages/tasks/src/budget.ts`, `packages/kernel/src/errors.ts`
