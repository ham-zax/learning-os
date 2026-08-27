# Evidence Model

## Purpose

The evidence model prevents the system from turning exposure, confidence, or one successful surface form into a false claim of mastery.

The authoritative assessment history is append-only evidence plus evidence revisions. Scoped hint observations, material exposure events, and misconception observations preserve the interaction provenance needed to interpret that evidence. Readiness, historical-highest readiness, transfer/durability state, blockers, broad weakness signals, and scheduler card state are derived and rebuildable.

## Learning objective

Track capability at the level where task selection changes.

```yaml
id: transactions:debug
concept_id: transactions
capability: debug
```

Goal-specific requirements live separately:

```yaml
goal_id: backend-interview
objective_id: transactions:debug
importance: core
target_readiness: independent
require_transfer: true
require_durability: false
```

Current learner state does not live authoritatively on either row. It is projected from evidence.

Do not instantiate every concept/capability combination automatically. Use a small extensible capability registry and create only objectives that matter to the learner's goal.

## Capability vocabulary

Start with:

| Capability | Evidence question |
| --- | --- |
| `explain` | Can the learner state the mechanism and relevant boundaries? |
| `predict` | Can the learner anticipate behavior before seeing the result? |
| `implement` | Can the learner produce a correct working implementation? |
| `debug` | Can the learner locate and repair a failure from symptoms/evidence? |
| `design` | Can the learner choose and justify a solution under constraints? |

`interview`, `practice`, and `review` are delivery contexts, not capabilities.

`transfer` is a property of a task relative to prior evidence, not a standalone capability.

`durable` is a human-facing proficiency label derived from qualifying delayed-retrieval evidence, not a standalone capability or irreversible state.

## Evidence event

Suggested minimum shape:

```yaml
id: ev_...
objective_id: transactions:debug
session_id: session_...
problem_id: race-final-inventory
attempt_id: attempt_...
task_id: race-final-inventory
task_version: 3
rubric_id: transactions-debug-race
rubric_version: 2
evaluator_type: agent
assessment_basis: mixed

task_form: debugging
delivery_context: interview
result: incorrect
hint_level: L0
novelty: transfer
retrieval_valid: true
performed_at: "..."
delay_anchor_at: "..."
delay_seconds: 345600

criteria:
  met: []
  unmet:
    - identifies-read-modify-write-race
observed_errors:
  - assumes-transaction-implies-serialization
rationale: "..."
created_at: "..."
```

Preserve enough provenance to reconstruct exactly what was evaluated. Learner response/artifact is stored once on the shared attempt; challenge/rubric/form/context/novelty fields on evidence are immutable audit snapshots copied by the kernel from the durably frozen challenge rather than independently supplied values. A later agent should be able to explain every projection from stored evidence plus its referenced attempt/challenge.

## Assessment result

Use four primary grading outcomes:

```text
correct
partially_correct
incorrect
ungradable
```

`ungradable` means the task, answer key, rubric, or available evidence is not reliable enough to score. It must not count against the learner.

## Hint levels

The exact labels can change, but the state transition must know how much decisive help was used.

Initial scale:

```text
L0  no decisive hint; self-check only
L1  points to the location/category of the problem
L2  supplies a relevant rule or criterion
L3  supplies partial structure
L4  demonstrates a decisive step
L5  provides the answer/solution
```

Default evidence ceilings:

- L0 may support `independent`; transfer and durability are evaluated on their own evidence dimensions.
- L1-L4 normally cap readiness evidence at `guided`.
- L5 normally supports only exposure on that surface; use a fresh variant for new evidence.

Hint provenance is objective-specific. Every durable hint observation is scoped to one objective, frozen criterion IDs, or all challenge targets. Each objective-specific evidence event derives its `hint_level` as the highest relevant observation; no relevant observation means L0.

## Proficiency projection

V1 projects three orthogonal dimensions rather than one mastery ladder:

```text
readiness:   unknown | exposed | guided | independent
transfer:    untested | not_demonstrated | demonstrated | contradicted
durability:  untested | not_demonstrated | demonstrated | contradicted
```

### Readiness

- `unknown`: no gradable evidence exists.
- `exposed`: only answer-revealed/L5 evidence or unsuccessful attempts exist.
- `guided`: there is useful successful/partial assisted performance, or a newer qualifying unaided result other than `correct` has contradicted prior independent readiness.
- `independent`: the two most recent qualifying unaided (`L0`) gradable attempts are both `correct`, use distinct task versions or materially distinct surfaces, and no active blocking misconception applies.

A newer qualifying unaided result other than `correct` prevents current `independent` readiness until two subsequent qualifying successes satisfy the gate. Historical-highest readiness remains intact.

### Transfer

- `untested`: no qualifying `novelty=transfer` evidence.
- `not_demonstrated`: qualifying transfer has been attempted but no transfer success has yet been demonstrated, and the latest qualifying result is not `correct`.
- `demonstrated`: the latest qualifying unaided transfer event is `correct`.
- `contradicted`: the latest qualifying unaided transfer event is `incorrect` or `partially_correct` after at least one prior transfer demonstration.

A correct transfer event may also count toward independent readiness.

### Durability

