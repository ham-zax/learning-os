# Agent B — Orchestration Flexibility

**Repository:** `/home/hamza/repo/learning-os`
**Artifact type:** executable behavior + documentation where required by the changed public contract
**Workspace:** current checkout on `main`
**Isolation reason:** none; Agent A is complete and this is the only writable mission
**Can start:** immediately from Agent A commit `9ef1040`
**Depends on:** Agent A — Learner-Facing Contract Repair (`9ef1040`), fresh-teacher verdict `CLEAN_WAVE1`
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/flexible-learning-runtime-design.md` — authoritative V2 behavior and Wave 3 requirements
- `docs/agent-plans/2026-08-28-flexible-learning-runtime/README.md` — coordination state and ownership boundary
- `docs/teacher-agent-protocol.md` — Agent A's landed learner-facing contract; do not weaken it
- `AGENTS.md` — repository ownership/invariants
- `docs/kernel-contracts.md` and `docs/evidence-model.md` — authoritative learner-state, prerequisite, evidence, and FSRS boundaries

Use the `causal-coding` Skill before source mutation. Inspect the real current implementation before deciding file-level changes.

## Objective

Implement the demonstrated Wave 3 orchestration gaps without creating a second learning system:

1. bound broad initial-diagnostic sweeps so an ordinary learning session is not filled with unrelated baselines;
2. make remaining session time usable for replanning after each completed interaction episode;
3. support an optional soft focus envelope that prefers a human curriculum slice (for example runtime/backpressure) without turning it into mastery state or a hard prerequisite.

The resulting system should remain flexible: Learning OS still chooses the next objective from durable learner state, while the teacher can finish the selected concept episode before the orchestrator selects again.

## Current state

Agent A passed live disposable dogfood after strengthening the protocol/Skill. The evidence does **not** justify a `TurnDirective` helper, so Wave 2 stays skipped.

Current orchestration facts from the V2 design:

- FSRS already owns when a valid retrieval becomes due; do not change FSRS unless a concrete scheduler defect is discovered.
- `getTodayMission(...)` currently consumes a full available-minute budget and can plan many pending baseline diagnostics in one call.
- task minutes are currently planning estimates, not adaptive elapsed-time control.
- the teacher protocol now requires episode closure and learner acceptance before a new attempt is opened.
- the live `data/profiles/backend-systems/tutor.db` is real learner state and is already modified in the working tree; do not use it for implementation experiments, reset it, stage it, or commit it.

## Ownership

You own:

- the daily/session orchestration behavior needed for diagnostic breadth control, remaining-time replanning, and soft focus;
- the smallest public input/output contract needed for a compatible teacher to ask Learning OS for the next bounded move after an episode;
- deterministic selection integration needed to honor soft focus while preserving existing higher-priority reasons such as due retrieval, active/retest weaknesses, true prerequisite blockers, and deadline pressure;
- concise documentation updates required to make the new orchestration contract usable by fresh compatible teachers.

Agent A already owns and has completed:

- visible teaching/exposure delivery coupling;
- reconstruction and clarification behavior;
- speech-aware chunking and response preservation;
- stop-after-question behavior;
- next-attempt confirmation and episode closure.

Do not reopen or redesign those behaviors unless a small compatibility adjustment is required by the orchestration interface.

## Coordination contract

Preserve these boundaries:

- Learning OS remains authoritative for objective selection, prerequisites, readiness, weaknesses, transfer, durability, review timing, and evidence.
- FSRS remains the retrieval-spacing owner.
- A soft focus is a preference over otherwise-eligible work, not learner evidence, readiness, a hard sequence, or an automatic prerequisite.
- A real prerequisite blocker may escape the focus envelope.
- A due/retest/recurring-weakness item may escape the focus envelope when existing selection policy gives it higher priority.
- Ending a focus/day never manufactures mastery or closes unresolved evidence.
- Remaining-time replanning should use current durable state after the just-finished episode rather than blindly executing a stale full-session plan.
- Do not revive legacy scalar mastery/SM-2 semantics or make `src/plan/pacer.ts` authoritative simply because it contains pacing code.

If the current selector API cannot represent soft focus cleanly, make the smallest complete contract change at the existing selection/planning owner. Do not add a parallel scheduler or prompt-owned sequencing state.

## Success conditions

### Diagnostic breadth

- An ordinary study session can perform useful baseline diagnosis without automatically consuming the whole session on every remaining pending diagnostic.
- The orchestration contract has a clear deterministic bound or episode-oriented behavior for initial diagnostics.
- After one diagnostic produces evidence and the episode closes, the next selection can be made from the updated state instead of being forced by a precomputed list of later diagnostics.

### Remaining-time replanning

- A compatible teacher can request the next mission/move with the **remaining** session budget after an episode.
- Short remaining budgets do not start a long design/implementation interaction that cannot reasonably reach feedback/closure.
- Replanning reads current evidence/projections, including what changed in the just-completed episode.
- Existing daily availability remains the outer budget; the new behavior does not reinterpret FSRS due dates as lesson duration.

### Soft focus

- Callers may optionally identify a preferred set/slice of active goal objectives for the current study focus.
- When equally or normally eligible work exists, selection prefers work inside that focus.
- Existing higher-authority constraints/reasons can escape the focus: true prerequisite work, due retrieval, recurring/retest weaknesses, or equivalent current selector priorities.
- A focus does not mutate readiness, transfer, durability, evidence, review cards, prerequisites, or goal-objective activation.
- A focus ending or changing leaves all learner state truthful and globally available.

### Compatibility

- Existing callers that do not provide a focus or remaining-time-specific input continue to have a sensible path.
- No new persistent learner-state concept is added unless the existing design proves it unavoidable; if persistence becomes necessary, stop and report the evidence rather than silently expanding scope.
- The Agent A learner-facing protocol remains compatible with the orchestration interface.

## Required validation

No repository tests are authorized. Do not create, modify, or run tests.

Use only narrow non-test evidence needed to establish the changed public contract and final source consistency. Inspect the final diff and report exactly what was checked.

Use disposable learner data for any behavioral smoke/dogfood needed to observe the orchestration behavior. Never use the real `backend-systems` learner database.

## Out of scope

- `TurnDirective` or another pedagogy helper unless new evidence from this mission demonstrates Agent A's contract is insufficient;
- FSRS algorithm/parameter changes;
- a stateful pedagogy engine;
- durable interview-signal scores;
- generic numeric challenge difficulty;
- response-segment persistence, durable reconstruction tables, or persistent scoped preferences;
- hard-coded seven-day/Day 1 state in the kernel;
- broad curriculum redesign;
- unrelated cleanup of legacy `src/plan/pacer.ts`.

## Working style

Work directly on `main` and commit only this mission's changes. Do not create a worktree. Do not touch, reset, restore, stage, or commit `data/profiles/backend-systems/tutor.db`.

Prefer the smallest complete change at the real orchestration/selection owner. Reuse existing deterministic selectors and goal/session budgets rather than introducing a second policy engine. If the V2 design's suggested interface conflicts with stronger current repository contracts, preserve the stronger contract and document the minimal adaptation.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. final `main` commit(s);
3. exact orchestration behavior and public/interface changes;
4. how diagnostic breadth, remaining-time replanning, and soft focus now behave;
5. disposable behavioral evidence used, if any;
6. explicitly required/non-test validation actually run; confirm no repository tests were run;
7. confirmation that the real `data/profiles/backend-systems/tutor.db` was untouched/staged/committed;
8. any newly demonstrated gap that would justify a later wave, especially persistence or a teacher helper.
