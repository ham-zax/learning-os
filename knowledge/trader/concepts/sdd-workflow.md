---
id: sdd-workflow
title: The SDD Workflow and the RED Gate
difficulty: 3
prerequisites: [where-truth-lives]
tags: [judgment, process]
---

## Summary

Spec-driven development here is not a quality practice, it is a **correctness** practice, for one stated reason: *"a wrong trading system does not crash — it produces plausible numbers."* Tests are written from the spec, before the code, by someone other than the implementer — and the implementer never reads the spec. That information barrier is what prevents tautological tests that pass because both sides made the same wrong assumption. The state machine that enforces it is `.trader/constitution.yml`.

## Key Points

- The loop: `open → specced → tests_written → red_verified → implementing → green → reviewing → closed`. Backward transitions exist and are **normal, not failures**.
- **The RED gate is the load-bearing step.** Every new test must be observed to fail before any implementation exists. *"A test that passes against no implementation is testing nothing. It is the most common defect in AI-written test suites, and it is invisible once the code lands."*
- *"Record the RED run's output in the issue file. 'I believe they fail' does not clear the gate; the command and its output do."*
- Tests split **visible (~60%)** — handed to the coder as the contract — and **hidden (~40%)** — withheld until review: boundary conditions, spec-called-out failure modes, invariants someone would be tempted to special-case around.
- A coder passing visible but failing hidden "has written code that fits the examples rather than the contract."
- **The review gate is not redundant with the test gates.** Hidden tests catch implementations fitted to examples; reviews catch rules nobody was ever asked about. They fail in different directions.
- **§4b — fixture quality is production quality.** A fixture that could not exist in reality teaches the system to accept data it should reject, and the symptom is never a crash — it is a backtest that looks slightly better than it should.
- **§4c — a rule stated only in prose is as unprotected as one never written down.** *"Every normative sentence gets a numbered EARS criterion, in the same edit."* The repo is four-for-four: every prose-only rule has eventually shipped broken.
- **§4d — grade agents on evidence, never assertion.** *"A result without the command and its output is not a completed handoff."*

## Deep Dive

**The constitution's forward gates** (`.trader/constitution.yml`):

| from → to | gate |
|---|---|
| `open → specced` | `spec_linked` |
| `specced → tests_written` | `tests_exist_min_hidden` |
| `tests_written → red_verified` | `all_tests_fail` |
| `red_verified → implementing` | `coder_assigned` |
| `implementing → green` | `visible_tests_pass` |
| `green → reviewing` | `reviewer_assigned` |
| `reviewing → closed` | `approved_and_hidden_pass` |

The two a newcomer trips over: you cannot leave `specced` without a hidden set, and every new test must fail before implementation. Backward transitions include `reviewing → specced` with `unfreezes_spec: true` — "the correct move when review reveals the spec itself was wrong, which is a good outcome, discovered cheaply."

**The roles and who reads what:**

| Role | Reads the spec? | Job |
|---|---|---|
| architect | yes | adversarially reviews the spec *before* tests exist; BLOCK/WARN/PASS. Critiques, never implements |
| test-manager | yes | writes tests from the spec; owns the RED gate and the visible/hidden split |
| **coder** | **no** | makes the visible tests pass. Receives tests and interfaces, never the spec |
| reviewer | yes | checks the implementation against spec *intent*, runs hidden tests, catches drift the tests missed |

**§4b in the concrete.** `tsconfig.json` excludes `tests/`, and vitest transpiles without typechecking — so on 2026-08-11 the test files had **zero type enforcement**. Adding `tsconfig.test.json` surfaced **37 latent errors**: 19 implicit `any` parameters and 18 imports missing the `.js` extension NodeNext requires. Fixing the imports alone dropped it to 6, because unresolved modules had been typed `any` and were masking real defects.

