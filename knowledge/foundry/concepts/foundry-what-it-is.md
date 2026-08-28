---
id: foundry-what-it-is
title: What Foundry Is
difficulty: 1
prerequisites: []
tags: [orientation, foundation]
---

## Summary
Foundry is the **company operating system** for an AI-native one-person company (OPC) that sells services helping users apply for jobs. It is deliberately three things in one repository: infrastructure, general-purpose services, and applications. The founder is the only human; the "crew" is a team of agents, and every crew action is dispatched, budgeted, and audited by the platform.

## Key Points
- Three things in one platform: **infra** (identity/RBAC, audit, dispatch, logging, cost accounting, BI events), **general-purpose services** (crawl, knowledge, matching, agent-runtime), and **applications** (the job-application product first).
- One human — the founder. The crew is agents: publishing content, maintaining software, fixing CVEs, raising tickets, doing the revenue/cost math.
- Services are **application-agnostic by contract**. They are described as the company's durable technical assets — the thing that outlives any one product.
- Apps own only their own tables and consume services through typed contracts.
- The repo is a **modular monolith with hard seams** — one deployable that can split later.
- Sibling projects matter: `pilot` watches (read-only), `nexus` is an embedded knowledge-engine library, `job-hunter` is prior art that retires at parity.

## Deep Dive
The framing to internalise is that foundry is not "an app with some infrastructure." The README states the ordering deliberately: infra, then services, then applications. That ordering is the investment thesis — the job-application product is the first tenant of a platform meant to carry several.

This is why the codebase looks over-built for one product. `packages/` knows nothing about jobs. `services/` knows nothing about apps. Only `apps/` knows about résumés and postings. If you delete the entire job application, the platform still compiles and its data stays valid — that is an explicit design goal, not a happy accident.

The second framing: **agents are first-class actors, not automation.** An agent is a `users` row with `kind = 'agent'` holding scoped API keys. It shows up in the audit log under its own identity, never folded into "system". Almost every unusual decision in this repo follows from taking that seriously — if a non-human can mutate state and spend money, then attribution, budget, and containment have to be architectural rather than procedural.

Status as of mid-August 2026: phase is `implementation`, design stages A–D are accepted, P0–P4 are implemented and P5 is half-built.

## Practice Questions
1. Foundry is described as "three things in one platform." Name them in dependency order and say which one is allowed to know about the others.
2. Why does the platform layer refuse to know anything about job applications, when there is only one product today?
3. What is the "crew," and what database row represents a crew member?
4. What would still work if you deleted the entire job application from the repo, and what is that test called?

## Common Misconceptions
- "Foundry is the job-application product" → The job app is the *first tenant* of foundry. Foundry is the platform underneath it, and the platform is the durable asset.
- "The crew is a metaphor for background jobs" → No. Crew members are real `users` rows with `kind='agent'` and scoped API keys, and they appear in the audit log as themselves.
- "Services are shared code" → Services are application-agnostic *by contract*, with their own Postgres schemas. Sharing code is not the same as owning a domain.
- "Pilot and foundry are two halves of one system" → Pilot is read-only and merely watches. Foundry acts. The boundary is recorded as a cross-project ADR.

## References
- `README.md` — Foundry overview, two planes, sibling projects
- `docs/README.md` — doc map and read order
- `STATUS.md` — live phase and stage
