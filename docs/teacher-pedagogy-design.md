# Learning OS Teacher Pedagogy Design

## Status

First teacher-pedagogy wave implemented and dogfooded. Later live use demonstrated the protocol-only consistency gap anticipated by Tasks 13–14, so Learning OS exposes a pure, non-durable teacher-side directive for the selected `ChallengeIntent`. A later simplicity review reduced that directive to four guardrails—prompt shape, scaffold level, commit-before-reveal, and question chunking—while reactive question decomposition and failure handling stay teacher-owned and use the existing hint/exposure lifecycle. Tasks 15–16 remain conditional. This design does not change learner-state authority, evidence semantics, scheduler behavior, or curriculum ownership.

## Problem

Learning OS already has strong learner-state and sequencing semantics:

- objectives are concept × capability;
- challenges and rubrics are frozen before the learner answers;
- hints and answer exposure are tracked;
- evidence is objective-specific and append-only;
- readiness, transfer, durability, misconceptions, weaknesses, and review timing are derived from durable state;
- the selector owns what kind of work should happen next;
- a fresh teacher can resume from persisted kernel state.

The weaker layer is the transformation from a selected `ChallengeIntent` into an excellent learning interaction.

Today a teacher can satisfy the kernel contract while still producing a mediocre interaction: define a concept, ask a generic question, correct the answer, and move on. The kernel can tell the teacher *what* needs work, but the teacher protocol does not yet provide a compact, evidence-aware repertoire for *how* to make the learner reason, expose a mental model, diagnose failure, repair that model, and transfer the repaired understanding.

This design adds that missing pedagogical layer without creating a second learner model.

## Goals

1. Make selected Learning OS work produce stronger causal, transferable understanding.
2. Make failures reveal and repair the learner's mental model instead of only correcting the surface answer.
3. Make systems-oriented learning explicitly exercise state ownership, flows, invariants, queues, bottlenecks, boundaries, and failure propagation when those representations are useful.
4. Make scaffolding decrease as durable evidence improves, while preserving the existing hint/exposure lifecycle.
5. Keep the learner-facing experience low-friction: one clear next move by default, with agency to request explanation, another example, a different challenge, or a pause.
6. Separate technical evidence from interview-performance feedback.
7. Preserve Learning OS as the sole authority for sequencing, mastery-related projections, weaknesses, review timing, and resumable learner state.
8. Avoid new kernel state until an observed teaching requirement cannot be represented by existing contracts.

First-wave scope is the replaceable AI teacher/agent experience. Existing built-in CLI presenters such as `generateExploreSequence()`, `generateTeachBackSession()`, and `generateQuizBatch()` are not being brought to pedagogy parity in this wave.

## Non-goals

- Do not introduce a prompt-owned mastery score, confidence score, knowledge map, or scheduler.
- Do not copy OmniLearner, OmniMentor, or Cognitive Mentor state blocks into Learning OS.
- Do not make every interaction Socratic.
- Do not withhold code by fixed turn count.
- Do not require narrative, embodiment, gamification, or visible dashboards.
- Do not treat one successful practice attempt as mastery.
- Do not let interview fluency alter technical correctness or readiness.
- Do not add challenge difficulty metadata in the first implementation wave.

## Source techniques being retained

The design extracts mechanisms from five high-signal prompt families.

### Socratic v2.5: interaction spine

Retain:

- prerequisite awareness;
- why/what before application when useful;
- prediction and rationale questions;
- plan before implementation for non-trivial tasks;
- systematic debugging through self-explanation, hypothesis, test, correction, and verification;
- reflection after success or failure;
- cumulative synthesis across concepts;
- `I do -> We do -> You do` scaffolding.

Replace its prompt-owned "mastery before progression" rule with Learning OS readiness, transfer, durability, weakness, and selector decisions.

### OmniMentor 2.4.2: guided discovery and boundaries

Retain:

- problem-first guided discovery;
- learner inference before formal naming when appropriate;
- explicit articulation and re-articulation;
- scope, trade-offs, pitfalls, alternatives, and "when not to use it";
- progressive independence;
- adaptive Socratic off-ramps when questioning stops being productive.

Reject fixed code-provision turn counts and prompt-local progress state.

### OmniMentor 7.1: mental models and system maps

Retain:

