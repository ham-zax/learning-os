# Retrieval-First Study Design

## Status

Approved documentation-first V1.

This design formalizes a retrieval-first study strategy that already exists in pieces across Learning OS. It does not add a new scheduler, mastery state, challenge type, learner model, or pedagogy engine.

The implementation target for V1 is the teacher contract and portable teacher Skill. Runtime or schema changes remain conditional on later fresh-teacher evidence.

## Summary

Retrieval-first study means:

```text
orient
-> generate before instruction
-> inspect the learner model
-> teach only the missing relationship
-> reconstruct when needed
-> stop
-> let Learning OS decide later retrieval
```

"Generate" is broader than factual recall. It means the learner produces the relevant reasoning before answer-bearing teaching when that gives a useful clean signal.

Examples:

```text
explain   -> free recall / brain dump
predict   -> commit to an outcome before reveal
debug     -> state a hypothesis or discriminating observation
design    -> construct the ownership / invariant / flow
implement -> plan or attempt the smallest selected implementation
```

These examples describe opening moves, not automatic completion evidence. A correct plan or hypothesis satisfies only the frozen criteria it actually demonstrates; the episode remains open until the selected task's required production, repair, and verification criteria are satisfied. In particular, an `implement` objective still requires a correct working implementation, and a `debug` objective still requires locating and repairing the failure when those are the selected criteria.

The strategy is adaptive. It is not a rule that every lesson begins with a quiz.

## Why this fits the current architecture

Learning OS already owns the pieces needed for retrieval-first study:

- onboarding can choose `learn`, `refresh`, `diagnose_first`, or `transfer_practice`;
- initial baseline/refresh/strength/transfer diagnostics are already represented through existing preparation metadata;
- challenge intent selection already owns which objective, capability, task form, novelty, weakness, and delivery context are current;
- frozen challenge + attempt state already gives a clean pre-instruction evidence boundary;
- hint and exposure provenance already distinguishes independent work from assisted learning;
- assessment already records criterion-level results, observed errors, and registered misconceptions;
- causal/foundational repair already supports durable reconstruction obligations;
- revision-note context already exposes learner responses, evidence, weaknesses, teaching artifacts, and recall material;
- selector + FSRS already own later variants, transfer, retest, and delayed retrieval.

Retrieval-first therefore belongs primarily in the teacher's execution policy for an already-selected episode.

## Architectural boundary

Learning OS still chooses what comes next.

The teacher may choose how to instantiate that move, including whether one compact clean generation step is useful before teaching.

```text
Learning OS selects objective/task intent
-> teacher uses retrieval-first when it improves the current episode
-> normal challenge/attempt/evidence lifecycle records what happened
-> normal feedback/exposure/reconstruction lifecycle repairs the gap
-> Learning OS selects any future variant/transfer/review
```

Retrieval-first must never independently choose:

- another objective;
- another capability;
- a retest;
- transfer;
- review timing;
- weakness lifecycle;
- readiness;
- durability;
- scheduler ratings.

## Relationship to revision-first courses

The coding packs use **revision-first** as course positioning: start from prior experience, recover usable models, and avoid unnecessary beginner coverage.

**Retrieval-first** is an episode-level teaching strategy inside that route.

Do not rename the existing `revision-first` course tags.

## Episode routing

Use retrieval-first when a clean learner-generated signal is useful and the learner has enough structure to make a meaningful attempt.

| Current situation | Default handling |
| --- | --- |
| Pending baseline/refresh/strength diagnostic | Start with an answer-hidden attempt. |
| New objective with enough context to attempt | Ask one compact generation question before explanation. |
| Due review | Use clean retrieval. |
| Transfer selected by Learning OS | Use a changed-surface generation attempt without revealing the mapping. |
| Correct and sufficient answer | Give concise feedback and close; do not reteach automatically. |
| Partial model | Teach the smallest missing relationship. |
| Coherent wrong causal model | Localize the faulty assumption, teach the minimum correction, reconstruct. |
| "I don't know" and the missing foundation is clear | Finish the honest assessment, teach the minimum foundation, then continue the normal repair flow. |
| "I'm stuck" but the blocker is unclear | Use the existing one-question blocker disambiguation rule. |
| Required reconstruction is pending | Finish reconstruction before any new cold probe. |
| Learner explicitly asks for explanation first | Respect the choice and use normal exposure semantics. |
| Interview/mock | Remain assessment-first; no answer-bearing coaching before the appropriate debrief. |
| Missing prerequisite makes an attempt meaningless | Use the existing scaffold/teaching path rather than forcing a cold failure. |

