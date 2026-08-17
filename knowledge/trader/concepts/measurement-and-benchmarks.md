---
id: measurement-and-benchmarks
title: Measurement, R, and the Shadow Benchmarks
difficulty: 3
prerequisites: [position-lifecycle]
tags: [judgment, measurement]
---

## Summary

Positions carry executed facts; `src/measure/` derives the money. The central quantity is **realized R** — net P&L divided by the risk unit that was registered at entry — and the code is arranged so that R cannot be flattered. Alongside it, `src/benchmark/shadow.ts` runs do-nothing alternatives in parallel to answer a question P&L alone cannot: *was trading at all worth it?* The motivating number is blunt — 1,582 trades turned a 25.6%/yr do-nothing alternative into 19.8%.

## Key Points

- `riskUnit = qty × (entryPx − registeredStopPx)`. The denominator uses **`registeredStopPx`**, never the current `stopPx` — otherwise tightening a stop would inflate reported R without bound, and create an incentive to tighten a stop in order to *report* better.
- `netPnl = qty × (exitPx − entryPx) − entryFees − exitFees`. Net of **both** legs.
- **R is not clamped at −1R.** Any implementation that clamps has substituted the stop level for the fill and deleted the left tail.
- Two exclusion states, and quarantine wins: `quarantined` nulls the money entirely (prices are untrustworthy); `entry-beyond-stop` **keeps** the money but nulls `rDollars`, so R is `null`.
- `exclusionNote` states in prose that the excluded set is expected to be **loss-skewed** — the exclusion is a known **upward bias**, and the note travels with `meanR` so a reader cannot miss it.
- **A statistic over `n = 0` reports `null`, never `0`.** Money aggregates always come in a measurable/unmeasurable **pair**, and are `null` when the rows span currencies.
- Execution **drag** is reported separately from fees: `entryDrag = qty × (entryPx − entryReferencePx)`, and `exitDrag` is `null` when unknown, never `0`. "A fee is contracted and a drag is not."
- MAE/MFE are **recomputed from the series, never accumulated**, and return `null` on any point-in-time or provenance mismatch.
- `holdingSessions` uses the real trading calendar from `entryDate` (exclusive) to `exitDecisionDate` (inclusive), and **refuses** rather than falling back to a weekday count.

## Deep Dive

**Two different holding-period counts, on purpose.** The time-stop uses `weekdaysBetween` — calendar-free, so it **overstates** by exchange holidays and the time-stop fires slightly early. Measurement uses the real calendar and refuses on out-of-coverage. Emitting the weekday count on a measurement row is banned; computing it for the rule is not. The identity is `holdingSessions = timeStopSessions − holidays`.

**Expectancy.** `expectancy(measured, counts, groupBy?)` groups by `cell`, `exitReason`, or both, and emits components rather than a single number: `n`, `meanR`, `medianR`, `winRate`, `pWin`, `avgWinR`, `avgLossR` (a **positive magnitude**, so `E = p·W − (1−p)·L` reads correctly), `scratchCount` (an exactly-zero R is **neither a win nor a loss** but does count in `n`), plus the open/stuck/unmeasurable counts and the currency label. Only closed **and** measurable rows contribute.

Why components and not a scalar: ADR-010 — *count, don't fit*. No predictive model may be built from the journal until a cell has **200+ closed trades**; until then, decision support is arithmetic — base rates and Bayesian intervals. *"A model that skips the validation gates is a strategy wearing a lab coat."*

**The shadows.** Three do-nothing alternatives (`src/benchmark/shadow.ts`), motivated by G13 — the burden of proof is on trading at all:

| Shadow | What it asks |
|---|---|
| `singleAssetShadow` | what if we had just held SPY? |
| `equalWeightShadow` | what if we had equal-weighted **our own universe** and done nothing? |
| `staticWeightShadow` | what if we had run ADR-023's ratified weights with no rules? |

The equal-weight shadow is "the audit's honest benchmark," and the audit result it exists to keep visible: equal-weight buy-and-hold of the *same 70 names* beat the strategy on return.

