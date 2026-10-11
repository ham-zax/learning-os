# Focused FPF Teaching Improvement Implementation Plan

**Goal:** Close the first-wave teaching defects and verification debt, audit the current calibrated practice, and ship one high-quality debugging scaffold with safe persisted replay.

**Architecture:** Preserve Learning OS's existing selector, frozen challenges, evidence and FSRS. Extend only the current calibrated content and optional scaffold-delivery seam when necessary; let the conversational teacher choose explanations. Synthetic agent replays and existing executable fixtures supply engineering review without a live learner study.

**Tech Stack:** TypeScript, Zod, Node.js, Vitest, existing SQLite teacher/kernel, Markdown/JSON. No FPF runtime, new dependency, schema migration, or additional model-serving layer.

**Read first:** [revised design](2026-10-11-fpf-capability-engineering-design.md), `AGENTS.md`, `CLAUDE.md`, `docs/kernel-contracts.md`, `docs/decisions/0005-authority-transitions.md`, `docs/teacher-agent-protocol.md`, `skills/learning-os-teacher/SKILL.md`, the [prior first-wave implementation plan](2026-10-11-implementation-plan.md).

**Authoritative checkout for this mission:** `/home/hamza/repo/learning-os` through the user's **non-ARM WebHarness** connection, baseline `cca236d` before these plan revisions. This supersedes ARM-only instructions in the old second-wave draft. Do not touch another WSL checkout. Current WSL installed CLIs include `claude` and `codex`; agent sessions must verify model/tool access rather than claim they launched automatically.

## Global constraints

- Only one writable agent/session at a time in this checkout; use current Git worktree unless a concrete collision arises. No blanket worktree creation. Check `git status` and actual HEAD before mutations, and don't overwrite unrelated changes.
- Never modify real managed `data/profiles/**`, select a different objective, schedule FSRS, or persist learner hypotheses. Keep `src/selection/`, `src/scheduler/`, `src/db/`, `src/kernel/foundation.ts`, `src/kernel/evidence.ts`, `src/plan/today.ts` untouched. If genuinely blocked by a protected contract, report the minimal needed change before proceeding.
- In assessed work, hints/answer-bearing examples must be recorded **before** display, and `requireReconstruction` remains enforced for causal repair. Completion of a guided example is not independent retrieval or mastery. Frozen challenge/rubric/replay provenance stays immutable. In ad-hoc teaching, no learner state is created without permission.
- No generic `practice-quality.ts`, `teacher-support.ts`, new eval CLI, candidate-review framework, four-stage curriculum, additional FPF prompt loader, study dashboard, or A/B test. Change the smallest existing code path that blocks a real use.
- Tests here are explicitly authorized: the owner wants AI agents to perform software/replay verification rather than recruit learners. Follow repository and Causal Coding testing boundaries; do not conflate passing tests with learning outcomes.
- Keep selected `ChallengeIntent`/authoring contract stable. All examples, curriculum checks, rubrics and solution materials remain within their approved access/visibility boundary.

## File ownership and task boundaries

