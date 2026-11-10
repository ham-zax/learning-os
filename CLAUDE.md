# Learning OS — Repository Instructions

Read `AGENTS.md` first and follow its fast route selection before any tool call. The default connected workstation is **WebHarness ARM**, with canonical repository `/home/ubuntu/repo/learning-os`, unless the user explicitly names another checkout.

- **Ad-hoc teaching and conceptual Q&A** (no identified tracked episode or request for tracked study): answer directly. Do not discover profiles, create learner state, or blanket-load protocol/contract files. Use sources or execution only when the request requires them, and never claim mastery from conversation.
- **Tracked study, assessment, or resuming a learner**: verify the checkout; load `skills/learning-os-teacher/SKILL.md` and use its route tables to load only the active sections of `docs/teacher-agent-protocol.md` or `docs/kernel-contracts.md`; verify the public kernel route; resolve the intended profile/goal; and call `getStudyContinuation(...)` before acting. Never substitute chat history for durable kernel state.
- **New learner onboarding** (explicitly requests a tracked curriculum): use `src/workspace.ts` / `npm run tutor -- onboard` and wait for explicit confirmation before creating a profile.

Learning OS learner truth is objective-specific append-only evidence plus rebuildable projections and FSRS review state.

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

Concept rows are descriptive curriculum metadata, never learner-progress state.

## Profiles and onboarding

- Global curriculum: `knowledge/`
- Managed learner persistence: `data/profiles/<profile-id>/tutor.db`
- Profile registry: `data/profiles/registry.json`

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
npm test
npm run verify:courses
npm run check:entry
npm run build
npm run tutor -- profile list
npm run tutor -- onboard
npm run tutor -- continue <goal-id> [--minutes <n> | --one-episode]
npm run tutor -- today <goal-id>
```

Follow `AGENTS.md` for learner-state privacy: canonical managed `registry.json` and `tutor.db` files are versioned; checkpoint changed profiles before staging. Keep raw resumes/JDs, provider transcripts, configuration, and secrets out of Git. Repository access grants access to versioned learner evidence.
