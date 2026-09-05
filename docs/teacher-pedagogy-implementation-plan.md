# Learning OS Teacher Pedagogy Implementation Plan

**Status:** Tasks 1–14 are complete. Live use demonstrated the protocol-only consistency gap that activated the pure teacher-side pedagogy recommendation work. Tasks 15–16 remain conditional.

**Goal:** Turn authoritative Learning OS state and `ChallengeIntent` into consistently strong, evidence-safe learning interactions that build, test, repair, and transfer learner mental models while keeping the learner-facing flow low-friction.

**Architecture:** Implement the first wave at the teacher boundary: the normative teacher protocol defines the pedagogical contract, the `learning-os-teacher` skill provides compact execution guidance, and the design document owns rationale and examples. Reuse existing kernel APIs and learner-state projections. Add teacher-side helper code only if dogfooding shows that replaceable teachers cannot apply the protocol consistently without it.

**Tech Stack:** TypeScript, SQLite-backed Learning OS kernel, Markdown protocol/docs, ChatGPT Skill instructions.

## Global Constraints

- Learning OS remains the only authority for objective identity, sequencing, prerequisites, evidence, readiness, transfer, durability, misconceptions, weaknesses, review timing, challenge selection, interview routing, and resumable learner state.
- Do not create prompt-owned mastery, confidence, prerequisite, scheduler, or signal state.
- Preserve the frozen-challenge, hint, exposure, attempt, assessment, evidence, correction, and review contracts.
- Technical evidence and interview-signal feedback remain separate.
- Do not add persistent challenge-difficulty/cognitive-load state in the initial implementation.
- Do not require every interaction to be Socratic, mapped, or multi-step.
- Prefer the shortest pedagogical operator sequence that exposes the target reasoning.
- Do not modify the existing `backend-systems` learner state while implementing documentation/protocol changes.
- Testing is not part of this plan unless separately authorized or required by repository policy.
- First-wave scope is the replaceable AI teacher/agent experience. Pedagogy parity for built-in CLI presenters such as `generateExploreSequence()`, `generateTeachBackSession()`, and `generateQuizBatch()` is not part of this wave.

## File map

### Create

- `docs/teacher-pedagogy-design.md` — rationale, pedagogical operator catalogue, challenge-authoring guidance, interview-signal separation, risks, and deferred product extensions. **Already created as the design input for this plan.**
- `docs/teacher-pedagogy-implementation-plan.md` — this execution checklist and dogfood gate. **Already created.**

### Modify in the initial implementation wave

- `docs/teacher-agent-protocol.md` — normative teacher behavior and evidence-safe pedagogical lifecycle.
- `skills/learning-os-teacher/SKILL.md` — compact execution contract for a fresh teacher.
- `skills/learning-os-teacher/references/teacher-protocol.md` — compressed standalone fallback for the portable Skill.
- `docs/README.md` — add the pedagogy design to the documentation map and clarify authority.

### Inspect during the initial wave; modify only if the protocol cannot express the required behavior

- `src/teacher.ts` — public teacher kernel boundary.
- `src/selection/types.ts` — `ChallengeIntent` contract.
- `src/selection/selector.ts` — task-form/novelty/weakness selection.
- `src/plan/today.ts` — daily mission composition and reasons.
- `src/db/types.ts` — challenge, hint, exposure, evidence, readiness, transfer, and weakness schemas.
- `src/session/` — resumable interaction lifecycle and ordinary modes.

### Conditional later-wave additions

Only create these if dogfooding demonstrates repeated teacher inconsistency that cannot be fixed by protocol/skill wording.

- `src/teacher/pedagogy.ts` — pure teacher-side derivation of pedagogical posture/operator recommendations from authoritative inputs.
- `src/teacher/pedagogy.types.ts` — teacher-only derived types if keeping them out of `src/teacher.ts` materially improves readability.

Do not create a durable pedagogy table, `mental_model_score`, `signal_score`, or `cognitive_load` column.

---