| File or area | Mission | Intended edit |
| --- | --- | --- |
| `docs/research/pack-variant-audit.md` | A1 | Create 18-case and four-scaffold evidence table with actual code and wrong-model checks. |
| `docs/research/fpf-teacher-replay-audit.md` | A1 | Create concise synthetic scenario/reply review; state what was simulated, verified and unknown. |
| `docs/agent-plans/2026-10-11-implementation-plan.md` | A1 | Reconcile verifiable checkboxes and add completion notes; don't claim owner-judged replays. |
| `src/kernel/questions.ts`, `src/kernel/feedback.ts`, skill/protocol files | A1, **only if needed** | Correct a demonstrated reconstruction or changed-question failure; don't perform cosmetic rewording by default. |
| `knowledge/{frontend-revision,backend-systems}/challenges/*/{calibration.json,*.mjs}` | A1, **only for real defects** | Repair unsafe/non-discriminating oracles/variations without renaming case IDs. |
| `src/knowledge/challenge-calibration.ts` and corresponding existing tests | A1, **conditional** | Add the smallest stable checker only for a repeated mechanically decidable defect; otherwise leave code unchanged. |
| `knowledge/backend-systems/scaffolds/database-transactions-debug/` | A2 | One standalone `debug/debugging` teaching pack, using existing `worked_example` and `completion` stages. |
| `src/knowledge/scaffolds.ts` | A2 | Discover/load the one standalone shape while preserving all four existing attached prediction packs. |
| `src/kernel/scaffolds.ts` | A2, **if needed** | Accept the standalone replay source path; keep immutable teaching-artifact content and existing two-stage semantics. |
| `tests/scaffold-material.test.ts`, `tests/scaffold-content.test.ts` | A2 | Cover discovery, wrong objective/task form rejection, exposure-before-display, restart replay, and code oracle. |
| `docs/coding-courses.md`, `docs/teacher-agent-protocol.md`, portable teacher skill | A2, **minimal** | Document standalone scaffold use and its boundaries only if current guidance needs updating. |

## Mission A1 — First-wave closure and calibrated practice audit

**Execution owner:** Agent A / Mission A1 (Claude Code, NEW chat). **Workspace:** current non-ARM WSL checkout. **Can start:** after this plan is present, tree status inspected and prior sessions reconciled. **Review:** defer independent review until the combined A1+A2 candidate is stable unless a direction-changing defect is found.

**Inputs:** `src/knowledge/challenge-calibration.ts`, `src/knowledge/scaffolds.ts`, six `knowledge/*/challenges/*/calibration.json` packs, four `scaffold/scaffold.json` packs, corresponding source/test files, the prior first-wave plan and current teacher skill.

**Steps:**

1. Run in *this WSL checkout* `npm run typecheck` and `npm test`; note counts and any failures. The ARM test result (31 files, 239 tests) is contextual, not this checkout's proof. Do not touch `data/` or tracked binary profiles.
2. Review each of the 18 published cases and each of the four scaffold packs. In `docs/research/pack-variant-audit.md`, record: pack/case/source; same/variant/transfer relation; exact answer-deciding condition compared with the anchor; correct observed Node output; explicit wrong-model predictions and which output/criterion they differ on; verdict `keep`, `repair`, or `unresolved`; any loader/privacy caveat. Run **trusted existing curated** `.mjs` sources through Node as the current test helper does; no arbitrary LLM-created code execution.
3. Fix actual broken cases or oracles in the existing files, preserving IDs and schema where possible. If the defects are solely explanatory, make no schema/code changes. Only add a narrowly scoped validation check to `src/knowledge/challenge-calibration.ts` if multiple comparable cases demonstrate a mechanically recognizable defect; otherwise prefer the audit and calibrated tests already present.
4. Conduct synthetic fresh-teacher replays for (a) trig coordinates already understood but user asks why sine/cosine need special names, (b) meditation basics already known and user asks for a quick recap then practice. Add a few adversarial existing scenarios, including causal repair, ambiguity, answer request and scaffold-after-exposure. Capture the actual teacher reply or a transparent bounded simulation in `docs/research/fpf-teacher-replay-audit.md`; assess question relevance, new information per turn, over-explaining, exposure safety and no durable ad-hoc state. Never label imagined model output as an observed run. If possible, compare edited/current skill with pre-change skill under the same context; document model and limitations.
5. The `Try it from memory` line may be misleading immediately after repair. Change it **only** if replay shows an actual teaching defect, preserving exact question identity and the exposure/reconstruction contract. Similarly fix unambiguous repeated-question or forced-practice errors only if reproduced.
6. Reconcile each prior first-wave completion checkbox against actual Git/tests/replays; check only evidenced completions. In particular, agent-simulated replies do not satisfy the owner's explicit personal judgment. Record the discrepancy instead of inventing consent.
7. Run `npm run typecheck`, `npm test`, and `npm run check:package` if relevant after edits; provide exact results. Review final changed files; no learner DB, secret or provider transcript content staged.

