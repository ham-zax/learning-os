---
id: the-scan-pipeline
title: The Scan Pipeline
difficulty: 1
prerequisites: [what-trader-is, fail-closed]
tags: [foundation, architecture]
---

## Summary

One command drives the whole system: `npm run scan -- config.local.json`. It runs three nested layers — a process shell (`src/cli/main.ts`), a run orchestrator (`src/cli/run.ts`), and the scan itself (`src/runner.ts`) — and produces a *digest*: proposals, skips, orders, and an approval report. Learning where each layer's responsibility ends is the fastest way to stop guessing where a given behaviour lives.

## Key Points

- Three layers, three jobs. `main.ts` owns the process boundary: it reads the clock **once**, reads credentials from the environment, builds adapters, and is the only place that calls `process.exit`. `run.ts` owns run-level gates, the lock, the store and reports. `runner.ts` owns the scan: score, rank, size, gate, submit.
- The CLI takes exactly one argument: the config path. No flags. Via npm you must pass it through with `--`.
- `runPaperScan` dispatches by duck-typing: `typeof opts.fetchBars === 'function'` picks the wave-2 path, otherwise legacy. The CLI always supplies `fetchBars`, so **the CLI is always wave-2**. `runPaperScanLegacy` has no exits, no FX, no cost gate and no veto — it is reachable only from tests.
- The scan runs in labelled phases: **Phase 0** reconcile (entries then exits), **exit evaluation and submission**, **Phase A** per-symbol scoring and skips, **Phase B** ranking, **Phase B½** the veto, **Phase C** sizing → stop → cost → FX → risk gate → journal → submit.
- **Exits are submitted before any entry order in the same run.** This is criterion E7 and it is deliberate.
- **An entry never fills in the same run.** It becomes a `PendingEntry`, is persisted, and only becomes an `OpenPosition` in a *later* run via `reconcileEntry`. Delete the pending round-trip and nothing ever opens.
- The store is saved **before** the reports are written, and an aborted run that already submitted something is persisted *and still returns failure*. Persist and succeed are separate decisions.
- `src/index.ts` is dead weight — `VERSION`, a `Tick` interface, and `ping()`. Nothing in the pipeline imports it. Do not start reading there.

## Deep Dive

**The call chain, end to end:**

```
main(argv)                                    src/cli/main.ts
 ├ read + parse config                        exit 2 on throw
 ├ loadConfig(raw)                            exit 2 on rejection
 ├ refuse mode:'live' from a file             exit 2  (ADR-024)
 ├ build ADAPTER (feed:iex, adjustment:split)
 │        SCORE_ADAPTER (adjustment:'all')
 │        broker, optional veto runner
 ├ runOnce({ config, nowMs: Date.now(), ... })   ← THE ONE CLOCK READ
 │   ├ trading-day gate      ─┐
 │   ├ market-mismatch gate   │ run-level gates,
 │   ├ calendar-coverage gate │ any one aborts
 │   ├ credentials gate       │ the whole run
 │   ├ equity from broker    ─┘
 │   ├ acquireLock(storePath)
 │   ├ loadStore
 │   ├ advanceRiskState → entriesHalted?
 │   ├ sizingEquity = sleeveBudget(equity, allocation)
 │   ├ runPaperScan({...})   → RunDigest        src/runner.ts
 │   ├ saveStore(expectGeneration)
 │   └ writeReports(decision model)
 ├ recordRun(asOf, exitCode) → runs.jsonl, last-run.json
 └ exit 0 | 1
```

**Inside `runPaperScanWave2`:**

| Phase | What happens |
|---|---|
| validate | profile ranges, `sectorCap`/`families` pairing, exit profile, duplicate symbols, FX probe |
| fetch | one batch of `BarRequest`s (400 calendar days back, `minBars` 64), plus a second batch on the scoring basis |
| **Phase 0** | reconcile pending entries against broker status, then reconcile outstanding exits |
| exits | `evaluateExits` → for each `close`, build and submit an exit order |
| risk book | `positions ∪ open book ∪ pendingExposure` |
| **Phase A** | per symbol: data checks → adjustment → scoring basis alignment → score → halted? → already-held? → entry-outstanding? |
| **Phase B** | sort by descending score, symbol ascending as tiebreak |
| **Phase B½** | `researchVeto(symbols, asOf)` → `applyVetoes` → ledger row — **only when `config.claude` exists**; neither shipped config has it, so this phase is a no-op today |
| **Phase C** | size → stop → cost gate → FX → `riskGate` → journal row → submit (live only) |

**The symbol list is not just the universe.** `universeAndPositions(universe, openPositions)` — a held position's symbol is fetched even if it has left the universe, because a name that stopped scoring is the one most likely sitting on a stop.

**Where each kind of failure surfaces.** A run-level gate aborts with an exit code. A scan-level validation error aborts the whole digest. A per-symbol problem becomes a `SkipRecord` with a `stage` of `config | data | score | size | risk | alarm` and a `reason`, and the run continues. Learning to read the skip list is how you debug a quiet morning.

**One trap worth memorising early.** `stage: 'risk'` skips are not all `riskGate` skips. The stop-sanity check, both cost-gate outcomes, the FX failures, and the drawdown halt all report `stage: 'risk'`. Only the `code` field distinguishes them — and the stop and `riskGate` skips carry no `code` at all.

## Practice Questions

- Trace what happens between `npm run scan` and the first byte reaching Alpaca. Which layer owns each step?
- Why does an entry order not produce an open position in the same run that submitted it?
- Exits are submitted before entries. What goes wrong if you reverse that order?
- A symbol that dropped out of the config universe last week is still held. Does the scan fetch bars for it? Why does the answer matter?
- You see a `stage: 'risk'` skip with no `code`. What are the two things it could be?

## Common Misconceptions

- "The runner is one big function." → It is a phased pipeline with named stages and two dispatch paths. Read the phase comments in `src/runner.ts` first.
- "`src/index.ts` is the entry point." → It is unused. `src/cli/main.ts` is.
- "A scan places orders." → Only in `live` mode, and only for entries. In `manage` mode it submits *exits* and journals entries as proposals.
- "If the run aborts, nothing was written." → An aborted run still writes the approval report, and if it already submitted an order the store is saved anyway.
- "`runPaperScanLegacy` is the old default." → It is unreachable from the CLI. If you are reading it to understand production behaviour, you are reading the wrong function.

## References

- `src/cli/main.ts` — process boundary, the one clock read, adapter construction
- `src/cli/run.ts` — `loadConfig`, `runOnce`, the ordered run-level gates
- `src/runner.ts` — `runPaperScan`, the phase structure, per-symbol skip codes
- `src/types.ts` — `RunDigest`, `JournalEntry`, `OrderRecord`, `SkipRecord`
- `DECISIONS.md` ADR-003 (pipeline), ADR-009 (decide post-close, execute next open)
