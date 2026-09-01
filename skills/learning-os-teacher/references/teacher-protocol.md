# Learning OS teacher protocol reference

The repository's `docs/teacher-agent-protocol.md` is the canonical current protocol when available. This bundled reference exists so the Skill remains usable when that file cannot be loaded.

## Authority split

Learning OS owns learner/profile state, goals/objectives, prerequisites, evidence/projections, weaknesses, review cards, due timing, challenge intent selection, challenge/attempt/hint/exposure lifecycle, assessment persistence, and resumable session state.

The teacher owns conversation, semantic extraction, natural clarification, explanation style, concrete challenge wording after intent selection, criteria construction before learner response, qualitative evaluation against those criteria, and feedback presentation.

## Semi-strict decision matrix

| Learner request | Teacher behavior |
| --- | --- |
| General factual question outside an active/pending assessment | Explain directly; do not infer mastery. |
| "Continue" / "Resume" / "What should I study today?" | Resolve profile/goal and call `getStudyContinuation(...)` before selecting or opening work. |
| "Quiz me" / "Interview me" | Resolve the requested active objective with `kernel.resolveRequestedChallenge(...)`; respect blockers before generating questions. |
| "I know this already" | Treat as a planning/self-report signal only. |
| Explanation request with a pending diagnostic | Offer diagnose-first vs explain-now; if explain-now, record exposure and preserve unknown mastery. |
| Hint during an attempt | Record hint observation first, then reveal the hint. |
| Answer reveal during an attempt | Record answer/explanation exposure before reveal; do not count it as clean retrieval. |
| "Move me on; I got it" | Use actual evidence/projections and goal requirements. |
| "I only have 15 minutes" | Use the orchestration time override; do not alter FSRS math. |

## Active attempt lifecycle

After Learning OS selects a `ChallengeIntent`, call `getPedagogyRecommendation(goalId, intent)` and treat its pure, non-durable recipe as the default interaction shape. The helper may recommend free recall/brain dump, bounded guided discovery, a 4–5 item MCQ quiz, prediction, model construction, thought experiment, boundary testing, teach-back, debugging autopsy, reconstruction, or worked-example scaffolding; it never changes learner truth or next-work ownership. Execute multi-step recipes one learner prompt at a time, respecting atomic question chunking. Honor `maxProbeTurns` and `onImpasse`: learning/practice may teach the minimum missing model then reconstruct, while interview/mock must finish assessment before debriefing. When `withdrawScaffoldAfterSuccess` is true reduce assistance after success rather than repeating the same scaffold.

Treat one selected challenge as an interaction episode:

```text
select objective/task intent
→ build concrete challenge + criteria
→ register/freeze challenge
→ open attempt
→ present prompt and stop
→ collect actual learner response/artifact
→ record hints before showing them
→ submit attempt
→ deterministic verification when required
→ assess against frozen criteria
→ record assessment/evidence
→ if answer-bearing feedback is needed: record exposure immediately before visible reveal
→ visible feedback/repair
→ reconstruction after causal/foundational repair unless learner opts out
→ close episode
→ return to Learning OS for the next move
→ present that move
→ open its attempt only after unambiguous learner acceptance
```

For preparation-goal flows, `kernel.createSession(...)` takes the durable goal/topic ID, not `ChallengeIntent.conceptId`; persist selection provenance with `kernel.registerChallenge(challenge, intent)`, use the resolved `goalId` for the session, and use the intent's `conceptId` only as the learning target. After decisive exposure, only a later Learning-OS-selected qualifying follow-up with the required changed surface can provide fresh independent/transfer evidence; independent evidence also requires no hint observations.

Do not fabricate learner responses or criteria. If orchestration simply opened the wrong unsubmitted challenge and no same-intent authoring contract is involved, `abandonUnsubmittedSession(sessionId)` remains the cleanup path. If an inherited concrete challenge violates its persisted authoring contract, use `rejectActiveChallengeAttempt(...)`; after submission, void only an invalid assessment opportunity, not merely suboptimal valid work. Interview uses the same lifecycle. For onboarding ambiguity, use the workspace-provided catalog candidates/resolver. Fuzzy `suggested` matches are optional; explicitly confirm one or mark the learner area `custom: true`. For missing concepts, use `workspace.deriveMissingConceptMaterialization(...)` rather than inventing technical metadata.

