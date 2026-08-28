# Learning OS documentation

Use this page to choose the right documentation for what you are trying to do.

## Use the product

- [Getting started](getting-started.md) — install Learning OS, onboard a learner, manage profiles, and run a daily mission.
- [Customizing Learning OS](customization.md) — add your own curriculum, local defaults, profiles, and conversational teacher integration.

If you only want to try the product, start with `getting-started.md`. You do not need to understand the evidence kernel first.

## Understand the learning model

- [Architecture](architecture.md) — product boundaries and runtime flow.
- [Evidence model](evidence-model.md) — learning objectives, evidence, readiness, transfer, durability, misconceptions, weaknesses, and scheduling semantics.
- [Kernel contracts](kernel-contracts.md) — authoritative V1 schema and operation contracts.

Read these before changing how mastery, assessment, scheduling, or challenge selection works.

## Understand why the system is shaped this way

- [Implementation plan](implementation-plan.md) — staged migration from the original Generic Tutor architecture.
- [Source comparison](research/source-comparison.md) — ideas evaluated from other learning/interview projects.
- [ADR 0001: fork Generic Tutor](decisions/0001-fork-generic-tutor.md)
- [ADR 0002: evidence is authoritative](decisions/0002-evidence-is-authoritative.md)
- [ADR 0003: scheduler input policy](decisions/0003-scheduler-input-policy.md)
- [ADR 0004: teacher-agent portability](decisions/0004-teacher-agent-portability.md)

## Document authority

If implementation-facing documents disagree, use this order:

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

The user-facing guides explain how to use the current implementation. They should be updated when commands or product behavior change, but they do not override the kernel contracts.
