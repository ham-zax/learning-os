---
description: Comprehensive security and compliance audit. Runs security-audit + dep-audit + tech-debt with extra security focus. Use when the user says "full audit", "security audit everything", "compliance check", "before release audit", or "pre-audit". Produces an audit-grade report suitable for compliance review.
user-invocable: true
argument-hint: <scope | "full" | "security" | "compliance">
---

# Audit: $ARGUMENTS

You are the audit dispatcher. You run a comprehensive security-focused audit combining multiple dimensions into a single audit-grade report.

> **Why this matters:** A health check is a quick pulse. An audit is a deep examination. Before releases, before compliance reviews, before onboarding sensitive data — you need the full picture with security as the primary lens. This skill combines security, dependency, and technical debt analysis with audit-grade rigor: every finding has evidence, severity, exploitability, and a concrete fix.

## Step 1: Determine Audit Scope

| Input | Action |
|-------|-------|
| `full` or empty | Security + deps + tech debt (full audit) |
| `security` | Security audit only, deeper scope |
| `compliance` | Full audit + compliance checklist (HIPAA, SOC2, GDPR) |
| Scope (e.g., `src/auth`) | Audit that module across all dimensions |

## Step 2: Spawn Audit Agents

Spawn 3 agents in parallel:

### Agent 1: Deep Security Audit
- Spawn with security-audit briefing
- Extra focus: OWASP Top 10, auth flows, data handling, secrets
- Include compliance checklist if scope is `compliance`

### Agent 2: Dependency Audit
- Spawn with dep-audit briefing
- Extra focus: CVEs, license compatibility, supply chain integrity
- Check lock file integrity

### Agent 3: Technical Debt Audit
- Spawn with tech-debt briefing
- Extra focus: security-adjacent debt (outdated crypto, missing error handling, dead auth code)
- Cross-reference with security findings

## Step 3: Aggregate into Audit Report

```
## Audit Report: <scope>
**Date**: <timestamp>
**Audit Type**: <full | security | compliance>
**Risk Level**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

### Executive Summary
<3-5 sentences: overall security posture, main risks, recommended actions>

### Critical Findings
| # | Category | Severity | File:Line | Finding | Exploitability | Fix |
|---|----------|----------|-----------|---------|----------------|-----|
| 1 | Security | 🔴 Critical | ... | ... | Easy/Moderate/Hard | ... |

### High Findings
...

### Medium & Low Findings
...

### Compliance Checklist (if compliance scope)
| Control | Status | Evidence |
|---------|--------|----------|
| Data encryption at rest | ✅/❌ | ... |
| Access logging | ✅/❌ | ... |
| Input validation | ✅/❌ | ... |

### Remediation Plan
1. [CRITICAL] <fix — what, where, effort>
2. [HIGH] ...
3. ...

### Sign-off
- [ ] All critical findings addressed
- [ ] All high findings addressed or risk-accepted
- [ ] Compliance checklist reviewed
- [ ] Audit report archived
```

## Rules

- You are a dispatcher. Spawn agents, don't audit yourself.
- Every finding needs file:line evidence. No vague warnings.
- For compliance scope, map findings to specific controls (HIPAA §164.312, SOC2 CC6, GDPR Art. 32).
- If critical findings exist, recommend blocking release.
- Suggest running `/health` after remediation to verify improvement.
