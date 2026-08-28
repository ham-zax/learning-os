# Kernel Contracts

## Purpose

This document fixes the V1 data and runtime contracts that implementation must preserve. It turns the architecture into concrete ownership boundaries so storage, assessment, scheduling, selection, and agent orchestration do not invent competing state models.

The kernel owns durable learner state. Agents may teach, generate challenges, run code, and evaluate open-ended responses, but they submit observations through these contracts rather than mutating mastery or scheduler state directly.

## Invariants

1. Append-only evidence, misconception observations, hint observations, and exposure events preserve learner-history provenance.
2. Evidence validity is authoritative for every derived consequence: proficiency, misconception state, weakness summaries, scheduler replay, and FSRS card state.
3. Current proficiency, weakness summaries, and FSRS card state are rebuildable projections or caches.
4. A challenge version is frozen and durably persisted before learner response when it can affect proficiency or scheduling.
5. One assessed objective produces one objective-specific evidence event.
6. Hint provenance is scoped to an objective, owned criteria, or all challenge targets; per-objective evidence derives its own effective hint level.
7. Durability delay is computed from durable attempt and exposure history, not from agent memory.
8. Self-confidence never determines correctness or scheduler rating.
9. FSRS receives only scheduler ratings; it never interprets pedagogical evidence.
10. Agent/local execution is the V1 verifier for executable programming tasks.
11. Assessment and evidence-correction commits are atomic: authoritative events and every affected projection/cache either commit together or do not commit.

## V1 logical schema

The exact SQLite migration syntax may follow upstream conventions, but these logical tables and ownership rules are fixed.

### `capabilities`

Small extensible registry seeded with the initial programming capabilities.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text PK | Stable slug such as `explain` or `debug`. |
| `description` | text | Human-readable capability definition. |
| `is_core` | integer/bool | Marks the seeded core registry. |
| `created_at` | timestamp | Immutable creation time. |

Initial rows:

```text
explain
predict
implement
debug
design
```

Do not create a new capability merely to represent delivery context, novelty, or delay.

### `learning_objectives`

Sparse `concept × capability` identities.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text PK | Stable objective ID. |
| `concept_id` | FK | Existing concept. |
| `capability_id` | FK | `capabilities.id`. |
| `created_at` | timestamp | Creation time. |
| `updated_at` | timestamp | Administrative metadata only. |

Constraint:

```text
UNIQUE(concept_id, capability_id)
```

Do not persist authoritative learner state or goal-specific priority on this table.

### `goal_objectives`

Goal-specific requirements and priority for an objective. In V1, `goal_id` is `topics.id`: the topic already owns the goal description, deadline, and session container, so a second goals table would duplicate ownership. `goal_objectives.goal_id` therefore references `topics(id)`. The association does not require the objective's concept to belong to that same topic; one objective may serve multiple topic-backed goals.

| Column | Type | Rule |
| --- | --- | --- |
| `goal_id` | FK/text | Active learning/interview goal. |
| `objective_id` | FK | `learning_objectives.id`. |
| `is_active` | bool | Eligible for this goal's selection. |
| `importance` | enum/text | `core`, `important`, or `supporting`. |
| `target_readiness` | enum/text | `guided` or `independent`. |
| `require_transfer` | bool | Goal requires demonstrated transfer. |
| `require_durability` | bool | Goal requires demonstrated delayed retrieval. |
| `preparation_strategy` | enum/text/null | Initial orchestration policy: `learn`, `refresh`, `diagnose_first`, or `transfer_practice`. Planning metadata only; never proficiency. |
| `initial_diagnostic_kind` | enum/text/null | Evidence-producing diagnostic intent established at confirmed onboarding; remains planning metadata until an actual attempt is assessed. |
| `created_at` | timestamp | Association creation time. |
| `updated_at` | timestamp | Goal-metadata update time. |

Constraint:

```text
PRIMARY KEY(goal_id, objective_id)
```

The same objective may therefore be core for one goal and supporting or inactive for another without duplicating learner evidence. Onboarding preparation strategy may influence which challenge the teacher tries first, but later evidence/projections remain authoritative and the strategy cannot grant readiness, transfer, durability, or scheduler state.

### `goal_preparation`

Confirmed goal-level preparation context that must survive replacement of the conversational teacher. This is orchestration state, not learner evidence.

