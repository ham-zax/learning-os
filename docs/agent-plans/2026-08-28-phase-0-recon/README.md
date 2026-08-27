# Phase 0 Reconnaissance — Agent Coordination

**Repository:** `/home/hamza/repo/learning-os`
**Source of truth:** `docs/implementation-plan.md`, `docs/kernel-contracts.md`, accepted ADRs 0001-0004
**Coordination base:** the authorized design/coordination checkpoint created from `8b7fb4bc28ed4e670055fd8246a7c5aa31f590f5` plus the final pre-upstream design tree; Agent D must treat that checkpoint as its starting `HEAD`
**Execution shape:** hybrid
**Current wave:** 2

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| Agent A — Upstream ownership map | read-only | complete | finished | current checkout + read-only upstream inspection | none | none |
| Agent B — Fork/dependency/provenance reconnaissance | read-only | complete | finished | current checkout + read-only upstream inspection | none | none |
| Agent C — Phase 0 reconciliation | read-only | complete | finished | current checkout + read-only upstream inspection | none | Agent A + Agent B reports |
| Agent D — Phase 0 history-preserving standalone baseline | mixed | ready after checkpoint | after this coordination/design checkpoint is committed and the tree is clean | current checkout | none; sole writable mission | authorized checkpoint + Agent C |

## Dependency map

```text
Agent A: code/data ownership map ─────┐
                                     ├──> Agent C: Phase 0 reconciliation / exact execution frontier
Agent B: fork/dependency/provenance ─┘
                                                  │
                                                  v
                                      Agent D: first writable Phase 0 implementation
```

## Shared contracts

- The accepted ADRs and `docs/kernel-contracts.md` are authoritative over implementation assumptions.
- Do not change Learning OS architecture during reconnaissance. Report contradictions instead.
- Preserve `generic-tutor` upstream history rather than copying source into unrelated history.
- ChatGPT is the preferred V1 teacher client, but teacher state/protocol remains provider-neutral.
- No mission may treat old scalar concept mastery or SM-2 state as authoritative learner truth.

## Workspace policy

Wave 1 reconnaissance (A-C) was read-only. Wave 2 has one writer, Agent D, in the current checkout; no extra worktree is justified.

The user authorized the final design/coordination tree to be captured in one dedicated checkpoint commit, including ADR 0004 and the agent-plan package, intentionally collapsing the prior staged/unstaged distinction. That checkpoint must be clean and remain unrevised before Agent D merges upstream.

## Integration policy

Agents A, B, and C are complete. The protected checkpoint decision is authorized. This coordination update and Agent D mission are part of the final design/coordination checkpoint. After that checkpoint commit exists and the tree is clean, Agent D is ready to perform the first writable Phase 0 mission. The later upstream merge must use that checkpoint as first parent and pinned upstream `2fffb72201aba055a4c270e2fddb29352edf2efb` as second parent.

## Execution lifetime policy

A, B, and C were ordinary bounded reconnaissance/reconciliation sessions. Agent D is also expected to be an ordinary bounded implementation session; use `persistent-agent-loop` only if actual process lifetime or waiting makes it necessary.

## Validation policy

No test creation, modification, or test execution is authorized. Agent D may use the narrow non-test checks named in its mission to establish Git topology, package/lockfile state, persistence-contract changes, and final cleanliness.

## Future / deferred work

After Agent D, materialize the next frontier from its actual report. Evidence/FSRS, goal ownership, challenge-version storage, interview convergence, provider selection, and broad legacy-state retirement remain intentionally deferred.

## Status log

- `2026-08-28` — Wave 1 materialized with Agents A and B ready in parallel; C and D intentionally blocked.
- `2026-08-28` — Agents A and B returned complete reconnaissance reports against upstream `2fffb72201aba055a4c270e2fddb29352edf2efb`. Agent C was materialized for reconciliation.
- `2026-08-28` — Agent C completed reconciliation. The technical Agent D boundary was resolved.
- `2026-08-28` — User authorized one dedicated checkpoint of the final design/coordination tree, intentionally collapsing its staged/unstaged distinction. Agent D mission materialized inside that checkpoint; D becomes launchable once the checkpoint commit is created and the worktree is clean.
