# Getting started with Learning OS

Learning OS is a local-first, agent-native learning product for technical study. The recommended experience is to give a capable AI agent access to this repository/folder and learn through normal conversation while Learning OS owns durable learner state, evidence, sequencing, and review timing.

This guide takes you from a fresh clone to an agent-operated learner profile, a resumable study action, and a safe learner-state checkpoint. The CLI remains available as an offline fallback and administrative surface.

## 1. Install

Requirements:

- Node.js 22 or newer
- npm

From the repository root:

```bash
npm ci
```

Run the CLI through the repository script:

```bash
npm run tutor -- --help
```

You can also build the package with `npm run build`; the package exposes `tutor` from `dist/cli.js` after build.

## 2. Start with an AI agent (recommended)

Use any AI agent that can read and operate this repository/folder: Codex, Claude Code, OpenCode, ChatGPT with filesystem access, or another compatible agent. Learning OS does not require a particular model, provider, IDE, or dedicated MCP server.

Point the agent at the repository and start with:

```text
Use Learning OS as my durable learning system.
Read AGENTS.md and skills/learning-os-teacher/SKILL.md first.
If I do not have a learner profile, onboard me around my goal.
If I already have one, recover the durable state and continue the current goal.
Use Learning OS for sequencing, evidence, review timing, and progress claims;
do not infer mastery from chat memory.
```

For learner-facing agent sessions, [`teacher-agent-protocol.md`](teacher-agent-protocol.md) is the repository authority and [`learning-os-teacher`](../skills/learning-os-teacher/SKILL.md) is the portable teacher Skill. The agent should use public Learning OS boundaries rather than writing SQLite state directly.

The conversational path is:

```text
natural-language goal / resume / job description / current project
        ↓
agent extracts structured planning input
        ↓
createTeacherWorkspace()
        ↓
Learning OS returns information needs
        ↓
agent asks only useful clarifications
        ↓
Learning OS builds a deterministic proposal
        ↓
learner reviews / revises / explicitly confirms
        ↓
new isolated profile + goal + objectives
        ↓
createTeacherKernel(db)
        ↓
resume or select one evidence-producing next action
```

A conversational teacher can collect richer context naturally. For example:

> I have backend interviews in six weeks. I know Node APIs well, but I do not properly understand concurrency, transactions, connection pools, caching, or load balancing. I can study 45 minutes a day, five days a week.

Resume and job-description claims remain planning input only. A claim such as "PostgreSQL — 5 years" may influence whether Learning OS starts with refresh or diagnostic work, but it cannot create `guided`, `independent`, transfer, durability, evidence, or review scheduling.

Learning OS has one onboarding model regardless of front end. Before anything becomes durable, the learner must see and explicitly confirm the current proposal. Fuzzy curriculum matches remain provisional until confirmed.

### CLI fallback onboarding

If you do not have a filesystem-capable agent, run:

```bash
npm run tutor -- onboard
```

The structured CLI asks for the same core planning information, shows included/deferred coverage and per-objective strategy, and asks:

```text
Apply this plan and create a NEW learner profile? [y/N]
```

Answering no creates no learner profile. The resulting profile uses the same evidence, scheduling, and continuation model as the agent-native path.

## 3. Understand what confirmation creates

After a confirmed onboarding, Learning OS creates a new managed profile and selects it only after configuration succeeds.

The profile receives its own SQLite database under:

```text
data/profiles/<profile-id>/tutor.db
```

The profile database owns that learner's:

- goal and deadline;
- activated/imported concept metadata;
- sparse learning objectives;
- goal-objective requirements;
- preparation strategies;
- sessions and resumable state;
- attempts and evidence;
- misconceptions and weaknesses;
- FSRS review history/cards.

The repository `knowledge/` directory remains shared. Learning OS does not copy the Markdown library into each profile.

## 4. Inspect and switch profiles

List profiles:

```bash
npm run tutor -- profile list
```

Show the selected profile:

```bash
npm run tutor -- profile show
```

Select another profile:

```bash
npm run tutor -- profile use <profile-id>
```

Use a one-command override without changing the selected profile:

```bash
npm run tutor -- --profile <profile-id> today <goal-id>
```

For normal resumption/next-action use, prefer:

```bash
npm run tutor -- --profile <profile-id> continue <goal-id>
```

You can also create an empty profile without onboarding:

```bash
npm run tutor -- profile create "My Profile"
```

That command intentionally creates no mastery, curriculum, or goal by itself.

If an older installation has `data/tutor.db`, Learning OS exposes it as a preserved legacy profile rather than copying or resetting it.

## 5. Resume or choose one next action

Confirmed onboarding prints the new goal ID. Use the continuation entry point:

```bash
npm run tutor -- continue <goal-id>
```

Continuation follows one fixed order:

1. resume unfinished required reconstruction first; otherwise resume the newest unfinished session for the goal;
2. when no work is open and remaining time is unknown, ask for it;
3. with a supplied budget, return at most one recommendation;
4. open no attempt until the learner accepts that recommendation.

