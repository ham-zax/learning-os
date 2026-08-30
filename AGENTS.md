# AGENTS.md — Learning OS

## What this repository is

Learning OS is an evidence-driven programming learning system. It uses a TypeScript CLI and SQLite, with ChatGPT or another compatible agent acting as a replaceable teacher.

The authoritative learner model is objective-specific evidence, not legacy concept scores or self-ratings.

```text
concept × capability
→ frozen challenge
→ attempt
→ assessment
→ append-only evidence
→ projections / weaknesses
→ ReviewRatingMapper
→ FSRS
```

Core capabilities are exactly:

```text
explain | predict | implement | debug | design
```

Delivery contexts are exactly:

```text
learn | practice | review | interview | mock
```

## State ownership

- Global reusable curriculum lives under `knowledge/`.
- Managed learner profiles live under `data/profiles/<profile-id>/tutor.db`.
- `data/profiles/registry.json` stores profile metadata and the active profile only; registry writes are serialized across concurrent processes.
- `data/tutor.db` is supported only as the preserved legacy compatibility profile.
- Learner evidence, goals, review cards, weaknesses, sessions, and resumable state are profile-local.
- Canonical managed `registry.json` and `tutor.db` files may be versioned intentionally after a successful profile checkpoint.
- Raw resumes, job descriptions, chat transcripts, provider IDs, and API keys are not learner-state persistence.

Never treat these legacy `concepts` columns as authoritative mastery:

```text
status | ef | interval | repetitions | next_review | last_grade
```

They remain compatibility/provenance fields.

## Core paths

| Path | Responsibility |
| --- | --- |
| `src/workspace.ts` | Pre-profile teacher workspace: profiles, catalog, onboarding, profile opening |
| `src/profile/` | Learner profile registry and isolated DB resolution |
| `src/onboarding/` | Structured intake, information needs, adaptive proposal, confirmed application |
| `src/teacher.ts` | Provider-neutral teacher kernel bound to one learner DB |
| `src/kernel/foundation.ts` | Objectives, frozen challenges, attempts, hints/exposures, resume |
| `src/kernel/evidence.ts` | Assessment, append-only evidence, projections, correction |
| `src/selection/` | Deterministic challenge-intent selection |
| `src/scheduler/` | `ts-fsrs` adapter and evidence-to-rating mapping |
| `src/plan/today.ts` | Daily mission orchestration and goal time budget |
| `src/study/continuation.ts` | Read-only resume-before-budget-before-plan orchestration |
| `src/session/` | Ordinary learning-session flow |
| `src/interview/` | Coding and system-design interview flows |
| `src/db/database.ts` | SQLite schema, migrations, CRUD |
| `docs/kernel-contracts.md` | Authoritative V1 kernel contract |
| `docs/teacher-agent-protocol.md` | Learner-facing agent behavior and semi-strict tutoring policy |
| `skills/learning-os-teacher/` | Installable/portable teacher skill source |

## Onboarding contract

A new learner should flow through:

```text
structured intake
→ missing-information questions
→ purpose/time-aware proposal
→ explicit learner confirmation
→ new isolated profile
→ reusable/custom concept metadata
→ sparse goal objectives
→ initial diagnostics
→ evidence-driven daily learning
```

Resume/JD/self-reported experience may change coverage, priority, or diagnostic strategy. It must never create mastery evidence or FSRS state.

Preparation strategies are planning metadata:

```text
learn | refresh | diagnose_first | transfer_practice
```

They are not readiness states.

## Learner-facing teacher behavior

When an agent is acting as the learner-facing teacher, interviewer, onboarding guide, study coach, or session-resume agent, read and follow `docs/teacher-agent-protocol.md`.

Use the **semi-strict** policy:

- answer ordinary product/help questions and harmless factual clarifications directly;
- route what-to-study-next, quiz/interview/review/retest, progress/mastery, profile/goal state, resumption, challenge selection, and scheduling decisions through Learning OS;
- when an explanation, hint, or answer would affect an active attempt or pending diagnostic, preserve learner choice but record the corresponding hint/exposure before revealing it and never count the contaminated interaction as clean retrieval.

Do not run a separate generic ChatGPT/Claude tutoring or interview policy on top of Learning OS. The model may control conversational style and concrete challenge wording, but Learning OS remains the authority for learner truth and pedagogical sequencing.

Environment routing:

- CLI/IDE agents should use the current Learning OS Git root.
- Connected web sessions should use the user-named repository/worktree; the normal local path is `/home/hamza/repo/learning-os`.
- If repository access is unavailable, do not claim to have read or changed learner state.

The portable skill source is `skills/learning-os-teacher/`. Claude-compatible local sessions also expose `.claude/skills/learning-os-teacher/SKILL.md` as a thin wrapper over the same protocol.

## Important invariants

- Freeze an assessable challenge and rubric before the learner answers.
- One assessed objective produces one `EvidenceEvent`.
- Hints and answer/explanation exposure are recorded before they are shown.
- Confidence is metadata, never correctness.
- Guided or exposed performance does not silently extend FSRS intervals.
- FSRS owns **when** a valid retrieval is due.
- The selector owns **what/how** to practice next.
- Evidence corrections rebuild derived projections/cards; do not rewrite history.
- Coding correctness requires real executable verification when the challenge requires it. LLM review alone is qualitative.
- A fresh teacher must be able to resume from durable kernel state without previous chat history.
- Learner-facing continuation must call `getStudyContinuation(...)` before selecting new work.

## Commands

```bash
npm ci
npm run tutor -- profile create "My Profile"
npm run tutor -- profile list
npm run tutor -- profile checkpoint [profile-id]
npm run tutor -- onboard
npm run tutor -- continue <goal-id> [--minutes <n>]
npm run tutor -- today <goal-id>
npm run tutor -- <topic-id> --mode learn
npm run tutor -- <topic-id> --mode practice
npm run tutor -- <topic-id> --mode review
npm run tutor -- interview <concept-id> --type coding
npm run tutor -- interview <concept-id> --type system-design
npm run tutor -- due
npm run tutor -- stats
npm run typecheck
npm run build
```

Canonical managed learner state in `data/profiles/registry.json` and `data/profiles/<profile-id>/tutor.db` may be committed intentionally. Run `npm run tutor -- profile checkpoint [profile-id]` after study and before staging a database. Stage the canonical files; keep SQLite WAL/SHM/journal sidecars and registry lock/temp artifacts untracked.

Versioned learner databases contain responses, evidence, exposure history, goals, and scheduling state. Treat repository visibility and collaborator access as learner-data access. SQLite databases are binary: use one canonical writer, avoid independent edits to the same profile on multiple branches or machines, and choose one canonical database if histories diverge. A textual Git merge is not a database merge.

Keep `config.json`, raw learner documents, resumes, job descriptions, chat transcripts, provider IDs, API keys, secrets, and generated personal plans out of Git. Portable, intentionally curated learner examples or personalized lesson snapshots may be committed outside `data/` when they are human-readable, explicitly non-secret, and documented as examples rather than authoritative runtime state. Such snapshots are for learning/reference unless an explicit import/restore path exists.

## Documentation authority

When documentation conflicts, use this order:

```text
accepted ADRs
→ docs/kernel-contracts.md
→ docs/architecture.md + docs/evidence-model.md
→ docs/implementation-plan.md
→ research notes
```

Inspect the current implementation before changing contracts. The repository preserves Generic Tutor ancestry, but current Learning OS contracts override obsolete upstream SM-2 guidance.