- learner-constructed mental models;
- explicit system maps of components, state, relationships, dependencies, and flows;
- reasoning lenses such as decompose, contrast, boundary test, system map, and perspective shift;
- practice that requires applying a lens rather than merely recognizing terminology;
- scaffolding that retreats as the learner becomes more independent.

Reject prompt-local mental-model scores and heuristic persistence.

### OmniLearner v9: momentum and next-action UX

Retain:

- after each interaction, expose the single highest-value next move in plain language;
- execute an unambiguous confirmation without re-presenting a menu;
- keep alternatives available without forcing the learner to operate the state machine;
- when a model answer is shown, map its parts back to the reasoning structure that produced it.

Replace its `introduced -> example_viewed -> practiced` learner model with Learning OS state.

### Cognitive Mentor v11 Signal-Focused: interview signal

Retain:

- distinguish technical correctness from what an interviewer can observe in the answer;
- audit answer quality for signals such as assumption handling, causal reasoning, trade-off articulation, production awareness, and communication coherence;
- use realistic unscaffolded interview delivery when Learning OS routes to interview/mock work.

Reject its parallel `MENTOR_STATE`, signal counters as mastery, and prompt-owned prerequisite graph.

## Pedagogical architecture

Learning OS remains the control plane. The teacher receives learner-state-derived intent and turns it into an interaction using a small pedagogical repertoire.

```text
Learning OS durable state
        |
        v
selector / daily mission
        |
        v
ChallengeIntent
(objective, capability, task form, novelty,
 weakness, due/reason, recent surfaces)
        |
        v
Teacher pedagogical operator selection
        |
        v
Frozen challenge + rubric + hint ladder
        |
        v
learner attempt
        |
        v
assessment / exposure / evidence
        |
        v
feedback + one recommended next move
        |
        +------> Learning OS chooses what is next
```

The teacher may choose *how* to instantiate the current intent. The teacher may not override *which objective should be worked*, whether evidence qualifies, whether a weakness is resolved, or whether transfer/durability is demonstrated.

## Canonical learning loop

Use the following as a repertoire, not a mandatory script:

```text
orient
-> retrieve
-> construct model
-> predict / commit
-> observe or execute
-> explain
-> challenge / break
-> localize
-> repair model
-> reconstruct
-> transfer
-> review later
```

The shortest useful path should win. A direct factual clarification may use only `orient -> explain`. A diagnostic may start at `predict`. A debugging challenge may use `predict -> observe -> localize -> repair`. A transfer retest may use only `commit -> execute -> explain`.

### Core invariant

Whenever an interaction is assessable, evidence lifecycle rules take precedence over pedagogy:

1. register/freeze the challenge and rubric;
2. open the attempt;
3. record every relevant hint before showing it;
4. record answer/explanation/worked-example exposure before showing it;
5. collect the learner response before corrective exposure when retrieval evidence is intended;
6. submit and verify the attempt;
7. assess against frozen criteria;
8. record evidence;
9. only then give corrective teaching feedback that would contaminate a fresh retrieval.

## Pedagogical operators

These are teacher-level interaction strategies. They are not new learner-state enums.

### 1. Retrieve

**Use when:** due retrieval, refresh, or a clean diagnostic is valuable.

**Teacher behavior:** Ask for recall/application before explanation. Prefer a short prompt that reveals the target capability. Do not prime the answer.

**Evidence interaction:** Can produce independent retrieval evidence when all existing retrieval-validity requirements hold.

### 2. Predict

**Use when:** the objective concerns runtime behavior, concurrency, state transitions, resource behavior, or any mechanism where an observable consequence can be forecast.

**Teacher behavior:** Require a committed prediction and causal explanation before revealing execution, logs, metrics, or the correct result.

**Why:** Prediction externalizes the learner's current model. A later mismatch becomes diagnostically useful.

### 3. Construct Model

**Use when:** understanding depends on relationships among components rather than a single fact.

**Teacher behavior:** Ask the learner to construct the representation. Prompt for actors, state ownership, boundaries, queues, dependencies, data/control flow, invariants, resource limits, or failure propagation as relevant.

**Do not:** provide a polished diagram before the learner has had a chance to construct one when the construction itself is assessable.

### 4. Guided Discovery

**Use when:** a learner can plausibly infer the principle from a scenario and doing so is likely to improve understanding.