And the trap inside the fix: **`extends` inherits `exclude`, and an inherited `exclude` overrides `include`.** The first version reported zero errors while typechecking zero files. The rule that follows — *always confirm a new check actually sees its inputs before believing a clean result* — generalises far beyond TypeScript.

Two defects that week came from fixtures that could not exist: bars whose OHLC violated its own bracket, and a bar series whose dates wrapped back on themselves. In both, the implementation was bent to fit the broken fixture, producing a weaker rule than the spec intended, all green. Hence the operational heuristic: *"when an implementer reports 'I had to weaken X to make the fixtures pass', treat it as a fixture bug until proven otherwise. It has been one every time so far."*

**§4c in the concrete.** Three SPEC-002 defects shared exactly one cause and nothing else:

| Rule | Specified | Implemented | Tested | Found by |
|---|---|---|---|---|
| `dropped` retains ≤ 50 samples | rev 2 | never | never | review |
| reserved enum never emitted in v1 | rev 2 | violated | never | review |
| `fetchBatch` executes sequentially | rev 2 | violated (`Promise.all`) | never | review |

*"Each was normative text in the spec. Each was green for its entire life. None could have been caught by a hidden test, because no test existed to hide."* Session 9 added a restatement: a rule inside an inlined HTML string is a rule no test can reach — and four for four, those ship broken. That is why `src/ui/view.ts` exists as a separate module.

**Rule citations (§6).** Spec rules carry stable ids — `N1`, `V3`, `P2`, `E13`, `S7`, `M4` — cited in **test names** ("so a failing test names the rule it defends") and in **`JournalEntry.ruleRefs`** ("so a trading decision names the rules that produced it"). This is what makes the journal auditable rather than merely voluminous.

**Writing a spec (§7).** Copy the template into `.trader/specs/SPEC-NNN.md`, create or locate `.trader/issues/TR-NNN.md`, link both ways, add to `index.json`. The two sections people skip and shouldn't: **Non-goals** (each names the spec that will own it, or says "never") and **Pattern coverage** — *"a spec with no IF-THEN criteria has not thought about failure, and in this repo failure behaviour is the product."*

**Slice sizing (§8).** Right-sized when the acceptance criteria fit on one screen and the non-goals name real follow-on specs. *"When in doubt, cut along the seam where a fixture can replace a dependency."*

**Out of scope (§9).** Research documents are not specs and do not enter the state machine: *"research changes when the world changes, specs change when we decide something."*

## Practice Questions

- Why does the coder not read the spec? What specific failure does that barrier prevent?
- You are handed a green test suite for a new module. What single question tells you whether the tests are real?
- Explain why review and hidden tests are not redundant. Give an example of a defect only one of them can catch.
- A teammate says "I had to loosen the validation to make the fixtures pass." What is your first hypothesis and why?
- A new rule is agreed in a review discussion and written into the spec's prose section. What must happen in the same edit, and what is the evidence that skipping it is dangerous?

## Common Misconceptions

- "SDD is heavyweight process." → Here it is the only mechanism that catches a bug whose symptom is "the profits went up."
- "Tests after the code are fine if they're thorough." → Tests written after the code encode the code's assumptions, including its bugs.
- "RED is a formality." → It is the cheapest check that the tests exercise the real interface. If they fail only with "module not found," they are not tests yet.
- "Green means done." → Green means the visible tests pass. Hidden tests and review are separate gates that fail in different directions.
- "Fixtures are just test data." → Fixture quality is production quality. An impossible fixture teaches the system to accept impossible data.
- "Moving backwards in the state machine is a failure." → `reviewing → specced` is a good outcome discovered cheaply.

## References

- `docs/sdd-workflow.md` — the loop, §3 RED, §4 visible/hidden, §4b, §4c, §4d, §5–§9
- `.trader/constitution.yml` — the machine-readable state machine and its gates
- `.trader/specs/` — spec revision histories (often faster to read than the spec)
- `.trader/issues/` + `index.json` — the work ledger and known gaps
- `STATUS.md` — the four-for-four record on prose rules
