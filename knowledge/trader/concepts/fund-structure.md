---
id: fund-structure
title: Fund Structure and Kill Criteria
difficulty: 4
prerequisites: [guardrails-and-authority, measurement-and-benchmarks]
tags: [mastery, strategy]
---

## Summary

ADR-023 is the owner-ratified allocation policy: five buckets, two rules, ratified numbers. The trading system you have been reading is **one 20% sleeve of it**, sized assuming **zero alpha**. Around that sits a capital ladder that scales capital but never risk, and a pre-committed kill criterion: if after twelve months of live trading no cell shows positive net-of-cost expectancy, stop adding trading effort. That last item exists specifically as *a pre-commitment against sunk-cost escalation*.

## Key Points

- **30% core** — SPY, passive, never touched between rebalances.
- **20% semi/AI theme** — SMH, with a **trend guard**: a month-end close below the 200-session average **halves the bucket** (freed half to T-bills), restored when back above.
- **20% machine sleeve** — the system in this repo. *"Its budget is 20% of account, not whole-account equity."*
- **10% options standby** — held in T-bills, deploys nothing until the phase-3 gate, defined-risk structures only.
- **20% reserve** — T-bills, deploying **into the passive core only** on SPY drawdown from its all-time high: **−15% deploys half, −25% deploys the rest.** Triggers re-arm only at a new ATH.
- Plus an **account-level semi/AI cap of 30%**, counted across every bucket.
- Rebalanced quarterly; **any deviation is logged as a discipline break** (G11).
- The honest ceiling: published-anomaly portfolios net **0.5–1.5%/yr after costs**. Realistic net-alpha ambition for the sleeve is **3–8%/yr above beta once cells are proven — not 30%.**
- **The kill criterion**: twelve months live with no cell showing positive net-of-cost expectancy → stop. Harvest the track record and the system instead.

## Deep Dive

**The rationale, compressed — this is the shape of the exercise, and it is worth being able to reproduce:**

1. **The tranche design comes from a base rate.** Across 1950–2022, a −15% drawdown deepens to −25% **64% of the time**. That probability *is* why the reserve deploys in two tranches rather than one.
2. **−20% was rejected as brittle.** Four sampled bears bottomed at −19.3% to −19.9%.
3. **The theme is capped at 20% by dot-com stress arithmetic** — a −25 to −30% account worst case with the guard, versus −35%+ at a 30% theme weight. This **overrides the backtest grid in which theme-30 wins**, and the ADR says why: *"the constraint exists to refuse exactly that temptation."*
4. **Out-of-sample**, 2022 and 2023 start windows: the policy beat 100% SPY on return-per-drawdown in both — and the **wrong-thesis control (XLE instead of SMH) still returned 13–16.5%/yr**. That is the important result: *the machinery does not depend on the thesis.*

The exercise was run under the repo's own discipline: pre-2023 evidence only, closes-with-next-open execution, machine sleeve modelled at zero alpha, a **disclosed 54-cell search** (G4 — an uncounted search is not evidence), and a wrong-thesis control.

**Three payoff assets, EV-weighted** (`docs/investment-framework.md` §2), sharing one input — rigor:

| | Asset | Horizon |
|---|---|---|
| A1 | capital compounding ($0.5k–4k/yr) | 12–24 months |
| A2 | an auditable track record — hash-chained journal, live fills, pre-registered hypotheses | 24 months |
| A3 | the system and the skills | already accruing |

At $10k–$50k, **A2 and A3 dominate expected value in the first two years**. Hence: *"we never sacrifice auditability or statistical honesty for a quick win — a fudged backtest destroys the two most valuable assets to inflate the least valuable one."* That single sentence explains most of the engineering choices in this repo.

**The capital ladder — scale capital, never risk.** Rules per rung are identical; only capital changes.

| Rung | Capital | Gate to advance |
|---|---|---|
| P — paper | $0 | ≥100 trades · positive net-of-cost expectancy 2 consecutive months · **zero discipline breaks** · decay monitor green |
| S1 — seed | $2k–5k | 30-day paper-vs-live reconciliation clean · cost model within tolerance |
| S2 | ~$10k | 3 more months positive · max drawdown inside budget · process quality green |
| S3 | $25k–50k | 6+ months live · **≥2 uncorrelated cells green** · after-tax net alpha positive |

Any gate failure → hold, or step down one rung.

