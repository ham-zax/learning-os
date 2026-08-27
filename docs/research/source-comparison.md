# Source Comparison

This note records the intended reuse boundary. It is not a claim that all upstream code can be copied directly; provenance, licensing, and implementation quality must be checked before reuse. For `generic-tutor`, `package.json` declares MIT but the inspected repository lacks a root `LICENSE` file.

## `alienz-dev/generic-tutor`

### Reuse

Use as the candidate application shell because it already has:

- TypeScript/Node CLI structure;
- SQLite persistence;
- topics and concepts with prerequisites;
- sessions and reviews;
- problems and attempts;
- coding and system-design drill paths;
- goal/deadline planning;
- ingestion and knowledge-file concepts.

### Replace or redesign

The current learning-state core is not suitable as-is:

- concept mastery is one scalar status trajectory;
- SM-2 fields live directly on `concepts`;
- normal learning sessions self-grade recall 0-5;
- session grading directly mutates concept SM-2 state;
- coding grading is LLM reasoning over source/test descriptions rather than deterministic execution;
- system-design phase scores are partly inferred from feedback-text length;
- the LLM client depends on a sibling `nexus` repository through `file:../nexus`.

### Role

**Fork. Preserve the structural shell; replace the evidence/mastery/scheduling core.**

## `open-spaced-repetition/ts-fsrs`

### Reuse

Use the maintained TypeScript FSRS implementation rather than writing scheduling mathematics.

Expected responsibilities:

- card state;
- retrievability;
- due-date calculation;
- rating transition;
- rescheduling/replay helpers.

### Do not delegate

FSRS must not decide whether an attempt is valid learning evidence or what task type to present next.

### Role

**Direct dependency behind our scheduler interface.**

## `Nar101/learn-anything`

### Reuse conceptually

Strongest useful ideas:

- observable evidence, not content completion, drives mastery;
- useful human-facing labels such as `unknown`, `exposed`, `guided`, `independent`, `transferable`, and `durable`;
- explicit hint-level ceilings;
- current state distinct from historical-highest state;
- active misconceptions and promotion blockers;
- appendable evidence log;
- task/rubric frozen before the learner answers;
- `ungradable` as a first-class assessment outcome;
- delayed recall required for durable mastery;
- source of truth lives in durable course state rather than chat continuity.

### Adapt

Nar still tracks one ordered mastery state per node. Learning OS should instead use append-only evidence as truth and derive proficiency per **learning objective** (`concept × capability`). The labels above remain useful projections, but they are not an irreversible promotion ladder. `transferable` and `durable` summarize qualifying evidence under changed surfaces and real delays.

### Role

**Behavioral specification for evidence integrity and proficiency projection.**

## `mordor-forge/study-skill`

### Reuse conceptually

Useful patterns:

- durable workspace is authoritative rather than agent memory;
- explicit interrupted-session phases and pending action;
- learner implements exercises;
- due FSRS reviews appear as a short session warm-up;
- cap ordinary warm-up reviews rather than letting review consume the session.

### Do not copy directly into the core model

Its FSRS card represents a lesson and its recall rating is learner self-report after viewing a reference answer. That is too coarse for evidence-driven programming mastery.

### Role

**Session-lifecycle and UX reference.**

## `kartikth40/interview-sim`

### Reuse conceptually

Useful patterns:

- explicit interview phases;
- candidate-first reasoning rather than immediate solution reveal;
- challenge claims rather than rubber-stamp them;
- edge-case prediction and dry-run behavior;
- weakness lifecycle semantics: `new → recurring → improving → resolved → retest`;
- resolved weaknesses return for later re-verification;
- session replay captures key exchanges, not only a scorecard.

### Do not compose as a runtime dependency

Most of its high-value behavior is encoded in steering/spec markdown. The executable JavaScript core is relatively small and DSA-specific.

### Role

**Interview-state-machine and derived weakness-lifecycle reference.**

## `ChenChenyaqi/learn-anything`

### Reuse conceptually

Useful patterns:

- coding-assistant-native workflows;
- real learner-owned coding exercises;
- persistent local learning workspace;
- knowledge maps and practice artifacts.

### Limitation

Its mastery and review model is too shallow to become the authoritative kernel for this project.

### Role

**Exercise/workflow reference.**

## Composition rule

Do not create this:

```text
generic-tutor runtime
+ study-skill runtime
+ learn-anything runtime
+ interview-sim runtime
```

That would create overlapping lifecycle, persistence, grading, and scheduling systems.

Create this instead:

```text
generic-tutor structural shell
        |
        +-- our evidence/projection kernel
        +-- ReviewRatingMapper
        +-- ts-fsrs dependency
        +-- ported session rules
        +-- ported interview rules
        +-- ported weakness semantics
```

The durable data model is the integration boundary.