| Column | Type | Rule |
| --- | --- | --- |
| `goal_id` | PK/FK | References the existing topic-backed goal owner. |
| `purpose` | enum/text | `interview`, `role_readiness`, or `long_term_mastery`. |
| `target_role` | text/null | Structured learner-facing role, when supplied. |
| `target_outcome` | text/null | Structured preparation outcome, when supplied. |
| `minutes_per_day` | integer/null | Normal per-day orchestration budget; does not affect FSRS. |
| `days_per_week` | integer/null | Optional availability context, 1–7. |
| `minutes_per_week` | integer/null | Optional weekly orchestration budget. |
| `confirmed_at` | timestamp | Explicit learner-confirmation time. |
| `created_at` | timestamp | Persistence creation time. |
| `updated_at` | timestamp | Planning-metadata update time. |

Do not persist raw resumes, job descriptions, chat transcripts, provider identifiers, or the full draft proposal here. Resume/JD/self-report claims may shape this confirmed plan but cannot create evidence, review events/cards, misconceptions, or non-unknown objective projections.

### `objective_projections`

Rebuildable current summary for fast reads.

| Column | Type | Rule |
| --- | --- | --- |
| `objective_id` | PK/FK | One row per instantiated objective. |
| `readiness` | enum/text | `unknown`, `exposed`, `guided`, `independent`. |
| `historical_highest_readiness` | enum/text | Highest readiness ever demonstrated. |
| `transfer_state` | enum/text | `untested`, `not_demonstrated`, `demonstrated`, `contradicted`. |
| `durability_state` | enum/text | `untested`, `not_demonstrated`, `demonstrated`, `contradicted`. |
| `blocking_misconception_count` | integer | Derived from active blocking misconceptions. |
| `recent_failure` | bool | Derived from the latest qualifying evidence. |
| `last_qualifying_evidence_at` | timestamp/null | Latest gradable evidence that affected the projection. |
| `last_event_seq` | integer | Highest evidence sequence incorporated. |
| `projector_version` | text | Projection-rule version. |
| `rebuilt_at` | timestamp | Projection build time. |

`transfer_state` and `durability_state` are orthogonal to readiness. They are not later rungs in a single irreversible ladder.

A convenience display label may map the projection to `unknown`, `exposed`, `guided`, `independent`, `transferable`, or `durable`, but that label is not authoritative storage.

### `attempts`

Preserve the upstream attempt entity and extend it only where needed to record the learner artifact once.

Expected additions or equivalent fields:

| Column | Type | Rule |
| --- | --- | --- |
| `challenge_id` | FK/text | Frozen challenge identity used for the attempt. |
| `challenge_version` | text/integer | Exact persisted challenge version delivered. |
| `response_text` | text/null | Learner answer when text-based. |
| `artifact_ref_json` | JSON/text/null | File/commit/diff/runtime artifact reference. |
| `started_at` | timestamp | Attempt start. |
| `submitted_at` | timestamp/null | Submission time. |

Do not duplicate a large learner response into each per-objective evidence event.

### `hint_observations`

Append-only hint provenance for an attempt. Scope is explicit because one hint may help only one objective or criterion in a multi-objective challenge.

| Column | Type | Rule |
| --- | --- | --- |
| `seq` | integer PK/autoincrement | Observation order. |
| `attempt_id` | FK | Attempt receiving the hint. |
| `level` | integer | L1-L5. Absence of a relevant observation means L0. |
| `scope_kind` | enum/text | `objective`, `criteria`, or `all_targets`. |
| `objective_id` | FK/null | Required when `scope_kind=objective`. |
| `criterion_ids_json` | JSON/text/null | Required when `scope_kind=criteria`; criteria must belong to frozen targets. |
| `recorded_at` | timestamp | Kernel-assigned commit time immediately before/when the hint is exposed; callers do not supply it. |

For each objective-specific `EvidenceEvent.hint_level`, use the highest relevant hint level from:

- `all_targets` observations;
- observations scoped directly to that objective;
- criterion-scoped observations whose frozen criteria belong to that objective.

If no relevant hint observation exists, the objective-specific hint level is L0.

### `exposure_events`

Append-only durable record of material re-exposure. This stream exists so delayed-retrieval claims do not depend on chat memory.

| Column | Type | Rule |
| --- | --- | --- |
| `seq` | integer PK/autoincrement | Exposure order. |
| `objective_id` | FK | Objective materially re-exposed. |
| `session_id` | FK/null | Session provenance. |
| `challenge_id` | FK/text/null | Challenge associated with the exposure when applicable. |
| `challenge_version` | text/integer/null | Exact challenge version when applicable. |
| `attempt_id` | FK/null | Related attempt when feedback/solution follows an attempt. |
| `exposure_type` | enum/text | `explanation_shown`, `answer_revealed`, `worked_example_shown`, `corrective_feedback_shown`, or `solution_walkthrough`. |
| `source_ref` | text/null | Optional durable reference to the shown material. |
| `occurred_at` | timestamp | Kernel-assigned commit time immediately before the learner receives the material; callers do not supply it. |

