---
id: fail-closed
title: "Fail-Closed: The Load-Bearing Property"
difficulty: 1
prerequisites: [what-trader-is]
tags: [foundation, safety]
---

## Summary

ADR-003 names fail-closed "the load-bearing safety property." In practice it means three things: anything the system cannot verify aborts the run rather than proceeding on a guess; failures are returned as typed *values* rather than thrown as exceptions, so the compiler forces you to handle them; and **absence of a control is never rendered as a control that passed**. Almost every surprising line of code in this repo is an instance of one of those three.

## Key Points

- Exit codes are exactly three: `0` only for a completed run, `1` for a run that started and aborted, `2` for never reaching a run at all (bad usage or bad config). The header comment in `src/cli/main.ts` says it in caps: EXIT 0 ONLY FOR A COMPLETED RUN.
- ADR-008: data-layer failures are **values, not exceptions**. `fetchBars` returns a discriminated `FetchOutcome` with a typed `error.code`. A union makes handling "a strict-mode exhaustiveness obligation rather than a discipline problem."
- Nothing is defaulted silently. `loadConfig` in `src/cli/run.ts` is hand-rolled and rejects rather than substitutes — no defaults, no coercion, and it validates *finiteness*, not just presence.
- ADR-017 is the cleanest statement of the principle, and the *rejected* option is the interesting half: "fetch equity from the broker, fall back to config" was refused because **the fallback is the whole defect**. A stale equity figure sizes every position and disarms the breaker.
- Absence ≠ failure ≠ empty. The store distinguishes `absent` from `unreachable` and carries the errno; the veto layer fails CLOSED on a model outage but PASSES when no model is configured; the desk page renders an unreadable store as UNKNOWN, never as an empty book.
- A control that did not run must not look like a control that passed. `ControlState` in `src/ui/view.ts` and `GateOutcome.status` in `src/report/decision.ts` both carry an explicit `did-not-run` / `not-run` value, and optional gates default to **false**.
- ADR-015: there is no data-source fallback chain in v1. An Alpaca outage is "a failed scan rather than a wrong one."
- Gaps are repairable; fabrications are forever. The NAV series may have holes and must never have zeros; ADR-029 inherits this for model judgements — a morning with no answer is a morning with **no row**.

## Deep Dive

**The abort vocabulary.** `runOnce` in `src/cli/run.ts` can stop the run with these codes, and they are evaluated in this order:

```
non-trading-day → market-mismatch → calendar-out-of-coverage → missing-credentials
  → no-account-source / account-unavailable / account-unusable / no-equity
  → store-locked → store-<code>
```

`store-<code>` expands over `StoreErrorCode`: `unreadable`, `unreachable`, `malformed`, `schema-too-new`, `position-invalid`, `stale-generation`. The scan layer adds its own: `invalid-pos-cap`, `sector-cap-without-families`, `duplicate-position-symbol`, `fx-*`, `bad-request`, `unexpected-error`, and more. Every one of them exits 1 rather than continuing with a partial answer.

**Why exceptions were rejected (ADR-008).** If `fetchBars` throws, the only thing forcing a caller to handle the failure is the caller's memory. If it returns

```ts
| { ok: true;  requested: BarRequest; series: BarSeries }
| { ok: false; requested: BarRequest; symbol: string; error: FetchError; attempts: SourceAttempt[] }
```

then TypeScript's strict-mode narrowing will not let you read `.series` until you have handled `ok: false`. The safety property becomes a type-checker obligation.

**The `existsSync` ban.** This is the single best worked example in the repo. `existsSync` returns `false` for *every* failure — genuine absence, `EACCES`, `EMFILE`, `EIO` — so a store that was perfectly healthy but temporarily unreadable was announced as lost (TR-037). The fix in `src/store/index.ts` is a three-state probe:

```ts
type Probe =
  | { state: 'present' }
  | { state: 'absent' }
  | { state: 'unreachable'; errno: string }
```

built on `statSync(path, { throwIfNoEntry: false })`, where `undefined` means ENOENT **and nothing else**. And the decision table goes further: `positions.json` absent but `positions.json.prev` present is reported as `unreadable` — "this is a lost store, not a first run." The *only* path that yields an empty book is absent-and-no-prev.

**Where fail-closed deliberately does not apply.** Two places, both reasoned:

1. `src/cli/flatten.ts` — the kill switch. It consults the calendar **only to warn**, never to refuse, because "a refusal they cannot override is a control that fails in the dangerous direction." When an operator needs to be flat now, the machine does not get a vote.
2. `sessionPointInTime` in `src/data/session.ts` degrades to a weekend-only check when the calendar has no coverage — and that single boolean is the *only* permitted fallback in the system. Session **counting** never falls back.

**The one-way asymmetry.** Fail-closed here always means failing toward *not trading*. `src/earnings/index.ts` inverts it and says so: every path "resolves — never throws, never rejects," because earnings awareness is advisory and must never gate a run. Knowing which direction a component fails in is more important than knowing that it fails.

## Practice Questions

- A run exits 1. What do you know, and what do you not yet know?
- The broker account fetch times out. Why is falling back to the `equity` value in the config file worse than aborting the whole run?
- The store file is missing but `positions.json.prev` exists. What does `loadStore` return, and why isn't that just "first run"?
- Name a component in this repo that deliberately does *not* fail closed, and give the reasoning.
- What is the difference between the veto layer being "unavailable" and "not configured", and why does the code refuse to collapse them?

## Common Misconceptions

- "Fail-closed means it throws on error." → The opposite: it *returns* errors as typed values so the compiler forces handling. Throwing is what lets a failure slip past.
- "An empty result and a failed result are both just 'no data'." → They are opposite claims. Empty means the source answered and had nothing; failed means you do not know. Collapsing them is how a healthy store got announced as lost.
- "A missing config field should get a sensible default." → No field in this repo defaults. ADR-017's rejected option is the canonical example: the fallback *is* the defect.
- "Fail-closed applies everywhere." → The kill switch (`flatten`) and the earnings layer both deliberately do not, and each says why at the top of the file.
- "Exit code 1 means a bug." → It usually means a guard did its job. A non-trading day exits 1.

## References

- `DECISIONS.md` ADR-003 (fail-closed as the load-bearing property), ADR-008 (errors as values), ADR-015 (no fallback chain), ADR-017 (the fallback is the whole defect)
- `src/store/index.ts` — the `Probe` type and the `loadStore` decision table
- `src/cli/run.ts` — `runOnce` and the ordered abort codes
- `src/ui/view.ts` — `ControlState` and the did-not-run rule
- `src/cli/flatten.ts` — the deliberate exception, with its reasoning at the top
