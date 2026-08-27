# Agent D — Phase 0 history-preserving standalone baseline

**Repository:** `/home/hamza/repo/learning-os`
**Artifact type:** mixed (Git/history + executable behavior + configuration/metadata + documentation)
**Workspace:** current checkout
**Isolation reason:** none; D is the only writable mission in this wave
**Can start:** after the authorized design/coordination checkpoint commit exists and the worktree is clean
**Depends on:** completed Agents A-C and the checkpoint commit
**Execution lifetime:** ordinary unless persistent process observation becomes necessary
**Wake strategy:** none by default
**Developer visibility:** headless

## Read first

- `docs/agent-plans/2026-08-28-phase-0-recon/README.md` — coordination map and exact topology
- `docs/implementation-plan.md` — authoritative staged implementation plan
- `docs/kernel-contracts.md` — authoritative V1 contracts
- `docs/architecture.md` — subsystem and teacher-agent boundaries
- `docs/decisions/0001-fork-generic-tutor.md` — fork decision
- `docs/decisions/0002-evidence-is-authoritative.md` — evidence ownership
- `docs/decisions/0003-scheduler-input-policy.md` — scheduler boundary
- `docs/decisions/0004-teacher-agent-portability.md` — provider-neutral teacher contract
- `docs/research/source-comparison.md` — reuse/provenance context

## Pinned upstream

Use exactly:

```text
repository: https://github.com/alienz-dev/generic-tutor.git
branch:     master
commit:     2fffb72201aba055a4c270e2fddb29352edf2efb
```

Do not silently float to a newer upstream revision.

## Objective

Establish the first writable Learning OS baseline by preserving the complete `generic-tutor` ancestry, making the checkout standalone on a clean machine, normalizing ordinary-session delivery-context persistence, and removing only the immediately unsafe duplicate/hidden legacy mastery mutations.

Do not implement the Learning OS evidence kernel in this mission.

## Preconditions

Before any upstream merge or source mutation:

- verify the current branch is `main`;
- verify the authorized Learning OS design/coordination checkpoint is `HEAD`;
- verify the worktree is clean;
- do not amend, squash, reset, or rewrite that checkpoint;
- no public push/package publication is part of this mission.

If those conditions are false, stop and report the mismatch rather than repairing history by assumption.

## Ownership

### A. Integrate pinned upstream history

Own the Git/history integration of the pinned upstream commit.

Required topology:

```text
Learning OS init -- design/coordination checkpoint -- M -- later Phase 0 commits
                                                  /
upstream history ---------------------- 2fffb722--
```

For merge commit `M`:

- first parent: the authorized Learning OS checkpoint;
- second parent: `2fffb72201aba055a4c270e2fddb29352edf2efb`;
- preserve all reachable upstream commits;
- use an ordinary unrelated-history merge;
- do not squash, subtree-import, tarball-copy, reset, rebase, or replace the Learning OS branch with upstream.

`README.md` is the expected content collision. Resolve it deliberately:

- Learning OS owns product identity, evidence-driven target architecture, document authority, teacher portability, and V1 non-goals;
- preserve upstream operational facts that remain true after Phase 0, including Node >=22, npm usage, surviving CLI/build commands, and optional sibling integrations where relevant;
- add explicit provenance for `alienz-dev/generic-tutor` and the pinned commit;
- do not present legacy SM-2/self-grading or `explore|quiz|teach-back` as the target Learning OS architecture;
- update the statement that this repository contains only design documentation, because it becomes false after the merge.

Add/fetch `upstream` as the read/reference remote if needed. Do not invent or configure `origin`; no product remote has been provided.

Do not manufacture missing license text, copyright ownership/year, or transfer history. Record the observed provenance facts and keep public redistribution explicitly unresolved.

### B. Remove standalone runtime blockers

Own the smallest standalone baseline changes in:

```text
package.json
package-lock.json
src/llm/client.ts
src/db/database.ts
```

Required outcomes:

- remove `nexus: file:../nexus` from `package.json`;
- remove/prune all Nexus package/link entries from `package-lock.json` using npm lockfile tooling or an equivalently consistent lockfile update;
- remove the source import from `nexus/llm`;
- preserve the existing local `LLMClient.complete()` / `isConfigured()` application seam and completion option shape used by callers;
- Phase 0 defaults to a provider-neutral unconfigured local client: `isConfigured()` is false and `complete()` fails explicitly when no provider is configured;
- add no new OpenAI/Anthropic/other commercial provider SDK or paid API dependency merely to replace Nexus;
- keep `src/plan/nexus-planner.ts` unless a correctness issue requires otherwise; its filename is not a blocker;
- make `createDatabase(dbPath)` create the parent directory for file-backed databases before opening SQLite so a clean checkout can use `./data/tutor.db` without a pre-created `data/` directory.

Leave optional `../job-hunter` and `../ai-feeds` integrations unchanged except for accurate README wording if needed.

### C. Normalize ordinary-session delivery context

Canonical V1 delivery-context vocabulary is exactly:

```text
learn
practice
review
interview
mock
```

Legacy ordinary-session mapping is exactly:

```text
explore    -> learn
quiz       -> review
teach-back -> practice
```

Own the real persistence/runtime boundary in:

```text
src/db/types.ts
src/db/database.ts
src/knowledge/types.ts
src/session/engine.ts
src/plan/planner.ts
src/cli.ts
```

Existing `src/session/modes/explore.ts`, `quiz.ts`, and `teach-back.ts` may remain as implementation strategies. Renaming them is not required.

Required outcomes:

- new internal session/review writes use canonical delivery-context values only;
- physical legacy SQLite columns `sessions.mode` and `reviews.mode` may keep their column names, but their values represent canonical delivery context after migration;
- add an explicit database migration for known persisted legacy values using the mapping above;
- already-canonical values remain unchanged;
- unknown persisted values are not silently coerced; fail/report rather than guessing semantics;
- session/review writer inputs use the canonical delivery-context type;
- session/review reads validate/parse persisted rows instead of relying only on raw TypeScript casts;
- planning emits canonical delivery context;
- CLI may accept legacy `explore|quiz|teach-back` spelling only at its input boundary and must normalize immediately;
- promote canonical names in help/output where that surface is touched;
- do not route existing interview flows through ordinary session persistence in Phase 0;
- do not collapse `problems.type`, task form, capability, novelty, or difficulty into delivery context.

The planner may continue using legacy concept status temporarily to choose a canonical delivery context. Phase 0 is normalizing terminology and persistence, not declaring scalar mastery authoritative.

### D. Make the narrow immediate legacy-mastery safety cut

Own only `src/state.ts` for this slice.

Required outcomes:

- remove/retire dormant `updateConceptAfterReview()` so the repository does not retain a second SM-2/concept-state writer with no live caller;
- make `getTopicSummary()` a true read by removing automatic `topics.phase` mutation derived from legacy concept status/EF data;
- do not otherwise migrate or delete the active SM-2 compatibility path.

The surviving active path remains explicitly legacy compatibility:

```text
src/cli.ts::askGrade()
  -> src/session/engine.ts::gradeResponse()
  -> sm2()
  -> legacy concept scheduling/status fields
  -> legacy reviews
```

Do not extend it as new Learning OS learner truth.

## Explicitly out of scope

Do not implement or redesign:

- learning objectives/evidence tables;
- evidence revisions/correction replay;
- objective projections;
- `ReviewRatingMapper`;
- `ts-fsrs`, review cards, or FSRS replay;
- challenge-version/frozen-rubric persistence;
- physical `goal_id` ownership or a new goals subsystem;
- interview-to-session convergence;
- attempt lifecycle redesign;
- hint/exposure persistence;
- `sessions.concepts_reviewed` reinterpretation;
- deterministic code execution;
- `problems.type` redesign;
- provider/plugin/multi-agent frameworks;
- automatic job-description ingestion;
- optional sibling integration redesign;
- removal of `src/sm2.ts`;
- wholesale removal of legacy concept SM-2 fields/readers;
- legacy retention-duration policy;
- public package/repository publication.

## Coordination contract

The accepted ADRs and `docs/kernel-contracts.md` remain authoritative. If current upstream code makes a documented invariant impossible without widening the mission materially, report the conflict instead of inventing a second architecture.

Before the first source mutation, follow the repository's source-mutation workflow. Treat delivery-context normalization as a coordinated internal contract migration: inventory and migrate its real writers/readers rather than adding compatibility aliases deep inside the system.

## Success conditions

- The Git graph contains the full pinned upstream ancestry and the unrelated-history merge has the authorized Learning OS checkpoint as first parent and the pinned upstream commit as second parent.
- `docs/**` and Learning OS product identity survive the merge.
- Upstream provenance is explicit; unresolved license/redistribution facts remain accurately unresolved.
- A clean checkout no longer requires `../nexus` for dependency resolution.
- No runtime source imports `nexus/llm`, and the local `LLMClient` seam still exists without a new provider/API SDK dependency.
- File-backed SQLite creation creates its parent directory centrally.
- Ordinary session/review persistence, planning, and runtime use canonical `learn|practice|review|interview|mock` semantics with explicit migration of known legacy values.
- Unknown stored delivery-context values are not guessed.
- `updateConceptAfterReview()` no longer provides a duplicate legacy mastery writer.
- `getTopicSummary()` has no hidden topic-phase mutation.
- No evidence/FSRS/challenge/goal/interview architecture is prematurely implemented.
- Final working tree is clean and all mission changes are represented by explicit commits.

## Required validation

No test creation, modification, or test execution is authorized.

Use only narrow non-test evidence needed to establish this mission's contracts, including:

- inspect the merge commit's two parent IDs and ancestry;
- inspect final Git status;
- inspect package/lock/source references to confirm Nexus removal;
- inspect the resulting delivery-context writers/readers/migration and `src/state.ts` changes;
- report any dependency/build command only if independently required by repository policy or necessary to perform the lockfile mutation itself.

Do not run a broad test suite or add tests for confidence.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. starting checkpoint commit, upstream commit, merge commit, and final branch/HEAD;
3. merge-parent/ancestry result;
4. concise summary of standalone/Nexus/database changes;
5. concise summary of delivery-context migration and compatibility boundary;
6. concise summary of `src/state.ts` safety cut;
7. commits created;
8. explicitly required validation actually run, if any; otherwise state none;
9. deviations from this mission;
10. anything the next phase must know;
11. unresolved license/provenance or other protected risks.