Record an exposure only when the shown material meaningfully refreshes the target mechanism, answer, or solution. Generic praise, navigation, or a prompt that does not reveal the target does not count.

### `evidence_events`

Append-only objective-specific assessment history.

| Column | Type | Rule |
| --- | --- | --- |
| `seq` | integer PK/autoincrement | Append order and deterministic tie-breaker; not learner-time order by itself. |
| `id` | text unique | Stable external ID. |
| `objective_id` | FK | Exactly one objective. |
| `supersedes_event_id` | FK/null | Prior invalidated evidence replaced by this corrected event. |
| `session_id` | FK/null | Session provenance. |
| `problem_id` | FK/null | Existing problem if applicable. |
| `attempt_id` | FK/null | Learner attempt. |
| `task_id` | text | Immutable snapshot of the frozen challenge identity. |
| `task_version` | text/integer | Immutable snapshot of the frozen version delivered. |
| `rubric_id` | text/null | Immutable snapshot of frozen rubric identity. |
| `rubric_version` | text/integer/null | Immutable snapshot of frozen rubric version. |
| `task_form` | enum/text | See challenge contract. |
| `delivery_context` | enum/text | `learn`, `practice`, `review`, `interview`, `mock`. |
| `result` | enum/text | `correct`, `partially_correct`, `incorrect`, `ungradable`. |
| `hint_level` | integer | L0-L5, derived from objective-relevant `hint_observations`. |
| `novelty` | enum/text | `same`, `variant`, `transfer`. |
| `retrieval_valid` | bool | Whether the event may reach `ReviewRatingMapper`. |
| `delay_anchor_at` | timestamp/null | Kernel-computed latest prior memory-contact time for this objective. |
| `delay_seconds` | integer/null | `attempt.submitted_at - delay_anchor_at`, computed by the kernel. |
| `assessment_basis` | enum/text | `deterministic_execution`, `frozen_rubric`, `human`, `mixed`. |
| `evaluator_type` | enum/text | `kernel`, `agent`, `llm`, `human`. |
| `criteria_json` | JSON/text | Objective-specific criteria results. |
| `observed_errors_json` | JSON/text | Stable error categories where known. |
| `rationale` | text | Why this objective result was assigned. |
| `performed_at` | timestamp | Learner-performance time; for normal attempts this is `attempt.submitted_at`. |
| `created_at` | timestamp | Evidence commit/observation time. |

Indexes:

```text
(objective_id, performed_at, seq)
(objective_id, created_at)
(attempt_id, objective_id)
(retrieval_valid, objective_id)
```

Challenge-derived fields (`task_id`, `task_version`, rubric identity/version, `task_form`, `delivery_context`, and `novelty`) are denormalized audit snapshots copied by the kernel from the persisted frozen challenge/target. Callers do not supply independent values for them. The kernel must reject any attempted evidence commit that disagrees with the frozen challenge.

For normal attempts, at most one evidence event per `(attempt_id, objective_id)` may be currently effective. Correcting a wrong assessment invalidates the old event and appends a replacement with `supersedes_event_id`; it does not mutate the old event or leave two effective grades for the same target attempt.

No update or delete is allowed for ordinary grading changes. If an event must be invalidated, append an evidence revision rather than rewriting history.

### `evidence_revisions`

Append-only correction channel for assessment mistakes.

| Column | Type | Rule |
| --- | --- | --- |
| `seq` | integer PK/autoincrement | Revision order. |
| `evidence_event_id` | FK | Event being corrected. |
| `action` | enum/text | `invalidate` or `restore`. |
| `reason` | text | Required audit rationale. |
| `created_at` | timestamp | Revision time. |

The latest revision determines whether an evidence event is currently effective. That validity propagates to every derived consequence. Invalidating or restoring evidence must rebuild the affected objective projection, misconception/weakness state, and FSRS card in the same correction transaction.

If the assessment value itself was wrong, append `invalidate` for the original event and append a corrected replacement `EvidenceEvent` with `supersedes_event_id` in the same transaction. A `restore` is for reversing an erroneous invalidation; reject restore when it would create two effective events for the same normal `(attempt_id, objective_id)` assessment.

