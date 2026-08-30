# Git-Backed Learner State and Study Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canonical learner profile safely versionable in Git, restore authoritative kernel tests, and give fresh agents one resume-before-plan continuation operation.

**Architecture:** Keep SQLite, the existing profile owner, and the provider-neutral teacher kernel. Add a profile-level WAL checkpoint operation and a read-only `src/study/continuation.ts` orchestration seam; expose both through the CLI while leaving attempt creation and Git mutation explicit. Replace ancestry tests with public-interface integration tests that protect current evidence, reconstruction, active-time, and interruption semantics.

**Tech Stack:** Node.js 22+, TypeScript 5.7, ESM, Commander 13, better-sqlite3 12, Zod 3, Vitest 3, Git.

**Spec:** `docs/superpowers/specs/2026-08-30-git-backed-learning-continuation-design.md`

## Global Constraints

- Core capabilities remain exactly `explain | predict | implement | debug | design`.
- Delivery contexts remain exactly `learn | practice | review | interview | mock`.
- SQLite remains in WAL mode; only canonical `registry.json` and `tutor.db` files may be versioned.
- Never version `*.db-shm`, `*.db-wal`, `*.db-journal`, registry lock directories, registry temp files, raw resumes, job descriptions, chat transcripts, provider IDs, API keys, or secrets.
- Checkpointing may operate on SQLite and report facts, but it must not stage, commit, or push Git changes.
- Continuation is read-only and must not register a challenge, create a session, open an attempt, assess work, record exposure, or close a session.
- Resumable work precedes budget collection and new planning, regardless of break duration.
- Wall elapsed time must never be treated as active study time.
- A configured `minutes_per_day` value is only a suggestion when remaining active-study time is unknown.
- New planning returns at most one mission item and preserves a separate learner/agent acceptance step.
- No database migration, hosted service, background timer, automatic study-run ledger, new dependency, or generic plugin layer is introduced.
- Existing `today`, `listResumableSessions`, `resumeSession`, and low-level teacher methods remain compatible.
- All tests use in-memory or temporary databases and must not mutate `data/profiles/backend-systems/tutor.db`.

---

## File Map

- `src/profile/index.ts`: resolve and safely checkpoint one canonical learner database.
- `src/study/continuation.ts`: own resume-before-budget-before-plan precedence.
- `src/teacher.ts`: bind continuation to an existing database handle.
- `src/cli.ts`: expose `profile checkpoint` and `continue` adapters.
- `tests/helpers/kernel-fixture.ts`: create a minimal real evidence-kernel fixture shared by lifecycle and continuation tests.
- `tests/kernel-lifecycle.test.ts`: characterize durable attempt, feedback, reconstruction, and active-time behavior.
- `tests/study-continuation.test.ts`: verify continuation ordering and one-item planning.
- `tests/profile-checkpoint.test.ts`: verify library and CLI checkpoint behavior against temporary profiles.
- `tests/cli-continuation.test.ts`: verify parseable JSON and human continuation output without hidden writes.
- `.gitignore`, `AGENTS.md`, `README.md`, `docs/getting-started.md`, `docs/kernel-contracts.md`, `docs/teacher-agent-protocol.md`, and `skills/learning-os-teacher/`: state the new operational contract consistently.

### Task 1: Restore the Current Default Test Baseline

**Files:**

- Delete: `tests/sm2.test.ts`
- Delete: `tests/sm2-pipeline-test.ts`
- Delete: `tests/new-topics-test.ts`
- Modify: `tests/knowledge-types.test.ts`
- Modify: `tests/db-types.test.ts`

**Interfaces:**

- Consumes: the current exports from `src/db/types.ts` and `src/knowledge/types.ts`.
- Produces: a green baseline that checks current schema registration without preserving removed SM-2 or static-plan behavior.

- [ ] **Step 1: Capture the obsolete-test failure**

Run:

```bash
npm test
```

Expected: FAIL because SM-2/static-plan imports no longer exist and the schema registry contains more than eight current tables.

- [ ] **Step 2: Delete the three ancestry tests**

Use `apply_patch` to delete `tests/sm2.test.ts`, `tests/sm2-pipeline-test.ts`, and `tests/new-topics-test.ts`. Do not recreate compatibility shims for their removed modules.

- [ ] **Step 3: Remove static learning-plan assertions**

Change the import in `tests/knowledge-types.test.ts` to:

```ts
import { describe, expect, it } from "vitest";
import {
  ConceptFrontmatterSchema,
  ConceptMapSchema,
  ManifestSchema,
} from "../src/knowledge/types.js";
```

Keep the `ConceptFrontmatterSchema`, `ManifestSchema`, and `ConceptMapSchema` blocks unchanged. Delete the complete `LearningPlanSchema` describe block.

