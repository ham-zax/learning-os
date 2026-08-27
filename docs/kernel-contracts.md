# Kernel Contracts

## Purpose

This document fixes the V1 data and runtime contracts that implementation must preserve. It turns the architecture into concrete ownership boundaries so storage, assessment, scheduling, selection, and agent orchestration do not invent competing state models.

The kernel owns durable learner state. Agents may teach, generate challenges, run code, and evaluate open-ended responses, but they submit observations through these contracts rather than mutating mastery or scheduler state directly.

## Invariants

1. Append-only evidence and misconception observations are authoritative learner-history records.
2. Current proficiency, weakness summaries, and FSRS card state are rebuildable projections or caches.
3. A challenge is frozen before learner response when it can affect proficiency or scheduling.
4. One assessed objective produces one objective-specific evidence event.
5. Self-confidence never determines correctness or scheduler rating.
6. FSRS receives only scheduler ratings; it never interprets pedagogical evidence.
7. Agent/local execution is the V1 verifier for executable programming tasks.
8. Assessment commit is atomic: evidence, projections, misconception observations, scheduler input, and session progress either commit together or do not commit.

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

Goal-specific requirements and priority for an objective. `goal_id` points to the existing goal/topic planning owner chosen during fork integration.

| Column | Type | Rule |
| --- | --- | --- |
| `goal_id` | FK/text | Active learning/interview goal. |
| `objective_id` | FK | `learning_objectives.id`. |
| `is_active` | bool | Eligible for this goal's selection. |
| `importance` | enum/text | `core`, `important`, or `supporting`. |
| `target_readiness` | enum/text | `guided` or `independent`. |
| `require_transfer` | bool | Goal requires demonstrated transfer. |
| `require_durability` | bool | Goal requires demonstrated delayed retrieval. |
| `created_at` | timestamp | Association creation time. |
| `updated_at` | timestamp | Goal-metadata update time. |

Constraint:

```text
PRIMARY KEY(goal_id, objective_id)
```

The same objective may therefore be core for one goal and supporting or inactive for another without duplicating learner evidence.

### `objective_projections`

Rebuildable current summary for fast reads.

| Column | Type | Rule |
| --- | --- | --- |
| `objective_id` | PK/FK | One row per instantiated objective. |
| `readiness` | enum/text | `unknown`, `exposed`, `guided`, `independent`. |
| `historical_highest_readiness` | enum/text | Highest readiness ever demonstrated. |
| `transfer_state` | enum/text | `untested`, `demonstrated`, `contradicted`. |
| `durability_state` | enum/text | `untested`, `demonstrated`, `contradicted`. |
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
| `challenge_id` | FK/text | Frozen challenge version used for the attempt. |
| `response_text` | text/null | Learner answer when text-based. |
| `artifact_ref_json` | JSON/text/null | File/commit/diff/runtime artifact reference. |
| `started_at` | timestamp | Attempt start. |
| `submitted_at` | timestamp/null | Submission time. |

Do not duplicate a large learner response into each per-objective evidence event.

### `evidence_events`

Append-only objective-specific assessment history.

| Column | Type | Rule |
| --- | --- | --- |
| `seq` | integer PK/autoincrement | Canonical replay order. |
| `id` | text unique | Stable external ID. |
| `objective_id` | FK | Exactly one objective. |
| `session_id` | FK/null | Session provenance. |
| `problem_id` | FK/null | Existing problem if applicable. |
| `attempt_id` | FK/null | Learner attempt. |
| `task_id` | text | Stable task/challenge identity. |
| `task_version` | text/integer | Frozen version delivered. |
| `rubric_id` | text/null | Frozen rubric identity. |
| `rubric_version` | text/integer/null | Frozen rubric version. |
| `target_capability` | text | Capability measured by this event. |
| `task_form` | enum/text | See challenge contract. |
| `delivery_context` | enum/text | `learn`, `practice`, `review`, `interview`, `mock`. |
| `result` | enum/text | `correct`, `partially_correct`, `incorrect`, `ungradable`. |
| `hint_level` | integer | L0-L5. |
| `novelty` | enum/text | `same`, `variant`, `transfer`. |
| `retrieval_valid` | bool | Whether the event may reach `ReviewRatingMapper`. |
| `delay_seconds` | integer/null | Delay from the relevant previous exposure/retrieval. |
| `assessment_basis` | enum/text | `deterministic_execution`, `frozen_rubric`, `human`, `mixed`. |
| `evaluator_type` | enum/text | `kernel`, `agent`, `llm`, `human`. |
| `criteria_json` | JSON/text | Objective-specific criteria results. |
| `observed_errors_json` | JSON/text | Stable error categories where known. |
| `rationale` | text | Why this objective result was assigned. |
| `created_at` | timestamp | Observation time. |

Indexes:

```text
(objective_id, seq)
(objective_id, created_at)
(attempt_id)
(retrieval_valid, objective_id)
```

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

Projection rebuild uses the latest revision state for an event.

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
| `seq` | integer PK/autoincrement | Replay order. |
| `misconception_id` | FK | Stable misconception. |
| `objective_id` | FK | Objective on which it appeared/cleared. |
| `evidence_event_id` | FK | Supporting evidence. |
| `disposition` | enum/text | `observed` or `cleared`. |
| `created_at` | timestamp | Observation time. |

