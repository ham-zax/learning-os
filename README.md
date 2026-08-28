# Learning OS

Learning OS is an evidence-driven programming learning system built around one rule: **a learner should advance because they demonstrated a capability, not because content was shown or they reported confidence.**

This repository now contains the preserved `generic-tutor` TypeScript/SQLite application shell plus the Learning OS design contracts. The evidence-driven kernel is not implemented yet; surviving upstream scalar mastery and SM-2 behavior is legacy compatibility, not the target Learning OS source of learner truth.

## Current baseline

Learning OS preserves `alienz-dev/generic-tutor` for its TypeScript/SQLite application shell and is replacing its learning-state core rather than building a tutor from zero.

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

## Teacher portability

ChatGPT is the preferred V1 interactive teacher, but it is not part of the kernel's durable semantics. The teacher is a replaceable client of the Learning OS contract. Codex, OpenCode, AGY, or another compatible agent may replace ChatGPT later without migrating learner state.

Use one active teacher/orchestrator at a time in V1. Durable objectives, challenges, attempts, evidence, projections, scheduling, and resumable session state belong to the kernel rather than to a provider's conversation history or private memory.

## Operational baseline

The inherited CLI requires Node.js >=22 and npm. The Phase 0 standalone baseline keeps the existing npm/TypeScript workflow:

```bash
npm install
npm run tutor -- stats
npm run build
node dist/cli.js stats
```

Surviving CLI surfaces include topic sessions, ingestion, gap/signal sync, interview drills, due-review queries, stats, and planning. The sibling `../job-hunter` and `../ai-feeds` integrations remain optional integration points; they do not define Learning OS learner-state semantics.

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

Upstream `package.json` and README metadata declare MIT, but the inspected pinned repository has no root `LICENSE` text or copyright notice. Public redistribution and package publication therefore remain separately gated on provenance/license clarification; this repository does not manufacture missing notice text, ownership, or transfer history.
