---
id: local-first-and-ports
title: Local-First Development and the Port Pattern
difficulty: 3
prerequisites: [three-layers]
tags: [architecture, operations, judgment]
---

## Summary
Foundry runs entirely locally at T0 — no account, no key, no network needed to run anything in P0–P5. Every managed dependency sits behind a **port** with a local adapter first and a managed adapter later. Deployment grows through four topologies, T0 to T3, and the host decision is deliberately made cheap.

## Key Points
- **T0: all local** — api + worker in-process, Homebrew `postgresql@17` + pgvector, filesystem object store, local identity. P0–P5, the founder's machine.
- **T1:** one process, managed Postgres. **T2:** api and N workers as separate processes, one host. **T3:** remote workers, browser via a CDP `CrawlProvider` switch.
- **"The host decision is worth ~1.6 GB of RAM and nothing else"** (ADR-0012) — deliberately de-risked.
- Managed regardless of host: identity (Clerk), object store (R2), logs/metrics/BI (Grafana Cloud), uptime canaries, email (Resend), embeddings + LLM (BYOK). Always-on compute is only api + worker(s) + browser pool + reverse proxy.
- Node pinned **exactly** at 24.18.1.
- Nightly `pg_dump` in **every** topology — to `.data/backups/` at T0, to R2 from T1 on.
- Integration tests use a `foundry_test` database recreated per suite from a migrated template, **never a shared mutable DB**.
- Drivers are config-selected: the LLM driver is keyless by default and `api` **crashes at boot without a key rather than falling back to the stub** (ADR-0035). The embedding driver speaks the OpenAI shape and **asserts 1024** (ADR-0038).

## Deep Dive
The design goal is that a contributor can clone the repo and run everything with no cloud account. The port pattern is what makes that more than a mock: the local adapter is a real implementation of the same interface, so code written against it is code that works against the managed one.

ADR-0012's framing is the transferable idea. By keeping everything portable behind ports, the compute-host choice is reduced to a RAM comparison — **the decision that usually causes the most agonising is made cheap by construction**. Compare the §5 note: the managed list is what T0 is *portable to*, not what it replaces.

ADR-0035 is worth studying as a small, sharp decision. A missing API key could reasonably fall back to a stub driver — the app boots, tests pass, everything looks fine. It is rejected: `api` **crashes at boot**. The reasoning generalises to the whole repo — a silent degradation that leaves the system apparently working is worse than a loud failure, because the failure surfaces at the worst possible moment and attributes to the wrong cause. ADR-0038 does the same thing dimensionally: the embedding driver asserts 1024, so `FOUNDRY_EMBEDDING_DIM` can no longer disagree with the actual column.

## Practice Questions
1. What is T0 and what do you need to run it?
2. What does "the host decision is worth ~1.6 GB of RAM and nothing else" mean, and how was that achieved?
3. `api` starts with no LLM key. What happens, and why is that better than a stub fallback?
4. What does the embedding driver assert, and what class of bug does that close?
5. Why do integration tests recreate a database per suite?

## Common Misconceptions
- "Local-first means mocks" → Local *adapters* implementing the same port. Real implementations.
- "Managed services replace the local ones" → They are what T0 is portable to; each arrives behind its port when its phase does.
- "Falling back to a stub keeps the app running" → Rejected. Crash at boot; silent degradation is worse.
- "Backups start when we deploy" → Nightly `pg_dump` in every topology, including T0.

## References
- `docs/adr/0015-local-first-development.md`, `0012-compute-host.md`
- `docs/adr/0035-llm-driver-is-config-selected.md`, `0038-embedding-driver-and-the-1024-contract.md`
- `docs/sdd/architecture.md` §5, `docs/sdd/local-dev.md`
