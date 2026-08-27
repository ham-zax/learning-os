# Agent A — Upstream ownership map

**Repository:** `/home/hamza/repo/learning-os`
**Artifact type:** read-only
**Workspace:** current checkout plus read-only inspection of `alienz-dev/generic-tutor`
**Isolation reason:** none
**Can start:** immediately
**Depends on:** none
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/agent-plans/2026-08-28-phase-0-recon/README.md` — coordination and neighboring ownership
- `docs/implementation-plan.md` — staged implementation intent
- `docs/kernel-contracts.md` — authoritative V1 kernel contract
- `docs/decisions/0001-fork-generic-tutor.md`
- `docs/decisions/0002-evidence-is-authoritative.md`
- `docs/decisions/0003-scheduler-input-policy.md`
- `docs/decisions/0004-teacher-agent-portability.md`

## Objective

Build an evidence-backed ownership map of the current `alienz-dev/generic-tutor` codebase so the next session can place Learning OS changes into the real owners instead of inventing parallel modules.

Focus on runtime/data ownership, not implementation.

## Current state

The local Learning OS repository currently contains design documentation only. The implementation plan assumes `generic-tutor` will become the structural shell, but exact upstream module/table ownership must be reconfirmed from current source before writable work begins.

## Ownership

You own read-only investigation of:

- database schema, migrations, and persisted entities;
- topic/concept/prerequisite ownership;
- session persistence and runtime engine;
- problem/challenge and attempt ownership;
- current mastery/status and SM-2/review state paths;
- interview coding/system-design grading paths;
- LLM client seam and its callers;
- mode vocabulary and every persisted/runtime owner of those mode values.

Agent B separately owns Git/fork/provenance/dependency/licensing reconnaissance. Do not duplicate that mission except where a dependency fact directly affects code ownership.

## Coordination contract

Return a compact map from each major Learning OS contract to the existing upstream owner, including:

```text
contract / concern
→ current upstream file/module/table
→ current behavior
→ preserve / extend / replace / retire
→ important callers/dependencies
→ uncertainty or collision
```

Call out any place where the implementation plan names a file/module that no longer exists or where ownership differs materially from the plan.

Do not redesign the kernel. If upstream reality conflicts with an accepted contract, report the conflict explicitly for Agent C.

## Success conditions

- The actual request/session/assessment/review data path is traced end to end.
- Every Phase 0 and first-wave kernel concern has a concrete current owner or is explicitly marked as missing.
- Session-mode vocabulary conflicts are enumerated from source, not recollection.
- Direct SM-2/mastery mutation sites and their callers are identified.
- The report gives Agent C enough evidence to choose exact mutation boundaries without another broad source survey.

## Required validation

None. Do not create, modify, or run tests. Use direct source inspection only.

## Out of scope

- changing code or documentation;
- choosing Git/fork topology or licensing disposition;
- implementing objectives/evidence/FSRS;
- proposing UI or multi-agent architecture.

## Working style

Inspect the current upstream source rather than relying on our earlier summaries. Prefer exact paths, symbols, tables, and call chains. Keep exploration bounded to ownership needed by Phase 0 and the first evidence-kernel wave.

Do not modify `/home/hamza/repo/learning-os`. Do not commit, reset, stash, or alter its current uncommitted documentation changes.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. exact upstream revision/branch inspected;
3. concise ownership map and main runtime/data flow;
4. stale assumptions found in `docs/implementation-plan.md`, if any;
5. no validation run (unless a mandatory repository policy unexpectedly required a non-test check, in which case explain it);
6. concrete notes Agent C needs before writable work;
7. unresolved ownership conflicts or unknowns.