The latest valid observation determines current active/cleared status. Recurrence is represented by another `observed` row, not by resetting the record.

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
| `seq` | integer PK/autoincrement | Replay order. |
| `objective_id` | FK | Scheduled objective. |
| `evidence_event_id` | FK unique | One scheduler input per evidence event. |
| `rating` | enum/text | `Again`, `Hard`, or `Good` in V1. |
| `mapper_version` | text | Mapping policy version. |
| `reviewed_at` | timestamp | Time supplied to FSRS. |
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

The authoritative scheduler replay inputs are `review_events`; `review_cards` is the fast current projection.

## Proficiency projection rules

Projection consumes valid, non-invalidated evidence in `seq` order.

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
- `guided`: there is useful successful/partial performance with assistance, or current independent readiness has been contradicted by a newer unaided failure.
- `independent`: the two most recent qualifying unaided (`L0`) gradable attempts are both `correct`, use distinct task versions or materially distinct surfaces, and no active blocking misconception applies.

A newer qualifying unaided `incorrect` event immediately removes current `independent` readiness. Historical-highest readiness remains unchanged.

`partially_correct` never establishes independent readiness.

### Transfer

Transfer is independent of the readiness ladder:

- `untested`: no qualifying `novelty=transfer` evidence.
- `demonstrated`: the latest qualifying unaided transfer event is `correct`.
- `contradicted`: the latest qualifying unaided transfer event is `incorrect` or `partially_correct` after a prior demonstration.

A correct transfer event can also count as one of the two independent-readiness successes.

### Durability

Durability is also orthogonal:

A delayed retrieval qualifies for durability only when all are true:

```text
retrieval_valid = true
hint_level = L0
result is gradable
attempt occurred before re-exposure
elapsed delay >= 7 days
```

States:

- `untested`: no qualifying delayed retrieval.
- `demonstrated`: latest qualifying delayed retrieval is `correct`.
- `contradicted`: latest qualifying delayed retrieval is `incorrect` or `partially_correct` after a prior demonstration.

The seven-day floor is a V1 policy constant for the `durability_state` summary. FSRS continues to schedule later retrievals; repeated delayed evidence strengthens confidence without creating another mastery ladder.

### Misconception blockers

If the latest valid observation for an `is_blocking=true` misconception is `observed`, cap current readiness at `guided` even when surface correctness would otherwise qualify as independent.

A misconception clears only through an explicit `cleared` observation tied to new evidence. Elapsed time alone cannot clear it.

### Projection rebuild

Projection functions must be deterministic over:

```text
evidence_events
+ evidence_revisions
+ misconception_observations
+ projector_version
```

A full rebuild and an incremental update from the same event sequence must produce the same projection.

## Retrieval validity

`retrieval_valid` decides whether evidence may reach `ReviewRatingMapper`. It does not decide proficiency by itself.

Set `retrieval_valid=true` only when all applicable conditions hold:

1. The target was frozen before the attempt.
2. The expected answer/rubric was not shown before the learner response.
3. `hint_level=L0` for the objective-specific evidence event.
4. The task genuinely required retrieval/application rather than copying a visible example.
5. The result is gradable.
6. If executable correctness is required, deterministic execution/verifier evidence exists.
7. The learner response precedes corrective explanation or answer reveal.

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
- Create the first card when the objective produces its first `ReviewRatingMapper` output.
- Apply each later `review_event` exactly once in sequence.
- Query `review_cards.due_at` for due retrieval.
- If card state becomes suspect, rebuild it by replaying `review_events` with the recorded scheduler version/parameters.

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
challenge_id: tx-race-debug-001
challenge_version: 1
response_ref: attempt.response_text
artifact_ref: null
hints_used: []
verification_output: null
```

### Output

```yaml
evaluator_type: agent
assessment_basis: frozen_rubric
objective_results:
  - objective_id: transactions:debug
    result: partially_correct
    hint_level: L0
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
- If `available_minutes >= 20` and a useful forward-progress objective exists, include at least one non-review main challenge.
- If `available_minutes >= 30` and an active deadline/interview goal makes transfer pressure useful, include one transfer/interview challenge unless a prerequisite blocker is the more urgent work.
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

## Agent ↔ kernel protocol

The protocol is transport-neutral. It may initially be exposed through local TypeScript functions/CLI; do not introduce a network service solely for architectural purity.

### 1. Request daily mission

```text
getTodayMission(goalId, availableMinutes)
→ DailyMission
```

### 2. Register/freeze a challenge

```text
registerChallenge(ChallengeSpec)
→ frozen challenge ID/version
```

The kernel validates target objectives, criterion ownership, and required private assessment metadata before the challenge can affect proficiency.

### 3. Open attempt before delivery

```text
openAttempt(challengeId, version, sessionId)
→ attempt ID + learner-visible challenge payload
```

The learner-visible payload excludes private solution material.

### 4. Record hint use

```text
recordHintUse(attemptId, level, timestamp)
```

Hint observations are durable. The final objective-specific evidence uses the highest decisive hint level relevant to that objective.

### 5. Submit learner work

```text
submitAttempt(attemptId, responseText?, artifactRef?)
```

For executable work, the agent runs the frozen verifier through the local environment and preserves command/output or equivalent deterministic artifact evidence.

### 6. Submit assessment

```text
recordAssessment(attemptId, AssessmentResult)
→ evidence IDs
→ updated projections
→ scheduler changes
→ next pending action
```

The kernel validates the assessment against the frozen challenge contract and performs the atomic assessment commit.

### 7. Resume after interruption

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

A fresh agent must be able to resume solely from persisted state.

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
