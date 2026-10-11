# Teacher upgrade: learn faster, understand deeper (ideas taken from FPF)

> This is the "what and why". The step-by-step how is in `2026-10-11-implementation-plan.md`. Where the two disagree, the implementation plan wins (it corrects item 3 and item 6 below).

Written 2026-10-11 for the agent who picks this up. Owner: sole user, a student learning programming. He also uses the teacher for ad-hoc topics (trigonometry, meditation).

## Ground rules from the owner

- He is the only user. The live app can be broken or overhauled. No phased rollout, no pilots, no A/B studies, no "optional first" hedging. Make the change directly and cleanly.
- No license or attribution work. Write the ideas in our own words in our own files. No `fpf-*` file names, no runtime dependency on FPF or its MCP service.
- Goal: learn faster, understand deeper, waste fewer turns. The teacher must answer the question the learner is actually asking.

## Baseline reviewed

- Repo `/home/hamza/repo/learning-os`, HEAD `b154b56`, clean tree. FPF: https://github.com/ailev/FPF (Explanation Design DPF, "EXD", 20 Sep 2026; Human Capability Development DPF, "HCD", 2 Oct 2026 edition).
- Read in full: `SKILL.md`, `presentation-capabilities.md`, `docs/teacher-evaluation.md`, `docs/learning-outcome-pilot.md`, `docs/research/pedagogy-priorities.md`, parts of `reasoning-retrieval-playbook.md`, `AGENTS.md`, and the EXD and HCD documents.
- NOT read in full: the debugging, problem-solving and interview playbooks, `docs/teacher-agent-protocol.md` beyond headings, `src/teacher-pedagogy.ts`. Check them before editing so nothing is duplicated.
- The trig and meditation examples below come from the owner's account in an earlier plan. No transcripts were seen. If a transcript exists, read it first.

## Already in the repo (do not rebuild)

- Retrieval-first, commit-before-reveal, one-question-then-stop (`SKILL.md`).
- "Stuck" disambiguation: unclear wording / retrieval failure / overload / no first move / missing concept (`SKILL.md`).
- Fix only the highest-leverage observed gap; refine strong answers without over-coaching; stop rules; "answer already sufficient -> close" (`SKILL.md`, `reasoning-retrieval-playbook.md`).
- Confusion-pair discrimination: a case where competing models predict different outcomes (`reasoning-retrieval-playbook.md`).
- Visuals and representation choice, including a trigonometry unit-circle example (`presentation-capabilities.md`). Do not redo this; FPF adds almost nothing here.
- Assisted answers are not independent evidence; FSRS owns *when*, the selector owns *what* (kernel).

## What to change

### 1. Notice when the learner's question has changed (highest value)

Problem: learner understood sine/cosine as coordinates on the unit circle, then asked "why do they need special names at all?" That is a new question (why name a function), not a wrong answer. A teacher that re-explains the definitions answers the old question.

There is no row for this in the playbook's "Fast routing" table. Add one, plus a short rule in `SKILL.md` ("Start here"): before answering, decide what the learner's last message did. It can:

- change the question -> answer the new question; say what from the earlier answer still holds; don't restart.
- keep the question but use a wrong relation -> repair that relation only (name it, show where it fails, one retry on a changed case).
- reveal a missing piece (term, step, relation) -> supply that piece.
- dispute a premise -> check the definition or source; don't just rephrase.
- understand fine but prefer something else -> stop explaining; hand the decision back.

Done when: replaying the trig conversation, the teacher goes to "why name them" (same relationship shows up in triangles, rotation, waves; a name lets you reason without the drawing) and does not re-define sine/cosine.

### 2. "I already know this": believe it for teaching, not for evidence

Problem: owner asked for meditation from first principles, later said he knows the basics and wants a refresher then practice. The skill rightly says never infer mastery from confidence, but that rule protects *evidence*. In ad-hoc exploration no evidence is at stake, so the learner's own statement should change how we teach right now.

Add a rule: for graded or evidence-bearing work, ignore self-claims (unchanged). For ad-hoc exploration, take the claim at face value, give a short refresher, move to practice, and let the first practice attempt reveal any real gap. Don't re-teach foundations and don't add an assessment. Keep ad-hoc sessions ephemeral (no learner-state writes without explicit permission, as today).

Done when: replaying the meditation conversation, the teacher goes refresher -> practice in one move.

### 3. Specific self-explanation prompts

`SKILL.md` currently says to ask the learner to "explain the idea in their own words". That invites fluent paraphrase with no real relation behind it. Replace with prompts that target the exact relation, for example "what is your denominator counting, and what should it count for this question?" For a causal-error repair, have the learner (a) name the wrong relation, (b) say why it fails in this case, (c) say how the corrected relation works, then (d) retry on a case where the deciding condition changed. Do not schedule the retry yourself; Learning OS picks any later variant. The learner's response is already stored by the kernel.

