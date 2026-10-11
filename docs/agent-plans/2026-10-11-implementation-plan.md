# Implementation plan: make the teacher answer what the learner actually asks

Written 2026-10-11 for the agent who implements it. Read `2026-10-11-teacher-upgrade-from-fpf.md` first for the why. This file is the how: exact files, exact wording, order, and checks. Do it in one pass. No phases, no feature flags, no compatibility shims.

Owner rules: sole user, can break and rebuild anything, wants the best learning experience, no license or rollout ceremony. Commit however you like.

## Baseline (checked 2026-10-11, HEAD b154b56)

- `tsc --noEmit` clean. `vitest run`: 31 files, 239 tests, all pass. Tests leave the tree clean.
- Two tracked copies of the teacher skill exist and already differ (see step 1).

## Step 1: one skill, not two

Facts:
- `.agents/skills/learning-os-teacher/` is a tracked copy added in commit fb60173. It is missing the presentation section in `SKILL.md`, `references/presentation-capabilities.md`, and has an older `teacher-protocol.md`.
- `.claude/skills/learning-os-teacher` is a symlink to `../../.agents/skills/learning-os-teacher`, so Claude Code sessions in this repo load the stale copy.
- `skills-lock.json` was added in the same commit only to pin that copy. Nothing else references it.
- `docs/agent-web-session-instructions.md` says web sessions read `skills/learning-os-teacher/` from the repo each time.

Do:
1. `git rm -r .agents/skills/learning-os-teacher`
2. Create a relative symlink `.agents/skills/learning-os-teacher -> ../../skills/learning-os-teacher`. Keep the `.claude` symlink; confirm `readlink -f .claude/skills/learning-os-teacher` resolves to `skills/learning-os-teacher`.
3. `git rm skills-lock.json`.
4. Read `~/repo/webharness/skills/README.md`. That directory (a different repo) holds a Sep 23 snapshot of the skill, with no `presentation-capabilities.md`. If any agent loads from it, replace its `learning-os-teacher` with the repo version after step 8; if nothing loads it, delete that copy and update the README list.

Done when: only one real copy of the skill exists, and both symlinks resolve to it.

## Step 2: playbook edits

File: `skills/learning-os-teacher/references/reasoning-retrieval-playbook.md`.

2a. In "Fast routing", add two rows before the last row:

```
| Learner's message asks something new ("but why does it even need a name?") after understanding the last answer | answer the new question; say in a clause what from before still holds | re-explaining the earlier definition |
| Learner says they already know the basics (ad-hoc exploration only; nothing assessed or recorded) | short refresher, then practice; let the first attempt show any real gap | re-teaching foundations or adding a quiz |
```

2b. Add a new section right after "Fast routing":

```
## Read what the last message did

Before explaining anything, decide what the learner's latest message did. Most wasted turns come from answering the old question.

| The message... | Do this | Not this |
| --- | --- | --- |
| asks a new question | Answer the new question. Say in a clause what from before still holds. | Re-explain the earlier answer. |
| keeps the question but uses a wrong relation | Name that relation, show where it fails on this case, ask for the corrected one. | Re-teach the whole topic. |
| shows a missing piece (a term, a step, how two things connect) | Supply that piece and nothing else. | A longer lecture or a prettier diagram. |
| disputes a premise or definition | Check the definition or source with them. | Say the same claim more fluently. |
| understands but prefers a different choice | Stop explaining. The decision is theirs. | Push until they agree. |

If you cannot tell which one it is, ask one small question whose answers lead to different next moves (for example: "which of these should count equally here?").
```

2c. Add a new section after "Confusion-pair discrimination":

```
## Repair the right thing

When an explanation did not land, decide what is missing before changing it:

- a fact or relation is missing -> add that fact. A better diagram or table will not.
- everything is there but hard to follow -> change the form (labels, order, one table or sketch).
- the learner needs a nudge -> give a hint and treat the next answer as assisted.

Say where an example or analogy stops working. Where useful, include one case in which a tempting shortcut gives the right answer by coincidence, so it is not over-generalized.
```

2d. In "Prior-knowledge bridges" add at the end: `That caution is about evidence. When choosing how to teach in ad-hoc exploration, believe the learner's own statement of what they already know.`

