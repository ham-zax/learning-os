# Git-Backed Learner State and Study Continuation Design

**Status:** Proposed after in-chat design approval

**Date:** 2026-08-30

## Purpose

Learning OS should support Hamza's intended operating model:

- canonical learner state is versioned in Git and can travel with the repository;
- transient SQLite coordination files are never versioned;
- a learner can stop for minutes or hours and a fresh agent resumes unfinished work before planning anything new;
- remaining study time is explicit when it cannot be recovered reliably;
- the default test command verifies the current evidence-driven kernel rather than removed Generic Tutor ancestry.

This design keeps SQLite and the existing public teacher kernel. It does not add a hosted service, provider-specific memory, a generic plugin framework, or automatic wall-clock tracking.

## Current Problems

### Git persistence is accidental rather than operationally safe

The repository currently tracks `data/profiles/registry.json` and a learner `tutor.db`, while documentation says `data/` is ignored and repository policy forbids committing live databases. SQLite runs in WAL mode, so opening a database can materialize `tutor.db-shm` and `tutor.db-wal`. Committing only `tutor.db` without checkpointing an active WAL can omit recent learner state; committing the sidecars produces unstable, machine-local artifacts.

### Verification targets obsolete behavior

`npm test` imports deleted SM-2 and learning-plan modules and assumes the original eight-table schema. Two legacy script-style tests are not collected by Vitest. The default suite does not protect the current challenge, attempt, evidence, reconstruction, active-time, or resumption contracts.

### Continuation ordering is a caller obligation

The kernel exposes `listResumableSessions(...)`, `resumeSession(...)`, and `getTodayMission(...)` separately. A fresh agent must remember to check resumable sessions before asking for a new mission. `getTodayMission(...)` also requires caller-owned remaining active-study minutes. This permits a compatible but incorrectly orchestrated teacher to start new work while an attempt or feedback episode remains unfinished, or to reset the learner's budget after a break.

## Goals

1. Make Git-versioned canonical learner databases an explicit supported repository policy.
2. Provide a safe profile checkpoint operation before committing learner state.
3. Ensure transient SQLite sidecars and lock/temp files remain untracked.
4. Restore a green default test baseline that exercises current authoritative behavior.
5. Add one deep continuation module that owns resume-before-plan precedence.
6. Expose continuation through both `createTeacherKernel(db)` and a machine-readable CLI command.
7. Preserve learner agency: obtaining a recommendation never opens an attempt automatically.

## Non-Goals

- Automatically committing or pushing Git changes.
- Merging two independently modified SQLite learner databases.
- Encrypting learner databases in this change.
- Deriving active study time from session timestamps, terminal lifetime, tab lifetime, or planner estimates.
- Persisting a daily study-run ledger or background timer.
- Replacing SQLite WAL mode globally.
- Building a hosted UI, provider-specific integration, generic tool server, or multi-agent framework.
- Restoring legacy SM-2 mastery semantics or removed static learning plans.

## Design 1: Intentional Git-Backed Learner State

### Canonical and transient files

The repository will intentionally allow these canonical profile files to be tracked:

```text
data/profiles/registry.json
data/profiles/<profile-id>/tutor.db
```

The repository will ignore SQLite and registry coordination artifacts:

```text
data/**/*.db-shm
data/**/*.db-wal
data/**/*.db-journal
data/profiles/registry.json.lock/
data/profiles/registry.json.tmp-*
```

The ignore rules will not use a broad `data/` exclusion because canonical databases are deliberately versioned in this repository.

### Privacy and merge contract

Documentation and repository policy will state plainly:

- learner responses, evidence, exposure history, goals, and scheduling state can reach the configured Git remote;
- repository visibility and collaborator access must therefore be intentional;
- SQLite databases are binary and should not be edited independently on multiple branches or machines;
- when divergent database histories exist, choose one canonical database or use a future explicit export/import workflow rather than attempting a textual merge;
- raw resumes, job descriptions, provider IDs, API keys, secrets, and chat transcripts remain prohibited learner-state content.

### Profile checkpoint operation

`src/profile/index.ts` will expose:

```ts
export interface ProfileCheckpoint {
  profile: LearnerProfile;
  databasePath: string;
  integrity: "ok";
  walFramesCheckpointed: number;
  walFramesRemaining: number;
}

export function checkpointProfileDatabase(
  profileId?: string,
  options?: ProfileStoreOptions,
): ProfileCheckpoint;
```

