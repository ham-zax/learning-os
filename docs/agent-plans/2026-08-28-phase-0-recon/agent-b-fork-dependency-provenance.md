# Agent B — Fork, dependency, and provenance reconnaissance

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
- `docs/implementation-plan.md` — especially Phase 0
- `docs/research/source-comparison.md`
- `docs/decisions/0001-fork-generic-tutor.md`
- `docs/decisions/0003-scheduler-input-policy.md`
- `docs/decisions/0004-teacher-agent-portability.md`

## Objective

Determine the cleanest evidence-backed Phase 0 repository/fork boundary for adopting `alienz-dev/generic-tutor` as the Learning OS structural shell while preserving the current Learning OS design work and upstream history.

This is reconnaissance only. Do not perform the fork/import.

## Current state

`/home/hamza/repo/learning-os` is a Git repository on `main` at HEAD `8b7fb4bc28ed4e670055fd8246a7c5aa31f590f5`, with uncommitted design-document changes and no configured remotes. It currently contains design docs rather than upstream application source.

## Ownership

You own read-only investigation of:

- upstream Git branch/default branch and exact candidate base revision;
- upstream history/provenance implications for making `learning-os` the product working tree;
- package metadata, Node/package-manager expectations, and standalone clone viability;
- the `nexus: file:../nexus` dependency and the narrowest seam required to remove it;
- license/provenance files and any mismatch between package metadata and repository license text;
- generated/ecosystem-specific files that should not dictate product architecture;
- practical Git integration strategies that preserve both current Learning OS docs and upstream history without destructive rewriting.

Agent A separately owns application module/table/runtime ownership. Do not duplicate its source survey beyond dependency seams needed for this mission.

## Coordination contract

Do not execute Git topology changes. Return 1-2 viable integration strategies, ranked, with concrete tradeoffs and exact commands only as a proposed handoff for Agent C/D—not executed commands.

A recommended strategy must preserve:

- current Learning OS design artifacts;
- `generic-tutor` upstream commit provenance/history;
- a future `origin` for the user's Learning OS repository and an `upstream` relationship to `alienz-dev/generic-tutor` where appropriate;
- no hidden reliance on a sibling Nexus repository.

## Success conditions

- The exact upstream revision inspected is recorded.
- Standalone dependency blockers are enumerated from current package/source metadata.
- License/provenance facts are separated from assumptions; missing license text is reported precisely rather than hand-waved.
- At least one safe integration strategy exists that does not discard the current uncommitted Learning OS docs.
- Agent C receives a clear recommendation for what must be decided before Agent D mutates Git history or application source.

## Required validation

None. Do not create, modify, or run tests. Use direct Git/source/metadata inspection only.

## Out of scope

- performing the fork/import, merge, subtree operation, remote addition, or history rewrite;
- modifying package files or the LLM client;
- implementing Learning OS kernel behavior;
- broad code ownership mapping owned by Agent A.

## Working style

Prefer direct Git metadata and current upstream repository evidence. Be conservative around licensing and destructive history operations. Do not assume that a package-level `MIT` declaration alone resolves every redistribution/provenance question if repository license text is absent.

Do not modify `/home/hamza/repo/learning-os`. Do not commit, reset, stash, or alter its current uncommitted documentation changes.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. exact upstream revision/branch inspected;
3. repository/dependency/provenance findings;
4. ranked safe integration strategies and tradeoffs;
5. no validation run (unless a mandatory repository policy unexpectedly required a non-test check, in which case explain it);
6. concrete decisions Agent C must resolve before Agent D;
7. unresolved legal/provenance or dependency risks.