## Step 3: SKILL.md edits

File: `skills/learning-os-teacher/SKILL.md` (keep additions short; it is already 455 lines).

3a. "Start here", after the step-2 list, add one line:
`   - Whatever the route, first decide what this message did: asked something new, kept the question with a wrong relation, showed a missing piece, disputed a premise, or stated a preference. Answer that, not the previous question. Table: `references/reasoning-retrieval-playbook.md` -> "Read what the last message did".`

3b. "Respond to the answer and the learner's effort choice", the `reconstruct` sentence currently ends "Ask the learner to explain the idea in their own words, without using the internal label." Replace with:
`Ask for the specific relation that was repaired, in plain words and without the internal label (for example: what does the denominator count, and what should it count here?). For a causal repair, have them say what the wrong assumption was, why it fails in this case, and how the corrected relation works. Do not schedule a retry yourself; Learning OS picks any later variant.`

3c. "When the learner overrides the suggested pedagogy", add:
`- "I already know the basics, give me a refresher and then practice." -> In ad-hoc exploration (nothing assessed, nothing recorded) take it at face value: short refresher, then practice, and let the first attempt show any real gap. No re-teaching of foundations, no added quiz. In tracked work it never creates evidence or skips the frozen challenge; the fastest way to honor it is to present the real question.`

Note: `lefthook.yml` prints a reminder when `SKILL.md` changes. Treat it as a prompt to do step 4.

## Step 4: keep the protocol copies in step

- `skills/learning-os-teacher/references/teacher-protocol.md` line ~68: replace `say "explain it in your own words" rather than naming the...` with an instruction to ask for the specific repaired relation in plain words, not "reconstruction". Read the full sentence before editing.
- `docs/teacher-agent-protocol.md` line ~309, the `reconstruct` row. New text: `Use the saved question, written so it asks for the specific repaired relation rather than a general paraphrase. Briefly say why you are asking. This is practice, not a new test.` Also add a short "Read what the last message did" subsection (same table as 2b) under "Adapt feedback to the actual answer", and the override bullet from 3c under the learner-agency section.
- `docs/question-presentation-design.md` line ~19: it describes the reconstruction prompt as "explain it in their own words". Update to match.

## Step 5: kernel strings (small code change)

The generic prompt is also hard-coded. The question body is teacher-written, but the orientation line and reason text are not.

- `src/kernel/questions.ts` ~238. Current: `We looked at this earlier. Explain it in your own words. If anything is still unclear, we can go over it again.` New: `We looked at this earlier. Try it from memory. If anything is still unclear, say so and we can go over it again.`
- `src/kernel/feedback.ts` ~69, the `reconstruct` reason. New: `Use the saved question, which should ask for the specific relation that was repaired rather than a general paraphrase. This is practice, not a new test.`
- Update the tests that pin these strings: `tests/question-presentation.test.ts` line ~61 and `tests/adaptive-feedback.test.ts` line ~109.
- Leave the legacy CLI session flow alone (`src/cli.ts`, `src/session/modes/*`). It does not go through the teacher kernel.

## Step 6: audit practice packs for fake variety

Scope: the four scaffold packs (`js-async-await-predict`, `js-promises-predict` under `knowledge/frontend-revision/challenges/`; `retries-idempotency-predict`, `database-transactions-predict` under `knowledge/backend-systems/challenges/`) and the calibrated same/variant/transfer cases loaded by `src/knowledge/challenge-calibration.ts`. Read the code that loads them and the tests (`challenge-calibration`, `backend-challenge-calibration`, `calibrated-packs`, `scaffold-content`, `scaffold-material`) before changing content.

For every variant, record in a new file `docs/research/pack-variant-audit.md`:
- what it changes compared with the base case (the deciding condition, or just names, values and story);
- which wrong mental model it separates from the right one (the two must give different outputs on this variant);
- verdict: keep, rewrite, or drop.

A variant fails if only identifiers, numbers or story change and the same wrong model still produces the same answer as the right one. Rewrite those so the deciding condition changes. Run the snippets in Node to confirm expected outputs and wrong-model outputs. Do not hand-compute. Keep the packs' file formats and ids so the loaders and tests still pass.