**Teacher behavior:** Present the pressure/problem first. Ask targeted questions. Let the learner formulate the principle before introducing formal terminology.

**Off-ramp:** If repeated questioning stops producing progress, move to a more direct explanation or a recorded hint. Socratic persistence is not a goal.

### 5. Falsify / Boundary Test

**Use when:** the learner has stated a rule, design claim, or abstraction whose scope matters.

**Teacher behavior:** Ask what evidence would prove the claim wrong. Change one assumption or present a counterexample. Require the learner to state the boundary of applicability.

**Typical questions:**

- What assumption must be true for that conclusion to hold?
- What interleaving would break this claim?
- When would this pattern be the wrong choice?
- Which observation would distinguish these two explanations?

### 6. Debug / Localize

**Use when:** the target capability is `debug`, or when an incorrect prediction provides a useful failure to investigate.

**Teacher behavior:**

1. establish expected vs. observed behavior;
2. ask the learner to state the current hypothesis;
3. ask what that hypothesis predicts;
4. choose the smallest discriminating observation/test;
5. localize the responsible boundary or owner;
6. repair only after localization.

The teacher should distinguish symptoms, observations, hypotheses, and causes.

### 7. Mental-Model Autopsy

**Use when:** an error is caused by a coherent but wrong model, not a slip.

**Teacher behavior:** After the attempt is safely assessed/exposed, ask:

- What did you expect?
- Which assumption made that expectation reasonable?
- Which observation contradicts it?
- What must change in the model?
- State the corrected model in your own words.

If the error matches an existing registered misconception definition, record its misconception ID through the existing assessment path. If it is a newly observed causal error without a registered misconception definition, record a precise `observedErrors` category and let the normal weakness projection own persistence. Do not invent a persistent misconception definition from conversation or create a second prompt-owned misconception log.

### 8. Reconstruct

**Use when:** the learner has just received meaningful correction, a worked example, or decisive guidance.

**Teacher behavior:** Have the learner rebuild the explanation, algorithm, system map, or solution after the teaching exposure instead of merely acknowledging it.

**Evidence interaction:** This reconstruction is guided/exposed unless a later fresh attempt satisfies the independent-evidence requirements.

### 9. Transfer

**Use when:** `ChallengeIntent.novelty === "transfer"` or when Learning OS explicitly requires transfer evidence.

**Teacher behavior:** Preserve the underlying objective while changing the surface enough that memorized phrasing or a copied procedure is insufficient. Do not announce the answer-bearing analogy between the old and new surfaces before the attempt.

### 10. Teach Back

**Use when:** explanation quality itself is useful and the learner has enough exposure to articulate the model.

**Teacher behavior:** Ask for an explanation aimed at a concrete audience or constraint. Use the response to reveal missing causal links or overgeneralizations.

**Evidence interaction:** Existing `explain` capability rules remain authoritative.

### 11. Worked Example / Scaffold

**Use when:** the learner lacks enough structure to make productive progress.

Map classic scaffolding to Learning OS evidence semantics:

```text
I do  = worked-example exposure
We do = guided attempt with recorded hints/exposure
You do = fresh changed-surface attempt, answer hidden, with no hint observations if independent evidence is intended
```

Do not treat the first two stages as independent evidence.

## Operator selection guidance

Operator selection is teacher behavior constrained by `ChallengeIntent`.

### By capability

| Capability | Strong default operators |
| --- | --- |
| `explain` | retrieve, construct model, guided discovery, falsify, teach back |
| `predict` | predict, construct model, falsify, transfer |
| `implement` | retrieve, predict/commit, debug/localize, reconstruct, transfer |
| `debug` | predict, debug/localize, mental-model autopsy, falsify, transfer |
| `design` | construct model, guided discovery, falsify, boundary test, transfer |

These are defaults, not kernel policy.

### By state signal

