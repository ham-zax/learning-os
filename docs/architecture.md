# Architecture

## Goal

Build a learning kernel that can answer three questions reliably:

1. What has the learner actually demonstrated?
2. What should they do next?
3. When should the same objective be retrieved again?

The system must keep those questions separate. Grading, task selection, and spaced scheduling are related but not the same responsibility.

## System boundary

```text
                Teacher Agent / CLI
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

## Learner profile and onboarding boundary

Managed learners use one SQLite database per profile under ignored local `data/`; the repository `knowledge/` tree remains one shared curriculum library. The profile resolver chooses which learner database the kernel receives, so goals, imported concept metadata, objectives, sessions, attempts, evidence, weaknesses, scheduling, and resumable state cannot mix across learners.

Onboarding begins outside every learner database. Structured intake and the deterministic proposal are draft planning input until the learner explicitly confirms the exact proposal. Confirmed application then provisions a new unselected profile, materializes only the included curriculum metadata plus required prerequisite closure, creates the dedicated topic-backed goal, activates sparse objective requirements, and persists purpose/time/initial-strategy/diagnostic planning metadata. Only after that configuration succeeds is the profile selected.

Resume/JD/self-report claims never initialize proficiency. Newly activated objectives retain ordinary `unknown` readiness with untested transfer/durability and no review card until learner attempts and assessments produce evidence. A replacement teacher reconstructs the confirmed preparation purpose, time defaults, initial strategies, pending diagnostic intent, and actual current evidence state from the profile database; raw documents or prior chat history are not required.

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

An append-only objective-specific assessment record. It records the frozen task/rubric identity, learner response or artifact reference, assessment basis, derived objective-specific hint level, novelty, kernel-computed delay, evaluator, result, and rationale needed to audit later conclusions.

Evidence validity is authoritative for every derived consequence. Invalidating or restoring evidence must deterministically change proficiency, misconception/weakness state, and scheduler replay without rewriting the original event.

### Hint observation

Append-only record of decisive help scoped to one objective, frozen criterion IDs, or all targets of an attempt. The final evidence event for each objective derives its own highest relevant hint level.

### Exposure event

Append-only record that the learner was materially re-exposed to an objective through an explanation, answer reveal, worked example, corrective feedback, or solution walkthrough. Together with prior targeted attempts, this is the durable owner of delayed-retrieval timing.

### Objective proficiency projection

A rebuildable materialized view derived from evidence. V1 stores three orthogonal dimensions:

```text
readiness:   unknown | exposed | guided | independent
transfer:    untested | not_demonstrated | demonstrated | contradicted
durability:  untested | not_demonstrated | demonstrated | contradicted
```

`transfer` and `durability` are not later rungs in the readiness ladder. A convenience UI may display `transferable` or `durable`, but the durable projection keeps these dimensions separate. Later contradictory evidence can lower current readiness or contradict transfer/durability while historical evidence remains intact.

Persist the current projection for efficient reads, but treat evidence as the source of truth.

### Misconception

An explicit durable semantic error worth retesting, such as confusing transaction atomicity with serialization. Observed/cleared history is append-only and inherits validity from its source evidence, so invalidating evidence also removes the corresponding misconception observation from effective replay.

### Weakness projection

A rebuildable summary of repeated failure patterns used for challenge selection. A lifecycle such as `new → recurring → improving → resolved → retest` may be materialized for efficient selection, but it must be explainable from evidence and misconception history rather than becoming an independent truth source.

### Review card

FSRS memory state associated with a learning objective. The card is a rebuildable cache over effective `review_events`; a review event is effective only while its source evidence remains valid.

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

The mapper receives already-assessed evidence and translates only qualifying retrieval into scheduler ratings. V1 accepts answer-hidden, gradable, objective-specific L0 retrieval/application evidence (with deterministic verification when the frozen task requires execution) and maps `incorrect → Again`, `partially_correct → Hard`, and `correct → Good`. V1 does not emit `Easy`. FSRS must not interpret pedagogical concepts such as interview mode, transfer distance, hint provenance, or misconception semantics.

### Correction/replay owns causal consistency

Evidence correction is not local to proficiency. Invalidating or restoring evidence atomically rebuilds every affected projection and the FSRS card. Scheduler replay uses only review events whose source evidence is currently effective; misconception observations follow the same source-validity rule.

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

## Teacher / agent boundary

The interactive teacher is a replaceable client over durable Learning OS state, not the source of truth.

ChatGPT is the preferred V1 teacher because it can conduct the learning dialogue while working against the learner's real WSL environment. That preference must not appear in persistent learning semantics or require ChatGPT-specific state.

A fresh compatible agent should be able to resume by reading persisted topic, objective, frozen challenge version, attempt, hint/exposure history, evidence, misconception, derived weakness/proficiency projections, scheduling, and pending-session state. Critical continuity must not depend on ChatGPT history, another provider's private memory, or provider-specific tool transcripts.

Use one active teacher/orchestrator at a time in V1. Codex, OpenCode, AGY, or another agent may later replace ChatGPT by using the same kernel protocol. They may also act as bounded execution workers without becoming additional sources of learner truth. Do not build a generic plugin or multi-agent framework merely to achieve portability.

## First-version runtime target

The smallest useful runtime should support:

```text
concepts
+ learning objectives
+ append-only evidence + evidence revisions
+ objective-scoped hint and exposure history
+ rebuildable proficiency projection
+ misconceptions + derived weakness projection
+ effective review-event replay through ReviewRatingMapper
+ FSRS cards
+ challenge selection
+ today command
+ one workflow that can explain, trace, implement, debug, and interview
```

Everything else is secondary until this loop proves useful in repeated sessions.