A break of two minutes, two hours, or longer does not expire an attempt. Wall elapsed time is not active-study time. Resumption therefore does not require a budget; after open work closes, supply the active-study minutes currently left:

```bash
npm run tutor -- continue <goal-id> --minutes 20
```

If onboarding recorded `minutesPerDay`, continuation may display it as a suggestion when the remaining budget is unknown. It does not assume that the configured daily amount is still available after earlier study.

`tutor today` remains the lower-level bounded planner command. It requires or resolves a planning budget and may return multiple items unless its caller bounds the request:

```bash
npm run tutor -- today <goal-id> --minutes 20
```

When `minutesPerDay` and `daysPerWeek` are confirmed, Learning OS also persists their effective weekly capacity. If an integration supplies its own `minutesPerWeek`, it must agree with that product; conflicting availability remains a blocking onboarding question.

The daily planner uses current learner state rather than the original onboarding claims. It considers active goal objectives, due review cards, weaknesses, prerequisite blockers, deadline urgency, and recent challenge history.

FSRS owns **when** an objective is due. Challenge selection owns **what/how** to practice. Onboarding only establishes the initial goal and strategy.

A fresh learner may initially see prerequisite blockers or diagnostic work. That is intentional: unknown prerequisites should be diagnosed or learned rather than silently assumed.

## 6. Learn, review, and interview against the same state

Useful commands include:

```bash
npm run tutor -- interview <concept-id>
npm run tutor -- due
npm run tutor -- stats
npm run tutor -- goal <goal-id>
```

Ordinary learning sessions, interviews, reviews, and resumed sessions all feed the same evidence model. `due` and `stats` report objective-level FSRS/readiness state rather than legacy scalar concept status. A learner does not get a separate interview-only notion of mastery.

Run:

```bash
npm run tutor -- --help
```

for the full current CLI surface.

## 7. Add or activate curriculum manually

If you already have a profile and want to materialize a topic manifest directly:

```bash
npm run tutor -- init <topic-id> knowledge/<topic-id>/manifest.json
```

This copies topic/concept metadata into the selected learner database. The Markdown source remains under `knowledge/`.

See [Customizing Learning OS](customization.md) to add your own topic manifests and concept material.

## 8. Local configuration

`config.json` is ignored by Git. The current CLI uses `daily_minutes` as a fallback study budget and `knowledge_dir` for its knowledge-based session/plan flows:

```json
{
  "daily_minutes": 45,
  "knowledge_dir": "./knowledge"
}
```

If there is no `config.json`, the CLI defaults to 30 minutes and `./knowledge`. The offline `tutor onboard` flow currently scans the repository `./knowledge` catalog directly.

A goal-specific onboarding daily budget takes precedence over the global `daily_minutes` value for `tutor today`. An explicit `--minutes` takes precedence over both. `tutor continue` treats the goal budget as a suggestion only and asks for current remaining time before planning new work.

## 9. Checkpoint and version learner state

Canonical managed learner state is intentionally versioned in this repository. When learner state changes, flush the profile's WAL and verify integrity before staging and committing it:

```bash
npm run tutor -- profile checkpoint <profile-id>
git add data/profiles/registry.json data/profiles/<profile-id>/tutor.db
git commit -m "data: checkpoint learner progress"
git push
```

The checkpoint command changes only SQLite state; it does not stage, commit, or push. Keep `*.db-wal`, `*.db-shm`, `*.db-journal`, and registry lock/temp artifacts out of Git.

The canonical database contains learner responses, goals, evidence, exposure history, and scheduling state. Pushing it makes that state available to repository readers. Use one canonical writer: independently modified SQLite files on multiple branches or machines cannot be safely text-merged.

## 10. Where your data lives

```text
learning-os/
├── knowledge/              # reusable, versioned curriculum
├── data/                   # canonical profile files are versioned learner state
│   └── profiles/
│       ├── registry.json
│       └── <profile-id>/
│           └── tutor.db
└── config.json             # optional ignored local preferences
```

Do not put private learner history into `knowledge/`. It is repository content intended to be reusable.

Confirmed onboarding persists structured preparation context needed to resume later. It does not persist raw resumes, raw job descriptions, chat transcripts, provider message IDs, or API keys as learner state.

## 11. What to expect from the developer preview

The implemented core is real: profile isolation, confirmed onboarding, objective-level evidence, weakness projection, FSRS scheduling, challenge selection, interviews, resume-first continuation, profile checkpointing, and `tutor today` all share one learner-state model.

The product is not yet a hosted consumer application. Expect a local CLI and code-level teacher integration rather than account management, web UI, or a built-in LLM client for onboarding.

If your goal is to adapt the product to your own subjects, start with [Customizing Learning OS](customization.md). If your goal is to change learning semantics, read [Architecture](architecture.md) and [Kernel contracts](kernel-contracts.md) first.
