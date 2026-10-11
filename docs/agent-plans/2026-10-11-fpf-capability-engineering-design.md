# Design: focused FPF-inspired teaching improvements

**Status:** Approved direction for implementation planning; not an implementation or a demonstrated learning-outcome improvement.

**Date:** 2026-10-11. **Checkout for this work:** `/home/hamza/repo/learning-os`, connected through the **non-ARM WebHarness** selected by the owner.

**Companion:** [focused implementation and agent plan](2026-10-11-fpf-capability-engineering-implementation-plan.md).

## 1. Decision: keep what helps; remove speculative machinery

The earlier FPF-inspired commits (`15018cb`–`3a65c44`) improved teacher instructions and two kernel strings. They did **not** prove better teaching, nor did they add much executable pedagogy. Commit `cca236d` proposed nine additional tasks, including a candidate-review abstraction, a support-adviser API, four scaffolds, and a new reporting CLI. After reviewing the critique, these are **superseded by three concrete deliverables**:

- **A — Close the first-wave debt and inspect teaching behavior.** Reconcile the previous plan's unchecked items, independently run the repository checks in this WSL checkout, and perform synthetic fresh-teacher replays. Fix a specific confirmed failure, not any conceivable one.
- **B — Improve real exercise quality.** Audit all 18 cases in the six calibrated prediction packs and the four existing scaffold packs; document which condition changes and which mistaken model a case separates. Repair demonstrated defects. Add small metadata/validation in the existing calibration loader only when it pays for itself; **no generic candidate-review layer**.
- **C — Deliver one useful nonprediction scaffold.** Start with a debugging example about concurrent database correctness. If that example requires the existing scaffold loader to accept a standalone `debug/debugging` pack, make that **narrow** extension and prove persisted exposure and replay work. Do not implement four extra packs or a four-stage lesson framework just to look comprehensive.

The aim is **fewer wasted teacher turns and higher-quality practice opportunities**, not a new FPF runtime. Optimize for working changes with bounded checks, not diagrams, new orchestration code, or unfunded theories of learning.

## 2. Current repo, real seams

Baseline inspected on 2026-10-11 at `cca236d`, clean before these plan edits. `src/knowledge/challenge-calibration.ts` discovers six `predict/runtime_trace` packs, each with `same`, `variant`, `transfer`; their `calibration.json` includes declared wrong-model predictions and expected executable outputs. Existing tests execute their trusted `.mjs` sources and check divergence. Four packs have `scaffold/scaffold.json`. `src/knowledge/scaffolds.ts` only discovers these attached prediction packs and restricts `ScaffoldStage` to `worked_example|completion`. `src/kernel/scaffolds.ts` already records answer-bearing material before display and replays immutable saved content; its replay matcher currently recognizes only attached scaffold paths. `src/teacher-pedagogy.ts` gives small guided/independent, commit-before-reveal, and question-chunking directions; that is **not** a justification for a second advisory engine.

Existing teacher scenarios check lifecycle safety but cannot prove that a human would understand a better explanation. The initial upgrade's trigonometry and meditation conversations have not been independently replayed in the checked-in completion record. The ARM checkout recently passed 31 files / 239 tests; **that is not a substitute for verifying this WSL checkout after implementation**.

## 3. Evidence and sources

