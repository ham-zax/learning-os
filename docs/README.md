# Learning OS documentation

Learning OS is easiest to use through an AI agent that can access the repository/folder. Start with the learner-facing guides; architecture and ADRs are for people extending the kernel or integrating another teacher client.

## Start learning

- [Getting started](getting-started.md) — clone Learning OS, connect a filesystem-capable AI agent, onboard or resume a learner, and understand the CLI fallback.
- [Coding revision courses](coding-courses.md) — source-linked frontend/backend routes, selective practical work, one-episode continuation, and existing-profile integration.
- [Technical revision teaching](technical-revision-teacher.md) — small bidirectional engineering cases, focused repair, and compact personal notes.
- [Customizing Learning OS](customization.md) — bring your own curriculum, local defaults, profiles, and agent integration.
- [Backend Systems personalized lesson example](examples/backend-systems-personalized-lesson.md) — an example of source-controlled learning plans coexisting with live evidence-driven learner state.

## Integrate an AI teacher

- [Teacher-agent protocol](teacher-agent-protocol.md) — normative conversational behavior and learner-state boundaries.
- [`learning-os-teacher` Skill](../skills/learning-os-teacher/SKILL.md) — portable agent instructions and progressively loaded pedagogy playbooks.
- [Durable question presentation](question-presentation-design.md) — persisted task context/question delivery across response collection, reconstruction, and fresh-session handoff.
- [Teacher pedagogy design](teacher-pedagogy-design.md) — rationale behind the evidence-safe teaching repertoire and challenge-authoring guidance.
- [Flexible learning runtime design](flexible-learning-runtime-design.md) — runtime design for adaptive episodes, time/FSRS ownership, prerequisite repair, and evidence-safe replanning.

## Understand the learning model

- [Architecture](architecture.md) — product boundaries and runtime flow.
- [Evidence model](evidence-model.md) — objectives, evidence, readiness, transfer, durability, misconceptions, weaknesses, and scheduling semantics.
- [Kernel contracts](kernel-contracts.md) — authoritative schema and operation contracts.
- [Source comparison](research/source-comparison.md) — external ideas evaluated for the product.
- [Design decisions](decisions/) — accepted architectural decisions and provenance.

## Document authority

If implementation-facing documents disagree, use this order:

```text
accepted ADRs
  ↓
docs/kernel-contracts.md
  ↓
docs/architecture.md + docs/evidence-model.md
  ↓
approved focused design docs
  ↓
docs/research/*
```

User-facing guides describe the current product. They should change with current behavior but do not override kernel contracts.
