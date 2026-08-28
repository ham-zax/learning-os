---
description: Run parallel health checks across all dimensions and produce a unified health score. Use when the user says "health check", "project health", "how healthy is this", "status dashboard", "full picture", or "give me the rundown". Spawns parallel agents for security, dependencies, performance, and tech debt, then aggregates findings into a prioritized report.
user-invocable: true
argument-hint: <"quick" | "full" | dimension-name>
---

# Health Check: $ARGUMENTS

You are the health check dispatcher. You spawn parallel agents to assess project health across multiple dimensions, aggregate their findings, and produce a unified report.

> **Why this matters:** Individual skills catch individual problems. Health check catches the *systemic* picture — a project might have no critical security issues but be drowning in tech debt, or have clean code but vulnerable dependencies. The weighted score forces prioritization across dimensions. Trend tracking shows whether the project is getting healthier or sicker over time.

## Step 1: Determine Check Scope

| Input | Action |
|-------|--------|
| `quick` or empty | Inline checks only (build, lint, type, tests) — fast feedback, no subagent spawn |
| `full` | Spawn all dimension agents in parallel |
| Dimension name (e.g., `security`) | Spawn only that dimension's agent |

## Step 2: Quick Mode (Inline)

For `quick` mode, run these inline without spawning agents:

```bash
# Build check
npm run build 2>&1 | tail -5

# Type check (use project's typecheck script, not raw tsc)
npm run typecheck 2>&1 | head -10

# Lint check
npm run lint 2>&1 | head -10

# Test check
npm test 2>&1 | tail -10

# Git status
git status --short

# Dependency audit (quick)
npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities // {}' 2>/dev/null || echo "npm audit not available"
```

Report a quick summary table:

```
## Quick Health Check

| Check | Status | Details |
|-------|--------|---------|
| Build | ✅ Pass / 🔴 Fail | <summary> |
| Types | ✅ Clean / 🔴 N errors | <summary> |
| Lint | ✅ Clean / ⚠️ N warnings | <summary> |
| Tests | ✅ Pass / 🔴 N failures | <summary> |
| Git | ✅ Clean / ⚠️ N uncommitted | <summary> |
| Audit | ✅ Clean / 🔴 N vulns | <summary> |

**Overall**: ✅ HEALTHY / ⚠️ WARNING / 🔴 CRITICAL
```

Done. No subagent spawn needed for quick mode.

## Step 3: Full Mode (Parallel Agents)

For `full` mode, spawn 4 agents in parallel with `run_in_background: true`:

### Agent 1: Security Health
Spawn with security-audit briefing. Focus on:
- Vulnerability count by severity
- Secrets exposure
- Auth/crypto issues
- Output: structured findings with severity counts

### Agent 2: Dependency Health
Spawn with dep-audit briefing. Focus on:
- CVE count by severity
- License conflicts
- Outdated/deprecated packages
- Output: structured findings with severity counts

### Agent 3: Performance Health
Spawn with perf-profile briefing. Focus on:
- N+1 queries
- Algorithmic bottlenecks
- Missing caching
- Output: structured findings with impact estimates

### Agent 4: Technical Debt
Spawn with tech-debt briefing. Focus on:
- Dead code
- Complexity hotspots
- Pattern drift
- TODO/FIXME count
- Output: structured findings with remediation plan

## Step 4: Aggregate Results

After all agents return, compute per-dimension scores:

### Scoring Rubric (0-100)

| Score | Label | Criteria |
|-------|-------|----------|
| 90-100 | EXCELLENT | No issues, best practices followed |
| 70-89 | GOOD | Minor issues, no blockers |
| 50-69 | FAIR | Moderate issues, should be addressed |
| 30-49 | POOR | Significant issues, needs attention |
| 0-29 | CRITICAL | Blocking issues, immediate action |

### Weighted Overall Score

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Security | 30% | Highest cost of failure |
| Dependencies | 25% | Supply chain risk |
| Performance | 20% | User-facing impact |
| Tech Debt | 25% | Long-term health |

Overall = (security × 0.30) + (deps × 0.25) + (perf × 0.20) + (debt × 0.25)

### Status Thresholds

| Overall Score | Status | Color |
|---------------|--------|-------|
| 85-100 | HEALTHY | 🟢 |
| 60-84 | WARNING | 🟡 |
| 0-59 | CRITICAL | 🔴 |

## Step 5: Generate Report

```
## Project Health Report
**Date**: <timestamp>
**Overall Score**: <score>/100 (<HEALTHY/WARNING/CRITICAL>)

### Dimension Scores

| Dimension | Score | Status | Key Findings |
|-----------|-------|--------|--------------|
| Security | <score> | <label> | <critical> critical, <high> high, <medium> medium |
| Dependencies | <score> | <label> | <CVEs> CVEs, <outdated> outdated, <license> license issues |
| Performance | <score> | <label> | <hotspots> hotspots, <n+1> N+1 queries |
| Tech Debt | <score> | <label> | <dead> dead code files, <complex> complexity hotspots |

### Priority Actions
1. [CRITICAL] <highest priority finding across all dimensions>
2. [HIGH] <next priority>
3. ...

### Summary
<2-3 sentences: overall health, main risks, recommended next steps>
```

## Step 6: Follow-Up

- If CRITICAL, recommend immediate action on the blocking findings
- If WARNING, recommend addressing high-priority items before next release
- If HEALTHY, recommend running `/release` or `/docs` to capitalize on the clean state
- Suggest running `/health quick` regularly (daily or per-commit) and `/health full` periodically (weekly or per-sprint)

## Rules

- You are a dispatcher, not an auditor. Don't audit yourself — spawn agents.
- In quick mode, run commands inline. Don't spawn agents for simple checks.
- In full mode, spawn all agents in a single parallel block for speed.
- If a dimension agent fails (error, timeout), report it as "Unable to assess" with the error, don't fake a score.
- Be honest about scores. A project with 3 critical CVEs is not "GOOD" regardless of other dimensions.
- If the project has no package.json, skip dependency checks. If no tests exist, score test coverage as 0.
