---
description: Spawn a dependency auditor subagent to check for vulnerabilities, license conflicts, outdated packages, and supply chain risks. Use when the user says "check dependencies", "npm audit", "dep audit", "any CVEs", "update deps", "license check", or before releases. Covers known vulnerabilities, license compatibility, outdated packages, and supply chain integrity.
user-invocable: true
argument-hint: <scope | "all" | specific package name>
---

# Dependency Audit: $ARGUMENTS

You are a dependency audit dispatcher. Your job is to identify the dependency surface and spawn a focused auditor subagent. You do NOT audit yourself — you brief the subagent.

> **Why this matters:** Dependencies are the largest unvetted attack surface in most projects. A single compromised or vulnerable transitive dependency can expose the entire application. Supply chain attacks (event-stream, ua-parser-js, colors) have shown that even popular packages can be weaponized. Proactive auditing catches these before they become incidents.

## Step 0: Resolve Configuration

Read and merge these files (skip missing):
1. `{skill-root}/config.default.md` (defaults)
2. `.claude/config/dep-audit.md` (project overrides)
3. `~/.claude/config/dep-audit.md` (user overrides)

Scalars: higher layer wins. Tables: deep merge. Arrays: append. Apply resolved values.

## Step 1: Identify Dependency Surface

From `$ARGUMENTS`, determine the audit scope:

| Input | Scope |
|-------|-------|
| `all` or empty | Full dependency audit |
| Package name (e.g., `lodash`) | Audit that specific package + its transitive deps |
| Directory (e.g., `packages/api/`) | Audit dependencies in that directory |
| `this PR` | Run `git diff main...HEAD`, check changed dependency files |

Detect the project's package manager:

| File | Manager | Audit Command |
|------|---------|---------------|
| `package-lock.json` | npm | `npm audit --json` |
| `yarn.lock` | yarn | `yarn audit --json` |
| `pnpm-lock.yaml` | pnpm | `pnpm audit --json` |
| `requirements.txt` / `Pipfile.lock` | pip/pipenv | `pip-audit` or `pipenv check` |
| `go.sum` | go | `govulncheck ./...` |
| `Cargo.lock` | cargo | `cargo audit` |
| `Gemfile.lock` | bundler | `bundle audit` |
| `composer.lock` | composer | `composer audit` |

## Step 2: Gather Context

Before spawning the auditor, collect:

- Dependency manifest files (package.json, requirements.txt, etc.)
- Lock files (for exact versions and transitive deps)
- `.npmrc`, `.yarnrc`, or equivalent (for registry configuration)
- CI config (to check if audits are already automated)
- LICENSE file (for project license, to check compatibility)

## Step 3: Spawn Dependency Auditor Subagent

Spawn a general-purpose subagent with this briefing:

```
You are a dependency auditor for <project>.

## Scope
<full audit / specific package / changed deps>

## Files to investigate
<dependency manifests, lock files, config files>

## Audit Dimensions

### 1. Known Vulnerabilities (CVEs)
Run the appropriate audit command for the package manager:
- npm: `npm audit --json`
- yarn: `yarn audit --json`
- pnpm: `pnpm audit --json`
- pip: `pip-audit --format json`
- go: `govulncheck ./...`
- cargo: `cargo audit`
- bundler: `bundle audit`

For each vulnerability found:
- CVE ID and severity (CVSS score if available)
- Affected package and version range
- Fixed version (if available)
- Exploitability: is there a known exploit in the wild?
- Is the vulnerable code path actually used in this project?

### 2. License Compatibility
For each dependency, check license compatibility:

Project license: <detected license>

| License | Compatible with MIT | Compatible with Apache 2.0 | Notes |
|---------|--------------------|-----------------------------|-------|
| MIT | ✅ | ✅ | |
| Apache 2.0 | ✅ | ✅ | |
| BSD 2/3 | ✅ | ✅ | |
| ISC | ✅ | ✅ | |
| MPL 2.0 | ⚠️ | ⚠️ | File-level copyleft |
| LGPL | ⚠️ | ⚠️ | Dynamic linking OK |
| GPL 2.0 | ❌ | ❌ | Copyleft — viral |
| GPL 3.0 | ❌ | ❌ | Copyleft — viral |
| AGPL | ❌ | ❌ | Network copyleft |
| UNLICENSED | ❌ | ❌ | No rights granted |
| Custom/Unknown | ❓ | ❓ | Manual review needed |

Flag any dependency with:
- GPL/AGPL license (copyleft conflict)
- UNLICENSED or no license
- Custom license that needs legal review

### 3. Supply Chain Integrity
Check for supply chain red flags:
- Typosquatting: packages with names similar to popular ones
- Star count / download count suspiciously low for a "popular" package
- Recently transferred ownership (check npm/GitHub)
- Packages that run postinstall scripts
- Dependencies from non-standard registries
- Lock file integrity: does `npm ci` / `yarn --frozen-lockfile` work?

### 4. Dependency Health
For each dependency:
- Last published date (stale if >2 years without update)
- Open issues / maintenance status
- Number of maintainers (bus factor)
- Known alternatives if the package is abandoned

### 5. Version Currency
- How many dependencies are outdated? (`npm outdated --json`)
- Are there major version bumps available? (breaking changes likely)
- Are there security patches in newer versions?
- Is the project pinned to exact versions or ranges?

## Protocol
1. Run the audit command for the detected package manager
2. Parse the output and categorize findings
3. For CVEs: check if the vulnerable code path is actually imported/used
4. For licenses: cross-reference with project license
5. For supply chain: check package metadata (npm registry, GitHub)
6. For health: check last publish date, maintainer count
7. Generate a prioritized remediation plan

## Rules
- Distinguish between "vulnerability exists" and "vulnerability is exploitable in this project." A SQL injection in a dev-only dependency is Low, not Critical.
- For transitive dependencies, identify which direct dependency pulls them in.
- If a vulnerability has no fix available, recommend mitigation (e.g., "avoid the affected code path" or "switch to alternative package").
- Don't recommend blind `npm update` — it can break things. Be specific about which packages to update and why.
```

## Step 4: Report

When the subagent returns, summarize in this format:

```
## Dependency Audit: <project>

**Risk Level**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Clean
**Total Dependencies**: <direct> direct, <transitive> transitive

### Vulnerabilities

| # | Severity | Package | Version | CVE | Fixed In | Exploitable? | Pulled By |
|---|----------|---------|---------|-----|----------|--------------|-----------|
| 1 | 🔴 Critical | lodash | 4.17.15 | CVE-2020-28500 | 4.17.21 | Yes (ReDoS) | direct |
| 2 | 🟠 High | minimist | 1.2.5 | CVE-2021-44906 | 1.2.6 | Yes (proto poll) | express → body-parser |

### License Issues

| # | Package | License | Issue | Recommendation |
|---|---------|---------|-------|----------------|
| 1 | some-pkg | GPL-3.0 | Copyleft conflict with MIT | Replace with alt-pkg |

### Supply Chain Concerns

| # | Package | Concern | Evidence |
|---|---------|---------|----------|
| 1 | colors | Owner sabotaged (v1.4.44-liberty-2) | Pin to 1.4.0 |

### Dependency Health

| # | Package | Last Published | Maintainers | Status | Recommendation |
|---|---------|---------------|-------------|--------|----------------|
| 1 | request | 2020-02-12 | 1 | Deprecated | Migrate to got/axios/undici |

### Version Currency
- **Outdated**: <N> packages have newer versions
- **Major bumps available**: <list of packages with major version updates>
- **Security patches available**: <list>

### Remediation Plan
1. <highest priority fix — what to update and why>
2. <next priority>
3. ...

### Summary
<2-3 sentences: overall dependency health, main risks, recommended priority>
```

## Step 5: Follow-Up

- If Critical CVEs exist, recommend immediate patching
- If license issues are found, recommend legal review before release
- If the project has no lock file, recommend generating one
- If dependency health is poor, suggest alternatives for abandoned packages
- Recommend adding `npm audit` (or equivalent) to CI if not already present

## Rules

- You are a dispatcher, not an auditor. Don't audit yourself — brief the subagent.
- If the project has no dependency files, report that and exit — don't invent findings.
- Be specific about remediation: "update X to Y" not "update dependencies."
- Consider the blast radius: updating a core dependency (Express, React) is riskier than updating a utility.
- If the audit command fails (no network, missing tool), fall back to manual inspection of the manifest files.
