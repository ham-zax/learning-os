---
id: spec-altitudes
title: The Five Spec Altitudes
difficulty: 3
prerequisites: [foundry-what-it-is]
tags: [workflow, process, judgment]
---

## Summary
Foundry's spec-driven development has five altitudes, each answering exactly one question: Decision (ADR — *why*), System spec (`sdd/` — *what*), Tech spec (`techspec/` — *how*, normative names and signatures), Ticket (*this unit of work*), Tests (the executable contract). The whole discipline is one sentence: **a lower layer never contradicts a higher one; if it must, the higher one changes in the same commit.**

## Key Points
- **Decision** → `docs/adr/` — *why*, dated, append-only. Changing it means a new ADR or a status flip, **never a silent edit**.
- **System spec** → `docs/sdd/` — *what* the system does. Amend the section in the same commit.
- **Tech spec** → `docs/techspec/` — *how*: normative names, DDL, signatures. Amend in the same commit as the code.
- **Ticket** → `docs/tickets/` — this unit of work. It closes with the work.
- **Tests** → `<pkg>/test/` — the executable contract the coder is graded by.
- **The ticket never restates a spec — it links.** If a ticket and a spec disagree, **the spec wins and the ticket is wrong**.
- **The techspec is normative for names.** Inventing a column, type or route shape means you probably missed where it is already specified.
- ADR-0027: a ticket **declares the specs it may amend** (`spec_amendments`); `owned_paths` alone forces spec drift.

## Deep Dive
The rule "a lower layer never contradicts a higher one, and if it must, the higher one changes in the same commit" is what stops documentation rot without requiring anyone to be diligent. You cannot land code that contradicts the techspec — you must amend the techspec in the same commit, which puts the contradiction in the diff where a reviewer sees it.

ADR-0027 closes the loophole. `owned_paths` says which *code* a ticket may touch, but the specs it would need to amend are not code, so a ticket with correct `owned_paths` was structurally unable to keep its spec in sync — the very drift the altitude rule exists to prevent. So a ticket now also declares `spec_amendments`. Note the shape of the fix: the boundary system was extended to cover documents, rather than the rule being relaxed.

The "spec wins, ticket is wrong" tiebreak is worth internalising early, because your instinct as a new contributor will be the reverse — the ticket is what you were handed, so it feels authoritative. It is not. It is the *lowest* prose altitude, deliberately disposable, and it links rather than restates so that it cannot silently fork.

## Practice Questions
1. Name the five altitudes and the one question each answers.
2. State the discipline in one sentence.
3. A ticket says a column is `created_at`; the techspec says `queued_at`. Which wins, and what do you do?
4. What problem did ADR-0027 fix, and what does that tell you about how foundry fixes boundary problems?
5. Why does a ticket link to specs instead of restating them?

## Common Misconceptions
- "The ticket is the spec" → The ticket is the *lowest* prose altitude. Specs outrank it.
- "Update the docs after the code lands" → Same commit, always. That is the whole mechanism.
- "An ADR can be edited to reflect reality" → New ADR or a status flip, dated. Never a silent edit.

## References
- `docs/implementation.md` §1
- `docs/adr/0027-spec-amendment-declarations.md`
- `docs/tickets/README.md`
