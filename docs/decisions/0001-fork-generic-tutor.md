# ADR 0001: Fork `generic-tutor` and replace its learning-state core

**Status:** Accepted

## Context

We evaluated several open-source learning and interview systems. No single project provides the required combination of:

- concept/prerequisite storage;
- persistent sessions and attempts;
- programming practice;
- interview workflows;
- high-integrity evidence;
- capability-specific proficiency backed by auditable evidence;
- spaced scheduling;
- transfer and weakness retesting.

`alienz-dev/generic-tutor` is the closest structural fit because it already provides a TypeScript/Node CLI, SQLite persistence, concepts, sessions, reviews, problems, attempts, planning, and coding/system-design interview flows.

Its current learning-state model is not sufficient for the target system. It stores one SM-2/mastery trajectory per concept, normal sessions are self-graded, and scheduling state is coupled directly to concept records.

Other projects contribute stronger ideas at narrower boundaries:

- `ts-fsrs` for maintained FSRS scheduling;
- Nar's `learn-anything` for evidence integrity, hint semantics, and assessment gates;
- `study-skill` for restart-safe learning sessions and capped review warm-ups;
- `interview-sim` for weakness lifecycle and interview behavior.

## Decision

Fork `generic-tutor` as the structural shell.

Do not merge the other learning systems as runtime dependencies.

Replace the learning-state core with:

```text
concept
  ↓
sparse learning objectives (concept × capability)
  ↓
append-only evidence + explicit misconceptions
  ↓
rebuildable proficiency + weakness projections
  ↓
ReviewRatingMapper
  ↓
FSRS timing
  ↓
challenge selection
```

Use `ts-fsrs` as an external dependency behind a local scheduler interface. Keep pedagogical evidence interpretation outside the scheduler; a local `ReviewRatingMapper` translates qualifying retrieval evidence into FSRS ratings.

Port behavioral ideas from Nar, `study-skill`, and `interview-sim` only where they fit the new durable model.

Use `/home/hamza/repo/learning-os` as the eventual product working tree and preserve `generic-tutor` upstream history/provenance when implementation begins.

## Consequences

### Positive

- Reuses a substantial amount of application structure instead of rebuilding CLI, SQLite, topic/concept storage, attempts, interview plumbing, and planning from zero.
- Keeps the project in TypeScript/Node, matching the intended programming-learning context.
- Makes append-only evidence the authoritative learner-history record while keeping current proficiency/weakness summaries rebuildable.
- Prevents multiple overlapping state/scheduler systems from competing.
- Makes learning, coding practice, debugging, review, and interviews consumers/producers of the same evidence model.

### Negative

- This is not a small scheduler swap. Core DB schema and session state paths will change.
- Existing concept status and SM-2 fields become legacy data that require migration or retirement.
- Some existing interview grading behavior must be rewritten rather than retained.
- The upstream `nexus` sibling dependency must be removed before the fork is cleanly standalone.
- Upstream provenance and license metadata must be preserved. `package.json` declares MIT, but the inspected repository lacks a root `LICENSE` file, so the missing license text should be clarified before redistribution if necessary.

## Rejected alternatives

### Build a new Learning OS from zero

Rejected because `generic-tutor` already owns several useful structural concerns and greenfield work would duplicate them.

### Compose all upstream runtimes

Rejected because `generic-tutor`, `study-skill`, Nar's `learn-anything`, and `interview-sim` each encode overlapping session, state, review, or grading semantics. Runtime composition would create multiple sources of truth.

### Fork `study-skill`

Rejected as the main base because its durable workspace and FSRS UX are useful, but its scheduled unit is lesson-centric and its review rating is learner self-report. It lacks the richer interview/problem persistence shell already present in `generic-tutor`.

### Fork Nar's `learn-anything`

Rejected as the main application base because it is primarily an Agent Skill/protocol. Its evidence semantics should inform the kernel, but it does not replace the application shell we need.

## Follow-up decisions

- ADR 0002 records the evidence-as-truth and rebuildable-projection decision.
- ADR 0003 records the scheduler-input policy, FSRS replay/cache boundary, and legacy SM-2 migration policy.
- `docs/kernel-contracts.md` fixes the V1 multi-objective evidence rules, goal/deadline prioritization contract, logical schema, projection rules, and teacher-agent↔kernel protocol.
- ADR 0004 records that ChatGPT is the preferred V1 teacher interface while the kernel remains agent-agnostic and replaceable by Codex, OpenCode, AGY, or another compatible client.