- [ ] **Step 4: Make schema-registry checks capability-based**

Add `InteractionPreferencesRowSchema` to the `src/db/types.js` import in `tests/db-types.test.ts`. Replace the exact-count test with:

```ts
describe("Schema registry", () => {
  it("registers current session and interaction schemas", () => {
    expect(schemas.topics).toBe(TopicSchema);
    expect(schemas.concepts).toBe(ConceptSchema);
    expect(schemas.sessions).toBe(SessionSchema);
    expect(schemas.interaction_preferences).toBe(InteractionPreferencesRowSchema);
    expect(schemas.reviews).toBe(ReviewSchema);
    expect(schemas.synced_gaps).toBe(SyncedGapSchema);
    expect(schemas.synced_signals).toBe(SyncedSignalSchema);
    expect(schemas.problems).toBe(ProblemSchema);
    expect(schemas.attempts).toBe(AttemptSchema);
  });
});
```

- [ ] **Step 5: Verify and commit the repaired baseline**

Run:

```bash
npm test
npm run typecheck
git diff --check
```

Expected: all tests pass, TypeScript emits no errors, and the diff check is silent.

Commit only these test files:

```bash
git add tests/sm2.test.ts tests/sm2-pipeline-test.ts tests/new-topics-test.ts tests/knowledge-types.test.ts tests/db-types.test.ts
git commit -m "test: remove obsolete tutor ancestry coverage"
```

### Task 2: Characterize the Durable Kernel Lifecycle

**Files:**

- Create: `tests/helpers/kernel-fixture.ts`
- Create: `tests/kernel-lifecycle.test.ts`

**Interfaces:**

- Consumes: `createDatabase`, `createTopic`, `createConcept`, `setGoalObjective`, `setGoalPreparation`, `createSession`, and public kernel functions.
- Produces: `createKernelFixture(dbPath?: string): KernelFixture`, where the fixture owns a real database, one goal, one objective, and one frozen challenge.

- [ ] **Step 1: Add the reusable real-database fixture**

Create `tests/helpers/kernel-fixture.ts` with this shape:

```ts
import type Database from "better-sqlite3";
import {
  createConcept,
  createDatabase,
  createSession,
  createTopic,
  setGoalObjective,
  setGoalPreparation,
} from "../../src/db/database.js";
import {
  createLearningObjective,
  openAttempt,
  registerChallenge,
} from "../../src/kernel/foundation.js";

export const GOAL_ID = "goal";
export const CONCEPT_ID = "concept";
export const OBJECTIVE_ID = "concept:explain";
export const CHALLENGE_ID = "challenge";

export interface KernelFixture {
  db: Database.Database;
  openPracticeAttempt(): { sessionId: number; attemptId: number };
}

export function createKernelFixture(dbPath = ":memory:"): KernelFixture {
  const db = createDatabase(dbPath);
  createTopic(db, { id: GOAL_ID, name: "Goal" });
  createConcept(db, { id: CONCEPT_ID, topicId: GOAL_ID, title: "Concept" });
  createLearningObjective(db, {
    id: OBJECTIVE_ID,
    conceptId: CONCEPT_ID,
    capabilityId: "explain",
  });
  setGoalObjective(db, {
    goalId: GOAL_ID,
    objectiveId: OBJECTIVE_ID,
    importance: "core",
    targetReadiness: "guided",
  });
  setGoalPreparation(db, {
    goalId: GOAL_ID,
    purpose: "interview",
    minutesPerDay: 30,
    daysPerWeek: 5,
    confirmedAt: "2026-08-30T00:00:00.000Z",
  });
  registerChallenge(db, {
    id: CHALLENGE_ID,
    version: 1,
    publicPrompt: "Explain the mechanism.",
    taskForm: "explanation",
    deliveryContext: "practice",
    targets: [{
      objectiveId: OBJECTIVE_ID,
      novelty: "same",
      criterionIds: ["mechanism"],
    }],
    rubric: {
      id: "challenge-rubric",
      version: 1,
      criteria: [{
        id: "mechanism",
        objectiveId: OBJECTIVE_ID,
        required: true,
        description: "Explains the mechanism",
      }],
    },
    verification: { required: false, basis: "frozen_rubric" },
  });

  return {
    db,
    openPracticeAttempt() {
      const session = createSession(db, { topicId: GOAL_ID, mode: "practice" });
      const opened = openAttempt(db, CHALLENGE_ID, 1, session.id);
      return { sessionId: session.id, attemptId: opened.attempt.id };
    },
  };
}
```

Use the exact `createConcept(db, { id, topicId, title })` public signature shown above; do not insert fixture rows with raw SQL.

