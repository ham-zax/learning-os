---
id: the-services
title: The Services Layer
difficulty: 2
prerequisites: [three-layers]
tags: [architecture, services, foundation]
---

## Summary
Four original domain services — `crawl`, `knowledge`, `matching`, `agent-runtime` — plus two added later, `app-host` and `vulnscan`. Each is application-agnostic by contract, owns a Postgres schema, and is consumed by apps through typed interfaces, never through its tables.

## Key Points
- **crawl** — target registry, fetch-policy router, fetcher tiers, raw captures. Tier selection is **data** (`fetch_stats`), not code (ADR-0009): T1 HTTP/ATS-JSON, T2 stealth browser, T3 managed unblocker.
- **knowledge** — documents, versions, chunks, entities, facts, provenance, indexing, hybrid search (FTS + vector, combined by RRF).
- **matching** — profiles, extraction, scoring. **Explainability is a schema requirement**: a match result carries per-factor contributions, not just a score (ADR-0022).
- **agent-runtime** — task contracts, prompt/tool registry, structured output, cost accounting, model routing. **nexus lives here as an embedded library.**
- **app-host** — mounts application manifests (ADR-0039).
- **vulnscan** — CVE scanning behind a `VulnerabilityFeed` port; it **proposes remediations and never applies them** (ADR-0032).
- Apps consume services through typed contracts. **No cross-schema joins from apps.**

## Deep Dive
Two of these encode a general principle worth carrying around.

**Crawl: policy is data, not code.** Which fetcher tier to use for a host is decided by that host's measured success/block statistics, not by a branch someone wrote. When a site starts blocking you, the router demotes the tier automatically and the change is visible in `fetch_stats` — never silent. Compare with the failure table's phrasing: a blocked fetcher shows up as dropping per-target success telemetry, and the target is demoted or parked, *never silently*.

**Matching: explainability is schema.** `match_results` carries `factors JSONB` with per-factor contributions. The spec is emphatic that this is "a schema requirement, not a UI nicety" — meaning a scorer that cannot decompose its number is not implementable, regardless of what the UI chooses to show. ADR-0033 completes it: a run **names its factor set**; absent one, the app uses the tenant's newest, and **fails loudly if none exists**. That last clause matters in practice — as of 2026-08-15, `createFactorSet` had zero non-test callers, so nothing could be scored on a fresh database and both scoring entry points threw rather than degraded.

`vulnscan` is a good model of a well-shaped service: it takes a feed **port** rather than fetching for itself, and it proposes rather than applies. Both choices keep the blast radius of a compromised or wrong feed to "a suggestion nobody acted on."

## Practice Questions
1. Name the services and say what each owns.
2. How does crawl decide which fetcher tier to use, and why is that decision data rather than code?
3. What must a match result carry besides a score, and what does calling that "a schema requirement" rule out?
4. A run doesn't name a factor set. What happens — and what happens if there are none at all?
5. Why does vulnscan take a feed port instead of fetching, and why does it not apply its own fixes?

## Common Misconceptions
- "Services are shared utility code" → They own domains and Postgres schemas, and are application-agnostic *by contract*.
- "Apps can join across service schemas for a quick read" → Explicitly forbidden. Typed contracts only.
- "nexus is a service" → nexus is an embedded *library* inside agent-runtime. The README says it is never a platform.
- "Explainability is a UI feature" → It is in the schema; a non-decomposable scorer is not implementable.

## References
- `docs/sdd/architecture.md` §1
- `docs/sdd/services-{crawl,knowledge,matching,agent-runtime}.md`
- `docs/adr/0009`, `0022`, `0032`, `0033`
