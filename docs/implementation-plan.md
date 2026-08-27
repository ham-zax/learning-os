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
- Keep the first implementation single-agent and CLI-first.
- Do not add dashboard, voice, Monaco/Judge0 UI, BKT, or multi-agent orchestration before the core loop is proven.

## Phase 0 — Fork readiness

### Task 1: Resolve the upstream fork boundary

**Files:**
- Upstream metadata and dependency files before local fork work begins.

**Interfaces:**
- Consumes: `alienz-dev/generic-tutor` repository state.
- Produces: a legally and technically usable fork baseline.

**Steps:**
- Record upstream provenance and license metadata. `package.json` declares MIT, but the inspected repository lacks a root `LICENSE` file; preserve required notices and clarify the missing license text before redistribution if needed.
- Record the exact upstream commit used as the fork base.
- Make `/home/hamza/repo/learning-os` the eventual product working tree while preserving `generic-tutor` upstream history rather than copying source into an unrelated Git history.
- Identify any generated or ecosystem-specific files that should not become part of the product architecture.

**Acceptance criteria:**
- The fork base and reuse rights are explicit.

### Task 2: Remove the sibling `nexus` runtime dependency

**Files:**
- Modify: `package.json`
- Modify: `src/llm/client.ts`

**Interfaces:**
- Consumes: existing `LLMClient` callers.
- Produces: a standalone provider adapter with the same narrow application-facing interface.

**Steps:**
- Preserve `LLMClient.complete()` and `isConfigured()` as the application seam.
- Remove `nexus: file:../nexus` from dependencies.
- Replace the `nexus/llm` import with a standalone provider implementation or a normal package dependency.
- Keep provider-specific configuration outside learning-state logic.

**Acceptance criteria:**
- A clean clone does not require a sibling Nexus repository.

### Task 3: Normalize session-mode contracts

**Files:**
- Modify: `src/db/types.ts`
- Modify: `src/knowledge/types.ts`
- Modify: `src/session/engine.ts`
- Modify: `src/cli.ts` and existing session-mode modules where needed.

**Interfaces:**
- Consumes: upstream mode vocabularies such as `learn/review/quiz/interview/practice` and `explore/quiz/teach-back`.
- Produces: one canonical distinction between target capability, task form, and delivery context before the new learning model depends on those names.

**Steps:**
- Inventory every persisted and runtime mode value and its callers.
- Define canonical delivery contexts such as `learn`, `practice`, `review`, `interview`, and `mock`.
- Keep target capability, task form, and delivery context as separate fields.
- Migrate or translate legacy `explore` and `teach-back` semantics explicitly rather than allowing duplicate vocabularies to survive.

**Acceptance criteria:**
- Session persistence, planning, and runtime selection no longer disagree about what a mode value means.

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
- Consumes: assessment result, task/rubric identity and version, learner response or artifact, evaluator/basis, hint use, task novelty, delay, and misconceptions.
- Produces: persisted `EvidenceEvent` plus deterministic rebuildable proficiency/blocker projections.

**Steps:**
- Add an `evidence_events` table linked to objective, session, problem, and attempt when those objects exist.
- Persist task/rubric identity and version, evaluator type, assessment basis, result, hint level, novelty, retrieval validity, delay, objective-specific criteria results, observed errors, and rationale. Keep the learner response/artifact on the shared attempt and reference it from each per-objective event.
- Add append-only `evidence_revisions` so an assessment mistake can be invalidated/restored without rewriting the original event.
- Add `objective_projections` with orthogonal readiness (`unknown|exposed|guided|independent`), transfer (`untested|demonstrated|contradicted`), durability (`untested|demonstrated|contradicted`), historical-highest readiness, blockers, event sequence, and projector version.
- Implement the exact projection rules in `docs/kernel-contracts.md`, including two distinct recent correct L0 attempts for independent readiness and the seven-day V1 floor for durability evidence.
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
- Add stable misconception definitions linked to the concept, plus append-only `misconception_observations` (`observed|cleared`) tied to objective evidence. Derive current active/cleared state from the latest valid observation.
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
- Persist mapper output in append-only `review_events` with mapper/scheduler version and replay parameters.
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
- Update a review card only when `retrieval_valid` is true.
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
- Store the active objective/challenge and unresolved evidence/grading step.
- Make resume behavior deterministic from persisted state.
- Treat model/chat memory as helpful context only.

**Acceptance criteria:**
- A fresh agent can identify exactly what to resume from durable state alone.

### Task 18: Provide one agent-facing orchestration contract

**Files:**
- Create documentation/Skill adapter only after the kernel interfaces above exist.

**Interfaces:**
- Consumes: `today`, challenge, assessment, evidence, and resume APIs.
- Produces: one coherent teaching/practice/interview workflow.

**Steps:**
- Define how an agent requests the next mission.
- Define how it presents a challenge without leaking frozen answers/rubrics.
- Define how it submits the learner response and observed hint use.
- Define how it handles feedback, retries, breaks, and resume.
- Keep a single orchestrator until real use demonstrates a need for role isolation.

**Acceptance criteria:**
- One agent can run the full retrieve → learn → apply → debug → transfer/interview loop without inventing authoritative state in chat.

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

1. FSRS replay inputs live in append-only `review_events`; `review_cards` is an indexed rebuildable cache. Legacy concept-level SM-2 state is not mathematically converted.
2. `ReviewRatingMapper` accepts only valid L0 retrieval evidence and maps `incorrect → Again`, `partially_correct → Hard`, `correct → Good`; V1 emits no `Easy` rating.
3. Multi-objective challenges freeze objective-specific criteria before delivery and emit one evidence event per objective; ambiguous targets are `ungradable` rather than assigned synthetic scores.
4. Goal urgency uses explicit objective importance plus deadline-derived urgency; automatic job-description ingestion is outside V1.
5. The logical schema, projection rules, challenge/assessment contracts, atomic assessment commit, `tutor today` budget guards, and agent↔kernel protocol are specified in `docs/kernel-contracts.md`.

Implementation may refine SQLite DDL details to match the upstream migration style, but it must not change these ownership or evidence semantics without updating the relevant ADR/spec first.