`review_events` and `misconception_observations` do not need their own revision streams: they inherit validity from their source `evidence_event_id`. An invalid source event is ignored during replay; restoring it makes its existing derived events effective again.

### `misconceptions`

Stable semantic misconception definitions.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text PK | Stable misconception slug/ID. |
| `concept_id` | FK | Concept the misconception concerns. |
| `description` | text | Precise causal misunderstanding. |
| `correction_strategy` | text/null | Useful retest/remediation guidance. |
| `is_blocking` | bool | Whether active observation caps readiness below `independent`. |
| `created_at` | timestamp | Definition creation time. |

Status is not authoritative on this row.

### `misconception_observations`

Append-only misconception history.

| Column | Type | Rule |
| --- | --- | --- |
| `seq` | integer PK/autoincrement | Append order and deterministic tie-breaker. |
| `misconception_id` | FK | Stable misconception. |
| `objective_id` | FK | Objective on which it appeared/cleared; must equal the source evidence objective. |
| `evidence_event_id` | FK | Supporting evidence. |
| `disposition` | enum/text | `observed` or `cleared`. |
| `created_at` | timestamp | Observation time. |

Current active/cleared status is determined from effective observations ordered by their source evidence learner time (`EvidenceEvent.performed_at`), then evidence/observation sequence as deterministic tie-breakers. An observation backed by invalidated evidence is ignored until that evidence is restored. Recurrence is represented by another `observed` row, not by resetting the record.

### `weakness_projections`

Optional materialized summary for selection. It is rebuildable and may be omitted initially if query cost is acceptable.

| Column | Type | Rule |
| --- | --- | --- |
| `key` | text PK | Stable objective/category projection key. |
| `objective_id` | FK | Objective affected. |
| `category` | text | Stable failure category. |
| `lifecycle` | enum/text | `new`, `recurring`, `improving`, `resolved`, `retest`. |
| `last_event_seq` | integer | Evidence incorporated. |
| `projector_version` | text | Projection version. |
| `rebuilt_at` | timestamp | Build time. |

Never make an unstructured topic string the identity of a weakness.

### `review_events`

Append-only bridge between evidence and FSRS.

| Column | Type | Rule |
| --- | --- | --- |
| `seq` | integer PK/autoincrement | Append order and deterministic tie-breaker. |
| `objective_id` | FK | Scheduled objective; kernel-derived and must equal the source evidence objective. |
| `evidence_event_id` | FK unique | One scheduler input per evidence event. |
| `rating` | enum/text | `Again`, `Hard`, or `Good` in V1. |
| `mapper_version` | text | Mapping policy version. |
| `reviewed_at` | timestamp | Learner retrieval time supplied to FSRS; must equal source `EvidenceEvent.performed_at`. |
| `scheduler_version` | text | `ts-fsrs`/policy version used. |
| `parameters_json` | JSON/text | FSRS parameters needed for deterministic replay. |

`Easy` is deliberately not emitted in V1.

### `review_cards`

Current FSRS cache/projection.

| Column | Type | Rule |
| --- | --- | --- |
| `objective_id` | PK/FK | One card per objective with scheduler history. |
| `due_at` | timestamp | Queryable due date; index this column. |
| `card_json` | JSON/text | Serialized `ts-fsrs` card state. |
| `last_rating` | enum/text/null | Last applied rating. |
| `source_review_seq` | integer | Highest `review_events.seq` incorporated. |
| `scheduler_version` | text | Version used to build the current card. |
| `updated_at` | timestamp | Cache update time. |

The scheduler's effective replay history is the subset of `review_events` whose source evidence is currently effective, ordered by `(reviewed_at ASC, seq ASC)`. Append order alone is not learner-time order because assessment may be committed later. `review_events` remain append-only provenance; `review_cards` is the fast current projection. If evidence validity changes or a backdated review is appended, rebuild the affected card from that filtered chronological history. If no effective review event remains, remove the card projection for that objective.

## Proficiency projection rules

Projection consumes currently effective evidence in learner-time order `(performed_at ASC, seq ASC)`. Append order alone must not decide current proficiency because assessment may be committed later than the learner performance it describes.

### Readiness

`readiness` represents current support dependence only:

```text
unknown
exposed
guided
independent
```

Rules:

- `unknown`: no gradable evidence exists.
- `exposed`: only answer-revealed/L5 evidence or unsuccessful attempts exist; no qualifying guided success exists.
- `guided`: there is useful successful/partial performance with assistance, or current independent readiness has been contradicted by a newer qualifying unaided result other than `correct`.
- `independent`: the two most recent qualifying unaided (`L0`) gradable attempts are both `correct`, use distinct task versions or materially distinct surfaces, and no active blocking misconception applies.

