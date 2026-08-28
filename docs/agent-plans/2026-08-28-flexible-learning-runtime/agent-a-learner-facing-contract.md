# Agent A — Learner-Facing Contract Repair

**Repository:** `/home/hamza/repo/learning-os`
**Artifact type:** documentation/configuration plus live dogfood
**Workspace:** current `main` checkout
**Isolation reason:** none; you are the sole delegated writer for this wave
**Can start:** immediately
**Depends on:** design commit `79c239e4062fcee44f278dd5a7ee144bd5f8854b`
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `AGENTS.md` — repository authority and learner-state invariants.
- `docs/flexible-learning-runtime-design.md` — authoritative V2 requirements and live-session evidence.
- `docs/teacher-agent-protocol.md` — normative learner-facing teacher contract you are strengthening.
- `skills/learning-os-teacher/SKILL.md` and `skills/learning-os-teacher/references/teacher-protocol.md` — portable execution contract.
- `docs/agent-plans/2026-08-28-flexible-learning-runtime/README.md` — dependency map and Agent B gate.

Because this mission updates an existing Skill, load and follow the `skill-creator` Skill before editing the portable Skill source. Use the repository-local teacher protocol as the newer behavioral authority.

## Objective

Implement Wave 1 of the flexible learning runtime design so a fresh replaceable teacher reliably behaves like a teacher rather than a diagnostic conveyor belt.

The end state is a compact, explicit learner-facing contract in which answer-bearing teaching is actually visible to the learner, causal/foundational failures reach reconstruction before transition, harmless clarification can happen inside an active attempt, speech interactions are naturally chunked, learner evidence preserves what the learner actually said, and the next Learning OS move is not opened until the learner accepts the transition.

Do not add kernel/schema/state machinery in this mission.

## Current state

Two real learner interactions exposed concrete failures:

- useful correction/teaching was produced in hidden reasoning while the visible response moved on;
- `explanation_shown` was persisted even though the learner-visible transcript did not contain that explanation;
- reconstruction was skipped;
- the next attempt was opened before learner confirmation;
- internal readiness/attempt jargon leaked into normal teaching;
- speech-to-text did not cause large frozen challenges to be chunked conversationally;
- harmless vocabulary gaps such as `p95` were treated as target-objective weakness;
- learner speech was summarized before persistence instead of preserved as the evidence artifact;
- multiple pending diagnostics produced a test-conveyor-belt experience.

The repository Skill already contains first-wave pedagogy guidance, but the live sessions prove that several rules need to be made harder to miss and easier to execute correctly. The installable/packaged Skill also must not drift from repository source.

## Ownership

You own:

- the Wave 1 learner-facing behavior contract in `docs/teacher-agent-protocol.md`;
- the corresponding compact execution rules in `skills/learning-os-teacher/SKILL.md`;
- the portable fallback in `skills/learning-os-teacher/references/teacher-protocol.md`;
- any closely related teacher-pedagogy docs/index wording needed to keep authority and status coherent;
- fresh-teacher disposable-data dogfood of the repaired behavior;
- Skill validation/packaging required by the Skill workflow, without committing generated/transient artifacts unless repository convention explicitly requires them.

Neighboring work owns:

- objective selection and readiness/evidence semantics;
- FSRS scheduling;
- diagnostic breadth policy, remaining-time orchestration, and soft focus (future Agent B/Wave 3);
- pure `TurnDirective` helper code unless Wave 1 dogfood specifically proves protocol-only execution still fails;
- persistence changes for response segments/preferences/reconstruction checkpoints.

## Coordination contract

Preserve these boundaries:

