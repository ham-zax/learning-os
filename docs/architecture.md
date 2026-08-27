# Architecture

## Goal

Build a learning kernel that can answer three questions reliably:

1. What has the learner actually demonstrated?
2. What should they do next?
3. When should the same objective be retrieved again?

The system must keep those questions separate. Grading, task selection, and spaced scheduling are related but not the same responsibility.

## System boundary

```text
                  Agent / ChatGPT / CLI
                         |
             teach / lab / interview
                         |
                         v
                Session Orchestrator
                         |
          +--------------+--------------+
          |                             |
          v                             v
   Challenge Selector             Assessment
          |                             |
          v                             v
   Problem / Scenario  ------->  Evidence Event
                                        |
                                        v
                              Evidence Projection
                         +--------------+--------------+
                         |                             |
                         v                             v
                 Objective Projection          Weakness Signals
                         |
                         v
                 ReviewRatingMapper
                         |
                         v
                   Review Event
                         |
                         v
                        FSRS
                         |
                         v
                 Next due objective
```

## Durable entities

### Topic

A learning domain or goal container, for example `backend-interview` or `javascript-runtime`.

### Concept

A subject-matter node such as transactions, authorization, event loop, connection pools, or idempotency. Concepts may have prerequisite relationships.

### Learning objective

The sparse `concept × capability` unit for which evidence, projections, and scheduling are tracked.

```text
learning objective = concept × capability
```

Initial capability vocabulary:

- `explain`
- `predict`
- `implement`
- `debug`
- `design`

This list should remain small. Use a small extensible registry, and instantiate only the capabilities that apply to a concept and learner goal. Do not create the full Cartesian product automatically. Add a capability only when it changes challenge selection or evidence interpretation.

### Problem / challenge

A task presented to the learner. A problem may target one or several objectives and may be delivered as practice, review, interview, or mock.

Delivery context is not a capability or proficiency claim.

### Evidence event

An append-only record of what happened on a specific task. It records the task/rubric identity, learner response or artifact, assessment basis, hint use, novelty, delay, evaluator, result, and rationale needed to audit later conclusions.

Evidence events are authoritative. Derived summaries must be rebuildable from them plus explicit misconception records.

### Objective proficiency projection

A rebuildable materialized view derived from evidence. V1 stores three orthogonal dimensions:

```text
readiness:   unknown | exposed | guided | independent
transfer:    untested | demonstrated | contradicted
durability:  untested | demonstrated | contradicted
```

`transfer` and `durability` are not later rungs in the readiness ladder. A convenience UI may display `transferable` or `durable`, but the durable projection keeps these dimensions separate. Later contradictory evidence can lower current readiness or contradict transfer/durability while historical evidence remains intact.

Persist the current projection for efficient reads, but treat evidence as the source of truth.

### Misconception

An explicit durable semantic error worth retesting, such as confusing transaction atomicity with serialization. Misconceptions may be active or cleared, but their evidence history is retained.

### Weakness projection

A rebuildable summary of repeated failure patterns used for challenge selection. A lifecycle such as `new → recurring → improving → resolved → retest` may be materialized for efficient selection, but it must be explainable from evidence and misconception history rather than becoming an independent truth source.

### Review card

FSRS memory state associated with a learning objective. FSRS is allowed to schedule only evidence that qualifies as valid retrieval.

## Responsibility boundaries

### Assessment owns correctness

Assessment evaluates a learner response against a frozen answer key, executable check, or rubric. Self-confidence may be recorded but never determines correctness.

### Evidence projection owns proficiency interpretation

It interprets the assessment result together with hint level, novelty, delay, and active misconceptions. It never overwrites evidence.

Examples:

- correct after decisive hints: contributes guided evidence, not independent evidence;
- correct on a materially changed surface: contributes transfer evidence;
- correct after a real delay without seeing the answer first: contributes durable-retrieval evidence;
- correct result with a decisive causal misconception: does not justify a strong proficiency projection.

### ReviewRatingMapper owns evidence-to-scheduler translation

The mapper receives already-assessed evidence and translates only qualifying retrieval into scheduler ratings. V1 accepts answer-hidden, gradable, L0 retrieval/application evidence (with deterministic verification when the frozen task requires execution) and maps `incorrect → Again`, `partially_correct → Hard`, and `correct → Good`. V1 does not emit `Easy`. FSRS must not interpret pedagogical concepts such as interview mode, transfer distance, or misconception semantics.

### FSRS owns timing

FSRS answers when another retrieval attempt is useful. It does not decide:

- what capability is weak;
- whether an answer was valid evidence;
- which task form or delivery context should be used;
- whether interview urgency should override ordinary review ordering.

### Challenge selector owns task form

Given due objectives, derived weakness signals, goal urgency, prerequisites, and recent task history, the selector chooses the next challenge.

A due `transactions:debug` objective should not repeatedly receive a definition question. It may receive a race-condition scenario, a broken code path, or an interview transfer problem.

## Session shape

A default programming-learning session should be able to contain:

```text
short due retrieval
        +
new learning or targeted reinforcement
        +
executable application
        +
transfer/interview pressure when useful
```

Reviews should normally be embedded into useful sessions rather than isolated into a large flashcard block.

## `today` selection

The first scheduler-facing user experience should answer: **What should I do today?**

Use priority tiers before designing a complicated weighted formula:

1. overdue core objective;
2. recurring or retest weakness;
3. due core objective;
4. deadline-critical prerequisite;
5. new high-value objective;
6. supporting objective.

Within a tier, rank using retrievability, prerequisite blocking, job/interview relevance, recent evidence, and task diversity. Bound review debt so overdue retrieval cannot consume the entire learning budget; preserve meaningful capacity for forward progress and application.

## Agent boundary

Agents are workers over durable state, not the source of truth.

A fresh agent should be able to resume by reading persisted topic, objective, evidence, misconception, derived weakness/proficiency projections, scheduling, and pending-session state. Critical continuity must not depend on chat memory.

The first implementation should use one agent/orchestrator. Separate agents are justified only if a concrete failure mode requires isolation.

## First-version runtime target

The smallest useful runtime should support:

```text
concepts
+ learning objectives
+ append-only evidence
+ rebuildable proficiency projection
+ misconceptions + derived weakness projection
+ ReviewRatingMapper
+ FSRS cards
+ challenge selection
+ today command
+ one workflow that can explain, trace, implement, debug, and interview
```

Everything else is secondary until this loop proves useful in repeated sessions.