## Phase 1: Make the teacher protocol pedagogically complete

### Task 1: Add the pedagogical authority boundary and canonical loop

**Files:**
- Modify: `docs/teacher-agent-protocol.md`

**Interfaces:**
- Consumes: existing authority split, `getTodayMission`, `resolveRequestedChallenge`, `ChallengeIntent`, challenge registration, attempt/hint/exposure/assessment lifecycle.
- Produces: normative rules for turning a selected Learning OS intent into a learning interaction without creating parallel learner state.

**Steps:**
- [x] Add a section immediately after the current authority/decision rules that states the teacher may choose pedagogical technique but may not override selected objective, evidence validity, readiness, weaknesses, transfer/durability, review timing, or next-work decisions.
- [x] Define the canonical repertoire: `orient -> retrieve -> construct model -> predict/commit -> observe/execute -> explain -> challenge/break -> localize -> repair model -> reconstruct -> transfer -> review`.
- [x] State explicitly that this is a repertoire, not a mandatory turn template; the shortest useful path should win.
- [x] Tie assessable uses of the repertoire back to the existing freeze/open/hint/exposure/submit/assess/record order.
- [x] Add the rule that prediction/hypothesis must precede decisive reveal when the clean prediction is part of the intended evidence.

**Acceptance criteria:**
- A fresh teacher can tell which decisions remain Learning OS-owned and which pedagogical choices are teacher-owned.
- The protocol describes how to get from `ChallengeIntent` to learner interaction without introducing a second state model.
- Existing evidence/exposure invariants remain unchanged and take precedence over pedagogical technique.

### Task 2: Define the evidence-safe pedagogical operator repertoire

**Files:**
- Modify: `docs/teacher-agent-protocol.md`
- Reference: `docs/teacher-pedagogy-design.md`

**Interfaces:**
- Consumes: `capabilityId`, `taskForm`, `novelty`, selected weakness, recent challenge surfaces, durable readiness/transfer/durability exposed by preparation context, and current/resumed attempt provenance exposed by the public teacher API.
- Produces: teacher execution rules for `retrieve`, `predict`, `construct model`, `guided discovery`, `falsify/boundary test`, `debug/localize`, `mental-model autopsy`, `reconstruct`, `transfer`, `teach back`, and `worked example/scaffold`.

**Steps:**
- [x] Add compact definitions for each operator: trigger conditions, teacher behavior, and evidence/exposure implications.
- [x] Add capability defaults without turning them into kernel enums: `explain` favors model/discovery/teach-back; `predict` favors prediction/falsification; `debug` favors localization/autopsy; `design` favors model/boundary/transfer; `implement` favors retrieve/predict/debug/reconstruct.
- [x] Add state-signal guidance using only public teacher inputs: `unknown`, `exposed`, `guided`, `independent`, selected weakness context, due review, transfer-required, and current/resumed attempt hint/exposure provenance can influence scaffold posture. Do not require arbitrary historical exposure inspection.
- [x] Make direct explanation an allowed operator when discovery has low expected value or the learner deliberately chooses exposure.
- [x] Keep all durable misconception/weakness recording inside the current assessment/evidence path.

**Acceptance criteria:**
- The protocol can express the strongest mechanisms extracted from OmniMentor 2.4.2, OmniMentor 7.1, and Socratic v2.5 without importing their prompt-local state.
- A teacher has an explicit off-ramp from unproductive Socratic questioning.
- No operator claims evidence qualification independently of Learning OS.

### Task 3: Add progressive scaffolding and `I do -> We do -> You do` semantics

**Files:**
- Modify: `docs/teacher-agent-protocol.md`

**Interfaces:**
- Consumes: durable readiness from preparation context, current/resumed attempt hint/exposure provenance, selected intent, and changed-surface requirement.
- Produces: normative scaffolding behavior that decreases teacher help as learner evidence improves.