A newer qualifying unaided result other than `correct` prevents current `independent` readiness until two subsequent qualifying successes satisfy the gate. Historical-highest readiness remains unchanged.

`partially_correct` therefore both fails to establish independent readiness and breaks the current two-success independent gate.

### Transfer

Transfer is independent of the readiness ladder:

- `untested`: no qualifying `novelty=transfer` evidence.
- `not_demonstrated`: at least one qualifying transfer attempt exists, but no transfer success has yet been demonstrated and the latest qualifying result is not `correct`.
- `demonstrated`: the latest qualifying unaided transfer event is `correct`.
- `contradicted`: the latest qualifying unaided transfer event is `incorrect` or `partially_correct` after at least one prior transfer demonstration.

A correct transfer event can also count as one of the two independent-readiness successes.

### Durability

Durability is also orthogonal:

The kernel computes the delay anchor for an objective as the latest prior memory contact before the current attempt submission:

```text
max(
  COALESCE(submitted_at, started_at) of any earlier attempt whose frozen challenge targeted the objective,
  occurred_at of any earlier exposure_event for the objective
)
```

Opening a prior attempt counts as memory contact even if it is abandoned; a submitted attempt uses the later submission time. An earlier attempt remains a memory contact even if its later assessment is invalidated; assessment correction does not erase the fact that the learner encountered and attempted the target. Material explanations, answer reveals, worked examples, corrective feedback, and solution walkthroughs are memory contacts through `exposure_events`.

A delayed retrieval qualifies for durability only when all are true:

```text
retrieval_valid = true
hint_level = L0
result is gradable
delay_anchor_at is known
delay_seconds >= 7 days
```

States:

- `untested`: no qualifying delayed retrieval.
- `not_demonstrated`: at least one qualifying delayed retrieval exists, but no durability success has yet been demonstrated and the latest qualifying result is not `correct`.
- `demonstrated`: latest qualifying delayed retrieval is `correct`.
- `contradicted`: latest qualifying delayed retrieval is `incorrect` or `partially_correct` after at least one prior durability demonstration.

The seven-day floor is a V1 policy constant for the `durability_state` summary. FSRS continues to schedule later retrievals; repeated delayed evidence strengthens confidence without creating another mastery ladder.

### Misconception blockers

If the latest valid observation for an `is_blocking=true` misconception is `observed`, cap current readiness at `guided` even when surface correctness would otherwise qualify as independent.

A misconception clears only through an explicit `cleared` observation tied to new evidence. Elapsed time alone cannot clear it.

### Projection rebuild

Projection functions must be deterministic over:

```text
effective evidence_events after evidence_revisions
+ effective misconception_observations whose source evidence remains valid
+ projector_version
```

A full rebuild and an incremental update from the same event sequence must produce the same projection.

## Retrieval validity

`retrieval_valid` decides whether evidence may reach `ReviewRatingMapper`. It does not decide proficiency by itself.

Set `retrieval_valid=true` only when all applicable conditions hold:

1. The exact challenge version was durably frozen before the attempt opened.
2. The expected answer/rubric was not shown before the learner response.
3. The objective-specific `hint_level`, derived from scoped hint observations, is L0.
4. The task genuinely required retrieval/application rather than copying a visible example.
5. The result is gradable.
6. If executable correctness is required, deterministic execution/verifier evidence exists.
7. The learner response precedes any objective-relevant corrective explanation or answer reveal recorded in `exposure_events`.

Otherwise set it to false.

This deliberately prevents guided success from extending FSRS intervals.

## ReviewRatingMapper V1

Input: one `EvidenceEvent`.

```text
if retrieval_valid = false  -> no review event
if result = ungradable      -> no review event
if result = incorrect       -> Again
if result = partially_correct -> Hard
if result = correct         -> Good
```

`Easy` is not emitted in V1. Transfer novelty does not change the FSRS rating. Transfer and durability affect proficiency/selection; scheduler difficulty should not be inferred from those labels.

The mapper version is persisted on every `review_event` so a future policy can be introduced without rewriting old history.

## FSRS card lifecycle

