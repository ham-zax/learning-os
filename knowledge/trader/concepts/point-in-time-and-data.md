---
id: point-in-time-and-data
title: Point-in-Time and the Data Foundation
difficulty: 2
prerequisites: [the-scan-pipeline]
tags: [mechanics, data]
---

## Summary

"Point-in-time" (PIT) means a decision may read only facts that were knowable at the moment it claims to have been made. Every look-ahead bug in a trading system makes the results look *better*, never broken, so this layer is built to refuse rather than repair. Two failure modes are named and they are opposites in mechanism: **survivorship bias removes rows** (a universe rebuilt from today's listed names has already deleted every company that failed); **look-ahead adjustment rewrites rows** (a vendor's fully-adjusted series is adjusted with everything up to today).

## Key Points

- **No module below the composition root reads the clock.** `src/data/bars.ts`, `src/universe/rule.ts`, `src/universe/families.ts` all declare it. Time enters as `BarRequest.asOf` / `PointInTime.asOf`. `src/platform/index.ts` is "the ONLY place in the repo permitted to call the real clock, the real RNG, or the real network."
- Dates are compared **lexicographically**, which is chronologically correct only for canonical `YYYY-MM-DD`. The historical defect: an unpadded `'2026-8-11'` sorts after every August date and would silently return a month of future data.
- The guard is `isCanonicalDateString` — regex `^\d{4}-\d{2}-\d{2}$` **plus** a UTC round-trip, so `2026-02-30` is rejected too.
- **Exactly one place converts a wall clock to a session date**: `computeSessionDate` in `src/data/session.ts`, via `Intl.DateTimeFormat` — never UTC string-slicing, never fixed-offset arithmetic. `bars.ts` deleted its own private copy and imports this one.
- **Two price bases, deliberately.** The *traded* basis is split-adjusted (`adjustment: 'split'`) and prices every order, stop and reference. The *scoring* basis is total-return (`adjustment: 'all'`) and feeds the momentum score **only**. A symbol whose scoring series is missing or misaligned is **skipped**, never quietly scored on the traded basis.
- The corporate-action filter is two conditions, not one: an action applies only when `knownFrom <= asOf` **and** `effectiveFrom <= asOf`. A retroactive announcement is the only case where the two diverge — which is exactly why filtering on `effectiveFrom` alone passes any naive test.
- The calendar refuses outside its coverage rather than falling back. `CalendarErrorCode` is exactly `out-of-coverage | bad-date | inverted-range`. Session **counting** never degrades.
- `feed: 'iex'` is what ships. IEX is one venue, so `volume` and intraday range are not usable as liquidity or cost proxies — which is why `maxRoundTripBps` is deliberately unset.

## Deep Dive

**Why lexicographic comparison at all?** Because it makes every date operation in the system a string comparison with no timezone in it, which is the only form that cannot drift. The price is that the canonical format must be enforced at every boundary — and it is, at three separate places with three separate implementations: `isCanonicalDateString` for request fields in `bars.ts`, `isCanonicalDate` for universe/adjust fields in `load.ts`, and `parseRowInstant` for vendor rows (which legitimately carry a time and an offset).

**The timezone hole the clock-grep cannot see.** A date-time string with *no offset* is parsed by ECMAScript in the **host's** local zone. Byte-identical input, 13 hours of spread, and no module read the clock. Hence the offset is mandatory once a time is present, and the timestamp regex is a **whitelist** with both anchors — because `BarSource.fetch()` returns `unknown[]`, so the shape set is open. The reasoning: *"a rejected row is visible in `provenance.dropped`; a misparsed one is invisible forever."*

**The bars layer, in outline.** `fetchBatch(reqs, chain)` is **sequential**, not concurrent — at most one source fetch is in flight, for determinism and free-tier rate limits. It returns one `FetchOutcome` per request, index-correlated. There is **no partial success**: either a source cleared the bar or the whole request fails. Partiality lives in `BarSeries.provenance` — `rowsIn`, `rowsOut`, `filtered`, `dropped` (a bounded sample of 50), `droppedTotal` (the truth), `attempts`, `fallbackUsed`, `coverage`.

Per-row validation is first-failing-check-wins, in a fixed `DropReason` order: `missing-field → non-finite → bad-date → symbol-mismatch → high-lt-low → ohlc-bracket → non-positive-price → negative-volume`. Note `toNumber` returns `NaN` for a blank or whitespace-only string, because `Number('')` is `0` in JavaScript — a silent zero price.

Attempt outcomes: `served | empty | insufficient | unavailable | error | not-listed-in-window` (the last is reserved and never emitted in v1). `'empty'` deliberately does not distinguish "my query window missed the rows" from "this instrument was not listed then" — conflating them is how an instrument gets dropped from a universe.

