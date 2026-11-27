# Future Architectural Plans (Deferred)

This document tracks architectural bets and simplifications that remain **deliberately deferred** after the `v24` schema and MCP handoff redesign (which shipped unified `claims`/`claim_observations`, `goals` + bookmark/park separation from `topics`, dedicated `question_bank_items`, explicit `teach_first`, phase-specific continuation + MCP assessment/revision/park/abandon transitions, independent goal/content `stats`, and fresh `v24` profile resets). Live hosted ChatGPT client testing of the MCP connector remains an operational verification step during N=1 dogfooding.

Do not implement a deferred item until its **Unlock Condition** is met.

---

## Summary Gate Table

| Plan | Category | Why Deferred Today | Unlock Condition |
| --- | --- | --- | --- |
| **1. N=1 Habit Loop & Day-7 Return Observation** | Product / Validation | Needs real calendar time (≥7 days) and real study episodes, not code. | Start immediately on one adopted unit (`frontend` or `backend-systems`) and observe completion rate and day-7 uncued return on N=1. |
| **2. Work-to-Practice Loop & Sandboxed Labs** | Authenticity / Runtime | Requires safe repo/diff extraction, secret scrubbing, hidden verifiers, and unifying `src/interview/coding.ts`. | Complete one manual symptom-first work exercise during N=1 dogfooding and confirm a recurring work-decision family worth automating. |
| **3. Dedicated Agent-First Runtime & Async Review Plane** | Runtime / Delivery | Adding `@earendil-works/pi-durable` (pre-1.0) or Vercel Workflows (bundler/compiler) adds heavy dependency weight while ChatGPT + MCP is already working locally. | Only if headless CLI/MCP sessions suffer low day-7 return rates or unacceptable first-turn context overhead after N=1 dogfooding. |
| **4. Planner Probation & Simplification** | Selection / Pruning | 8-tier selector, FIRe-Lite implicit credit, and task-minute heuristics lack enough real episodes to evaluate fairly. | Accumulate 30–50 real logged episodes; compare current selection against `"current problem + 1 due item"`. |
| **5. Trace-Driven Instruction Pruning & Bounded Multi-Model Review** | Evaluation / Cost | Prose cuts by word count alone risk silent protocol regressions; multi-model council adds API cost before testing counterexample probes. | Collect matched fresh-teacher runs using `eval:teacher inspect --trace` and `compare-harness` (`traceEvidence`). |

---

## Plan 1 — N=1 Habit Loop & Day-7 Uncued Return (Start Now in Practice, No New Code)

* **Context:** Learning OS (`v24`) now supports clean parking/resumption (`park`/`unpark`/`resumeParked`), non-grading `teach_first`, claim-scoped weakness tracking, and crash-safe MCP assessment. What remains unmeasured is whether it produces faster, deeper, more durable engineering judgment than a raw frontier model + scratchpad.
* **How to run it:**
  1. Start immediately with one adopted unit in `backend-systems` or `frontend` using ChatGPT + MCP (do not wait for an arbitrary quota before testing).
  2. Treat reaching `independent` as an observation, not a quota; record real `activeTimeSeconds` where available.
  3. On day 7, test one unseen, symptom-first decision with chapter cues removed and compare against a matched topic studied with raw frontier chat + scratchpad.
* **Falsifier:** If day-7 return friction remains high even with parking/bookmarks, prioritize an async push/companion surface (Plan 3) before adding any new pedagogy or selection rules.

---

## Plan 2 — Work-to-Practice Loop ("Save This Decision for Practice") & Unified Executable Labs

* **Context:** Calibrated packs currently cover `predict` (`runtime_trace`), while `src/interview/coding.ts` remains a separate inline coding-drill runner. Real engineering begins from an uncued symptom, and a passing patch alone does not separate learner-chosen diagnostic hypotheses from agent-suggested ones.
* **Why deferred:** Safe extraction (scrubbing secrets/proprietary code, minimizing repros into disposable local repos, isolating hidden acceptance checks, and retiring `src/interview/coding.ts`) should be shaped by at least one real manually authored symptom-first exercise first.
* **Falsifier:** Drop any lab format where environment setup consumes >20% of the study block or learners can pass by replaying a prior patch rather than choosing an informative diagnostic test.

---

## Plan 3 — Dedicated Agent-First Runtime & Async FSRS Return Plane

* **Context:** Learning OS is a headless local-first SQLite kernel driven via `dist/kernel-cli.js` or the 5-tool MCP server. Nothing actively notifies the learner when an FSRS card or 7-day durability window opens.
* **Why deferred:** Keep the 7-dependency local CLI + MCP surface lean while dogfooding. Preserve ADR `0004` portability: `createTeacherKernel(db)` must always remain the sole owner of learner truth.
* **Target architecture if unlocked:**
  * **Interactive runtime (Pi Durable pattern):** Wrap `createTeacherKernel(db)` as an extension over SQLite-native atomic commits, using dynamic per-turn prompt `Sections`, `beforeTool` pre-display guards, explicit `replay: "safe" | "unsafe"` mutation tags, and conversation `fork()` for A/B evals.
  * **Async orchestration (Vercel Workflows pattern):** Scheduled FSRS review nudges (`sleep()` until `due_at` → push one atomic prompt via hook → suspend at zero compute) and resilient multi-model `eval:teacher` / `src/ingest/` pipelines.

---

## Plan 4 — Planner Probation & Simplification

* **Context:** `src/selection/selector.ts` and `src/plan/today.ts` carry 8 priority tiers, prerequisite DAG gates, bounded warm-ups, FIRe-Lite implicit credit, and task-minute estimates.
* **Why deferred:** Freeze new planner heuristics now; avoid deleting or adding policy without real session traces.
* **Next step when unlocked:** After 30–50 logged episodes, benchmark the full planner against `"continue current problem + 1 due item"` on completion rate and day-7 delayed performance, and prune heuristics that do not beat the baseline.

---

## Plan 5 — Trace-Driven Instruction Pruning, Real Multi-Turn Eval & Bounded Multi-Model Review

* **Context:** `eval:teacher inspect --trace` and `compare-harness` now capture factual file-read access (with explicit `unknown` when absent), `retryOf`-linked retries, and separate `toolElapsedMs` / `runElapsedMs`. Meanwhile, `multiturn_switch_to_explanation_only` currently tests a single turn with authored prior context rather than a real two-turn interrupted session.
* **Next step when unlocked:**
  1. Run matched fresh-teacher traces to verify which `SKILL.md` payload templates can move into bundled references without hurting accuracy or integrity.
  2. Add true multi-turn scripted session playback (turn 1 → interruption → resumed turn 2) to `eval:teacher`.
  3. Trial a bounded 2-model read-only review council (advisory-only, human adjudication) only if single-reviewer checks paired with executable counterexamples continue missing subtle technical defects.
