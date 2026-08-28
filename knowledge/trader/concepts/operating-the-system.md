---
id: operating-the-system
title: Operating the System
difficulty: 3
prerequisites: [store-and-journal, human-approval-gate]
tags: [judgment, operations]
---

## Summary

Five commands and one rule. The commands are `scan`, `ui`, `nav`, `watchdog` and `flatten`. The rule is ADR-026: **exactly one machine may hold a store for one account.** Everything else about operating this system follows from those — including why nothing is ever installed by a ticket, why the NAV snapshot has its own entry point, and why the kill switch deliberately ignores the calendar.

## Key Points

- `npm run scan -- config.local.json` — the daily unattended run (`manage` mode). `npm run ui -- config.local.json` — the approval desk on `127.0.0.1:7777`.
- `npm run nav` — one reading of the account and the universe, appended **once per session**. Places no orders, never touches the position store, does not take the lock.
- `npm run watchdog` — a **separate process** that reads artifacts only. One credentialed read-only call. It cannot trade, cancel, flatten, or modify the store.
- `npm run flatten` — the kill switch. Cancels every outstanding entry, then market-sells every open position.
- `npm run demo` runs the UI against `config.demo.json` and `state-demo/` fixtures — a real separate state directory, not seeded rows in `state/`, because a fabricated row is forever.
- **ADR-026**: `agent-mini` runs the unattended scan and watchdog and **owns `state/`**; the laptop is dev plus an SSH tunnel to the desk. Two checkouts each with a store are "two books that both believe they are authoritative, and the failure is silent."
- **`crontab <file>` REPLACES the table.** The example file documents an **append**. Installation is a human act, always — and the pre-install backup must be an exact prefix of the new table.
- Verifying the binary is not verifying the path that invokes it: cron jobs are tested under `env -i` with no login shell.

## Deep Dive

**Why NAV has its own entry point.** A record that exists only when the scan succeeds is missing on exactly the mornings something went wrong. *"It must not share a failure mode with the thing it measures."* The rules that follow are all instances of gaps-over-fabrications:

- A **non-trading day appends nothing** — "a row for a day the market never opened is not a missing observation, it is a wrong one, and wrong is worse: a gap announces itself and a fabricated flat day does not."
- An **account read failure appends nothing** — "a NAV series with a hole in it can be repaired from the broker later; one with a zero in it looks like a catastrophic session forever."
- Missing credentials → exit 2, fail closed and say so.
- Running it twice in a day appends nothing the second time and reports success.

**The watchdog's seven alerts:** `missed-run`, `failed-run`, `book-mismatch` (critical); `broker-unreadable`, `stale-store`, `claude-step-missing`, `claude-step-failed` (warning). Exit 1 only on a critical.

Three details worth carrying:

- `book-mismatch` is computed **only when both sides are present**. Defaulting a missing side to zero "would manufacture a mismatch out of an absent control." A missing side gets its own warning instead.
- Deadlines are resolved in the **deadline's own timezone** using `hourCycle: 'h23'`, never fixed-offset arithmetic — "that is what breaks silently across a DST transition."
- When there are zero alerts, it fires a once-per-session **"trader: ok"** heartbeat. G8 applied to alarms: *"a channel that has been silent for months is indistinguishable from a broken one."* And if the notification channel is unconfigured or delivery fails, the alert is still written locally and still sets the exit code — "an unconfigured channel must degrade to a loud local record, never to silence."

Its stated blind spot: **one receipt for the session satisfies the Claude check.** If the 08:15 producer writes and the 09:20 brief silently never runs, the watchdog stays quiet — catching that would require knowing which seams were *scheduled*, which lives in a crontab it cannot read and must not guess at.

**The kill switch, and its two deliberate properties.**

1. **It does not depend on the data layer.** No bars, no scoring, no universe, no adjustment — because the likeliest reason an operator reaches for it is that the data layer *is* what is broken. The calendar is consulted **only to warn**: "a refusal they cannot override is a control that fails in the dangerous direction."
2. **It reuses the existing exit machinery** — the same `buildExitOrder`, the same session-stable `clientOrderId`, the same adapter, store and lock.