- [ ] **Step 2: Add the interruption and submitted-state tests**

Create `tests/kernel-lifecycle.test.ts`. In one test, open an attempt, close the database, reopen it from a temporary `tutor.db`, and assert:

```ts
expect(listResumableSessions(reopened, GOAL_ID)).toMatchObject([
  {
    phase: "awaiting_response",
    pendingAction: "collect_response",
    activeAttempt: { id: attemptId, submitted_at: null },
  },
]);
```

Do not modify timestamps to simulate a two-hour break: the contract is that no elapsed-wall-time expiration exists. Reopening the database proves the state does not depend on chat/process memory.

In a second test, submit the non-executable challenge and assert `resumeSession(db, sessionId)` returns `phase: "awaiting_assessment"` and `pendingAction: "assess_response"`.

- [ ] **Step 3: Add reconstruction and active-time tests**

Assess the submitted attempt with:

```ts
recordAssessment(db, attemptId, {
  evaluatorType: "agent",
  assessmentBasis: "frozen_rubric",
  objectiveResults: [{
    objectiveId: OBJECTIVE_ID,
    result: "incorrect",
    criteriaMet: [],
    criteriaUnmet: ["mechanism"],
    rationale: "The mechanism is missing.",
  }],
});
```

Record answer-bearing repair before showing it:

```ts
recordExposure(db, sessionId, {
  attemptId,
  objectiveIds: [OBJECTIVE_ID],
  exposureType: "answer",
  teachingMaterial: { content: "The mechanism is causal state transition." },
  requireReconstruction: true,
});
```

Assert `completeSessionFeedback(db, sessionId)` throws with `requires learner reconstruction`, then resolve with:

```ts
resolveSessionReconstruction(db, sessionId, {
  outcome: "completed",
  activeTimeSeconds: 600,
});
```

Assert the attempt's `time_spent_seconds` is exactly `600`, the session is complete, and `listResumableSessions(db, GOAL_ID)` is empty. Add a separate fixture case with `outcome: "opted_out"` and assert `reconstruction_status === "opted_out"` rather than pretending reconstruction succeeded.

- [ ] **Step 4: Run the characterization tests**

Run:

```bash
npx vitest run tests/kernel-lifecycle.test.ts
npm test
npm run typecheck
git diff --check
```

Expected: the new tests pass against existing kernel behavior. If a characterization assertion fails, inspect the public contract before changing production code; this task is not authorized to weaken evidence or reconstruction rules.

- [ ] **Step 5: Commit lifecycle coverage**

```bash
git add tests/helpers/kernel-fixture.ts tests/kernel-lifecycle.test.ts
git commit -m "test: cover resumable evidence lifecycle"
```

### Task 3: Add Safe Profile Database Checkpointing

**Files:**

- Create: `tests/profile-checkpoint.test.ts`
- Modify: `src/profile/index.ts`

**Interfaces:**

- Consumes: existing `resolveProfile(profileId?, options?)`, `ProfileStoreOptions`, profile path ownership, and `createDatabase(dbPath)`.
- Produces:

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

- [ ] **Step 1: Write failing library tests**

In `tests/profile-checkpoint.test.ts`, create one exact temporary directory per test with `mkdtempSync(join(tmpdir(), "learning-os-checkpoint-"))` and remove that exact directory in `afterEach`. Use `createProfile`, `selectProfile`, and `openProfileDatabase` to create/write the profile. Test both named and active resolution:

```ts
const named = checkpointProfileDatabase(profile.id, { dataDir });
expect(named).toMatchObject({
  profile: { id: profile.id },
  integrity: "ok",
  walFramesRemaining: 0,
});
expect(named.databasePath).toBe(join(dataDir, "profiles", profile.id, "tutor.db"));

selectProfile(profile.id, { dataDir });
expect(checkpointProfileDatabase(undefined, { dataDir }).profile.id).toBe(profile.id);
expect(() => checkpointProfileDatabase("missing", { dataDir })).toThrow(
  "Profile not found: missing",
);
```

- [ ] **Step 2: Run the focused test and observe RED**

```bash
npx vitest run tests/profile-checkpoint.test.ts
```

Expected: FAIL because `checkpointProfileDatabase` is not exported.

- [ ] **Step 3: Implement the profile-owned checkpoint operation**

In `src/profile/index.ts`, add:

```ts
interface WalCheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

interface IntegrityCheckResult {
  integrity_check: string;
}

export interface ProfileCheckpoint {
  profile: LearnerProfile;
  databasePath: string;
  integrity: "ok";
  walFramesCheckpointed: number;
  walFramesRemaining: number;
}
```

