---
id: ticket-lifecycle
title: The Ticket Lifecycle
difficulty: 3
prerequisites: [the-phase-gate]
tags: [workflow, process, judgment]
---

## Summary
`open → specced → tests_written → red_verified → implementing → green → reviewing → closed`. Each forward transition has a named gate and a verifier. Backward transitions are normal, but must be recorded with a reason — never silent. Every transition is recorded in **two** places in the same commit: the ticket's `status:` frontmatter and `index.json`.

## Key Points
- Forward gates: `spec_linked` → `tests_exist_min_hidden` → `all_tests_fail` → `coder_assigned` → `visible_tests_pass` + five-command gate + **tests unmodified** → `reviewer_assigned` + **mutation review** → `approved_and_hidden_pass`.
- `red_verified` requires every test in `linked_tests` to fail **for the right reason** — missing behavior, not a load error. Commit them and record `red_verified_sha`: **that sha is the lock**.
- The green gate checks `git diff --name-only <red_verified_sha>..HEAD -- <linked_tests>` is **empty**. "Don't edit the tests" is checked, not trusted.
- Backward transitions: `reviewing → specced` (reason), `reviewing → red_verified` (untested behavior found), `green → implementing` (`hidden_promoted`), `implementing → tests_written` (wrong approach), `red_verified → specced` (reason).
- **Preflight:** read STATUS, check the phase, open the ticket's **Agent kickoff** section, check `blocked_by` (**every** blocker must be `closed`), **baseline the gate before changing anything**, and **state the gate you are about to pass**.
- **Never work around a blocker, never stub past a missing dependency, never silently substitute a different ticket.**
- A soft blocker may be overridden by the founder explicitly — and the override must be recorded in the ticket's Context, because an override living only in chat is an undocumented dependency violation.

## Deep Dive
Two mechanisms make this more than a status field.

**The `red_verified_sha` lock.** Committing the failing tests and recording the sha turns "the tests were red first" from a claim into a checkable fact, and simultaneously freezes the tests: any later diff against that sha under `linked_tests` fails the green gate. One recorded value enforces both TDD ordering and test integrity.

**"Fails for the right reason."** A test that fails because of an import error also "fails" — and proves nothing. Requiring the failure to be *missing behavior* is what stops a red round from being theatre.

The blocker rules read as unusually emphatic, and the reason is that this repo is worked by agents that are good at finding plausible ways forward. The instruction to **stop and report**, naming whether the blocker is *hard* (its output does not exist, so the work is impossible) or *soft* (an ordering preference), and to list what **is** pickable — that is designed to keep a helpful agent from quietly substituting easier work. As STATUS puts it: `blocked_by` in the index "is read by agents to decide what is pickable and is checked by nothing."

Also note the preflight step **baseline the gate**: run the five commands *before* changing anything. A pre-existing red gate is a finding to report, not something to inherit silently — otherwise you spend an hour debugging someone else's breakage and attribute it to your change.

## Practice Questions
1. Recite the eight states in order.
2. What is `red_verified_sha` and which two rules does it enforce at once?
3. Your test fails with a module-not-found error. Does that satisfy `all_tests_fail`? Why?
4. A ticket's blocker is still open. What are you required to do, and what are you forbidden from doing?
5. Why baseline the gate before you touch anything?
6. Where is a status change recorded, and how many places?

## Common Misconceptions
- "Backward transitions mean something went wrong" → They are normal. What matters is that they are recorded with a reason.
- "Don't edit the tests is an honour system" → It is a git diff against the locked sha.
- "If a blocker is only an ordering preference, just proceed" → Only with an explicit founder override, recorded in the ticket.
- "Updating the ticket frontmatter is enough" → Two places, same commit: frontmatter and `index.json`. A stale index is a defect.

## References
- `docs/workflow.md` §Implementation lifecycle
- `docs/implementation.md` §2–§3
- `docs/constitution.yml`