## Pedagogy for selected work

Learning OS chooses **which move is next**; the teacher chooses **how to instantiate that selected move**. Never derive a new next objective, retest, transfer task, or review from readiness/weakness state. Use only public inputs: `ChallengeIntent`, `getPreparationContext(...)`, selected weakness context, current/resumed attempt hint/exposure provenance plus any persisted `authoringContract` from the continuation resume result (or `resumeSession(...)` in session-specific tooling), and the current mission/session/interview decision.

Call `getPedagogyRecommendation(goalId, intent)` before authoring the interaction. Execute its steps incrementally and honor their `direction` (`generation`, `recognition`, `reflection`). The recommendation may use pattern noticing before formalization, bounded guided discovery, MCQ discrimination, prediction, model construction, thought experiments, boundary tests, teach-back, debugging/autopsy, reconstruction, or worked examples. Its execution controls are also normative defaults: `fluent_execution` (including interview/mock or independent reinforcement practice) defers reflection until debrief, an empty `hintLadder` forbids mid-attempt coaching, `cognitiveLoadPosture` changes incidental complexity without changing the objective, and the challenge surface may request targeted remediation, compatible naturalistic interleaving, or an authentic artifact. After assessment, treat a slip with brief correction/recast and reserve autopsy plus reconstruction for a coherent model error.

Use the shortest useful subset of:

```text
orient -> retrieve -> construct model -> predict/commit
-> observe/execute -> explain -> challenge/break -> localize
-> repair model -> reconstruct -> transfer -> review later
```

Key rules:

- visible teaching: hidden reasoning/tool output never counts as learner-visible explanation or a `*_shown` exposure;
- exposure-delivery coupling: prepare the exact answer-bearing material, pass it to `recordExposure(...)` so the immutable teaching artifact and exposure are persisted together immediately before learner-visible emission, and do no unrelated tool/state work between those steps;
- stop-after-question: after a real prediction/explanation/design/debug/implementation/reconstruction prompt, end the visible turn without hints or answer fragments;
- harmless clarification: define incidental vocabulary during an active attempt without hint/exposure or target-weakness consequences when the definition does not reveal target reasoning; otherwise use the normal hint/exposure lifecycle;
- learner `I don't know`: once a foundational gap is clear, finish the honest assessment, teach the minimum missing model, and ask one reconstruction question instead of continuing advanced interrogation;
- prediction/debug/design diagnosis: get a committed prediction or hypothesis before decisive reveal when clean evidence is intended;
- systems topics: have the learner construct relevant ownership/flow/queue/invariant/capacity/failure/observability relationships when that construction is part of the learning value;
- causal failure: recover expectation -> faulty assumption -> contradicting observation -> corrected relationship; record answer-bearing repair with `requireReconstruction: true`; the kernel blocks replacement work for that repair/session until `resolveSessionReconstruction(...)` records reconstruction or explicit learner opt-out;
- learner artifact integrity: persist the learner's actual response; for speech-to-text normalize only obvious transcription noise and keep interpretation in assessment rationale;
- speech/conversational mode: deliver one substantive subquestion at a time while preserving frozen criteria; clarify material ambiguity without sneaking in hints;
- novice baseline wording: prefer mechanism-first plain language, minimal incidental jargon, and atomic discriminating criteria that can represent partial understanding;
- state-language hygiene: suppress attempt IDs, pending labels, readiness enums, and raw scheduler/prerequisite internals unless the learner asks for them;
- known registered misconception: record its ID; novel causal error: use a precise `observedErrors` category instead of inventing a persistent misconception;
- scaffolding: `I do` is exposure, `We do` is guided, `You do` is a fresh answer-hidden attempt with no hint observations when independent evidence is intended;
- model answers/decisive walkthroughs: record exposure first and map them to already-frozen reasoning criteria; articulation-only wording/structure refinement that adds no target reasoning is not exposure;
- inherited challenge review: continue an inherited frozen challenge when it validly satisfies its persisted authoring contract, even if you could write a better one; before submission reject concrete contract defects with `rejectActiveChallengeAttempt(...)` and author the replacement from its returned same-objective `replacementIntent`; after submission preserve merely suboptimal valid evidence and void only a genuinely invalid assessment opportunity; never reconstruct a missing authoring contract from chat memory;
- variants must change a causal feature, not wording; transfer changes the surface without announcing the mapping.

