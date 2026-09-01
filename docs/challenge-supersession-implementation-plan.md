# Challenge Supersession and Authoring-Contract Implementation Plan

**Goal:** Let a replacement Learning OS teacher reject a defective inherited challenge without rewriting frozen history, discarding legitimate learner evidence, or asking the planner to choose a different objective.

**Architecture:** Persist the selection-time `ChallengeIntent` as an immutable authoring-contract snapshot adjacent to each teacher-authored frozen challenge. Keep `ChallengeSpec` immutable and separate. Add one terminal attempt-disposition path that can reject an unsubmitted challenge or void a submitted invalid assessment opportunity while preserving the attempt as memory contact; replacement authoring reuses the same persisted intent plus rejected-surface avoidance.

**Tech Stack:** TypeScript, Zod, better-sqlite3, existing Learning OS teacher kernel and append-only evidence model.

## Global Constraints

- Learning OS remains authoritative for objective/task selection; replacement teaching must not rerun ordinary planning merely because the concrete challenge was defective.
- Frozen challenges/rubrics remain immutable historical artifacts.
- A merely less sophisticated challenge remains valid when it still measures the selected objective; stronger teachers must not discard legitimate submitted learner work just because they could ask a better question.
- Defective submitted attempts produce zero effective competence evidence, but remain learner memory contact and recent-surface history.
- Do not fabricate an assessment just to invalidate it.
- Do not add subjective `wrong_depth` or generic challenge-quality scores.
- Do not add a parallel mastery, scheduling, or teacher-side selection system.
- Preserve existing canonical learner data; do not mutate the live backend-systems profile while implementing this feature.
- No test creation, modification, or test-suite execution is authorized by this plan. Use focused direct runtime probes on disposable databases plus candidate-final type/build/diff checks.

## File Map

- `src/selection/types.ts` — authoritative selection-time intent shape and persisted authoring-contract conversion/type.
- `src/db/database.ts` — schema v15 migration for immutable authoring contracts and terminal attempt dispositions.
- `src/db/types.ts` — persistence schemas/enums for authoring-contract rows and challenge-attempt dispositions.
- `src/kernel/foundation.ts` — register/recover authoring contracts, expose them on resume, exclude voided attempts from unresolved verification/assessment, and block evidence lifecycle entry for voided attempts where appropriate.
- `src/kernel/challenge-rejection.ts` — cross-owner rejection operation coordinating attempt disposition, existing evidence invalidation, session closure, and replacement intent recovery.
- `src/kernel/evidence.ts` — enforce the voided-attempt assessment/revision boundary while reusing existing `reviseEvidence(...)` for append-only invalidation.
- `src/teacher.ts` — public teacher-kernel methods for intent-aware challenge registration/recovery and challenge-attempt rejection.
- `docs/kernel-contracts.md` — persistence/lifecycle contract for immutable authoring intent, rejection, voiding, and memory-contact semantics.
- `docs/teacher-agent-protocol.md` — bounded replacement-teacher conformance review and three-way behavior: continue valid, replace defective unsubmitted, void defective submitted.
- `docs/teacher-pedagogy-design.md` — clarify that authoring-contract provenance is justified by replaceable-teacher use and is distinct from deferred challenge-load scoring.
- `skills/learning-os-teacher/SKILL.md` and `skills/learning-os-teacher/references/teacher-protocol.md` — portable execution guidance synchronized with the runtime contract.

### Task 1: Persist immutable challenge authoring contracts

**Files:**
- Modify: `src/selection/types.ts`
- Modify: `src/db/types.ts`
- Modify: `src/db/database.ts`
- Modify: `src/kernel/foundation.ts`
- Modify: `src/teacher.ts`

**Interfaces:**
- Consumes: existing `ChallengeIntent`, `ChallengeSpec`, `registerChallenge(...)`, objective metadata.
- Produces: immutable authoring-contract snapshot storage, `getChallengeAuthoringContract(...)`, intent-aware registration, and resumed-attempt access to the original authoring contract.

**Steps:**
- Add a stable V1 authoring-contract snapshot containing the selection fields needed to judge authoring conformance: objective/concept/capability, task form, delivery context, novelty, selection reason kind/reason, due time, selected weakness, changed-surface requirement, and recent challenge surfaces to avoid.
- Add schema v15 table `challenge_authoring_contracts`, keyed by `(challenge_id, version)`, with immutable update/delete protection and a foreign key to the frozen challenge version.
- Allow `registerChallenge(...)` to receive an optional authoring contract separately from `ChallengeSpec`; validate that the concrete challenge preserves the contract's objective, task form, delivery context, novelty, concept, and capability before freezing.
- Keep historical/non-selection challenge registration compatible when no authoring contract exists.
- Return the persisted contract through resumed attempt state so a replacement teacher does not need conversation memory.

**Acceptance criteria:**
- A new selected challenge can be frozen with its immutable authoring contract and reconstructed after reopening the database.
- Registration rejects a concrete challenge that contradicts objective/task-form/delivery-context/novelty or objective concept/capability from its supplied authoring contract.
- Existing historical challenges without authoring-contract rows remain readable/resumable.

