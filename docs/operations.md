# Local operation and recovery

Learning OS is a trusted, single-host, agent-operated SQLite kernel. Anyone who can invoke its CLI, import its modules, or access the repository can read or change learner state. Profile selection is routing, not authentication or an authorization boundary. Keep the checkout private and control OS/repository access. Deploying these commands behind an untrusted network API requires a separate authenticated, authorized service boundary; this repository does not supply one.

## Verify and package

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run check:package` from the repository root. The package allowlist excludes managed learner state. The privacy gate also rejects untracked package sources, including newly generated personal curriculum, until they are reviewed and intentionally tracked. Keep raw learner documents and configuration outside public curriculum directories.

The CI workflow checks Node 22 and 24, installs the resulting package without development dependencies, and smoke-tests its compiled CLI and kernel. A failed verification blocks readiness; publishing remains an explicit operator action. The workflow has no publishing credentials.

SQLite is pinned to the tested native-addon version. This repository explicitly approves its install script in `package.json`. A separate npm 12 consumer project must also approve `better-sqlite3@12.10.0` in its own `allowScripts` configuration; otherwise native bindings remain unavailable. CI tests the consumer installation with that exact approval.

## Health and backups

Use `npm run tutor -- profile doctor [profile-id]` for read-only integrity, foreign-key, schema, and runtime diagnostics. It emits counts and status, not learner responses. A nonzero exit means the profile needs investigation. Diagnose against a copy if integrity fails; preserve the original files for recovery.

Create a consistent snapshot, including committed WAL state:

```bash
npm run tutor -- profile backup /private/backups/frontend-2026-10-01 frontend
```

The destination must be new. A completed snapshot contains `manifest.json` and `tutor.db`; protect both as learner data. Copy completed snapshots to an access-controlled location outside the working machine. Local backup files have restrictive permissions, but snapshots are not encrypted by Learning OS. Choose backup frequency and retention according to the acceptable amount of lost study work. A checkpoint for Git is not an independent backup.

Restore to a new, unselected profile and inspect it before selecting it:

```bash
npm run tutor -- profile restore /private/backups/frontend-2026-10-01 --id frontend-recovered --name "Recovered Frontend"
npm run tutor -- profile doctor frontend-recovered
npm run tutor -- profile use frontend-recovered
```

Restore rejects checksum, integrity, foreign-key, and current-schema mismatches. It never merges histories or replaces an existing profile. Periodically test restoration of a snapshot on another checkout before relying on it. A crash before registration can leave an unregistered profile directory; preserve it and inspect its database rather than deleting or automatically adopting it.

The registry coordination database `registry.json.lock.db` is persistent and ignored by Git. Never delete it while any Learning OS process is running: SQLite uses it to serialize writers. A busy error is retryable after the current writer finishes; terminating a crashed/suspended writer releases its operating-system lock. Use one canonical writer and local storage, not independent copies of the same profile on multiple machines or unsupported network filesystems.

## Current schema and rollback

Only the current schema is supported. Older databases fail explicitly; there is no historical migration chain. Back up learner state before upgrading. Roll back code together with a compatible snapshot into a new profile; do not open newer state with older code. Canonical managed registry/database files remain versioned according to AGENTS.md; a textual Git merge cannot combine SQLite histories.

## External and AI inputs

URL ingestion permits public HTTP(S) destinations only, pins vetted DNS addresses on each redirect, and enforces a total deadline, response-size cap, and redirect cap. Trusted filesystem roots must remain controlled by the operator; path checks cannot protect against a hostile local process replacing directories between system calls.

No production LLM provider ships with this repository. Enrichment is bounded to 100 concepts per batch, has bounded metadata/output and a 30-second completion deadline, and labels generated/template drafts. Provider implementations must honor `CompletionOptions.signal` to cancel paid work; timing out the caller cannot force a noncompliant provider to stop charging. Configure provider-side quotas before enabling an implementation. Structured prompts and output validation reduce malformed input/output; they do not establish factual correctness or make prompt injection impossible. Review generated material, and retain executable verification requirements for coding assessments.

## Performance limits

Normal chronological FSRS updates apply one event; corrections, stale cards, and out-of-order events replay history. Projection and weakness reconstruction still replay effective evidence linearly per assessment. Revision-note payload selection is bounded, while source highwaters/counts scan relevant metadata inside SQLite. These are local per-profile operations, not demonstrated million-user service guarantees. Benchmark representative profile histories before increasing usage substantially.
