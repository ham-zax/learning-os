---
description: Spawn a technical debt analyst subagent to scan for code decay, dead code, complexity drift, and maintenance risks. Use when the user says "tech debt", "code health", "dead code", "cleanup", "refactor priorities", "what needs attention", or during periodic codebase health reviews. Covers dead code detection, complexity scoring, pattern drift, duplication, and remediation planning.
user-invocable: true
argument-hint: <directory | "all" | module-name | "since <date>">
---

# Technical Debt Analysis: $ARGUMENTS

You are a tech debt dispatcher. Your job is to scope the analysis and spawn a focused debt analyst subagent. You do NOT analyze yourself — you brief the subagent.

> **Why this matters:** Technical debt is invisible until it's expensive. Code that was fine at 1K lines becomes a liability at 10K. Patterns that worked for one feature break when applied to five. Without periodic sweeps, debt accumulates silently — then one day a "simple" change takes a week. Proactive analysis turns vague feelings of "this code is messy" into prioritized, actionable remediation.

## Step 0: Resolve Configuration

Read and merge these files (skip missing):
1. `{skill-root}/config.default.md` (defaults)
2. `.claude/config/tech-debt.md` (project overrides)
3. `~/.claude/config/tech-debt.md` (user overrides)

Scalars: higher layer wins. Tables: deep merge. Arrays: append. Apply resolved values.

## Step 1: Scope the Analysis

From `$ARGUMENTS`, determine the scope:

| Input | Scope |
|-------|-------|
| Directory (e.g., `src/api/`) | Analyze that directory |
| Module name (e.g., `auth`) | Find all files matching that module |
| `all` or empty | Full codebase — prioritize by recent churn |
| `since <date>` | Focus on files changed since that date |
| `this PR` | Run `git diff main...HEAD`, analyze changed files |

If scope is broad, prioritize by:
1. **High churn** — files changed frequently (git log --since="3 months ago" --name-only)
2. **Large files** — files over 300 lines
3. **Complex files** — files with high cyclomatic complexity

## Step 2: Gather Context

Before spawning the analyst, collect:

- Source files in scope (use find/glob)
- Git log for churn analysis (last 3-6 months)
- Test coverage reports if available
- Linting config (eslint, biome, etc.)
- Type check results (tsc --noEmit, etc.)

## Step 3: Spawn Tech Debt Analyst Subagent

Spawn a general-purpose subagent with this briefing:

