---
id: guardrails-and-authority
title: Guardrails and the Two Authority Levels
difficulty: 3
prerequisites: [where-truth-lives, the-risk-stack]
tags: [judgment, doctrine]
---

## Summary

`docs/guardrails.md` holds fourteen rules that may not be violated, and eight that were deliberately **rejected**. The admission bar is narrow: a rule gets in only if it is *arithmetic* (cannot be false) or *battle-tested* (decades of evidence, multiple asset classes, survived serious attempts to kill it). Anything where the evidence genuinely splits was dropped rather than kept with a caveat — and *"the dropped list is as load-bearing as the kept list."* There are exactly two authority levels, and the absence of a third is the single most important design decision in the document.

## Key Points

- **HARD** — encoded in code. Changeable only by editing the document and the code together, under review. **No runtime override exists, for anyone.**
- **HUMAN** — the operator may change it in config. **The LLM may never propose or apply a change, and may not cite reasoning to relax it.**
- The sentence to memorise: *"There is deliberately no agent-overridable tier. A rule an agent may override with a good enough justification is not a constraint — it is a suggestion, and the one thing an LLM reliably produces is good enough justifications."*
- The framing: *"A guardrail that can be argued about is not a guardrail. It is an opinion that will eventually lose an argument with a persuasive LLM at 3am."*
- **G8 is the one you will meet in code most often**: *a constraint not exercised on the live path does not exist* (= ADR-011). Until it runs live with a test covering it, it is documentation — and it *may not feed any other calculation*.
- **G11 protects the others**: pre-registered rules beat in-the-moment judgement. It is what makes a persuasive in-the-moment argument inadmissible.
- **G13 is the only HUMAN rule in Part B**: active retail trading is net-negative on average, so *the burden of proof is on trading at all*. It justifies both the shadow benchmarks and the month-12 kill criterion.
- **D3 is the most surprising rejection**: "a stop-loss order improves returns" was dropped because the evidence says it does not. Stops are permitted as behavioural precommitment with a known expectancy cost — **never described as a tail control**.

## Deep Dive

**Part A — arithmetic (G1–G8), all HARD.** These cannot be false, so they are not negotiable:

| | Rule | What it constrains here |
|---|---|---|
| G1 | Losses compound asymmetrically (−20% needs +25%, −50% needs +100%) | the drawdown breaker; scaling capital rather than risk |
| G2 | Volatility drags on compounded returns; geometric ≤ arithmetic, always | report by compounded return, never an average of periodic returns |
| G3 | Costs compound deterministically; returns do not | every bet passes a net-of-cost gate **before** it is proposed |
| G4 | Best-of-N random trials looks excellent — E[max Sharpe] ≈ √(2·ln N); at N=1,000 that is 3.26 with no edge | a trial log and a deflated statistic. *"An uncounted search is not evidence."* |
| G5 | Diversification's benefit is bounded by average correlation, unreached at small N | position-count minimums. *"Concentration is currently the largest unaddressed risk in this system"* |
| G6 | When you stop looking changes what you conclude | review cadence and trade-count gate fixed in advance |
| G7 | A margin call is an absorbing barrier | leverage stays at 1.0 |
| G8 | A constraint not exercised on the live path does not exist | a control is real only when it runs live **and** a test covers it |

**Part B — battle-tested (G9–G14).** G9 fat tails and volatility clustering (HARD); G10 estimated means are dominated by noise while estimated risk is not, so size from volatility, not from an estimated edge (HARD); G11 pre-registration (HARD); G12 published edges decay ~half post-publication, so cells retire *by rule* (HARD); G13 retail trading is net-negative (**HUMAN**); G14 a defined, computable maximum loss must exist at entry (HARD).

Note G14's precise wording — *"it does not require a stop order."* The bound may come from position size, a defined-risk structure, or a stop level. That is why this system has no resting stop at the broker and is still compliant.

**Part C — the eight rejected rules.** The list exists *"so that when something proposes one of these — an LLM, a book, a confident stranger — the answer is already on record."*

| | Rejected | Why |
|---|---|---|
| D1 | "Cut losses short, let winners run" | true for trend-following, harmful for mean-reversion. *Belongs to a cell, never to the system* |
| D2 | "Never average down" | false for systematic value, true for momentum. Same problem |
| D3 | "A stop-loss order improves returns" | 71 markets, five independent groups: stops rarely improve expected or risk-adjusted returns. They improve **skew and drawdown**. In gaps, halts and limit-down a stop *does not bind at all* — "it buys variance improvement where the tail argument does not apply, and delivers little where it does" |
| D4 | "Risk 1–2% per trade" | traces to a 1990s metaphor. Kept only as a configurable default, combined by `min()`, never a floor |
| D5 | A specific Kelly fraction as a law | the growth curve is symmetric — half-Kelly and 1.5×-Kelly both give 75% of maximum growth. The real asymmetry is in vol and drawdown probability |
| D6 | Ergodicity arguments for sizing | genuinely contested; the practical implications overlap G2 and G10, which are not |
| D7 | "Diversification is the only free lunch" as a slogan | implies adding any position helps — false once correlations rise, "and they rise precisely in the crises the diversification was meant to survive" |
| D8 | Continuous de-risking instead of a bright-line breaker | "a bright line is auditable after the fact; a smooth policy's compliance can only be checked by re-running the code that produced it — and this system's dominant failure mode is rule *reinterpretation*" |

**Part D — what must be true before real capital.** Three items: G8 satisfied for every control described as a control; a **binding-order analysis** showing which cap binds first and whether they are jointly satisfiable (ADR-011 enumerates eight constraints, several jointly infeasible at $10k with HK board lots); and concentration set deliberately in the profile rather than inherited from a fixture.

**The escape hatch, and its shape.** If a guardrail is wrong: *"change this document and the code together, under review, and record why. What must never happen is a runtime override with a good explanation attached."*

## Practice Questions

- A colleague argues that a particular gate should be relaxable at runtime "when the model is confident." Which part of the guardrails answers that, and what is the argument?
- G8 says a constraint not exercised on the live path does not exist. Give a concrete instance from this repo and say what it cost.
- The system has no resting stop order at the broker. Which guardrail could that violate, and why doesn't it?
- Why was "a stop-loss improves returns" *rejected*, and what is a stop permitted to be described as instead?
- What is the difference in practice between a HARD rule and a HUMAN rule when you want to change one?

## Common Misconceptions

- "Guardrails are best practices." → They are admitted only if arithmetic or battle-tested. Everything contested was dropped on purpose.
- "There must be an override for emergencies." → For HARD rules there is none, for anyone, at runtime. The kill switch is a separate deliberate carve-out, not an override.
- "Stops are the tail control." → D3 explicitly denies it. The genuine tail instruments are position size, position count, and defined-risk structures.
- "The dropped list is just background." → It is load-bearing: it pre-answers arguments that would otherwise be relitigated every time someone persuasive raises them.
- "G8 means untested code is bad." → It is stronger: an unexercised control *does not exist*, and may not feed any other calculation until it does.

## References

- `docs/guardrails.md` — Parts A, B, C, D and the authority model
- `DECISIONS.md` ADR-011 (= G8, with the `stopPrice` evidence)
- `docs/ownership-contract.md` — the five invariants and what needs a human signature
- `src/risk.ts`, `src/positions/evaluate.ts` — where G7, G11 and G14 show up as code
