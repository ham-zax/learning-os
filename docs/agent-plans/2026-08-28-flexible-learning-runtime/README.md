# Flexible Learning Runtime — Agent Coordination

**Repository:** `/home/hamza/repo/learning-os`
**Source of truth:** `docs/flexible-learning-runtime-design.md`
**Design base:** `79c239e4062fcee44f278dd5a7ee144bd5f8854b`
**Execution shape:** sequential
**Current wave:** 1

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| Agent A — Learner-facing contract repair | docs/config + live dogfood | ready | now | current `main` checkout | none; sole writer | none |
| Agent B — Conditional next wave | executable or teacher-helper | blocked | after Agent A report/commit | same current `main` checkout, sequentially | none; one writer at a time | Agent A dogfood outcome |

## Dependency map

```text
Agent A: strengthen teacher protocol/Skill + fresh-teacher dogfood
        |
        +-- dogfood clean --> Agent B: Wave 3 orchestration flexibility
        |
        +-- fresh teacher still violates contract --> Agent B: Wave 2 pure TurnDirective helper

Wave 4 persistence remains blocked until a real restart/continuity failure demonstrates need.
```

## Shared contracts

- Learning OS remains authoritative for objective selection, evidence, readiness, prerequisites, review timing, transfer, durability, weakness state, and next-work decisions.
- The teacher may adapt dynamically only inside the already-selected interaction episode.
- FSRS continues to own future clean-retrieval timing. It must not become a lesson-duration or pedagogy selector.
- A learner-visible exposure exists only when the corresponding answer-bearing material is actually emitted to the learner. Hidden reasoning, tool output, drafts, or internal plans are not exposure.
- The live `data/profiles/backend-systems/tutor.db` contains real learner state. It is unrelated working-tree state for this effort and must not be edited, staged, reset, restored, or committed by delegated agents.
- Wave 1 dogfood must use disposable learner data.

## Workspace policy

Use the current `main` checkout sequentially. Do not create worktrees. Parallel writes are not justified because Agent A and the eventual Agent B can touch shared teacher/orchestration contracts, and Agent B's exact mission depends on Agent A's dogfood evidence.

Only one delegated writer should operate in this checkout at a time. Each agent should commit only its owned changes and explicitly exclude `data/`.

## Integration policy

No branch integration is required. Agent A commits directly to local `main`. After its finish report, replan Agent B from observed dogfood evidence and Agent A's landed commit. Agent B then works on that new `main` baseline and commits directly to `main`.

Do not push unless the user separately requests publication to the remote.

## Execution lifetime policy

Agent A is expected to be an ordinary bounded session. Agent B is also expected to be ordinary unless its actual implementation creates wait-heavy or persistent-process work; use `persistent-agent-loop` only if that becomes real.

## Validation policy

Testing is not authorized by default. Do not create, modify, or run repository tests.

The source design explicitly requires fresh-teacher live dogfood for Wave 1, so Agent A should run the smallest disposable-data dogfood needed to observe the learner-facing behavior. Non-test checks such as focused file inspection, Skill validation/packaging required by the Skill workflow, `git diff --check`, or narrow type/build checks are allowed only when directly needed by the changed artifact or repository policy.

## Future / blocked work

- **Agent B — Wave 2 helper**: only if Agent A's fresh-teacher dogfood still shows that clear protocol/Skill rules are not reliably executed. Own a pure, non-persistent `TurnDirective`-style helper that cannot choose objectives or mutate learner state.
- **Agent B — Wave 3 orchestration**: preferred path if Wave 1 dogfood is clean. Own diagnostic-breadth policy, remaining-time replanning/session envelope, and optional soft-focus behavior while keeping FSRS unchanged.
- **Wave 4 persistence**: response segments, scoped stable preferences, or durable reconstruction checkpoints only after a demonstrated fresh-agent restart gap.

## Status log

- `2026-08-28` — V2 flexible runtime design committed on `main` at `79c239e4062fcee44f278dd5a7ee144bd5f8854b`.
- `2026-08-28` — Execution chosen as two sequential sessions. Only Agent A is materialized because Agent B's correct mission depends on Wave 1 dogfood evidence.