**Steps:**
- [x] Define the preferred scaffold retreat: teacher-provided model -> co-constructed model -> prompted learner construction -> independent learner construction -> independent lens selection.
- [x] Map `I do` to worked-example exposure, `We do` to guided/hinted work, and `You do` to a fresh answer-hidden attempt when independent evidence is intended.
- [x] State that scaffolding can temporarily increase after failure without directly mutating persisted readiness.
- [x] Require a fresh changed surface after decisive exposure before claiming independent transfer/readiness evidence.

**Acceptance criteria:**
- A teacher cannot mistake a worked example or collaborative solution for independent evidence.
- Increasing learner readiness normally reduces initial scaffolding even when task wording is otherwise similar.

### Task 4: Add the failure-to-repair protocol

**Files:**
- Modify: `docs/teacher-agent-protocol.md`

**Interfaces:**
- Consumes: assessed attempt, observed misconception/weakness information, existing exposure lifecycle.
- Produces: a consistent post-failure sequence that repairs the causal model and prepares later retest.

**Steps:**
- [x] Define the post-assessment mental-model autopsy: expected result -> assumption -> contradicting observation -> corrected relationship -> reconstructed model.
- [x] Require the teacher to distinguish slips from coherent causal model errors before using the autopsy pattern.
- [x] Require correction to target the smallest faulty assumption or relationship rather than replacing the learner's entire answer when possible.
- [x] If the error matches an existing registered misconception definition, record that misconception ID through assessment. Otherwise record a precise `observedErrors` category; do not create a persistent misconception definition from conversation.
- [x] State that a later changed-surface challenge should be selected through normal Learning OS routing; the teacher must not manufacture readiness by immediately declaring the misconception resolved.

**Acceptance criteria:**
- A wrong answer can lead to causal model repair without bypassing misconception/weakness state ownership.
- The protocol clearly separates immediate teaching repair from later independent retest evidence.

---

## Phase 2: Make challenge authoring discriminate between mental models

### Task 5: Add challenge-authoring rules to the teacher protocol

**Files:**
- Modify: `docs/teacher-agent-protocol.md`
- Reference: `docs/teacher-pedagogy-design.md`

**Interfaces:**
- Consumes: `ChallengeIntent`, recent challenge history, frozen rubric/criteria, hint ladder, verification requirements.
- Produces: higher-quality registered challenges that preserve selected intent and expose reasoning rather than recognition alone.

**Steps:**
- [x] Require challenge wording to preserve `objectiveId`, capability, task form, delivery context, novelty, selected weakness, changed-surface requirement, and recent-surface avoidance.
- [x] Add the discrimination rule: prefer scenarios where a common incorrect mental model predicts a different observable result from the correct one.
- [x] Add the commitment rule: for prediction/debug/design diagnosis, collect a committed prediction/hypothesis before showing decisive logs, metrics, execution, or solution details when a clean signal is intended.
- [x] Define what a real `variant` changes: interleaving, constraint, ownership boundary, failure mode, workload shape, API contract, or resource condition—not synonyms.
- [x] Define transfer authoring: change the surface enough to require recognition of the underlying principle without announcing the mapping.
- [x] Require frozen criteria to describe observable target reasoning such as identifying a state owner, invariant, causal path, discriminating metric, or trade-off.

**Acceptance criteria:**
- Challenge authors can distinguish same-surface repetition, meaningful variant, and transfer.
- Frozen criteria test the selected capability instead of post-hoc stylistic preferences.
- Common misconceptions can be targeted through discriminating scenarios without new kernel state.

### Task 6: Add system-map guidance for systems-oriented objectives

**Files:**
- Modify: `docs/teacher-agent-protocol.md`
- Reference: `docs/teacher-pedagogy-design.md`

**Interfaces:**
- Consumes: objectives where relationships, ownership, flow, capacity, or failure propagation are part of the target model.
- Produces: learner-constructed representations usable within existing `explain`, `predict`, `debug`, and `design` challenges.

