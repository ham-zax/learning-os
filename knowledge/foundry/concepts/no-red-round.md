---
id: no-red-round
title: The no_red_round Declaration
difficulty: 3
prerequisites: [information-barrier]
tags: [workflow, process, judgment]
---

## Summary
A red round proves a fix — but some tickets fix nothing. ADR-0030 lets such a ticket set `no_red_round` to a **non-empty string stating why**, leaving `red_verified_sha: null`. A bare `true` fails. Carrying both fields fails. **Never manufacture a red round to avoid writing one.**

## Key Points
- Two shapes have actually occurred: a **declared test-contract change** touching no source file (FDY-127), and a **verification** — a test written to prove a property that already held, so it passed on first write (FDY-130).
- The checker rejects: a bare `true`, an empty string, or whitespace. **The reason is the whole control** — a claim nobody can judge is not a declaration.
- Carrying **both** `red_verified_sha` and `no_red_round` fails, naming both: a real red point must never be shadowed by an excuse.
- **This is an escape hatch and is meant to be rare.** `grep '^no_red_round:' docs/tickets/` lists every claim with its reason — that list is the review surface.
- Breaking an export on purpose so it can be unbroken is **theatre**, and it puts a fake red point in the permanent record.

## Deep Dive
This is a small ADR that teaches a general lesson about rule design. TDD's "red before green" is right almost always, and the honest response to the exceptions is not to weaken the rule or to fake compliance — it is to make the exception **declared, justified, and countable**.

Each design choice serves that. Requiring prose rather than a boolean means the exception cannot be claimed thoughtlessly. Forbidding both fields prevents the worst outcome — a genuine red point paired with an excuse, where a reader cannot tell which is load-bearing. And making the whole set greppable turns "are we using this too much?" into a one-line query: *if that list grows, the question is why so little work is fixing anything.*

The warning against manufacturing a red round is the sharpest sentence. The failure mode it names — break an export deliberately so a test can go red, then unbreak it — satisfies every automated check while destroying the signal. The permanent record would show a fix that fixed nothing. That is worse than the honest declaration, and the ADR says so.

## Practice Questions
1. When is `no_red_round` legitimate? Name both observed shapes.
2. Why does a bare `true` fail?
3. Why is carrying both `red_verified_sha` and `no_red_round` an error rather than belt-and-braces?
4. How does a reviewer audit the use of this escape hatch across the repo?
5. What is "theatre" here, and why is it worse than declaring?

## Common Misconceptions
- "It's a flag you set when TDD is inconvenient" → It requires a justification a human can judge, and it is meant to be rare.
- "Safer to record both fields" → That fails, naming both.
- "Manufacture a small red round to stay compliant" → Explicitly forbidden; it puts a fake red point in the permanent record.

## References
- `docs/adr/0030-no-red-round-declaration.md`
- `docs/implementation.md` §3
- `docs/workflow.md` §Forward gates
