# Backend Systems Personalized Lesson Blueprint

This is a **personalized, source-controlled learning example**, not the default Learning OS curriculum and not authoritative runtime learner state.

It captures one concrete way to use Learning OS for a seven-day Backend Systems interview sprint while preserving the product boundary:

```text
Learning OS decides:
what / when / evidence / readiness / next objective

Teacher pedagogy decides:
how to make the selected interaction cognitively valuable
```

The live learner database remains under local `data/` and is not committed. This document is intentionally portable so the learning setup, lesson shape, and pedagogical intent are available from any clone of the repository. A fresh teacher must still resolve the live profile through Learning OS before making sequencing, evidence, readiness, review, or next-action decisions.

## Personalized goal

```text
Profile: Backend Systems
Goal: 7-Day Backend Systems Interview Sprint
Target role: Backend Engineer
Purpose: interview
Study budget: 270 minutes/day x 7 days
Target readiness: independent
Transfer required: yes
Durability required: yes
```

The original goal deadline for this snapshot is September 4, 2026. Treat that date as historical example data when reusing this blueprint later; a new learner run should use the learner's actual current deadline.

## Active objective set

The personalized profile activates these core objective/capability pairs:

1. `runtime-request-execution-and-concurrency:predict`
2. `resource-saturation-and-backpressure:predict`
3. `database-transactions-and-concurrent-correctness:predict`
4. `database-transactions-and-concurrent-correctness:implement`
5. `database-connection-and-resource-pressure:debug`
6. `state-ownership-and-cache-consistency:predict`
7. `state-ownership-and-cache-consistency:design`
8. `queue-delivery-and-worker-failure:predict`
9. `retries-idempotency-and-uncertain-outcomes:predict`
10. `retries-idempotency-and-uncertain-outcomes:design`
11. `authorization-and-tenant-isolation:design`
12. `long-lived-connection-authorization:design`
13. `production-latency-localization:debug`
14. `architecture-boundaries-and-scaling:design`
15. `replication-and-distributed-consistency:predict`
16. `replication-and-distributed-consistency:design`

At the time this blueprint was captured, all 16 were still pending baseline diagnostics with `unknown` readiness and untested transfer/durability. That status is an example snapshot only; never use it instead of querying the current learner profile.

## Prerequisite diagnostic gaps

The profile also exposed six prerequisite diagnostics that may block later objectives until Learning OS clears them:

- `runtime-request-execution-and-concurrency:explain`
- `resource-saturation-and-backpressure:explain`
- `queue-delivery-and-worker-failure:explain`
- `retries-idempotency-and-uncertain-outcomes:explain`
- `state-ownership-and-cache-consistency:explain`
- `authorization-and-tenant-isolation:explain`

These are not a manually enforced study order. The teacher must let Learning OS decide which prerequisite or target objective is actually next.

# Seven-day lesson shape

The day labels below are a **human learning map**, not a replacement selector. They describe the intended conceptual arc. Within each day, Learning OS remains authoritative for the concrete next objective and challenge.

## Day 1 — Runtime, concurrency, saturation, backpressure

### Mental model

Build a request-path system map:

```text
client
-> load balancer
-> application request
-> worker/event loop/thread
-> queue/wait point
-> downstream call
-> response
```

Annotate only the dimensions needed by the selected objective:

- concurrency owner;
- synchronous vs asynchronous boundaries;
- queueing points;
- resource ceilings;
- backpressure signals;
- observable metrics.

### High-value interaction

Use **prediction before reveal**.

Example shape:

> Request arrival rate rises while service time stays constant. Predict which queue or resource saturates first and what metric changes before p99 latency explodes.

Require a committed prediction before showing decisive metrics.

If the learner fails coherently, use:

```text
expected result
-> assumption
-> contradicting observation
-> corrected relationship
-> reconstructed model
```

Do not immediately invent another variant; Learning OS owns the next move.

## Day 2 — PostgreSQL concurrency and connection pressure

### Mental model

Construct two coupled models:

```text
transaction model:
read/write set
-> concurrent interleaving
-> lock/isolation behavior
-> invariant outcome

capacity model:
requests
-> pool waiters
-> checked-out connections
-> DB sessions/workers
-> locks / CPU / IO
```

### High-value interaction

Prefer scenarios where an incorrect model predicts a different observable result from the correct one.

Examples:

- atomicity vs isolation;
- lost update under concurrent read-modify-write;
- pool saturation while database CPU is not saturated;
- longer transaction duration with unchanged request rate.

For implementation objectives, the teacher can move from model/prediction to code or pseudocode, but must freeze assessable criteria before the answer.

## Day 3 — State ownership, sessions, caching

### Mental model

Ask the learner to identify:

- authoritative state owner;
- replicas/caches;
- invalidation path;
- stale-read window;
- session ownership;
- cross-instance behavior;
- failure recovery.

### High-value interaction

Use **boundary testing**:

> This works on one process. What assumption breaks when there are eight application replicas?

Then perturb one condition at a time: failover, concurrent write, cache lag, sticky-session removal, or multiple regions.

