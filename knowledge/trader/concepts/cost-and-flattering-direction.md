---
id: cost-and-flattering-direction
title: Costs and the Flattering Direction
difficulty: 3
prerequisites: [the-risk-stack, point-in-time-and-data]
tags: [judgment, cost]
---

## Summary

G3 says costs compound deterministically while returns do not, so *"every bet passes a net-of-cost gate before it is proposed."* The cost estimator in `src/cost/` is built to be **wrong in the expensive direction on purpose**: full spread on both legs, sell-side fees charged twice, p90 slippage rather than mean, and `Math.ceil` everywhere. And the gate that would compare cost against an *edge* is built, tested, and deliberately never called — because there is no measured edge to put on the other side, and fabricating one is forbidden.

## Key Points

- Two different things share the word "gate." `costGate` in `src/cost/gate.ts` compares cost to a projected edge and **has no call site anywhere**. What runs on the live path is a **ceiling**: `cost.roundTripBps > profile.maxRoundTripBps` → skip.
- Every cost component doubles for the round trip and rounds up: `roundUpToCent` uses `Math.ceil`, deliberately never `Math.round`.
- Spread is charged in full on **each** leg, not half — retail market orders pay the ask going in and the bid coming out.
- Fees use the sell-side schedule on **both** legs even though SEC §31 and FINRA TAF are sell-only.
- Slippage reads **`p90Bps`** for a measured model and `bps` for a prior — never the mean.
- Spread is **inferred**, not quoted: Corwin–Schultz (2012) high-low estimator over 21 daily bar pairs. No quote feed is involved. Negative estimates are clamped to zero before averaging; fewer than 3 usable pairs returns `{ ok: false }` rather than a number.
- An unmeasurable spread **propagates as a rejection** — the estimator never substitutes a default.
- **`maxRoundTripBps` is unset in both shipped configs**, so the cost gate does not run today. That is ADR-027, and the report must render it as a control that **did not run**, never one that passed.
- The reason: on a one-venue IEX feed, Corwin–Schultz on that venue's high/low **understates** the spread. *"A gate that is wrong in the flattering direction is worse than a gate that is honestly absent."*

## Deep Dive

**The arithmetic.** With `notional = qty × referencePx`:

```
spreadUsd   = ceil( 2 × (spreadBps  / 10_000) × notional )
feesUsd     = ceil( 2 × feeForOneLeg(feePerSide, qty, referencePx) )
slippageUsd = ceil( 2 × (slippageBps / 10_000) × notional )
roundTripUsd = ceil( spreadUsd + feesUsd + slippageUsd )
roundTripBps = ceilBps( roundTripUsd / notional × 10_000 )
```

The regulatory schedule (`src/adapters/alpaca-broker.ts`): SEC §31 at 0.0000206 × value (sells only), FINRA TAF at 0.000195/share capped at 9.79 (sells only), FINRA CAT at 0.000003/share (both sides). The default assumed slippage prior is 5 bps.

**Every one of those choices is asymmetric, and that is the point.** G3's reasoning: *"too pessimistic costs a few bets, too optimistic silently inverts the sign of an edge."* If you "fix" any of them toward accuracy, you are reintroducing exactly the optimistic failure the guardrail exists to prevent.

**Why the real cost gate is dead code.** `costGate` computes `requiredBps = roundTripBps + marginBps` and passes only when `projectedEdgeBps >= requiredBps`. The reasoning for leaving it unwired is not in `gate.ts` — it is in the `maxRoundTripBps` docstring in `src/types.ts` and in ADR-025's Consequences: the system has no measured edge to put on the left-hand side, and ADR-010 ("count, don't fit") forbids manufacturing one from fewer than 200 closed trades per cell. So ADR-025 ships the ceiling instead — a bounded, *named* exception to ADR-011, recorded rather than smuggled.

Anyone grepping for `costGate` to understand production behaviour is reading the wrong function.

**ADR-027, and the lesson that generalises.** The premise "we have SIP" was carried in `NEXT-SESSION.md` from session 6 onward. It was half true — the account's SIP entitlement is **historical only**. A request whose `end` is the current session returns *"subscription does not permit querying recent SIP data"*, and the decision path always asks for today's close. Switching the feed to `sip` therefore failed **70 symbols out of 70** on the first live run, **while every fixture test stayed green**.

The generalisation recorded: *"a vendor entitlement is a claim about a specific request, not a property of an account."* And a second one, about premises: a premise written once and repeated across handovers is exactly this failure shape.

The consequence for cost: IEX is one venue, so `volume` and intraday range are not usable as liquidity or cost proxies. `maxRoundTripBps` is left unset rather than fed a number that would be flattering.

**A real ordering subtlety.** The cost gate runs **before** `sizeDown`. `estimateRoundTripCost` is called with the pre-`sizeDown` quantity, and the resulting bps is never re-checked after the risk gate shrinks the order. Because fees include the TAF cap non-linearity and every component is ceiling-rounded, a materially smaller order can carry a *higher* `roundTripBps` than the one that passed.

**The flattering direction as a repo-wide habit.** Once you see it, it is everywhere:

- adjusted **volume** is divided by the split factor only, because dividing by the combined factor inflates it — and a share-based ADV floor would then admit a name that does not qualify
- `claude:cost` **excludes** reused judgement rows, because folding them in "would report a fortnight that got cheaper and faster every time somebody re-ran a morning"
- redefining `familyCap` was refused because it would change every existing config **in the permissive direction**
- the trading calendar refuses outside coverage rather than falling back to weekday counting, which would be right ~96% of the time, never flagged, with a bias whose sign is unknowable

## Practice Questions

- The cost estimator charges the full spread twice and sell-side fees on both legs. Both are technically wrong. Why is that the correct implementation?
- `costGate` exists, is tested, and is never called. Which two ADRs explain that, and is it a violation of G8?
- Why is `maxRoundTripBps` deliberately unset, and what must the desk render for that control?
- "We have SIP data." Walk through why that sentence was both true and catastrophically wrong, and what rule was written from it.
- The risk gate sizes an order down after the cost gate passed it. Describe a case where the smaller order is actually more expensive in bps.

## Common Misconceptions

- "The cost model should be as accurate as possible." → It should be conservative. Accuracy in the optimistic direction silently inverts the sign of an edge.
- "Spread comes from the quote feed." → It is inferred from daily OHLC via Corwin–Schultz. There is no quote data in this system.
- "An unmeasurable cost defaults to a typical value." → It rejects. ADR-025: unmeasurable cost REJECTS.
- "The cost gate is passing." → It is not running. `maxRoundTripBps` is unset, and the difference is rendered explicitly.
- "Switching the feed to SIP is a one-line improvement." → It failed 70 of 70 symbols live while every test stayed green. SIP is historical-only on this account.

## References

- `src/cost/estimate.ts`, `src/cost/spread.ts`, `src/cost/gate.ts`, `src/cost/types.ts`
- `src/runner.ts` — the live ceiling check and its inputs
- `src/adapters/alpaca-broker.ts` — `FEE_SCHEDULE`, `regulatoryFee`
- `docs/guardrails.md` G3
- `DECISIONS.md` ADR-010 (count, don't fit), ADR-016 (IEX only), ADR-025 (the ceiling), ADR-027 (SIP is historical-only)
