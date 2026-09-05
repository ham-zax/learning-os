# Learning OS

**Agent-native, local-first learning that remembers what you can actually do — not just what you have read.**

Learning OS is an open-source learning engine designed to be used through an AI agent that can access this repository or folder. Use Codex, Claude Code, OpenCode, ChatGPT with filesystem access, or another capable agent. The agent handles the conversation; Learning OS keeps the durable learner state.

> **The AI model is replaceable. Your learning history is not.**

Your goals, attempts, evidence, weaknesses, review timing, active sessions, study focus, and revision history live locally in Learning OS instead of disappearing with a chat thread.

Learning OS is built for programming learning, interview preparation, codebase onboarding, and other technical goals where "I read it" is not the same as "I can do it." It keeps planning separate from proof: your resume, experience, and self-reported strengths can shape the plan, but only actual attempts and assessments change learner state.

Learning OS runs locally with Node.js and SQLite. Its primary experience is agent-native and provider-neutral; the CLI remains available as an offline fallback and administrative surface.

## How it works

```text
you
  ↕ natural conversation
filesystem-capable AI agent
  ↕ public Learning OS APIs / CLI execution surface
Learning OS
  ├─ isolated learner profile database
  ├─ goals + concept × capability objectives
  ├─ attempts + evidence + exposure history
  ├─ readiness / transfer / durability projections
  ├─ weaknesses + misconceptions
  ├─ FSRS review timing
  ├─ resumable sessions + study focus
  ├─ revision notes
  └─ reusable curriculum under knowledge/
```

The agent is responsible for conversation, explanation style, challenge wording, and qualitative feedback. Learning OS owns durable learner truth, sequencing, evidence, scheduling, and continuation. A different compatible agent can resume from the same repository without needing the old provider conversation.

## What it helps with

Learning OS is strongest for technical learning where understanding has to survive contact with real work, for example:

- programming languages, frameworks, databases, and distributed systems;
- codebase onboarding and architecture understanding;
- debugging and causal reasoning;
- implementation and design practice against real repositories;
- system-design and software-engineering interviews;
- technical revision and spaced retrieval;
- custom structured curricula you add under `knowledge/`.

Give Learning OS a target such as:

> I have backend interviews in six weeks. I build Node APIs comfortably, but I want to get stronger at transactions, concurrency, connection pools, caching, and load balancing. I can study 45 minutes a day.

Learning OS can turn that into:

1. focused clarification questions instead of a giant questionnaire;
2. a preparation proposal you can review before anything is saved;
3. a new isolated learner profile after explicit confirmation;
4. only the curriculum and `concept × capability` objectives relevant to the goal;
5. initial diagnostic work where your actual level is uncertain;
6. daily missions driven by evidence, prerequisite readiness, weaknesses, deadlines, and FSRS review timing;
7. durable state that a fresh compatible teacher can resume without the old chat history.

Different objectives can start differently. One topic may need `learn`, another `refresh`, another `diagnose_first`, and another `transfer_practice`. Learning OS does not classify the whole learner as a beginner or refresher.

## Why Learning OS is different

- **Planning is not mastery.** Resume/JD/self-report information can change priority and starting strategy, but it does not create readiness, transfer, durability, evidence, or review cards.
- **Capabilities are tracked separately.** Being able to explain transactions does not imply you can debug a race condition or design a safe retry path.
- **Each learner is isolated.** Managed profiles use separate SQLite databases under `data/`; this repository may version those canonical files intentionally.
- **Curriculum is reusable.** Markdown and topic manifests under `knowledge/` are shared source material, not duplicated into every learner profile.
- **Scheduling and teaching have different owners.** FSRS decides when retrieval is useful; Learning OS decides what objective and task form should come next.
- **The teacher is replaceable.** Any compatible filesystem-capable agent can be the conversational layer; learner truth lives in the local kernel rather than provider memory.

## Features

### Durable learner database

Each managed learner profile has its own local SQLite database. Learning OS can persist:

- goals, deadlines, priorities, and preparation strategy;
- sparse `concept × capability` objectives;
- frozen challenges and their criteria;
- attempts, learner responses, artifacts, and deterministic verification output;
- hint and teaching-exposure history;
- evidence events and append-only evidence revisions;
- readiness, transfer, and durability projections;
- weaknesses and registered misconceptions;
- objective-level FSRS review cards and timing;
- resumable sessions, required reconstruction, and study-focus episodes;
- interaction preferences and evidence-grounded revision notes.