### Task 2: Add terminal challenge-attempt rejection/void semantics

**Files:**
- Modify: `src/db/types.ts`
- Modify: `src/db/database.ts`
- Modify: `src/kernel/foundation.ts`
- Create: `src/kernel/challenge-rejection.ts`
- Modify: `src/kernel/evidence.ts`
- Modify: `src/teacher.ts`

**Interfaces:**
- Consumes: active attempt/session, frozen challenge, persisted authoring contract, `abandonUnsubmittedSession(...)`, existing evidence revision/rebuild behavior.
- Produces: `rejectActiveChallengeAttempt(sessionId, input)` returning the preserved authoring contract plus rejected-surface avoidance for replacement authoring.

**Steps:**
- Add immutable `challenge_attempt_dispositions` rows keyed by attempt, recording whether rejection occurred before submission or the submitted assessment opportunity was voided, defect reason, defect scope, detail, and timestamp.
- Use objective contract-failure reason codes only: ambiguous, unanswerable, answer-leaking, objective mismatch, task-form mismatch, selected-weakness mismatch, changed-surface violation, invalid rubric, verification mismatch, or other contract violation. Do not add `wrong_depth`.
- For an unsubmitted active attempt: record the rejection disposition, end/clear the session through the existing abandonment semantics, and return the same persisted authoring contract with the rejected challenge appended to recent-surface avoidance.
- For a submitted attempt: allow voiding only when the defect makes the assessment opportunity invalid, preserve learner response/time/contact, invalidate any already-effective evidence without creating replacement evidence, mark the attempt disposition, and close the session so it no longer resumes for verification/assessment.
- Do not allow a selected-weakness mismatch alone to void already-submitted otherwise-valid evidence; that case must complete its normal evidence lifecycle and leave the weakness unresolved.
- Make unresolved verification/assessment queries ignore terminally voided attempts, while existing memory-contact and recent-challenge-history queries continue seeing them.
- Refuse verification/assessment writes against a voided attempt.

**Acceptance criteria:**
- A rejected unsubmitted attempt remains historical contact but is no longer resumable.
- A voided submitted attempt preserves its learner response, produces no effective competence evidence, and is no longer resumable for verification/assessment.
- If evidence existed before an intrinsic defect was discovered, it becomes ineffective through the existing append-only evidence-revision mechanism and projections/review state rebuild accordingly.
- A submitted challenge that was merely suboptimal for a selected weakness cannot be voided under that reason.
- Replacement output reuses the exact original authoring contract rather than invoking ordinary planning.

### Task 3: Define bounded replacement-teacher quality review

**Files:**
- Modify: `docs/kernel-contracts.md`
- Modify: `docs/teacher-agent-protocol.md`
- Modify: `docs/teacher-pedagogy-design.md`
- Modify: `skills/learning-os-teacher/SKILL.md`
- Modify: `skills/learning-os-teacher/references/teacher-protocol.md`

**Interfaces:**
- Consumes: resumed active challenge, authoring contract, attempt submission/evidence state.
- Produces: one canonical decision rule shared by repository guidance and portable Skill.

**Steps:**
- Define the resume-time question as: “Does this frozen challenge adequately satisfy the persisted authoring contract and yield valid evidence?” not “Can I write a better question?”
- Default to continuing the exact frozen challenge when it is valid, including when a stronger teacher could author a more sophisticated variant.
- Permit rejection before submission for concrete authoring-contract defects and require replacement from the same authoring contract with the rejected surface avoided.
- After submission, require preservation of valid learner evidence for merely suboptimal challenges; use voiding only for defects that invalidate the assessment opportunity.
- Keep frozen challenge history immutable and separate intrinsic challenge-version defects from learner/context-specific mismatch.

**Acceptance criteria:**
- Protocol and Skill explicitly preserve legitimate inherited questions/evidence while giving replacement teachers a systematic rejection path for concrete defects.
- Portable Skill names the public kernel operation and same-intent replacement rule consistently with runtime behavior.

### Task 4: Directly prove the lifecycle on disposable state

**Files:**
- No repository files created for verification.

**Interfaces:**
- Consumes: public teacher kernel and a disposable SQLite database.
- Produces: direct runtime evidence for migration, persistence, resumption, rejection, voiding, and same-intent replacement payloads.

**Steps:**
- Exercise schema v14 -> v15 migration on a disposable copy/state without opening or migrating the canonical backend-systems database.
- Register a challenge with an authoring contract, reopen the DB, and confirm resume exposes the identical contract.
- Reject an unsubmitted attempt and confirm it remains recent history but is not resumable.
- Submit an invalid challenge attempt, void it before assessment, and confirm no evidence is created and the session no longer awaits assessment.
- Create evidence for a submitted attempt, reject it for an intrinsic defect, and confirm effective evidence is invalidated while response/memory contact remain.
- Confirm selected-weakness mismatch cannot void already-submitted valid evidence.
- At candidate final state run `npm run typecheck`, `npm run build`, and `git diff --check`; do not run repository test suites.

**Acceptance criteria:**
- All lifecycle probes establish the intended observable behavior without touching the canonical learner DB.
- Candidate-final static/build/diff checks pass.
