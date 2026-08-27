# Learning OS Implementation Plan

**Goal:** Fork `generic-tutor` and turn it into an evidence-driven programming learning kernel without rebuilding its useful application shell.

**Architecture:** Preserve the TypeScript/SQLite topic, concept, session, problem, attempt, CLI, and interview structure where ownership remains correct. Replace scalar concept mastery with `concept × capability` learning objectives backed by append-only evidence. Use `ts-fsrs` only for timing; challenge selection decides what kind of retrieval or practice happens next.

**Tech Stack:** TypeScript, Node.js, SQLite via `better-sqlite3`, Zod, `ts-fsrs`.

## Global Constraints

- Append-only evidence is authoritative; self-confidence does not determine correctness.
- Do not treat content exposure as learning evidence.
- Hinted performance must not silently become independent evidence.
- Transfer requires a materially changed surface or constraint.
- Durable proficiency requires qualifying delayed retrieval evidence.
- Persist current and historical-highest proficiency as rebuildable projections, not independent truth.
- Preserve explicit misconceptions and contradictory/regression evidence rather than overwriting them.
- Broad weakness projection is derived/materialized from evidence and misconception history.
- `ReviewRatingMapper` translates valid retrieval evidence into FSRS ratings; FSRS decides when; challenge selection decides how.
- Keep the first implementation single-teacher and CLI-first. Prefer ChatGPT as the V1 interactive teacher, but keep the kernel protocol provider-neutral so Codex, OpenCode, AGY, or another compatible agent can replace it without learner-state migration.
- Do not add dashboard, voice, Monaco/Judge0 UI, BKT, or multi-agent orchestration before the core loop is proven.

## Phase 0 — Fork readiness

### Task 1: Resolve the upstream fork boundary

**Files:**
- Upstream metadata and dependency files before local fork work begins.

**Interfaces:**
- Consumes: pinned `alienz-dev/generic-tutor` repository state.
- Produces: a technically usable local fork baseline with provenance facts and unresolved redistribution risk stated explicitly.

**Pinned upstream base:**

```text
repository: https://github.com/alienz-dev/generic-tutor.git
branch:     master
commit:     2fffb72201aba055a4c270e2fddb29352edf2efb
```

Do not silently advance the fork base to a later `master` commit.

**Steps:**
- Record upstream provenance and license facts. `package.json` and the upstream README declare MIT, but the pinned repository has no root license text/copyright notice and GitHub does not detect a license. Preserve history and facts; do not manufacture missing notice text, ownership, or transfer history.
- Preserve the exact pinned upstream commit as reachable Git ancestry rather than copying or squashing source into unrelated history.
- Make `/home/hamza/repo/learning-os` the product working tree while preserving the existing Learning OS design lineage.
- Treat public redistribution/package publication as separately gated on license/provenance clarification; local implementation may proceed without claiming that redistribution rights are fully resolved.
- Identify generated, agent-tooling, and ecosystem-specific files that should not dictate Learning OS architecture.

**Acceptance criteria:**
- The exact fork base, provenance facts, and unresolved license-text/redistribution risk are explicit.
- Local integration preserves both Learning OS and upstream Git ancestry without claiming unresolved legal facts are settled.

