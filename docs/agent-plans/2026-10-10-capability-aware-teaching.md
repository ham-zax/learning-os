# Capability-Aware Teaching Implementation Plan

**Goal:** Make Learning OS teaching agents choose useful, available instructional formats across web, CLI and MCP environments without changing learner-state authority.

**Architecture:** Add a small pure modality-ranking helper and standalone DB-free command for agents that want a structured decision. Update repository-local teacher instructions to perform lightweight capability discovery and safe use at the presentation boundary; never introduce a provider dependency into evidence/scheduler logic.

**Tech Stack:** TypeScript ESM, existing node/tsx CLI, portable Markdown Agent Skill.

## Global Constraints

- Canonical repository: `/home/ubuntu/repo/learning-os` on WebHarness ARM.
- Preserve Git history, profile databases, learner state, and original kernel contracts.
- Capability inventories are per host/session and provisional; no assumption that UI widgets, skills, or MCP servers are universally available.
- Do not create/modify curriculum, profile state, objectives, mastery/evidence or FSRS for ad-hoc teaching.
- Help that exposes target reasoning must pass through existing hint/exposure recording before display in an assessable episode.

## File map

- `src/teacher-presentation.ts`: pure cross-provider presentation fit recommendation; validated input, always text fallback.
- `src/presentation-cli.ts`: DB-independent invocation for CLI agents; accepts one JSON argument; no filesystem or learner DB use.
- `package.json`: `present:teaching` script for CLI call.
- `skills/learning-os-teacher/SKILL.md`: when and how to inspect host capabilities, render interactively, respect assessment/consent.
- `skills/learning-os-teacher/references/presentation-capabilities.md`: portable practical discovery rubric, examples and fallback.
- `docs/teacher-agent-protocol.md`: authority and exposure-safe presentation step.
- `docs/agent-web-session-instructions.md`: starter prompt enabling feature-aware teaching.
- `AGENTS.md`: short repository-wide canonical boundary note.
- `docs/capability-aware-teaching.md`: rationale and architecture.
- `README.md`: feature overview and reference link.

### Task 1: Pure presentation fit helper

**Files:** Create `src/teacher-presentation.ts`.

**Interfaces:** Input `PresentationRequest` (learning need and list of discovered `TeachingTool`), output `PresentationRecommendation` (ranked usable candidates plus universal fallback).

**Steps:**
- [ ] Define host-neutral need and medium vocabularies, capability source labels and type guards.
- [ ] Exclude unverified/unavailable/unsupported entries; prioritize matching media over discovery source, break ties by native-first.
- [ ] Return a complete and grounded text fallback even with zero tools; never call or install a tool.

**Acceptance criteria:** Exported helper is deterministic, has no imports from learner-state modules, and does not invent tool availability.

### Task 2: DB-independent CLI

**Files:** Create `src/presentation-cli.ts`; modify `package.json`.

**Interfaces:** `npm run -s present:teaching -- '<json>'` returns one machine-readable JSON recommendation.

**Steps:**
- [ ] Validate one JSON input with readable failure output.
- [ ] Call the pure helper; do not open or import learner DB/profile modules.

**Acceptance criteria:** Runnable in a repository checkout without selecting an active learner profile.

### Task 3: Portable teacher behavior

**Files:** Modify `AGENTS.md`, `skills/learning-os-teacher/SKILL.md`, `docs/teacher-agent-protocol.md`, `docs/agent-web-session-instructions.md`; create `skills/learning-os-teacher/references/presentation-capabilities.md`.

**Interfaces:** Agent capability-discovery process; helper's optional CLI input/output.

**Steps:**
- [ ] Teach one-time/lightweight native → installed skill → connected-tool discovery, with task-specific progressive loading and no silent tool installation.
- [ ] Document pairing medium to instructional need, accessible fallback, interactive learner control and no visual bloat.
- [ ] Specify active-attempt exposure, security/privacy, and ad-hoc non-persistence restrictions.
- [ ] Describe web and CLI agent examples using available tools, avoiding provider-specific mandatory calls.

**Acceptance criteria:** A new agent can follow repository-local instructions to discover/choose teaching formats while keeping kernel authority intact.

### Task 4: Discoverability and verification

**Files:** Modify `README.md`; rely on the same focused files above.

**Steps:**
- [ ] Link the design and new affordance behavior from the README.
- [ ] Run `npm run typecheck`, `npm run build`, and a DB-free CLI smoke check.
- [ ] Review the final Git diff; report limitations.

**Acceptance criteria:** The code compiles, CLI operates without managed profile, no versioned learner-state file changes, no new dependencies or migrations.
