---
description: Lightweight code review — single-pass analysis of files, diffs, or PRs. Use when the user says "review this", "look at this code", "check this PR", or wants feedback without the full adversarial pipeline.
user-invocable: true
argument-hint: <file-path | diff | "this PR" | "uncommitted">
---

# Quick Review: $ARGUMENTS

> **Why this matters:** Code review is the last line of defense before code reaches production. But full adversarial review is expensive — not every PR needs a 3-agent panel. Quick review provides structured, actionable feedback in a single pass, catching the obvious issues (security, correctness, quality) without the overhead of the full pipeline. Use it for complexity 4-7; escalate to `/adversarial-review` for 8+.

## Step 0: Resolve Configuration

Read and merge these files (skip missing):
1. `{skill-root}/config.default.md` (defaults)
2. `.claude/config/quick-review.md` (project overrides)
3. `~/.claude/config/quick-review.md` (user overrides)

Scalars: higher layer wins. Tables: deep merge. Arrays: append. Apply resolved values — `custom_rules` adds project-specific patterns to check, `strictness` guides aggressiveness.

You are a code reviewer. Produce actionable findings, not a rubber stamp. Be direct — say what's wrong and how to fix it.

## Scope Detection

Determine what to review from `$ARGUMENTS`:

| Input | Action |
|-------|--------|
| File path (e.g., `src/auth.ts`) | Read and review that file |
| Directory (e.g., `src/`) | List files, review each |
| `this PR` or empty | Run `git diff main...HEAD` or `git diff origin/main` |
| `uncommitted` | Run `git diff` (unstaged) + `git diff --cached` (staged) |
| `staged` | Run `git diff --cached` |
| Branch name | Run `git diff <branch>...HEAD` |
| Commit hash | Run `git show <hash>` |

## Review Dimensions

Analyze the code across these dimensions. Don't need all — report what applies:

### Correctness
- Logic errors, off-by-one, null/undefined risks
- Missing error handling or edge cases
- Type safety issues (unsafe casts, `any`, missing guards)
- Race conditions or ordering assumptions

### Security
- Input validation gaps
- Injection risks (SQL, XSS, command injection)
- Secrets or credentials in code
- Unsafe deserialization or file operations

### Quality
- Naming clarity — do names communicate intent?
- Function length — anything over ~50 lines should be questioned
- Duplication — is the same logic repeated?
- Dead code — unreachable branches, unused imports
- Error messages — are they helpful for debugging?

### Performance
- Unnecessary allocations in hot paths
- N+1 queries or repeated I/O
- Missing caching where it would help
- Blocking operations that could be async

### Testing
- Are there tests for this code?
- Do tests cover the key cases (happy path, edge cases, errors)?
- Are assertions meaningful (not just "it didn't throw")?

## Output Format

```
## Quick Review: <what was reviewed>

**Verdict**: ✅ Clean | ⚠️ Minor issues | 🔴 Needs work

### Findings

| # | Severity | File:Line | Finding | Fix |
|---|----------|-----------|---------|-----|
| 1 | 🔴 High | auth.ts:42 | SQL injection via string concat | Use parameterized query |
| 2 | ⚠️ Medium | auth.ts:78 | No rate limiting on login | Add throttle middleware |
| 3 | 💡 Low | auth.ts:103 | Magic number `86400` | Extract as `TOKEN_TTL_SECONDS` |

### Summary
<2-3 sentences: overall assessment, main risks, recommended priority>
```

## Severity Levels

- 🔴 **High**: Security vulnerability, data loss risk, or correctness bug. Must fix before merge.
- ⚠️ **Medium**: Quality issue, missing error handling, or test gap. Should fix before merge.
- 💡 **Low**: Style, naming, minor improvement. Nice to have.

## Escalation

If the code is complex (multiple files, architectural changes, security-sensitive), recommend escalation:

> "This touches 8 files across 3 modules with security implications. Consider running `/adversarial-review` for a thorough multi-perspective analysis."

## Rules
- Be specific. `auth.ts:42` not "in the auth file."
- Suggest fixes, don't just point out problems.
- If the code is good, say so. Don't invent issues.
- If you can't review (file too large, binary, etc.), say so.
- Don't modify files — review only.
