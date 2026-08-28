---
id: failure-patterns
title: The Recurring Failure Patterns
difficulty: 4
prerequisites: [sdd-workflow, guardrails-and-authority, measurement-and-benchmarks]
tags: [mastery, doctrine]
---

## Summary

This repo names its failure modes and keeps the incidents attached to them. That is the actual onboarding material: the code is only unusual where a specific defect made it so. Every pattern below has a real incident behind it, and most of them recur — the repo's own phrasing is "four for four," "the fourth time in this repo," "every time so far." Learn the shapes and you can predict where the next one will be.

## Key Points

- **The root doctrine**: *"a wrong trading system does not crash — it produces plausible numbers."* Every other pattern is a specialisation of it.
- **G8 / ADR-011**: a constraint not exercised on the live path does not exist. Four separate instances in this repo.
- **A green suite proves the rules you thought of.** 760 tests green while 39 pending entries piled up against 13 broker orders.
- **A count is not a control.** Asserting `counts.open === 1` is satisfied by a runner that reports the position and then gates against an empty book — which *is* the defect.
- **A claim in a document is not a control.** "A human approves every proposal" was in the architecture for six sessions and was not implemented.
- **Prose rules ship broken** — four for four.
- **The fallback IS the defect.**
- **Absence and failure must never share a verdict.**
- **Gaps are repairable; fabrications are forever.**
- **Defects arrive in the flattering direction.**

## Deep Dive

**1. A constraint not exercised on the live path does not exist (G8/ADR-011).** ADR-011 records it as "caught three times in its own code," and ADR-017 calls itself "the fourth time in this repo":

- `stopPrice` was computed, sanity-checked and written to every journal row — and **read by nothing**. `side: 'sell'` appeared only in two type declarations. A position at up to 20% of equity carried a stop 7% below entry "that no order will ever execute."
- `familyCap` was a gross-exposure cap all along, while every document called it a family cap (ADR-018).
- The stop was described as enforcing a 1–2% risk per trade, making the framework's stated risk-per-trade **notional** — the real per-position exposure was `posCap`.
- **The fourth:** `dayReturn` had one reader and one source. With the field omitted, `undefined <= -breaker` is **false** — "the breaker did not fail loudly; it silently could not fire" (ADR-017).

ADR-013 nearly added a fifth *inside the fix*: a tempting pure-core split would have shipped two well-tested functions no runtime path calls, "reproducing the exact defect inside the spec written to remedy it."

**2. A green suite proves the rules you thought of.**

- ADR-020: three runs in one session, **39 pending entries against 13 broker orders**. *"Every one of 760 tests passed while this was happening."*
- ADR-021, immediately after fixing it: 26 orders, **~182% of equity**, every cap approving.
- ADR-027: **70 symbols out of 70** failed on the first live SIP run; every fixture test stayed green.
- The corollary drawn: **run it twice before believing it.** Idempotence under re-run is where state machines actually fail.

**3. A count is not a control.** The mutation pass on the live wiring found that removing open positions from the risk book entirely, *and* removing the quarantine mark, both passed every test. The fix was not more assertions but better fixtures: place the two behaviours on opposite sides of the family cap "so they produce different **decisions**, not different reports."

**4. A claim in a document is not a control.** "A human approves every proposal" was documented for six sessions; live mode scanned and submitted in one pass. *"It survived review because the artifact it produced looked like an approval step."*

The pattern has a live descendant worth watching. `NEXT-SESSION.md` says the sleeve "sizes off whole-account equity, five times its ratified budget" — that sentence *was* true and is now stale, because session 9 wired `sleeveBudget` and both shipped configs carry an `allocation` block. What genuinely remains open under TR-034 is narrower: the fractional-order decision is unmade, and four of fourteen proposals came out as 1–2 share positions. Notice the shape: **a document asserting a control that did not exist, and a document asserting a defect that no longer exists, are the same failure.** Check the code.

**5. Prose rules ship broken.** Three SPEC-002 defects, unrelated except for this: each was normative text with no numbered criterion, each was green its entire life, none was catchable by a hidden test *because no test existed to hide*. Session 9's restatement: a rule inside an inlined HTML string is a rule no test can reach — and four for four, those ship broken.

**6. Fixture quality is production quality.** Bars whose OHLC violated its own bracket; a series whose dates wrapped back on themselves. Each time the implementation was bent to fit the broken fixture, producing a weaker rule than the spec intended, all green.

**7. A check that verifies nothing.** `tsconfig.test.json` reported zero errors while typechecking **zero files** (`extends` inherits `exclude`, which overrides `include`); the real run then found 37 latent errors. And a test written conditionally was **vacuous** — mutating the guard to read the wrong arrays passed it. Rule: confirm a new check sees its inputs before believing a clean result.