1. Learning OS selects the objective/challenge/next move; the teacher adapts only inside the selected episode.
2. Hidden reasoning/tool output is never learner-visible teaching and never satisfies an exposure event.
3. If answer-bearing material will be shown, record exposure immediately before emitting the corresponding learner-visible material; do not record `*_shown` for material that is only planned or reasoned about internally.
4. After a causal/foundational failure and answer-bearing repair, require learner reconstruction or an explicit learner opt-out before transitioning to another objective.
5. Obtaining the next Learning OS recommendation is allowed after episode closure; opening its attempt is not allowed until the learner gives an unambiguous acceptance such as `yes`/`continue`.
6. A non-answer-bearing clarification may occur during an active attempt without becoming a hint/exposure or target weakness. If the clarification would reveal target reasoning, use the existing hint/exposure lifecycle instead.
7. Persist the learner's actual response artifact. For speech-to-text, repair only obvious transcription noise needed to recover what was actually said; keep assessment interpretation in rationale rather than rewriting the learner response into a cleaner summary.
8. In known speech/conversational mode, a large frozen challenge may be delivered one substantive subquestion at a time without changing its frozen criteria or sneaking in hints.
9. A real learner question/prediction turn should stop after the prompt. Do not append hints, solution fragments, or the next teaching move in the same visible turn.
10. Suppress internal state-machine vocabulary (`guided`, `exposed`, attempt IDs, pending-action labels, etc.) by default. Translate it into learner language unless the learner asks for system/progress details.
11. Challenge wording for novice baselines should test the target model rather than incidental jargon. Prefer mechanism-first plain language and more atomic criteria when partial understanding matters.
12. Close one interaction episode before requesting/starting unrelated future work. Replanning after closure is an orchestration boundary, not permission for the teacher to invent the next objective.

## Success conditions

- The normative protocol and portable Skill make all twelve coordination rules above explicit enough for a fresh teacher to execute without relying on prior chat context.
- Repository `SKILL.md` and bundled `references/teacher-protocol.md` agree on the normative essentials; any thin local wrappers remain coherent.
- The Skill update follows the repository/Skill packaging workflow so the installable artifact can be refreshed rather than leaving a known source/package drift.
- Fresh-teacher disposable-data dogfood demonstrates at minimum the design's scenarios for: causal misconception repair/reconstruction; harmless terminology clarification; learner `I don't know`; and speech-to-text chunking/transcript preservation.
- Dogfood does not write attempts/evidence/exposures into the real `backend-systems` learner DB.
- If fresh dogfood still violates clear Wave 1 rules, report the exact failure as causal evidence for Wave 2 instead of implementing a helper in this mission.
- No `src/` or DB schema changes are made.
- Commit the completed Wave 1 changes directly to local `main`, staging only owned files. Do not stage or commit `data/profiles/backend-systems/tutor.db` or any transient SQLite sidecars.

## Required validation

No repository tests are authorized.

Required because the source design explicitly calls for it:

- run fresh-teacher dogfood against disposable learner data for the Wave 1 acceptance scenarios above;
- inspect the resulting disposable evidence/exposure state where needed to verify visible-delivery coupling and evidence integrity;
- validate/package the updated Skill as required by `skill-creator` and report the resulting artifact location if one is produced;
- run `git diff --check` over the owned changes before committing;
- verify final Git status shows only pre-existing/unrelated learner DB state outside the commit.

Do not run the broad repository test suite.

## Out of scope

- Do not implement `TurnDirective` or another teacher helper unless a later mission is explicitly materialized from failed Wave 1 dogfood.
- Do not change `src/plan/today.ts`, selector policy, FSRS, scheduler state, learner DB schema, prerequisite graph semantics, or readiness projections.
- Do not implement soft focus or remaining-time APIs.
- Do not persist full transcripts, generic fatigue state, interview-signal scores, reconstruction tables, or new challenge-difficulty state.
- Do not modify or clean the real learner DB.

## Working style

Inspect current repository behavior before editing. Make the smallest coherent contract/Skill change that directly addresses demonstrated live failures. Prefer executable wording and short rules over another large conceptual essay.

Do not create a worktree. Do not create, modify, or run tests. Do not absorb Agent B's future orchestration work. If a Wave 1 requirement proves impossible without source changes, stop expansion and report the concrete missing boundary rather than silently adding kernel machinery.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. current `main` commit created;
3. exact protocol/Skill behavior changes;
4. disposable dogfood scenarios and observed outcomes;
5. Skill validation/packaging result and artifact location if produced;
6. confirmation that the real `backend-systems` DB was not staged/committed or used for dogfood;
7. whether the evidence now supports skipping Wave 2 and sending Agent B to Wave 3, or whether a specific Wave 2 helper is justified;
8. unresolved risks, deviations, or decisions needed.
