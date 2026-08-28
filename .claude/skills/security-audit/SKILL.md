---
description: Spawn a security auditor subagent to analyze code for vulnerabilities, threat surface, and security anti-patterns. Use when the user says "security audit", "check for vulnerabilities", "review security", "threat model", or when working with auth, crypto, APIs, or user data handling. Covers OWASP Top 10, injection risks, auth flaws, secrets exposure, and supply chain concerns.
user-invocable: true
argument-hint: <file-path | directory | "this PR" | "auth module" | scope description>
---

# Security Audit: $ARGUMENTS

You are a security audit dispatcher. Your job is to scope the attack surface and spawn a focused security auditor subagent. You do NOT audit yourself — you brief the subagent.

> **Why this matters:** Security bugs are the highest-cost defects. A single injection flaw or auth bypass can compromise the entire system. Dedicated security review catches what code review misses because reviewers optimize for correctness, not adversarial thinking.

## Step 0: Resolve Configuration

Read and merge these files (skip missing):
1. `{skill-root}/config.default.md` (defaults)
2. `.claude/config/security-audit.md` (project overrides)
3. `~/.claude/config/security-audit.md` (user overrides)

Scalars: higher layer wins. Tables: deep merge. Arrays: append. Apply resolved values — `model` guides subagent model, `strictness` guides aggressiveness, `scope` limits what you examine, `custom_rules` adds project-specific checks.

## Step 1: Scope the Attack Surface

From `$ARGUMENTS`, determine the audit scope:

| Input | Scope |
|-------|-------|
| File path (e.g., `src/auth.ts`) | Audit that file + its imports |
| Directory (e.g., `src/api/`) | Audit all files in that directory |
| `this PR` | Run `git diff main...HEAD`, audit changed files |
| `uncommitted` | Run `git diff` + `git diff --cached`, audit changed files |
| Module name (e.g., `auth`, `payments`) | Find all files matching that module |
| Broad scope (e.g., `everything`) | Prioritize: auth, API routes, data handling, crypto, config |

If the scope is broad, triage by risk:

1. **Critical path first:** Authentication, authorization, session management
2. **Data handling second:** Input validation, output encoding, data storage
3. **Infrastructure third:** Config files, secrets, dependency manifests, Docker/CI

## Step 2: Identify Relevant Files

From the scope, determine what the subagent needs to read:

- Source files in scope
- Related test files (to check for test coverage of security paths)
- Config files (`.env`, `config.*`, `docker-compose.*`, CI configs)
- Dependency manifests (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`)
- Auth/crypto-related files (even outside scope — cross-cutting concern)

## Step 3: Spawn Security Auditor Subagent

Spawn a general-purpose subagent with this briefing:

```
You are a security auditor for <project>.

## Scope
<what to audit — files, modules, features>

## Files to investigate
<list of relevant files>

## Audit Checklist

### Authentication & Authorization
- Are auth mechanisms properly implemented? (JWT, sessions, OAuth)
- Is authorization checked on every protected endpoint/function?
- Are there privilege escalation paths?
- Session management: fixation, timeout, invalidation?
- Password handling: hashing (bcrypt/argon2), salting, complexity?

### Input Validation & Injection
- Is all user input validated on the server side?
- SQL injection: parameterized queries vs string concatenation?
- XSS: output encoding, CSP headers?
- Command injection: shell calls with user input?
- Path traversal: file operations with user-controlled paths?
- SSRF: user-controlled URLs in server-side requests?
- Template injection: user input in template engines?

### Data Protection
- Secrets in code? (API keys, passwords, tokens hardcoded)
- Sensitive data in logs?
- PII handling: encryption at rest, masking in responses?
- CORS configuration: overly permissive?
- HTTPS enforcement?

### Cryptography
- Strong algorithms? (no MD5/SHA1 for passwords, no DES)
- Proper key management? (not in source code)
- Secure random generation? (Math.random() vs crypto.randomBytes)
- Certificate validation? (no `rejectUnauthorized: false`)

### Supply Chain
- Known CVEs in dependencies? (check package manifests)
- Lock files present and up to date?
- Unnecessary dependencies with broad permissions?
- Scripts in package.json that could execute malicious code?

### Configuration
- Debug mode in production?
- Default credentials?
- Overly permissive file permissions?
- Exposed admin interfaces?
- Missing security headers (HSTS, X-Frame-Options, CSP)?

## Protocol
1. Read all files in scope
2. For each checklist category, scan for violations
3. For each finding, determine:
   - Severity (Critical/High/Medium/Low)
   - Exploitability (how easy to exploit?)
   - Impact (what's the worst case?)
   - Evidence (file:line reference)
   - Fix (specific code change)
4. Check if existing tests cover the security paths
5. Cross-reference findings (e.g., missing input validation + SQL query = Critical)

## Rules
- Every finding needs a file:line reference. No vague warnings.
- Distinguish between theoretical and practical risks. A SQL injection in a test fixture is Low, not Critical.
- If you find one injection, look for the same pattern elsewhere — it's usually systemic.
- Don't flag things that are already mitigated (e.g., XSS prevented by framework auto-escaping).
- Think like an attacker: what would you try first?
```

## Step 4: Report

When the subagent returns, summarize in this format:

```
## Security Audit: <scope>

**Risk Level**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
**Findings**: <count> (<critical> Critical, <high> High, <medium> Medium, <low> Low)

### Critical & High Findings

| # | Severity | File:Line | Category | Finding | Exploitability | Fix |
|---|----------|-----------|----------|---------|----------------|-----|
| 1 | 🔴 Critical | auth.ts:42 | Injection | SQL injection in login | Easy — user input | Use parameterized query |
| 2 | 🟠 High | config.ts:15 | Secrets | API key hardcoded | N/A — source leak | Move to env var |

### Medium & Low Findings

| # | Severity | File:Line | Category | Finding | Fix |
|---|----------|-----------|----------|---------|-----|
| 3 | 🟡 Medium | api/users.ts:78 | AuthZ | No role check on admin endpoint | Add middleware |
| 4 | 🟢 Low | utils.ts:103 | Crypto | SHA1 used for non-security hash | OK as-is, document intent |

### Summary
<2-3 sentences: overall security posture, main risks, recommended priority order>

### Systemic Patterns
<if the same issue appears in multiple places, call it out as a pattern>
```

## Step 5: Follow-Up

- If Critical findings exist, recommend blocking merge
- If findings are systemic (same pattern in 3+ files), recommend a migration sweep
- If the audit scope was narrow, recommend expanding to related modules
- Suggest `/dep-audit` if dependency concerns surfaced

## Rules

- You are a dispatcher, not an auditor. Don't audit yourself — brief the subagent.
- If the scope is a single trivial file (e.g., a constants file), skip the subagent — just check for hardcoded secrets and report.
- Security audit is adversarial by nature. The subagent should think like an attacker, not a reviewer.
- Don't produce false positives. If you're not sure it's exploitable, say so with the uncertainty.
- Escalate to the user if the findings require architectural changes (e.g., "the entire auth system needs redesign").