| Learning OS signal | Teacher implication |
| --- | --- |
| pending clean diagnostic | prefer retrieve/predict before explanation; offer the existing diagnose-first trade-off if learner asks for teaching |
| readiness `unknown` | do not assume prior mastery; choose a clean probe or instruction based on preparation strategy |
| readiness `exposed` | avoid treating recognition as ability; use reconstruction or a guided attempt |
| readiness `guided` | reduce scaffolding when the selected Learning OS move supports a fresh no-hint attempt |
| readiness `independent` | avoid repeating the same surface; emphasize transfer, boundaries, integration, or due review when selected |
| selected weakness or known misconception context | design an interaction that discriminates the faulty model from the corrected model |
| recurring/retest weakness | target the weakness directly, preferably on a changed surface |
| transfer required | preserve target principle while changing context/surface |
| due review | favor clean retrieval; keep review short enough to coexist with forward progress |

## Progressive scaffolding

Use only state exposed through the public teacher boundary to choose initial scaffolding: durable readiness/transfer/durability from preparation context, selected weakness context from `ChallengeIntent`, and hint/exposure provenance on the current or resumed attempt. Do not require arbitrary historical exposure inspection, and do not compute a separate scaffold score.

Preferred trajectory:

```text
show/describe model
-> co-construct model
-> learner constructs with prompts
-> learner constructs independently
-> learner chooses a useful reasoning lens independently
```

The teacher may move backward temporarily after failure. Such movement is a teaching choice, not a downgrade of persisted readiness unless new evidence causes Learning OS to derive one.

## Mental models and system maps

A system map is a learner-constructed representation used when relationships are central to the objective. It may be text, a table, an ASCII diagram, a sequence, or another compact representation.

For backend/system topics, the teacher should consider asking for:

- components/actors;
- state owner for each mutable fact;
- synchronous and asynchronous boundaries;
- queues and waiting points;
- capacity/resource constraints;
- concurrency control;
- invariants;
- data/control flow;
- failure propagation;
- observability points;
- retry/idempotency boundaries;
- trust/auth boundaries.

Do not force every item into every map. Ask only for dimensions that expose the target objective.

### Example: connection pressure

```text
incoming requests
-> application concurrency
-> pool waiters
-> checked-out connections
-> PostgreSQL sessions
-> locks / CPU / IO
```

Useful perturbations include changing transaction duration, request concurrency, pool size, DB capacity, or downstream latency and asking the learner to predict where waiting moves.

## Failure-to-repair loop

A meaningful failure should create more than corrective prose.

### Required teacher sequence when a causal misconception is likely

1. Finish assessment and record any exposure required by the existing lifecycle.
2. State the mismatch precisely.
3. Ask the learner to reconstruct the reasoning that produced the wrong prediction.
4. Identify the smallest faulty assumption or missing relationship.
5. Correct or scaffold that part only.
6. Ask the learner to reconstruct the full model.
7. When Learning OS selects a suitable follow-up, use a changed surface that can trigger the same old mistake.

This loop turns durable weakness/misconception state into targeted teaching rather than a label.

## Challenge authoring rules

### Start from the selected intent

The teacher must preserve:

- `objectiveId`;
- `capabilityId`;
- `taskForm`;
- `deliveryContext`;
- `novelty`;
- selected weakness context;
- `requiresChangedSurface`;
- recent challenges to avoid;
- time budget when provided.

### Freeze criteria before response

Criteria should measure the target reasoning, not stylistic preferences introduced after seeing the answer.

Good criteria are observable. Examples:

- identifies the state owner;
- predicts the lost-update outcome under the supplied interleaving;
- distinguishes pool wait time from database execution time;
- states the invariant that idempotency protects;
- identifies which authorization decision must be made server-side;
- explains the trade-off introduced by synchronous replication.

### Design for discrimination

A strong challenge distinguishes competing mental models.

Prefer prompts where a common incorrect model predicts a different observable result from the correct model.

### Require commitment before reveal

For prediction, debugging, and design diagnosis, ask the learner to commit to a hypothesis or consequence before exposing decisive observations when a clean signal is valuable.

### Change one important thing for variants

A `variant` should not be a synonymized copy. Change an interleaving, constraint, ownership boundary, failure mode, workload shape, API contract, or resource condition while preserving the underlying objective.

### Transfer changes the surface, not the objective

A transfer challenge should require recognition of the underlying principle in a materially different context. Do not leak the mapping in the prompt.

## Learner-facing next-action UX

The learner should not have to interpret internal state.

After feedback or a non-assessable teaching interaction:

1. state the important result in one or two sentences;
2. obtain the authoritative next move from the responsible Learning OS owner;
3. express that selected move in learner language and explain why it matters;
4. keep alternatives available without presenting a large menu by default.