The operation will:

1. resolve the named or active profile using the existing profile rules;
2. open its canonical database through the current database owner;
3. execute `PRAGMA wal_checkpoint(TRUNCATE)`;
4. execute `PRAGMA integrity_check`;
5. fail unless the integrity result is exactly `ok` and no WAL frames remain;
6. close the database in a `finally` block;
7. return facts suitable for CLI output.

It will not stage, commit, or push files. SQLite busy/locked errors will be surfaced with profile context; the command will not claim a safe checkpoint when another process prevents completion.

The CLI will add:

```text
tutor profile checkpoint [profile-id]
```

This command is the documented operation to run after a study session and before `git add`/`git commit` of learner state.

## Design 2: Current Verification Baseline

### Remove obsolete tests

The following obsolete tests will be deleted rather than made compatible with non-authoritative behavior:

```text
tests/sm2.test.ts
tests/sm2-pipeline-test.ts
tests/new-topics-test.ts
```

The removed `LearningPlanSchema` assertions will be deleted from `tests/knowledge-types.test.ts`. `tests/db-types.test.ts` will stop asserting an exact schema-registry count and will instead assert that required current schemas are registered, including session reconstruction and interaction preferences.

### Add current integration tests

Tests will use isolated temporary or in-memory databases and public repository interfaces. They will not open or mutate `data/profiles/<profile-id>/tutor.db`.

New focused suites:

```text
tests/kernel-lifecycle.test.ts
tests/study-continuation.test.ts
tests/profile-checkpoint.test.ts
```

The lifecycle suite will verify:

- an unsubmitted attempt survives process-independent resumption as `awaiting_response`;
- a submitted attempt resumes as `awaiting_verification` or `awaiting_assessment` according to the frozen challenge;
- answer-bearing causal repair persists a reconstruction checkpoint;
- feedback cannot close while reconstruction is required;
- reconstruction completion and explicit opt-out both close the checkpoint truthfully;
- reliable `activeTimeSeconds` persists, while wall elapsed time is never substituted;
- completed sessions no longer appear resumable.

The profile-checkpoint suite will verify canonical database checkpointing, integrity reporting, named/active profile resolution, and failure for a missing profile. It will assert behavior, not Git staging.

## Design 3: Deep Study Continuation Module

### Seam and responsibility

A new `src/study/continuation.ts` module will own the decision immediately before learner-facing continuation. Its interface hides the ordering rule that every agent currently has to reproduce.

```ts
export interface StudyContinuationInput {
  goalId: string;
  now: string;
  availableMinutes?: number;
  retestEligibleWeaknessKeys?: readonly string[];
  mainDeliveryContext?: DeliveryContext;
  transferDeliveryContext?: DeliveryContext;
}

export type StudyContinuation =
  | {
      kind: "resume";
      session: ResumedSession;
      additionalResumableSessionIds: number[];
    }
  | {
      kind: "needs_budget";
      goalId: string;
      suggestedMinutes: number | null;
    }
  | {
      kind: "recommend";
      mission: DailyMission;
      item: DailyMissionItem;
    }
  | {
      kind: "no_action";
      mission: DailyMission;
    };

export function getStudyContinuation(
  db: Database.Database,
  input: StudyContinuationInput,
): StudyContinuation;
```

### Decision order

`getStudyContinuation(...)` will:

1. validate that the goal exists;
2. load resumable sessions for that goal;
3. if one or more exist, return the newest session as `resume` and report any additional resumable IDs;
4. if none exist and `availableMinutes` is absent, return `needs_budget` with confirmed preparation minutes as a suggestion, never as silently consumed remaining time;
5. otherwise call `getTodayMission(...)` with `maxItems: 1` and the supplied active-study budget;
6. return `recommend` for one selected item or `no_action` with the mission's blocked/unallocated details.

The function is read-only. It does not register a challenge, create a session, open an attempt, assess work, record exposure, or close anything. The existing learner-acceptance rule remains intact.

When multiple resumable sessions exist, the newest is returned deterministically because `listResumableSessions(...)` already orders by most recent start. Additional IDs are surfaced rather than silently discarded. A later change may add explicit conflict resolution if dogfooding shows that multiple open sessions are common.

### Teacher interface

