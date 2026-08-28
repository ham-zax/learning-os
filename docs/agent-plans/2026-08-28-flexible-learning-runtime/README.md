# Flexible Learning Runtime — Agent Coordination

**Repository:** `/home/hamza/repo/learning-os`
**Source of truth:** `docs/flexible-learning-runtime-design.md`
**Design base:** `79c239e4062fcee44f278dd5a7ee144bd5f8854b`
**Execution shape:** sequential
**Current wave:** 3

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| Agent A — Learner-facing contract repair | docs/config + live dogfood | complete | finished at `9ef1040` | current `main` checkout | none; sole writer | none |
| Agent B — Orchestration flexibility | executable + docs | ready | now from `9ef1040` | same current `main` checkout, sequentially | none; sole writer after A | Agent A `CLEAN_WAVE1` |

## Dependency map

```text
Agent A: strengthen teacher protocol/Skill + fresh-teacher dogfood (`9ef1040`)
        |
        v
Fresh-teacher verdict: `CLEAN_WAVE1`
        |
        +-- Wave 2 pure TurnDirective helper SKIPPED
        |
        v
Agent B: Wave 3 orchestration flexibility

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

Use the current `main` checkout sequentially. Do not create worktrees. Agent A is complete; Agent B is now the only delegated writer. The sequential topology avoids overlapping edits across the shared teacher/orchestration boundary.

Each agent commits only its owned changes and explicitly excludes `data/`.

## Integration policy

No branch integration is required. Agent A landed `9ef1040` directly on local `main` and returned `CLEAN_WAVE1`. Wave 2 is skipped. Agent B now works from `9ef1040` and commits its Wave 3 changes directly to `main`.

Do not push unless the user separately requests publication to the remote.

## Execution lifetime policy

Agent A is expected to be an ordinary bounded session. Agent B is also expected to be ordinary unless its actual implementation creates wait-heavy or persistent-process work; use `persistent-agent-loop` only if that becomes real.

## Validation policy

Testing is not authorized by default. Do not create, modify, or run repository tests.

The source design explicitly requires fresh-teacher live dogfood for Wave 1, so Agent A should run the smallest disposable-data dogfood needed to observe the learner-facing behavior. Non-test checks such as focused file inspection, Skill validation/packaging required by the Skill workflow, `git diff --check`, or narrow type/build checks are allowed only when directly needed by the changed artifact or repository policy.

## Future / blocked work

- **Wave 2 helper**: skipped after Agent A's `CLEAN_WAVE1`; do not revive without new evidence that the strengthened contract is insufficient.
- **Agent B — Wave 3 orchestration**: ready now. Own diagnostic-breadth policy, remaining-time replanning/session envelope, and optional soft-focus behavior while keeping FSRS unchanged.
- **Wave 4 persistence**: response segments, scoped stable preferences, or durable reconstruction checkpoints only after a demonstrated fresh-agent restart gap.

## Status log

- `2026-08-28` — V2 flexible runtime design committed on `main` at `79c239e4062fcee44f278dd5a7ee144bd5f8854b`.
- `2026-08-28` — Execution chosen as two sequential sessions. Only Agent A was initially materialized because Agent B's correct mission depended on Wave 1 dogfood evidence.
- `2026-08-28` — Agent A completed at `9ef1040` with fresh-teacher verdict `CLEAN_WAVE1`; Wave 2 skipped and Agent B Wave 3 mission materialized.