The database is the continuity layer. A new compatible agent can reopen it and continue from durable state rather than reconstructing the learner from chat history.

### Evidence-driven progress

Learning OS distinguishes planning signals from proof. A resume, years of experience, confidence, or “I already know this” can influence what gets prioritized, but only actual learner work can produce qualifying evidence.

Hints and explanations are tracked honestly. If the teacher supplies target reasoning, that interaction can still be useful learning, but it cannot silently become clean independent evidence. Historical evidence can be invalidated or restored append-only, and objective-scoped evidence receipts let a compatible agent explain why Learning OS currently considers something guided, independent, weak, transferable, durable, or unresolved.

### Concept × capability tracking

Learning OS does not collapse a topic into one mastery number. It can track separate objectives such as:

```text
transactions:explain
transactions:predict
transactions:debug
connection-pooling:design
retry-logic:implement
```

Knowing how to explain a mechanism is not automatically treated as being able to implement, debug, predict, or design with it.

### Adaptive onboarding and goal planning

Natural-language goals can become a structured preparation plan with minimal clarification. Learning OS keeps fuzzy matches provisional, shows a proposal before creating state, supports custom curriculum areas, and requires explicit confirmation before onboarding becomes durable learner state.

### Goal-aware orchestration

The next move can account for active goal objectives, prerequisite blockers, study focus, recent failures, weaknesses, deadline pressure, review timing, and unfinished work. Open sessions and required reconstruction resume before unrelated new work.

### Objective-level FSRS spaced repetition

FSRS owns review timing at the objective level. Learning OS separately owns challenge selection and task form, so spaced repetition can operate over explanation, prediction, implementation, debugging, and design evidence rather than only flashcard recall.

### Real-project learning

Learning OS can use real code, repositories, diffs, specs, traces, APIs, architecture documents, logs, query plans, and implementation tasks as learning surfaces. The agent can inspect the authoritative artifact, let the learner make the first meaningful move, verify against real behavior, and coach the smallest observed gap.

### Support-aware assessment

“Independent” does not have to mean “no tools.” A challenge can prospectively allow documentation, repository search, tests, a debugger, or other tools that are part of the intended performance environment. Answer-bearing teacher help remains exposure and cannot be laundered into independent evidence.

### Resumable across agents and sessions

Learning OS does not require provider conversation IDs. Stop a session, come back later, or switch to another compatible agent that can access the same repository and learner profile. Durable state tells the next teacher what is proven, what is exposed, what is unfinished, and what should happen next.

### Personalized revision notes

A compatible teacher can build revision notes from bounded durable learner context instead of inventing a recap from chat memory. Notes can target a profile, goal, concept, objective, session, current focus, or historical focus episode.

### Bring your own curriculum

Reusable curriculum lives under `knowledge/` as source-controlled topic manifests and Markdown. Add or replace material without duplicating the whole knowledge library into each learner profile.

## Teaching playbooks

The bundled `learning-os-teacher` Skill gives compatible agents a progressively loaded teaching repertoire. These are adaptive playbooks, **not** rigid session modes.

### Reasoning & Retrieval

Use for building and testing mental models:

- free recall and brain dumps;
- guided discovery and pattern noticing;
- confusion-pair discrimination;
- prediction before reveal;
- self-verification;
- boundary tests and thought experiments;
- positive and negative prior-knowledge bridges;
- progressive integration span;
- causal chunks and scaffold withdrawal.

### Debugging & Repair

Use when a prediction fails or a causal model breaks:

- competing hypotheses;
- fastest falsifiers;
- earliest consequential failure;
- learner self-localization;
- slip-vs-model-error distinction;
- mental-model autopsy;
- precision remediation;
- reconstruction;
- changed-surface retest authoring when Learning OS later selects it.

### Problem Solving & Implementation

Use for real project work:

- authentic artifacts and source fidelity;
- learner-first implementation;
- minimal decomposition around the selected objective;
- executable verification as the correctness owner;
- exact-error coaching rather than generic nearby lectures;
- compact evidence-grounded debriefs;
- transition to debugging only when a concrete failure appears.

### Performance & Interview

Use for interview, mock, and fluent execution:

- uninterrupted performance before coaching;
- realistic technical artifacts;
- reflection after assessment;
- contrastive benchmark feedback;
- interview-signal coaching kept separate from technical correctness;
- realistic pressure without artificial complexity.

## Quick start

### Best experience: use an AI agent

Requirements:

- Node.js 22 or newer;
- npm;
- an AI agent that can read and operate this repository/folder.

Clone and install:

```bash
git clone https://github.com/ham-zax/learning-os.git
cd learning-os
npm ci
```

Then point your agent at the repository and say something like:

```text
Use Learning OS as my durable learning system.
Read AGENTS.md and skills/learning-os-teacher/SKILL.md first.
If I do not have a learner profile, onboard me around my goal.
If I already have one, recover the durable state and continue the current goal.
Use Learning OS for sequencing, evidence, review timing, and progress claims;
do not infer mastery from chat memory.
```

From there, talk normally. Ask to learn a topic, prepare for an interview, understand a codebase, debug something, continue yesterday's work, review weak areas, or explain why Learning OS thinks an objective is not yet independent. The agent should operate the local Learning OS APIs/CLI for you and return the learner-facing interaction in conversation.

No proprietary model and no dedicated Learning OS MCP server are required. The only requirement for the agent-native workflow is that the agent can access and operate the folder.

### CLI fallback / admin surface

You can also operate Learning OS directly from the terminal. This is useful for offline use, integrations, inspection, and profile administration.

```bash
npm run tutor -- onboard
npm run tutor -- continue <goal-id>
npm run tutor -- continue <goal-id> --minutes 20
npm run tutor -- stats
npm run tutor -- due
```

The CLI uses the same durable profile, evidence, review, and continuation semantics as an agent integration. Declining onboarding confirmation creates no learner profile, and a break does not expire an unfinished attempt.

For the complete setup and agent integration flow, see [Getting started](docs/getting-started.md) and the [teacher-agent protocol](docs/teacher-agent-protocol.md). The portable agent guidance lives under [`skills/learning-os-teacher/`](skills/learning-os-teacher/).

## Profiles

Every managed profile owns its own learner database:

```text
data/
└── profiles/
    ├── registry.json
    ├── alice/
    │   └── tutor.db
    └── interview-prep/
        └── tutor.db
```

There is no automatic shared default learner. The registry contains profile metadata and the selected profile; mastery, goals, sessions, evidence, weaknesses, review cards, and resumable state remain inside that profile's SQLite database. Canonical `registry.json` and `tutor.db` files may be committed deliberately; transient SQLite and registry coordination files are ignored.

Useful commands:

```bash
npm run tutor -- profile create "Alice"
npm run tutor -- profile list
npm run tutor -- profile show
npm run tutor -- profile use alice
npm run tutor -- --profile alice continue <goal-id>
npm run tutor -- profile checkpoint alice
```

An existing pre-profile `data/tutor.db` is preserved as a legacy profile instead of being copied into new learners.

### Save learner state to Git

After study, checkpoint SQLite before staging the canonical profile:

```bash
npm run tutor -- profile checkpoint <profile-id>
git add data/profiles/registry.json data/profiles/<profile-id>/tutor.db
git commit -m "data: checkpoint learner progress"
git push
```

The checkpoint truncates the WAL, verifies database integrity, and leaves Git untouched. Never stage `tutor.db-wal`, `tutor.db-shm`, `tutor.db-journal`, or registry lock/temp artifacts.

This workflow can send learner responses, goals, evidence, exposure history, and scheduling state to the configured remote. Confirm repository visibility and collaborator access first. SQLite is binary: use one canonical writer and do not try to text-merge independently changed copies.

## Daily learning loop

The central unit is a sparse learning objective:

```text
concept × capability
```

The built-in capability vocabulary is:

```text
explain
predict
implement
debug
design
```

A learner might therefore have:

```text
transactions:explain
transactions:debug
connection-pooling:design
```

without creating every possible capability for every concept.

Actual learner work flows through one evidence model:

```text
frozen challenge
      ↓
attempt
      ↓
assessment
      ↓
evidence event
      ↓
readiness / misconceptions / weaknesses
      ↓
ReviewRatingMapper
      ↓
FSRS review timing
```

This is the same state used by ordinary practice, review, interview work, weakness retesting, resumable sessions, `tutor continue`, and `tutor today`.

## Customize it for yourself

Learning OS is designed to be forked and adapted rather than tied to one fixed curriculum.

You can customize four main layers:

| Layer | What you change |
| --- | --- |
| Personal defaults | Daily study minutes and knowledge path in local `config.json` |
| Curriculum | Topic manifests and Markdown under `knowledge/` |
| Goals | Onboarding intake, priorities, deadline, readiness/transfer/durability targets |
| Teacher experience | A compatible conversational client built on `createTeacherWorkspace()` and `createTeacherKernel(db)` |