**Steps:**
- [x] Define a system map as a learner-created representation, not a new task form.
- [x] List optional dimensions: actors/components, state owner, synchronous/asynchronous boundaries, queues, resource limits, invariants, data/control flow, failure propagation, observability, retry/idempotency, and trust/auth boundaries.
- [x] State that the teacher should request only dimensions needed to discriminate the target objective.
- [x] Add examples for backend concurrency, connection pooling, cache ownership, queues/idempotency, auth/WebSockets, and latency localization.

**Acceptance criteria:**
- System maps can be used without modifying `TaskForm`.
- The teacher asks the learner to construct the representation when construction is part of the learning value instead of always providing the diagram first.

---

## Phase 3: Improve learner-facing momentum without exposing the state machine

### Task 7: Add the one-recommended-next-move interaction rule

**Files:**
- Modify: `docs/teacher-agent-protocol.md`

**Interfaces:**
- Consumes: authoritative Learning OS next-work decision, evidence outcome, and current interaction hint/exposure status.
- Produces: low-friction learner-facing transitions inspired by OmniLearner v9 without its parallel learner model.

**Steps:**
- [x] Require the teacher to obtain the next move from the responsible Learning OS owner; it must not synthesize a follow-up from readiness, weakness, or recent performance.
- [x] When Learning OS supplies a next move, require the teacher to end substantive feedback with that single move and a short learner-language reason tied to observable performance, not raw readiness enums or scheduler internals.
- [x] Treat unambiguous confirmation as permission to execute the already-selected move without re-presenting a menu.
- [x] Keep learner alternatives available through natural language: explanation, another example, another attempt when allowed, pause, or explicit redirection.
- [x] Preserve the existing diagnose-first trade-off when the learner requests explanation before a pending clean diagnostic.

**Acceptance criteria:**
- The learner does not need slash commands or knowledge of internal state to continue productively.
- The teacher does not ask an unnecessary open-ended "what next?" when Learning OS has a clear recommendation.
- Learner agency remains explicit when an alternative would change evidence quality.

### Task 8: Add model-answer decomposition rules

**Files:**
- Modify: `docs/teacher-agent-protocol.md`

**Interfaces:**
- Consumes: frozen rubric/reasoning structure and `recordExposure(...)`.
- Produces: model answers that teach the reasoning architecture instead of merely giving polished prose.

**Steps:**
- [x] Require `recordExposure(...)` before showing a model answer or decisive walkthrough.
- [x] When a model answer is useful, map its parts to the already-frozen reasoning structure, for example `observation -> hypothesis -> discriminating evidence -> conclusion -> trade-off`.
- [x] State explicitly that seeing a model answer does not establish independent ability.

**Acceptance criteria:**
- Model answers improve reconstruction while preserving evidence contamination semantics.
- The teacher cannot retroactively invent criteria from the model answer after seeing the learner's response.

---

## Phase 4: Add interview-performance feedback without corrupting technical evidence

### Task 9: Define the interview signal contract

**Files:**
- Modify: `docs/teacher-agent-protocol.md`
- Reference: `docs/teacher-pedagogy-design.md`

**Interfaces:**
- Consumes: delivery context (`interview` / `mock`), learner answer, technical assessment result.
- Produces: descriptive interview-signal feedback that is explicitly non-authoritative for mastery.

**Steps:**
- [x] Add a hard separation between technical assessment and interview signal feedback.
- [x] Define a backend-oriented signal catalogue: assumption clarification, state ownership/invariants, causal reasoning, trade-offs/boundaries, capacity/backpressure awareness, failure/recovery semantics, validation/observability, precise uncertainty, and answer structure.
- [x] Require selecting only signals relevant to the challenge instead of printing a fixed scorecard every time.
- [x] In `interview`, provide concise signal feedback after the technical feedback.
- [x] In `mock`, withhold coaching during the attempt and provide signal feedback in the debrief.
- [x] Prohibit signal feedback from changing `EvidenceResult`, readiness, transfer, durability, weakness lifecycle, or FSRS ratings.

