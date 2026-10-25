# AGENTS.md — Learning OS

Learning OS is an evidence-driven programming learning system (`explain | predict | implement | debug | design` across `learn | practice | review | interview | mock`). It uses a TypeScript CLI and SQLite (`src/teacher.ts`, `src/kernel-cli.ts`), with a compatible agent acting as a replaceable teacher.

## 1. Fast Routing & Mode Selection (Check Before Any Tool Call)

| Mode / Situation | Tool / Kernel Action | Teaching & Pedagogical Contract |
| --- | --- | --- |
| **Ad-Hoc Teaching & Conceptual Q&A** (no identified tracked episode or request for tracked study) | Answer directly. Do not discover profiles or create learner state. Use sources or execution when the request requires them. | Follow the latest question, stated knowledge, and desired depth. Explain a concrete mechanism with a relevant example. Preserve a useful running example across follow-ups. Questions are optional. Honor explanation-only and no-quiz requests. Never claim mastery from conversation. |
| **Tracked Study / Resumed Attempt** (identified profile/goal, prepared evaluation database, or explicit tracked continuation) | Load `skills/learning-os-teacher/SKILL.md`. Resolve the intended profile and call `getStudyContinuation` before acting. | Reconcile the latest message with the saved question and frozen criteria. Preserve exact learner responses, required execution, and exposure-before-display. An overlapping conceptual question does not cancel active assessment obligations. |
| **New Learner Onboarding** (explicitly requests tracked curriculum) | Use `src/workspace.ts` / `npm run tutor -- onboard`. | Structured intake → missing-info questions → adaptive proposal → explicit learner confirmation before creating an isolated profile. |

Teaching quality comes first: technical accuracy, causal clarity, adaptation, learner agency, and honest assessment.
Tool counts, response length, and instruction format are costs or design choices, never teaching scores.
Use tools when they improve correctness or fulfill a contract. Avoid unrelated preparation.
For changing APIs or explicit source requests, follow [research grounding](skills/learning-os-teacher/references/research-grounding.md).
For a broad lesson, requested mechanism depth, or persistent misunderstanding, load the [reasoning playbook](skills/learning-os-teacher/references/reasoning-retrieval-playbook.md).
For an adopted step-by-step build, use [Stepwise construction](skills/learning-os-teacher/references/reasoning-retrieval-playbook.md#stepwise-construction). A later explanation-only request ends guided questioning.
Repository maintenance and evaluation are engineering work, not ad-hoc learner turns.

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
