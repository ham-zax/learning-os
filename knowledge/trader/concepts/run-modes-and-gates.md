---
id: run-modes-and-gates
title: Run Modes and the Gate Order
difficulty: 2
prerequisites: [the-scan-pipeline]
tags: [mechanics, architecture]
---

## Summary

`RunMode` has three values — `dry`, `manage`, `live` — and they do **not** map onto "test / staging / production." They map onto ADR-024's split: *closing risk never waits for permission; opening risk always does.* On top of that sits an entirely separate axis, `account.env` (`paper` | `live`), which only picks a hostname. Confusing the two is the most common early mistake.

## Key Points

- `dry` — credentials not required; exits are **not** submitted; entries journalled only.
- `manage` — credentials required; exits **are** submitted; entries journalled as proposals but never sent. This is the shipped mode in `config.local.json` and what the unattended cron run uses.
- `live` — credentials required; exits submitted; entries submitted.
- **`mode: "live"` is refused when it comes from a config file.** `src/cli/main.ts` exits 2 on it. The desk builds a live `RunConfig` *in memory* over a human-ticked universe and never round-trips it through a file.
- `account.env` is a different axis. `config.local.json` is `mode: manage` on `env: paper`. `env` selects `BROKER_HOST` and nothing else.
- Run-level gates abort the process. Per-symbol gates produce a `SkipRecord` and the run continues. Knowing which is which tells you whether to look at the exit code or the skip list.
- `OrderRecord.action` is **not** the run mode — wave-2 records hardcode `action: 'live'`. The run mode lives on `JournalEntry.action`, where it means "what this run was permitted to do."
- Every abort is tagged `stage: 'config'` in `RunDigest.abort`, including aborts that have nothing to do with config. The type only has that one stage.

## Deep Dive

**The three modes as a table:**

| | credentials | exits submitted | entries submitted |
|---|---|---|---|
| `dry` | not required | no | no |
| `manage` | required | **yes** | no |
| `live` | required | yes | yes |

ADR-024 is why `manage` exists at all. A rule that *closes* risk — a stop being hit, a time-stop expiring — is allowed to run unattended at 09:00 with nobody watching, because waiting for a human to approve an exit means holding a losing position until someone wakes up. A rule that *opens* risk queues for a person. `manage` is exactly that split expressed as a mode.

A consequence that catches people: **a desk scan submits exits.** `scan()` in `src/ui/server.ts` runs `mode: 'manage'`. It is not a read-only preview.

**Run-level gates, in evaluation order** (`src/cli/run.ts`). Each aborts with exit 1:

1. `non-trading-day` — the market is closed today
2. `market-mismatch` — a universe symbol's suffix implies a different market than `config.market`
3. `calendar-out-of-coverage` — the date falls outside the calendar's data
4. `missing-credentials` — required unless `mode: 'dry'`
5. `no-account-source` / `account-unavailable` / `account-unusable` / `no-equity` — the equity resolution chain
6. `store-locked` — another process holds the lock
7. `store-<code>` — load or save failure

Then a *non-aborting* run-level check: `advanceRiskState` computes the peak-to-trough drawdown halt and produces an `entriesHalted` object. A halt does not abort the run — it turns every entry into a `drawdown-halt` skip while exits continue to work. That is ADR-024 again.

**Per-symbol gates (Phase A), in order:** fetch outcome → trading day → adjustment → empty bars → bar ordering (an `alarm`, not a data skip) → scoring-basis availability and alignment → insufficient coverage → `score > 0` → **entriesHalted** → **already-held** → **entry-outstanding**.

Note where the halt sits: *before* the held/outstanding checks, and recorded per candidate rather than as one run-level line.

**Per-candidate gates (Phase C), in order:** share floor (`quantity >= 1`) → stop sanity → cost gate → currency mapping → FX conversion → `riskGate` → re-floor after any `sizeDown`.

**Config is validated, never defaulted.** `loadConfig` rejects with an exact message rather than substituting anything. Required keys: `universe`, `profile`, `families`, `exitProfile`, `equitySource`, `account`, `mode`, `market`, `storePath`, `reportDir`. `equity` is required **iff** `equitySource === 'config'` and **rejected** when `'broker'` — both shipped configs use `broker`, so a config carrying an equity number is refused rather than ignored.

## Practice Questions

- You want to run the scan without touching the broker at all. Which mode, and what does it *not* prove?
- `config.local.json` says `mode: "manage"` and `account.env: "paper"`. What can this run do to the account?
- Why is `mode: "live"` accepted by `loadConfig` but refused by `main.ts`?
- The drawdown halt fires. Does the run abort? What happens to exits?
- Someone edits the config to add `"equity": 100000` alongside `"equitySource": "broker"`. What happens, and why is that better than ignoring the field?

## Common Misconceptions

- "`dry` / `manage` / `live` is dev / staging / prod." → It is the ADR-024 split: what the run is permitted to *open* versus *close*.
- "`manage` mode is safe because it doesn't trade." → It submits exits. It changes the account.
- "The desk scan button is read-only." → It runs `manage`, which closes positions.
- "`account.env: 'paper'` means the run is a simulation." → It picks a hostname. The orders are real orders on a real (sandbox) account, and they reconcile like real ones.
- "An aborted run means nothing happened." → An aborted run may already have submitted exits; it is persisted and still reports failure.

## References

- `src/types.ts` — `RunMode` and its docstring
- `src/cli/run.ts` — `loadConfig` rejection strings; `runOnce` gate order
- `src/cli/main.ts` — the live-mode refusal and `BROKER_HOST`
- `DECISIONS.md` ADR-024 (closing vs opening risk), ADR-022 (approval is permission)
- `config.local.json`, `config.demo.json` — the two shipped profiles