**Acceptance criteria:**
- A technically correct but weakly reasoned interview answer can receive useful signal feedback without altering technical evidence.
- A fluent but technically incorrect answer remains technically incorrect.
- The protocol does not reward buzzword or pattern-name density as a proxy for seniority.

---

## Phase 5: Compress the full design into the teacher Skill

### Task 10: Update the `learning-os-teacher` Skill with the execution subset

**Files:**
- Modify: `skills/learning-os-teacher/SKILL.md`
- Modify: `skills/learning-os-teacher/references/teacher-protocol.md`

**Interfaces:**
- Consumes: the normative protocol from Tasks 1-9.
- Produces: concise instructions a fresh teacher can execute in a normal learner session.

**Steps:**
- [x] Keep existing profile resolution, public API use, kernel authority, and evidence lifecycle instructions intact.
- [x] Add a compact "pedagogical operator" section with the most actionable triggers rather than copying the full design document.
- [x] Add a default operator-selection heuristic keyed to intent/capability/weakness/novelty.
- [x] Add the prediction-before-reveal rule.
- [x] Add mental-model/system-map construction guidance for systems topics.
- [x] Add the mental-model autopsy + reconstruction sequence after causal failures.
- [x] Add progressive scaffolding and `I do -> We do -> You do` exposure semantics.
- [x] Add one-recommended-next-move UX.
- [x] Add interview-signal separation for `interview` and `mock` delivery contexts.
- [x] Add explicit warnings not to create parallel mastery, signal, confidence, or scheduler state.
- [x] Update the bundled `references/teacher-protocol.md` as a compressed standalone fallback containing the same normative essentials; do not duplicate the full design document.

**Acceptance criteria:**
- A teacher reading only the repository instructions, public protocol, and Skill can execute the new behavior without reading the historical prompt corpus.
- The Skill stays operational and significantly shorter than the design document.
- The Skill does not duplicate Learning OS learner-state authority.

---

## Phase 6: Publish the design in the documentation map

### Task 11: Link and classify the pedagogy design

**Files:**
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: existing documentation authority hierarchy.
- Produces: discoverable documentation path for teacher implementers and reviewers.

**Steps:**
- [x] Add `teacher-pedagogy-design.md` beside `teacher-agent-protocol.md` in the relevant docs index section.
- [x] Describe `teacher-agent-protocol.md` as normative for teacher behavior/evidence-safe operation and `teacher-pedagogy-design.md` as design rationale/operator guidance.
- [x] Preserve the existing accepted-ADR/kernel-contract authority ordering.

**Acceptance criteria:**
- An engineer can find the new design from the docs index and understand which document is normative when wording differs.

---

## Phase 7: Dogfood the protocol before adding product state

### Task 12: Run a fresh-teacher Backend Systems pedagogy dogfood

**Files:**
- No source files required.
- Read-only reference: `docs/teacher-agent-protocol.md`, `skills/learning-os-teacher/SKILL.md`, `docs/teacher-pedagogy-design.md`.
- Learner-state writes are allowed only in a deliberately isolated dogfood profile/worktree or when the user explicitly authorizes using the real `backend-systems` profile for learning.

**Interfaces:**
- Consumes: public Learning OS teacher/workspace APIs and a real selected mission/intent.
- Produces: concrete evidence about whether a fresh teacher can follow the protocol consistently.

**Steps:**
- [x] Exercise at least one `predict`, one `debug`, and one `design` interaction on backend-system concepts.
- [x] Observe prediction-before-reveal, learner-built system mapping, and mental-model autopsy/reconstruction. A changed-surface retest/transfer was not fabricated because Learning OS did not select one during this isolated run; the conditional rule remains documented.
- [x] Exercise an exposure path where the learner requests explanation before a clean diagnostic and confirm the teacher presents the trade-off before contaminating the attempt.
- [x] Exercise `interview` delivery and confirm technical evidence remains separate from signal feedback.
- [x] Record concrete friction points in `docs/teacher-pedagogy-design.md`; do not generalize from taste alone.

