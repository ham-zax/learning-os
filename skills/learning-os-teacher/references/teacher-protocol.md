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

```text
select objective/task intent
→ build concrete challenge + criteria
→ register/freeze challenge
→ open attempt
→ present prompt
→ record hints before showing them
→ collect actual response/artifact
→ submit attempt
→ deterministic verification when required
→ assess against frozen criteria
→ record assessment/evidence
→ record corrective/answer exposure before reveal
→ feedback
→ return to Learning OS
```

Do not fabricate learner responses or criteria. Interview uses the same lifecycle. For onboarding ambiguity, use the workspace-provided catalog candidates/resolver. Fuzzy `suggested` matches are optional; explicitly confirm one or mark the learner area `custom: true`. For missing concepts, use `workspace.deriveMissingConceptMaterialization(...)` rather than inventing technical metadata.

## Learner agency

Semi-strict means the learner may choose explanation over diagnosis, ask for an answer, shorten the session, or request a specific interview area. Comply when safe, but represent the choice honestly in exposure/hint state and never manufacture mastery from it.
