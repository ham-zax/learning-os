# ADR 0003: Map retrieval evidence to FSRS through a versioned rating policy

**Status:** Accepted

## Context

The kernel records richer evidence than FSRS understands. Evidence includes correctness, hint use, novelty, delay, misconception observations, deterministic execution, and assessment provenance. `ts-fsrs` expects a card plus a review rating.

Allowing the FSRS adapter to interpret pedagogical fields would couple scheduling to interview/task semantics and make later policy changes difficult to audit.

Guided performance also must not silently lengthen review intervals. A learner who required a hint has not demonstrated the same retrieval as a learner who produced the answer independently.

## Decision

Insert a versioned `ReviewRatingMapper` between evidence assessment and the FSRS adapter.

Only an evidence event with `retrieval_valid=true` reaches the mapper. V1 sets `retrieval_valid=true` only for gradable, answer-hidden, L0 attempts that genuinely required retrieval/application and have deterministic verification when the frozen task requires it.

Use this V1 mapping:

```text
incorrect         -> Again
partially_correct -> Hard
correct           -> Good
ungradable        -> no scheduler update
retrieval_invalid -> no scheduler update
```

Do not emit `Easy` in V1.

Persist every mapper output as an append-only `review_event` with the mapper version, scheduler version, review time, and FSRS parameters needed for replay.

Persist current FSRS card state in `review_cards` as a rebuildable cache with indexed `due_at` and serialized card JSON.

Do not mathematically convert legacy concept-level SM-2 state into objective-level FSRS state. Preserve legacy data for provenance and establish new scheduler state from new valid retrieval evidence.

## Consequences

### Positive

- FSRS remains a timing engine rather than a learning-semantics engine.
- Guided or answer-exposed practice cannot extend review intervals.
- Scheduler decisions are auditable and replayable.
- A future rating policy can coexist with historical policy through `mapper_version`.
- Transfer success does not get misrepresented as an `Easy` memory rating.

### Negative

- Some useful but assisted practice will not update the FSRS card.
- Imported SM-2 users require baseline retrieval before trustworthy FSRS state exists.
- `review_events` adds one more durable event stream.

## Rejected alternatives

### Let the learner self-rate FSRS difficulty

Rejected because confidence/difficulty self-report is not correctness evidence and would reintroduce the upstream self-grading problem.

### Map transfer success to `Easy`

Rejected because transfer distance and subjective retrieval difficulty are different properties.

### Convert SM-2 `ef`/interval directly to FSRS card state

Rejected because the old scheduler is concept-level while the new scheduler is objective-level, and the state variables do not have equivalent semantics.
