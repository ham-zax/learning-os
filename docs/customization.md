# Customizing Learning OS

Learning OS is meant to be adapted. The durable learning kernel stays small; most personal customization belongs in local configuration, the reusable `knowledge/` catalog, onboarding inputs, and the teacher experience around the kernel.

Use this guide if you want to turn the repository into your own interview coach, programming curriculum, codebase-learning system, or technical study environment.

## The four customization layers

Keep these layers separate:

| Layer | Owns | Typical customization |
| --- | --- | --- |
| `knowledge/` | Reusable curriculum | Add your technologies, concepts, prerequisites, and Markdown |
| Onboarding/goal inputs | What matters for this learner now | Target role, deadline, weak areas, strengths, priorities, available time |
| Teacher/workspace | Conversation and challenge delivery | ChatGPT/agent UX, semantic extraction, explanation style |
| Evidence kernel | What the learner has actually demonstrated | Change only when intentionally changing Learning OS semantics |

The most important rule is: **custom planning must not manufacture learner evidence.**

If your resume says you have five years of PostgreSQL experience, use that to choose a better starting diagnostic or a shorter refresh. Do not initialize readiness, transfer, durability, or review state from that claim.

## 1. Set personal local defaults

`config.json` is ignored by Git. A minimal local configuration is:

```json
{
  "daily_minutes": 45,
  "knowledge_dir": "./knowledge"
}
```

If the file is absent, the CLI defaults to:

```text
daily_minutes = 30
knowledge_dir = ./knowledge
```

A confirmed goal may have its own onboarding `minutesPerDay`. When onboarding supplies both daily and weekly availability (`minutesPerDay`, `daysPerWeek`, and `minutesPerWeek`), the values must agree; Learning OS blocks confirmation instead of choosing one conflicting budget. For `tutor today`, precedence is:

```text
--minutes override
    ↓
goal onboarding daily budget
    ↓
config.json daily_minutes
```

The offline `tutor onboard` command currently uses the repository `./knowledge` catalog. Programmatic teacher integrations can choose another catalog root through `createTeacherWorkspace({ knowledgeRoot })`.

## 2. Add your own curriculum topic

The onboarding catalog discovers direct subdirectories of `knowledge/` that contain a `manifest.json`.

For example, add:

```text
knowledge/
└── postgres/
    ├── manifest.json
    ├── transactions.md
    ├── isolation-levels.md
    └── connection-pooling.md
```

A minimal `manifest.json` looks like:

```json
{
  "topicId": "postgres",
  "topicName": "PostgreSQL",
  "description": "PostgreSQL internals and backend application behavior",
  "concepts": [
    {
      "id": "transactions",
      "title": "Transactions",
      "prerequisites": [],
      "difficulty": 2,
      "tags": ["database", "correctness"]
    },
    {
      "id": "isolation-levels",
      "title": "Isolation Levels",
      "prerequisites": ["transactions"],
      "difficulty": 3,
      "tags": ["database", "concurrency"]
    },
    {
      "id": "connection-pooling",
      "title": "Connection Pooling",
      "prerequisites": [],
      "difficulty": 2,
      "tags": ["database", "backend"]
    }
  ]
}
```

Manifest rules enforced by the catalog loader:

- `topicId` and `topicName` must be non-empty strings;
- topic IDs must be unique across the catalog;
- concept IDs must be unique across the catalog because learner databases and objective IDs use the concept ID as a profile-wide identity;
- difficulty must be an integer from 1 to 5;
- prerequisites must name concepts in the same topic manifest;
- tags and prerequisites are string arrays.

The root `knowledge/manifest.json` is useful as a human-readable topic index, but onboarding discovery reads each topic directory's own `manifest.json`.

## 3. Add concept Markdown

Markdown is reusable source material, not learner state.

For a concept with ID `isolation-levels`, the catalog looks for either:

```text
knowledge/postgres/isolation-levels.md
```

or:

```text
knowledge/postgres/concepts/isolation-levels.md
```

