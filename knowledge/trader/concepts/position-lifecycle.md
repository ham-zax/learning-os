---
id: position-lifecycle
title: Position Lifecycle and Exits
difficulty: 2
prerequisites: [run-modes-and-gates, point-in-time-and-data]
tags: [mechanics, positions]
---

## Summary

A position moves through three concrete types — `PendingEntry` → `OpenPosition` → `ClosedPosition` — and every transition returns a **new frozen object**; nothing is mutated in place. Exits resolve in a fixed precedence with exactly three rule-based reasons, so the journal can never misattribute a stop-out to a time-stop. And the position itself carries **no money**: every field is an executed fact. All derived money lives in `src/measure/`.

## Key Points

- `PendingEntry` — order submitted, no shares owned. `OpenPosition` — shares owned, every field readonly. `ClosedPosition extends OpenPosition` — terminal, no reopen path.
- An entry becomes a position only through `reconcileEntry` → `openPosition`, in a **later run**. Statuses `accepted`, `rejected`, `canceled` create no position.
- The three rule exit reasons, in **strict precedence**: `entry-beyond-stop` → `stop` → `time-stop`. It is an if/else-if chain, so exactly one reason is ever emitted.
- Because `stop` is tested before `time-stop`, a bar that breaches the stop on a session also past the horizon is journalled `'stop'`, never `'time-stop'`.
- **The stop may never be widened**, guarded at four independent layers: written once at construction; `tightenStop` rejects `newStop <= currentStop`; `rehydratePosition` rejects a stored stop below the registered one; and `evaluateOne` raises a `stop-widened` alarm before any price is read.
- There is **no resting stop order at the broker**. Exits are `kind: 'market'`, `tif: 'day'` — never `gtc`, because a GTC exit outlives the session it was reasoned about. The stop is an in-process rule evaluated once per run.
- `exitPx` is always the executed fill, never substituted from `stopPx`. "A stop at 93 that fills at 84 is a −2.29R trade, not a −1R trade."
- Partial fills are asymmetric: a **partial entry** creates a position for the filled amount; a **partial exit** leaves the position open and burns an exit attempt.
- Quarantine is **sticky** and one-way. An unexplained gap quarantines a position; only `clearQuarantine` clears it, and it records the operator, the note and the run.

## Deep Dive

**The state machine:**

```
                    reconcileEntry
  PendingEntry ──────────────────────► OpenPosition ──────────► ClosedPosition
       │  accepted → stays pending          │  evaluateExits        ▲
       │  rejected/canceled → discarded     │  → pendingExit        │
       │  bad fill / fill-date problem      └───────────────────────┘
       │  → stays pending, badFill: true         reconcileFill
       │                                          or closePosition (operator)
```

Sub-states are carried *on* `OpenPosition`, not as separate types: `quarantinedSince`, `pendingExit`, `entryBeyondStop`, `exitAttempts`, `firstExitSignalDate`. And "stuck" is not stored at all — it is the derived predicate `isStuck(p, profile, asOf)`, true on any of three escalation paths (too many exit attempts, too long unfilled, too long quarantined). Derived, so it cannot go stale and its three paths cannot disagree.

**Exit precedence, and why each rule sits where it does.** The comment states the axis: *"exactly three reasons, in fixed precedence… The axis is how much choice the condition leaves."*

| # | Reason | Trigger | Suppressed by an alarm? |
|---|---|---|---|
| 1 | `entry-beyond-stop` | `entryPx <= registeredStopPx`, a recorded entry fact | **No** — it reads no price at evaluation time |
| 2 | `stop` | any bar's **intraday low** `<= stopPx` | **Yes** — this is the only suppressed reason |
| 3 | `time-stop` | weekdays since entry `>= timeStopSessions` | No |

Note `>=`, never `==`, on the time-stop, so a missed run cannot step over it. And note the evaluation window **includes the fill session** — rev 2 used `(entryDate, asOf]` and day 0 was the one session guaranteed never to be checked.

