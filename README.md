# Learning OS

Learning OS is an evidence-driven programming learning system built around one rule: **a learner should advance because they demonstrated a capability, not because content was shown or they reported confidence.**

Learning OS now has a working TypeScript/SQLite evidence kernel, isolated learner profiles, adaptive confirmed onboarding, objective-specific projections, FSRS scheduling, challenge selection, resumable sessions, interview workflows, and a provider-neutral teacher API. It preserves useful Generic Tutor shell/history, but legacy scalar mastery and SM-2 fields are compatibility data rather than learner truth.

## Current system

Learning OS evolved from `alienz-dev/generic-tutor` and selectively incorporated ideas from other learning systems while replacing the original scalar learning-state core. The implemented system uses:

- `open-spaced-repetition/ts-fsrs`: scheduling engine.
- `Nar101/learn-anything`: evidence integrity, hint-aware assessment semantics, transfer, and delayed-retrieval rules.
- `mordor-forge/study-skill`: restart-safe workspace behavior and short due-review warm-ups.
- `kartikth40/interview-sim`: interview state-machine ideas and weakness lifecycle.
- `ChenChenyaqi/learn-anything`: coding-exercise workflow patterns.

These sources informed specific contracts; Learning OS keeps one coherent local kernel rather than merging their runtimes.

## Core model

The central unit is a **learning objective**, not a scalar concept score.

A learning objective is approximately:

```text
concept × capability
```

For example, a transactions topic may instantiate only the capabilities that matter to the learner's goal:

```text
transactions:explain
transactions:predict
transactions:implement
transactions:debug
```

Do not generate the full concept/capability Cartesian product automatically.

Each objective accumulates append-only observable evidence. That evidence is authoritative. Current readiness, historical-highest readiness, transfer/durability state, blockers, and broad weakness signals are rebuildable projections over the evidence history.

```text
attempt
  ↓
assessment
  ↓
evidence event
  ↓
proficiency / misconception / weakness projections
  ↓
ReviewRatingMapper
  ↓
FSRS
```

FSRS answers **when** another valid retrieval is useful. The Learning OS decides **what kind of encounter** should happen next.

## Teacher portability

ChatGPT is the preferred V1 interactive teacher, but it is not part of the kernel's durable semantics. The teacher is a replaceable client of the Learning OS contract. Codex, OpenCode, AGY, or another compatible agent may replace ChatGPT later without migrating learner state.

Use one active teacher/orchestrator at a time in V1. Durable objectives, challenges, attempts, evidence, projections, scheduling, and resumable session state belong to the kernel rather than to a provider's conversation history or private memory.

## Running Learning OS

Requires Node.js >=22 and npm. Install dependencies once, then create or onboard a learner profile:

```bash
npm ci
npm run tutor -- profile create "My Profile"
npm run tutor -- onboard
npm run tutor -- profile list
npm run tutor -- today <goal-id>
```

Managed profiles keep separate SQLite learner state under `data/profiles/`; reusable Markdown curriculum stays shared under `knowledge/`. ChatGPT or another compatible teacher can use `createTeacherWorkspace()` for pre-profile onboarding and `createTeacherKernel(db)` after a profile is open. The sibling `../job-hunter` and `../ai-feeds` integrations remain optional.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system boundaries and runtime flow.
- [`docs/evidence-model.md`](docs/evidence-model.md) — objective, evidence, proficiency, weakness, and scheduling semantics.
- [`docs/kernel-contracts.md`](docs/kernel-contracts.md) — V1 logical schema, projection rules, challenge/assessment envelopes, scheduler policy, `tutor today`, and teacher-agent↔kernel protocol.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — staged fork plan.
- [`docs/research/source-comparison.md`](docs/research/source-comparison.md) — what we intend to reuse from existing projects.
- [`docs/decisions/0001-fork-generic-tutor.md`](docs/decisions/0001-fork-generic-tutor.md) — fork and composition decision.
- [`docs/decisions/0002-evidence-is-authoritative.md`](docs/decisions/0002-evidence-is-authoritative.md) — evidence/projection boundary.
- [`docs/decisions/0003-scheduler-input-policy.md`](docs/decisions/0003-scheduler-input-policy.md) — versioned evidence→FSRS mapping and legacy scheduler migration policy.
- [`docs/decisions/0004-teacher-agent-portability.md`](docs/decisions/0004-teacher-agent-portability.md) — ChatGPT-first V1 teacher experience with agent-agnostic durable state and protocol.

### Document authority

If documents drift, use this order:

```text
accepted ADRs
  ↓
docs/kernel-contracts.md
  ↓
docs/architecture.md + docs/evidence-model.md
  ↓
docs/implementation-plan.md
  ↓
docs/research/*
```

Research notes describe source material; they do not override Learning OS decisions. When implementation discovers a contradiction, update the governing ADR/contract first and then bring the explanatory/plan docs back into sync.

## Non-goals for the first usable version

Do not build these until the evidence loop works in real use:

- a dashboard rewrite;
- voice interaction;
- Monaco/Judge0-style interview UI;
- Bayesian Knowledge Tracing;
- multi-agent orchestration;
- broad academic course-authoring infrastructure;
- a new spaced-repetition algorithm.

The first milestone should be capable of learning, practicing, debugging, retrieving, and interviewing against the same durable evidence model.

## Repository strategy and provenance

`/home/hamza/repo/learning-os` is the product working tree. Its Git graph preserves both the Learning OS design lineage and the complete reachable ancestry of `alienz-dev/generic-tutor` at pinned upstream commit `2fffb72201aba055a4c270e2fddb29352edf2efb` from `https://github.com/alienz-dev/generic-tutor.git`.

The repository preserves the pinned upstream ancestry and its declared MIT package metadata while publishing the current Learning OS implementation as its own Git history.