The generic "own words" prompt is also hard-coded in `src/kernel/questions.ts` and `src/kernel/feedback.ts` (and pinned by two tests), so this needs a small kernel string change, not only skill edits. Must still obey the existing exposure and reconstruction rules (see below).

### 4. Fix the right thing, and mark where an example stops working

- If an explanation fails, decide whether the *content* is missing (add the missing fact), the *form* is unclear (relabel/reorder), or the learner needs *help* (a hint). A prettier diagram does not fix a missing fact.
- When using an example or analogy, say where it stops working. Include one case where a tempting shortcut gives the right number by coincidence, so the learner doesn't over-generalize.

Small additions to the playbook, not new files.

### 5. Audit practice packs for fake variety

`docs/research/pedagogy-priorities.md` priority 2 already says this: check whether variants change the condition that decides the answer, or only rename variables and story details. Do it as a one-off review of the four scaffold packs (async/await, promises, retry idempotency, transactions) and the calibrated prediction cases under `knowledge/*/challenges/`. For each variant write down what it changes and what wrong model it separates. Fix or replace variants that don't separate anything. This is content work, not teacher logic.

### 6. Make sure the change actually reaches the live teacher

- `.claude/skills/learning-os-teacher` is a symlink into the stale `.agents` copy, so Claude Code sessions in this repo load the old teacher.
- There are two tracked copies of the skill: `skills/learning-os-teacher/` and `.agents/skills/learning-os-teacher/`. They already differ (the `.agents` copy lacks the presentation section and `presentation-capabilities.md`). Pick one source of truth; delete or regenerate the other.
- `docs/agent-web-session-instructions.md` says web sessions read the skill from the repo each time, so edit `skills/` and `docs/teacher-agent-protocol.md`.
- Keep the three protocol copies in step: `SKILL.md`, `references/teacher-protocol.md`, `docs/teacher-agent-protocol.md`.
- Regenerate the hash in `skills-lock.json` after editing the skill.
- A stale snapshot lives at `~/repo/webharness/skills/learning-os-teacher/` (Sep 23). Update or delete it so no agent loads it.

## Rules to keep (they protect learning quality)

- In an active graded attempt, any example, diagram or worked step that reveals the target reasoning must be recorded as exposure *before* it is shown. Causal repair uses `requireReconstruction: true`. The new rules above do not override this.
- The teacher chooses how to explain. Learning OS still decides what is next and when review is due. Don't add anything that chooses objectives, schedules, or mastery.
- Ad-hoc exploration stays ephemeral.

## Don't do

- No FPF-based mastery model, scheduler or objective selector.
- No new persistent "teacher hypothesis" storage.
- No mandatory analysis on every learner turn. The changes above are things the teacher notices, not steps it runs.
- No copying FPF text into the repo or loading its MCP service in lessons.
- No new runtime logic. Items 1, 2 and 4 are skill/playbook edits; item 3 also changes two kernel strings and the tests that pin them.

## How to judge it (solo, no study)

1. Replay the trig and meditation conversations against the edited skill. The owner reads the replies and decides whether the teacher answered what he was actually asking.
2. Optionally add two scenarios to `src/evaluation/teacher-scenarios.ts` (changed question; "I know the basics"). The checker only validates state safety, so read the reply text yourself.
3. Run `npm test`, `npm run typecheck`, and the existing `eval:teacher` scenarios (especially `causal_model_error`, `answer_requested`, `ambiguous_answer`) to confirm nothing leaks answers.

## Reference: where the ideas come from

| Change | FPF source |
| --- | --- |
| 1 changed question vs wrong inference | EXD.1, EXD.4 |
| 2 learner-stated knowledge | EXD.1 (use the learner's own words and task; don't over-elicit) |
| 3 specific self-explanation, keep first answer | EXD.5, HCD.9 |
| 4 content vs form vs help; example boundary | EXD.2, EXD.3, EXD.6 |
| 5 variants must change the deciding condition | HCD.6.1, EXD.2 |

Docs: https://github.com/ailev/FPF/blob/main/Engineering%20DPF%20Suite/EXPLANATION-DESIGN-PRINCIPLES-FRAMEWORK.md and https://github.com/ailev/FPF/blob/main/Engineering%20DPF%20Suite/HUMAN-CAPABILITY-DEVELOPMENT-PRINCIPLES-FRAMEWORK.md

## Honest caveats

- FPF is written for engineering organizations. Most of HCD (programmes, providers, cultures) is not useful for one student. Only the pieces above are.
- FPF's own examples are constructed; it reports no measured learning gains. Treat this as "try it and see if it feels better", not a proven improvement.
- Corrections to the earlier plan: RMP has only RMP.1-RMP.4 published; the KCAE framework is not listed in FPF's README table (unverified); FPF's MCP service covers FPF Core and covers DPFs only if its snapshot says so; the "44 files / 339 patterns" counts were not re-verified (README says "more than 300").
- The scaffold outcome pilot (`docs/learning-outcome-pilot.md`) has never been run. If it is ever run, teaching changed mid-way; the owner doesn't plan to run it.
