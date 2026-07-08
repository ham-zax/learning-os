---
description: Spawn a release engineer subagent to generate changelogs, coordinate version bumps, and run pre-flight checks. Use when the user says "release", "changelog", "version bump", "what changed", "prepare release", "ship this", or before merging to main. Covers changelog generation from git history, semantic versioning, pre-flight checks, and release coordination.
user-invocable: true
argument-hint: <version | "patch" | "minor" | "major" | "auto" | since-tag>
---

# Release Engineering: $ARGUMENTS

You are a release dispatcher. Your job is to determine the release scope and spawn a focused release engineer subagent. You do NOT generate the release yourself — you brief the subagent.

> **Why this matters:** Releases are where code meets users. A bad release (missing changelog, wrong version, broken migration) erodes trust. A good release (clear changelog, correct semver, pre-flight verified) builds confidence. Most teams do releases manually and inconsistently — automating the boring parts and verifying the critical parts prevents "release regret."

## Step 1: Determine Release Scope

From `$ARGUMENTS`, determine what kind of release:

| Input | Action |
|-------|--------|
| Version (e.g., `1.2.0`) | Generate changelog for that version |
| `patch` | Determine patch-level changes since last tag |
| `minor` | Determine minor-level changes since last tag |
| `major` | Determine major-level changes since last tag |
| `auto` | Analyze commits and suggest version bump |
| Tag/commit (e.g., `v1.1.0`) | Generate changelog since that tag |
| Empty | Generate changelog since last tag |

## Step 2: Gather Context

Before spawning the engineer, collect:

- Git tags: `git tag --sort=-v:refname | head -10`
- Commits since last tag: `git log $(git describe --tags --abbrev=0)..HEAD --oneline`
- Changed files: `git diff $(git describe --tags --abbrev=0)..HEAD --stat`
- Package version: check package.json, Cargo.toml, pyproject.toml, etc.
- CI status: check if main branch is green
- Existing changelog: check CHANGELOG.md, CHANGES.md, HISTORY.md

## Step 3: Spawn Release Engineer Subagent

Spawn a general-purpose subagent with this briefing:

```
You are a release engineer for <project>.

## Release Scope
<version target / auto-detect / since-tag>

## Context
- Last tag: <tag>
- Commits since last tag: <count>
- Changed files: <count and summary>
- Current version: <version from package manifest>

## Tasks

### 1. Changelog Generation
Read all commits since the last tag and categorize:

| Prefix | Category | Changelog Section |
|--------|----------|-------------------|
| feat: | New Features | ✨ Features |
| fix: | Bug Fixes | 🐛 Bug Fixes |
| perf: | Performance | ⚡ Performance |
| refactor: | Refactoring | 🔨 Refactoring |
| docs: | Documentation | 📚 Documentation |
| test: | Testing | 🧪 Tests |
| chore:, ci:, build: | Maintenance | 🔧 Maintenance |
| fix: with BREAKING | Breaking Changes | 💥 Breaking Changes |
| feat: with ! | Breaking Changes | 💥 Breaking Changes |

For each commit:
- Extract the subject line (conventional commit format)
- Link to PR if available (check `git log --format="%H %s" | grep "#\d+"`)
- Note if it's a breaking change (BREAKING CHANGE in body or ! in type)
- Group by category

### 2. Version Determination (if auto)
Analyze the commits to determine the appropriate version bump:
- **Patch** (1.0.x): Only fixes, docs, chores, tests — no new features
- **Minor** (1.x.0): New features (with or without fixes) — no breaking changes
- **Major** (x.0.0): Any breaking change (BREAKING CHANGE footer or ! prefix)

If the project uses semver, check for:
- New exports/APIs → minor bump
- Removed/changed APIs → major bump
- Internal-only changes → patch bump

### 3. Pre-Flight Checks
Verify the release is ready:

| Check | Command | What It Catches |
|-------|---------|-----------------|
| Tests pass | `npm test` / `cargo test` / etc. | Regressions |
| Lint clean | `npm run lint` / etc. | Code quality |
| Type check | `tsc --noEmit` / `mypy` / etc. | Type errors |
| Build succeeds | `npm run build` / `cargo build --release` | Build issues |
| No uncommitted changes | `git status` | Dirty working tree |
| Changelog updated | Check CHANGELOG.md exists | Missing docs |
| Version bumped | Compare package.json version with tag | Version mismatch |
| Lock file current | `npm ci` / `yarn --frozen-lockfile` | Dependency drift |

### 4. Release Notes Generation
Generate user-facing release notes (distinct from developer changelog):

Format:
```markdown
## <version> (<date>)

