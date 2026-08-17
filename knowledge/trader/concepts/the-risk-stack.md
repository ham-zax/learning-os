---
id: the-risk-stack
title: The Risk Stack
difficulty: 2
prerequisites: [run-modes-and-gates]
tags: [mechanics, risk]
---

## Summary

`riskGate` in `src/risk.ts` is 100 lines and decides whether a candidate may be funded. It returns one of three verdicts — `approve`, `reject`, or `sizeDown` — and **only the position cap can resize**; every other control is binary. The single most important fact in this concept, and probably in the repo: **`familyCap` is not a family cap.** It sums notional across the entire book with no grouping key. It is a gross-exposure cap and always was. The real per-family cap is `sectorCap`, added by ADR-018.

## Key Points

- `riskGate(candidate, ctx)` where `ctx = { profile, equity, positions, families? }`. Fixed internal order: **drawdown breaker → gross (`familyCap`) → per-family (`sectorCap`) → position (`posCap`)**.
- Family is checked **before** position, deliberately: a candidate that cannot fit its family must be *rejected*, not sized down into it. "Sizing down to fit a sector that is already at its limit is how a concentration control turns into a concentration schedule."
- `posCap` is the only cap that produces `sizeDown`, and only when the smaller size still fits under the gross cap. Otherwise the gross cap converts it into an outright reject.
- The `families` map is **total**. An unmapped candidate rejects; an unmapped *open position* rejects the whole candidate decision. One stale ticker in the book blocks every entry for the run — intentional, because the alternative understates every family sum in the flattering direction.
- Two different drawdown controls, easily confused. `maxDrawdownBreaker` reads `equity.dayReturn` inside `riskGate` — a one-day kill switch. `maxDrawdownHalt` is **peak-to-trough** against a persisted high-water mark, computed by `advanceRiskState`, **latches in the store**, halts entries only, and needs an operator acknowledgement.
- `posCap` is per **candidate**, not per symbol. Nothing in `riskGate` stops the same name being bought day after day — only E13's held/pending de-duplication does.
- Pending entries count against the caps (`pendingExposure`, ADR-021). Without it, thirteen accepted-but-unfilled entries presented as an empty book and the next run funded thirteen more — 26 orders, ~182% of equity, every gate approving.
- `equity.equity` is often **not** the account. When `config.allocation` is present, `sleeveBudget()` substitutes the sleeve's share, so `posCap: 0.07` means 7% of 20% of the account.

## Deep Dive

**The signal it gates.** `scoreMomentum` in `src/momentum.ts` returns at most one score per call:

```
roc21  = close[last] / close[last-21] - 1
roc63  = close[last] / close[last-63] - 1
score  = 0.5 * roc21 + 0.5 * roc63
```

Three guards all return `[]` and the caller cannot distinguish them: fewer than **64** bars (the comparison is `<=` against `MIN_LOOKBACK = 63`); bars not strictly ascending; any non-finite or non-positive close. Out-of-order bars are a **hard refusal, not a sort** — any disorder silently inverts the momentum read, so re-sorting defensively would hide a data-source bug.

**Why `familyCap` keeps its misleading name.** `src/types.ts` says it outright. Renaming it would silently change the meaning of every config file that already sets it — in the permissive direction. So the name is kept, the truth is documented at the type, and a correctly-named `sectorCap` was added alongside. The pairing is enforced outside `risk.ts`: the runner aborts on `sector-cap-without-families` or `families-without-sector-cap`, and `loadConfig` requires both.

**Where the caps come from.** Shipped values in `config.local.json`: `posCap: 0.07`, `familyCap: 0.9` (gross), `sectorCap: 0.25`, `maxDrawdownBreaker: 0.06` (daily), `maxDrawdownHalt: 0.15` (peak-to-trough), `stopPct`, `allocation.sleeve: 0.2`.

**The undefined trap.** The three *required* profile fields have no in-gate undefined guard. If one were `undefined` at runtime, `undefined * equity` is `NaN`, and every comparison against `NaN` is `false`:

- `familyCap` NaN → the gross cap **silently does not fire**
- `maxDrawdownBreaker` NaN → the breaker **silently does not fire**
- `posCap` NaN → falls through to reject (fails closed by accident, not design)

The defence is entirely upstream in `validateProfile`, which aborts on non-finite or out-of-range values and bounds both caps to `(0, 1]` — G7, leverage stays at 1.0. **`risk.ts` called directly has no such protection.** This is exactly the shape of ADR-017's original defect: `undefined <= -breaker` is `false`, so the breaker did not fail loudly; it silently could not fire.

**The sleeve substitution.** `sizingEquity = sleeveBudget(equity.equity, config.allocation)` in `src/cli/run.ts` is the only place the denominator narrows, and it is TR-034's fix for a five-fold over-size. Note what it deliberately does *not* narrow: `maxDrawdownHalt` and `maxDrawdownBreaker` keep running on **account** equity, because feeding the halt a fifth of the number would compare today's sleeve against yesterday's account and latch an 80% drawdown that never happened.

**The allocator's unwired majority.** `src/allocator/` exports **seven** functions. Two have call sites in `src/`: `validateTargets` (at config load) and `sleeveBudget` (the sizing substitution above). The other five — `bucketStates`, `rebalanceProposals`, `themeTrendGuard`, `reserveTriggers`, `themeCapBreach` — are complete, documented and **not running**. Do not assume ADR-023's theme trend guard, the reserve tranches, or the 30% account-level semi/AI cap is live today. That is ADR-011's shape, and the repo names it.

## Practice Questions

- A candidate is 30% of equity, the book is empty, `posCap` is 0.07 and `familyCap` is 0.9. What does `riskGate` return, and why isn't it a reject?
- Same candidate, but the book already holds 88% of equity in gross notional. What changes and why?
- Why is the family check placed before the position check rather than after?
- The config omits `maxDrawdownBreaker`. What does `riskGate` do? What stops that from reaching production?
- The book has one symbol with no entry in `config.families`. What happens to every candidate this run, and why is that the right behaviour?

## Common Misconceptions

- "`familyCap` caps exposure per family." → It is a gross-exposure cap over the whole book. `sectorCap` is the family cap.
- "`posCap` limits how much of one symbol you can hold." → It limits one *candidate*. Repeated buying of the same name is prevented by E13, not by the cap.
- "There is one drawdown control." → Two: a daily breaker inside `riskGate`, and a latching peak-to-trough halt in the store that only stops entries.
- "`sizeDown` means a trade will happen at a smaller size." → It floors to whole shares afterwards and can still skip.
- "Equity means the account balance." → With `allocation` set, every cap is a fraction of the *sleeve budget*, not the account.
- "Acknowledging a halt overrides it." → Acknowledgement is a restart, not an override. It can re-arm on the very next run.

## References

- `src/risk.ts` — `riskGate`, `sectorCheck`, and the ordering comment
- `src/momentum.ts` — `scoreMomentum`, `MIN_LOOKBACK`, `isBarsAscending`
- `src/types.ts` — `RiskProfile`, and the `familyCap` docstring
- `src/allocator/` — `sleeveBudget`, `validateTargets`, and the unwired rules
- `DECISIONS.md` ADR-018 (sectorCap), ADR-020 (E13), ADR-021 (E14 pending exposure), ADR-017 (the breaker that could not fire)