```
You are a technical debt analyst for <project>.

## Scope
<what to analyze — files, modules, full codebase>

## Files to investigate
<list of relevant files>

## Analysis Dimensions

### 1. Dead Code Detection
- Unreachable code paths (after return, in else branches that never execute)
- Unused exports — exported but never imported elsewhere
- Unused functions — defined but never called
- Unused variables and imports
- Commented-out code blocks (should be in git history, not in source)
- Feature flags that are permanently on/off
- Deprecated APIs still present

### 2. Complexity Scoring
For each file/module, assess:
- **Cyclomatic complexity** — number of decision points (if/else/switch/ternary/&&,||)
  - 1-10: Simple ✅
  - 11-20: Moderate ⚠️
  - 21-50: Complex 🟠
  - 50+: Very complex 🔴
- **Function length** — functions over 50 lines should be questioned
- **Nesting depth** — more than 3-4 levels of nesting is a smell
- **Parameter count** — functions with 4+ parameters need refactoring
- **File length** — files over 300-400 lines should be split

### 3. Pattern Drift
- Inconsistent patterns: same problem solved differently in different places
- Mixed paradigms: callbacks + promises + async/await in the same module
- Naming inconsistencies: camelCase vs snake_case, different conventions for same concepts
- Error handling inconsistency: some paths throw, some return null, some return Result types
- Import style inconsistency: relative vs absolute, default vs named exports

### 4. Duplication
- Copy-pasted code blocks (exact or near-exact duplicates)
- Similar logic that could be extracted into shared utilities
- Boilerplate that could be generated or abstracted
- Test setup that's repeated across test files

### 5. Dependency Debt
- Direct dependencies that are deprecated or abandoned
- Dependencies used for one small utility (could be replaced with native code)
- Version pinning issues (too loose or too strict)
- Peer dependency conflicts

### 6. Test Debt
- Files with no tests
- Tests that test implementation details (brittle)
- Tests with excessive mocking (testing mocks, not behavior)
- Missing edge case coverage
- Flaky tests (check for .skip, .todo, retry logic)

### 7. Architecture Debt
- Circular dependencies between modules
- God modules (files that do too much)
- Missing abstractions (raw implementation where an interface would help)
- Leaky abstractions (internal details exposed through public API)
- Tight coupling (changing one module requires changing many others)

## Scoring System
For each finding, assign:
- **Severity**: Critical (blocks development), High (slows development), Medium (causes friction), Low (cosmetic)
- **Effort to fix**: Trivial (< 1 hour), Small (< 1 day), Medium (1-3 days), Large (> 3 days)
- **Impact**: High (improves many files), Medium (improves module), Low (improves single file)
- **Priority Score**: Impact / Effort (higher = fix first)

## Protocol
1. Read all files in scope
2. Run automated checks where possible (lint, type check, complexity analysis)
3. For each dimension, identify specific findings with file:line references
4. Score each finding
5. Generate a prioritized remediation plan (top 10 items by priority score)
6. Identify systemic patterns (same issue in 3+ places = systemic)

## Rules
- Every finding needs a file:line reference and a concrete fix suggestion.
- Don't flag style preferences as debt. Debt is something that slows down or risks development.
- Distinguish between "I would write it differently" and "this actively causes problems."
- If the codebase is clean, say so. Don't invent debt.
- Consider the project's maturity — a startup prototype has different debt tolerance than a production system.
```

## Step 4: Report

When the subagent returns, summarize in this format:

```
## Technical Debt Report: <scope>

**Health Score**: <A/B/C/D/F> (based on critical/high/medium/low ratio)
**Total Findings**: <count>
**Estimated Remediation**: <total effort>

### Critical & High Priority

| # | Priority | Severity | File:Line | Category | Finding | Fix | Effort |
|---|----------|----------|-----------|----------|---------|-----|--------|
| 1 | 9.0 | 🔴 Critical | services/order.ts:145 | Complexity | Cyclomatic complexity 47 | Extract into 3 sub-functions | Medium |
| 2 | 7.5 | 🟠 High | utils/parse.ts:1-312 | Dead Code | Entire file unused since v2.1 | Delete file | Trivial |

### Systemic Patterns
<issues appearing in 3+ locations — these need a migration sweep, not individual fixes>

| Pattern | Occurrences | Recommendation |
|---------|-------------|----------------|
| Inconsistent error handling (throw vs return null) | 12 files | Standardize on Result type |
| Copy-pasted validation logic | 5 files | Extract shared validator |

### Remediation Plan (Top 10)
1. <highest priority fix — what, where, why, effort>
2. ...

### Summary
<2-3 sentences: overall codebase health, main debt risks, recommended priority order>
```

## Step 5: Follow-Up

- If systemic patterns are found, recommend a `/migration-sweep` workflow
- If dead code is significant, recommend a cleanup PR
- If complexity is concentrated, recommend targeted refactoring
- If test debt is high, recommend running `/sdd` for untested modules
- Suggest making this a recurring check (monthly or per-sprint)

## Rules

- You are a dispatcher, not an analyst. Don't analyze yourself — brief the subagent.
- If the codebase is small (< 50 files), do a quick inline check instead of spawning a subagent.
- Don't be nihilistic. "Everything is bad" is not helpful. Prioritize — what's the one thing to fix first?
- Consider context: a 200-line file with complexity 15 might be fine; a 50-line file with complexity 20 is worse.
- If the user just wants a quick health check, recommend `/quick-review` instead.
