# AGENTS.md — Learning OS

## What this repository is

Learning OS is an evidence-driven programming learning system. It uses a TypeScript CLI and SQLite, with ChatGPT or another compatible agent acting as a replaceable teacher.

The authoritative learner model is objective-specific evidence, not scalar concept scores or self-ratings.

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

- Global reusable curriculum lives under `knowledge/`. Coding routes are `knowledge/frontend-revision/` and `knowledge/backend-systems/`; read `docs/coding-courses.md` for discovery, exact scope, source references, practical work and profile attachment. Existing sibling source registries remain references; do not clone their corpora into learner databases.
- Managed learner profiles live under `data/profiles/<profile-id>/tutor.db`.
- `data/profiles/registry.json` stores profile metadata and the active profile only; registry writes are serialized across concurrent processes.
- Learner evidence, goals, review cards, weaknesses, sessions, and resumable state are profile-local.
- Canonical managed `registry.json` and `tutor.db` files are intentionally versioned learner state. When they change and a commit is being made, checkpoint the affected profile and include the canonical files; do not omit them as disposable runtime state.
- Raw resumes, job descriptions, chat transcripts, provider IDs, and API keys are not learner-state persistence.

Concept rows are descriptive curriculum metadata only. Learner progress belongs to objective evidence/projections and FSRS review state.

## Core paths

| Path | Responsibility |
| --- | --- |
| `src/workspace.ts` | Pre-profile teacher workspace: profiles, catalog, onboarding, profile opening |
| `src/profile/` | Learner profile registry and isolated DB resolution |
| `src/onboarding/` | Structured intake, information needs, adaptive proposal, confirmed application |
| `src/teacher.ts` | Provider-neutral teacher kernel bound to one learner DB |
| `src/kernel-cli.ts` | JSON shell surface over the teacher kernel (`npm run -s kernel`) |
| `src/knowledge/challenge-calibration.ts` | Discovers and builds calibrated prediction packs from `knowledge/<course>/challenges/` |
| `src/kernel/foundation.ts` | Objectives, frozen challenges, attempts, hints/exposures, resume |
| `src/kernel/evidence.ts` | Assessment, append-only evidence, projections, correction |
| `src/selection/` | Deterministic challenge-intent selection |
| `src/scheduler/` | `ts-fsrs` adapter and evidence-to-rating mapping |
| `src/plan/today.ts` | Daily mission orchestration and goal time budget |
| `src/study/continuation.ts` | Read-only resume-before-budget-before-plan orchestration |
| `src/session/` | Ordinary learning-session flow |
| `src/interview/` | Coding and system-design interview flows |
| `src/db/schema.ts` | Single current SQLite schema |
| `src/db/database.ts` | Database lifecycle and CRUD |
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

Learning OS is **agent-operated**. The learner's normal interface is the conversation with ChatGPT or another compatible agent, not the Learning OS CLI. In a connected web/chat session, the agent uses its WSL/repository connection to read the shared Learning OS checkout, invoke the public workspace/kernel boundaries or current CLI as an execution surface, persist/query learner state, and then return the learner-facing response in chat. The normal loop is therefore `learner message -> agent consults/invokes Learning OS in WSL -> agent responds in chat -> repeat`, and any fresh compatible ChatGPT session connected to the same canonical repository/profile must be able to continue from durable Learning OS state without prior chat history.

Do not require or design a dedicated Learning OS MCP server for this workflow. MCP/WSL access is the agent's bridge to the repository; Learning OS itself remains the local kernel/CLI and durable state owner. Likewise, do not instruct the learner to run routine `npm run tutor -- ...` commands as the primary learning UX unless the learner explicitly asks to operate the CLI. CLI commands are agent/admin/debug integration surfaces and fallbacks, not the intended conversational interface.

When acting as the learner-facing teacher, interviewer, onboarding guide, study coach, or session-resume agent, start with the source Teacher skill. Follow only the relevant sections of `docs/teacher-agent-protocol.md` selected by that skill.

### Required pre-teaching readiness (every new teacher instance)

Read the current checkout's `skills/learning-os-teacher/SKILL.md`. It is the short teacher entry point and owns route selection, readiness, and conditional instruction loading.
Verify the authoritative checkout before teaching. Honor a named workstation and intended profile; never silently substitute either.
For tracked work, call `getStudyContinuation(...)` before teaching or selecting work and reconcile the latest message with the returned state.
Use public workspace/kernel APIs only. Do not write learner SQLite directly or infer learner truth from chat memory.