### Task 2: Remove clean-clone standalone blockers

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/llm/client.ts`
- Modify: `src/db/database.ts`

**Interfaces:**
- Consumes: existing `LLMClient` callers and file-backed SQLite callers.
- Produces: a standalone baseline that needs neither a sibling Nexus repository nor a pre-created database directory.

**Steps:**
- Preserve `LLMClient.complete()` and `isConfigured()` as the application seam.
- Remove `nexus: file:../nexus` from `package.json` and remove the Nexus package/link from the npm lock graph using normal npm lockfile tooling.
- Replace the `nexus/llm` implementation with a provider-neutral unconfigured local client: `isConfigured()` returns false and `complete()` fails explicitly when no provider is configured.
- Do not add an OpenAI, Anthropic, or other paid/provider API SDK merely to replace Nexus in Phase 0.
- Keep provider-specific configuration outside learning-state logic. `src/plan/nexus-planner.ts` may remain because it consumes the local `LLMClient` seam rather than the Nexus package directly.
- Make `createDatabase(dbPath)` create the parent directory for a file-backed database before opening SQLite, so `./data/tutor.db` works in a clean checkout without per-command directory setup.
- Leave optional `../job-hunter` and `../ai-feeds` integrations unchanged in this phase.

**Acceptance criteria:**
- A clean checkout does not require a sibling Nexus repository or a pre-existing `data/` directory for ordinary startup.
- Phase 0 introduces no new paid/provider API dependency solely as a Nexus substitute.

### Task 3: Normalize ordinary-session delivery context

**Files:**
- Modify: `src/db/types.ts`
- Modify: `src/db/database.ts`
- Modify: `src/knowledge/types.ts`
- Modify: `src/session/engine.ts`
- Modify: `src/plan/planner.ts`
- Modify: `src/cli.ts` and existing session-mode modules where needed.

**Interfaces:**
- Consumes: persisted/runtime legacy values `explore|quiz|teach-back` plus the existing DB/type vocabulary.
- Produces: one canonical delivery-context vocabulary without conflating delivery context, capability, task form, or `problems.type`.

**Canonical delivery contexts:**

```text
learn
practice
review
interview
mock
```

**Legacy mapping:**

```text
explore    -> learn
quiz       -> review
teach-back -> practice
```

**Steps:**
- Keep `sessions.mode` and `reviews.mode` as physical legacy column names for now, but make their semantic contract delivery context.
- Add a real DB migration for known stored legacy values in both columns. Leave already-canonical values unchanged. If an unknown stored value exists, fail/report it rather than guessing its semantics.
- Make session/review writers accept canonical delivery-context values and validate/parse rows on read rather than relying only on raw TypeScript casts.
- Normalize upstream CLI aliases at the CLI boundary; do not allow `explore|quiz|teach-back` to re-enter internal planning, session state, or new DB writes.
- Change planning/schema output to canonical delivery context. Existing implementation modules `explore.ts`, `quiz.ts`, and `teach-back.ts` may remain as transitional strategies and do not need cosmetic renames.
- Keep target capability, task form, novelty, difficulty, and `problems.type` separate from delivery context.
- Do not route existing interview flows through ordinary session persistence in Phase 0 merely because `interview` is a canonical delivery context.

**Acceptance criteria:**
- New ordinary-session persistence, planning, and runtime state use only canonical delivery contexts.
- Existing known legacy persisted values migrate deterministically, and unknown values are not silently coerced.

### Phase 0 legacy-mastery safety cut

**Files:**
- Modify: `src/state.ts`

**Steps:**
- Remove the dormant duplicate SM-2 writer `updateConceptAfterReview()` after confirming the reconnaissance result that no live source caller exists.
- Make `getTopicSummary()` a true read by removing automatic `topics.phase` mutation derived from legacy `concepts.status`/EF data.
- Do not migrate the active `askGrade() -> gradeResponse() -> sm2()` compatibility path in Phase 0. Do not add new Learning OS behavior that treats it as authoritative learner truth.
- Defer the active writer plus its status/due/planner/pacer/CLI/sync/export readers until the evidence/FSRS replacement can migrate that surface coherently.
- Preserve legacy concept/review rows as provenance; do not mathematically convert them into FSRS cards.

**Acceptance criteria:**
- Phase 0 leaves only the known active legacy SM-2 mutation path and removes hidden legacy-state mutation from topic-summary reads.
- No new subsystem is coupled to scalar concept mastery as Learning OS truth.

## Phase 1 — Evidence kernel

### Task 4: Add learning objectives

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/db/types.ts`
- Create: `src/evidence/types.ts`

**Interfaces:**
- Consumes: existing concepts and prerequisite graph.
- Produces: `LearningObjective` records keyed by concept and capability.