Usage is `trader-flatten <config.json> --reason "<why>" [--yes]`. `--reason` is required **even under `--yes`** (G11). Without `--yes` the operator types the literal string `FLATTEN`. Ordering is load-bearing: entries are cancelled **before** exits are submitted, or an entry filling mid-flatten adds exposure behind it.

**The most important field in that file** is `filledNotCancelled`. `cancel` returns `already-terminal` for *both* a cancelled order and a **filled** one; only the status separates them. The old code cleared `pendingEntries` unconditionally, so an entry that filled seconds before the kill switch had its record deleted while the shares sat in the account — no position, no stop, no cap charge, and E13 free to buy the name again tomorrow. Such entries are now kept, reported loudly, and counted into `positionsRemaining` so that `positionsRemaining: 0` genuinely means a flat account. An entry whose cancel *threw* is also kept: uncertainty resolves toward keeping the record.

That fix produced a general lesson too. The defect lived in one expression inside `main()` that no test could reach — a mutation reverting `pendingEntries` to `[]` left all twelve flatten tests green. `storeAfterFlatten` was extracted as a pure function specifically so a test could reach it.

**The idea log.** `state/ideas.jsonl` is the operator's own channel, append-only. The approval journal records why a bet was *taken*; it has nowhere to put "MU looks like it's rolling over" — "the thought that arrives at 09:00 and is gone by 09:05." Nothing in the system edits or deletes a recorded idea: *"a log you can tidy is a log that will be tidied into agreeing with whatever you believe now."* And `readIdeas` returns newest-first **by position**, not by timestamp, so a bad clock cannot reorder it.

**The inbox seam.** An external producer drops JSONL under `state/inbox/`; the desk reads and **never writes there** — "the producer owns that directory's lifecycle, and a consumer that tidies up is a consumer that can destroy an undelivered item." An item is **shown and recorded, never a gate**: it changes no proposal, no cap, no score, no ordering. Per the ratified cadence, *"intraday listeners may protect, never decide."*

## Practice Questions

- The morning scan did not run. Which artifact tells you, and which process is supposed to notice?
- You need to be flat right now and the data layer is throwing. Which command, and why can you trust it in that state?
- Why does `nav` have its own entry point rather than being a few lines inside the scan?
- Two developers both have a checkout with a `state/` directory pointed at the same paper account. What breaks, and which control detects it?
- The watchdog reports nothing for three weeks. Is that good news? What did the design do about that question?

## Common Misconceptions

- "The watchdog can stop a bad run." → It reads artifacts and raises alerts. It has no authority to act.
- "Silence from the watchdog means healthy." → That is exactly why the heartbeat exists.
- "The kill switch guarantees a flat account." → It reports honestly. An entry that filled just before it is *kept* and flagged, and counted in `positionsRemaining`.
- "Installing the cron entry is part of the ticket." → It is a system change and needs a human. `crontab <file>` replaces the table; the example documents an append.
- "Testing the command proves the cron job works." → Verifying the binary is not verifying the path that invokes it. Run it under `env -i` with no login shell.
- "The demo seeds sample rows into `state/`." → It uses a separate `state-demo/` directory. A fabricated row is forever.

## References

- `src/cli/nav.ts` — `navOnce`, the append-once and refuse-rather-than-fabricate rules
- `src/cli/watchdog.ts`, `src/watchdog/assess.ts` — the alert set and the heartbeat
- `src/cli/flatten.ts` — ordering, `filledNotCancelled`, `storeAfterFlatten`
- `src/inbox/index.ts`, `src/ideas/index.ts` — the read-only seam and the idea log
- `DECISIONS.md` ADR-024 (unattended exits), ADR-026 (one machine, one store)
- `docs/paper-trial-runbook.md`, `docs/manual-playbook.md`