Durability must be provable from durable interaction history. The kernel records material objective-specific re-exposure such as explanations, answer reveals, worked examples, corrective feedback, and solution walkthroughs in append-only `exposure_events`.

For a new attempt, the kernel computes the delay anchor as the latest prior memory contact for that objective: `COALESCE(submitted_at, started_at)` for any prior attempt whose frozen challenge targeted the objective, or a material exposure event, whichever is later. An abandoned opened attempt therefore still counts as contact. A prior attempt remains a memory contact even if its assessment is later invalidated.

A delayed event qualifies only when the answer was hidden, its objective-specific `hint_level=L0`, the event is gradable and `retrieval_valid=true`, the delay anchor is known, and at least seven days elapsed since that anchor.

- `untested`: no qualifying delayed retrieval.
- `not_demonstrated`: qualifying delayed retrieval has occurred but no durability success has yet been demonstrated, and the latest qualifying result is not `correct`.
- `demonstrated`: the latest qualifying delayed retrieval is `correct`.
- `contradicted`: the latest qualifying delayed retrieval is `incorrect` or `partially_correct` after at least one prior durability demonstration.

The seven-day floor is a V1 policy constant for the durability summary. Later FSRS reviews continue testing retention.

A UI may summarize these dimensions with labels such as `transferable` or `durable`, but those labels are derived views rather than stored irreversible states.

## Contradictory evidence and regression

Persist the rebuildable projection fields needed for fast reads, including:

```text
readiness
historical_highest_readiness
transfer_state
durability_state
blocking_misconception_count
recent_failure
last_qualifying_evidence_at
last_event_seq
projector_version
```

Projection rebuild and incremental projection must produce the same result from the same effective event history ordered by learner-performance time (`performed_at`, then append sequence as tie-breaker). Assessment commit time must not reorder learner history. Never delete or rewrite prior evidence to manufacture a clean progression.

If an assessment itself was wrong, invalidate the old evidence and append a corrected replacement tied to the same attempt/objective; at most one such event may be currently effective. Restore is reserved for reversing an erroneous invalidation and must not create two effective grades for one target attempt.

## Misconceptions

A misconception is a durable causal error worth retesting, not every ordinary mistake.

```yaml
id: misconception:transactions-imply-serialization
concept_id: transactions
is_blocking: true
description: "Assumes wrapping operations in a transaction prevents concurrent observation/races by itself."
correction_strategy: "Use concurrent read-modify-write scenarios that distinguish atomicity from isolation/locking."
```

Observed/cleared status is append-only history tied to evidence events. Current state uses effective observations ordered by source evidence learner-performance time, with event sequence only as a tie-breaker. Invalidating source evidence also removes that observation from effective replay until the evidence is restored. An active blocking misconception caps readiness below `independent`.

## Weakness projection

Broad weakness projection is derived from repeated evidence and explicit misconceptions rather than maintained as a second independent truth source. The selector may materialize a lifecycle for efficient use:

```text
new
→ recurring
→ improving
→ resolved
→ retest
```

Every lifecycle transition must be explainable from evidence. Do not infer `resolved` from elapsed time. Require fresh evidence on the relevant objective. A resolved weakness should return later under a different surface before becoming trusted.

## ReviewRatingMapper and FSRS interaction

FSRS receives only a scheduler rating and card state. It does not inspect rich pedagogical evidence directly.

```text
EvidenceEvent
  ↓
ReviewRatingMapper
  ↓
Again | Hard | Good
  ↓
review_event
  ↓
ts-fsrs
```

The mapper accepts only evidence already marked as valid retrieval. Invalid retrieval evidence may still update proficiency, misconceptions, and challenge selection, but it must not update the FSRS card.

Set `retrieval_valid=true` only when the exact challenge version was durably frozen before the attempt, the answer was hidden, the objective-specific hint level derived from scoped hint observations is L0, the task genuinely required retrieval/application, the result is gradable, required executable verification exists, and the learner response preceded any objective-relevant corrective explanation or answer reveal recorded in `exposure_events`.

V1 mapping is exact:

```text
retrieval_valid = false -> no scheduler update
ungradable              -> no scheduler update
incorrect               -> Again
partially_correct        -> Hard
correct                  -> Good
```

V1 does not emit `Easy`. Transfer novelty does not change the FSRS rating. Persist each mapper output as an append-only `review_event`; the current `review_card` is a rebuildable cache/projection.

A `review_event` is effective only while its source evidence is currently valid. Its `reviewed_at` is the source learner-performance time, not the later grading time. Evidence invalidation or restore rebuilds the affected FSRS card by replaying effective review events in `(reviewed_at, seq)` order. `review_events` themselves remain append-only and need no separate revision stream.

## Confidence

Self-confidence is optional calibration data:

```yaml
confidence_before: 85
confidence_after: 40
```

It may influence feedback and challenge selection, especially when confidence is high and performance is wrong. It must not determine correctness, readiness, or scheduler rating.

## Evidence integrity rule

For any important state change, the system should be able to answer:

```text
What task was attempted?
What counted as correct?
What did the learner actually do?
How much help did they receive?
Was the task novel?
Was there a real delay?
Which misconception was present or cleared?
Why did the objective proficiency projection change?
```

If those questions cannot be answered, the system should avoid making a strong proficiency claim.