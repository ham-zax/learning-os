# Evidence Ecology Implementation Plan

**Status:** Implemented on 2026-09-05; this plan records the completed review wave.

**Goal:** Make Learning OS authority transitions explicit and expose objective-scoped evidence receipts so fresh teachers can explain consequential learner-state claims without broad history dumps or new learner-state machinery.

**Architecture:** ADR 0005 establishes `Flexible exploration -> exact promotion -> inspectable authority`. The implementation keeps append-only evidence authoritative, keeps projections rebuildable, and adds one read-only objective receipt at the existing evidence/teacher boundary. Support-aware assessment is locked as a frozen-challenge semantic rule in this wave; no generic support schema, selector mode, or second claims engine is introduced.

**Tech Stack:** TypeScript, Zod-backed kernel types, better-sqlite3, Markdown contracts.

## Global Constraints

- Preserve the existing `concept × capability -> frozen challenge -> attempt -> assessment -> evidence -> projection -> FSRS` ownership chain.
- Do not modify scheduler policy, selector priority, readiness/transfer/durability algorithms, weakness lifecycle rules, or learner database schema in this wave.
- Do not persist teacher hypotheses, prompt-local mastery, generic live-episode JSON, support permission matrices, or new pedagogy modes.
- Preserve the original checkout's pre-existing `data/profiles/frontend/tutor.db` change by working only in the isolated `impl/learning-os-evidence-ecology` worktree.
- Keep tests opt-in under repository policy. Verification for this mission is non-test: focused runtime probes, `npm run typecheck`, `git diff --check`, and final clean Git status.

## File map

### Create

- `docs/decisions/0005-authority-transitions.md` — accepted architecture decision for Evidence Ecology, authority layers/transitions, support-aware evidence, promotion spillway, least-privilege context, and semantic handoff integrity.
- `docs/evidence-ecology-implementation-plan.md` — this file-level execution plan.
- `src/kernel/evidence-receipt.ts` — read-only objective-scoped audit model over existing objective, challenge, evidence, revision, exposure, projection, and weakness state.

### Modify

- `docs/README.md` — register ADR 0005 and this implementation plan in the documentation map.
- `docs/architecture.md` — add epistemic layers, authority-transition ownership, promotion spillway, least-privilege context, and semantic handoff integrity to the runtime architecture.
- `docs/evidence-model.md` — define observations vs projections, support-aware evidence semantics, and evidence receipts as read-only audit views.
- `docs/kernel-contracts.md` — make authority-transition invariants normative and specify `getObjectiveEvidenceReceipt(objectiveId)` as a read-only teacher-kernel operation.
- `docs/teacher-agent-protocol.md` — tell replacement teachers when to use evidence receipts, how to explain/contest claims safely, and how to state support conditions before freezing a challenge when they matter.
- `src/teacher.ts` — expose the new objective evidence receipt through `createTeacherKernel(db)` without expanding write authority.

### Intentionally unchanged

- `src/db/database.ts`, `src/db/types.ts` — no migration or new durable schema is justified in this wave.
- `src/selection/*`, `src/plan/*`, `src/scheduler/*` — no new selector reason, information-gain score, goal-pull path, or scheduling policy is justified yet.
- `skills/learning-os-teacher/*` — repository-local `docs/teacher-agent-protocol.md` is already the newer behavioral authority for the current OS; do not turn this architecture wave into a separate Skill packaging mission.
- `data/profiles/*` — no learner-state mutation belongs to this architecture implementation.

### Task 1: Lock the architecture and public contract