**The $0 doctrine and its payback rule.** Any paid line item must satisfy `capital × projected net-alpha uplift ≥ 12 × monthly cost`. At $30k, a $99/mo data tier needs roughly **4%/yr of additional net alpha** to justify itself. That is why the system runs on a free IEX feed with all the constraints that implies.

**The validation machine — "the actual moat."** Pre-registration → a trial log with a deflated Sharpe against N → CPCV with purge and embargo ("walk-forward alone is dead") → acceptance gates (DSR > 0.95, PBO acceptable, MinBTL satisfied, IC ≥ 0.02–0.04, net-of-cost Sharpe positive, and a **0.2–0.33× backtest→live multiplier applied to every projection**) → *"paper is a mirror, not a judge"* → decay first-class, cells retired **by rule** and **never nursed**.

**Kill criteria at three levels:**

- **System**: 12 months live, no cell with positive net-of-cost expectancy → stop adding trading effort. Justified by G13.
- **Per cell**: below gate for 2 consecutive periods → archived with a reason. **No ad-hoc override of the decay block.**
- **Operational**: the daily 5–10% drawdown breaker, deliberately a bright line rather than smooth de-risking (D8); fail-closed everywhere; watchdog outside the agent graph; an L4 halt resumes only on operator acknowledgement.

**Falsifiers for the framework itself** — the part most strategy documents omit. A credibly audited autonomous LLM agent beating net-of-cost benchmarks for two-plus quarters reopens the human-gate doctrine. Retail fills consistently worse than 0.33× backtest means redesigning cost and execution. If the HK cost model shows no cell family survives 20bps+ round trips, HK demotes to data-only.

**The gap you will hit immediately — and a stale line about it.** TR-034 makes the sleeve's equity input its *budget share* rather than whole-account equity. Session 9 landed that: `sleeveBudget` is wired in `src/cli/run.ts` and both shipped configs carry an `allocation` block. But **TR-034 wave 1 is recorded PARTIAL, not green** — the fractional-order decision the scope note called for is unmade, and four of fourteen proposals came out as 1–2 share positions.

`NEXT-SESSION.md` still says the sleeve sizes off whole-account equity at five times its ratified budget. **That line is stale**; it describes the state before the fix. It is a good first exercise in the hierarchy from `where-truth-lives`: read `src/cli/run.ts` and the `allocation` block in the config, and let the code settle it.

## Practice Questions

- The system in this repo is one bucket of five. Which one, at what weight, and what alpha assumption was it sized under?
- Why does the reserve deploy in two tranches at −15% and −25% rather than one tranche at −20%?
- The backtest grid says a 30% theme weight wins. The ADR sets 20%. Explain the reasoning, and what the constraint is protecting against.
- What is the kill criterion, and which guardrail justifies pre-committing to it?
- The system's capital ladder scales capital but not risk. Why is that the safer axis to scale, and which two guardrails say so?

## Common Misconceptions

- "The momentum system is the fund." → It is a 20% sleeve, modelled at zero alpha. 30% is passive SPY that is never touched between rebalances.
- "A cap of 20% instead of 30% is conservatism." → It is a stress-arithmetic result that deliberately overrides a backtest, because the constraint exists to refuse that temptation.
- "The goal is high returns." → The stated realistic ambition is 3–8%/yr above beta once cells are proven, and A2 (the auditable record) outranks A1 (capital) in expected value for the first two years.
- "A losing cell should be given time." → Cells retire by rule and are never nursed. Ad-hoc override of the decay block is explicitly forbidden.
- "Paper trading proves the strategy." → "Paper is a mirror, not a judge." The judge is the validation machine plus the 0.2–0.33× live multiplier.
- "The allocation is running." → `sleeveBudget` is wired; the trend guard, reserve triggers and theme cap are built and **not called**.

## References

- `DECISIONS.md` ADR-023 (the five buckets, owner-ratified), ADR-010 (count, don't fit)
- `docs/investment-framework.md` — the thesis, three payoff assets, the edge stack, the ladder, kill criteria, falsifiers
- `docs/reports/allocation-exercise-2026-08-13.md` — the computed base rates and the wrong-thesis control
- `src/allocator/` — `sleeveBudget` (wired) vs `themeTrendGuard` / `reserveTriggers` / `themeCapBreach` (not)
- `NEXT-SESSION.md` — TR-034's partial state and the five-fold sizing gap