**Corporate actions.** `adjustSeries` in `src/universe/adjust.ts` has ten rejection codes and refuses in every ambiguous case. It will not adjust a series that is already adjusted (`not-raw`), will not trust a label the adapter fabricated (`source-not-unadjusted`), will not apply a dividend in a different currency (`currency-mismatch`), and will not skip an action kind it does not recognise — it rejects the whole series (`unknown-action`), because *"filtering makes a caller's wiring bug invisible; rejecting makes it loud."*

The arithmetic is asymmetric on purpose. A $2.50 dividend delivered as `250` against a close of `100` gives a factor of `-1.5`, **flipping the sign of every prior bar** — hence the guard `!(closeBasis > 0) || !(a.amount < closeBasis)`. Prices use `factorAt`; volume uses `splitFactorAt` (splits only), because dividing volume by the combined factor inflates it in the *flattering* direction: a share-based ADV floor would admit a name that does not qualify.

**The universe, and its known weakness.** What ships is a hand-curated 70-name list in `config.local.json`. `src/universe/rule.ts` implements membership *by rule* as-of a date, and is exported but never called. Its header states the problem plainly: three of 2026's four biggest moves were untradeable because they were absent from the list, and adding 13 symbols roughly doubled every measured 2026 configuration. *"A human editing the pool in hindsight is exactly the survivorship error this project exists to catch — 'it went up, so it belongs' is unfalsifiable. The only admissible criterion is one computable FROM THE PAST ALONE."*

Likewise `src/universe/families.ts` derives families from realised correlation (single-linkage clustering over `1 − ρ`) and is not wired. Today `config.families` is a hand-assigned judgement nothing can check.

**The calendar.** `TradingCalendar` exposes `isTradingDay`, `isHalfDay`, `sessionsBetween` (half-open `(from, to]`), `sessionsInRange` (closed `[from, to]`), `nextSession`, `previousSession` — every one returning a `CalendarResult`, never a bare value. The half-open/closed asymmetry is deliberate: `(from, to]` is exactly "entryDate exclusive to exitDecisionDate inclusive," and an off-by-one there shifts every holding-period count and every time-stop comparison.

Coverage is **derived** from the per-year provenance manifest, never asserted beside it, "so it is structurally impossible for a date to be in coverage with no data behind it." The US table is rule-derived (Easter, nth-weekday, etc.) *plus* nine ad-hoc closures no rule can generate — 2001-09-11 through 09-14, 2004-06-11, 2007-01-02, 2012-10-29/30, 2018-12-05. Without them "a backtest holds positions through days the market never opened."

## Practice Questions

- Why is the date `'2026-8-11'` dangerous in this codebase specifically? Walk through what it would cause.
- The system uses two different price series for the same symbol on the same day. What is each one for, and what happens if one is unavailable?
- A corporate action filter uses only `effectiveFrom`. Which single scenario reveals the bug, and why does no ordinary test catch it?
- The trading calendar is asked about a date in 1998. What does it return, and why doesn't it fall back to a weekday count?
- Why can't this system use `Bar.volume` as a liquidity filter today?

## Common Misconceptions

- "PIT just means don't use future data." → It also means *not repairing* data. A repaired vendor row becomes a plausible fact that never existed.
- "Split-adjusted and total-return prices are basically the same." → Over ten years the same name reads 106% or 224% depending purely on that choice. And total-return prices restate history at every dividend, so a stop recorded last week drifts — one-directionally toward firing early.
- "A vendor default is a safe default." → ADR-019 and ADR-016 both make the setting required and validated. Leaving `feed=` to the vendor "makes the limitation invisible and unattributable."
- "An empty result means the instrument has no data." → It means the source answered with zero rows. It could be a query window, a retry storm, or genuine absence — and treating it as absence is how names get dropped.
- "The 70-symbol universe is the design." → It is the acknowledged survivorship trap. The rule-based replacement is built, tested, and not wired.

## References

- `src/data/bars.ts` — validation, `fetchBatch`, the fallback chain, provenance
- `src/data/session.ts` — `computeSessionDate`, `sessionPointInTime`, the one-place rule
- `src/universe/adjust.ts` — the two-filter PIT split and the ten rejection codes
- `src/universe/rule.ts` — `selectUniverse` and the survivorship argument
- `src/calendar/` — `TradingCalendar`, coverage derivation, the US ad-hoc closures
- `DECISIONS.md` ADR-016 (IEX only), ADR-019 (adjustment required), ADR-027 (SIP is historical-only)