`createTeacherKernel(db)` will expose `getStudyContinuation(input)`. The learner-facing protocol and portable skill will make it the first operation for “continue,” “resume,” and “what should I do next?” Existing low-level methods remain available for challenge execution and diagnostics, but callers no longer need to compose resume-before-plan precedence themselves.

### CLI adapter

The CLI will add:

```text
tutor continue <goal-id> [--minutes <n>] [--json]
```

Behavior:

- `resume`: print the pending learner-facing action and frozen challenge summary; JSON emits the continuation object.
- `needs_budget`: ask the caller to rerun with `--minutes`; display configured preparation minutes only as a suggestion.
- `recommend`: print exactly one recommendation and wait for a separate learner/agent action to open it; JSON emits the mission item.
- `no_action`: distinguish blocked work from no currently actionable work using the returned mission.

The CLI command is read-only and non-interactive. It does not replace the conversational teacher and does not expose private solution material.

## Time and Interruption Semantics

- A break of two minutes, two hours, or longer does not expire an attempt.
- Wall elapsed time is never active study time.
- Resumable work takes precedence even when no remaining budget is supplied.
- After the unfinished episode closes, a fresh caller supplies its current active-study budget before receiving new work.
- Confirmed `minutes_per_day` may be shown as a suggestion, but it is not assumed to be the remaining budget after prior work.
- Planner item minutes remain reservation estimates.
- A durable automatic study-run ledger is deferred until observed usage demonstrates that asking for the budget is inadequate.

## Error Handling

- Invalid goal IDs and malformed times retain the existing explicit errors.
- Non-positive or non-integer supplied minutes retain `getTodayMission(...)` validation.
- Profile checkpoint failure leaves Git untouched and reports the underlying SQLite/profile failure.
- JSON CLI output writes one complete JSON value on stdout; human diagnostics and errors go to stderr so agents can parse success output reliably.
- No operation catches an error and reports successful persistence or continuation.

## Testing Strategy

The continuation interface is the primary test surface. Tests will use real in-memory SQLite rather than mocks and will construct minimal frozen challenges through public functions.

Required red-green sequence:

1. profile checkpoint tests fail because the operation/command does not exist;
2. implement the smallest checkpoint operation and pass focused tests;
3. lifecycle tests fail on missing current regression coverage or explicit assertions;
4. preserve existing implementation and make the default suite current;
5. continuation tests fail because `getStudyContinuation(...)` does not exist;
6. implement resume precedence, budget request, one-item recommendation, and no-action behavior;
7. CLI tests fail before adding `continue`, then pass for human and JSON forms;
8. run the complete test, typecheck, build, and staged-diff checks.

## Documentation Changes

Update:

- `AGENTS.md`: permit canonical tracked learner databases, prohibit raw sensitive inputs and transient sidecars, require checkpointing before commits.
- `README.md`: explain Git-backed profile persistence, privacy/merge trade-offs, checkpoint command, and `continue` workflow.
- `docs/getting-started.md`: make `tutor continue` the resumption/next-action entry point.
- `docs/kernel-contracts.md`: define continuation as orchestration-only state reading, not evidence or scheduling state.
- `docs/teacher-agent-protocol.md`: replace caller-composed resume/mission ordering with `getStudyContinuation(...)`.
- `skills/learning-os-teacher/`: mirror the authoritative continuation workflow and Git-backed environment constraints.

## Rollout and Compatibility

- No database schema migration is required for continuation or checkpointing.
- Existing learner databases remain valid.
- Existing `today`, `listResumableSessions`, and low-level teacher methods remain available.
- The default CLI behavior is additive.
- Canonical learner databases already tracked in history remain the starting state.
- Transient sidecars currently present in the workspace will be removed after their ignore rules and checkpoint behavior are in place; they are not learner-state migrations.

## Success Criteria

1. `npm test`, `npm run typecheck`, and `npm run build` pass.
2. `tutor profile checkpoint` confirms integrity and leaves no uncheckpointed WAL frames.
3. Canonical `tutor.db` and `registry.json` can be committed while SQLite sidecars remain ignored.
4. A two-hour-old unsubmitted attempt is returned by `getStudyContinuation(...)` without requiring a new budget.
5. With no resumable session and no supplied minutes, continuation returns `needs_budget` rather than resetting the budget.
6. With a supplied budget, continuation returns at most one mission item.
7. `tutor continue --json` emits parseable output without opening an attempt.
8. Learner-facing protocol and skill direct fresh agents through continuation before new work.