**Steps:**
- Add a `learning_objectives` table.
- Start with a small extensible capability registry: `explain`, `predict`, `implement`, `debug`, `design`.
- Store only stable `concept × capability` identity on `learning_objectives`; put goal-specific activation, importance, target readiness, and transfer/durability requirements in `goal_objectives` so one objective can serve multiple goals without duplicating evidence.
- Persist readiness/transfer/durability summaries in a separate rebuildable `objective_projections` table.
- Keep concept metadata descriptive; stop treating concept status as authoritative mastery for new flows.
- Create objectives lazily from the learner's goal rather than generating the full concept/capability Cartesian product.

**Acceptance criteria:**
- Two capabilities of the same concept can have different current proficiency projections.

### Task 5: Add append-only evidence events

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/db/types.ts`
- Modify: `src/evidence/types.ts`
- Create: `src/evidence/evaluator.ts`

**Interfaces:**
- Consumes: assessment result, frozen task/rubric identity and version, learner response or artifact, evaluator/basis, objective-scoped hint provenance, task novelty, durable exposure/attempt history, and misconceptions.
- Produces: persisted `EvidenceEvent` plus deterministic rebuildable proficiency/blocker projections.

**Steps:**
- Add an `evidence_events` table linked to objective, session, problem, and attempt when those objects exist.
- Add append-only `hint_observations` scoped to one objective, frozen criterion IDs, or all challenge targets; derive each evidence event's effective hint level from the highest relevant observation.
- Add append-only objective-specific `exposure_events` for material explanation/answer/worked-example/corrective-feedback/solution exposure.
- Persist task/rubric identity and version, evaluator type, assessment basis, result, derived hint level, novelty, retrieval validity, kernel-computed delay anchor/seconds, learner-performance time (`performed_at`), objective-specific criteria results, observed errors, and rationale. Keep the learner response/artifact on the shared attempt and reference it from each per-objective event.
- Treat event sequence as append order/tie-breaker; project learner state in `(performed_at, seq)` order so delayed assessment commits cannot reorder learner history.
- Add append-only `evidence_revisions` so an assessment mistake can be invalidated/restored without rewriting the original event. A corrected grade invalidates the old event and appends a replacement linked by `supersedes_event_id`, with at most one effective event per normal `(attempt_id, objective_id)`.
- Make evidence validity causal: invalidation/restore or corrected replacement rebuilds the affected objective projection, misconception/weakness state, and FSRS card from effective source events in one transaction.
- Add `objective_projections` with orthogonal readiness (`unknown|exposed|guided|independent`), transfer (`untested|not_demonstrated|demonstrated|contradicted`), durability (`untested|not_demonstrated|demonstrated|contradicted`), historical-highest readiness, blockers, event sequence, and projector version.
- Implement the exact projection rules in `docs/kernel-contracts.md`, including two distinct recent correct L0 attempts for independent readiness, any newer qualifying non-correct attempt breaking the current gate, and the seven-day V1 durability floor computed from prior targeted attempts plus material exposure events.
- Allow contradictory evidence to lower readiness or contradict transfer/durability without rewriting history.
- Never delete prior evidence when projections change.

**Acceptance criteria:**
- Every objective proficiency/blocker change can be explained by stored evidence.

### Task 6: Add misconception records and weakness projection

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/db/types.ts`
- Create: `src/evidence/weakness.ts`

**Interfaces:**
- Consumes: evidence events and proficiency projection changes.
- Produces: explicit misconception records plus rebuildable/materialized weakness summaries for challenge selection.

**Steps:**
- Add stable misconception definitions linked to the concept, plus append-only `misconception_observations` (`observed|cleared`) tied to objective evidence. Derive current active/cleared state from the latest observation whose source evidence is currently effective; invalidated source evidence must not remain active in misconception replay.
- Derive broad weakness signals from evidence and misconception history; materialize lifecycle state only for efficient selection/audit.
- If materialized, support `new`, `recurring`, `improving`, `resolved`, and `retest` as explainable projection states.
- Require fresh evidence to project a weakness as resolved.
- Retain history and make resolved signals eligible for later retest.
- Avoid fuzzy topic-string matching; link signals to stable objective/category identifiers.

**Acceptance criteria:**
- A recurring failure can be selected later even if the objective's aggregate proficiency projection appears strong.

## Phase 2 — Assessment integrity