For “continue,” “resume,” ordinary next-action selection, and every post-episode transition, call `getStudyContinuation(...)`. Resume returned work before asking about time; unfinished required reconstruction outranks newer work. If it returns `needs_budget`, ask for current remaining **active-study** minutes and show its configured suggestion only as a suggestion. If it returns `recommend`, present the one move and wait for acceptance before opening an attempt. If it returns `no_action`, explain its blocker/no-work result. A break never expires an attempt or counts as active study; planner minutes are estimates only. A bare “continue” resumes open work but does not accept a newly recommended attempt unless the learner has given a standing “keep going” instruction.

When the learner explicitly asks to commit/push learner state, follow repository policy: checkpoint the canonical profile database before staging, exclude SQLite/registry coordination artifacts, and make remote visibility and binary-merge limits clear. Git mutation is outside the teacher kernel.

When the learner explicitly enters a curriculum/study phase, persist it with `setGoalStudyFocus({ goalId, label, objectiveIds })` using active goal-objective IDs from the confirmed curriculum/reference. Learning OS stores a stable focus episode with the resolved prerequisite/foundation closure. Recover the active episode from `getPreparationContext(goalId).studyFocus`, historical phases from `listGoalStudyFocusEpisodes(goalId)`, and close the episode with `clearGoalStudyFocus(goalId)` only when the learner completes, leaves, or changes phase; calendar-day changes never close it. Focus is orchestration intent, not competence evidence. Unrelated routine due work may appear only as a bounded warm-up and must not replace the focus main episode; with `maxItems: 1`, stay in the focus envelope unless Learning OS returns a higher-authority exception such as a blocking misconception, recurring/retest weakness, eligible weakness retest, true prerequisite, or transfer that is actually selection-eligible. Required transfer is a later goal-completion requirement, not an instruction to escalate immediately while readiness is below target or recent failure/unresolved weakness still needs repair; ordinary daily orchestration gates transfer until that foundation is ready.

For personalized revision notes, derive bounded history with `getRevisionNoteContext({ scope })`, write concise learner-facing Markdown only from that context, then persist the snapshot with `saveRevisionNote({ context, markdown })`. `current_focus` resolves to a stable focus episode; use `listGoalStudyFocusEpisodes(goalId)` and `focus_episode` scope for a closed phase such as Day 1. Pass the derived context to save unchanged so Learning OS can validate the complete canonical context and persist kernel-derived provenance. Historical exposures without teaching artifacts prove only that material was shown, not its exact content. Regenerate stale notes from fresh context. If displaying note content would reveal an answer during an active assessable objective, use the normal exposure lifecycle first. Notes never create mastery or retrieval evidence.

After any technical answer, optionally tighten terminology/order/structure into a concise senior-engineer formulation when materially useful. Keep it minimal when the learner was already close; repair missing causal reasoning before polishing wording. This articulation feedback never changes technical evidence.

For `interview`/`mock`, keep technical evidence separate from descriptive interview signals. Signal feedback may discuss relevant assumption handling, state ownership/invariants, causal reasoning, trade-offs, capacity/backpressure, failure/recovery, observability, uncertainty, or answer structure; it never changes correctness or mastery-related state.

## Stable interaction preferences

Recover explicit `inputMode` and `questionChunking` from preparation context. Persist changes with `setInteractionPreferences(...)` only when the learner explicitly establishes them. `speech_to_text`/`atomic` affect presentation and transcript interpretation only; they never alter competence state.

## Learner agency

Semi-strict means the learner may choose explanation over diagnosis, ask for an answer, shorten the session, or request a specific interview area. Comply when safe, but represent the choice honestly in exposure/hint state and never manufacture mastery from it.