**Acceptance criteria:**
- The protocol is judged on observable interaction behavior, not whether the teacher repeats the document vocabulary.
- Any proposal for new persistent state cites a repeated failure that protocol/skill guidance could not solve.

**Dogfood outcome — 2026-08-28:** Passed the first-wave behavioral gate on disposable learner data. The only repeated integration friction was public lifecycle discoverability, especially that `createSession(...)` takes the durable goal/topic ID rather than `ChallengeIntent.conceptId`. That is addressed in protocol/Skill wording. No evidence justified Tasks 13–16.

---

## Phase 8: Add pure teacher-side derivation only if dogfood shows a consistency gap

This phase is conditional. Do not implement it merely because helper code is possible.

### Task 13: Define a pure `PedagogyDirective` contract

**Files:**
- Create only if needed: `src/teacher/pedagogy.types.ts`
- Modify only if needed: `src/teacher.ts`

**Interfaces:**
- Consumes: existing `ChallengeIntent` plus authoritative projection/interaction inputs already available to the teacher boundary.
- Produces: a non-durable directive containing only scaffold level, commit-before-reveal, and question chunking.

**Steps:**
- [x] Keep only fields with demonstrated cross-teacher consistency value: `scaffold`, `commitBeforeReveal`, and `questionChunking`. The 2026-09-05 systematic corpus review removed `promptShape` after showing that deterministic `explain` reinforcement had collapsed into recognition-by-default; MCQ remains an optional teacher-side discrimination technique.
- [x] Remove fields that model stable protocol or duplicate existing owners: interaction-form taxonomy, probe/impasse state, reasons, performance/reflection posture, cognitive direction, pedagogy-owned hint depth, incidental-load posture, challenge-surface posture, repair policy, and scaffold-withdrawal flags.
- [x] Keep the type explicitly teacher-facing and non-authoritative for evidence/proficiency.
- [x] Do not persist the output.

**Acceptance criteria:**
- Every field exists because a demonstrated protocol-only ambiguity requires it.
- Removing the helper would change consistency, not learner truth.

### Task 14: Implement pure pedagogy derivation

**Files:**
- Create only if needed: `src/teacher/pedagogy.ts`
- Modify only if needed: `src/teacher.ts`

**Interfaces:**
- Consumes: `ChallengeIntent` and existing authoritative state passed into the helper.
- Produces: deterministic teacher-side recommendations; no database writes.

**Steps:**
- [x] Derive recommendations using existing intent/preparation/preference signals only.
- [x] Keep selector ownership intact: the helper cannot replace objective, capability, task form, novelty, or weakness selection.
- [x] Keep scheduling/evidence ownership intact: the helper cannot emit mastery/readiness/review changes.
- [x] Expose the helper through `createTeacherKernel(db)` as `getPedagogyRecommendation(intent)` so replaceable teachers receive the same compact execution guardrails from the intent's own goal scope.

**Acceptance criteria:**
- The helper is pure and stateless.
- Existing kernel behavior is unchanged when its recommendation is ignored.
- The helper cannot create evidence or mutate learner state.
- The directive prevents known cross-teacher failure modes; it does not encode a lesson sequence or teaching-process state.
- A learner complexity complaint can be handled inside the same frozen episode by harmless rephrasing, neutral decomposition, or recorded hint/exposure plus reconstruction when answer-bearing help is required.

---

## Phase 9: Consider durable interview-signal observations only after demonstrated need

This phase is conditional and requires a separate design decision because persistence creates a new durable learner-adjacent concept.

### Task 15: Decide whether interview-signal persistence has a valid owner

**Files:**
- Update if decision is made: `docs/teacher-pedagogy-design.md`
- Potentially add an ADR if persistence is approved because it changes the durable contract.

**Interfaces:**
- Consumes: repeated dogfood evidence that cross-session signal coaching is valuable and cannot be recovered from ordinary technical evidence.
- Produces: explicit decision to remain ephemeral or introduce a separate non-mastery observation owner.