The teacher should use one compact retrieval move, not a mandatory pretest battery.

## Cold-attempt semantics

A pre-instruction attempt may reveal different states:

```text
retrieval absence
partial model
coherent wrong model
correct model
```

These must not be collapsed into one "gap" category.

### Retrieval absence

Examples:

- "I don't remember."
- "I don't know what happens here."

This can be a genuine unsuccessful attempt, but it does not demonstrate a specific misconception.

Do not invent an `observedErrors` category or misconception merely because recall failed.

### Partial model

The learner produces relevant pieces but misses a required relationship.

Assess against the frozen criteria. Teach only the missing relationship rather than the whole topic.

### Coherent wrong model

The learner states a model that predicts the wrong behavior.

This can justify a precise existing misconception or observed-error category when the response actually demonstrates it.

Use the existing causal repair path:

```text
expected result
-> faulty assumption
-> contradicting observation
-> corrected relationship
-> reconstruction
```

### Correct model

If the response satisfies the frozen criteria for the selected task, close the episode normally. An opening plan, hypothesis, or model does not complete production, repair, or verification criteria that it did not exercise.

Do not add a lecture, teach-back, boundary test, or bonus quiz merely because those techniques are available.

## Orientation versus exposure

Retrieval-first may begin with a small structural preview.

The distinction is semantic, not visual.

Usually safe orientation:

- topic title;
- neutral section headings;
- objective name in ordinary learner language;
- task context that does not reveal the target reasoning.

Answer-bearing material:

- a heading that states the target rule;
- a summary that supplies the mechanism;
- a worked example;
- a diagram that gives away the relationship;
- a highlighted conclusion or "key takeaway."

Example:

```text
Event Loop
Call Stack
Promises
Async Functions
```

can orient a recall attempt.

By contrast:

```text
Microtasks drain before the next task
await pauses only the async continuation
```

already supplies target reasoning.

If the preview materially reveals the answer, use the normal hint/exposure lifecycle before showing it. Calling it a heading or preview does not make it neutral.

## Interaction pattern

For an assessable retrieval-first episode:

```text
Learning OS selects the intent
-> teacher prepares the smallest compatible answer-hidden challenge
-> register/freeze
-> open attempt
-> present prompt and stop
-> collect learner response
-> submit / verify / assess
-> identify the exact demonstrated gap
-> prepare the exact answer-bearing repair
-> atomically record that teaching material and any required reconstruction obligation
-> show the repair
-> collect reconstruction or explicit opt-out when required
-> close the episode
-> call Learning OS for the next move
```

When causal/foundational repair requires reconstruction, set `requireReconstruction: true` in the same `recordExposure(...)` operation that durably stores the teaching artifact, immediately before showing the repair. This preserves the obligation across interruption before a replacement teacher resumes.

The existing evidence and scheduler rules remain authoritative throughout.

## Gap-focused notes

Do not create a second "gap notebook" store.

Use `getRevisionNoteContext({ scope })` and `saveRevisionNote({ context, markdown })`.

A useful compact note may contain only supported sections such as:

```markdown
## What I tried
<actual learner model or uncertainty when useful>

## Gap
<the demonstrated missing relationship>

## Correct model
<the minimum corrected model>

## Trap
<a supported near-miss or misconception, when one was actually observed>

## Recall prompt
<one hidden-answer prompt>
```

Omit unsupported or empty sections.

A revision note is a derived study artifact, not evidence. Showing answer-bearing note content during an active cold attempt still uses normal exposure handling.

## PedagogyDirective decision

