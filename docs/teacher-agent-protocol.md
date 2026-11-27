# Teacher Agent Protocol (Onboarding & Challenge Authoring)

Optional specialist reference for confirmed onboarding, challenge authoring, and narrowly reviewing an inherited frozen challenge. Everyday teaching and tracked turns follow `skills/learning-os-teacher/SKILL.md` and the shared 5-tool interface (`study_next`, `study_submit`, `study_help`, `study_status`, `study_notes`).

## Onboarding workflow

New tracked learners follow:

```text
free-form learner input -> structured OnboardingIntake -> information needs -> clarification
-> deterministic proposal -> learner review -> explicit confirmation -> isolated profile + sparse objectives
```

Rules:
- Resume, JD, and self-report claims are planning signals only; they never create proficiency, evidence, or review cards.
- Before explicit confirmation of the exact current proposal, create no profile, goal, objective, or database mutations. If intake changes after showing a proposal, rebuild it first.
- Never guess through `clarify_scope`: use `InformationNeed.catalogCandidates` or `workspace.resolveCatalogArea(...)`. Let the learner confirm a fuzzy match or mark `custom: true`.
- For `create_missing` coverage, collect learner-relevant topic and prerequisite context and call `workspace.deriveMissingConceptMaterialization(...)` rather than inventing IDs, difficulty, or tags.

## Challenge authoring

Build a challenge only from the selected `ChallengeIntent`, preserving its objective, capability, task form, delivery context, novelty, weakness context, changed-surface requirement, recent-surface avoidance, and time constraint.

- For `predict` / `runtime_trace`, check curated prediction packs first (`study_next(autoOpenCalibrated=true)` or `findCalibratedCase` / `buildCalibratedChallenge`). Keep calibration keys and wrong models teacher-only.
- Prefer tasks where common wrong models predict different observable outcomes from the correct model.
- A `variant` changes an interleaving, constraint, ownership boundary, failure mode, workload shape, or API contract. A `transfer` task changes the surface enough to require recognizing the underlying principle without chapter cues.
- Freeze observable criteria before the learner responds (state owner, invariant, predicted outcome, localized bottleneck, or trade-off) and link target `claimIds` on frozen criteria when retesting a specific weakness.
- Pass the exact `ChallengeIntent` to `registerChallenge(challenge, intent)` so the authoring contract is frozen alongside the challenge. If goal membership or focus changed and registration rejects a stale intent, request a fresh decision from `study_next`.
- Record demonstrated causal errors via criterion-scoped `claimObservations` (`claimId`, `criterionId`, `disposition: "observed" | "cleared"`), never legacy `observedErrors`. Clear a claim only when a linked criterion is met and no other linked criterion failed on that evidence event.

## Review an inherited frozen challenge narrowly

When resuming an existing active challenge with a persisted `authoringContract`, ask one narrow question: *does this exact frozen challenge adequately satisfy the selected contract and yield valid evidence?* Do not reject a valid simple question merely because you could write a deeper one.

- **Before submission:** use `rejectActiveChallengeAttempt(...)` only for a genuine contract/evidence defect (ambiguity, unanswerability, answer leakage, objective/task-form mismatch, changed-surface violation, invalid rubric/verification, or failing to test the selected weakness). Author the replacement from the returned intent.
- **After submission:** if the challenge still yielded valid objective evidence, finish its normal lifecycle rather than voiding it. Only void if a defect invalidates the assessment opportunity; learner text stays durable and any invalidated evidence is appended via `reviseEvidence` / `study_submit(action="revise")`.
