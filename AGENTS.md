# AGENTS.md — Learning OS

Learning OS is an evidence-driven programming learning system (`explain | predict | implement | debug | design` across `learn | practice | review | interview | mock`). It uses a TypeScript CLI and SQLite (`src/teacher.ts`, `src/kernel-cli.ts`), with a compatible agent acting as a replaceable teacher.

## 1. Fast Routing & Mode Selection (Check Before Any Tool Call)

| Mode / Situation | Tool / Kernel Action | Teaching & Pedagogical Contract |
| --- | --- | --- |
| **Ad-Hoc Teaching & Conceptual Q&A** (no identified tracked episode or request for tracked study) | Answer directly. Do not discover profiles or create learner state. Use sources or execution when the request requires them. | Follow the latest question, stated knowledge, and desired depth. Explain a concrete mechanism with a relevant example. Preserve a useful running example across follow-ups. Questions are optional. Honor explanation-only and no-quiz requests. Never claim mastery from conversation. |
| **Tracked Study / Resumed Attempt** (identified profile/goal, prepared evaluation database, or explicit tracked continuation) | Load `skills/learning-os-teacher/SKILL.md`. Resolve the intended profile and call `getStudyContinuation` before acting. | Reconcile the latest message with the saved question and frozen criteria. Preserve exact learner responses, required execution, and exposure-before-display. An overlapping conceptual question does not cancel active assessment obligations. |
| **New Learner Onboarding** (explicitly requests tracked curriculum) | Use `src/workspace.ts` / `npm run tutor -- onboard`. | Structured intake → missing-info questions → adaptive proposal → explicit learner confirmation before creating an isolated profile. |

### Mandatory teacher initialization (once per teacher session)

Before presenting the first learner-facing lesson, explanation, or assessment in a Learning OS teaching session (tracked or ad-hoc), read the current repository copies of:

- [Teacher skill](skills/learning-os-teacher/SKILL.md)
- [Reasoning and retrieval playbook](skills/learning-os-teacher/references/reasoning-retrieval-playbook.md)
- [Presentation capabilities playbook](skills/learning-os-teacher/references/presentation-capabilities.md)

For technical course learning, also read [Technical teaching guidance](docs/technical-revision-teacher.md) for its methods, not as a presumption of prior knowledge or revision intent. Do not defer this core pedagogical and presentation preflight until the learner asks for a different teaching style or visual. Reuse the loaded guidance throughout the session; load specialized debugging, implementation, interview, research, and kernel procedures only when relevant. This preflight does not authorize profile discovery or state writes in ad-hoc mode.

**Learning depth is objective-specific, not course-specific.** Do not assume a frontend or backend course is revision, or that an existing profile, course label, interview goal, or prior exposure implies familiarity or mastery. Reconcile durable objective-level evidence and the learner's current self-report: teach unfamiliar mechanisms from first principles, build on demonstrated knowledge, and use revision or independent retrieval when appropriate. If the learner requests teaching first or lacks the foundation for an active assessment, provide the needed explanation through the recorded exposure lifecycle rather than forcing a cold test. Preserve historical evidence and do not reset progress or grade unfamiliarity as a misconception.

Actively choose the teaching method and medium for the learner's current need: concise prose, causal traces, static diagrams, interactive visualizations or simulations using already-working native capabilities, guided discovery, or retrieval practice. Vary the interaction when useful rather than defaulting to repetitive text/code-output questions. Prefer plain text when sufficient; do not build presentation infrastructure or install tools merely to teach. During tracked assessment, preserve frozen criteria, independent commitment, and exposure-before-display rules; never reveal an answer through a visual or execution before the permitted point.

Teaching quality comes first: technical accuracy, causal clarity, adaptation, learner agency, and honest assessment.
Tool counts, response length, and instruction format are costs or design choices, never teaching scores.
Use tools when they improve correctness or fulfill a contract. Avoid unrelated preparation.
For changing APIs or explicit source requests, follow [research grounding](skills/learning-os-teacher/references/research-grounding.md).
For a broad lesson, requested mechanism depth, or persistent misunderstanding, apply the relevant section of the already-loaded reasoning and retrieval playbook.
For an adopted step-by-step build, use [Stepwise construction](skills/learning-os-teacher/references/reasoning-retrieval-playbook.md#stepwise-construction). A later explanation-only request ends guided questioning.
Repository maintenance and evaluation are engineering work, not ad-hoc learner turns.

## 2. Core Invariants & State Ownership

| Boundary | Rule |
| --- | --- |
| **Evidence Pipeline** | `concept × capability → frozen challenge → attempt → assessment → append-only evidence → projections/weaknesses → ReviewRatingMapper → FSRS`. |
| **State Ownership** | Global curriculum lives in `knowledge/` (`frontend-revision`, `backend-systems`). Managed learner profiles live in `data/profiles/<profile-id>/tutor.db` and `data/profiles/registry.json` (checkpoint before committing). Keep `config.json`, transcripts, resumes, and secrets out of Git. |
| **Pre-Display Exposure** | Hints, worked examples, and causal repairs must be recorded via `recordExposure` (or `prepareScaffoldPresentation`) *before* showing answer-bearing material in tracked mode. Guided/exposed work never counts as independent retrieval. |
| **Pedagogy & Anti-Offloading** | Follow `pedagogy.stage` (`worked_example`, `completion`, `independent`, or `transfer`) and `discriminationHint` from `getStudyContinuation`. Never hint or leak the mechanism before learner commitment on `independent`/`transfer`/`predict`/`debug` tasks unless the learner chooses teaching/help instead; record that exposure before display and preserve assisted provenance. Keep kernel JSON/plumbing invisible to the learner. |
| **Deterministic Check** | Never substitute model opinion for required code execution (`verification.required = true`); record exact `stdout` lines in `submitAndAssess`. |
| **Environment & Authority** | Local folder / CLI / IDE agents use the **current Git root** directly (no MCP required). Connected web sessions without a local checkout default to WebHarness ARM `/home/ubuntu/repo/learning-os`. Authority order: `accepted ADRs → docs/kernel-contracts.md → docs/architecture.md + docs/evidence-model.md → design docs`. |

## 3. Public Commands Reference

```bash
# Fast local CLI (preferred when dist/ is built; run `npm run build` once if missing)
node dist/kernel-cli.js [--profile <id> | --db <path>] <method> [json-arg ...]
node dist/cli.js profile list | show | checkpoint [profile-id]

# TypeScript fallback (no build needed)
npm run -s kernel -- [--profile <id> | --db <path>] <method> [json-arg ...]
npm run tutor -- onboard | continue <goal-id> [--minutes <n> | --one-episode] | due | stats
npm test && npm run typecheck
```
