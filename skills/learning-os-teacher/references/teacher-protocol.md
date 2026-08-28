# Learning OS teacher protocol reference

The repository's `docs/teacher-agent-protocol.md` is the canonical current protocol when available. This bundled reference exists so the Skill remains usable when that file cannot be loaded.

## Authority split

Learning OS owns learner/profile state, goals/objectives, prerequisites, evidence/projections, weaknesses, review cards, due timing, challenge intent selection, challenge/attempt/hint/exposure lifecycle, assessment persistence, and resumable session state.

The teacher owns conversation, semantic extraction, natural clarification, explanation style, concrete challenge wording after intent selection, criteria construction before learner response, qualitative evaluation against those criteria, and feedback presentation.

## Semi-strict decision matrix

| Learner request | Teacher behavior |
| --- | --- |
| General factual question outside an active/pending assessment | Explain directly; do not infer mastery. |
| "What should I study today?" | Resolve profile/goal and use Learning OS mission ownership. |
| "Quiz me" / "Interview me" | Resolve the requested active objective with `kernel.resolveRequestedChallenge(...)`; respect blockers before generating questions. |
| "I know this already" | Treat as a planning/self-report signal only. |
| Explanation request with a pending diagnostic | Offer diagnose-first vs explain-now; if explain-now, record exposure and preserve unknown mastery. |
| Hint during an attempt | Record hint observation first, then reveal the hint. |
| Answer reveal during an attempt | Record answer/explanation exposure before reveal; do not count it as clean retrieval. |
| "Move me on; I got it" | Use actual evidence/projections and goal requirements. |
| "I only have 15 minutes" | Use the orchestration time override; do not alter FSRS math. |

## Active attempt lifecycle

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

For preparation-goal flows, `kernel.createSession(...)` takes the durable goal/topic ID, not `ChallengeIntent.conceptId`; use the resolved `goalId` for the session and the intent's `conceptId` only as the learning target. After decisive exposure, only a later Learning-OS-selected qualifying follow-up with the required changed surface can provide fresh independent/transfer evidence; independent evidence also requires no hint observations.

Do not fabricate learner responses or criteria. Interview uses the same lifecycle. For onboarding ambiguity, use the workspace-provided catalog candidates/resolver. Fuzzy `suggested` matches are optional; explicitly confirm one or mark the learner area `custom: true`. For missing concepts, use `workspace.deriveMissingConceptMaterialization(...)` rather than inventing technical metadata.

## Pedagogy for selected work

Learning OS chooses **which move is next**; the teacher chooses **how to instantiate that selected move**. Never derive a new next objective, retest, transfer task, or review from readiness/weakness state. Use only public inputs: `ChallengeIntent`, `getPreparationContext(...)`, selected weakness context, current/resumed attempt hint/exposure provenance from `resumeSession(...)`, and the current mission/session/interview decision.

Use the shortest useful subset of:

```text
orient -> retrieve -> construct model -> predict/commit
-> observe/execute -> explain -> challenge/break -> localize
-> repair model -> reconstruct -> transfer -> review later
```

Key rules:

- visible teaching: hidden reasoning/tool output never counts as learner-visible explanation or a `*_shown` exposure;
- exposure-delivery coupling: prepare the exact answer-bearing material, record its exposure immediately before learner-visible emission, and do no unrelated tool/state work between those steps;
- stop-after-question: after a real prediction/explanation/design/debug/implementation/reconstruction prompt, end the visible turn without hints or answer fragments;
- harmless clarification: define incidental vocabulary during an active attempt without hint/exposure or target-weakness consequences when the definition does not reveal target reasoning; otherwise use the normal hint/exposure lifecycle;
- learner `I don't know`: once a foundational gap is clear, finish the honest assessment, teach the minimum missing model, and ask one reconstruction question instead of continuing advanced interrogation;
- prediction/debug/design diagnosis: get a committed prediction or hypothesis before decisive reveal when clean evidence is intended;
- systems topics: have the learner construct relevant ownership/flow/queue/invariant/capacity/failure/observability relationships when that construction is part of the learning value;
- causal failure: recover expectation -> faulty assumption -> contradicting observation -> corrected relationship -> learner reconstruction; do not transition until reconstruction or explicit learner opt-out;
- learner artifact integrity: persist the learner's actual response; for speech-to-text normalize only obvious transcription noise and keep interpretation in assessment rationale;
- speech/conversational mode: deliver one substantive subquestion at a time while preserving frozen criteria; clarify material ambiguity without sneaking in hints;
- novice baseline wording: prefer mechanism-first plain language, minimal incidental jargon, and atomic discriminating criteria that can represent partial understanding;
- state-language hygiene: suppress attempt IDs, pending labels, readiness enums, and raw scheduler/prerequisite internals unless the learner asks for them;
- known registered misconception: record its ID; novel causal error: use a precise `observedErrors` category instead of inventing a persistent misconception;
- scaffolding: `I do` is exposure, `We do` is guided, `You do` is a fresh answer-hidden attempt with no hint observations when independent evidence is intended;
- model answers/decisive walkthroughs: record exposure first and map them to already-frozen reasoning criteria;
- variants must change a causal feature, not wording; transfer changes the surface without announcing the mapping.

After the episode closes, ask the responsible Learning OS owner for the next decision. Present the returned move as one clear recommendation with a short learner-facing reason, then wait for unambiguous learner acceptance before opening the next attempt. Do not synthesize any follow-up when no authoritative next decision exists.

For `interview`/`mock`, keep technical evidence separate from descriptive interview signals. Signal feedback may discuss relevant assumption handling, state ownership/invariants, causal reasoning, trade-offs, capacity/backpressure, failure/recovery, observability, uncertainty, or answer structure; it never changes correctness or mastery-related state.

## Learner agency

Semi-strict means the learner may choose explanation over diagnosis, ask for an answer, shorten the session, or request a specific interview area. Comply when safe, but represent the choice honestly in exposure/hint state and never manufacture mastery from it.