The teacher must not infer a next move from readiness, weakness, or recent performance when Learning OS has not selected one. If no authoritative next decision is available, call the responsible Learning OS owner before making a recommendation.

Example:

> You found the race, but only after a structural hint. Learning OS selected a fresh unaided variant next so we can see whether the repaired model now survives without help. **Recommended: try that variant.**

If the learner responds with an unambiguous confirmation, execute the already-selected move without re-presenting a menu. If the learner asks for explanation, another example, a pause, or a different direction, honor that request subject to Learning OS exposure and sequencing rules; route any request that changes what work comes next back through the responsible Learning OS owner.

### UX rules

- Do not print readiness enums or scheduler internals unless the learner asks for progress details.
- Do not require slash commands.
- Do not ask "what would you like to do?" after every turn when one move is clearly better.
- Do not hide material trade-offs. For example, if an explanation would contaminate a pending diagnostic, say so briefly and let the learner choose.

## Interview signal layer

Interview delivery adds feedback about observable answer quality without creating a parallel mastery system.

### Separation of concerns

**Technical assessment** answers: did the learner satisfy the frozen objective criteria?

**Signal feedback** answers: what would an interviewer be able to infer from the way the learner reasoned and communicated?

Signal feedback never changes technical correctness, readiness, transfer, durability, or FSRS ratings.

### Default backend interview signals

Use only signals relevant to the challenge. Candidate signals include:

- clarifies ambiguous requirements before committing to a design;
- distinguishes observation, assumption, hypothesis, and conclusion;
- identifies state ownership and governing invariants;
- reasons causally rather than listing technologies;
- articulates trade-offs and boundary conditions;
- notices capacity, queueing, backpressure, or contention when relevant;
- discusses failure behavior and recovery semantics when relevant;
- explains what would be measured to validate the design/diagnosis;
- communicates uncertainty precisely;
- keeps the answer structured enough to follow.

Avoid rewarding buzzword density, unnecessary pattern naming, or invented scale requirements.

### Delivery contexts

- `learn` / `practice`: signal feedback is normally omitted unless the objective includes communication.
- `interview`: concise signal feedback follows technical feedback.
- `mock`: preserve realistic pressure during the attempt; provide signal feedback in the debrief, not during the answer.

## Model-answer handling

A model answer can help a learner see a coherent target response, but it is answer exposure.

Before displaying one, call `recordExposure(...)` with the appropriate exposure type.

When showing a model answer, deconstruct it against the already-frozen reasoning structure or rubric:

```text
observation -> hypothesis -> discriminating evidence -> conclusion -> trade-off
```

Do not present model-answer fluency as evidence that the learner can reproduce the reasoning independently.

## Direct explanation policy

The design does not adopt OmniMentor's strict code/explanation gate.

Use direct explanation when:

- the user asks a direct factual question that cannot spoil an active assessment;
- further Socratic questioning has low expected value;
- the learner lacks prerequisite material required to make a useful attempt;
- the user explicitly chooses teaching exposure over a clean diagnostic;
- the teacher needs to repair a specific gap after assessment.

Record exposure before revealing answer-bearing material when the interaction is exposure-sensitive.

## Challenge complexity

The prompt corpus repeatedly attempted to maintain a numeric cognitive-load or difficulty score. Learning OS does not currently need one to implement this design.

In the first wave, the teacher can vary challenge load through concrete authoring choices:

- number of interacting components;
- number of concurrent actors;
- visibility of observations;
- number of competing hypotheses;
- degree of ambiguity;
- amount of scaffolding;
- number of constraints/trade-offs;
- novelty of the surface;
- need to integrate multiple previously learned objectives.

Do not add a persistent `difficulty` or `cognitive_load` field until repeated cross-teacher inconsistency demonstrates that existing intent plus protocol guidance is insufficient.

## Public API implications

The first implementation wave should use the existing teacher APIs:

- `getTodayMission`
- `resolveRequestedChallenge`
- `registerChallenge`
- `openAttempt`
- `recordHintUse`
- `recordExposure`
- `submitAttempt`
- `recordAssessment`
- `reviseEvidence`
- `listResumableSessions`
- `resumeSession`
- `finishSessionInteraction`
- `completeSessionFeedback`