**There is no trailing exit and no take-profit.** `tightenStop` exists as a mechanism and returns `{ rejected: 'no-trailing-rule' }` unconditionally, because no cell has pre-registered a trailing rule (G11). The widening check runs *first* inside it, deliberately, so that lifting the no-trailing branch later cannot remove the invariant with it.

**Operator exits are a separate axis.** `manual` and `corporate-action` are producible only by `closePosition` and **never** by `evaluateExits` — a delisting or a merger is not visible in a raw OHLC series. When a run had both, `supersededReason` records the rule decision so the discretionary bucket cannot absorb a rule-driven close.

**Entry→exit linkage.** The spine is `positionId` (a UUID minted at submission), carried through every stage and onto the exit `OrderRecord`. Order identity is *derived, not random*:

- entry `clientOrderId` = `${asOf}:${symbol}` — **session-stable, not run-stable**, so a re-run cannot double-submit
- exit `clientOrderId` = `${positionId}:exit:${decisionDate}` — keyed on `positionId` rather than symbol, so two positions in one symbol stay distinct

**The fill-date defect and its fix (E8d).** The entry's fill session comes from the **broker**: `fill.fillDate ?? ctx.fillDate`. If neither exists, or the two disagree, the entry stays pending and is marked `badFill` rather than being mis-dated. The reason: defaulting to the reconciling run's `asOf` would put `entryDate` *after* the sessions the stop rule must evaluate, so a stop breached on the true fill day would never be checked, ever.

Worth knowing: the **exit** leg does not apply the same guard. `reconcileFill` takes `ctx.fillDate` unconditionally, and the runner supplies the decision session as a fallback.

**Fees are never optional.** `validateFill` requires `fill.fee` to be finite and `>= 0` — `fill.fee ?? 0` is explicitly forbidden ("a free round trip"). A fee currency that disagrees with the quote currency rejects, and the check is on *presence*, not on `fee > 0`: the disagreement is the signal, not the amount.

**A quarantined position marks at `entryPx` in the risk book**, not at the latest close. Marking a post-split close would inflate family headroom by the phantom amount at exactly the moment prices are declared untrustworthy.

## Practice Questions

- Walk a position from proposal to closed. How many separate runs are involved at minimum, and why?
- A bar breaches the stop on a day that is also past the time-stop horizon. What reason is journalled, and why does the order of the checks matter for measurement?
- The system has no resting stop order at the broker. What does that imply about a gap-down overnight, and what does the code do about it?
- Why is `entry-beyond-stop` immune to alarm suppression when `stop` is not?
- An entry order fills but the broker's response carries no fill date. What happens, and what would go wrong if the code used the current run's date instead?

## Common Misconceptions

- "The stop is an order sitting at the broker." → It is a rule evaluated once per run against daily bars. There is no resting order.
- "A stop-out is −1R by definition." → `exitPx` is the executed fill. A gap-down stop-out can be −2R or worse, and a test asserts it.
- "Partial fills behave the same on entry and exit." → A partial entry creates a position; a partial exit leaves it open and burns an attempt. "A partial exit has remainder state to track, a partial entry does not."
- "Quarantine is recomputed each session." → It is sticky. Rev 2 computed it per session, so a split merely deferred the false stop-out by one day.
- "You can tighten a stop to lock in gains." → `tightenStop` rejects unconditionally today, and widening is blocked at four layers permanently.
- "A position tracks its P&L." → It carries no derived money at all. That is SPEC-022's job.

## References

- `src/positions/types.ts` — the three types, `RuleExitReason`, `ALARM_PRECEDENCE`, `ExitProfile`
- `src/positions/construct.ts` — `openPosition`, `validateFill`, `tightenStop`, `freezePosition`
- `src/positions/evaluate.ts` — `evaluateExits`, the precedence chain, quarantine, `isStuck`
- `src/positions/lifecycle.ts` — `reconcileEntry`, `reconcileFill`, `closePosition`, `buildExitOrder`
- `DECISIONS.md` ADR-011 (the unexercised stop), ADR-012 (executed prices only), ADR-013 (executed facts vs derived measures)