- Do not create a card merely because an objective exists.
- Create the first card when the objective produces its first effective `ReviewRatingMapper` output.
- Apply effective `review_events` in `(reviewed_at, seq)` order, where source evidence is currently valid.
- If a newly appended effective review predates the card's latest applied learner time, rebuild rather than applying it out of order.
- Query `review_cards.due_at` for due retrieval.
- If source evidence is invalidated/restored or card state becomes suspect, rebuild by replaying only effective `review_events` with their recorded scheduler version/parameters.
- If no effective review event remains after correction, remove the `review_cards` projection for that objective.

### Legacy SM-2 migration

Do not mathematically convert concept-level SM-2 state into objective-level FSRS state. The semantics and unit of scheduling differ.

For imported upstream learner data:

1. Preserve legacy concept/review data for provenance.
2. If useful, create `legacy_import`/exposure records that are explicitly non-authoritative and `retrieval_valid=false`.
3. Do not promote objective readiness from legacy scalar grades alone.
4. Do not seed FSRS cards from old `ef`, `interval`, or `repetitions` values.
5. Schedule a baseline diagnostic through ordinary selection for active objectives.

This is conservative by design: missing trustworthy evidence is represented as uncertainty rather than manufactured mastery.

## Challenge contract

A challenge that can produce evidence must be registered/frozen before learner response.

### `ChallengeSpec`

```yaml
id: tx-race-debug-001
version: 1
public_prompt: "..."
task_form: debugging
delivery_context: interview
time_budget_minutes: 12

targets:
  - objective_id: transactions:debug
    novelty: transfer
    criterion_ids:
      - locate-race
      - explain-isolation-gap
      - propose-correct-fix

rubric:
  id: rubric-tx-race-debug
  version: 1
  criteria:
    - id: locate-race
      objective_id: transactions:debug
      required: true
      description: "Identifies the competing read-modify-write path."

hint_ladder:
  L1: "Inspect where two workers can observe the same state."
  L2: "Separate atomicity from isolation."

verification:
  required: false
  basis: frozen_rubric

private_solution_ref: "..."
```

Required distinctions:

- `target capability`: what skill is measured.
- `task_form`: how the learner must act, e.g. `explanation`, `runtime_trace`, `implementation`, `debugging`, `design`.
- `delivery_context`: `learn`, `practice`, `review`, `interview`, `mock`.
- `novelty`: relation of this target task to prior evidence (`same`, `variant`, `transfer`).

Do not encode these as one generic mode field.

### Frozen assessment rule

Before opening the attempt, persist:

```text
challenge version
objective targets
rubric version
criteria ownership
acceptable variants where applicable
hint ladder
verification requirements
```

Private solutions/rubrics may be hidden from learner-facing output, but the standard itself cannot be invented after the learner responds.

### Frozen challenge persistence invariant

`registerChallenge()` must durably persist the exact challenge version before it returns success. `openAttempt()` may only reference a persisted frozen version.

The physical owner may be an extension of upstream `problems` or a dedicated challenge-version table. Select that owner before challenge-version persistence is implemented; Phase 0 repository integration does not need to decide it. Regardless of the physical table, a fresh process must be able to reconstruct the registered version's:

```text
learner-visible payload
target objectives
objective-owned criteria
rubric/version
hint ladder
verification requirements
private assessment references
```

Interruption or agent replacement must not require regenerating the challenge or rubric.

## Multi-objective challenges

One challenge may target several objectives, but evidence is emitted separately.

Rules:

1. Each objective must be declared in `ChallengeSpec.targets` before the attempt.
2. Each objective must own at least one explicit criterion.
3. Assessment returns an objective-specific result and rationale for each target.
4. Persist one `EvidenceEvent` per assessed objective, all referencing the same attempt.
5. `ReviewRatingMapper` runs independently for each evidence event.
6. If the evaluator cannot separate performance for one target from another, mark that target `ungradable`; do not manufacture a score.
7. Secondary skills observed incidentally do not receive proficiency evidence unless they were frozen targets with criteria.

This prevents one successful interview from silently improving several unrelated capabilities.

## Assessment contract

### Input

```yaml
attempt_id: attempt_...
response_ref: attempt.response_text
artifact_ref: null
verification_output: null
```

The kernel resolves the frozen challenge ID/version from the attempt. Assessment callers do not re-supply challenge identity or other mutable challenge semantics.

### Output

```yaml
evaluator_type: agent
assessment_basis: frozen_rubric
objective_results:
  - objective_id: transactions:debug
    result: partially_correct
    criteria_met:
      - locate-race
    criteria_unmet:
      - explain-isolation-gap
      - propose-correct-fix
    misconceptions_observed:
      - transaction-implies-serialization
    misconceptions_cleared: []
    rationale: "..."
```

