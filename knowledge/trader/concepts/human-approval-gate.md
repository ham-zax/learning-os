---
id: human-approval-gate
title: The Human Approval Gate
difficulty: 2
prerequisites: [the-scan-pipeline, fail-closed]
tags: [mechanics, safety, desk]
---

## Summary

Nothing opens a position without a person ticking a box, writing a reason, and scoring the decision 1–5. But the mechanism is not what most people guess: approval does not bypass anything. Approving a name **narrows the universe and re-runs the entire pipeline** in live mode. ADR-022 states it exactly: *"approval is permission to be considered, never an instruction to execute."* An approved name can still be refused by the sector cap, the drawdown breaker, or any other gate.

## Key Points

- The desk is `src/ui/server.ts`, bound to `127.0.0.1` only — never a network interface, because the process holds broker credentials. Default port 7777.
- `POST /api/submit` takes `{ decisions: Decision[], seenInboxIds?: string[] }`. A `Decision` is `{ symbol, approved, reason, quality? }`.
- **Approval requires a reason and, if approved, a decision-quality score 1–5.** `quality` is optional only for a pass-over: a name you did not take has no decision-quality score.
- The rule is enforced **twice** — the page mirrors it, and `validateDecisions` re-enforces it server-side — "because a control only the page applies is a control a page bug removes."
- `validateDecisions` refuses **whole**: one bad decision rejects the entire submission. "A decision record a client can skip is one that will be skipped on the day it matters most, and this dataset cannot be back-filled."
- Submission calls `deps.run({ ...config, mode: 'live', universe: approved })`. **There is no second order path.** Every gate runs again, unchanged.
- Rows arm only when justified: `isArmed(d)` requires defined, approved, non-empty trimmed reason, *and* an integer quality in 1–5. "The justification IS the click" — ticking first and being asked to justify afterwards lets the justification lag, and what lags can be skipped.
- Every proposal on the desk gets a journal row, decided or not. An undecided name journals as `kind: 'rejected'`, `reason: 'no decision recorded'`. Silence about a name is itself a fact about the morning.
- If nothing was approved, the broker is never touched — but the morning is still journalled.

## Deep Dive

**Why "narrow and re-run" instead of "approve and send."** Because a separate order path is a second place where the caps could be wrong, and it would only be exercised on the days a human said yes. By re-running the whole pipeline with `universe` set to the approved symbols, the calendar gate, credentials gate, lock, store, position cap, sector cap, E13 de-duplication, E14 pending exposure and the stop all run exactly as they do unattended. `submitted` is `out.digest.orders.length` and can legitimately be smaller than `approved.length`.

**The four zones** of the page (TR-041), of which three are named in `src/ui/view.ts`:

| Zone | Question it answers |
|---|---|
| 1 | "what the machine did without you" — the overnight run |
| 2 | "the book, with the number that says how much room is left" |
| 3 | "a row is armed only when it is justified" — the proposals |
| 4 | (present per `STATUS.md`; not named in `view.ts`) |

Zone 1 distinguishes three states, not two: `ran: false` because there is **no run record at all** ("this is not a quiet night — it is no news at all, and the watchdog is the thing to check"), `ran: false` because the run's `asOf` does not match the expected session ("a session is missing"), and `quiet: true` — it ran and did nothing. It reads the *unattended* run specifically (`mode === 'manage'` in `runs.jsonl`), because showing the operator their own desk scan back as "what happened overnight" would be worse than showing nothing.

**Three-state controls.** The governing rule is in caps in `src/ui/view.ts`:

> A CONTROL THAT DID NOT RUN MUST NOT LOOK LIKE A CONTROL THAT PASSED.

There are two vocabularies and they differ in cardinality. `ControlState` has **four** members — `passed | near | refused | did-not-run` — where `near` fires at 0.8 of a cap, "worth seeing BEFORE it refuses, because the refusal arrives after the decision." `GateOutcome.status` in `src/report/decision.ts` is the genuinely three-valued one: `passed | failed | not-run`. Five controls are rendered per proposal: `position-cap`, `family-cap`, `earnings`, `cost-gate`, `breaker`.

Canonical `did-not-run` cases: no equity reading (the cap has nothing to measure against); `earningsSessions === null` (unknown is the *absence* of a control, never a clean bill of health); `maxRoundTripBps === undefined` (ADR-027 withholds the cost gate on a one-venue feed).

Controls are computed **server-side**, in `state()`, "because the three-state rule is the most consequential thing on the screen and it belongs where a test can reach it." That relocation is itself a lesson: TR-041 found that a rule living inside an inlined HTML string is a rule no test can reach.

**The consequence line.** `consequenceOf(proposals, armed, equity)` shows what the currently armed set would cost if every stop hit on the same day — "which is what correlated names do." It returns count, committed, at-risk, and the two shares of equity, with the shares `null` when equity is unknown.

## Practice Questions

- You approve five names on the desk. Three orders appear at the broker. Is that a bug? How would you find out which it is?
- Why does approving a name re-run the whole pipeline instead of just sending the order?
- The desk requires a reason *and* a 1–5 quality score before a row arms. What failure is the ordering of those two requirements designed to prevent?
- A proposal is shown with the cost gate greyed out as "did not run." Why is that different from showing it as passed, and what would go wrong if the page showed a tick?
- You submit a batch where one of eight decisions has an empty reason. What happens to the other seven, and why?

## Common Misconceptions

- "Approval overrides the risk gates." → It is permission to be *considered*. Every gate runs again and can still refuse.
- "The desk is a UI over an API that places orders." → The desk *is* the caller of `runOnce`. There is no separate order path.
- "Scanning from the desk is safe." → It runs `mode: 'manage'`, which submits exits.
- "A control with no data should show as passing." → It must show as did-not-run. TR-029: an unknown earnings date is the absence of a control, not a clean bill of health.
- "Not deciding about a name leaves no trace." → It journals as rejected with reason "no decision recorded."
- "The journal prevents double submission." → It does not de-duplicate at all. That is `clientOrderId`, E13, the store generation counter and the lock.

## References

- `src/ui/server.ts` — `createDeskApp`, the routes, `validateDecisions`, `submit`, `journal`
- `src/ui/view.ts` — the zones, `ControlState`, `isArmed`, `consequenceOf`
- `src/report/decision.ts` — `GateOutcome`, `GATE_ORDER`
- `DECISIONS.md` ADR-022 (approval is permission), ADR-024 (open vs close), ADR-027 (withholding the cost gate)
- `docs/ownership-contract.md` — what requires a human signature