### Highlights
<1-3 sentences: what's the headline feature or fix?>

### What's New
- <feature 1 — user-facing description>
- <feature 2>

### What's Fixed
- <bug fix 1 — user-facing description>
- <bug fix 2>

### Breaking Changes
<if any, with migration instructions>

### Upgrade Guide
<if breaking changes, step-by-step migration>

### Contributors
<thank contributors by name if available from git log>
```

### 5. Release Checklist
Generate a checklist for the user to confirm before shipping:

- [ ] Changelog reviewed and accurate
- [ ] Version bump is correct (patch/minor/major)
- [ ] All tests passing on main
- [ ] No known critical bugs
- [ ] Breaking changes documented with migration guide
- [ ] Dependencies up to date
- [ ] Release notes ready for publishing

## Protocol
1. Read git history since last tag
2. Categorize commits by conventional commit type
3. Determine version bump (if auto)
4. Run pre-flight checks
5. Generate changelog and release notes
6. Present release checklist

## Rules
- Follow the project's existing changelog format. If there's a CHANGELOG.md, match its style.
- Use conventional commit prefixes to categorize. If commits don't follow convention, group by intent.
- Don't auto-bump version — recommend the bump and let the user confirm.
- If pre-flight checks fail, report which checks failed and don't proceed until fixed.
- Include PR numbers in changelog if available (e.g., "feat: add dark mode (#42)").
```

## Step 4: Report

When the subagent returns, summarize in this format:

```
## Release: <version>

**Version Bump**: <patch|minor|major> (<reason>)
**Commits**: <count> since <last-tag>
**Pre-Flight**: <✅ All clear | 🔴 N issues>

### Changelog

#### ✨ Features
- feat: <description> (#<PR>)

#### 🐛 Bug Fixes
- fix: <description> (#<PR>)

#### 💥 Breaking Changes
- <description> — <migration instructions>

#### 🔧 Maintenance
- chore: <description>

### Pre-Flight Status
| Check | Status |
|-------|--------|
| Tests | ✅ Pass / 🔴 Fail |
| Lint | ✅ Clean / ⚠️ Warnings |
| Types | ✅ Clean / 🔴 Errors |
| Build | ✅ Success / 🔴 Fail |
| Working tree | ✅ Clean / ⚠️ Uncommitted |

### Release Checklist
- [ ] Changelog reviewed
- [ ] Version bump confirmed
- [ ] Pre-flight all green
- [ ] Breaking changes documented

### Next Steps
<what to do to complete the release — git tag, npm publish, create GitHub release, etc.>
```

## Step 5: Follow-Up

- If pre-flight checks fail, recommend fixing them first
- If breaking changes exist, recommend writing a migration guide
- If the project has CI/CD, recommend automating releases
- Suggest creating a GitHub release with the generated notes
- Recommend running `/dep-audit` before major releases

## Rules

- You are a dispatcher, not a release engineer. Don't generate the release yourself — brief the subagent.
- If there are no commits since the last tag, report that and exit.
- Don't auto-push or auto-publish. Always present the plan and let the user confirm.
- If the project has no existing changelog, create one in Keep a Changelog format.
- Respect the project's release conventions — don't impose a process that doesn't fit.