Factor the existing profile-to-database path expression into a private `databasePathForProfile(paths, profile)` helper used by both `openProfileDatabase` and checkpointing. Implement checkpointing as:

```ts
export function checkpointProfileDatabase(
  profileId?: string,
  options: ProfileStoreOptions = {},
): ProfileCheckpoint {
  const paths = profilePaths(options);
  const profile = resolveProfile(profileId, options);
  const databasePath = databasePathForProfile(paths, profile);
  if (!existsSync(databasePath)) {
    throw new Error(`Profile database is missing: ${profile.id}`);
  }

  const db = createDatabase(databasePath);
  try {
    const [checkpoint] = db.pragma("wal_checkpoint(TRUNCATE)") as WalCheckpointResult[];
    if (!checkpoint || checkpoint.busy !== 0) {
      throw new Error(`Profile database checkpoint is busy: ${profile.id}`);
    }
    const walFramesRemaining = Math.max(0, checkpoint.log - checkpoint.checkpointed);
    if (walFramesRemaining !== 0) {
      throw new Error(
        `Profile database still has ${walFramesRemaining} WAL frame(s): ${profile.id}`,
      );
    }

    const integrityRows = db.pragma("integrity_check") as IntegrityCheckResult[];
    if (integrityRows.length !== 1 || integrityRows[0]?.integrity_check !== "ok") {
      throw new Error(`Profile database integrity check failed: ${profile.id}`);
    }

    return {
      profile,
      databasePath,
      integrity: "ok",
      walFramesCheckpointed: checkpoint.checkpointed,
      walFramesRemaining,
    };
  } finally {
    db.close();
  }
}
```

Verify better-sqlite3's actual `wal_checkpoint(TRUNCATE)` row shape in the focused test. Keep the returned field names stable; adjust only the derivation if SQLite reports truncated counters differently.

- [ ] **Step 4: Run focused and full verification**