FPF is a source of *methods*, not ready-to-run software. Relevant published patterns from [ailev/FPF](https://github.com/ailev/FPF), snapshot `e2c6ac1e97dae9b9f54f707477f7d86a12d91852` (2026-10-10), include:

| Pattern | Useful contribution | Implementation boundary |
| --- | --- | --- |
| EXD.1 / EXD.4 | Recognize a changed question and repair only the troublesome relation | Teacher dialogue; existing skill already covers much of it |
| EXD.2 / EXD.6 | Use discriminating examples and stop after a sufficient explanation | Manual replay criteria and focused material review |
| HCD.3 | Distinguish demonstrated misconception from missing context, preference or wording | No inference of learner mastery from chat assertions |
| HCD.6 / HCD.6.1 | Make practice variants change the condition deciding the answer | Case audit, precise expected-output checks |
| HCD.9–HCD.12 | Keep assisted practice separate from independent attempts and actual transfer | Existing kernel/exposure/selector/FSRS remains authoritative |
| HCD.18 / HCD.19 | Review teaching material for a specified task and reader response | Self/peer model review can detect flaws, not measure durable learning |

Source publications: [Explanation Design](https://github.com/ailev/FPF/blob/e2c6ac1e97dae9b9f54f707477f7d86a12d91852/Engineering%20DPF%20Suite/EXPLANATION-DESIGN-PRINCIPLES-FRAMEWORK.md) and [Human Capability Development](https://github.com/ailev/FPF/blob/e2c6ac1e97dae9b9f54f707477f7d86a12d91852/Engineering%20DPF%20Suite/HUMAN-CAPABILITY-DEVELOPMENT-PRINCIPLES-FRAMEWORK.md). Use pattern IDs and the original context; write original implementation text, and comply with CC BY 4.0 if copying protected expression.

The existing [pedagogy priorities](../research/pedagogy-priorities.md) and [scaffold pilot](../scaffold-fading-pilot.md) explain research uncertainty: worked examples and variation can help, but guided accuracy, code-test success and approving agent judgments do **not** establish long-term independent learning. Do not delay bounded engineering changes for a study the sole learner has no time to run. Use *synthetic learner messages*, *independent model review*, *executable fixtures*, *existing lifecycle tests* and *replay checks* as honest engineering evidence instead.

## 4. Authority and safety

```text
Learning OS selector chooses intent -> teacher authors frozen challenge + rubric
-> kernel opens attempt -> learner answer -> verification/assessment
-> append-only evidence/projections -> FSRS scheduling

Optional scaffold -> kernel records teaching artifact and exposure
-> teacher shows it -> later continuation replays identical saved bytes
```

Do **not** alter `src/selection/`, `src/scheduler/`, `src/kernel/foundation.ts`, `src/kernel/evidence.ts`, `src/plan/today.ts`, `src/db/*`, or managed `data/profiles/**`. No new mastery store, durable learner hypothesis, objective selector, FPF MCP dependency, autonomous feedback selector, or passive recording of ad-hoc exploration. The teacher may choose examples but never alter evidence rules; revealing a solution during an assessable attempt requires a recorded exposure **first**. Causal repair preserves `requireReconstruction`; interview/mock gets instruction only in feedback. Reuse current `ScaffoldStage` values and current frozen challenge/teacher contracts.

Read accepted `docs/decisions/0005-authority-transitions.md`, `docs/kernel-contracts.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/teacher-agent-protocol.md` before any code changes. User's explicit non-ARM checkout choice takes precedence over the stale ARM-only text of the superseded plan; `AGENTS.md` already allows a user-named checkout. Never edit the ARM copy or merge binary learner database state between WSLs.

## 5. Validation without a learner study

1. **Mechanical regressions:** run `npm run typecheck`, `npm test`, and `npm run build` in the selected WSL checkout; add focused existing-suite tests only for behavior actually changed. The prior 239 passing tests are a baseline, not evidence of new teaching quality.
2. **Replay/dialogue:** use fresh isolated agent contexts for *two* cases—trigonometry asks *why name cosine and sine at all* after coordinate understanding; meditation says *already know basics, want a recap then practice*. Check answer relevance, meaningful novelty, overload, stops, and ad-hoc no-state rule. Use existing teacher-evaluation scenarios for answer leakage, reconstruction and assistance. These are synthetic proxies, not participant outcomes.
3. **Content truth:** run the curated Node snippets through the existing execution checker; review wrong-model divergence, rubric correctness, transfer meaning, and safe absence of teacher-only solutions from learner material.
4. **Security/immutability:** compare saved exposure replay before and after source modification/deletion with isolated synthetic DB. No grader can infer learning from merely playing a lesson.
5. **Cost:** no new platform, score aggregation, dashboards, A/B infrastructure or blanket extra learner questions.

If models disagree about explanation quality, preserve a specific finding and revise only the affected text or fixture. Do not claim delayed mastery. A human/owner judgment remains informative but is **not a launch blocker** here.

## 6. Out of scope and decision gates

**Cut now:** former Tasks 2, 4 and 7 (generic candidate reviewer, support adviser, reporting CLI). **Reduced:** former Tasks 3, 5 and 6 (metadata only where informative; one debug scaffold; minimal loader change). **Retained:** prior pack audit, complete software checks, synthetic replays and peer review. Future expansions must be justified by a concrete repeated deficiency from the finished deliverables; don't auto-expand from one working example.

**Done means:** the old first-wave verification debt is explicitly reconciled; all current cases have an honest audit; a genuine flawed case is repaired if found; one new scaffold illustrates and supports debugging without breaching immutable exposure/replay; a separate GPT-6/Claude reviewer has inspected the *finished combined candidate* for blocking defects; required checks are recorded; no private learner state changed. None of this proves higher learning gains.

**Execution handoff:** [companion implementation/orchestration plan](2026-10-11-fpf-capability-engineering-implementation-plan.md). The previous 514-line second-wave design is superseded by this scoped decision, not erased from Git history.
