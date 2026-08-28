---
id: information-barrier
title: The Information Barrier
difficulty: 4
prerequisites: [ticket-lifecycle]
tags: [workflow, process, judgment, agents]
---

## Summary
The coder receives **failing tests, never the ticket**. A test author writes tests from the ticket; roughly 60% are visible and 40% are hidden (`// @hidden`) and withheld until review. The coder is graded mechanically by tests it did not write and cannot read — which is both a correctness control and the reason a cheaper model is safe for implementation.

## Key Points
- **Test author** sees the ticket, techspec sections, source paths. **Coder** sees failing tests, `test-map.json`, its own file paths, and the normative techspec sections named in the tests — **never the ticket, never the hidden tests**. **Reviewer** sees ticket, diff, all tests.
- Test split ≈ **60% visible / 40% hidden**; hidden tests carry `// @hidden`.
- If a hidden test fails at review, the ticket goes back to `implementing` and that test becomes visible (`hidden_promoted`).
- Model tiering: design/planning/ADRs on **Opus**; test authoring, implementation, review on **Sonnet**; **Haiku** for mechanical edits. Adversarial plan review runs on different weights from the planner **on purpose**.
- **The P0 exception:** P0 tickets (FDY-002…007) run single-agent — no coder spawn, no withheld ticket, no hidden split. **TDD is not waived**: red before green still holds.
- `test-map.json` maps source path → test paths. Optional at P0, **required from P1**, where the barrier depends on it.

## Deep Dive
The stated purpose: it stops implementations that satisfy the **wording** of a spec rather than the **behavior** it describes. Give a capable model both the prose and the tests and it will reconcile them — often by writing something that reads like the prose and passes the tests without doing the thing. Remove the prose and the only available target is behavior.

The second consequence is economic, and CLAUDE.md is explicit that it is the same policy expressed as cost: *"a cheaper model graded by tests it cannot read is held to the same bar as an expensive one told what to build."* Tiering is safe **because** of the barrier, not alongside it. That is why the two are documented together.

Notice the deliberate use of different weights for adversarial plan review — the `architect` subagent runs Sonnet while the planner runs Opus, and the doc says *different weights from the planner is the point*. A reviewer sharing the planner's failure modes is not an independent check.

The P0 exception is a good model for how to carve an exception honestly. It names exactly what is removed (the second agent), exactly what is not (red-green discipline), and the reason (scaffolding has almost no behavior to blind, so a barrier there is ceremony) — and it names the specific P0 acceptance criteria that *do* describe real behavior and therefore still need genuine unit tests: config precedence, error mapping, `Tainted` serialization, object-store round-trip.

## Practice Questions
1. What does the coder receive, and what is it structurally denied?
2. What failure mode does the barrier prevent? Explain the mechanism.
3. Why does the barrier make a cheaper implementation model safe?
4. A hidden test fails at review. What transition fires and what happens to that test?
5. What does the P0 exception remove, and what does it explicitly not remove?
6. Why does adversarial plan review deliberately use a different model tier?

## Common Misconceptions
- "The coder gets the ticket for context" → Never. That is the whole control.
- "Hidden tests are a trap for the coder" → They are the review-time check that the implementation generalizes past the visible cases.
- "P0 waives TDD" → It waives the second agent. Red before green still holds.
- "Model tiering is a cost optimization bolted on" → It is the barrier expressed as cost; the barrier is what makes it safe.

## References
- `docs/workflow.md` §The information barrier
- `docs/implementation.md` §4
- `CLAUDE.md` §Model tiering
