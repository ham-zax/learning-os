# Learning OS — Repository Instructions

Read `AGENTS.md` first. It describes the current runtime and state ownership.

Learning OS is no longer the upstream scalar SM-2 tutor. The current learner truth is objective-specific append-only evidence plus rebuildable projections and FSRS review state.

## Non-negotiable model

```text
concept × capability
→ frozen challenge/rubric
→ attempt
→ assessment
→ evidence
→ projections / weaknesses
→ FSRS
```

Capabilities:

```text
explain | predict | implement | debug | design
```

Delivery contexts:

```text
learn | practice | review | interview | mock
```

Do not use `concepts.status`, `ef`, `interval`, `repetitions`, `next_review`, or `last_grade` as authoritative learner state.

## Profiles and onboarding

- Global curriculum: `knowledge/`
- Managed learner persistence: `data/profiles/<profile-id>/tutor.db`
- Profile registry: `data/profiles/registry.json`
- Legacy compatibility DB: `data/tutor.db`

Use `src/workspace.ts` before a learner profile exists. Use `createTeacherKernel(db)` after opening a profile.

Confirmed onboarding must remain:

```text
intake → proposal → explicit confirmation → new profile → sparse objectives → diagnostics
```

Resume/JD claims are planning signals only. They cannot create readiness, transfer, durability, evidence, review events, or review cards.

## Change boundaries

- `src/profile/` owns profile identity and DB resolution.
- `src/onboarding/` owns intake/proposal/application planning.
- `src/kernel/foundation.ts` owns challenge/attempt/hint/exposure/resume contracts.
- `src/kernel/evidence.ts` owns assessment/evidence/projection correction.
- `src/scheduler/` owns FSRS integration.
- `src/selection/` owns deterministic challenge selection.
- `src/plan/today.ts` composes goal state, due work, weaknesses, and time budget.

Do not create a second mastery model, scheduler, profile registry, or provider-specific durable state.

## Routine commands

```bash
npm run typecheck
npm run build
npm run tutor -- profile list
npm run tutor -- onboard
npm run tutor -- today <goal-id>
```

Keep learner data, resumes/JDs, provider transcripts, and secrets out of Git.
