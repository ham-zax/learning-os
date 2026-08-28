---
id: three-layers
title: Three Layers and the Dependency Direction
difficulty: 1
prerequisites: [foundry-what-it-is]
tags: [architecture, seams, foundation]
---

## Summary
Foundry is a modular monolith with three layers and one hard dependency direction: `apps → services → packages`. Packages are the platform and know nothing about any domain; services own domains and know nothing about apps; apps own their own tables and vocabulary. The direction is lint-enforced, not merely documented.

## Key Points
- `apps/` — `api` (Fastify), `web` (Next.js), `worker`, `cli`, `job`.
- `services/` — `crawl`, `knowledge`, `matching`, `agent-runtime`, plus `app-host` and `vulnscan`.
- `packages/` — `kernel`, `identity`, `authz`, `audit`, `tasks`, `dispatch`, `storage`, `telemetry`, `events`, `notify`, `ui`.
- Direction is enforced by ESLint `no-restricted-imports` zones **plus** a CI layering check (`npm run layer-check`).
- **No app imports another app.** Services never import apps; packages never import services.
- Postgres schemas mirror the layering — `platform`, `crawl`, `knowledge`, `matching`, `app_jobs` — with separate migration folders each.

## Deep Dive
The stated reason for mechanical enforcement is blunt: *"A convention that isn't a failing build decays."* Every seam in foundry has a corresponding script in `package.json` — `layer-check`, `lexicon-gate`, `schema-home-check`, `scoped-read-check`. If you can only find the rule in prose, the rule is not really enforced.

The "no app imports another app" rule is not decoration — it has already forced two architecture changes. ADR-0029 moved `registerHandler` from `apps/worker` into `packages/tasks`, because an app could not import another app and so the task-handler seam was *unreachable by any application*. ADR-0031 moved `createWorker`/`buildWorker` into `packages/dispatch` for the same reason: an app needs to run its own worker without importing `apps/worker`.

That pattern is worth naming, because you will meet it again: **when a seam turns out to be unreachable, the fix is to move the machinery down a layer, never to relax the direction.**

Schema separation is the deployment payoff. Because each service owns a Postgres schema with its own migration folder, extracting a service into its own process becomes a deployment change rather than a refactor.

## Practice Questions
1. State the dependency direction and name two mechanisms that enforce it.
2. `apps/job` needs to run a worker. Why can it not just import `apps/worker`, and what was done instead?
3. Why does each service get its own Postgres schema rather than sharing one?
4. You find a rule about layering that exists only in a markdown file. What does foundry's own reasoning say about that rule's future?

## Common Misconceptions
- "Modular monolith means the seams are soft" → The seams are mechanically enforced by lint and CI checks. "One deployable that can split" is about deployment, not discipline.
- "Layering is enforced by code review" → Explicitly rejected. Enforcement is CI, because conventions that don't fail builds decay.
- "If a layer boundary is inconvenient, work around it in the app" → The precedent (ADR-0029, ADR-0031) is the opposite: move the machinery *down* a layer.

## References
- `docs/sdd/architecture.md` §1–§2
- `docs/adr/0008-layering-and-naming.md`
- `docs/adr/0029-handler-registry-belongs-in-packages-tasks.md`, `0031-worker-machinery-belongs-in-packages-dispatch.md`