For executable tasks, `verification_output` is required when the frozen challenge says execution is required. V1 execution happens through the agent/local repository environment; the kernel persists the result and artifact reference.

## Atomic assessment commit

When assessment is accepted, perform the following in one SQLite transaction:

```text
persist assessment/attempt outcome
        ↓
derive objective-specific hint levels from hint_observations
        ↓
compute performed_at from attempt submission
        ↓
compute delay anchor/seconds from prior targeted attempts + exposure_events
        ↓
append one EvidenceEvent per objective
        ↓
append misconception observations
        ↓
rebuild affected objective projections
        ↓
run ReviewRatingMapper on each new event
        ↓
append review_events where a rating exists
        ↓
update/rebuild affected review_cards
        ↓
update session pending_action / phase
```

If any required step fails, roll back the transaction. Do not leave evidence committed while projection/card/session state remains stale.

## Atomic evidence-correction commit

Invalidation and restore use the same causal discipline. In one SQLite transaction:

```text
append evidence_revision
        ↓
if correcting the assessment value:
  append replacement EvidenceEvent (same frozen attempt/challenge, supersedes old event)
  append replacement misconception observations
  run ReviewRatingMapper on replacement
  append replacement review_event when a rating exists
        ↓
resolve current effective evidence validity
        ↓
rebuild affected objective projection in learner-time order
        ↓
recompute misconception/weakness state from effective source evidence
        ↓
rebuild review_card from effective review_events in (reviewed_at, seq) order
        ↓
remove review_card if no effective review history remains
```

Do not delete or rewrite the original `review_event` or `misconception_observation`. Their effective validity is inherited from the source `EvidenceEvent`. A corrected replacement gets its own derived observations/review event. Restoring evidence re-includes the original derived events during replay and is rejected if doing so would conflict with an already-effective replacement for the same normal attempt/objective.

## `tutor today` contract

### Inputs

```yaml
goal_id: backend-interview
available_minutes: 45
now: "..."
```

The selector reads:

- active `goal_objectives` and their `importance`/target requirements;
- objective projections;
- due review cards and retrievability;
- active misconception/weakness signals;
- concept prerequisites;
- active goal deadline;
- recent challenge forms/surfaces;
- available time.

### Goal urgency

Keep urgency generic and explicit:

- `goal_objectives.importance` declares `core`, `important`, or `supporting` for the active goal.
- The existing goal/topic deadline supplies `deadline_at` when available.
- Compute deadline urgency at selection time; do not persist a magic interview score.
- V1 does not ingest job descriptions automatically. Humans/agents may explicitly assign objective importance based on the current goal.

### Priority tiers

Use deterministic tiers:

```text
1. overdue core retrieval
2. active recurring/retest misconception or weakness
3. due core retrieval
4. blocked deadline-critical prerequisite
5. new or reinforcement work on a core/important objective
6. supporting objective
```

Within a tier, rank by:

```text
lower retrievability
prerequisite leverage
nearer active deadline
recent contradictory evidence
need for task-form/surface diversity
```

### Budget guards

- Ordinary review warm-up: maximum 3 items and maximum 5 minutes.
- Review debt cannot consume the full mission.
- Pending initial diagnostics run before ordinary transfer/durability work. A non-transfer diagnostic suppresses transfer pressure for that objective until qualifying evidence resolves the diagnostic.
- When several initial diagnostics are immediately eligible, the mission may schedule several of them and leave the remaining budget unallocated; regenerate the mission after their evidence changes learner state.
- If initial diagnostics are prerequisite-blocked, select useful prerequisite/foundation work rather than bypassing the blocker with transfer work.
- If `available_minutes >= 20` and a useful forward-progress objective exists, include at least one non-review main challenge.
- If `available_minutes >= 30` and an active deadline/interview goal makes transfer pressure useful, include one transfer/interview challenge only after pending initial-diagnostic requirements permit it.
- Do not hard-code fixed percentages for every session.

### Output

```yaml
mission_id: today_...
available_minutes: 45
items:
  - kind: retrieval
    objective_id: transactions:predict
    minutes: 4
    reason: "Due core objective; low retrievability."
  - kind: main
    objective_id: connection-pools:debug
    minutes: 26
    reason: "Core objective with recent contradictory evidence."
  - kind: transfer
    objective_id: connection-pools:debug
    minutes: 15
    reason: "Active interview goal; transfer not yet demonstrated."
```

Every selected item must have an explainable reason traceable to durable state.

