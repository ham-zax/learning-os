---
id: the-gate
title: The Five-Command Gate and the Custom Checkers
difficulty: 2
prerequisites: [the-phase-gate]
tags: [workflow, process, verification]
---

## Summary
Verification is five commands, green, **in order**: `typecheck → lint → format:check → build → test`. **Build precedes test** (FDY-086) because most `@foundry/*` imports in tests resolve to `dist/`. Beneath them sits a set of repo-specific checkers that turn each architectural seam into a failing build.

## Key Points
- The five: `npm run typecheck`, `lint`, `format:check`, `build`, `test`. **Never mark work done without them.**
- **Order matters.** Build before test — tests import from `dist/`, so testing a stale build tests the wrong code.
- Custom checkers in `package.json`: `layer-check` (dependency direction), `lexicon-gate` (reserved vocabulary), `schema-home-check`, `scoped-read-check` (no unscoped queries), `checker-coverage-check`, `doc-claims-check`, `lifecycle-check`, and `verify`.
- `ui-single-source-check` rejects a second design system — a `src/components/ui/` directory outside `packages/ui`, or a Tailwind stylesheet whose `@source` does not point at the package.
- Node is pinned **exactly** at 24.18.1 (ADR-0015); a new toolchain (pnpm, bun, Docker) needs its own ADR.
- **Baseline the gate before you change anything.** A pre-existing red gate is a finding to report, not something to inherit silently.
- Design phase has its own verification: relative links resolve, the ADR log matches `docs/adr/`, no stray files.

## Deep Dive
Look at the checker list as a map of the architecture. Every seam you learned about has a script: layering → `layer-check`; reserved vocabulary → `lexicon-gate`; tenant scope → `scoped-read-check`; schema ownership → `schema-home-check`; design system → `ui-single-source-check`. That is ADR-0008's principle applied consistently — *a convention that isn't a failing build decays.* When you meet a new rule in this repo, a good habit is to ask which script enforces it; if none does, treat the rule as aspirational.

Two entries are meta and worth noting. `checker-coverage-check` guards the guards — it exists because a checker that silently stops covering something is worse than no checker, since it still reports green. And `doc-claims-check` verifies claims made in documentation against the repo, which is how a corpus this prose-heavy stays honest.

The `ui-single-source-check` failure mode is a good cautionary tale: a Tailwind stylesheet that does not point `@source` at `packages/ui` **renders the whole app unstyled while every other gate stays green.** A test suite can be entirely happy about an application nobody can use.

## Practice Questions
1. List the five commands in order.
2. Why must build run before test? What breaks otherwise?
3. Name three custom checkers and the architectural rule each enforces.
4. What does `checker-coverage-check` protect against, and why is that failure mode nasty?
5. What single misconfiguration renders the app unstyled while every gate stays green?

## Common Misconceptions
- "The order is arbitrary" → Build before test is load-bearing; tests resolve `@foundry/*` to `dist/`.
- "Green tests mean the app works" → The unstyled-app case passes every gate.
- "Custom checkers are optional extras" → They are how the architecture is enforced at all.
- "You can swap in pnpm if it's faster" → New toolchain needs its own ADR. Node is pinned exactly.

## References
- `CLAUDE.md` §Verification, `AGENTS.md`
- `docs/workflow.md` §The loop step 4
- `package.json` scripts