**A1 exit:** 18 cases and four scaffolds transparently audited; all reported broken items either repaired or precisely blocked; synthetic replies reviewed; first-wave checklist accurately reconciled; no unexpected learner-state changes. Commit coherent A1 work locally with an inspectable hash; do **not** push or start A2 without announcing/reporting the A1 completion boundary.

## Mission A2 — One real debugging scaffold (same Agent A chat)

**Execution owner:** Agent A / Mission A2 in the **same Claude chat**, launched only *after* A1 has a recorded completed boundary. **Dependency:** A1 case audit identifies a stable transactions topic/source; A1's blocking contradictions resolved. This is the same domain, so another implementation agent would waste context.

**Steps:**

1. Build exactly one curated teaching pack at `knowledge/backend-systems/scaffolds/database-transactions-debug/`, with a `scaffold.json` binding `conceptId: database-transactions-and-concurrent-correctness`, `capabilityId: debug`, `taskForm: debugging`, and existing `worked_example`/`completion` stage files. Use a decision-bearing lost-update/concurrent-reservation defect: the observed symptom, plausible wrong hypothesis, the invariant, a meaningful changed condition, and a partial learner investigation. Choose a different surface from any already-frozen calibrated assessment. Teacher-only solutions must not appear in learner Markdown.
2. If a runnable Node demonstration clarifies the bug, keep separate trusted source and teacher oracle files inside that content pack; execute via the established, bounded Node test helper and align the documented expected result with actual execution. Do not pretend a design explanation has an executable single truth when it doesn't.
3. Modify `src/knowledge/scaffolds.ts` to discover a **standalone** `knowledge/<course>/scaffolds/<pack-id>/scaffold.json` alongside the legacy attached layout, while retaining the published legacy `packId`s, stage names, size/path validation, and single-concept/capability/task-form matching. Reject duplicate pack IDs and malformed material; no generalized registry or third/fourth stage added.
4. Adjust `src/kernel/scaffolds.ts` only as required so `prepareScaffoldPresentation` can match the standalone pack's objective and the saved `source_ref` of a standalone stage is recognized by `getSessionScaffoldPresentations`. Keep exposure-before-return and transactional rollback, existing interview/mock feedback-only rule, frozen criteria and persisted byte-for-byte replay. Two known stage kinds remain unambiguous; do not solve a hypothetical extra-stage replay problem.
5. Extend the two existing scaffold test files to prove: four legacy packs remain accessible; debug material is listed; attempts for another concept/capability/form are refused before exposure; selected material is recorded before returned; interrupted sessions replay exact persisted Markdown even if source files change or disappear; curated executable sources produce actual expected output. Use only isolated temporary DBs and known curated source code.
6. Document the new pack format only where a reader will use it, then run `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package`. No new objective, scheduler or raw learner transcripts. Commit A2 locally and report combined A1+A2 review range.

**A2 exit:** A real nonprediction debugging scaffold can be selected for the correct frozen objective and safely shown/replayed; legacy scaffolds still work; no unrelated infrastructure. If content already works without generic loader changes, do less. If implementing it requires a protected-kernel redesign, stop with a concrete blocker rather than expanding scope.

## Mission R1 — One independent review after stable A1+A2

**Owner:** Agent R (fresh GPT-6/ChatGPT WebHarness chat), read-only. **Start:** only after A2 reports completion and both commits form a stable review candidate. Do not ask the same Claude implementation session to certify itself. Reviewer inspects actual Git diff from the recorded baseline rather than trusting handoff summaries; include current relevant source and contracts.

Review *all* material blockers in a single pass: wrong-model truth oracles, fake surface variation, semantic correctness of the new debugging example, objective matching, bad source paths, answer leakage, exposure-before-reveal, persisted teaching-artifact replay, inadvertent profile mutation, tests, and scope creep. Separate actual bugs from speculative improvements. **R1 does not edit files.** Block integration if an evidenced contract defect exists. Send bounded fixes as A3 to the existing Agent A chat when they benefit from context; send R2 to the **same** Agent R chat for narrow re-review. Only integrate/push on a passing review and user authorization, not on the implementer's assertion alone.