## Teacher agent ↔ kernel protocol

The protocol is transport- and provider-neutral. ChatGPT is the preferred V1 interactive teacher, but the kernel must not depend on ChatGPT-specific conversation state, memory, tool transcripts, or identifiers. Codex, OpenCode, AGY, or another compatible agent may replace the teacher by using the same operations and durable state.

Use one active teacher/orchestrator at a time in V1. Do not introduce a network service, plugin framework, or multi-agent router solely for portability; the stable kernel contract is the portability boundary.

`src/teacher.ts::createTeacherKernel(db)` is the V1 in-process adapter. It binds the provider-neutral operations below to one database handle without storing provider conversation state. `listResumableSessions(topicId?)` lets a replacement teacher discover unfinished sessions before calling `resumeSession(sessionId)`; discovery does not depend on remembered chat identifiers.

Optional agent/model provenance may be recorded for audit, but it cannot alter evidence interpretation, projection rules, scheduler semantics, or resume correctness.

### 1. Request daily mission

```text
getTodayMission(goalId, availableMinutes)
→ DailyMission
```

### 2. Register/freeze a challenge

```text
registerChallenge(ChallengeSpec)
→ durably persisted frozen challenge ID/version
```

The kernel validates target objectives, criterion ownership, and required private assessment metadata, persists the exact frozen version, and only then returns success. A fresh compatible agent must be able to reconstruct that version without regeneration.

### 3. Open attempt before delivery

```text
openAttempt(challengeId, version, sessionId)
→ attempt ID + learner-visible challenge payload
```

The learner-visible payload excludes private solution material.

### 4. Record hint use

```text
recordHintUse(
  attemptId,
  {
    level,
    scope: { objective_id } | { criterion_ids: [...] } | { all_targets: true }
  }
)
```

Hint observations are durable and objective-aware. The kernel validates objective/criterion scope against the frozen challenge, assigns `recorded_at` from its own clock, and derives each objective's evidence `hint_level` as the highest relevant observation. If none applies, the level is L0. Record the observation before exposing the hint to the learner.

Once `submitAttempt()` succeeds, no further hint observation may be attached to that attempt.

### 5. Record material exposure

```text
recordExposure(
  sessionId,
  {
    attemptId?,
    objectiveIds: [...],
    exposureType,
    sourceRef?
  }
)
```

Call this before showing an explanation, answer, worked example, corrective feedback, or solution walkthrough that materially refreshes the listed objectives. The kernel assigns `occurred_at` from its own clock and persists one `exposure_event` per objective. If `attemptId` is present, the kernel validates that the scoped objectives belong to the frozen challenge targets. Post-attempt feedback therefore resets the future durability delay without changing the retrieval validity of the already-submitted attempt.

### 6. Submit learner work

```text
submitAttempt(attemptId, responseText?, artifactRef?)
```

For executable work, the agent runs the frozen verifier through the local environment and preserves command/output or equivalent deterministic artifact evidence.

### 7. Submit assessment

```text
recordAssessment(attemptId, AssessmentResult)
→ evidence IDs
→ updated projections
→ scheduler changes
→ next pending action
```

The kernel validates the assessment against the frozen challenge contract and performs the atomic assessment commit.

### 8. Correct evidence when assessment was wrong

```text
reviseEvidence(
  evidenceEventId,
  {
    action: invalidate | restore,
    reason,
    correctedObjectiveResult?
  }
)
→ updated evidence/projections/scheduler state
```

`correctedObjectiveResult` is allowed only with invalidation and causes the atomic corrected-replacement path. Restore reactivates the original event and its existing derived events only when that would not conflict with another effective replacement.

### 9. Resume after interruption

```text
resumeSession(sessionId)
→ phase
→ pending_action
→ active challenge/attempt
→ unresolved verification or assessment step
```

Recommended V1 session phases:

```text
idle
challenge_prepared
awaiting_response
awaiting_verification
awaiting_assessment
feedback
complete
```

A fresh compatible agent must be able to resume solely from persisted kernel state. Replacing ChatGPT with another teacher must not require learner-state migration or recovery of the previous provider's private conversation history.

## V1 stop line

These contracts are complete enough to start implementation. Do not expand V1 to include:

```text
kernel-owned sandbox infrastructure
automatic job-description ingestion
Bayesian knowledge tracing
multi-agent role orchestration
complex capability ontologies
weighted global mastery scores
UI/dashboard architecture
```

If implementation discovers a contradiction in these contracts, update the relevant ADR/spec before introducing a second source of truth in code.