**8. The fallback IS the defect.** ADR-017 rejects fetch-then-fall-back-to-config in exactly those words. ADR-015: a Yahoo fallback would label split-adjusted prices `raw` — AAPL's 4:1 split makes one series ~$125 against 299 at ~$500, with `ok: true, fallbackUsed: true, adjustment: 'raw'` — *"no test fails, and the numbers are arithmetically fine and economically fiction."* And the calendar refuses outside its data rather than falling back to weekday counting, which would be right ~96% of the time, never flagged, with a bias whose sign is unknowable.

**9. A vendor default is never neutral.** Leaving `adjustment` to Alpaca's default reintroduces the split defect quietly; leaving `feed=` to the vendor "makes the limitation invisible and unattributable." Both made required and validated at construction.

**10. A premise written once, repeated across handovers, never measured.** "We have SIP" travelled from session 6 onward — *"It was half true, and the false half was exactly the half the live path depends on."* TR-038's descriptor-leak hypothesis was retracted after its own test disproved it. And `input_tokens: 2` reported for a 3,209-token prompt would have made a cost decision "wrong by three orders of magnitude, and wrong small."

**11. An agent's assertion is not a result.** Four times in one session: a coder reporting green at 32 of 33; a coder with five untested regressions; two reviewers with no findings list and no verdict. Plus green reported from a worktree whose test files were stale. *"A result without the command and its output is not a completed handoff."*

**12. Absence and failure must never share a verdict.** `existsSync` returns false for every failure — which is how a healthy store was announced lost. The research veto **fails closed on a model outage but passes when no model is configured**: "absence of a control and failure of a control are opposite in meaning." An unset control renders as DID NOT RUN, never as passed.

**13. Gaps are repairable; fabrications are forever.** The NAV rule; ADR-029's no-row-for-a-missing-judgement; the HK 2027 calendar shipped `crossChecked: false` rather than transcribing unverified lunisolar holidays; the demo on `state-demo/` rather than seeded rows in `state/`.

**14. Two authoritative copies of one truth.** Two checkouts each with a store are "two books that both believe they are authoritative, and the failure is silent." And calendar coverage is *derived* from the provenance manifest rather than asserted beside it — "two hand-written facts that can disagree, where the wrong one is silent."

**15. Substituting a number that answers a different question.** `exitPx` from `stopPx` clamps every gap-down to exactly −1R, **truncating the left tail by construction**. Distance-to-stop is `null` when no reference price is known, never entry-to-stop — "substituting entry would answer a question nobody asked while looking like an answer to this one." `netPnl` summed across a US+HK book is a ~7.8× error on the HK leg; only dimensionless R aggregates.

**16. Defects arrive in the flattering direction.** A participation model on one venue's volume "is wrong in the direction that eventually gets tuned toward optimism." Redefining `familyCap` would change every config in the permissive direction. Excluding reuse rows from cost averages, because including them reports a fortnight that got cheaper every time somebody re-ran a morning.

## Practice Questions

- Pick any two of these patterns and say what they have in common at the level of *mechanism*, not consequence.
- You have written a new gate and all tests pass. Name three checks you would run before believing it, each drawn from a different pattern here.
- Why is "a count is not a control" a statement about *fixtures* rather than about assertions?
- A teammate proposes: "if the broker fetch fails, use the last known equity from the store." Which pattern is that, and what is the counter-argument?
- Which of these patterns would a code review catch that a hidden test would not, and vice versa?

## Common Misconceptions

- "These are historical bugs." → They are predictions. The repo's own count is "four for four" and "the fourth time in this repo."
- "Better test coverage would have caught them." → Several were invisible to any test, because the rule was never written as a criterion. That is why review and testing are separate gates.
- "A defect is a defect." → Here the *direction* matters more than the magnitude. Wrong-and-pessimistic costs a few trades; wrong-and-optimistic silently inverts the sign of an edge.
- "Adding a fallback makes the system more robust." → In this domain the fallback is usually the defect, because it converts a loud failure into a quiet wrong answer.
- "A stale premise is a documentation problem." → "We have SIP" was a stale premise that failed 70 of 70 symbols on the live path.

## References

- `docs/sdd-workflow.md` §1, §4b, §4c, §4d — the doctrines and their incidents
- `DECISIONS.md` — ADR-011, 012, 015, 016, 017, 019, 020, 021, 022, 026, 027, 029
- `STATUS.md` — "a count is not a control", the four-for-four record, the session-by-session narrative
- `NEXT-SESSION.md` — "a green suite proves the rules you thought of", "a claim in a document is not a control"
- `docs/guardrails.md` G3, G8, G11 — the arithmetic behind several of these