The goal is not technology naming. The goal is a transferable model of ownership and visibility.

## Day 4 — Queues, retries, idempotency, partial failure

### Mental model

Map:

```text
producer
-> enqueue acknowledgement
-> broker state
-> delivery
-> worker side effect
-> acknowledgement
-> retry / redelivery
```

Mark every point where the system can be uncertain about whether a side effect occurred.

### High-value interaction

Use adversarial falsification:

> Your design is "safe to retry." Identify the state variables that must make that claim true, then simulate a crash at each boundary.

A strong challenge distinguishes:

- delivery guarantee;
- processing guarantee;
- side-effect idempotency;
- deduplication identity;
- retry policy;
- poison-message handling;
- observability.

## Day 5 — Authorization, tenant isolation, long-lived connections

### Mental model

Build a trust/authorization map:

```text
identity source
-> authentication
-> tenant context
-> authorization decision
-> data access boundary
-> background work / async propagation
-> long-lived connection revalidation
```

### High-value interaction

Separate **technical evidence** from **interview signal**.

Technical criteria can assess whether the design preserves tenant isolation and authorization invariants.

After technical assessment, interview feedback may separately comment on whether the answer:

- clarified assumptions;
- named the state owner/invariant;
- explained causal boundaries;
- handled revocation/failure;
- communicated uncertainty precisely.

Interview-signal feedback must not change readiness, evidence result, transfer, durability, weaknesses, review timing, or FSRS.

## Day 6 — Production latency localization and architecture boundaries

### Mental model

For debugging, require competing hypotheses rather than a technology list.

Example:

```text
observed symptom
-> hypothesis A
-> hypothesis B
-> one discriminating observation
-> localization
-> repair only after localization
```

For architecture work, ask the learner to construct the smallest useful system map and expose:

- ownership boundaries;
- synchronous dependencies;
- queues;
- resource bottlenecks;
- failure propagation;
- observability;
- scaling constraint.

### High-value interaction

Ask:

> What single observation would most strongly distinguish your top two hypotheses?

This trains evidence-driven debugging rather than speculative repair.

## Day 7 — Replication, distributed consistency, integration, interview transfer

### Mental model

Tie together:

- ownership;
- replication;
- stale visibility;
- write coordination;
- retries;
- uncertain outcomes;
- failure recovery;
- capacity and latency trade-offs.

### High-value interaction

Use changed-surface transfer only when Learning OS selects transfer work.

A transfer scenario should change enough of the surface that the learner must recognize the underlying principle rather than pattern-match the previous answer.

Examples of legitimate surface changes:

- single region -> multi-region;
- HTTP request -> background worker;
- database row -> replicated cache entry;
- synchronous mutation -> queued command;
- process failure -> network partition;
- known success/failure -> uncertain outcome.

# Default pedagogical repertoire for this blueprint

Use these as teacher techniques, not kernel state or mandatory steps:

```text
orient
retrieve
construct model
predict / commit
observe
explain
falsify / break
localize
repair
reconstruct
transfer
```

The shortest interaction that creates useful evidence is preferred. Do not force every operator into every lesson.

## Progressive scaffolding

A useful retreat pattern is:

```text
teacher-provided model
-> co-constructed model
-> prompted learner construction
-> independent learner construction
-> learner independently chooses the reasoning lens
```

Map worked examples and hints truthfully:

- **I do** -> exposure/worked example;
- **We do** -> guided or hinted work;
- **You do** -> fresh answer-hidden attempt when independent evidence is intended.

After decisive exposure, use a fresh changed surface before treating later performance as clean independent evidence.

## Failure handling

Do not merely replace a wrong answer with the correct one.

When the learner has a coherent causal error:

1. recover what they expected;
2. identify the assumption that produced that expectation;
3. identify the observation that contradicts it;
4. repair the smallest faulty relationship;
5. have the learner reconstruct the model;
6. let Learning OS decide what comes next.

If the error matches a registered misconception, assessment may record that misconception ID. Otherwise use a precise `observedErrors` category rather than inventing a persistent misconception from conversation.

## Recommended-next-move UX

The teacher must not derive its own next lesson from readiness or recent performance.

Correct pattern:

```text
Learning OS selects next move
-> teacher explains why it matters in learner language
-> learner confirms
-> teacher executes that already-selected move
```

The learner can still explicitly request explanation, pause, another example, or redirection; state/evidence must remain truthful.

# How to use this portable example

From any clone of the repository:

1. read `docs/teacher-agent-protocol.md`;
2. load the `learning-os-teacher` Skill when available;
3. use this document as a personalized lesson/curriculum reference;
4. resolve the actual learner profile through the public Learning OS API;
5. let Learning OS determine current diagnostics, prerequisites, readiness, evidence, review timing, and next work;
6. use the lesson shapes and pedagogical operators here to instantiate the selected interaction.

If the live `backend-systems` profile is absent on another machine, this document is sufficient as a **reconstruction reference**, but it is not currently an automatic profile import format and does not preserve live evidence/progress by itself.

That distinction is intentional: source control carries the reusable personalized learning design; Learning OS carries authoritative learner state.