**The rebasing rule, which is the subtle part.** The equal-weight shadow is built **forward from inception, one membership era at a time, oldest first**. Each era's dates, prices and shares depend only on its own window and its own held symbols, so appending an era can only add points *after* the tail — it cannot rewrite an existing date. Recomputing from *today's* membership would let every universe edit silently rewrite benchmark history in the flattering direction: the same survivorship error as the strategy's, arriving through the scoreboard.

**Statistics that refuse.** `cagr = (final/initial)^(252/sessions) − 1` — total compounded return annualized, **never a mean of periodic returns** (G2). Volatility uses log returns and **population** variance, because ddof=1 divides by zero on a two-point series. A price series carried forward past `maxCarrySessions` makes the whole shadow refuse as a value; `maxCarrySessions` has **no default** — "nothing here is defaulted silently."

**Drawdown granularity, which mattered.** `drawdownFromPeak` is **peak-to-trough against a running peak**, not per-day. Two rules are stated at the top of the file:

1. The running peak is **inclusive of the current point** — a new high must report drawdown 0 at the *same* index. An off-by-one would make the breaker see a small negative on the day of a new high: wrong in the direction that *delays* a halt.
2. A non-finite or non-positive value is **refused as a value**, never silently skipped — because "a NaN that quietly drops out of the series is how a breaker that exists because of G1 stops firing."

The historical version read the *day* only and slept through an 18% loss across 2022.

**Plain-English output.** `compareToShadows` emits a sentence per shadow, not just numbers, because *"a number a reader has to interpret from a chart is a number half of readers get wrong."* A failed shadow or an unmeasurable account yields `null` gaps and an explanatory sentence — never a fabricated zero.

**The number that says the most.** Micron rose 189% in 2026. The signal ranked it far above the funding cutoff every month from January. **The system captured 12.3%**, in nine round trips, each ended by a 20-session clock that came from a fixture constant. Changing only the exit rule returns 184–190%. That is why exit rules, not entry signals, are where this repo spends its attention — and why `docs/guardrails.md` Part D insists concentration and caps be set *deliberately* rather than inherited from a fixture.

## Practice Questions

- Why does realized R use the stop registered at entry rather than the position's current stop?
- A stop at 93 gaps down and fills at 84. What R does the system report, and what would a clamped implementation report instead?
- `meanR` for a cell is +0.4. What does `exclusionNote` tell you about that number, and in which direction?
- What question do the shadow benchmarks answer that P&L cannot, and which guardrail requires asking it?
- The equal-weight shadow is rebuilt era by era from inception rather than from today's universe. What bug does that prevent?

## Common Misconceptions

- "R is capped at −1 by definition." → Only if you substitute the stop for the fill, which truncates the left tail of the distribution by construction. ADR-012 forbids it and a test asserts it.
- "Excluded trades are just noise." → They are expected to be **loss-skewed**, so excluding them biases `meanR` upward. The note exists so nobody reads the mean without that.
- "A statistic with no data is zero." → It is `null`. R4: `n = 0` reports null, never 0.
- "Beating SPY is the benchmark." → The primary benchmark is equal-weight buy-and-hold of *our own universe*, and it has beaten the strategy.
- "Drawdown is measured daily." → Peak-to-trough against a running peak. The day-only version slept through an 18% loss.
- "Fees and slippage are the same kind of cost." → Reported separately: a fee is contracted, a drag is not.

## References

- `src/measure/measure.ts` — `measure`, the R arithmetic, exclusions, drag, excursions
- `src/measure/expectancy.ts` — the components, `exclusionNote`, the null rules
- `src/benchmark/shadow.ts` — the three shadows, the rebasing rule, `compareToShadows`
- `src/benchmark/drawdown.ts` — `runningPeak`, `drawdownFromPeak`
- `docs/reports/backtest-audit-2026-08-13.md` — the 1,582-trade audit and the Micron number
- `DECISIONS.md` ADR-010 (count, don't fit), ADR-012 (executed prices only), ADR-014 (only R aggregates across currencies)