### Task 7: Replace self-graded learning sessions

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/session/engine.ts`
- Modify: `src/session/modes/explore.ts`
- Modify: `src/session/modes/quiz.ts`
- Modify: `src/session/modes/teach-back.ts`

**Interfaces:**
- Consumes: challenge, frozen assessment criteria, learner response.
- Produces: assessment result and evidence event rather than a learner-selected 0-5 mastery grade.

**Steps:**
- Remove authoritative `Rate your recall 0-5` behavior from the normal learning path.
- Allow confidence to be captured separately for calibration if useful.
- Require each assessable challenge to declare what objective and criteria it measures before the learner answers.
- Use `correct`, `partially_correct`, `incorrect`, or `ungradable` as the primary result.
- Pass assessment data into the evidence evaluator rather than directly changing concept state.

**Acceptance criteria:**
- The learner cannot promote mastery merely by choosing a high self-rating.

### Task 8: Freeze rubrics and answer criteria before response

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/db/types.ts`
- Modify: `src/interview/problems.ts`
- Modify: `src/llm/grader.ts`

**Interfaces:**
- Consumes: generated or curated challenge.
- Produces: persisted grading criteria that are fixed before the learner response is stored.

**Steps:**
- Extend problem/assessment storage with target objective(s), criteria, acceptable variants, common failures, and hint ladder where applicable.
- Ensure `registerChallenge()` durably persists the exact frozen challenge version before `openAttempt()` can reference it. The physical owner may extend upstream `problems` or use a dedicated version table, but a fresh agent must reconstruct the public payload, targets, criteria, rubric, hint ladder, verification requirements, and private assessment references without regeneration.
- Mark ambiguous or invalid tasks as `ungradable` rather than forcing a score.
- Prevent the learner response from being used to invent a new success criterion after submission.
- Keep LLM evaluation subordinate to the frozen rubric for open-ended tasks.

**Acceptance criteria:**
- Re-evaluating the same response uses the same pre-existing grading standard unless the assessment itself is explicitly invalidated.

### Task 9: Separate executable correctness from LLM feedback

**Files:**
- Modify: `src/interview/coding.ts`
- Modify: `src/llm/grader.ts`
- Create: a narrow execution-result contract only if existing attempt/problem types cannot represent external/local verification cleanly.

**Interfaces:**
- Consumes: learner code, language/runtime metadata, test specification.
- Produces: deterministic execution result plus optional LLM qualitative feedback.

**Steps:**
- Stop treating LLM inspection of source plus described tests as strong implementation correctness evidence.
- For V1, execute learner code through the agent/local repository environment rather than building a kernel-owned sandbox service.
- Persist deterministic execution/verifier output as assessment basis/artifact evidence.
- Keep LLM feedback for reasoning, complexity, readability, and interview commentary.
- Mark implementation evidence as weak/unverified when execution is required but unavailable.

**Acceptance criteria:**
- `implement: independent` can distinguish code that actually passed verification from code only judged plausible by an LLM.

## Phase 3 — FSRS integration

### Task 10: Introduce `ReviewRatingMapper` and scheduler contracts

**Files:**
- Create: `src/scheduler/types.ts`
- Create: `src/scheduler/rating-mapper.ts`
- Create: `src/scheduler/fsrs.ts`
- Modify: `package.json`

**Interfaces:**
- `ReviewRatingMapper` consumes assessed evidence and produces either no scheduler update or an FSRS rating.
- Scheduler consumes the mapped rating plus persisted card state and produces due time, retrievability, and updated scheduler state.

**Steps:**
- Add `ts-fsrs` as the scheduler implementation.
- Keep FSRS types behind an application scheduler interface.
- Keep pedagogical interpretation outside the FSRS adapter; the mapper alone translates evidence into scheduler ratings.
- Define the V1 mapper exactly: `incorrect → Again`, `partially_correct → Hard`, `correct → Good` for `retrieval_valid=true` evidence.
- Require scheduler-valid retrieval evidence to be answer-hidden, gradable, L0, and deterministically verified when the frozen task requires execution.
- Do not emit `Easy` in V1.
- Transfer success alone must not alter the FSRS rating.
- Persist mapper output in append-only `review_events` with mapper/scheduler version, replay parameters, and `reviewed_at` equal to the source evidence learner-performance time.
- Treat a `review_event` as effective only while its source evidence remains valid. Replay effective events in `(reviewed_at, seq)` order; if a newly committed assessment is backdated relative to the current card, rebuild rather than applying it out of learner-time order.
- Evidence invalidation/restore rebuilds the card from the filtered effective review history without rewriting review events.
- Do not expose learner self-rating as the authoritative scheduler input.

