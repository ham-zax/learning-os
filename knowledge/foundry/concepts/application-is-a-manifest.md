---
id: application-is-a-manifest
title: An Application Is a Manifest
difficulty: 5
prerequisites: [seam-validation, ticket-lifecycle]
tags: [architecture, mastery, judgment]
---

## Summary
ADR-0039 generalises five one-at-a-time seam fixes into a single rule: an application exports **one manifest** and the platform mounts it. Its routes are **transport-neutral data plus a handler, never a Fastify registrar** — so an app cannot serve a route that skips `requirePermission`, and adding a route no longer means editing platform code.

## Key Points
- Five times a capability was correct, tested, and **unreachable by the layer that needed it**: `registerHandler` (ADR-0029), `buildWorker` (0031), `runHandler` (0034), the rich ctx (0036), and tailoring itself (FDY-152).
- FDY-152's line is the diagnosis: ***"a capability's tests and its wiring are different artifacts, and a green suite says nothing about the second."*** All five had passing tests.
- Root cause: **there has never been one place where an application declares itself**, so each seam was discovered and retrofitted alone.
- `ApplicationManifest` (in `services/app-host`) declares: `name`, `contracts`, `executor`, `factors`, `parsers`, `projectors`, `routes`, `permissions`.
- **A route is data and a handler, never a Fastify registrar** — moving `RouteRegistrar` into `services/` would drag Fastify into the services layer, inverting what `services/` means.
- Two things were broken *by construction* before this: you could not add a route without editing `apps/api/src/app.ts`, and `scripts/db-migrate.mjs` hardcoded the schema array — so app #2's first migration begins by editing a platform script.
- Implemented by FDY-159, **proven by FDY-160**.

## Deep Dive
The reason to study this ADR is the diagnosis, not the interface. Five separate correct-but-unreachable capabilities is not five instances of carelessness; it is one structural absence producing the same symptom repeatedly. The fix is therefore not a sixth move — it is creating the missing place where an application declares itself.

FDY-152's sentence deserves to be a habit: **tests and wiring are different artifacts, and a green suite says nothing about the second.** Every one of the five had passing tests. If you take one thing from Phase 4, take this — when you finish a capability, ask separately "is it tested?" and "is it reachable from where it needs to be called?"

The route decision is the subtle one, and the ADR flags that **the obvious design is the wrong one**. Letting an app supply a Fastify registrar is the natural move and would put an HTTP framework inside the services layer, inverting the meaning of `services/`. Making a route *data* keeps transport in `apps/api` and delivers a stronger guarantee for free: because the platform serves the route from the app's declaration, an app **cannot** hand-roll one that skips `requirePermission`.

Live state matters here (2026-08-16). FDY-159 shipped its **loader and stopped**: `bootAppWorker` throws `not implemented`, `apps/api/src/manifest-routes.ts` does not exist, `services/app-host` exports no route-mounting function, and `ApplicationManifest.routes` is declared, exported and **consumed by nothing**. FDY-159's AC2 was never verified because neither consumer existed to crash. So FDY-160 is "not a port, it is a build" — and it absorbs the remainder with `owned_paths` widened, because the original set held neither `apps/api/package.json` nor `apps/api/tsconfig.json`: **the ticket forbade its own first commit.** That last detail is a perfect miniature of this ADR's whole theme.

## Practice Questions
1. What single structural absence produced five separate "correct but unreachable" bugs?
2. Quote the FDY-152 line and say what habit it should create.
3. Why is a route data-plus-handler rather than a Fastify registrar? What would the obvious design cost?
4. What guarantee does the data-route design give for free?
5. FDY-159 is `green`. What actually works on main, and what does that say about ticket status as a signal?
6. What does "the ticket forbade its own first commit" mean?

## Common Misconceptions
- "Five similar bugs means five careless authors" → One missing declaration point, five symptoms.
- "Passing tests mean the capability is usable" → All five had passing tests and were unreachable.
- "Apps should register their own routes with the web framework" → That drags Fastify into `services/` and reopens the skip-`requirePermission` hole.
- "A ticket at `green` means the feature works" → FDY-159 is `green`; its declared type is consumed by nothing.

## References
- `docs/adr/0039-an-application-is-a-manifest.md`
- `docs/techspec/app-onboarding.md` §10
- `STATUS.md` — FDY-160 section
