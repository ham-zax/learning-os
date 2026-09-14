# Learning OS learning-experience review

Date: 2026-09-14

Status: Review findings and proposed priorities; not an accepted implementation specification.

Reviewed baseline at the time of review: `main` at `440be26ab63d27aaec124a2119ce866762b6cb11`, plus the then-current working-tree changes, including the frontend/backend course additions. Subsequent implementation notes are called out explicitly below.

## 1. Conclusion and confirmed product direction

Learning OS already implements substantial machinery for learner evidence, goal-specific selection, scheduling, and continuation. The main product opportunity is making the conversational teaching experience more responsive and dependable across compatible agents.

**Exercises, executable coding tasks, and scratchpad repositories are optional. They should be offered or executed only when the learner chooses that investment or has given an applicable standing instruction.** A learner must be able to receive useful explanations, ask questions, reason through examples, and pursue appropriate learning goals entirely through conversation.

The initial review over-prioritized scratchpad integration as the next core workflow. The learner explicitly corrected that priority. This document incorporates that correction: improve adaptive conversation and continuity first; improve hands-on tooling as an optional extension.

Optional delivery does not make different evidence interchangeable. A conversation can demonstrate explanation, prediction, or design under its frozen criteria. It does not automatically demonstrate implementation. If a goal requires implementation evidence and the learner declines coding, explain the remaining gap and allow deferral or an explicit goal revision. Do not repeatedly pressure the learner into an exercise, lower the evidence standard, or label all conversational progress incomplete.

This review authorizes no implementation, schema migration, learner-state change, standalone application, or new server. Existing accepted ADRs and kernel contracts retain their authority.

## 2. Scope, evidence, and limits

The review examined repository architecture and the paths relevant to interactive learning:

- Teacher/workspace boundaries, profile resolution, onboarding, and course discovery.
- Goal planning, challenge selection, pedagogical directives, and continuation.
- Frozen challenges, submissions, assessment, evidence, reconstruction, and scheduling.
- Ordinary CLI sessions, coding/design interview surfaces, and the LLM client seam.
- Practical course instructions and starters, evidence receipts, and supporting ingestion/export surfaces.
- Existing lifecycle and continuation tests as static evidence of intended behavior.

This was a repository-wide architecture and workflow review, with detailed attention to conversation and optional coding. It was not an exhaustive correctness audit of every function, migration, integration, or curriculum question. No learner database contents were needed to reach these findings.

Findings distinguish **verified implementation facts**, **their product implications**, and **proposals**. Product gaps and intentionally deferred mechanisms are not automatically merge-blocking defects. Historical incidents described in repository design documents were read as historical evidence; they were not reproduced in this review.

The Codebase Memory index reported generation `2026-09-04T23:17:26Z`, with stale or untracked metadata for several relevant files and exclusions for docs and some tests. Current source was read directly for material claims. Satori reported no tracked codebase. The graph was useful for navigation, but it was not treated as proof of complete current coverage.

## 3. Existing foundations to preserve

| Responsibility | Current implementation | Review implication |
| --- | --- | --- |
| Learner isolation | Profile-local databases and explicit workspace/profile opening | Keep one canonical learner record when changing agents or exercise workspaces. |
| Goal personalization | Onboarding proposals, sparse capability objectives, preparation strategies, diagnostics, study focus | Personalization already exists; do not describe it as an entirely missing subsystem. |
| Next-work selection | Readiness, weaknesses, prerequisite checks, due retrieval, transfer requirements, recent challenge history | Improve delivery around the selector instead of introducing a competing teacher-owned scheduler. |
| Assessment integrity | Frozen challenge/rubric, actual submissions, assistance provenance, append-only evidence | Dynamic teaching must preserve the meaning of the original assessment. |
| Continuation | Resume-first orchestration and a durable reconstruction obligation | Extend only the demonstrated gaps in what a fresh teacher can recover. |
| Scheduling | Evidence-to-rating mapping and FSRS | Guided teaching and immediate repair must not silently create independent retrieval or long-term retention claims. |
| Inspectable progress | Objective evidence receipts | Explain consequential learner claims from existing evidence rather than chat memory. |
| Optional practical work | Frontend/backend starters and project-work guidance | Hands-on learning is already supported procedurally, though its execution is not a complete managed workflow. |