If neither exists, it can fall back to a topic `INDEX.md` when present. A concept can therefore exist as catalog metadata before a full lesson has been written.

Use `knowledge/concepts/_template.md` as a starting point:

```markdown
---
id: isolation-levels
title: Isolation Levels
difficulty: 3
prerequisites: [transactions]
tags: [database, concurrency]
---

## Summary
...

## Key Points
- ...

## Deep Dive
...

## Practice Questions
1. ...

## Common Misconceptions
- ...

## References
- ...
```

The topic manifest is the onboarding catalog authority for IDs, prerequisites, difficulty, and tags. Keep the Markdown front matter consistent with it for humans and other repository tools.

## 4. Materialize a topic into a learner profile

Global curriculum does not automatically become learner state.

Onboarding materializes only included concepts and required prerequisite metadata into the new profile. You can also initialize a topic manually for the selected profile:

```bash
npm run tutor -- init postgres knowledge/postgres/manifest.json
```

The selected learner database gets topic/concept metadata. Markdown remains in the shared `knowledge/` tree.

This distinction lets multiple learners reuse one curriculum while keeping their goals, evidence, weaknesses, and schedules fully isolated.

## 5. Handle a topic that does not exist yet

Onboarding can mark coverage as `create_missing` when the global catalog does not contain the requested concept.

The durable materialization contract still contains IDs, title, difficulty, prerequisites, and tags, but learner-facing clients should not ask the learner to author those technical fields. Use the shared adapter:

```ts
const missing = workspace.deriveMissingConceptMaterialization({
  proposal,
  coverageKey: "missing:postgresql",
  topic: "postgres",
  prerequisites: ["sql-fundamentals"],
});
```

The adapter derives the concept ID/title, uses the neutral V1 default difficulty, normalizes prerequisite IDs, and keeps tags empty unless a future product contract supplies them. The offline CLI uses this same adapter.

A custom concept can exist as profile-local metadata without a curated global Markdown file. Onboarding does not write into `knowledge/` as a side effect.

If that concept becomes generally useful, promote it later by adding a proper topic manifest/Markdown to the repository.

## 6. Customize what a learner is preparing for

The onboarding input supports structured fields for:

```text
target role
target outcome
purpose: interview | role_readiness | long_term_mastery
deadline
minutes per day / days per week / minutes per week
stack
must-cover areas
weak areas
strengths
existing experience
current study plan
exclusions / depriorities
structured source claims
```

Areas can optionally name a specific topic/concept and capability.

The core capabilities are intentionally small:

```text
explain
predict
implement
debug
design
```

Do not create new capabilities for delivery context, task form, transfer, retest, or urgency. Those are different dimensions of the learning contract.

The planner can assign different initial strategies to different objectives:

```text
learn
refresh
diagnose_first
transfer_practice
```

Those strategies are orchestration metadata. They never initialize mastery.

## 7. Build your own ChatGPT/agent teacher

Learning OS deliberately does not embed an onboarding LLM. A compatible teacher owns natural conversation and semantic extraction, then calls the deterministic workspace API.

Do not rely on the model's default tutoring behavior. The repository includes [the teacher-agent protocol](teacher-agent-protocol.md), a portable Skill source at `skills/learning-os-teacher/`, and a Claude-compatible local wrapper at `.claude/skills/learning-os-teacher/SKILL.md`. They all use the same semi-strict policy: harmless factual help can be direct, but next-action, challenge, evidence, hint/exposure, progress, and scheduling decisions stay under Learning OS ownership.

The pre-profile entry point is:

```ts
import { createTeacherWorkspace } from "./src/workspace.js";

const workspace = createTeacherWorkspace({
  dataDir: "./data",
  knowledgeRoot: "./knowledge",
});
```

A typical integration flow is:

