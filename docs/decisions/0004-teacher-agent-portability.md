# ADR 0004: Keep the Learning OS teacher agent-agnostic

**Status:** Accepted

## Context

The preferred V1 experience is to use ChatGPT as the interactive Learning OS teacher while it works against the learner's real WSL environment. Other capable local or coding agents such as Codex, OpenCode, or AGY may also be useful as the primary teacher or as execution workers.

The durable learning system must not depend on one vendor, model, chat history, proprietary agent memory, or agent-specific state format. Replacing the interactive agent must not fork learner state or require migration of the learning model.

At the same time, V1 does not need a plugin framework, agent router, or multi-agent runtime. Portability should come from a stable kernel contract, not from additional orchestration infrastructure.

## Decision

Treat the interactive teacher as a replaceable client of the Learning OS kernel.

ChatGPT is the preferred V1 teacher interface, not a kernel dependency.

Any teacher agent must use the same durable kernel operations and state:

```text
getTodayMission
registerChallenge
openAttempt
recordHintUse
recordExposure
submitAttempt
recordAssessment
reviseEvidence
resumeSession
```

The kernel owns objectives, frozen challenges, attempts, interaction provenance, evidence, projections, misconceptions, review history, scheduler state, and resumable session state. An agent may propose or evaluate work, but it must not keep authoritative learner state only in its own conversation or private memory.

Do not persist provider-specific identifiers or model-specific state as required semantics for learning behavior. Optional agent/model provenance may be recorded for audit, but changing the teacher must not change evidence interpretation, projection rules, scheduler behavior, or session correctness.

Use one active teacher/orchestrator at a time in V1. Codex, OpenCode, AGY, or another agent may replace ChatGPT later by implementing the same protocol. They may also be used as bounded execution workers without becoming additional sources of truth.

## Portability invariant

A fresh compatible agent must be able to continue the learner's session by reading kernel state alone.

It must not require:

```text
previous ChatGPT conversation history
ChatGPT-specific memory
Codex-specific state
OpenCode-specific state
AGY-specific state
provider-specific tool transcripts
```

The agent may use those sources as optional context when available, but correctness and continuity cannot depend on them.

## Consequences

### Positive

- The learner can change teacher agents without losing learning history.
- ChatGPT can be the primary V1 experience without locking the kernel to ChatGPT.
- Coding agents can be used as workers without creating parallel mastery or scheduler state.
- Agent experimentation remains cheap because the integration boundary is the existing kernel protocol.

### Negative

- Agent-specific features that cannot be represented through the kernel contract cannot become authoritative state automatically.
- A replacement teacher must implement the protocol correctly before it can drive the system safely.
- Some convenient provider-specific context may need to be treated as ephemeral rather than durable.

## Rejected alternatives

### Make ChatGPT-specific conversation state part of the kernel

Rejected because it would couple learner continuity to one product and make replacement agents second-class.

### Build a generic multi-agent/plugin framework in V1

Rejected because one teacher at a time is sufficient. A stable protocol gives the required portability without speculative orchestration infrastructure.

### Let each agent maintain its own learner model

Rejected because parallel learner models would diverge and violate the single durable source-of-truth design.