**Acceptance criteria:**
- Learning-state code does not import `ts-fsrs` directly outside the scheduler adapter.

### Task 11: Move scheduling state off concepts

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/db/types.ts`
- Modify: `src/state.ts`
- Modify: `src/session/engine.ts`
- Retire: `src/sm2.ts` after all callers migrate.

**Interfaces:**
- Consumes: learning objective ID and scheduler card state.
- Produces: objective-level due queries.

**Steps:**
- Add append-only `review_events` keyed to the source evidence event and learning objective.
- Add `review_cards` keyed by learning objective as the current rebuildable FSRS projection/cache.
- Persist a queryable indexed `due_at` plus serialized scheduler card state and source review sequence.
- Update due selection to query objectives/cards rather than concept SM-2 fields.
- Build/rebuild cards only from effective `review_events` whose source evidence is currently valid, ordered by `(reviewed_at, seq)`; remove the card projection if correction leaves no effective review history.
- Remove SM-2 state mutation from the session engine.
- Do not mathematically convert concept-level SM-2 fields into objective-level FSRS state. Preserve legacy data as provenance/non-authoritative import and establish new cards from new valid retrieval evidence.
- Remove legacy concept-level SM-2 fields only after all required reads have migrated.

**Acceptance criteria:**
- `transactions:explain` and `transactions:debug` can have different due dates.

## Phase 4 — Challenge selection and task forms

### Task 12: Model challenge intent explicitly

**Files:**
- Modify: `src/db/types.ts`
- Modify: `src/interview/problems.ts`
- Create or extend: `src/session/modes/` according to existing ownership.

**Interfaces:**
- Consumes: learning objective(s).
- Produces: challenges tagged with target capability, task form, delivery context, novelty, and grading criteria.

**Steps:**
- Keep the target capability on the learning objective (`explain`, `predict`, `implement`, `debug`, `design`).
- Record the concrete task form separately, for example explanation/teach-back, runtime trace, code implementation, diagnose-and-repair, or design/trade-off scenario.
- Model `learn`, `practice`, `review`, `interview`, and `mock` as delivery context.
- Allow one challenge to produce evidence for several objectives when the rubric makes each measurement explicit.
- Record prior surfaces so a transfer challenge can avoid cosmetic repetition.

**Acceptance criteria:**
- The same objective can be assessed in practice and interview contexts without creating separate mastery systems.

### Task 13: Add challenge selection

**Files:**
- Create: `src/selection/types.ts`
- Create: `src/selection/selector.ts`

**Interfaces:**
- Consumes: due cards, objective proficiency projections, derived weakness signals, prerequisites, urgency, and recent challenge history.
- Produces: the next challenge specification.

**Steps:**
- Prefer the weakest relevant capability rather than repeating a familiar question form.
- Rotate task form when evidence history is one-sided.
- Prefer changed surfaces for transfer/retest work.
- Avoid selecting blocked dependent objectives before core prerequisites reach the configured gate.

**Acceptance criteria:**
- A due objective with repeated explanation successes and debugging failures preferentially receives a debugging/transfer challenge.

## Phase 5 — Interview and weakness integration

### Task 14: Refactor interviews to emit ordinary evidence

**Files:**
- Modify: `src/interview/coding.ts`
- Modify: `src/interview/system-design.ts`
- Modify: `src/llm/grader.ts`
- Modify: evidence persistence paths as needed.

**Interfaces:**
- Consumes: interview problem mapped to learning objectives.
- Produces: normal evidence events, attempts, misconception updates/derived weakness signals, and qualitative debrief.

**Steps:**
- Keep interview attempts as attempts, not a separate mastery source.
- Map interview phases or rubric dimensions to the learning objectives they genuinely measure.
- Remove the system-design heuristic that derives phase scores from feedback-text length.
- Preserve phase responses and rubric results directly.
- Use candidate-first reasoning, pushback, edge/failure cases, dry runs, and debrief where the problem type benefits from them.

**Acceptance criteria:**
- Interview performance updates the same evidence history and objective proficiency projection used by learning and coding practice.

### Task 15: Add weakness retesting

**Files:**
- Modify: `src/evidence/weakness.ts`
- Modify: `src/selection/selector.ts`

**Interfaces:**
- Consumes: resolved weakness projection/history and subsequent session count/time/evidence.
- Produces: targeted retest challenges and updated derived weakness projection.

**Steps:**
- Make resolved weaknesses eligible for later retest.
- Prefer a changed surface during retest.
- Project a failed retest back to recurring/improving based on evidence.
- Keep projection changes auditable and rebuildable from evidence/misconception history.

**Acceptance criteria:**
- A previously resolved misconception can be deliberately rechecked without resetting its history.

## Phase 6 — Daily orchestration

### Task 16: Implement `tutor today`

**Files:**
- Create: `src/plan/today.ts`
- Modify: `src/cli.ts`
- Reuse/modify: `src/plan/pacer.ts` only where its pacing ownership remains valid.

**Interfaces:**
- Consumes: due objectives, derived weakness signals, prerequisite blockers, deadline/job urgency, learner time budget, and recent session history.
- Produces: a bounded daily mission.

**Steps:**
- Use deterministic priority tiers first:
  1. overdue core objective;
  2. recurring/retest weakness;
  3. due core objective;
  4. deadline-critical prerequisite;
  5. new high-value objective;
  6. supporting objective.
- Rank within each tier using retrievability, prerequisite leverage, the active goal's explicit objective importance, deadline-derived urgency, recent contradictory evidence, and task/surface diversity.
- Keep V1 goal importance explicit (`core`, `important`, `supporting`) and derive urgency from the existing goal/topic deadline rather than storing a magic interview score or ingesting job descriptions automatically.
- Cap ordinary review warm-up at three items or roughly five minutes.
- Bound review debt so overdue cards cannot consume the entire daily budget.
- Reserve meaningful time for forward progress plus application, debugging, or transfer rather than filling the session with recall prompts.
- Return a readable reason for each selected item.

**Acceptance criteria:**
- The user can run one command and receive a coherent plan containing due retrieval, highest-value active work, and transfer/interview work when justified.

## Phase 7 — Restart-safe agent workflow

### Task 17: Persist resumable session state

**Files:**
- Extend the existing session persistence rather than creating a second unrelated state system.
- Create a small runtime/session-state module if the existing `sessions` table cannot own the required fields cleanly.

**Interfaces:**
- Consumes: active session phase, pending action, selected challenge, learner work location, and unresolved blockers.
- Produces: enough durable state for a fresh agent/process to resume without chat history.

**Steps:**
- Persist explicit session phase and pending action.
- Store the exact frozen challenge ID/version, active attempt, unresolved verification/assessment step, and enough references to persisted hint/exposure history to resume deterministically.
- Require the frozen challenge version itself to be durably reconstructable before an attempt opens.
- Make resume behavior deterministic from persisted state.
- Treat model/chat memory as helpful context only.

**Acceptance criteria:**
- A fresh agent can identify exactly what to resume from durable state alone.

### Task 18: Provide one replaceable teacher-agent contract

**Files:**
- Create documentation/Skill adapter only after the kernel interfaces above exist.

**Interfaces:**
- Consumes: `today`, challenge, assessment, evidence, correction, exposure, and resume APIs.
- Produces: one coherent teaching/practice/interview workflow that is not tied to a specific agent provider.

**Steps:**
- Treat ChatGPT as the preferred V1 teacher client, not a kernel dependency.
- Define how any compatible teacher requests the next mission.
- Define how it registers and presents a durably frozen challenge without leaking private answers/rubrics.
- Define objective-aware hint recording: scope each hint to an objective, owned criterion IDs, or all targets; let the kernel assign interaction timestamps; close hint recording when the attempt is submitted.
- Define `recordExposure` before showing material explanations, answers, worked examples, corrective feedback, or solution walkthroughs; let the kernel timestamp and persist the exposure so future durability delay is provable.
- Define how it submits learner work and assessment without re-supplying mutable challenge semantics.
- Define `reviseEvidence` for invalidate/restore and corrected-replacement assessment paths, with all affected projections and scheduler state rebuilt atomically.
- Define how it handles feedback, retries, breaks, and resume.
- Keep one active teacher/orchestrator until real use demonstrates a need for role isolation.
- Keep provider-specific conversation memory and tool transcripts optional; durable continuity must come from kernel state.
- Do not build a generic plugin/multi-agent framework merely to support replacement teachers.

**Acceptance criteria:**
- Any compatible teacher client can run the full retrieve → learn → apply → debug → transfer/interview loop from kernel state without inventing authoritative state in provider-specific chat memory.

## First usable milestone

Stop the first implementation wave when the system can do all of the following:

```text
create concepts and objectives
record evidence
project objective proficiency from evidence
track explicit misconceptions and derive weakness signals
map valid retrieval evidence into FSRS ratings and schedule it
select a task form based on the weak capability
run an executable programming challenge
run an interview challenge
produce `tutor today`
resume from durable state
```

Do not add UI/product layers until repeated real sessions expose a concrete need.

## Resolved design decisions

- Use a small extensible capability registry and instantiate objectives sparsely.
- Treat append-only evidence as authoritative; persisted proficiency/weakness summaries are rebuildable projection data.
- Keep explicit misconception records because they carry semantic meaning that broad weakness labels do not.
- Insert `ReviewRatingMapper` between pedagogical evidence and FSRS.
- Use agent/local repository execution for V1 instead of building a kernel-owned sandbox service.
- Use `/home/hamza/repo/learning-os` as the eventual product working tree while preserving `generic-tutor` upstream history and provenance.
- Record license/provenance metadata and preserve notices; clarify the missing upstream root license text before redistribution if necessary.

## V1 contracts closed before implementation

`docs/kernel-contracts.md` fixes the remaining V1 architecture decisions:

1. FSRS provenance lives in append-only `review_events`; scheduler replay uses only review events whose source evidence is currently valid, while `review_cards` is an indexed rebuildable cache. Evidence invalidation/restore atomically rebuilds the affected card. Legacy concept-level SM-2 state is not mathematically converted.
2. `ReviewRatingMapper` accepts only valid objective-specific L0 retrieval evidence and maps `incorrect → Again`, `partially_correct → Hard`, `correct → Good`; V1 emits no `Easy` rating.
3. Durability delay is computed from durable memory-contact history: prior targeted attempts (submitted time, or start time if abandoned) plus objective-specific material `exposure_events`. Interaction timestamps are kernel-owned; delay is not inferred from chat continuity.
4. Transfer/durability projections use exhaustive states: `untested`, `not_demonstrated`, `demonstrated`, `contradicted`.
5. Multi-objective challenges freeze objective-specific criteria before delivery, scope hints to objectives/criteria/all targets, and emit one evidence event per objective; ambiguous targets are `ungradable` rather than assigned synthetic scores.
6. A registered challenge version is durably persisted before an attempt opens and can be reconstructed by a fresh compatible agent without regeneration.
7. ChatGPT is the preferred V1 teacher client, but teacher identity is replaceable: Codex, OpenCode, AGY, or another compatible agent can continue from the same kernel state and protocol without learner-state migration.
8. Goal urgency uses explicit objective importance plus deadline-derived urgency; automatic job-description ingestion is outside V1.
9. Evidence and FSRS replay use learner-performance time, not assessment commit order; backdated assessment commits trigger deterministic rebuilds.
10. The logical schema, projection rules, challenge/assessment/correction contracts, `tutor today` budget guards, and teacher-agent↔kernel protocol are specified in `docs/kernel-contracts.md`.

Implementation may refine SQLite DDL details to match the upstream migration style, but it must not change these ownership or evidence semantics without updating the relevant ADR/spec first.