Do **not** add an `entryStrategy: retrieval_first | instruction_first` field in V1.

The current `PedagogyDirective` is intentionally limited to demonstrated cross-teacher execution guardrails:

- `scaffold`;
- `commitBeforeReveal`;
- `questionChunking`.

Earlier richer typed pedagogy was deliberately removed because it duplicated teacher judgment and turned the repertoire into runtime taxonomy.

Retrieval-first remains protocol/playbook behavior unless fresh-teacher use demonstrates repeated failures that the current written contract cannot prevent.

### Escalation gate for a typed field

Only reconsider a typed entry strategy when all are true:

1. multiple fresh compatible teachers independently violate the same retrieval-first boundary;
2. the failure materially changes evidence quality or learner experience;
3. the failure cannot be fixed reliably through the protocol/playbook;
4. a deterministic field can express the missing guardrail without duplicating selector or evidence ownership.

## Learner preference decision

Do **not** add a persistent "retrieval-first learner" or learning-style field in V1.

The existing profile preference store is intentionally narrow and contains only explicit continuity settings with demonstrated restart value.

A learner may still make a current conversational request such as:

- "Ask me first before explaining."
- "Teach me directly this time."
- "Give me one question at a time."

Honor that request within the existing interaction and evidence rules.

### Escalation gate for a durable study preference

Only add a durable study-approach preference when fresh-session use shows that:

1. the learner repeatedly establishes the same preference as a stable instruction;
2. loss of that preference across replacement teachers materially harms continuity;
3. the preference cannot be represented by an existing setting;
4. persisting it will not be confused with competence or override higher-authority learning constraints.

## Non-goals

V1 does not add:

- a "shadow study" mode;
- a new capability;
- a new task form;
- a new mastery/readiness state;
- a new scheduler;
- a new review queue;
- a new gap table;
- a persistent gap taxonomy;
- a permanent learner-style classifier;
- mandatory multi-question pretesting;
- automatic source heading extraction;
- automatic textbook/video ingestion.

"Shadow study" may be used informally to describe the inspiration, but it is not an architecture term.

## Documentation implementation

V1 is implemented by aligning:

- `docs/teacher-agent-protocol.md`;
- `docs/archive/teacher-pedagogy-design.md`;
- `docs/technical-revision-teacher.md`;
- `docs/coding-courses.md`;
- `skills/learning-os-teacher/SKILL.md`;
- `skills/learning-os-teacher/references/teacher-protocol.md`;
- `skills/learning-os-teacher/references/reasoning-retrieval-playbook.md`.

No source/schema changes are required for this wave.

## Acceptance scenarios

### 1. New JavaScript mechanism

For an async/await objective, the teacher asks for the learner's current model before explaining when a clean attempt is useful.

If the learner says "I think await stops the whole script," the teacher may record that demonstrated model error, teach the smallest correction, and reconstruct.

If the learner says "I don't remember," the teacher must not invent the "whole script stops" misconception.

### 2. Correct cold answer

The learner answers the frozen retrieval question correctly and sufficiently.

The teacher gives concise feedback and closes. It does not force an explanation, another quiz, or a worked example.

### 3. Neutral structure

The teacher may show neutral headings before a brain dump.

If a heading itself states the target rule, it is treated as answer-bearing material rather than harmless orientation.

### 4. Learner requests direct teaching

The learner asks to skip the cold attempt and receive the explanation.

The teacher respects that choice, records exposure when required, and does not later claim the interaction was clean retrieval.

### 5. Later retrieval

After repair/reconstruction, the teacher does not create its own immediate "retention test."

Any later variant, transfer check, retest, or delayed retrieval comes from existing Learning OS selection and FSRS ownership.

## Bottom line

Retrieval-first study is an explicit teacher strategy over existing Learning OS state:

```text
generate before instruction when useful
-> diagnose only what the learner actually demonstrated
-> teach the smallest missing relationship
-> reconstruct when needed
-> let Learning OS own what comes next and when it returns
```

The first wave should make that behavior clear and portable before adding any new runtime state.
