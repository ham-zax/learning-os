# Learning OS

Learning OS is an evidence-driven programming learning system built around one rule: **a learner should advance because they demonstrated a capability, not because content was shown or they reported confidence.**

This repository currently contains design documentation only. No application architecture is considered final until the evidence model and execution boundaries are stable.

## Current direction

The working direction is to fork `alienz-dev/generic-tutor` for its TypeScript/SQLite application shell, then replace its learning-state core rather than build a tutor from zero.

We plan to reuse ideas from other projects selectively:

- `open-spaced-repetition/ts-fsrs`: scheduling engine.
- `Nar101/learn-anything`: evidence integrity, hint-aware assessment semantics, transfer, and delayed-retrieval rules.
- `mordor-forge/study-skill`: restart-safe workspace behavior and short due-review warm-ups.
- `kartikth40/interview-sim`: interview state-machine ideas and weakness lifecycle.
- `ChenChenyaqi/learn-anything`: coding-exercise workflow patterns.

The goal is not to merge these repositories. The goal is to preserve `generic-tutor`'s useful shell while porting only the abstractions that improve learning evidence and task selection.

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

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system boundaries and runtime flow.
- [`docs/evidence-model.md`](docs/evidence-model.md) — objective, evidence, proficiency, weakness, and scheduling semantics.
- [`docs/kernel-contracts.md`](docs/kernel-contracts.md) — V1 logical schema, projection rules, challenge/assessment envelopes, scheduler policy, `tutor today`, and agent↔kernel protocol.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — staged fork plan.
- [`docs/research/source-comparison.md`](docs/research/source-comparison.md) — what we intend to reuse from existing projects.
- [`docs/decisions/0001-fork-generic-tutor.md`](docs/decisions/0001-fork-generic-tutor.md) — fork and composition decision.
- [`docs/decisions/0002-evidence-is-authoritative.md`](docs/decisions/0002-evidence-is-authoritative.md) — evidence/projection boundary.
- [`docs/decisions/0003-scheduler-input-policy.md`](docs/decisions/0003-scheduler-input-policy.md) — versioned evidence→FSRS mapping and legacy scheduler migration policy.

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

## Repository strategy

`/home/hamza/repo/learning-os` is intended to become the actual product working tree, not a permanent documentation-only sibling of the fork. When implementation begins, preserve `generic-tutor` upstream history and provenance rather than copying its source into an unrelated history.