Load only the skill's matching procedure sections and relevant curriculum. `docs/teacher-agent-protocol.md` is the detailed reference manual, not a mandatory full-file startup read.
Use `docs/kernel-contracts.md` for the specific operation's missing contract details, not as a default repository survey.
Reuse current instruction orientation during the session. Refresh continuation and active state on later learner turns and after interruptions.
Harmless product questions need no profile or kernel call. Ad-hoc teaching stays ephemeral unless the learner authorizes promotion.
If access fails, identify the missing boundary and offer conceptual help without claiming connected teaching or persisted state.

The skill's non-optional boundaries include frozen criteria, pre-display exposure, practical-work/installation consent, and text-first presentation.
Stable conceptual teaching needs no release lookup. Version-sensitive claims use the conditional research guide after episode resolution.
No generic tutoring policy, optional reviewer, visual build pipeline, or separate learner model may override Learning OS sequencing and evidence ownership.

Environment routing:

- CLI/IDE agents should use the current Learning OS Git root.
- Connected web sessions must use the user-named workstation/repository if specified; otherwise the canonical connected Learning OS workstation is **WebHarness ARM**, `/home/ubuntu/repo/learning-os`. Do not silently use non-ARM WSL `/home/hamza/repo/learning-os` unless the user explicitly chooses that environment.
- If repository access is unavailable, do not claim to have read or changed learner state.

The portable skill source is `skills/learning-os-teacher/`; provider-specific repository wrappers are intentionally not maintained.

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
- Learner-facing continuation must call `getStudyContinuation(...)` before selecting new work. An explicitly adopted one-episode route uses `oneEpisode: true` instead of a fictional minute allowance; actual budgets and elapsed-time FSRS semantics remain intact. Episode mode and `availableMinutes` are mutually exclusive.

## Commands

```bash
npm ci
npm run tutor -- profile create "My Profile"
npm run tutor -- profile list
npm run tutor -- profile checkpoint [profile-id]
npm run tutor -- onboard
npm run tutor -- continue <goal-id> [--minutes <n> | --one-episode]
npm run tutor -- today <goal-id>
npm run tutor -- <topic-id> --mode learn
npm run tutor -- <topic-id> --mode practice
npm run tutor -- <topic-id> --mode review
npm run tutor -- interview <concept-id> --type coding
npm run tutor -- interview <concept-id> --type system-design
npm run tutor -- due
npm run tutor -- stats
npm run -s kernel -- <method> '<json-arg>'   # teacher-kernel JSON surface for shell-connected agents
npm run pack:new -- <course> <concept-id>    # scaffold a calibrated prediction pack
npm run typecheck
npm run build
```

Canonical managed learner state in `data/profiles/registry.json` and `data/profiles/<profile-id>/tutor.db` is intentionally versioned. After learner state changes, run `npm run tutor -- profile checkpoint [profile-id]` before staging the database. When committing a work wave that includes those changes, include the changed canonical files; do not leave them out merely because they are learner/runtime data. Keep SQLite WAL/SHM/journal sidecars and registry lock/temp artifacts untracked.

Versioned learner databases contain responses, evidence, exposure history, goals, and scheduling state. Treat repository visibility and collaborator access as learner-data access. SQLite databases are binary: use one canonical writer, avoid independent edits to the same profile on multiple branches or machines, and choose one canonical database if histories diverge. A textual Git merge is not a database merge.

Keep `config.json`, raw learner documents, resumes, job descriptions, chat transcripts, provider IDs, API keys, secrets, and generated personal plans out of Git. Portable, intentionally curated learner examples or personalized lesson snapshots may be committed outside `data/` when they are human-readable, explicitly non-secret, and documented as examples rather than authoritative runtime state. Such snapshots are for learning/reference unless an explicit import/restore path exists.

## Documentation authority

When documentation conflicts, use this order:

```text
accepted ADRs
→ docs/kernel-contracts.md
→ docs/architecture.md + docs/evidence-model.md
→ approved focused design docs
→ research notes
```

Inspect the current implementation before changing contracts. Historical Generic Tutor ancestry remains in Git/ADRs, not in the active learner-state contract.