## Agent Work Planner orchestration contract

- **Mode:** lightweight orchestration; one sequential writer, two same-agent implementation missions and one independent review. No background sessions launched by writing this plan; the human explicitly launches Claude and GPT-6 chats.
- **Dependency graph:** `A1 -> A2 -> R1 -> (A3 -> R2 only if blocking) -> integration`. A1 may finish with no code changes if 18 cases are already sound. A2 remains the principal executable improvement. No automatic expansion to the superseded nine-task scope.
- **Known checkout:** `/home/hamza/repo/learning-os`, non-ARM WebHarness. **Shared receipt root:** `/home/hamza/.cache/agent-work-planner/learning-os-0690cec0fb1a/handoffs/`. Per-mission inbox: append `A1/`, `A2/`, or `R1/`. Each agent creates its own directory if needed and writes one timestamped finish/blocked receipt with frontmatter containing mission, repository, branch/HEAD, validation, blockers and downstream facts. No secrets or personal learner data. The planner verifies Git claims before advancing.
- **Completion (2026-10-12):** A1 `35f62cc`, A2 `bdedd96`, and A3 repair `365e2fb` are committed; R1 found one replay-provenance defect, and independent R2 passed that repair. `origin/main` was verified at `365e2fb`. The original launch instructions below remain historical, not an active frontier. Owner-judged trigonometry/meditation conversation replays remain outside this engineering gate.
- **Review gate:** one independent R1 over the combined completed batch, with all material findings in one review. Planner can absorb trivial deterministic metadata repairs only if explicitly authorized; otherwise use A3. No parallel writers in this checkout.
- **Strategic check:** after A1, ask whether the audit uncovered a higher-impact defect that supersedes the planned debugging content. Replan narrowly if so, otherwise proceed with A2. After R1, only change scope to discharge concrete blockers. Report a Progress Snapshot at each handoff.

## Launch contract for Agent A1

**Open a NEW Claude Code chat** rooted at `/home/hamza/repo/learning-os`. Paste a prompt that declares Agent A / Mission A1, requests reading this exact plan and design plus `AGENTS.md`/`CLAUDE.md`, grants A1's bounded code/content edits and the specified verification commands, forbids touching learner state, and assigns `/home/hamza/.cache/agent-work-planner/learning-os-0690cec0fb1a/handoffs/A1/`. Require an inspectable commit and a receipt before final reply. **Do not instruct A1 to start A2 or self-approve R1.** The orchestrator issues the A2 delta prompt after examining A1's receipt and checkout.

**At A1 boundary:** Issue the same-chat A2 continuation with the exact pack path, objective, checks and handoff root from above. **At A2 boundary:** Open NEW independent GPT-6 Agent R chat with a read-only R1 assignment, actual commit range, tests and review receipt. R2, if required, goes into the same R chat after the repair batch.

## Completion checklist (verified by the 2026-10-12 review and integration)

- [x] A1's 18-case/four-pack audit has explicit wrong-model contrasts, runnable oracles and honest verdicts.
- [x] A1's first-wave software verification and synthetic replays are recorded without claiming owner/learner results.
- [x] Prior-plan checkboxes are reconciled only to observed facts, not assumed completion.
- [x] A2's one real debugging scaffold and necessary loader/replay path changes are implemented without wider redesign.
- [x] Legacy scaffolds and new content pass authorized isolated verification and package checks.
- [x] R1's exact blocking replay-provenance finding was repaired in A3 and independently passed by R2 (10/10 legacy artifacts; 260 tests).
- [x] No `data/profiles/**` or protected learner-truth code was changed; `origin/main` integrated at `365e2fb`.

**Separate unresolved outcome:** Owner-judged trigonometry/meditation teaching replays, fresh-agent behavior outside the executable kernel tests and delayed independent learner outcomes have not been established by this engineering checklist.