The initial first-wave design deliberately avoided new durable pedagogy state. Later replaceable-teacher use justified two narrow lifecycle additions without adding a second pedagogy engine: immutable authoring-contract provenance for selected challenges, and a terminal reject/void operation for defective assessment opportunities.

One public-API detail matters for replaceable teachers: `createSession(topicId, mode)` expects the durable session topic. In a preparation-goal flow that is the resolved `goalId`; it is **not** `ChallengeIntent.conceptId`. The direct lifecycle is therefore `resolveRequestedChallenge(...) -> registerChallenge(challenge, intent) -> createSession(goalId, intent.deliveryContext) -> openAttempt(...)`, so the frozen challenge and its selection-time authoring contract survive teacher replacement together.

## Fresh-teacher dogfood — 2026-08-28

Task 12 was run against a disposable copy of the `backend-systems` learner store. No dogfood attempt or evidence was written to the real learner profile.

| Case | Observable result |
| --- | --- |
| `predict` runtime concurrency | The fresh teacher froze a discriminating runtime-trace challenge and required a committed prediction before any decisive reveal. |
| causal failure repair | A coherent wrong `await` model produced precise `observedErrors`, corrective exposure was recorded before correction, and the teacher asked the learner to reconstruct the repaired model instead of opening a self-selected retest. |
| next-action ownership | After reconstruction, the teacher completed feedback, called `getTodayMission(...)`, and presented the returned `architecture-boundaries-and-scaling:design` move rather than deriving another concurrency variant from `guided` readiness. |
| `design` system map | An unambiguous “continue” executed the already-selected move and elicited ownership, sync/async boundaries, invariants, backpressure, failure recovery, and trade-offs before technology choices. |
| `debug` localization | The challenge required a primary and competing hypothesis, one discriminating observation before repair, request-correlated instrumentation, first-failing-boundary localization, and evidence-dependent verification. |
| explanation before diagnostic | The teacher first offered diagnose-first versus explain-now. On explain-now it recorded `explanation_shown` before teaching, created no fake attempt/assessment, and left the baseline diagnostic pending. |
| `interview` signal separation | A technically complete multi-tenant authorization answer recorded `correct`, all four frozen technical criteria met, `observedErrors: 0`, and no misconception IDs. Separate interview-signal feedback still noted compressed structure and implicit assumptions, with no signal-state effect. |

### Dogfood friction and decision

Two integration frictions were concrete:

1. A fresh teacher initially passed `ChallengeIntent.conceptId` to `createSession(...)` and hit a foreign-key failure. The causal issue is call-shape discoverability, not missing learner state. The first-wave fix is the explicit goal/topic-ID lifecycle note in the protocol and Skill.
2. Fresh agents spent substantial time inspecting source to recover public call shapes. The compact lifecycle note reduces that burden; this run did not demonstrate a need for a new pedagogy owner or persistent field.

At that first dogfood point, the run did **not** demonstrate a need for arbitrary historical exposure access, a typed pedagogy helper, durable interview-signal state, challenge-load metadata, or new misconception-definition APIs. Later live use supplied the separate cross-teacher consistency evidence that activated Tasks 13–14. A Learning-OS-selected changed-surface retest/transfer did not arise in the original isolated run, so that conditional path was not fabricated merely to satisfy the checklist.

## Documentation ownership

The behavior should be specified in three layers.

### `docs/teacher-agent-protocol.md`

Owns the normative authority boundary and evidence-safe lifecycle. Add the canonical pedagogical loop, operator-selection constraints, progressive scaffolding, failure-to-repair behavior, next-action UX, and interview-signal separation.

### `skills/learning-os-teacher/SKILL.md`

Owns compact execution guidance for a fresh teacher. It should translate the protocol into short operational rules and examples without duplicating the full design document.

### `docs/teacher-pedagogy-design.md`

Owns rationale, the operator catalogue, challenge-authoring guidance, examples, rejected alternatives, and future-extension criteria.

## Optional teacher-side helper code

The first implementation wave should not add a stateful pedagogy engine. If protocol-only execution proves inconsistent during dogfooding, add small pure helpers behind the teacher boundary rather than kernel state.

Possible helpers include:

