# ADR 0002: Evidence is authoritative; proficiency is a rebuildable projection

**Status:** Accepted

## Context

A programming learner can demonstrate different levels of performance on the same objective depending on hints, task surface, delay, execution evidence, and misconceptions. A monotonic state machine such as `unknown → exposed → guided → independent → transferable → durable` cannot faithfully represent contradictory later evidence.

The scheduler has a different responsibility. `ts-fsrs` can estimate when a memory should be retrieved again, but it does not understand programming-task semantics such as debugging, transfer distance, interview mode, hint dependence, or causal misconceptions.

## Decision

Use append-only `EvidenceEvent` records as the authoritative learner-history record. Keep explicit misconception records because they encode semantic errors worth retesting.

Persist current readiness, historical-highest readiness, transfer state, durability state, blockers, and broad weakness/lifecycle summaries only as rebuildable materialized projections over evidence and misconception history.

V1 keeps these dimensions separate:

```text
readiness:   unknown | exposed | guided | independent
transfer:    untested | demonstrated | contradicted
durability:  untested | demonstrated | contradicted
```

A human-facing summary may still say `transferable` or `durable`, but those labels are interpretations rather than irreversible transitions. Later failure may lower readiness or contradict transfer/durability without deleting earlier qualifying evidence.

Use this scheduling boundary:

```text
Attempt
  ↓
Assessment
  ↓
EvidenceEvent
  ↓
ReviewRatingMapper
  ↓
Again | Hard | Good
  ↓
ts-fsrs
```

`ReviewRatingMapper` is the only component that translates pedagogical evidence into scheduler ratings. The FSRS adapter receives ratings and card state; it does not inspect interview mode, hint levels, novelty, transfer distance, misconceptions, or rubric semantics.

Only evidence that qualifies as valid retrieval updates FSRS. Invalid retrieval evidence may still update proficiency projections, misconceptions, and challenge selection.

## Consequences

### Positive

- Every current learner-state claim can be traced back to concrete evidence.
- Projection logic can improve without rewriting history.
- Contradictory evidence and regression remain representable.
- Transfer and delayed recall remain observable evidence properties rather than permanent badges.
- FSRS remains a replaceable timing component instead of becoming the learning model.
- Broad weakness state cannot silently diverge from the evidence that supposedly caused it.

### Negative

- Projection code must be deterministic and replayable.
- Schema and APIs must preserve more provenance than a scalar score model.
- Cached/materialized projections need a rebuild path and versioning strategy when projection rules change.
- The evidence-to-FSRS mapping becomes an explicit policy that must be documented and revised deliberately.

## Initial policy

- Use a small extensible capability registry and instantiate only meaningful `concept × capability` objectives.
- Preserve task/rubric identity and version, attempt identity, artifact reference when applicable, evaluator type, assessment basis, hint use, novelty, delay, result, and rationale.
- Treat learner confidence as calibration metadata, never correctness authority.
- Use deterministic execution evidence where possible and frozen rubrics where judgment is required.
- Use `docs/decisions/0003-scheduler-input-policy.md` as the authoritative scheduler-input policy: only valid L0 retrieval reaches FSRS; V1 maps `incorrect → Again`, `partially_correct → Hard`, and `correct → Good`, and emits no `Easy` rating.
