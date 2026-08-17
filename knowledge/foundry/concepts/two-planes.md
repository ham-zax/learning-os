---
id: two-planes
title: The Two Planes
difficulty: 1
prerequisites: [foundry-what-it-is]
tags: [orientation, foundation, architecture]
---

## Summary
Foundry splits its surface into a **product plane** (what customers touch) and a **company plane** (what the founder and crew touch). Both planes run on the same platform services, so every capability is built exactly once.

## Key Points
- **Product plane:** profile → matched jobs → tailored applications → tracking.
- **Company plane:** dispatch console, audit, tickets, content pipeline, finance dashboards, BI.
- Both planes run on the same platform services — "build each capability once" is the stated rule.
- One Next.js app serves both planes behind **role-gated routes**; splitting into two apps is an open decision revisited at monetization.
- The company plane is where the crew operates, which is why it needs the same audit and dispatch guarantees as the customer-facing side.
- First company-plane modules were decided at the Stage C review (2026-08-03): **CVE watch + cost-reporter together** — deterministic, useful at zero customer volume, and with no tainted-LLM or `act` surface.

## Deep Dive
The two-plane split is an economic argument disguised as an architecture diagram. A one-person company cannot afford to build a dispatch system for customers and a separate one for internal operations, nor an audit trail for the product and a different one for the back office. So the platform is built once and both planes are tenants of it.

Notice what this buys: the founder's own back-office actions go through the same unit-of-work, the same audit log, and the same permission checks as a customer's. There is no privileged side door. That is what makes "who did what, caused by what, costing what" answerable across the whole company rather than only the customer-facing part.

The choice of *which* company-plane module lands first is instructive. CVE watch and cost-reporter were picked because they are **deterministic and useful at zero customer volume** and have **no `act` or tainted-LLM surface** — i.e. they deliver value before there are any customers and they cannot be the thing that gets prompt-injected. Feedback and content pipelines wait for post-P8 volume.

## Practice Questions
1. Name the two planes and give two things each one contains.
2. What is the justification for both planes sharing platform services rather than each having their own?
3. Why were CVE watch and cost-reporter chosen as the first company-plane modules over, say, the content pipeline?
4. Today both planes are one Next.js app. What is the stated trigger for splitting them?

## Common Misconceptions
- "The company plane is admin tooling, so it can cut corners" → It runs on the same platform with the same audit and permission guarantees. There is no privileged side door.
- "Two planes means two deployments" → Today it is one Next.js app with role-gated routes. Splitting is an open decision, not the current state.
- "The company plane is for the founder" → It is for founder *and crew*. Agents operate there under their own identities.

## References
- `README.md` §Two planes, one platform
- `docs/glossary.md` §4 — Two planes
- `docs/sdd/architecture.md` §6 (web), §8 (open decisions)