## Step 7: two replay checks (optional scenarios)

Read `src/evaluation/teacher-scenarios.ts` and `src/evaluation/cli.ts` first. If an ad-hoc scenario with no durable state fits the harness (nothing recorded, check that no state was written), add `changed_question` (learner understood sine/cosine as coordinates, then asks why they need names) and `knows_basics` (learner asked for first principles on meditation, then says they know the basics and wants a refresher then practice). If it does not fit cleanly, skip it; the manual replay in step 8 is enough. The checker only validates state safety, so a human reads the reply text.

## Step 8: verify

1. `npm run typecheck && npm test` (baseline: 31 files, 239 tests).
2. `npm run eval:teacher -- list` still lists the existing scenarios.
3. Give a fresh teacher the edited skill and run `causal_model_error`, `answer_requested`, `ambiguous_answer`, `scaffold_assisted_answer_closure`. Read the replies: no answer leaked before exposure was recorded; reconstruction asks for the specific relation, not a paraphrase.
4. Replay the two real conversations (trig, meditation) with the owner. Pass = the trig reply goes to "why name them" (same relationship shows up in triangles, rotation and waves; a name lets you reason without the drawing) without re-defining sine/cosine, and the meditation reply is refresher then practice in one move. If transcripts are not available, ask the owner to restate each one.
5. `grep -rn "own words" skills docs/teacher-agent-protocol.md src/kernel` shows no generic paraphrase instruction left in skill, protocol or kernel.
6. `git status` shows no changes under `data/` and no learner databases.
7. `npm run check:package` still passes.

## Do not touch

- `src/kernel/foundation.ts`, `src/kernel/evidence.ts`, `src/scheduler/`, `src/selection/`, `src/plan/today.ts`: learner truth, FSRS, selection stay as they are.
- `data/profiles/**` (real learner state).
- The exposure rule: in an active graded attempt, any example, diagram or worked step that reveals the target reasoning is recorded as exposure before it is shown; causal repair keeps `requireReconstruction: true`. Nothing above weakens that.
- No FPF-derived mastery model, scheduler, objective picker or stored teacher hypotheses. No mandatory per-turn analysis. No runtime dependency on FPF.

## Not in this plan

Larger ideas from `docs/research/pedagogy-priorities.md` (curated progressions for debugging and implementation, tracking help-dependence over time) are worth doing later but are separate work.

## Done checklist (A1 reconciliation, 2026-10-11)

- [x] One **in-repository** canonical skill copy; `.agents` and `.claude` symlinks resolve to `skills/learning-os-teacher`; `skills-lock.json` absent. Unrelated external skill snapshots are not certified by this repo-level check.
- [x] Playbook, SKILL.md and both protocol copies carry aligned changed-question, causal-repair and ad-hoc knows-basics directions (inspected current source, not merely inferred from prior commits).
- [x] Two kernel strings and their corresponding tests carry the intended first-wave edits (inspected current source; tests passed).
- [x] `docs/research/pack-variant-audit.md` written; **18/18** calibrated sources and **8/8** scaffold check sources match Node execution, **30/30** declared wrong-model contrasts differ, and all six `variant` cases change a decision-bearing condition. No failing variant required repair. Existing pack tests passed.
- [x] Typecheck and full test suite pass in the selected **non-ARM** WSL checkout (31 files / 239 tests). Also passed `npm run build`, `npm run check:package` (591 files; no learner state/unreviewed sources), and `npm run -s eval:teacher -- list` (16 scenarios).
- [ ] Trig and meditation replays **judged by the owner**. A1 supplied explicitly hypothetical synthetic dialogue examples in `docs/research/fpf-teacher-replay-audit.md`, not owner judgment. A tool-disabled fresh Claude replay was attempted but blocked by its weekly limit; no model response was observed. This checkbox intentionally remains open.

**Evidence / limitations:** Both A1 audit documents separate actual executable verification from A1-authored illustrative replies. The software suite checks kernel/exposure invariants; neither passing code tests nor synthetic text establishes human learning gains or delayed retention. Independent R1 review remains assigned to a separate agent after A2.