**Steps:**
- [ ] Define the learner problem that persistence solves.
- [ ] Define why ordinary evidence criteria or session feedback cannot solve it.
- [ ] Define whether observations are descriptive events, projections, or goal-specific coaching metadata.
- [ ] Prohibit any path from these observations into technical correctness, readiness, transfer, durability, or FSRS.
- [ ] If no clear owner/boundary exists, keep interview-signal feedback ephemeral.

**Acceptance criteria:**
- No `signal_log` equivalent is added merely because Cognitive Mentor v11 had one.
- Any persistence proposal has a clear correction/rebuild lifecycle and authority boundary before schema work begins.

---

## Phase 10: Consider explicit challenge-load metadata only after demonstrated calibration failure

This phase is conditional and should occur after several replaceable-teacher dogfood sessions.

### Task 16: Evaluate whether challenge complexity needs a durable/contract field

**Files:**
- Update if decision is made: `docs/teacher-pedagogy-design.md`
- Potentially modify later: `src/db/types.ts`, challenge registration contract, selector/teacher types, `docs/kernel-contracts.md`.

**Interfaces:**
- Consumes: concrete examples where two compliant teachers repeatedly produce materially mismatched challenge load for the same authoritative state.
- Produces: either a decision that protocol guidance is sufficient or a separately approved challenge-complexity contract.

**Steps:**
- [ ] Compare inconsistency across dimensions already controllable by challenge authoring: interacting components, concurrency, observations, competing hypotheses, ambiguity, scaffolding, constraints, novelty, and integration breadth.
- [ ] If those dimensions can be reliably guided without persistence, do not add a field.
- [ ] If not, define exactly whether complexity is an authoring hint, challenge metadata, selector input, or evidence attribute; do not use one ambiguous numeric "difficulty" score for multiple meanings.
- [ ] Treat any kernel-contract/schema change as a separate migration/design wave.

**Acceptance criteria:**
- No cognitive-load score is introduced without a demonstrated cross-teacher calibration problem.
- Any later metadata has one precise semantic owner and does not duplicate readiness or FSRS difficulty.

---

## Execution order

Implement Tasks 1-11 as one documentation/teacher-contract wave in this order:

1. protocol authority + canonical loop;
2. operator repertoire;
3. scaffolding;
4. failure repair;
5. challenge authoring;
6. system maps;
7. next-action UX;
8. model-answer handling;
9. interview signal contract;
10. teacher Skill compression;
11. docs index.

Then dogfood Task 12 before deciding whether Tasks 13-16 are needed.

The dependency is deliberate: product/kernel changes should be responses to observed limitations of the protocol implementation, not speculative ports of prompt-era machinery.

## Rollout boundary

The first mergeable candidate should contain only:

- `docs/teacher-pedagogy-design.md`;
- `docs/teacher-pedagogy-implementation-plan.md`;
- `docs/teacher-agent-protocol.md` updates;
- `skills/learning-os-teacher/SKILL.md` updates;
- `skills/learning-os-teacher/references/teacher-protocol.md` updates;
- `docs/README.md` link/authority update.

It should not modify learner database schemas, scheduler logic, selector ownership, evidence projection, or the existing backend learner profile.

## Completion criteria for the first wave

The first wave is complete when:

- the normative protocol contains the evidence-aware operator repertoire and failure-to-repair loop;
- the Skill gives a fresh teacher enough compact guidance to execute it;
- challenge-authoring guidance distinguishes same/variant/transfer and clean prediction from post-exposure practice;
- learner-facing flow presents the authoritative Learning OS next move without exposing raw internal state;
- interview signal feedback is explicitly separated from technical assessment;
- the docs index points engineers to the design and protocol;
- no new persistent learner-state concept has been introduced.

Task 12 dogfood has now been run. The observed behavior does not justify a teacher-side pedagogy helper, new public learner-state access, durable interview-signal state, or a kernel contract/schema extension. Keep Tasks 13–16 conditional until later evidence changes that conclusion.
