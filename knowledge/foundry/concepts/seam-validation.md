---
id: seam-validation
title: Seam Validation and the Missing Control
difficulty: 5
prerequisites: [three-layers, the-services]
tags: [architecture, mastery, judgment]
---

## Summary
ADR-0008's acceptance criterion is that **the second application must land with zero changes to crawl/knowledge/matching** — "an acceptance criterion, not a vibe." But the intended second app became a *service* instead (ADR-0028), so the role transferred to the job app — which is app #1, whose contracts were shaped around it and therefore cannot test the claim.

## Key Points
- The seam-validation test: app #2 requires **zero changes** to crawl, knowledge, matching.
- ADR-0028 (2026-08-11) reclassified the tutor as **`services/learning`**, not an application, on the founder's decision D-009.
- Two reasons: the interaction (*"prepare me for this interview"*) is **synchronous**, and events are the worst shape for a user-initiated request expecting an answer; and the layering rule **does not actually wall off app data**.
- The uncomfortable finding: `layer-check` bans app→app **code** imports, but app tables live under `packages/storage/schema/app_<name>/` and every app imports `@foundry/storage/schema/...` freely. **A second app could read `app_jobs` tables today and every gate would pass.**
- Naming consequence: `services/learning`, not `services/tutor` — name the capability, not the product, or you import a product's name into the platform layer.
- The seam-validator role transferred to the job app, so **there is currently no independent validator**.

## Deep Dive
This is the most instructive thread in the repo because it is a case of the architecture's own control being quietly disarmed, and the ADR saying so out loud.

The test in ADR-0008 is well designed: app #2 landing without touching the services proves the services really are application-agnostic. Its power comes entirely from **independence** — app #1 cannot validate the seam because the contracts were shaped around app #1's needs. So when the intended app #2 was reclassified as a service and the role transferred to the job app, the criterion survived on paper while losing what made it evidence.

ADR-0028's category test is worth carrying: *"teach a person a topic and schedule its review" is domain-neutral; the domain arrives from the caller.* The proof is `matching` — it scores a profile against a corpus and knows nothing about jobs; the job app supplies the domain by writing a `factor_sets` row. If a candidate has that shape, it is a service. If it owns tables, vocabulary, and a customer surface, it is an application. And there is a third answer — neither.

The `layer-check` finding is the sharpest lesson: **a gate proves what it checks, not what you hoped it meant.** `layer-check` genuinely enforces the import graph. The wall people *believed* existed — app data isolation — was never enforced by it, and nobody noticed until an ADR examined the mechanism instead of the intention. Note also the ADR's framing of the real hazard: it was never picking the wrong mechanism, it was **not deciding**, and letting ungoverned cross-app table reads become the default nothing catches.

## Practice Questions
**Live state, verified 2026-08-16.** ADR-0028 is *accepted*, not *built*: `services/` today contains `agent-runtime`, `app-host`, `crawl`, `knowledge`, `matching` and `vulnscan` — there is no `learning`. So the seam-validator role has been transferred away from the tutor, and the replacement validator does not exist yet either. That is the state to hold in your head: the control was reassigned in prose and is currently unexercised by anything.

1. State the seam-validation criterion. What property makes it evidence rather than ceremony?
2. Why was the tutor reclassified from application to service? Give both reasons.
3. `layer-check` passes. What does that prove, and what does it *not* prove about app data?
4. What is the test for "is this candidate a service or an application?" Use `matching` to explain it.
5. Why `services/learning` and not `services/tutor`?
6. Who validates the seam today, and why is that unsatisfying?

## Common Misconceptions
- "Layering stops apps reading each other's data" → It stops app→app *code* imports. Schemas are imported from `packages/storage` by everyone.
- "Any capability an app needs can become a service" → Only domain-neutral ones. Otherwise `services/` becomes a product dumping ground.
- "The seam is validated because the criterion still exists" → It transferred to app #1, which structurally cannot test it.
- "Naming is cosmetic" → `services/tutor` would import a product's name into the platform layer.

## References
- `docs/adr/0008-layering-and-naming.md`, `0028-tutor-is-a-service.md`
- `docs/sdd/architecture.md` §2 item 6
- `scripts/lib/import-graph.mjs`