```bash
npx vitest run tests/profile-checkpoint.test.ts
npm test
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [ ] **Step 5: Commit the checkpoint library**

```bash
git add src/profile/index.ts tests/profile-checkpoint.test.ts
git commit -m "feat: add learner database checkpointing"
```

### Task 4: Expose Checkpointing and Ignore Transient SQLite Files

**Files:**

- Modify: `tests/profile-checkpoint.test.ts`
- Modify: `src/cli.ts`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: `checkpointProfileDatabase(profileId?, profileStoreOptions())` from Task 3.
- Produces: `tutor profile checkpoint [profile-id]` and exact ignore rules for transient database/registry coordination files.

- [ ] **Step 1: Add the failing CLI checkpoint test**

In `tests/profile-checkpoint.test.ts`, compute absolute paths from the test file:

```ts
const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const cliPath = join(repoRoot, "src", "cli.ts");
```

Create and select a profile under `join(tempRoot, "data")`, then execute:

```ts
const result = spawnSync(
  tsxBin,
  [cliPath, "profile", "checkpoint", profile.id],
  { cwd: tempRoot, encoding: "utf8" },
);
expect(result.status).toBe(0);
expect(result.stderr).toBe("");
expect(result.stdout).toContain(`Checkpointed profile ${profile.id}`);
expect(result.stdout).toContain("Integrity: ok");
expect(result.stdout).toContain("WAL frames remaining: 0");
```

- [ ] **Step 2: Run the CLI checkpoint test and observe RED**

```bash
npx vitest run tests/profile-checkpoint.test.ts
```

Expected: FAIL because Commander reports an unknown `checkpoint` profile subcommand.

- [ ] **Step 3: Add the profile subcommand**

Import `checkpointProfileDatabase` in `src/cli.ts`. After `profile show`, add:

```ts
profileCommand
  .command("checkpoint")
  .description("Checkpoint a learner database before committing it to Git")
  .argument("[id]", "Profile ID (defaults to selected profile)")
  .action((id?: string) => {
    try {
      const checkpoint = checkpointProfileDatabase(
        id ?? cliProfileOverride(),
        profileStoreOptions(),
      );
      success(`Checkpointed profile ${checkpoint.profile.id}.`);
      console.log(`  Database: ${checkpoint.databasePath}`);
      console.log(`  Integrity: ${checkpoint.integrity}`);
      console.log(`  WAL frames checkpointed: ${checkpoint.walFramesCheckpointed}`);
      console.log(`  WAL frames remaining: ${checkpoint.walFramesRemaining}`);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });
```

- [ ] **Step 4: Add precise transient-file ignore rules**

Append these rules to `.gitignore` without adding a broad `data/` rule:

```gitignore
# Canonical profile registry.json and tutor.db files may be versioned.
# SQLite/registry coordination artifacts are always transient.
data/**/*.db-shm
data/**/*.db-wal
data/**/*.db-journal
data/profiles/registry.json.lock/
data/profiles/registry.json.tmp-*
```

Verify with:

```bash
git check-ignore -v data/profiles/backend-systems/tutor.db-shm
git check-ignore -v data/profiles/backend-systems/tutor.db-wal
git check-ignore data/profiles/backend-systems/tutor.db && exit 1 || true
```

Expected: the first two paths are ignored and canonical `tutor.db` is not ignored.

- [ ] **Step 5: Run tests and commit the adapter**

```bash
npx vitest run tests/profile-checkpoint.test.ts
npm test
npm run typecheck
git diff --check
git add .gitignore src/cli.ts tests/profile-checkpoint.test.ts
git commit -m "feat: expose safe profile checkpoints"
```

### Task 5: Add the Deep Study Continuation Interface

**Files:**

- Create: `tests/study-continuation.test.ts`
- Create: `src/study/continuation.ts`
- Modify: `src/teacher.ts`

**Interfaces:**

- Consumes: `getTopic`, `getGoalPreparation`, `listResumableSessions`, `getTodayMission`, and their public result types.
- Produces: `StudyContinuationInput`, `StudyContinuation`, `getStudyContinuation(db, input)`, and `TeacherKernel.getStudyContinuation(input)`.

- [ ] **Step 1: Write failing continuation tests**

Create `tests/study-continuation.test.ts` using `createKernelFixture`. Cover these exact cases:

```ts
it("resumes unfinished work before asking for a budget", () => {
  const fixture = createKernelFixture();
  const { sessionId } = fixture.openPracticeAttempt();
  expect(getStudyContinuation(fixture.db, {
    goalId: GOAL_ID,
    now: "2026-08-30T02:00:00.000Z",
  })).toMatchObject({
    kind: "resume",
    session: { session: { id: sessionId }, pendingAction: "collect_response" },
    additionalResumableSessionIds: [],
  });
});

it("asks for remaining active-study time when no work is resumable", () => {
  const fixture = createKernelFixture();
  expect(getStudyContinuation(fixture.db, {
    goalId: GOAL_ID,
    now: "2026-08-30T02:00:00.000Z",
  })).toEqual({ kind: "needs_budget", goalId: GOAL_ID, suggestedMinutes: 30 });
});

it("returns at most one recommendation for a supplied budget", () => {
  const fixture = createKernelFixture();
  const result = getStudyContinuation(fixture.db, {
    goalId: GOAL_ID,
    now: "2026-08-30T02:00:00.000Z",
    availableMinutes: 20,
  });
  expect(result.kind).toBe("recommend");
  if (result.kind === "recommend") {
    expect(result.mission.items).toHaveLength(1);
    expect(result.item).toBe(result.mission.items[0]);
  }
});
```

Add a no-action case by deactivating the fixture objective through `setGoalObjective({ goalId, objectiveId, isActive: false })`; assert `kind === "no_action"` and `mission.items` is empty. Add an invalid-goal case that expects `Goal topic not found: missing`.

- [ ] **Step 2: Run focused tests and observe RED**

```bash
npx vitest run tests/study-continuation.test.ts
```

Expected: FAIL because `src/study/continuation.ts` does not exist.

- [ ] **Step 3: Implement the minimal orchestration module**

Create `src/study/continuation.ts`:

```ts
import type Database from "better-sqlite3";
import { getGoalPreparation, getTopic } from "../db/database.js";
import type { DeliveryContext } from "../db/types.js";
import { listResumableSessions } from "../kernel/foundation.js";
import type { ResumedSession } from "../kernel/foundation.js";
import { getTodayMission } from "../plan/today.js";
import type { DailyMission, DailyMissionItem } from "../plan/today.js";

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
  | { kind: "needs_budget"; goalId: string; suggestedMinutes: number | null }
  | { kind: "recommend"; mission: DailyMission; item: DailyMissionItem }
  | { kind: "no_action"; mission: DailyMission };

export function getStudyContinuation(
  db: Database.Database,
  input: StudyContinuationInput,
): StudyContinuation {
  if (!getTopic(db, input.goalId)) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }

  const resumable = listResumableSessions(db, input.goalId);
  const [session, ...additional] = resumable;
  if (session) {
    return {
      kind: "resume",
      session,
      additionalResumableSessionIds: additional.map((entry) => entry.session.id),
    };
  }

  if (input.availableMinutes === undefined) {
    return {
      kind: "needs_budget",
      goalId: input.goalId,
      suggestedMinutes: getGoalPreparation(db, input.goalId)?.minutes_per_day ?? null,
    };
  }

  const mission = getTodayMission(db, {
    goalId: input.goalId,
    now: input.now,
    availableMinutes: input.availableMinutes,
    maxItems: 1,
    retestEligibleWeaknessKeys: input.retestEligibleWeaknessKeys,
    mainDeliveryContext: input.mainDeliveryContext,
    transferDeliveryContext: input.transferDeliveryContext,
  });
  const [item] = mission.items;
  return item ? { kind: "recommend", mission, item } : { kind: "no_action", mission };
}
```

Do not call `resolveTodayAvailableMinutes`: absence must remain distinguishable from a supplied budget.

- [ ] **Step 4: Bind continuation to the teacher kernel**

Import `getStudyContinuation` and `StudyContinuationInput` in `src/teacher.ts`, then add this first method to the returned object:

```ts
getStudyContinuation: (input: StudyContinuationInput) =>
  getStudyContinuation(db, input),
