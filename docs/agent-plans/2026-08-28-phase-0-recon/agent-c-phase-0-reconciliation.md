# Agent C — Phase 0 reconciliation and writable frontier

**Repository:** `/home/hamza/repo/learning-os`
**Artifact type:** read-only
**Workspace:** current checkout; repository work is READ-ONLY
**Isolation reason:** none; this mission does not mutate repository state
**Can start:** immediately
**Depends on:** completed Agent A and Agent B reconnaissance
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/agent-plans/2026-08-28-phase-0-recon/README.md` — coordination map and readiness
- `docs/implementation-plan.md` — authoritative staged implementation plan
- `docs/kernel-contracts.md` — authoritative V1 kernel contracts
- `docs/architecture.md` — subsystem ownership and teacher-agent boundary
- `docs/decisions/0001-fork-generic-tutor.md` — fork decision
- `docs/decisions/0002-evidence-is-authoritative.md` — evidence ownership
- `docs/decisions/0003-scheduler-input-policy.md` — FSRS boundary
- `docs/decisions/0004-teacher-agent-portability.md` — ChatGPT-first but provider-neutral teacher contract
- `docs/research/source-comparison.md` — upstream reuse/provenance context

## Objective

Turn the completed Agent A/B reconnaissance into the exact, minimal, writable Phase 0 frontier for Agent D.

Do not perform another broad repository survey. Verify only the upstream facts needed to resolve conflicts or choose a safe mutation boundary. The output must be specific enough that Agent D does not have to invent repository topology, migration ownership, dependency scope, or legacy-state retirement strategy while editing.

## Established reconnaissance facts

Treat the following as returned evidence unless direct inspection disproves them:

- Upstream repository: `alienz-dev/generic-tutor`
- Upstream default branch: `master`
- Pinned inspected revision: `2fffb72201aba055a4c270e2fddb29352edf2efb`
- Learning OS coordination base: `8b7fb4bc28ed4e670055fd8246a7c5aa31f590f5`
- Learning OS currently has uncommitted design/coordination documentation that must not be discarded, reset, stashed, or silently folded into unrelated work.
- Upstream and Learning OS currently collide only at `README.md`; upstream has no `docs/**` collision with the Learning OS design tree.
- `package.json` declares MIT and README says MIT, but upstream contains no root license text/copyright notice and GitHub detects no license. Treat this as unresolved redistribution provenance, not as permission to invent missing notice text.
- `package.json` points at stale/unavailable `ding/generic-tutor`; current live repository provenance is `alienz-dev/generic-tutor`, but the transfer/rename history is unproven.
- Upstream requires Node >=22, uses npm, and tracks `package-lock.json`.
- `nexus: file:../nexus` is the hard clean-install blocker. The direct runtime dependency seam is `src/llm/client.ts`; other source consumes the local `LLMClient` abstraction. Removing Nexus requires updating both `package.json` and `package-lock.json`.
- The intended Learning OS teacher is external and replaceable (ChatGPT preferred V1; Codex/OpenCode/AGY compatible later). Do not introduce a new paid/API LLM dependency merely to imitate the missing Nexus sibling. Preserve only the application seam that is actually needed for Phase 0 and identify what can remain optional/deferred.
- `../job-hunter` and `../ai-feeds` are optional sibling integrations in CLI paths, not dependency-install blockers.
- A clean clone lacks `data/`, while `src/cli.ts` opens `./data/tutor.db` and `createDatabase()` does not create the parent directory. This is a separate clean-clone runtime defect.
- Current authoritative learning mutation is `src/cli.ts::askGrade()` -> `src/session/engine.ts::gradeResponse()` -> `sm2()` -> concept status/scheduler fields + legacy `reviews`.
- `src/state.ts::updateConceptAfterReview()` is a second SM-2/concept mutation path with no live source caller found; `src/state.ts::getTopicSummary()` can also mutate topic phase from legacy mastery.
- Legacy SM-2/status readers extend beyond the obvious files into planning, CLI stats/due paths, sync/export surfaces, and `src/plan/pacer.ts` direct SQL.
- Runtime session vocabulary is `explore|quiz|teach-back`, while `src/db/types.ts` declares `learn|review|quiz|interview|practice`; physical DB writes accept arbitrary strings and current CRUD raw-casts rows rather than enforcing the Zod enum.
- `problems.type` (`coding|conceptual|mcq|short-answer|system-design`) is task/problem vocabulary and must remain separate from delivery context.
- Interviews bypass ordinary session persistence; attempts are created after grading; system-design phase progress is in memory.
- `sessions.concepts_reviewed` is written from selected IDs before real interaction and cannot serve as exposure evidence.
- Existing `problems.test_cases` cannot be assumed deterministically executable.
- Physical owners still unresolved for later phases include goal identity (`topics.goal/deadline` vs a distinct goal owner), frozen challenge versions (extend `problems` vs dedicated version owner), and legacy review/SM-2 retention duration.

## Ownership

You own:

- reconciliation of Agent A/B findings into an exact Phase 0 mutation sequence;
- deciding which Phase 0 changes belong in Agent D versus later missions;
- defining the safe Git/history topology for preserving both upstream ancestry and the current Learning OS design history;
- defining the exact Nexus-removal contract without introducing an unnecessary provider/API dependency;
- defining the true source/storage boundary of session-mode normalization;
- identifying plan corrections required by the reconnaissance before writable work begins;
- separating autonomous implementation details from protected choices that still require the user/planner.

You do not own:

- performing the merge/import/fork;
- committing the current docs;
- modifying package files or source;
- implementing evidence, objectives, FSRS, challenge versioning, goal ownership, interview convergence, or teacher runtime;
- resolving the missing upstream license by assumption;
- building a provider/plugin/multi-agent framework.

## Coordination contract

Agent D will be materialized from your finish report. Give D a minimal coherent writable mission, not a broad list of every Phase 0 or future concern.

Your recommendations must preserve these accepted contracts:

1. `/home/hamza/repo/learning-os` becomes the actual product working tree.
2. Preserve `generic-tutor` Git history/provenance rather than copying source into unrelated history.
3. Pin the initial upstream base explicitly; do not silently float to a newer upstream commit.
4. New Learning OS learner truth must not continue writing authoritative mastery into legacy `concepts.status` / SM-2 fields.
5. `ReviewRatingMapper`/FSRS and evidence architecture remain later-phase concerns; do not pull them into Phase 0 unless a narrow seam is required.
6. ChatGPT is the preferred V1 teacher but not a kernel dependency. Avoid new API-spend/provider coupling solely to replace Nexus.
7. Session delivery context, target capability, and task form/problem type remain distinct concepts.
8. Existing uncommitted Learning OS design work must be preserved exactly until an explicitly authorized checkpoint/integration action.

## Decisions to reconcile

Produce a clear recommendation for each item and classify it as either **autonomous for Agent D** or **protected/user decision required before D**:

### Repository topology

- Whether to checkpoint current uncommitted Learning OS design docs before unrelated-history integration.
- Recommended unrelated-history integration shape and parent ordering.
- Whether the product needs GitHub fork-network identity now, or whether preserving Git ancestry/remotes is sufficient for Phase 0.
- Exact intended `origin` / `upstream` remote roles once a product remote exists.
- README conflict policy: what semantic content must survive the one known path collision.

### Provenance / license

- What provenance metadata can be recorded now from evidence.
- Whether missing MIT license text blocks local Phase 0 development, remote push, or only redistribution/public release.
- What Agent D must not fabricate regarding authorship, transfer history, or license notices.

### Standalone runtime

- Exact Nexus-removal mutation set, including lockfile ownership.
- Minimum `LLMClient` behavior/seam that must survive Phase 0.
- Whether the default standalone state should be an optional/unconfigured LLM seam rather than introducing a new provider/API dependency.
- Whether `src/plan/nexus-planner.ts` stays despite its name if it only consumes local `LLMClient`.
- Whether the missing `data/` parent creation belongs in Agent D's first writable mission or a separate immediately-following mission.
- Whether `job-hunter` / `ai-feeds` should be untouched, marked optional, or parameterized during Phase 0.

### Session-mode normalization

- Exact write/read boundaries that must be normalized; do not treat `src/db/types.ts` as the sole owner.
- Canonical mapping from legacy runtime values (`explore`, `quiz`, `teach-back`) into V1 delivery context semantics without collapsing task form or capability.
- Whether existing databases require an inventory/migration step before value rewrites.
- Which current callers/readers must move together so Phase 0 does not leave two active vocabularies.

### Legacy mastery boundary

- Identify the smallest safe cut for the first writable mission versus later migration.
- Account for `session/engine.gradeResponse`, `state.updateConceptAfterReview`, hidden topic-phase mutation, planner/pacer/CLI/sync readers.
- Do not instruct D to delete `src/sm2.ts` until all required reads/writes have actually migrated.

### Later physical ownership

For goal identity, challenge-version storage, and legacy-data retention, decide whether Phase 0 must settle the physical owner now or whether the contract can safely defer the choice to the phase that first implements it. Prefer deferral when Phase 0 does not need the decision.

## Success conditions

- One exact pinned upstream base and repository-history strategy are recommended.
- Every protected decision blocking the first write is explicitly surfaced; no hidden user choice is delegated to D.
- Agent D's first writable mission is bounded to the smallest coherent mutation wave and lists the precise state/files/contracts it owns at behavior level.
- `package-lock.json`, clean-clone `data/` behavior, optional sibling integrations, and the no-extra-API/provider constraint are explicitly classified rather than forgotten.
- Session-mode normalization is described at the real write/read boundary, not as an enum-only change.
- Legacy SM-2/status mutation/readers are separated into immediate cut versus later migration; no premature deletion is recommended.
- Later goal/challenge/evidence decisions are not pulled forward unless Phase 0 genuinely requires them.
- Any recommended plan/doc correction is stated precisely for the planner to apply before D is launched.

## Required validation

None. Do not create, modify, or run tests. Use read-only repository/Git/source inspection only when needed to verify a disputed or unresolved reconnaissance fact.

## Out of scope

- Any repository mutation.
- Any Git commit, branch, worktree, merge, reset, stash, or remote change.
- Dependency installation.
- Build/typecheck/test execution.
- Evidence/FSRS implementation.
- Teacher-agent implementation.
- License/legal conclusions beyond the observable repository evidence.

## Working style

Use the returned reconnaissance as the starting point. Verify narrowly; do not redo Agent A/B's full survey. Prefer the smallest Phase 0 mutation that establishes a clean standalone upstream-derived product baseline and a single session-mode contract without dragging later architecture forward.

Do not create, modify, or run tests. Do not modify `/home/hamza/repo/learning-os`.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. reconciled facts and any A/B conflicts;
3. protected decisions requiring user/planner approval before Agent D;
4. exact recommended repository/history topology and pinned upstream base;
5. exact Agent D writable mission boundary, including what it must change and what it must explicitly leave alone;
6. exact standalone/Nexus contract, including package-lock and no-extra-API/provider implications;
7. exact session-mode normalization boundary and canonical mapping/migration recommendation;
8. immediate versus deferred legacy SM-2/status migration scope;
9. plan/doc corrections the planner should make before launching D;
10. unresolved risks or facts that should remain explicitly deferred;
11. validation performed, if any; otherwise state none.