Primary evidence: [teacher kernel](../src/teacher.ts), [workspace](../src/workspace.ts), [onboarding application](../src/onboarding/apply.ts), [selector](../src/selection/selector.ts), [continuation](../src/study/continuation.ts), [evidence](../src/kernel/evidence.ts), [rating mapper](../src/scheduler/rating-mapper.ts), and [evidence receipt](../src/kernel/evidence-receipt.ts).

## 4. Findings

### F1. Adaptive conversation is specified more fully than it is enforced by the delivery surfaces

**Classification:** Verified delivery limitation; highest product priority.

The teacher protocol already requires the teacher to respond to the learner's actual blocker, distinguish wording difficulty from a missing concept, ask one substantive question when appropriate, and stop after asking it. The current `PedagogyDirective` is deliberately small: scaffold level, commitment before reveal, and question chunking. It is a starting constraint, not an adaptive conversation engine.

The built-in exploration flow demonstrates the difference. `presentExploreAcquisition()` iterates over a generated sequence, awaits each question's answer, discards the returned value, and continues. Those answers do not alter that loop's next teaching move. The later final restatement is submitted separately.

Evidence: [teacher protocol — pedagogical execution](teacher-agent-protocol.md#pedagogical-execution-contract), [pedagogical directive](../src/teacher-pedagogy.ts), `presentExploreAcquisition()` in [CLI](../src/cli.ts), and [exploration generator](../src/session/modes/explore.ts).

**Impact:** A CLI learner can express confusion or already demonstrate understanding and still receive the same sequence. A compatible conversational agent can adapt, but that quality depends on its execution of the protocol. This finding does not imply every external agent follows the fixed CLI sequence.

**Proposed improvement:** Prioritize representative conversational scenarios and inspect their observable outcomes. Strengthen the smallest delivery boundary that fails those scenarios. Do not assume a large conversation state machine or another prompt document is necessary.

**Acceptance examples:** A vocabulary clarification does not become a concept failure; a sufficient answer closes the episode; an ambiguous impasse receives one useful clarification; a missing foundation receives direct teaching rather than repeated guessing prompts.

### F2. Durable continuation did not preserve every useful intermediate response

**Classification:** Verified bounded persistence gap in the reviewed baseline; first bounded implementation wave implemented and regression-tested.

At review time, the kernel persisted frozen challenges, submitted responses, hint/exposure history, active attempts, and reconstruction status. `resumeSession()` could recover these and identify pending verification or assessment, but deliberate split-question state and the learner's reconstruction response were not first-class durable observations.

**Implementation note — 2026-09-14:** migration 17 adds `attempt_subquestions` for deliberate multi-turn decomposition and `attempts.reconstruction_response_text` for completed causal-repair reconstruction. `openAttemptSubquestion(...)` persists the exact learner-visible subquestion before delivery; `answerAttemptSubquestion(...)` records the learner's exact response; `resumeSession()` surfaces the ordered rows; `submitAttempt(...)` refuses to finalize while a subquestion remains unanswered; and completed `resolveSessionReconstruction(...)` now requires the actual reconstruction text. These records are bounded interaction observations/coordination state, not evidence or mastery. Generic transcript persistence remains intentionally absent.

Evidence: `SubmitAttemptInput`, `openAttemptSubquestion()`, `answerAttemptSubquestion()`, `resolveSessionReconstruction()`, and `resumeSession()` in [foundation](../src/kernel/foundation.ts); [kernel contracts](kernel-contracts.md); and [flexible runtime status](flexible-learning-runtime-design.md#status).

**Validation:** Automated tests reopen the database and create a fresh teacher kernel to recover answered and pending subquestions together with assistance provenance. They also verify that reconstruction text survives reopening without adding evidence or changing review cards. A live conversational handoff remains a separate evaluation of teacher behavior; these tests establish the persistence contract.

These records must not automatically count as new independent evidence. An assisted reconstruction remains assisted, and an informal clarification is not retroactively graded work.

**Acceptance example:** After interruption during a split question, a fresh teacher knows what has been answered, what is still pending, and which help was supplied, without treating partial answers as separate clean successes.

### F3. Effort preferences and optional exercise adoption need an explicit product contract

**Classification:** Confirmed learner requirement; proposed extension, not a claim of an existing automatic-exercise bug.

The current stable interaction preferences cover `inputMode` and `questionChunking`. The teacher protocol also preserves learner agency. The reviewed APIs do not provide a dedicated durable exercise-offer or effort-preference contract.

Evidence: [teacher protocol — stable preferences and learner agency](teacher-agent-protocol.md#stable-interaction-preferences), [teacher kernel](../src/teacher.ts), and [database types](../src/db/types.ts).

**Required behavior:**

- Ordinary help and conversation remain useful without exercise enrollment or workspace setup.
- A coding exercise, inline exercise, or scratchpad task is optional; the teacher does not automatically start one merely because it could be useful.
- Existing standing authorization can cover repeated exercise delivery. Do not ask the same permission again for every routine action within adopted scope.
- A one-off refusal or acceptance remains local to the episode unless the learner explicitly establishes a lasting preference.
- Declining an exercise is a choice about effort, not evidence of low ability, a misconception, or failed retrieval.
- A learner can change the preference. Do not convert it into a fixed learning-style label.

**Proposed improvement:** Begin with explicit teacher behavior and a small set of acceptance scenarios. If fresh-teacher continuity requires persistence, add a narrowly scoped preference using the existing preference owner. Possible wording such as “mostly conversation” or “offer hands-on work occasionally” is illustrative, not an accepted enum or schema.

**Acceptance example:** A learner says “keep this conversational.” The teacher continues through explanation, reasoning, or another compatible task and does not create a scratchpad. If implementation is a remaining goal requirement, it reports that gap without repeatedly reopening the exercise offer.

### F4. The CLI fallback is narrower than the conversational kernel contract

**Classification:** Verified interface limitation; secondary priority.

The normal product is agent-operated. The built-in LLM factory reports `isConfigured() === false` and throws on completion. Ordinary CLI sessions submit responses and report that assessment remains pending. `prepareOrdinaryChallenge()` uses the `explain` capability, whereas the newer teacher/selector boundaries support all five capabilities.

Evidence: [LLM client](../src/llm/client.ts), `runSession()` in [CLI](../src/cli.ts), [ordinary session engine](../src/session/engine.ts), and [teacher kernel](../src/teacher.ts).

**Impact:** The CLI cannot currently replace a capable external teacher with a complete adaptive tutoring experience. This is consistent with the documented fallback role; it is not evidence that the kernel only supports explanation or cannot assess coding.

**Proposed improvement:** Keep interface capability claims clear. If delivery code is improved, reuse the current selection and assessment boundaries so the CLI does not acquire a competing learning policy. A standalone local teacher application would require an explicit product decision and a teacher-client implementation. It is not necessary to satisfy the learner's optional-exercise requirement.

### F5. Scratchpad ownership and canonical profile resolution remain agent-managed

**Classification:** Verified optional-workflow gap; deferred behind conversational priorities.

`createTeacherWorkspace()` resolves the knowledge root relative to the process working directory unless supplied explicitly. The profile store likewise defaults to a relative `data` directory. The workspace API manages profiles, catalogs, courses, and goals; it does not attach an exercise repository to an active attempt.

The practical guides instruct the agent to copy selected starters into disposable learner workspaces and preserve repository originals. This provides a workable manual procedure, not a durable exercise-workspace association.

Evidence: [workspace](../src/workspace.ts), `profilePaths()` in [profile resolution](../src/profile/index.ts), [frontend practical work](../knowledge/frontend-revision/LABS.md), and [backend practical work](../knowledge/backend-systems/LABS.md).

**Impact:** An agent working from a different repository must explicitly resolve the canonical Learning OS store. A fresh teacher needs enough information to identify which optional workspace belongs to the resumed task. The failure mode is missing or wrong context; a new profile database is not inevitably created merely by changing directories.

**Proposed improvement:** When optional scratchpad work is adopted, bind the chosen exercise workspace to the canonical profile/session and distinguish curriculum source paths from editable learner paths. Missing workspaces should be reported and recovered deliberately, not silently recreated or redirected to another learner store.

### F6. Referenced code artifacts are not automatically immutable submissions

**Classification:** Verified optional coding provenance gap.

`SubmitAttemptInput.artifactRef` is an arbitrary record. `submitAttempt()` serializes it into the attempt; it does not capture the contents of referenced files. Inline coding submissions do preserve their source through `responseText`.

Evidence: `SubmitAttemptInput` and `submitAttempt()` in [foundation](../src/kernel/foundation.ts), plus `submitCodingSolution()` in [coding interviews](../src/interview/coding.ts).

**Impact:** If an integration submits a mutable file path and the file later changes, the path alone cannot reconstruct the assessed version. This becomes important when the agent demonstrates a repair or prepares the next variation in the same workspace. Arbitrary references can already point to immutable artifacts, so not every existing integration is affected.

**Proposed improvement:** For an adopted coding workflow, capture the relevant files at submission and identify the capture by content. Keep starter, learner submission, and subsequent teaching patches distinguishable. A diff helps review changes but does not prove learner authorship. Existing assistance provenance remains necessary.

**Acceptance example:** Editing the working file after submission leaves the original assessed artifact recoverable. An agent-authored repair does not silently replace the learner's submitted code or become unaided implementation evidence.

### F7. Executable verification lacks a required binding to a frozen verifier and submission capture

**Classification:** Verified integration limitation; relevant when hands-on correctness is claimed.

The coding API creates a handoff for external verification. Descriptive test cases are explicitly not executable checks. The CLI submits pasted code without providing verification and leaves assessment pending.

The structured frozen `VerificationSpec` contains `required` and `basis`. `VerificationOutput` contains an outcome, basis, summary, and open-ended details. The coding adapter accepts a verifier reference with supplied verification evidence, but it does not require a structured match between that reference, an immutable submission capture, and a verifier frozen before the answer. References and support conditions can be described in existing challenge artifacts; a structured binding is not currently enforced.

Evidence: [verification schemas](../src/db/types.ts), `createCodingVerificationRequest()`, `normalizeVerificationEvidence()`, and `assessCodingAttempt()` in [coding interviews](../src/interview/coding.ts), plus `validateVerificationContract()` in [evidence](../src/kernel/evidence.ts).

**Impact:** The agent/integration must ensure it ran the correct checks against the correct artifact. A stale or mismatched verification result can have a valid shape without proving the intended submission. This is a reproducibility and integration concern, not a demonstrated adversarial security exploit.

**Proposed improvement:** Before introducing a managed runner, establish a minimal frozen executable contract and require results to identify its version and the tested submission. Run against the capture rather than an evolving working file. Keep environment-unavailable outcomes separate from learner failure; the existing `passed|failed` verifier outcome alone does not describe that distinction. Whether this requires a runner-level status or a kernel schema change remains a design question.

Execution evidence must match the declared capability and environment. A Node model cannot by itself establish React lifecycle behavior or PostgreSQL transactional correctness. The existing lab instructions already make this distinction.

### F8. “Understood now” and “durably learned” need different stopping claims

**Classification:** Product communication requirement supported by existing implementation.

The current evidence model separates readiness, transfer, and durability. `computeReadiness()` uses qualifying unaided evidence across distinct frozen task identities/versions; transfer and durability have their own qualifying conditions. The rating mapper rejects invalid retrieval and ungradable evidence.

Evidence: `computeReadiness()`, `computeTransferState()`, and `computeDurabilityState()` in [evidence](../src/kernel/evidence.ts), plus [rating mapper](../src/scheduler/rating-mapper.ts).

**Impact:** “Keep asking until I get it” can turn into an exhausting loop if the teacher lacks an episode stopping rule. Immediate repetition after teaching cannot establish long-term retention. Passing one exercise is also not proof of every capability associated with its concept.

**Proposed improvement:** Close an episode when its criteria and required repair obligations are satisfied, or when the learner explicitly stops or opts out through the applicable lifecycle. Report what was demonstrated, what was assisted, and what remains untested. Leave later selection and delayed retrieval to Learning OS. Do not add bonus questions, reconstruction, or reflection after every correct answer by default.

## 5. Intended conversational experience

The following examples are proposed acceptance scenarios, not transcripts of assessed learner work.

| Learner behavior | Teacher response | Evidence boundary |
| --- | --- | --- |
| Asks an ordinary factual question | Answer directly when it is safe under the semi-strict protocol | No automatic mastery or attempt creation |
| Asks for help during an active attempt | Clarify neutrally or record answer-bearing help before showing it | Preserve honest retrieval conditions |
| Gives a sufficient correct answer | Give concise feedback and close the episode | No automatic extra test or lecture |
| Says the wording is confusing | Rephrase without revealing the target reasoning | Confusing wording is not a concept weakness |
| Lacks the foundational model | Teach the smallest useful model, then reconstruct when required | Assisted reconstruction is not clean retrieval |
| Asks for one thing at a time | Chunk the task without changing its frozen criteria | Record answer-bearing decomposition as help |
| Declines practical work | Continue conversationally, defer, or explicitly revise scope | No failure evidence for declining |
| Chooses a small exercise | Prepare only the adopted task and necessary setup | Freeze task and support conditions before submission |
| Pauses midway | Preserve the applicable pending state | Do not select replacement work simply because time passed |
| Asks why progress is still guided | Explain the relevant evidence receipt | No invented scores or inferred competence |

Dynamic teaching can change wording, examples, explanation depth, and neutral scaffolding within an active task. It cannot silently change the assessed capability, success criteria, or novelty requirement after the answer begins. A new assessable task goes through the existing selection/requested-challenge and freezing boundaries.

## 6. Proposed priority order

### Priority 1: Reliable conversation and optional participation

Address F1, F3, and F8 through a bounded set of learner-facing scenarios. Use the existing kernel and protocol first. Evaluate whether the learner's answer actually changes the next teaching move and whether refusal of an exercise is respected.

Success means useful learning without repository setup, no automatic exercise escalation, concise closure after sufficient performance, and truthful progress claims.

### Priority 2: Continuity where a fresh teacher loses necessary context

Use F2 to identify concrete interruption failures. Add only the missing observations or pending commitments. Preserve the existing reconstruction guard and keep provider transcripts and disposable teacher hypotheses outside authoritative state.

Success means a fresh compatible agent can resume a split question or repair obligation without repeating answered parts or inventing learner responses.

### Priority 3: Optional practical-work integration

Only after the conversational priorities, implement a narrow end-to-end exercise path if adopted. One existing lab is sufficient to evaluate F5–F7: workspace attachment, frozen checks, submission capture, verification, assistance history, and fresh-teacher resumption.

Success means the learner explicitly chose the exercise; setup remains proportional; the exact assessed submission is recoverable; and runner problems do not become learner failures.

### Priority 4: Additional interfaces if separately requested

A local visual interface could expose the current question, optional artifact, execution results, and evidence-backed progress. It must use the same teacher/workspace/kernel boundaries. A standalone teacher client is separate work from making optional exercises available through an existing agent.

No dedicated Learning OS MCP server, generic plugin runtime, parallel learner model, or second scheduler is proposed. Existing repository policy and ADR 0004 remain applicable.

## 7. Boundaries and unresolved design questions

[ADR 0005](decisions/0005-authority-transitions.md) intentionally defers generic live-episode state, structured support-environment schemas, and automatic objective creation from project work. This review does not silently reverse those decisions. Any future extension must demonstrate why the current public contracts cannot preserve the required behavior and identify the smallest responsible owner.

Before implementation, resolve only the questions relevant to the chosen work:

- Which intermediate responses are actually needed for restart, and when can a final response be sufficient?
- What is the smallest durable representation of an explicit effort preference, if protocol handling proves insufficient?
- Which optional execution environment will the first exercise adapter support?
- Where will immutable submission captures live, and how will their lifecycle relate to the profile database?
- How will an execution adapter represent environment failure without implying learner failure?

These are deferred design questions, not requests for the learner to answer now. No specific new API, schema, preference enum, delivery estimate, or framework is committed by this review.

## 8. Original findings-review verification

- The original review ran `node --max-old-space-size=4096 node_modules/.bin/tsc --noEmit --incremental false`; it passed.
- Existing lifecycle and continuation tests were read, not executed. No end-to-end tutoring or scratchpad session was exercised.
- Current source was checked directly where graph freshness or coverage was insufficient.
- No source implementation or learner-state changes were made by the review. The working tree already contained implementation, documentation, course, and learner-database changes.
- This documentation task adds this report and links it from the documentation index. It does not enact the proposals.
- No subagents or external research were used for these findings.

## 9. Subsequent staged-change review

The learner subsequently requested a review, correction, and commit of the existing staged wave before beginning the proposed future work. That review included the course implementation and canonical learner databases; it is distinct from the original findings-only task above.

Corrections made before commit:

- Course progress and study focus now match concept/capability pairs while preserving actual learner objective IDs. Imported objective IDs previously appeared unselected and could prevent focus selection.
- Canonical and portable teacher instructions consistently make exercises and scratchpads optional, preserve standing learner authorization, and distinguish declined practical work from failed evidence.
- Conflicting delivery narratives were reconciled against the database comparison in the [delivery record](coding-courses-delivery-2026-09-05.md). The accidentally staged empty legacy database placeholder was removed.
- Regression coverage was added for selected-unit proposals, imported objective IDs, reference attachment, path containment, episode mode, real minute limits, and CLI/resumption behavior.

Final validation: all 38 tests across seven files passed, and `npm run build` passed. The local documentation check resolved 193 links and validated four course/manifest JSON files. Both changed canonical profiles were checkpointed, passed SQLite integrity checks, and had no foreign-key violations; SQLite sidecars were excluded from staging.

These checks establish a reviewed baseline for the proposed priorities. They do not demonstrate end-to-end adaptive tutoring quality or enact the future persistence and optional execution designs in this report.

## 10. Continuity implementation review

The next implementation wave addresses F2 through migration 17, the existing attempt/session owner, and teacher protocol updates. It does not implement the full adaptive-conversation evaluation in F1 or the optional workspace/verifier designs in F5–F7.

Review corrections:

- Answers now require the specific pending subquestion's `seq`. Previously, retrying an earlier answer after the next question opened could silently store it against the next prompt. Sequence identity is also immutable in SQLite.
- The existing reconstruction lifecycle test was updated for the required learner response. Invalid runtime requests now produce validation errors; rejected completion leaves the reconstruction obligation and active time unchanged.
- Restart tests verify exact prompt/response text, ordered partial answers, exposure provenance, and no automatic evidence or review-card creation. Additional checks cover stale answers, one pending question, submission guards, learner abandonment, immutable history, and a version 16 schema with active work migrating to version 17.

Validation: `npm test` passed all 45 tests across eight files; `npm run build` passed; the two affected test files also passed a separate strict TypeScript check because the production `tsconfig.json` excludes tests. Review used current source directly where the graph reported stale metadata or excluded paths. Canonical learner databases were not opened or changed; migration behavior was exercised on temporary fixtures.

The continuity implementation is ready within this scope. Evaluate representative learner conversations next before claiming reliable adaptive teaching across agents. Exercises and scratchpads remain optional.

## 11. Live failure follow-up: question presentation

Subsequent learner-provided exchanges showed that updated skills alone did not ensure self-contained, appropriately sized questions. The teacher supplied solutions in response to context requests and regenerated broad reconstruction prompts. Source inspection also found that migration 17's subquestion boundary rejected submitted attempts, leaving reconstruction without a saved pending question.

The learner approved [durable question presentation](question-presentation-design.md). Migration 18 extends existing question records with response/reconstruction purpose, separate context, episode chunking and immutable replacement history. Continuation now provides a focused `presentation`; question replacement preserves context/chunking, answers remain sequence-bound, and missing preparation is explicit. The owning implementation is [kernel/questions.ts](../src/kernel/questions.ts); teacher instructions use its ready Markdown instead of regenerating the resumed question from history.

Validation: all 48 tests across nine files passed, production build and strict checking of affected test files passed. An additional upgrade check created answered/pending questions with the actual committed version 17 implementation (`8699307`) in a temporary checkout, upgraded them with the current code, and verified exact historical text/IDs, unchanged sessions, explicit missing context, and valid SQLite integrity/foreign keys. These checks establish the persistence and rendering boundary. They do not establish that an external chat agent always emits the prepared Markdown unchanged; a live session with the new API remains the behavioral evaluation.
