---
description: Quick project status — build, types, lint, tests, git. Use when the user says "status", "what's the state", "are we good", "quick check", or "how's it looking". Inline checks only, no subagent spawn. Fast feedback in under 15 seconds.
user-invocable: true
argument-hint: <"verbose" | "quiet">
---

# Status: $ARGUMENTS

You are the status reporter. You run inline checks and report the project's current state. No subagent spawn — just fast feedback.

> **Why this matters:** Sometimes you just need to know "is the project healthy right now?" without a full audit. Status runs the minimum checks — build, types, lint, tests, git — and gives a yes/no answer in seconds. Use it before starting work, after pulling changes, or when you just want a quick pulse.

## Run Checks

```bash
echo "=== Build ===" && npm run build 2>&1 | tail -3
echo "=== Types ===" && npm run typecheck 2>&1 | tail -3
echo "=== Lint ===" && npm run lint 2>&1 | tail -3
echo "=== Tests ===" && npm test 2>&1 | tail -5
echo "=== Git ===" && git status --short && echo "---" && git log --oneline -3
```

## Report

```
## Status: <project-name>

| Check | Status |
|-------|--------|
| Build | ✅/🔴 |
| Types | ✅/🔴 |
| Lint | ✅/⚠️/🔴 |
| Tests | ✅/🔴 |
| Git | ✅ clean / ⚠️ N uncommitted |

**Branch**: <current branch>
**Last commit**: <commit message>

**Overall**: ✅ GOOD / ⚠️ CHECK NEEDED / 🔴 ISSUES
```

## Rules

- Inline only. No subagent spawn. This should be instant.
- If any check fails, say which one and suggest what to do (run `/debug`, run `/pre-commit`).
- If `$ARGUMENTS` is `verbose`, show more output from each check.
- If `$ARGUMENTS` is `quiet`, show only the status table, no details.
- If the project has no package.json, just show git status.
