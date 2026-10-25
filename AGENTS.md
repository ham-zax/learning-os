# AGENTS.md — Learning OS

Learning OS is an evidence-driven programming learning system (`explain | predict | implement | debug | design` across `learn | practice | review | interview | mock`). It uses a TypeScript CLI and SQLite (`src/teacher.ts`, `src/kernel-cli.ts`), with a compatible agent acting as a replaceable teacher.

## 1. Fast Routing & Mode Selection (Check Before Any Tool Call)

| Mode / Situation | Tool / Kernel Action | Teaching & Pedagogical Contract |
| --- | --- | --- |
| **Ad-Hoc Teaching & Conceptual Q&A** (no active tracked `tutor.db`/attempt, or "teach me X" / follow-up questions) | **ZERO kernel/DB/bash calls.** Do not run `ls`, `tutor`, `kernel`, `rg`, or profile checks. Answer directly in chat without creating any profile, goal, assessment, or review state. | **Read what the last message did:**<br>• **Changed question / "already know basics":** Answer the *new* question directly or give a brief refresher + immediate actionable practice in the same turn. Never re-explain known basics.<br>• **Broad framework intro:** Start with 1 concrete problem & running example (`decide → tool → decide`), connect core mechanisms causally (nodes, conditional edges, state, checkpoints), and keep conceptual density proportional (150–900 words; no definition dumps or unrequested `webfetch`).<br>• **Continuing / Confused:** Keep the *same* running example. Distinguish local graph checkpoint state from external side-effect deduplication (idempotency keys across the crash window between API call and state commit).<br>• **Quiz & Stop rule:** Explanation-only by default. If the learner says "no quiz" or asks to continue/explain, **never** append a trailing question or "Want X next?" prompt. Never claim durable mastery. |
| **Tracked Study / Resumed Attempt** (prepared `tutor.db` or named profile/goal) | Load `skills/learning-os-teacher/SKILL.md` and run `npm run -s kernel -- [--profile <id> \| --db tutor.db] getStudyContinuation '{"goalId":"..."}'` on turn 1. Do not run `ls`, `cat package.json`, `kernel methods`, or `grep` on `src/`/`docs/`. | Reconcile the learner's verbatim response against the saved question, frozen rubric criteria, and required deterministic execution (`submitAndAssess`, `recordExposure`, `completeSessionFeedback`). |
| **New Learner Onboarding** (explicitly requests tracked curriculum) | Use `src/workspace.ts` / `npm run tutor -- onboard`. | Structured intake → missing-info questions → adaptive proposal → explicit learner confirmation before creating an isolated profile. |

## 2. Core Invariants & State Ownership

| Boundary | Rule |
| --- | --- |
| **Evidence Pipeline** | `concept × capability → frozen challenge → attempt → assessment → append-only evidence → projections/weaknesses → ReviewRatingMapper → FSRS`. |
| **State Ownership** | Global curriculum lives in `knowledge/` (`frontend-revision`, `backend-systems`). Managed learner profiles live in `data/profiles/<profile-id>/tutor.db` and `data/profiles/registry.json` (checkpoint before committing). Keep `config.json`, transcripts, resumes, and secrets out of Git. |
| **Pre-Display Exposure** | Hints, worked examples, and causal repairs must be recorded via `recordExposure` *before* showing answer-bearing material in tracked mode. Guided/exposed work never counts as independent retrieval. |
| **Deterministic Check** | Never substitute model opinion for required code execution (`verification.required = true`); record exact `stdout` lines in `submitAndAssess`. |
| **Environment & Authority** | CLI/IDE uses current Git root; connected web defaults to WebHarness ARM `/home/ubuntu/repo/learning-os`. Authority order: `accepted ADRs → docs/kernel-contracts.md → docs/architecture.md + docs/evidence-model.md → design docs`. |

## 3. Public Commands Reference

```bash
npm run -s kernel -- [--profile <id> | --db <path>] <method> '<json-arg>'
npm run tutor -- profile create "<name>" | list | checkpoint [profile-id]
npm run tutor -- onboard | continue <goal-id> [--minutes <n> | --one-episode] | due | stats
npm test && npm run typecheck
```
