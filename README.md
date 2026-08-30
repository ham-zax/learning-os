# Learning OS

**A local-first learning system that turns your goal, time, strengths, and weak spots into an evidence-driven study plan.**

Learning OS is built for programming learning, interview preparation, codebase onboarding, and other technical goals where "I read it" is not the same as "I can do it." It keeps planning separate from proof: your resume, experience, and self-reported strengths can shape the plan, but only actual attempts and assessments change learner state.

The project is currently a **developer preview**. It runs locally with Node.js and SQLite, includes an offline CLI, and exposes provider-neutral APIs that a compatible ChatGPT/agent workflow can use as the conversational teacher.

## What it does

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
- **The teacher is replaceable.** ChatGPT can be the conversational layer, but learner truth lives in the local kernel rather than provider memory.

## Quick start

### Requirements

- Node.js 22 or newer
- npm

Clone the repository and install dependencies:

```bash
git clone https://github.com/ham-zax/learning-os.git
cd learning-os
npm ci
```

If you are working from a different fork, use that repository URL instead.

### Option A: onboard from the terminal

Run the structured offline onboarding flow:

```bash
npm run tutor -- onboard
```

The CLI will collect the minimum structured information it needs, show the proposed preparation plan, and ask for explicit confirmation. **Declining confirmation creates no learner profile.**

After confirmation it prints the new profile ID, goal ID, number of activated objectives, and the next action.

Then ask Learning OS to resume unfinished work or choose one next action:

```bash
npm run tutor -- continue <goal-id>
```

If nothing is open, continuation asks for the active-study time you actually have left. Supply it with:

```bash
npm run tutor -- continue <goal-id> --minutes 20
```

A break of two minutes, two hours, or longer does not expire an attempt. Open work resumes before budget collection or new planning. Wall-clock break time is never counted as study time.

### Option B: use a compatible AI teacher

The deterministic Learning OS kernel does not parse resumes or job descriptions with an embedded model. A conversational teacher can do that semantic extraction, then call the provider-neutral workspace API:

```text
conversation / resume / JD
        ↓
structured OnboardingIntake
        ↓
createTeacherWorkspace()
        ↓
information needs → proposal → explicit confirmation
        ↓
new learner profile + goal + objectives
        ↓
createTeacherKernel(db)
```

This keeps model/provider behavior outside durable learner semantics. Compatible teachers should follow the [teacher-agent protocol](docs/teacher-agent-protocol.md). The current evidence-safe pedagogy—prediction before reveal, learner-built models, failure autopsy/reconstruction, progressive scaffolding, discriminating challenges, and interview-signal separation—is described in the [teacher pedagogy design](docs/teacher-pedagogy-design.md). The portable `learning-os-teacher` Skill source lives under [`skills/learning-os-teacher/`](skills/learning-os-teacher/) for ChatGPT/web packaging and local-agent reuse. See [Getting started](docs/getting-started.md) for the full flow.

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

The core local product loop is implemented: profile isolation, confirmed adaptive onboarding, sparse objectives, evidence/projections, objective-level FSRS scheduling, challenge selection, interview evidence, resume-first continuation, safe profile checkpointing, and daily orchestration.

This is still a developer preview rather than a polished hosted application. The CLI is the concrete offline surface today; AI-teacher integrations are intentionally provider-neutral and are expected to run in an environment that can call the workspace/kernel APIs.

## Provenance

Learning OS evolved from `alienz-dev/generic-tutor` while replacing its scalar learner-state core. The Git graph preserves the upstream lineage. The current architecture also incorporates selected ideas from FSRS and several open-source learning/interview projects; see [source comparison](docs/research/source-comparison.md) and the ADRs for the exact decisions and boundaries.
