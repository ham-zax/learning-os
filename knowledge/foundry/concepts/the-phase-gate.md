---
id: the-phase-gate
title: The Phase Gate
difficulty: 2
prerequisites: [spec-altitudes]
tags: [workflow, process, judgment]
---

## Summary
Whether code may be written at all is decided by **one line**: `phase:` in `docs/constitution.yml`. In `design` it is prose only — no `src/`, no `package.json`, no dependencies. In `implementation` it is code, within the scope of the ticket you picked up, and nothing else. Every banner in README, AGENTS.md and CLAUDE.md is narrative *about* that line and never overrides it.

## Key Points
- `phase: design` — **prose only.** Config that governs how agents work here (`.claude/`, `docs/constitution.yml`, `.nvmrc`) counts as prose's infrastructure and is in scope.
- `phase: implementation` — code, **within the scope of the picked-up ticket** and nothing else.
- **The banners are not the gate.** If one disagrees with the constitution, the constitution wins and the banner is stale — say so, fix it, keep working.
- Currently `implementation`; the founder said "start" on 2026-08-03.
- Flipping the phase is `implementation.md` §8 step A: **one docs-only commit, no code** — flip the constitution, update STATUS, move FDY-001 `open → specced` in both the ticket and `index.json`, fix the asserting banners, commit.
- Reverting to `design` for a doc-only stretch is step A.1 backwards and **needs no ceremony — the gate is the flag, not a ritual.**

## Deep Dive
The reason to have a single machine-readable gate is that this repo is worked by agents as well as humans, and an agent reading five markdown banners will find at least one stale. Naming one authoritative line, and explicitly demoting everything else to narrative, makes "am I allowed to write code?" answerable by reading one value instead of adjudicating between documents.

The **fix-the-stale-banner-and-continue** instruction is a small piece of culture worth copying. The rule is not "stop and escalate on any inconsistency" — it is "the constitution wins, the banner is stale, say so, fix it, keep working." That keeps a documentation defect from becoming a work stoppage while still guaranteeing it gets repaired.

Step A of the start procedure is a good example of scoping discipline: only the flip is one commit; the environment setup (B) and the first ticket (C) are their own work. The runbook says conflating them is how a "start" commit turns into an unreviewable blob.

## Practice Questions
1. Where is the phase gate, and what are its two values?
2. In `design`, may you edit `.claude/settings.json`? Why or why not?
3. CLAUDE.md says implementation; constitution.yml says design. What do you do, in order?
4. Why is the phase flip a docs-only commit with no code?
5. Why is a single machine-readable gate especially important in this repo?

## Common Misconceptions
- "The README's status banner is authoritative" → It is narrative. `constitution.yml` decides.
- "Design phase means no file changes at all" → Prose plus prose's infrastructure (`.claude/`, `.nvmrc`, the constitution itself).
- "Implementation phase means you may improve anything you notice" → Within the picked-up ticket's scope, and nothing else.
- "Reverting to design needs an ADR" → It needs no ceremony. The gate is the flag.

## References
- `docs/constitution.yml`
- `docs/implementation.md` §0, §8
- `CLAUDE.md` §Phase banner
