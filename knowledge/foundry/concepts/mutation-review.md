---
id: mutation-review
title: Mutation Review
difficulty: 3
prerequisites: [unit-of-work, ticket-lifecycle]
tags: [workflow, invariants, judgment]
---

## Summary
Foundry adds one step to the standard agentic loop, because it is a platform that mutates: **any new write path must show where it enters the unit-of-work and what its audit row contains** — in the commit or PR description, every time. A write path that cannot answer this is rejected by design.

## Key Points
- Mutation review is a **forward gate**: `green → reviewing` requires it. A ticket that cannot answer does not reach `reviewing`.
- Two answers required: the **uow entry point**, and the **audit row contents**.
- Plus the ADR-0020/0021 **classification for every table touched** — system-of-record, derived, or operational.
- It goes in the commit description, **every time** — not a one-off design review.
- There is a `/mutation-review` skill that walks a write path to its uow entry point and audit row.
- It is one of the seven points in the reviewer's rubric, alongside spec fidelity, acceptance coverage, test integrity, spec drift, scope and gates.

## Deep Dive
This is the human-facing counterpart to the automated audit-completeness harness. The harness proves that writes across the API surface committed alongside an audit row; mutation review makes the *author* state the same fact in prose before a reviewer looks at the diff.

Why both? Because the harness can only test paths that exist and are exercised. Requiring the author to name the entry point and the row contents surfaces a different class of problem: a write that goes through the uow correctly but writes a **useless** audit row — wrong resource type, missing causation, a diff that says nothing. That is invisible to a completeness check, which only asks *whether* a row exists.

The classification requirement is the third leg. Naming each touched table's class forces the "is this really derived?" question at the moment someone could still answer it honestly. Classify a non-rebuildable table as derived and you have silently punched a hole in the audit trail — and unlike a missing row, nothing will ever fail.

The general shape: **automated check for existence, human review for meaning.** Neither substitutes for the other.

## Practice Questions
1. What two things must a new write path name, and where?
2. Which lifecycle transition does mutation review gate?
3. What does mutation review catch that the completeness harness cannot?
4. Why must you state each touched table's ADR-0020 classification?
5. What goes wrong if you misclassify a non-rebuildable table as derived?

## Common Misconceptions
- "The audit harness makes this redundant" → The harness checks a row *exists*; review checks it is *meaningful*.
- "It's a design-review step" → It is per-commit, every time, on every write path.
- "Classification is bookkeeping" → It decides audit and retention behaviour, and a wrong call fails silently forever.

## References
- `docs/workflow.md` §Golden rules, §Forward gates
- `docs/implementation.md` §7
- `docs/sdd/quality.md` §7 — reviewer rubric