**Files:**
- Create: `docs/decisions/0005-authority-transitions.md`
- Modify: `docs/architecture.md`
- Modify: `docs/evidence-model.md`
- Modify: `docs/kernel-contracts.md`
- Modify: `docs/teacher-agent-protocol.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: ADR 0002 evidence authority, ADR 0004 teacher portability, existing frozen-challenge/hint/exposure/evidence/correction/resume contracts.
- Produces: accepted authority-transition rules and a normative read-only objective evidence receipt contract.

**Steps:**
- [x] Define four epistemic layers: observations, rebuildable projections, bounded live-episode coordination, and disposable teacher interpretation.
- [x] Define authority transitions and require the owner of the stronger claim to own promotion.
- [x] Define the spillway rule: failed promotion downgrades claim authority without erasing pedagogical value.
- [x] Define support-aware evidence without a generic support matrix: material support conditions belong prospectively in the frozen challenge prompt/criteria; teacher answer-bearing help remains hint/exposure provenance.
- [x] Define objective-scoped evidence receipts and learner claim inspection/contestability without giving learner statements direct mutation authority.
- [x] Define semantic handoff integrity and least-privilege teacher context.
- [x] Keep diagnostic micro-probes, sentinel probes, goal-pull objective creation, evidence-diversity scoring, structured support metadata, and generic live-episode state explicitly deferred.

**Acceptance criteria:**
- ADR 0005 is accepted and does not contradict ADR 0002/0004.
- Kernel/architecture/evidence/teacher docs agree on authority ownership and the receipt's read-only status.
- No documentation claims a schema or selector capability that this wave does not implement.

### Task 2: Add the objective evidence receipt read model

**Files:**
- Create: `src/kernel/evidence-receipt.ts`

**Interfaces:**
- Consumes: `getLearningObjective(...)`, `getObjectiveProjection(...)`, frozen challenges, all evidence rows plus latest evidence revisions, `getWeaknessProjections(...)`, and objective-scoped exposure events.
- Produces: `ObjectiveEvidenceReceipt` and `getObjectiveEvidenceReceipt(db, objectiveId)`.

**Steps:**
- [x] Resolve the objective and current projection or fail explicitly when either authoritative row is missing.
- [x] Return every objective evidence event in learner-performance order, including its latest `invalidate|restore|null` revision state and an `effective` boolean.
- [x] Reconstruct each evidence row's frozen challenge surface and referenced learner response/artifact/verification observation so a teacher can explain what was actually assessed without chat history.
- [x] Include criteria results, observed errors, rationale, hint level, novelty, retrieval validity, assessment/evaluator basis, and performed time.
- [x] Include current weakness projections and objective-scoped exposure provenance; expose teaching-artifact identity/availability but do not duplicate or synthesize learner-visible teaching text.
- [x] Include a small authority descriptor stating that evidence/revisions are authoritative history while the returned projection/weaknesses are rebuildable views.
- [x] Keep the function read-only: no rebuild, correction, selection, scheduling, or persistence side effects.

**Acceptance criteria:**
- A caller can explain the current objective projection from one objective-scoped kernel read without inspecting provider chat history or issuing arbitrary direct database reads.
- Invalidated evidence remains visible as history but is clearly marked ineffective.
- No receipt field can itself grant readiness, transfer, durability, weakness resolution, or scheduler state.

### Task 3: Expose inspectable authority at the teacher boundary

**Files:**
- Modify: `src/teacher.ts`
- Modify: `docs/teacher-agent-protocol.md`
- Modify: `docs/kernel-contracts.md`

**Interfaces:**
- Consumes: `getObjectiveEvidenceReceipt(db, objectiveId)`.
- Produces: `TeacherKernel.getObjectiveEvidenceReceipt(objectiveId)` and normative teacher behavior for progress/"why do you think that?" questions.

**Steps:**
- [x] Add the read-only method to `createTeacherKernel(db)`.
- [x] Require teachers to translate receipt provenance into learner language and suppress internal IDs/enums unless system detail is requested.
- [x] When the learner disputes provenance, inspect the receipt first; use `reviseEvidence(...)` only when a concrete assessment/evidence error is established, and never mutate state merely because the learner disagrees with a conclusion.
- [x] For challenges whose evidentiary meaning depends on allowed tools/references, require the support conditions to be stated before `registerChallenge(...)`; do not infer them retrospectively after seeing the learner's answer.

**Acceptance criteria:**
- The public teacher kernel exposes the receipt with no new write power.
- Teacher guidance makes authority inspectable while preserving existing evidence-correction ownership.
- Support semantics are prospective and frozen when material, without new schema.

### Task 4: Verify the implementation and prepare the review branch

**Files:**
- Inspect only the files in this plan plus Git metadata.

**Interfaces:**
- Consumes: final TypeScript/docs patch.
- Produces: falsifiable completion evidence and one clean review-ready commit.

**Steps:**
- [x] Install project dependencies in the isolated worktree if they are absent.
- [x] Run a focused read-only runtime probe against a disposable SQLite database that creates one objective/challenge/attempt/evidence record, invalidates that evidence, and confirms the receipt retains the historical event with `effective=false` while the current projection reflects effective history.
- [x] Run `npm run typecheck`.
- [x] Run `git diff --check`.
- [x] Inspect the final attributable patch and confirm no learner DB or unrelated file is included.
- [x] Commit the complete wave on `impl/learning-os-evidence-ecology` and verify `git status --short --branch` is clean.

**Acceptance criteria:**
- The focused receipt probe demonstrates read-only historical/effective semantics.
- Typecheck and diff checks pass.
- The final commit contains only the planned architecture/docs/read-model changes.
- The isolated branch is clean and ready for independent review.