```

Update the nearby doc comment so a fresh teacher continues through `getStudyContinuation()`; do not remove low-level methods.

- [ ] **Step 5: Verify read-only behavior and commit**

In the recommendation test, query `SELECT COUNT(*) AS count FROM attempts` before and after the call and assert both counts are zero. Then run:

```bash
npx vitest run tests/study-continuation.test.ts tests/kernel-lifecycle.test.ts
npm test
npm run typecheck
git diff --check
git add src/study/continuation.ts src/teacher.ts tests/study-continuation.test.ts
git commit -m "feat: add resume-first study continuation"
```

### Task 6: Add the Machine-Readable Continue CLI

**Files:**

- Create: `tests/cli-continuation.test.ts`
- Modify: `src/cli.ts`

**Interfaces:**

- Consumes: `getStudyContinuation(db, input)` and `DeliveryContext.parse`.
- Produces: `tutor continue <goal-id> [--minutes <n>] [--json]` with one JSON value on successful JSON stdout.

- [ ] **Step 1: Write the failing JSON CLI test**

In `tests/cli-continuation.test.ts`, create a temporary profile, select it, populate its file database with the same public fixture rows, then spawn the absolute `tsx` binary from Task 4:

```ts
const result = spawnSync(
  tsxBin,
  [cliPath, "continue", GOAL_ID, "--json"],
  { cwd: tempRoot, encoding: "utf8" },
);
expect(result.status).toBe(0);
expect(result.stderr).toBe("");
expect(JSON.parse(result.stdout)).toEqual({
  kind: "needs_budget",
  goalId: GOAL_ID,
  suggestedMinutes: 30,
});
```

Add a second test that opens a resumable attempt in the temporary profile and asserts JSON returns `kind: "resume"` without `--minutes`. Add a third test with `--minutes 20 --json` and assert `kind: "recommend"`, `mission.items.length === 1`, and the attempts count remains unchanged after the process exits.

- [ ] **Step 2: Run CLI tests and observe RED**

```bash
npx vitest run tests/cli-continuation.test.ts
```

Expected: FAIL because `continue` is not a command.

- [ ] **Step 3: Add the command and strict input parsing**

Import `getStudyContinuation` in `src/cli.ts`. Add a top-level command before `today`:

```ts
program
  .command("continue")
  .description("Resume unfinished work or select the next study action")
  .argument("<goal>", "Goal/topic ID")
  .option("-m, --minutes <n>", "Remaining active-study minutes")
  .option("--context <context>", "Override the main delivery context")
  .option("--transfer-context <context>", "Override the transfer delivery context")
  .option(
    "--retest <weakness-key>",
    "Make a resolved weakness eligible for retest (repeatable)",
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .option("--json", "Emit one machine-readable JSON value")
```

Inside the action, parse `--minutes` with `Number(opts.minutes)`, leaving it `undefined` when absent. Reject non-integers or non-positive values before calling continuation with the same message as planning: `Available minutes must be a positive integer`. Parse contexts with `DeliveryContext.parse`, call `getStudyContinuation`, and always close the database in `finally`.

- [ ] **Step 4: Implement JSON and human rendering**

For JSON mode, use exactly:

```ts
console.log(JSON.stringify(continuation));
return;
```

For human mode, switch on `continuation.kind`:

- `resume`: print the session ID, phase, pending action, and active challenge public prompt when present; list `additionalResumableSessionIds` when non-empty.
- `needs_budget`: print that remaining active-study minutes are unknown, show `suggestedMinutes` only as a configured suggestion, and show `tutor continue <goal> --minutes <n>`.
- `recommend`: print exactly the returned item's kind, minutes, objective ID, and reason; state that no attempt has been opened.
- `no_action`: if `mission.blocked.length > 0`, report prerequisite-blocked work; otherwise report that no work is currently actionable.

Errors continue through the existing `error(...)` helper and set `process.exitCode = 1`; never emit a success JSON object after an error.

- [ ] **Step 5: Add and pass a human-output assertion**

Spawn `continue <goal>` without `--json` on the no-budget fixture. Assert stdout contains `Remaining active-study minutes are unknown` and `--minutes <n>`. It must not contain ANSI escape sequences when spawned without a color-forcing environment.

Run:

```bash
npx vitest run tests/cli-continuation.test.ts
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all commands pass and successful JSON stdout parses directly.

- [ ] **Step 6: Commit the CLI adapter**

```bash
git add src/cli.ts tests/cli-continuation.test.ts
git commit -m "feat: expose study continuation in the CLI"
```

### Task 7: Align Repository, User, and Agent Documentation

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/kernel-contracts.md`
- Modify: `docs/teacher-agent-protocol.md`
- Modify: `skills/learning-os-teacher/SKILL.md`
- Modify: files directly referenced by `skills/learning-os-teacher/SKILL.md` only when they duplicate the continuation workflow.
- Modify: `docs/superpowers/specs/2026-08-30-git-backed-learning-continuation-design.md`

**Interfaces:**

- Consumes: the shipped CLI/API names from Tasks 3-6.
- Produces: one consistent operational policy for Git-backed state, time breaks, continuation, privacy, and binary conflicts.

- [ ] **Step 1: Replace the repository's contradictory data policy**

In `AGENTS.md`, replace the prohibition on committing live runtime databases with these explicit rules:

```text
Canonical managed learner state in data/profiles/registry.json and
data/profiles/<profile-id>/tutor.db may be committed intentionally. Run
`npm run tutor -- profile checkpoint [profile-id]` after study and before
staging the database. Never commit SQLite WAL/SHM/journal sidecars or registry
lock/temp artifacts.

Versioned learner databases contain responses, evidence, goals, exposure
history, and scheduling state. Treat repository visibility and collaborator
access as learner-data access. SQLite databases are binary: do not modify the
same profile independently on multiple branches or machines and do not attempt
a textual merge. Select one canonical database until an explicit export/import
workflow exists.

Raw resumes, job descriptions, chat transcripts, provider IDs, API keys,
secrets, config.json, and generated personal plans remain prohibited.
```

Keep the allowance for curated, human-readable examples outside `data/`.

- [ ] **Step 2: Document the human operating loop**

In `README.md` and `docs/getting-started.md`, add a concise workflow with exact commands:

```bash
npm run tutor -- continue <goal-id>
npm run tutor -- continue <goal-id> --minutes 25
# study through the agent/kernel
npm run tutor -- profile checkpoint
git add data/profiles/registry.json data/profiles/<profile-id>/tutor.db
git commit -m "data: checkpoint learner progress"
git push
```

State directly:

- returning after two minutes, two hours, or longer resumes the unfinished attempt first;
- break duration is not active-study time and does not expire the attempt;
- if nothing is open, `continue` asks for current remaining active-study minutes;
- the configured daily amount is a suggestion, not an inferred remaining balance;
- recommendations do not create attempts until accepted;
- committing the database shares its learner contents with everyone who can access the remote;
- divergent binary database histories must not be merged textually.

- [ ] **Step 3: Update kernel and teacher contracts**

In `docs/kernel-contracts.md`, define `getStudyContinuation` as a read-only orchestration projection. Explicitly say it adds no evidence, scheduler, attempt, session, or timer state and follows `resume -> needs_budget -> recommend/no_action` precedence.

In `docs/teacher-agent-protocol.md`, replace any sequence that asks the model to compose `listResumableSessions` and `getTodayMission` itself. Require `TeacherKernel.getStudyContinuation(...)` first for “continue,” “resume,” “what should I study?”, quiz/review resumption, and fresh-agent handoff. Preserve the contamination rule: exposure is recorded before an answer/hint is revealed.

- [ ] **Step 4: Mirror the behavior in the portable teacher skill**

Read `skills/learning-os-teacher/SKILL.md` completely before editing it. Update its invoked workflow and any directly referenced protocol file so a portable teacher:

1. opens the named/active profile;
2. calls `getStudyContinuation` before selecting new work;
3. resumes without requesting a budget when work is open;
4. asks for current remaining active-study minutes only when `needs_budget` is returned;
5. waits for acceptance before opening a recommended challenge;
6. recommends profile checkpointing before the learner commits/pushes state.

Do not add Git commands to the kernel or make the learner-facing agent auto-commit.

- [ ] **Step 5: Mark the design as implemented and check consistency**

Change the design status to `Implemented` only after Tasks 3-6 pass. Search documentation for contradictions:

```bash
rg -n "do not commit|never commit|ignored by git|listResumableSessions|getTodayMission|minutes_per_day|two hours|checkpoint|tutor continue" AGENTS.md README.md docs skills/learning-os-teacher
```

Review every match in context. Remove only obsolete policy claims; preserve statements that correctly prohibit transient/sensitive files or describe low-level APIs.

- [ ] **Step 6: Verify and commit documentation**

```bash
npm test
npm run typecheck
npm run build
git diff --check
git add AGENTS.md README.md docs/getting-started.md docs/kernel-contracts.md docs/teacher-agent-protocol.md skills/learning-os-teacher docs/superpowers/specs/2026-08-30-git-backed-learning-continuation-design.md
git commit -m "docs: define git-backed study continuation"
```

### Task 8: Checkpoint the Canonical Learner State, Verify, and Push

**Files:**

- Potentially modify: `data/profiles/backend-systems/tutor.db`
- Preserve: `data/profiles/registry.json`
- Never stage: `data/profiles/backend-systems/tutor.db-shm`
- Never stage: `data/profiles/backend-systems/tutor.db-wal`

**Interfaces:**

- Consumes: the completed CLI, test suite, profile checkpoint command, and explicit user authorization to version/push learner state.
- Produces: a verified branch on `origin/main` containing source, docs, tests, and the safely checkpointed canonical learner database.

- [ ] **Step 1: Run the canonical checkpoint**

```bash
npm run tutor -- profile checkpoint backend-systems
```

Expected: profile `backend-systems`, integrity `ok`, and zero WAL frames remaining. If it reports busy/locked, stop all processes holding that exact database, rerun the command, and do not stage the database until it succeeds.

- [ ] **Step 2: Verify transient artifacts are ignored and unstaged**

```bash
git status --short
git check-ignore -v data/profiles/backend-systems/tutor.db-shm
git check-ignore -v data/profiles/backend-systems/tutor.db-wal
git diff --cached --name-only
```

Expected: sidecars are ignored and absent from the staged-file list. Do not delete an active sidecar merely to make status clean; successful `TRUNCATE` checkpointing and database close should make it empty/removable, while `.gitignore` is the safety boundary.

- [ ] **Step 3: Run complete verification from the repository root**

```bash
npm test
npm run typecheck
npm run build
git diff --check
git status --short --branch
```

Expected: tests, typecheck, build, and diff check pass. Inspect status for unrelated user changes before staging.

- [ ] **Step 4: Inspect the learner database without exposing private rows**

Run only aggregate/integrity checks:

```bash
sqlite3 data/profiles/backend-systems/tutor.db "PRAGMA integrity_check; PRAGMA user_version; SELECT COUNT(*) FROM attempts; SELECT COUNT(*) FROM evidence_events;"
```

Expected: integrity is `ok`; counts are numeric. Do not print response text, teaching artifacts, raw evidence rationale, or other learner content in logs.

- [ ] **Step 5: Commit a checkpoint only if the canonical database changed**

```bash
git status --short data/profiles/registry.json data/profiles/backend-systems/tutor.db
```

If either canonical file is modified, stage only those exact files and commit:

```bash
git add data/profiles/registry.json data/profiles/backend-systems/tutor.db
git diff --cached --name-only
git commit -m "data: checkpoint learner progress"
```

If neither is modified, do not create an empty commit.

- [ ] **Step 6: Review the complete branch and push**

```bash
git log --oneline --decorate origin/main..HEAD
git diff --stat origin/main...HEAD
git status --short --branch
git push origin main
```

Expected: the push succeeds and local `main` is no longer ahead of `origin/main`. This push is authorized by the user's explicit request; do not force-push or rewrite history.

## Final Verification Matrix

Before reporting completion, verify each result directly:

| Requirement | Evidence |
| --- | --- |
| Current suite is authoritative | `npm test` passes with legacy files absent and lifecycle suites present |
| Safe canonical DB snapshot | `profile checkpoint` reports integrity `ok` and zero remaining WAL frames |
| Sidecars excluded | `git check-ignore -v` matches both SHM and WAL; staged-file list excludes them |
| Two-hour return resumes | lifecycle reopen test and continuation resume test pass without elapsed-time logic |
| Unknown remaining time stays unknown | continuation returns `needs_budget` with suggestion only |
| One next action | recommendation test asserts one mission item |
| No hidden attempt creation | library and CLI tests assert attempt count is unchanged |
| Agent entry point | `TeacherKernel.getStudyContinuation` exists and protocol/skill use it first |
| Machine-readable adapter | direct `JSON.parse(stdout)` succeeds for `continue --json` |
| Build health | `npm run typecheck` and `npm run build` pass |
| Remote persistence | `git push origin main` succeeds without force |