- deriving a recommended scaffold posture from existing readiness/exposure/weakness signals;
- selecting a pedagogical operator from `ChallengeIntent` and current interaction state;
- formatting a learner-facing next-action reason;
- validating that a proposed challenge preserves intent and changed-surface requirements.

Any such helper must be stateless or derive its output exclusively from authoritative Learning OS inputs. It must not maintain a parallel learner model.

## Backend Systems proving ground

Use the existing `backend-systems` goal only for dogfooding after this design is implemented. Do not create learner evidence while designing the feature.

High-value scenarios include:

### Runtime concurrency and backpressure

- construct request/resource maps;
- predict queue movement under changed service times;
- distinguish concurrency limits from throughput;
- localize saturation from metrics.

### PostgreSQL correctness under concurrency

- commit to an interleaving prediction;
- separate atomicity from isolation;
- identify state protected by locks or MVCC;
- falsify over-broad transaction claims.

### Connection pressure

- map requests -> pool -> DB sessions -> resources;
- predict pool wait behavior as transaction duration changes;
- distinguish app-side queueing from DB execution saturation.

### Cache and state ownership

- identify authoritative state;
- reason about invalidation windows;
- design counterexamples to naive cache consistency claims.

### Queues, retries, idempotency, and partial failure

- identify the invariant;
- predict duplicate-delivery consequences;
- locate the idempotency boundary;
- test retry policies under ambiguous outcomes.

### Auth, tenancy, and long-lived connections

- map trust and authorization boundaries;
- separate authentication state from authorization decisions;
- reason about revocation after a WebSocket/session is established.

### Production latency localization

- distinguish observations from hypotheses;
- choose discriminating telemetry;
- localize queues and resource contention;
- explain what evidence would falsify the leading hypothesis.

### Architecture and distributed consistency

- state system invariants first;
- expose trade-offs and failure semantics;
- perturb latency, replication, partition, or consistency assumptions;
- require boundary conditions and "when not to" reasoning.

## Success criteria

The design is successful when a fresh compatible teacher can use current Learning OS state to produce interactions with the following observable properties:

1. The learner is asked to commit predictions or hypotheses before decisive reveals when doing so improves diagnostic value.
2. Systems objectives regularly require learner-constructed representations instead of recognition-only answers.
3. Wrong answers caused by coherent misconceptions trigger model repair and later changed-surface retesting.
4. Hints, examples, explanations, and model answers preserve existing exposure/evidence semantics.
5. Increasing readiness normally produces less initial scaffolding rather than only harder wording.
6. Transfer work changes the surface materially without changing the objective.
7. Interview feedback can distinguish technical correctness from communication/seniority signals.
8. The learner normally sees one clear next move rather than internal state or a large choice menu.
9. A fresh teacher can follow the behavior without relying on the prior chat transcript.
10. No prompt-owned state competes with Learning OS learner truth.

## Risks

### Protocol bloat

A long pedagogy protocol can become harder to follow than the current one. Keep normative rules in `teacher-agent-protocol.md`, detailed rationale here, and a compact execution checklist in the skill.

### Over-Socratic behavior

Questioning can become friction. The operator repertoire explicitly allows direct explanation and requires an off-ramp when discovery is no longer productive.

### Artificial system maps

Not every concept benefits from a map. Use them when relationships, ownership, flow, or failure propagation are part of the target model.

### Interview-signal contamination

Signal feedback can become a second scoring system or reward style over substance. Keep it descriptive by default and never feed it into technical evidence projections.

### Hidden challenge inconsistency

Different teachers may create challenges of very different cognitive load under the same intent. First address load calibration through authoring guidance and dogfooding. Do not add a generic challenge-load score merely because one teacher can write a more sophisticated question.

Replaceable-teacher use has demonstrated a different persistence need: a future teacher must be able to compare an inherited frozen challenge with the selection-time constraints that produced it. Persisting an immutable authoring-contract snapshot is provenance for intent conformance, not challenge-load metadata and not a second selector.

## Curated prompt-corpus lessons

A bounded review of the learner's older OmniLearner, OmniMentor, Cognitive Mentor, Socratic, and Integrated Learning Architect prompt families reinforced several mechanisms but did not justify importing their prompt-owned state machines.

Retained and normalized into Learning OS:

