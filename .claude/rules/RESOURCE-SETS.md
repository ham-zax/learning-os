---
name: resource-sets
description: Agent resource sets — which files each role loads at session start. Adapted for Claude Code native mechanisms.
---

# Resource Sets

Defines what context each agent role loads. In Claude Code, agent definitions live in `.claude/agents/` and rules in `.claude/rules/`. Both are auto-loaded based on the agent's role.

## Loading Mechanism

- **Agent definitions** in `.claude/agents/*.md` — loaded as the agent's system prompt
- **Rules** in `.claude/rules/*.md` — auto-loaded as shared context for all agents
- **Project memory** loaded via `memory: project` in agent frontmatter
- **Skills** loaded on-demand when invoked

## Resource Sets by Role

### Supervisor / Planner (Main Session)
- `phases/shared/rules/ROLES.md` — role definitions and dispatch rules
- `phases/shared/rules/CONSOLIDATED.md` — safety rules
- `phases/shared/rules/HANDOFF.md` — inter-role data exchange protocols
- `phases/shared/rules/complexity-scoring.md` — agent spawning thresholds
- `phases/shared/context-files/session-routing.md` — session shortcodes
- Project state: STATUS.md, CONTEXT.md, DECISIONS.md

### Sprint-Manager (Main Session — /trio skill)
- `phases/implement/skills/trio/SKILL.md` — wave dispatch protocol
- `phases/implement/rules/wave-execution.md` — wave dispatch rules
- `.pipeline/test_map.json` — test file paths from test-manager
- All Planner resources (inherits main session context)

### Researcher (Main Session — /researcher skill)
- `phases/design/skills/researcher/SKILL.md` — ARIA v2 protocol
- `phases/design/agents/researcher.md` — protocol reference
- Vault knowledge files (on demand via obsidian MCP)

### Coder (Subagent)
- `phases/implement/agents/coder.md` — six-phase loop, debugging rules
- `phases/implement/rules/coder-safety.md` — safety constraints, anti-patterns
- `phases/implement/rules/implementation-briefing.md` — briefing format
- Project test files (from briefing)
- **Never loads:** specs/, plans/, .pipeline/test_map.json

### Test-Manager (Subagent)
- `phases/implement/agents/test-manager.md` — RED gate protocol
- `phases/implement/rules/coder-safety.md` — shared safety rules
- Approved spec (from prompt)
- Plan (from prompt)

### Tester (Subagent)
- `phases/implement/agents/tester.md` — helper protocol
- `phases/implement/rules/coder-safety.md` — shared safety rules
- Existing test files (for coverage analysis)

### Reviewer-Lite (Subagent)
- `phases/review/agents/reviewer-lite.md` — 3-section review protocol
- Modified file list (from prompt)
- Spec (from prompt)

### Reviewer — Full (Subagent)
- `phases/review/agents/reviewer.md` — adversarial review protocol, edge case checklist
- Modified file list (from prompt)
- Spec (from prompt)

### BA (Subagent)
- `phases/design/agents/ba.md` — requirements elicitation protocol
- User intent or issue reference (from prompt)

### Architect (Subagent)
- `phases/design/agents/architect.md` — system design protocol, 5-lens critique
- Approved spec (from prompt)

### Explorer (Subagent)
- `phases/design/agents/explorer.md` — focused investigation protocol
- Research question (from prompt)

### Research-Critic (Subagent)
- `phases/design/agents/research-critic.md` — adversarial critique protocol, 4 lenses
- Synthesized findings (from prompt, fresh context only)

### UI-Designer (Subagent)
- `phases/design/agents/ui-designer.md` — visual feedback loop protocol
- Spec and existing UI (from prompt)
- Design tools: design-sandbox.sh, design-grade.sh, design-iterate.sh

### Data-Analyst (Subagent)
- `phases/design/agents/data-analyst.md` — iterative analysis protocol
- Data sources and task description (from prompt)

## File Hierarchy (loaded in order)

1. `phases/shared/rules/CONSOLIDATED.md` — universal safety rules (every agent)
2. `phases/*/agents/<role>.md` — role-specific agent definition
3. `phases/implement/rules/coder-safety.md` — safety rules (implementation agents only)
4. Project state — STATUS.md, CONTEXT.md, DECISIONS.md (main session)
5. Skills — on-demand skill files loaded by topic

## paths: Frontmatter

Agent definitions may include a `paths:` field to declare which files they own:

```yaml
paths:
  - phases/implement/agents/coder.md
  - phases/implement/rules/coder-safety.md
```

This is optional — Claude Code loads rules from `.claude/rules/` automatically based on agent type.