The onboarding catalog automatically discovers topic directories containing `manifest.json`, so adding a curated topic does not require changing the learning kernel.

Start with [Customizing Learning OS](docs/customization.md). It includes a minimal topic manifest, concept Markdown structure, local config, profile storage options, and the workspace API boundary.

## Included curriculum

The repository currently includes reusable material/catalogs for areas such as:

- coding interviews;
- system design;
- Kubernetes;
- LLM engineering;
- Spring Framework;
- codebase-specific learning examples.

These are examples and starter material, not a mandatory universal curriculum. Add, remove, or replace topics for your own use.

## Useful CLI commands

| Command | Purpose |
| --- | --- |
| `npm run tutor -- onboard` | Build and confirm a structured preparation plan |
| `npm run tutor -- profile list` | List local learner profiles |
| `npm run tutor -- profile use <id>` | Select a learner profile |
| `npm run tutor -- profile checkpoint [id]` | Flush and verify canonical learner state before a Git commit |
| `npm run tutor -- continue <goal-id> [--minutes <n>]` | Resume unfinished work or return one next action |
| `npm run tutor -- today <goal-id>` | Build today's bounded evidence-driven mission |
| `npm run tutor -- goal <goal-id>` | Inspect/configure goal objective requirements |
| `npm run tutor -- interview <concept-id>` | Start an interview drill scoped to one concept |
| `npm run tutor -- due` | Show due objective-level review cards |
| `npm run tutor -- stats` | Show objective-level readiness and review statistics |
| `npm run tutor -- init <topic> <manifest.json>` | Materialize a topic manifest into the selected profile |
| `npm run tutor -- search <query> --topic <topic>` | Search profile concepts |

Run `npm run tutor -- --help` for the current command surface.

## Privacy and local data

Learning OS is local-first: the kernel runs against local SQLite. This repository also supports intentionally versioning canonical managed learner databases and profile metadata under `data/` after checkpointing. Versioning is optional operational persistence, not hosted synchronization.

Confirmed onboarding persists structured planning information needed for future operation, such as target, deadline, time budget, objective strategy, and diagnostic intent. It does **not** persist raw resumes, raw job descriptions, chat transcripts, provider message IDs, or API keys as learner state.

The global `knowledge/` directory is repository content and should contain reusable curriculum, not private learner history.

Transient SQLite sidecars are ignored. Canonical profile databases are not encrypted by Learning OS, so pushing one grants its repository readers access to the learner state it contains.

## Documentation

Start here:

- [Documentation index](docs/README.md)
- [Getting started](docs/getting-started.md)
- [Customizing Learning OS](docs/customization.md)

For contributors and integrators:

- [Architecture](docs/architecture.md)
- [Evidence model](docs/evidence-model.md)
- [Kernel contracts](docs/kernel-contracts.md)
- [Implementation plan](docs/implementation-plan.md)
- [Design decisions](docs/decisions/)
- [Source comparison](docs/research/source-comparison.md)

## Project status

Learning OS is an early open-source product with the core local learning loop implemented: isolated profiles, adaptive onboarding, sparse objectives, evidence/projections, objective-level FSRS scheduling, challenge selection, inspectable evidence, real-artifact pedagogy, interview evidence, resume-first continuation, study focus, revision notes, and safe profile checkpointing.

It is intentionally **not** a hosted SaaS. The recommended experience is a capable AI agent operating the local repository; the CLI remains available as a deterministic fallback/admin interface.

## Contributing

Contributions are welcome. Before changing learner-state semantics, evidence qualification, scheduling, challenge selection, or teacher authority boundaries, read [`AGENTS.md`](AGENTS.md), the [architecture](docs/architecture.md), [evidence model](docs/evidence-model.md), and [kernel contracts](docs/kernel-contracts.md). Keep provider-specific behavior outside the durable learner kernel unless the architecture explicitly requires otherwise.

For ordinary documentation, curriculum, integration, or usability improvements, prefer small focused changes that preserve the local-first and provider-neutral design.

## License

Learning OS is released under the [MIT License](LICENSE).

## Provenance

Learning OS evolved from `alienz-dev/generic-tutor` while replacing its scalar learner-state core. The Git graph preserves the upstream lineage. The current architecture also incorporates selected ideas from FSRS and several open-source learning/interview projects; see [source comparison](docs/research/source-comparison.md) and the ADRs for the exact decisions and boundaries.
