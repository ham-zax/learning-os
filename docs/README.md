# Learning OS documentation

Learning OS is easiest to use through an AI agent that can access the repository/folder. Start with the learner-facing guides; the architecture and ADRs are for people extending the kernel or integrating a new teacher client.

## Start learning

- [Getting started](getting-started.md) — clone Learning OS, connect a filesystem-capable AI agent, onboard or resume a learner, and understand the CLI fallback.
- [Customizing Learning OS](customization.md) — bring your own curriculum, local defaults, profiles, and agent integration.
- [Backend Systems personalized lesson example](examples/backend-systems-personalized-lesson.md) — see how a source-controlled learning plan can coexist with live evidence-driven learner state.

If you only want to use the product, start with `getting-started.md`. You do not need to understand the evidence kernel or database schema first.

## Integrate an AI teacher

- [Teacher-agent protocol](teacher-agent-protocol.md) — normative rules for any compatible conversational agent so Learning OS retains ownership of learner state, sequencing, evidence, exposure, and next-action decisions.
- [`learning-os-teacher` Skill](../skills/learning-os-teacher/SKILL.md) — portable agent instructions and progressively loaded pedagogy playbooks for reasoning/retrieval, debugging/repair, problem-solving/implementation, and performance/interview work.
- [Teacher pedagogy design](teacher-pedagogy-design.md) — rationale behind the evidence-safe teaching repertoire and challenge-authoring guidance.

## Understand the learning model

- [Architecture](architecture.md) — product boundaries and runtime flow.
- [Evidence model](evidence-model.md) — learning objectives, evidence, readiness, transfer, durability, misconceptions, weaknesses, and scheduling semantics.
- [Kernel contracts](kernel-contracts.md) — authoritative V1 schema and operation contracts.

Read these before changing how mastery, assessment, scheduling, or challenge selection works.

## Understand why the system is shaped this way

- [Teacher pedagogy design](teacher-pedagogy-design.md) — rationale and detailed operator/challenge guidance behind the normative teacher-agent protocol. If wording conflicts, `teacher-agent-protocol.md` governs teacher behavior unless a higher-authority repository contract applies.
- [Teacher pedagogy implementation plan](teacher-pedagogy-implementation-plan.md) — completed first-wave protocol/Skill rollout and fresh-teacher dogfood, with product extensions kept evidence-gated.
- [Flexible learning runtime design](flexible-learning-runtime-design.md) — live-session pain points and V2 design for dynamic concept episodes, learner-visible teaching, speech-aware questioning, time/FSRS ownership, prerequisite repair, soft curriculum focus, and evidence-safe replanning.
- [Evidence Ecology implementation plan](evidence-ecology-implementation-plan.md) — current authority-transition/inspectable-evidence wave, deliberately avoiding speculative schema and selector expansion.
- [Implementation plan](implementation-plan.md) — staged migration from the original Generic Tutor architecture.
- [Source comparison](research/source-comparison.md) — ideas evaluated from other learning/interview projects.
- [ADR 0001: fork Generic Tutor](decisions/0001-fork-generic-tutor.md)
- [ADR 0002: evidence is authoritative](decisions/0002-evidence-is-authoritative.md)
- [ADR 0003: scheduler input policy](decisions/0003-scheduler-input-policy.md)
- [ADR 0004: teacher-agent portability](decisions/0004-teacher-agent-portability.md)
- [ADR 0005: authority transitions](decisions/0005-authority-transitions.md)

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