- **Guided discovery:** useful as an optional teacher technique when one compact question shows that learner inference is likely to pay off; it is not a mandatory multi-step recipe.
- **Bounded Socratic probing:** discovery is useful only while it produces inference. Use one useful inference probe by default; if the learner remains stuck, diagnose the blocker once or teach the minimum rather than continuing interrogation. Interview/mock remains assessment-first.
- **Progressive independence:** scaffolding is temporary by protocol. Do not preemptively prepend worked examples, and withdraw help once it is no longer needed.
- **Error-driven model repair:** preserve the existing expected-result → faulty-assumption → contradicting-observation → corrected-model → reconstruction path for coherent causal errors, not slips.
- **Productive contradiction and pattern noticing:** keep boundary tests, counterexamples, changed constraints, contrasted examples, and thought experiments as optional authoring techniques rather than runtime state.
- **Theory-to-practice momentum:** preserve one clear learner action by default. Correct and sufficient performance should normally close rather than automatically triggering another pedagogical operator.

A second pass over the Adaptive German Weaver / German immersion lineage provided useful teaching ideas, but a later simplicity review removed the parts that duplicated existing owners. Automaticity/performance flow comes from delivery context and ordinary practice semantics; hint depth comes from the frozen challenge hint ladder; weakness/transfer/authentic-surface authoring comes from `ChallengeIntent`; slip-versus-model-error repair, blocker diagnosis, scaffold withdrawal, and interview-safe impasse behavior remain protocol rules. The typed `PedagogyDirective` keeps only `promptShape`, `scaffold`, `commitBeforeReveal`, and `questionChunking`.

**Design rule:** `PedagogyDirective` exists to prevent demonstrated cross-teacher failure modes, not to model the teaching process. A field belongs there only when fresh teachers repeatedly get the behavior wrong without typed guidance.

### Rich repertoire through progressive Skill loading

Removing a technique from the typed directive does not remove it from the teacher's capabilities. Preserve high-value techniques in direct Skill references and load them only when the current episode needs them. The canonical teacher Skill separates reasoning/retrieval, debugging/repair, and performance/interview playbooks so a replaceable teacher can recover proven techniques without preloading a large pedagogical state machine. Availability never implies invocation: correct-and-sufficient performance still closes, and Learning OS remains the sole owner of objective/review/transfer/retest selection.

### Adaptive decomposition without a second learner model

Question complexity is a presentation problem until evidence shows otherwise. When the learner says a challenge is confusing or too large, the teacher first distinguishes three cases without changing the selected objective:

```text
wording complexity       -> rephrase harmlessly
working-memory overload  -> split the same challenge into one coherent subquestion at a time
missing model            -> teach the minimum through normal hint/exposure semantics, then reconstruct
```

Neutral decomposition preserves the same reasoning demand and is not automatically a hint. If the decomposition reveals answer structure, ordering, an invariant, a solution path, or other target reasoning, record it as a hint before showing it. Keep the frozen objective, task form, and criteria unchanged. After chunking, require one integrated reconstruction only when integration itself is part of the frozen criteria or a causal repair; otherwise stop once sufficient evidence exists. A stable learner request such as "always ask one thing at a time" may persist `questionChunking=atomic`; a one-off difficult question does not become a profile trait.

Explicitly rejected from the corpus: response-embedded JSON memory, prompt-owned mastery/curriculum maps, mandatory menus/toolboxes, fixed turn-count curriculum checks, universal Socratic behavior, mandatory model answers after every attempt, and separate prompt-level schedulers. Learning OS already has stronger owners for state, evidence, sequencing, resumption, and review timing.

## Deferred extensions

Consider these only after further dogfooding:

1. Optional structured interview-signal observations if durable cross-session coaching proves useful and a non-mastery owner is clearly defined.
2. Explicit challenge-load metadata if replaceable teachers cannot reliably calibrate complexity from existing state and protocol guidance.
3. Additional task forms only if current forms cannot represent a recurring assessable interaction. Do not add a `system_map` task form merely because system maps are useful artifacts.

## Decision

Implement the pedagogical upgrade first as a teacher-protocol, teacher-skill, and challenge-authoring change. Use current kernel APIs and learner-state contracts unchanged. Dogfood the behavior on Backend Systems. Only promote a repeated teaching problem into kernel state after protocol-level solutions have been shown insufficient.
