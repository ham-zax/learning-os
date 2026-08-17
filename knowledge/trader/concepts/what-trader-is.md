---
id: what-trader-is
title: What trader Is (and Is Not)
difficulty: 1
prerequisites: []
tags: [foundation, orientation]
---

## Summary

`trader` is a rule-based, human-gated paper-trading system for US equities. It runs once per day after the close, ranks a fixed list of names by momentum, and produces *proposals* that a person must tick before any order reaches the broker. It is not an autonomous trading bot, not a backtesting framework, and not a place where an LLM decides anything. Its stated design goal is not returns — it is that a wrong answer is *visible*, because the failure mode of a trading system is not a crash, it is a plausible number.

## Key Points

- The system decides after the close and executes at the next open (ADR-009). There is nothing intraday, nothing sub-minute, no price-pattern day trading — those are explicitly banned in `docs/investment-framework.md` §3.
- The signal is one function: `scoreMomentum` in `src/momentum.ts` — `score = 0.5 × roc21 + 0.5 × roc63`, equal weights, no volatility scaling. That is the entire alpha hypothesis today.
- It trades a **paper** Alpaca account (`PA3EMGE0EX0M`, $100,000). Real capital has never been deployed.
- The scope is frozen to US stocks and ETFs. No shorting, no futures, no FX, no crypto; options are phase-3 defined-risk only; Hong Kong is deferred (Session 7 owner decision, `DECISIONS.md`).
- The universe is a hand-curated list of 70 symbols across 32 families in `config.local.json`. This is a known weakness, not a design choice — see `point-in-time-and-data`.
- An LLM participates in exactly one place and it can only *subtract*: the veto layer. It cannot originate a bet, cannot set a number, cannot reorder candidates.
- The repo has ~1,410 tests and two typecheckers. Green tests are treated as necessary and *insufficient* — several of the worst defects in its history were found by running it live against a green suite.
- Nothing is installed on any machine automatically. Cron entries, deployments and credential rotation are human acts by policy (ADR-024, ADR-026).

## Deep Dive

**The vocabulary.** `CONTEXT.md` fixes twelve terms; the ones you will hit in the first hour:

| Term | Meaning here |
|---|---|
| Paper trading | Simulated execution against **real** market data and a real broker sandbox |
| Bar | One day's OHLCV. Everything in this system is daily |
| Closed broker | One vendor supplies data *and* execution (Alpaca) |
| Fidelity | How faithfully a paper fill matches a real one — fees, slippage, cancels |
| Verdict | Output of a deep-research run: testable claims plus a decision |

**The layered pipeline (ADR-003)** is the shape of the whole thing:

```
market data → event monitor → research agent → decision agent → risk gate → HUMAN APPROVAL → paper executor
                                                                                  ↑
                                                              watchdog (separate process, watches all of it)
```

Two properties of that diagram are load-bearing and both are ADRs. First, the human-approval box cannot be removed — "any configuration that removes the human-approval step is rejected by constitution" (`docs/ownership-contract.md`). Second, the watchdog is a *separate process*: a watchdog living inside the process it watches reports nothing when that process is the thing that died.

**What the funnel actually looks like** (`docs/information-architecture.md` §4). This is the mental model to carry:

| Layer | Filter | Survivors |
|---|---|---|
| — | ~10,000 instruments | |
| L0 | universe gate — static, liquidity + market cap | ~30–50 names |
| L1 | calendar — scheduled catalysts only | ~1–3 events/day |
| L2 | deterministic trigger — "the rule fires or it does not" | ~1–2 candidates/week |
| L3 | **LLM veto** — natural language enters here and only here | ~1 approved bet/week |
| L4 | cost + risk gate — arithmetic | **40–80 bets/year** |

The doctrine sentence: *"the cheap, dumb filters run first and eliminate most of the world; the expensive, smart ones run last on almost nothing. Any architecture that puts the LLM at the top is both unaffordable and statistically reckless."*

**Why it is built this way.** `docs/sdd-workflow.md` §1 gives the reason in one line: *"a wrong trading system does not crash — it produces plausible numbers."* A look-ahead bug, a silently-empty fetch, survivorship bias — every one of them makes the backtest look **better**, not broken. So the architecture is organised around making wrongness loud: typed error values instead of exceptions (ADR-008), absence distinguished from failure everywhere, controls that render as "did not run" rather than "passed", and a journal that records why a bet was taken.

**Honest current state.** Read `STATUS.md` before you believe any other document about what works — but read it *sceptically*, because it is written session by session and its own lines age. As of session 10:

- The veto seam **is** wired into the scan in code (`src/cli/main.ts` builds the runner and passes `researchVeto` into `runOnce`). What is true is that it is **inert on both shipped configs**, because neither `config.local.json` nor `config.demo.json` carries a `claude` block, so the runner is never built. STATUS.md's "no judgement is wired into the scan" is stale relative to `src/`.
- The cost gate has no input: `maxRoundTripBps` is deliberately unset (ADR-027).
- "Nothing installed anywhere" refers to session 10's work. The 08:45 NAV cron entry **has** been installed and verified on `agent-mini` since session 9.
- `docs/README.md` says *"The system cannot trade yet"* and `docs/manual-playbook.md` says *"The software cannot trade."* Both are stale — it has placed real paper orders since session 6.

## Practice Questions

- The system produces a ranked list of names every evening. What has to happen before any of those names becomes an order at the broker?
- The repo has 1,410 passing tests. Why does it treat that as insufficient evidence that the system is correct?
- Where in the pipeline does natural language enter, and what is the one operation it is permitted to perform?
- You are told "the momentum model." What is the actual arithmetic, and how many parameters does it have?
- Why is the watchdog a separate process rather than a module inside the runner?

## Common Misconceptions

- "It's an AI trading bot." → It is a rule-based system with an LLM veto layer bolted to one seam. The rules trade; the model can only remove candidates.
- "Green tests mean it works." → Three of the most serious defects in the repo's history (ADR-020, ADR-021, ADR-027) were found on live runs while the entire suite stayed green.
- "The docs describe the current state." → `docs/` explains *why*; `STATUS.md` and `NEXT-SESSION.md` describe *now*. Two docs are known-stale about whether the system can trade at all.
- "It's a backtester." → `research/` holds backtest harnesses, but the live product is a daily decision surface. Backtests are evidence, not the deliverable.
- "Momentum is the strategy, so it must be sophisticated." → 21-day and 63-day rate of change, averaged. The sophistication is entirely in the guardrails around it.

## References

- `CONTEXT.md` — the ubiquitous language table
- `STATUS.md` — current state, session by session (trust this over `docs/`)
- `docs/information-architecture.md` — the funnel and the filter doctrine
- `DECISIONS.md` ADR-003 — the layered pipeline and fail-closed
- `docs/investment-framework.md` — the thesis, the banned list, the honest ceiling