```ts
const catalog = workspace.loadKnowledgeCatalog();
const planningNow = new Date().toISOString();

let intake = {
  targetOutcome: "Backend interview readiness",
  purpose: "interview" as const,
  deadlineAt: "2026-10-09T09:00:00.000Z",
  availability: { minutesPerDay: 45, daysPerWeek: 5 },
  mustCover: [
    { label: "Caching", topicId: "system-design", conceptId: "caching" },
  ],
};

const needs = workspace.planOnboardingInformationNeeds(intake, catalog);
// concept_scope needs include concrete `catalogCandidates` when available.
// You can also call workspace.resolveCatalogArea({ label: "database fundamentals" }, catalog).
// Ask the learner only the material questions represented by `needs`.

const proposal = workspace.buildOnboardingProposal({
  intake,
  catalog,
  now: planningNow,
});

// Show the proposal and let the learner revise the intake if desired.
// Do not call application until they explicitly confirm this exact proposal.

const result = workspace.applyConfirmedOnboarding({
  intake,
  catalog,
  planningNow,
  proposal,
  confirmed: true,
  confirmedAt: new Date().toISOString(),
  profile: { displayName: "Backend Interview Prep" },
});
```

Application rebuilds the proposal and compares it structurally with the supplied confirmed proposal. If the intake/catalog/time inputs changed, the stale proposal is rejected instead of silently applying a different plan.

After onboarding, open the learner profile:

```ts
const opened = workspace.openProfile(result.profile.id);

const context = opened.getPreparationContext(result.goalId);
const kernel = opened.kernel;

const requested = kernel.resolveRequestedChallenge({
  goalId: result.goalId,
  objectiveId: "load-balancing:design",
  deliveryContext: "interview",
  now: new Date().toISOString(),
});
// `requested.intent` is null when prerequisites block that requested objective.

// Use the kernel for learner interactions, then close when done.
opened.close();
```

A fresh compatible teacher can recover goal purpose, time budget, objective strategies, pending diagnostics, prerequisite gaps, and actual evidence state without access to the previous conversation.

## 8. Put learner data somewhere else

The CLI uses local `./data` for profile storage. Programmatic integrations can choose another local root:

```ts
const workspace = createTeacherWorkspace({
  dataDir: "/private/path/learning-os-data",
  knowledgeRoot: "./knowledge",
});
```

Each managed profile still gets its own database below that data directory.

Do not point multiple independent writers at the same learner profile. The current product assumes one active teacher/orchestrator at a time.

## 9. Customize challenge delivery without corrupting evidence

The teacher can change how it explains, asks questions, and presents scenarios, but an assessable challenge must be frozen before the learner answers.

Keep these responsibilities separate:

```text
onboarding       → initial goal and strategy
selector         → what objective/task form to target
teacher          → concrete learner-facing challenge
assessment       → correctness against frozen criteria
evidence         → what the attempt proves
FSRS             → when valid retrieval should recur
```

If you build a new teacher UI, preserve those boundaries rather than writing readiness or scheduler state directly.

## 10. Safe versus semantic customizations

Usually safe to customize freely:

- topic manifests and Markdown;
- local daily-minute defaults;
- profile display names/descriptions;
- natural-language onboarding UX;
- mapping your own source documents into structured `OnboardingIntake`;
- how a teacher explains an already selected concept;
- visual/UI presentation around the kernel.

Read the architecture contracts before changing:

- evidence validity rules;
- readiness/transfer/durability projection semantics;
- challenge freezing;
- hint/exposure provenance;
- weakness lifecycle reconstruction;
- ReviewRatingMapper;
- FSRS replay;
- prerequisite selection safety.

Start with [Architecture](architecture.md), [Evidence model](evidence-model.md), and [Kernel contracts](kernel-contracts.md) for those changes.

## 11. Keep private data out of the curriculum

Use this rule:

```text
knowledge/ = reusable source material
data/      = private learner state
```

Do not commit resumes, job descriptions, chat transcripts, private goal notes, or learner evidence into `knowledge/`.

`data/` and `config.json` are ignored by Git. Confirmed onboarding persists only the structured preparation context needed to keep the product usable after the original conversation disappears.
