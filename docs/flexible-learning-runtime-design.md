# Flexible Learning Runtime Design

## Status

Implemented through the learner-facing contract and episode-aware orchestration waves on `main` (`9ef1040` and `4e520748`). Later live use demonstrated that curriculum-phase focus also needs durable orchestration ownership, so active study focus now belongs to `goal_preparation`. The pure `TurnDirective` helper remains skipped; response-segment, reconstruction-checkpoint, and preference persistence remain evidence-gated.

This design is based on two live Backend Systems learner sessions, the current Learning OS implementation, and the learner's prior systems-first mentor material.

This document proposes a more flexible learner-facing runtime without weakening the existing authority boundary:

```text
Learning OS decides:
what / when / evidence / readiness / prerequisites / review timing / next objective

Teacher runtime decides:
how to make the currently selected interaction cognitively valuable
```

The goal is not to add a second mastery model or a large prompt-state machine. The goal is to make Learning OS feel like a teacher rather than an assessment conveyor belt.

## Problem

The first teacher-pedagogy wave established the right principles: prediction before reveal, learner-built system models, failure autopsy, reconstruction, progressive scaffolding, discriminating challenges, and strict Learning-OS-owned next-action selection.

Live use exposed a different class of failure: a compatible teacher can follow the persistence/evidence lifecycle while still produce a poor learner experience.

The current system is strongest at durable learner truth. It is weaker at coordinating the small learner-facing decisions between one selected challenge and the next selection.

The desired system must be flexible enough to:

- diagnose without turning an entire session into diagnostics;
- teach directly when the learner has no useful model yet;
- ask dynamic follow-up questions without inventing new mastery state;
- stay on one concept long enough to repair and reconstruct it;
- chunk interaction for speech-to-text or high cognitive load;
- use spacing and deadlines without letting the model guess about time;
- choose explanation, prediction, debugging, coding, design, interview, or prerequisite work from authoritative state;
- preserve learner agency and evidence integrity throughout.

## Evidence basis

### Live interaction 1 — runtime request execution and concurrency

The learner correctly recognized that synchronous CPU work blocks JavaScript, but incorrectly treated request arrival as permission for an asynchronous database operation to start before the JavaScript handler executed.

The durable assessment was reasonable: `partially_correct`, clean retrieval, readiness became `guided`, and precise `observedErrors` were recorded.

The learner-facing interaction still had several failures:

- the detailed correction appeared in model reasoning rather than the final learner-visible response;
- the learner was not asked to reconstruct the repaired model;
- the next architecture diagnostic was opened without learner confirmation;
- internal terms such as attempt IDs and readiness enums leaked into the learning conversation;
- a large multi-part question was delivered even after the learner said they were using speech-to-text;
- the prompt used terms such as "drain" that were not part of the target concept and increased difficulty without adding diagnostic value;
- the frozen criteria were broad enough that useful partial understanding resulted in every criterion being marked unmet;
- after one Day 1 runtime diagnostic, the selector moved to an architecture objective associated with a later human lesson grouping.

### Live interaction 2 — architecture boundaries and scaling

The learner explicitly said they did not know `p95 latency`, database CPU saturation, horizontal scaling, bounded backlog, or the architecture pattern being requested.

The internal teaching response was strong: it explained percentiles, CPU saturation, API/worker separation, asynchronous queues, bounded backlog, independent scaling, shared Postgres, bottleneck-localizing measurements, and which premature optimizations to defer.

But the same learner-facing failure repeated:

- the useful explanation was not present in the final learner-visible answer;
- Learning OS recorded `explanation_shown`, even though the supplied transcript indicates that the explanation existed only in hidden reasoning;
- prompt-vocabulary gaps were persisted as architecture-objective weaknesses;
- the learner's actual speech transcript was summarized before being stored as `response_text`;
- no reconstruction followed the explanation;
- another diagnostic was selected and opened immediately;
- the next authorization challenge again contained several substantial questions at once.

These failures are enough to conclude that protocol wording alone is not yet a sufficient execution boundary for the learner-facing turn.

## What to carry forward from the prior mentor

The prior mentor package is useful because it treats learning as contact between a learner's mental model and observable reality rather than as content delivery.

The most valuable transferable rules are:

1. **Prediction before observation.** Ask the learner to commit before showing decisive evidence when that prediction is useful.
2. **Generation before comparison.** The learner should produce or explain before seeing a polished answer when possible.
3. **Stop after a real question.** Once the learner is asked to predict, trace, design, or explain, stop the message instead of appending hints or the answer.
4. **Do not force Socratic questioning.** If the learner says "I don't know" or lacks the prerequisite model, teach the missing layer directly.
5. **Predict -> observe -> correct -> reconstruct** is the minimum deep-learning loop; the longer optional loop is predict -> observe -> compare -> explain -> refine -> rebuild -> break -> re-debug.
6. **Mechanism before terminology.** Ask what moves, waits, owns state, saturates, fails, retries, or cleans up before requiring framework vocabulary.
7. **Compress deep dives.** End substantial learning with a stable mental image, causal chain, lifecycle, and operational consequence.
8. **Fade scaffolding.** Move from worked example -> partial completion -> guided construction -> independent generation as evidence permits.
9. **Prefer real systems.** Use the learner's code, project, runtime, or actual architecture before generic fixtures.
10. **Context is selected working state, not memory.** Give the teacher the smallest relevant context rather than entire histories.
11. **Evidence is behavioral.** Prediction, trace, ownership explanation, failure localization, mechanism explanation, rebuild/variation, teach-back, and operational implication are stronger signals than familiarity.
12. **Spacing belongs to the learning system.** The mentor should not invent future review times from intuition.
13. **Orientation is not mastery assessment.** A new environment sometimes needs a short guided map before cold prediction becomes meaningful.
14. **Probabilistic intelligence belongs inside deterministic boundaries.** The model may generate pedagogy and qualitative assessment, but persistence, selection, verification, and scheduling remain explicit system responsibilities.

The system should import these mechanisms, not the old prompt's wording or hidden learner model.

# Design principles

## 1. Flexibility is local; authority is durable

Learning OS should keep owning durable truth and next-work selection. Flexibility should live inside the current selected interaction.

A teacher must be allowed to change:

- explanation depth;
- analogy;
- system representation;
- number and wording of learner-facing subquestions;
- whether to clarify vocabulary;
- whether to use direct instruction or guided discovery;
- how much scaffolding to provide;
- whether to ask the learner to trace, teach back, reconstruct, or localize;
- how to adapt to speech-to-text or another interaction constraint.

It must not independently change:

- selected objective;
- capability;
- task form when task form is authoritative;
- novelty requirement;
- prerequisite policy;
- evidence result;
- readiness;
- transfer/durability;
- review timing;
- next objective.

## 2. A selected challenge opens an interaction episode, not one question/one answer

The key new unit is an **interaction episode**.

```text
Learning OS selects objective/challenge
        |
        v
interaction episode
  orient if needed
  ask / clarify
  collect response
  assess
  explain / repair
  reconstruct
  consolidate
        |
        v
cognitive closure
        |
        v
return to Learning OS for next work
```

The episode stays on the selected objective until one of these is true:

- the learner has completed the clean assessable response and any required feedback/reconstruction;
- the learner explicitly chooses to stop, pause, or redirect;
- the interaction budget is exhausted and continuation is deferred;
- an authoritative blocker requires another objective.

"Finish the concept" must not mean "the teacher declares mastery." It means **finish the current cognitive episode** before switching objectives.

## 3. Dynamic questions are allowed inside the episode

A frozen challenge fixes target, criteria, novelty, and evidence contract. It does not require the teacher to dump every question in one message.

The teacher may:

- ask one learner-facing subquestion at a time;
- ask a non-leading clarification;
- ask the learner to restate their model;
- ask for a prediction, then later ask for a causal explanation;
- request a compact system map;
- use a follow-up to disambiguate the learner's meaning.

Dynamic follow-ups must not silently add new success criteria after the learner starts answering.

For speech-to-text, one-at-a-time delivery should be the default when a challenge contains several independent prompts.

## 4. Teaching and assessment are related but not identical

A wrong prediction can be useful learning even when it is not strong proficiency evidence.

The system should distinguish the **purpose of the current interaction** conceptually:

```text
orientation
pretest / baseline diagnostic
learning / acquisition
practice
retrieval / review
transfer
assessment
interview / mock
```

Do not add a new persisted enum merely for taxonomy if existing `deliveryContext`, diagnostic metadata, novelty, and session state can derive the purpose.

Use a pure teacher-side derived purpose first. Add persistent metadata only if a concrete ambiguity cannot be resolved from existing contracts.

# In-the-wild pain points and required behavior

## P1. Hidden reasoning contained the lesson

**Observed:** Detailed corrections existed in model reasoning but not in the final answer.

**Required rule:** Anything needed for the learner's mental-model repair must appear in learner-visible output. Internal reasoning is not teaching.

## P2. Exposure was recorded without reliable visible delivery

**Observed:** `explanation_shown` was persisted for architecture teaching that the supplied transcript did not show in the final learner-visible response.

**Required rule:** An exposure counts as shown only when the material is about to be emitted to the learner-visible channel.

First-wave operational discipline:

```text
construct exact visible explanation
-> record exposure as the final tool/state operation
-> immediately emit that explanation
-> perform no unrelated tool work between persistence and delivery
```

A future adapter may couple persistence and rendering more strongly if live use still produces false-positive exposure.

## P3. Reconstruction was skipped after causal failure

**Observed:** Assessment -> correction -> new objective happened without learner reconstruction.

**Required rule:** After answer-bearing correction of a causal/foundational error, keep the session in feedback until the learner either:

- reconstructs the corrected model in their own words; or
- explicitly declines reconstruction.

The current `feedback / present_feedback` session phase can own this first wave. Do not call `completeSessionFeedback()` merely because corrective text was generated.

## P4. The next attempt opened before learner confirmation

**Required rule:** Learning OS may select the next move, but the teacher should normally present it before opening another attempt.

```text
obtain authoritative next move
-> explain it in one sentence
-> learner says continue / yes
-> re-resolve if necessary
-> freeze/open/present next challenge
```

An explicit learner request such as "keep going" can serve as confirmation.

## P5. Internal state leaked into normal teaching

Avoid default learner-facing phrases such as:

- `guided readiness`;
- `exposed`;
- `attempt 3`;
- `diagnosticPending`;
- `authoritative next action`;
- raw prerequisite-gap counts.

Translate them:

```text
"You have the blocking idea, but one causal link still needs repair."
"This next check is about tenant isolation."
```

Show raw state only when the learner asks for progress/evidence details.

## P6. Speech mode did not alter interaction shape

When the learner explicitly says they are using speech-to-text:

- prefer one substantive question at a time;
- avoid long numbered batteries unless the learner asks for the full prompt;
- treat obvious homophones as transcription noise;
- if ambiguity changes technical assessment, ask a short clarification;
- preserve the learner's actual reasoning rather than rewriting it into polished prose.

## P7. Prompt vocabulary contaminated target assessment

Example: `p95 latency` and `database CPU saturation` were unknown during an architecture-design diagnostic.

Before treating that as target failure, ask:

> Does defining this term reveal the target reasoning?

If no:

```text
briefly define the term
-> no hint/exposure penalty for the target
-> resume the same challenge
```

If yes, use the normal hint/exposure lifecycle.

Do not create durable weakness categories for incidental vocabulary unless the vocabulary is part of the frozen target or reveals a real prerequisite gap.

## P8. Learner evidence was rewritten before persistence

`response_text` should represent the learner's response, not the teacher's summary of it.

For speech transcripts:

- preserve the supplied transcript by default;
- normalize only obvious transcription noise when meaning is unambiguous;
- never improve technical reasoning before storing it;
- use assessment rationale for the teacher's interpretation.

If raw and normalized forms are ever both needed, add an explicit artifact/provenance contract rather than silently replacing one with the other.

## P9. Large diagnostic prompts overloaded novices

A baseline diagnostic should find the decision boundary with the smallest sufficient surface.

For `unknown` readiness, prefer a small discriminating challenge over a six-part senior-design checklist.

After a foundational gap becomes obvious, stop probing every advanced criterion merely to collect more failures. Finish the assessment honestly, then teach.

## P10. Frozen criteria were too coarse to represent partial understanding

Challenge criteria should be atomic enough that useful partial reasoning can be represented.

Prefer:

```text
sync CPU blocks JS                       met
arrival != handler execution             unmet
external I/O begins only after issuance  unmet
wait ownership                           unmet
```

instead of one large "timeline" criterion that becomes wholly unmet.

Do not fragment criteria into meaningless microfacts; each criterion should still represent a behavior the objective cares about.

## P11. Diagnostics became a conveyor belt

Current `getTodayMission()` iterates through pending initial diagnostics while budget remains. With many active baseline objectives this can fill a session with diagnostics.

The learner experience should instead be event-driven:

```text
select one useful episode
-> execute
-> persist new evidence
-> finish repair/reconstruction
-> recompute remaining time and state
-> select again
```

Do not treat a mission generated before the learner's response as a rigid script for the rest of the day.

Consider a diagnostic breadth cap for ordinary learning sessions. Broad assessment days may deliberately allow more diagnostics.

## P12. Human lesson focus is not currently authoritative

The Backend Systems seven-day blueprint says Day 1 focuses on runtime/concurrency/backpressure, but the live selector can move from runtime to architecture because all baseline objectives are active and the day labels are only documentation.

This is a real planning gap, not a teacher-prompt problem.

The implemented boundary stores a generic active study focus on `goal_preparation`:

```text
goalId
activeFocusLabel
activeFocusObjectiveIds
```

The focus survives teacher replacement and is recovered through `getPreparationContext(goalId).studyFocus`. `getTodayMission(...)` uses it automatically unless the caller deliberately supplies a per-call `focusObjectiveIds` override.

An active study focus:

- prioritizes the current learning arc and prerequisite/foundation work needed to unlock it;
- prevents unrelated pending baseline diagnostics from winning merely because every goal objective is active;
- never bypasses true prerequisites;
- still allows higher-authority Learning OS reasons such as due retrieval, recurring/retest weakness, required transfer, and contradictory evidence;
- does not imply mastery when the focus ends;
- can be changed or cleared without rewriting evidence.

This remains a generic focus mechanism rather than a hard-coded `day_1` field.

## P13. Prompt-only pedagogy is not reliably executed

Protocol-only dogfood succeeded; live use then skipped visible teaching/reconstruction twice.

This is now evidence for a small pure teacher-side interaction directive, not a stateful pedagogy engine.

Candidate shape:

```ts
type TurnDirective =
  | { kind: "ask"; stopAfterPrompt: true }
  | { kind: "clarify"; answerBearing: boolean }
  | { kind: "teach"; exposureType: ExposureType }
  | { kind: "reconstruct"; requiredBeforeTransition: boolean }
  | { kind: "transition_offer"; requiresConfirmation: true };
```

It must not choose the objective or mutate learner projections.

## P14. The packaged Skill can drift from the repository Skill

A fresh agent may have a packaged `learning-os-teacher` Skill that is older than the repository-local canonical Skill/protocol.

Repository guidance already says repository-local authority wins, but drift still increases compliance risk.

Add release discipline:

- repository Skill remains canonical;
- update bundled references with normative changes;
- rebuild/repackage the portable Skill whenever canonical behavior changes;
- include a lightweight revision marker or packaging check so stale distributions are detectable.

## P15. Current time budgets are mostly static estimates

`getTodayMission()` currently uses fixed default minutes by task form:

```text
explanation      8
runtime_trace   10
debugging       16
implementation  20
design          20
```

These are reasonable planning estimates, not a dynamic teaching clock.

The teacher should not infer "the learner needs 20 minutes" merely because the task form is `design`.

## P16. The legacy pacer is not the current adaptive answer

`src/plan/pacer.ts` calculates session duration from completed sessions and legacy review grades, but it is not wired into `createTeacherKernel()` or `getTodayMission()` and still depends on legacy `reviews` semantics.

Do not revive it unchanged.

If adaptive pacing is implemented, rebuild it from current evidence/session contracts rather than legacy scalar grades.

## P17. The current teacher API does not record active learning time

Sessions have `started_at`/`ended_at`, and attempts contain a `time_spent_seconds` column, but `SubmitAttemptInput` does not currently accept time spent.

Wall-clock session duration is not the same as active study time: the learner may leave a tab open, take a break, or return later.

Use explicit learner budget as authority and treat wall elapsed time as advisory until active-time telemetry has a reliable owner.

## P18. FSRS is being asked the wrong question if used for lesson length

FSRS answers:

> When should this objective be retrieved again?

It does not answer:

> How many minutes should this explanation take?
> Should the next turn be coding or teaching?
> Should the learner stay on this concept for three more questions?

Keep these responsibilities separate.

## P19. Prerequisite teaching needs a smoother learner path

Current selection correctly blocks an objective when a semantic prerequisite's `explain` readiness is below the configured minimum.

The learner experience should be:

```text
target blocked
-> Learning OS selects prerequisite/foundation work
-> teacher gives minimal orientation if needed
-> clean diagnostic when useful
-> direct acquisition when the learner has no model
-> reconstruction
-> return to ordinary selection
```

Do not repeatedly quiz prerequisite vocabulary the learner has never been taught merely to prove that they do not know it.

## P20. Preferences need scope and must not become mastery

Examples:

- speech-to-text;
- prefer one question at a time;
- concise explanations first;
- systems-first examples;
- current project/repository;
- "I am new to backend" as self-described context.

These may improve teaching but must never initialize readiness.

Persist only explicit stable preferences if cross-session continuity materially improves. Keep scope explicit: turn, session, project, learning profile, or global.

## P21. Context should be selected, not accumulated

A fresh teacher needs the smallest useful context:

- active profile and goal;
- current focus envelope if any;
- current/resumable session;
- current `ChallengeIntent`;
- target projection and selected weakness;
- relevant prerequisite state;
- due timing and remaining session budget;
- stable learner preferences that apply;
- relevant project/content evidence;
- recent reconstruction summary only when it helps the current objective.

Do not dump full transcripts or every historical event into the model call.

## P22. Real project/runtime evidence should outrank fixtures

For software learning, prefer:

```text
learner's live problem/code
-> learner's repository/runtime
-> small custom example
-> versioned fictional fixture
```

A static teaching fixture must never override verified current project behavior.

## P23. Question turns should actually stop

When a clean learner response is required, the learner-visible message should end after the question.

Do not append:

- hints;
- the likely answer;
- "here is how to think about it" scaffolding;
- unrelated next steps.

A structural `stopAfterPrompt` directive is justified if agents continue violating this rule.

# Proposed runtime architecture

## Layer 1 — Durable learner control plane

Existing Learning OS remains authoritative for:

- profile/goal;
- objective identity;
- prerequisites;
- challenge selection;
- frozen criteria;
- hints/exposure;
- evidence;
- readiness;
- weaknesses/misconceptions;
- transfer/durability;
- review scheduling;
- resumable assessable session state.

No parallel teacher mastery model.

## Layer 2 — Temporal orchestrator

Owns the relationship between three independent clocks.

### Clock A: spacing/retrieval time

Owner: FSRS + review card.

Input:

- retrieval-valid evidence;
- `Again | Hard | Good` mapping;
- learner-performance timestamp.

Output:

- `due_at` for later retrieval.

The existing kernel already implements this well.

### Clock B: goal/deadline time

Owner: goal preparation + today planning.

Input:

- deadline;
- daily/weekly availability;
- objective importance;
- target readiness/transfer/durability.

Output:

- urgency and bounded daily work.

The existing planner already has this foundation.

### Clock C: current-session time

Owner: orchestration, not FSRS and not model intuition.

Input:

- user's explicit available minutes;
- mission start time;
- current episode estimate;
- completed episode count;
- remaining minutes;
- optional explicit learner update such as "I have 15 minutes left".

Output:

- whether to start another episode;
- whether to choose a shorter selected interaction;
- whether to defer a long implementation/interview task;
- how much time to reserve for feedback/reconstruction.

First-wave policy should be conservative:

1. user-stated budget wins;
2. use static task minutes as estimates only;
3. recompute after each completed episode;
4. do not open a new 20-minute challenge with five minutes left;
5. preserve a small closure budget for feedback/reconstruction;
6. do not pretend wall time equals active study time.

### Memory-contact consequence

Explanations, worked examples, answer reveals, corrective feedback, and solution walkthroughs are memory contacts in the current durability contract.

Therefore teaching immediately before a planned delayed retrieval changes the durability anchor. This is correct and should remain visible to the orchestrator.

If the learner asks for the explanation, teach it and record the exposure. Do not preserve a clean durability attempt at the expense of learner agency.

## Layer 3 — Interaction episode controller

This is the main V2 addition.

It consumes authoritative current work and derives the next **teacher turn**, not the next objective.

Candidate inputs:

```text
ChallengeIntent
session phase / pending action
current attempt state
readiness / transfer / durability
selected weakness
current hint/exposure provenance
learner preference/context
remaining session time
latest learner utterance
```

Candidate outputs:

```text
ask
clarify
explain
show worked example
request system map
request reconstruction
request teach-back
present feedback
transition offer
```

This controller is preferably pure and non-persistent in the first implementation.

It cannot emit readiness, scheduler changes, objective selection, or mastery.

## Layer 4 — Context assembler

Build a bounded teacher context from relevant authoritative sources.

The context assembler should distinguish:

```text
learner evidence truth
project/runtime truth
pedagogical guidance
learner preferences
teaching fixtures
```

Do not let retrieved/static teaching material become authority over live project evidence or kernel learner state.

## Layer 5 — Mentor runtime

The model supplies flexible natural-language pedagogy:

- explanations;
- analogies;
- dynamic subquestions;
- challenge wording;
- system maps;
- qualitative rubric assessment;
- feedback;
- reconstruction prompts.

It should optimize for one useful cognitive action at a time.

## Layer 6 — Evidence and scheduler

Existing kernel lifecycle persists what was actually demonstrated and schedules retrieval.

The mentor must not translate fluency, confidence, or self-report directly into learner state.

# Dynamic episode policy

## Before the learner responds

Choose the smallest useful surface.

### Unknown + pending clean diagnostic

- explain unfamiliar non-target vocabulary if it does not reveal the answer;
- ask a minimal discriminating question;
- stop;
- do not front-load a lecture.

### Unknown + no useful model / learner says "I don't know"

- complete the diagnostic honestly if already opened;
- record exposure before answer-bearing teaching;
- teach the smallest missing model;
- ask for reconstruction;
- do not immediately open another diagnostic.

### Exposed

- prefer learner reconstruction or guided completion;
- give structure but require learner generation;
- avoid treating recognition as ability.

### Guided

- reduce scaffolding;
- use changed examples when Learning OS selects another qualifying challenge;
- inside a teaching episode, use follow-up questions to make the learner choose the reasoning lens themselves.

### Independent

- prefer transfer, delayed retrieval, debugging, design trade-offs, or authentic project work when Learning OS selects them;
- avoid redundant worked examples.

## After the learner responds

### Correct and causally explained

- assess against frozen criteria;
- give compact feedback;
- request reconstruction only if the answer was fragile or a model answer/correction was shown;
- close the episode;
- ask Learning OS for the next move.

### Partially correct

- identify the smallest faulty causal link;
- distinguish demonstrated from not demonstrated;
- correct only the missing relationship;
- have the learner reconstruct;
- close only after reconstruction or explicit learner opt-out.

### Incorrect with a coherent model

Use full autopsy:

```text
expected result
-> learner assumption
-> contradicting observation
-> corrected relationship
-> learner reconstruction
```

### "I don't know" / no model

Do not perform Socratic theater.

```text
state that the gap is foundational
-> teach one compact model
-> ask one reconstruction question
-> expand only if needed
```

# How to decide explain vs code vs debug vs design vs interview

The teacher should not choose these from preference alone.

Use the existing Learning OS contract first:

```text
capability + taskForm + deliveryContext + novelty + prerequisite state
```

### Explain

Use when:

- Learning OS selects `explain`;
- a prerequisite explain objective is selected;
- the current episode requires corrective teaching after exposure;
- the learner asks for direct teaching and accepts the exposure trade-off.

### Predict / trace

Use when:

- capability is `predict`;
- runtime/causal behavior can be observed;
- a clean mental-model discriminator is valuable.

### Code / implement

Use when:

- capability/task form is implementation;
- executable work is the appropriate selected evidence surface;
- enough session time remains for the task and feedback.

Do not insert coding merely because it feels practical if Learning OS selected another capability.

### Debug

Use when:

- capability/task form is debugging;
- the learner has enough model to form competing hypotheses;
- the challenge can expose a first-failing boundary or discriminating observation.

### Design

Use system maps and ownership/invariant questions, but scale complexity to the evidence level. Unknown learners should not receive a senior-system-design battery when a smaller boundary decision can discriminate the same target.

### Interview / mock

Interview is a delivery context, not a replacement learning system.

- `interview`: technical attempt first, concise signal feedback afterward;
- `mock`: no coaching inside the attempt, debrief afterward;
- if the learner lacks foundations, normal learning episodes should repair them rather than repeatedly simulate interviews they cannot yet perform.

# Prerequisites

Keep true prerequisites semantic and sparse.

The default prerequisite policy already requires `explain` readiness of at least `guided`.

Use three cases:

### Case 1 — harmless terminology clarification

Target can continue without changing objective.

Example:

> "What does p95 mean?"

If the definition does not reveal the target design reasoning, answer it directly and resume.

### Case 2 — real prerequisite is already modeled

Let Learning OS block the target and select prerequisite work.

### Case 3 — live interaction exposes a missing prerequisite not modeled in the graph

Do not silently create a permanent prerequisite from one conversation.

Record the target evidence honestly. Surface the candidate prerequisite as a planning/product observation. Add/migrate the prerequisite graph only through an explicit curriculum/goal change boundary.

# Question design

## One cognitive objective per visible turn

A message can contain context plus one main learner action.

Good:

> The API and report generator currently share one Node process. Reports use two seconds of CPU. What is the first resource conflict you expect during a report burst?

Stop.

Avoid:

> Answer six architecture dimensions, five metrics, two trade-offs, and one deferral decision.

for a learner whose baseline is unknown.

## Questions may deepen dynamically

A concept episode can follow a path without prewriting every question:

```text
concrete behavior
-> causal explanation
-> ownership/boundary
-> failure/pressure
-> operational consequence
-> reconstruction
```

Advance only while the learner has enough model for the next question to be productive.

## Terminology comes after mechanism when possible

Prefer:

> "Where do requests start piling up if work arrives faster than the process can finish it?"

Then name:

> "That is queueing/backpressure."

rather than grading the learner on the word `backpressure` before they understand the mechanism.

# Reconstruction

For substantial concept repair, the learner should leave with four compressed outputs:

```text
mental image
causal chain
lifecycle
operational consequence
```

Example:

```text
mental image:
one JS execution lane with external systems that can work after being invoked

causal chain:
sync CPU owns JS -> other handlers wait -> DB cannot start until handler issues query

lifecycle:
request arrives -> waits -> handler runs -> I/O issued -> external work -> continuation -> response

operational consequence:
CPU-heavy synchronous work raises queueing latency for unrelated requests
```

Do not necessarily persist a new `Reconstruction` entity in V2. First require the behavior in the teacher episode. Persist only if later retrieval/resume quality proves that a durable reconstruction artifact is needed.

# Spacing, FSRS, and time-aware teaching

## What FSRS should continue to own

FSRS currently receives only retrieval-valid evidence and maps:

```text
incorrect         -> Again
partially_correct -> Hard
correct           -> Good
```

The current scheduler uses `ts-fsrs` and stores `due_at` in `review_cards`.

Keep that.

FSRS should not receive teacher-side impressions such as:

- "needed a long explanation";
- "seemed tired";
- "spoke fluently";
- "this concept felt hard".

unless those impressions become explicit, validated evidence contracts later.

## What the temporal orchestrator should own

For each episode, know:

```text
session budget
estimated episode cost
actual wall elapsed (advisory)
remaining budget
whether due retrieval is waiting
whether a long task can be completed with feedback/closure
```

A useful first policy:

```text
0-5 min    due retrieval warm-up when appropriate
main block forward progress / current focus
application or transfer when selected and time permits
last 5-10% reserve for feedback/reconstruction/closure
```

Do not make these percentages rigid kernel invariants. They are planning defaults that should yield to explicit learner time constraints and task requirements.

## Replan after evidence

The highest-value improvement is not a sophisticated duration predictor. It is **replanning after each completed episode**.

The learner's latest evidence can completely change what is useful.

```text
available minutes = 60
select one episode
execute 12 minutes
assessment reveals foundational gap
teach/reconstruct 8 minutes
remaining = ~40
call Learning OS again with current state and remaining budget
```

This is more flexible than committing to a 60-minute mission generated before any new evidence exists.

# Focus and curriculum path

The human curriculum can define an intended path without becoming mastery state.

For Backend Systems:

```text
Day 1 runtime / saturation
Day 2 database correctness / connection pressure
...
```

Treat this as **study focus**, not a hard prerequisite chain or competence state.

Persist explicit phase intent on the existing goal-preparation orchestration owner so a fresh teacher can recover it without chat memory. The selector still owns the exact objective: focused targets and the prerequisite/foundation closure needed to unlock them are preferred, while higher-authority rules can escape the focus.

A focus policy allows escape for:

- true prerequisite blockers and their foundation work;
- due retrieval;
- recurring weakness/retest;
- required transfer or contradictory evidence;
- learner-requested redirection;
- deadline/importance pressure.

This provides continuity without making the curriculum brittle or creating a second scheduler.

# Learner preferences and interaction context

A short starter prompt should be enough because stable preferences belong with the learner/system, not in every prompt.

Potential stable non-evidence preferences:

```text
input mode: speech-to-text
challenge delivery: one main question at a time
state verbosity: low
teaching style: mechanism-first / systems-first
correction style: explicit, no false validation
```

Any persistent preference store must:

- distinguish preference from competence;
- record explicit user source;
- support scope;
- be replaceable without rebuilding learner evidence;
- avoid storing raw conversation merely to preserve style.

Do not implement a large preference system before the stable preferences actually needed by fresh sessions are enumerated.

# Context selection

For each teacher turn, prefer:

```text
current objective/challenge
current session phase
relevant target projection/weakness
relevant prerequisite state
applicable stable learner preferences
remaining time
relevant project/runtime evidence
small amount of recent pedagogical context
```

Avoid:

```text
entire profile history
all old weaknesses
full chat transcript
all curriculum files
all project files
```

The context window is a bounded working resource. More context can make teaching worse.

# Content and project learning

The prior mentor's repository-orientation approach is useful for Learning OS projects and coding goals:

```text
README/build metadata
-> directory structure
-> entry points
-> representative tests
-> core modules
-> relevant recent history
```

Orientation should give the learner enough concrete reality to reason from before cold assessment.

Reusable scenarios and anti-pattern drills should be versioned teaching fixtures with learner-visible scenarios separated from mentor-only diagnosis/teaching targets.

Use them only when real learner/project evidence is unavailable or a controlled transfer surface is useful.

# Proposed ownership changes

## Immediate protocol/Skill changes — justified now

The two live sessions justify strengthening the teacher boundary with:

- learner-visible-output invariant;
- exposure-delivery coupling rule;
- mandatory reconstruction/opt-out before transition after answer-bearing repair;
- transition confirmation before opening the next attempt;
- non-answer-bearing clarification rule;
- preserve learner transcript rule;
- speech-aware question chunking;
- hide state-machine jargon by default;
- stop-after-question rule;
- beginner baseline challenge-size guidance;
- do not persist incidental vocabulary as target weakness;
- replan after each episode rather than pre-opening future work.

## Pure teacher-side helper — now plausibly justified

The live failures are evidence that a small derived `TurnDirective` may improve cross-session consistency.

It must remain:

- pure;
- teacher-facing;
- non-persistent;
- unable to choose an objective;
- unable to mutate readiness/review/evidence;
- optional if strengthened protocol alone proves reliable after another live run.

## Kernel/orchestration changes worth designing next

### 1. Diagnostic breadth policy

Avoid filling ordinary study sessions with every pending baseline diagnostic.

### 2. Remaining-time replanning

Make current session budget/remaining minutes a first-class orchestration input on each episode boundary.

### 3. Optional soft focus envelope

Represent human curriculum sequence without making it mastery state.

### 4. Durable multi-turn response segments only if required

If speech-mode challenge chunking must survive fresh-agent restarts mid-attempt, the current single `response_text` written only on submission is insufficient.

Only then consider append-only learner-response segments tied to the attempt. Do not add them solely for conversational convenience.

### 5. Scoped stable preferences only if required

Persist only the small set that materially improves fresh-session behavior.

## Do not add yet

Do not add, without further evidence:

- a stateful pedagogy engine;
- a second mastery/confidence model;
- teacher-chosen FSRS ratings;
- persisted interview-signal scores;
- generic numeric challenge difficulty;
- automatic permanent prerequisite inference from one response;
- full chat transcript persistence;
- an elaborate fatigue model;
- a new task form for every teaching technique;
- a durable reconstruction table merely because reconstruction is useful.

# Acceptance scenarios for the next live dogfood

## Scenario 1 — causal misconception

Learner makes the same arrival-vs-handler-execution mistake.

Pass if:

- clean attempt is assessed;
- visible feedback contains the actual correction;
- exposure is recorded immediately before visible correction;
- learner reconstructs the model;
- session is not completed before reconstruction/opt-out;
- next objective is not opened before confirmation.

## Scenario 2 — unknown vocabulary during target diagnostic

Learner asks what `p95` means.

Pass if:

- teacher decides it is non-answer-bearing for the target;
- explains it briefly;
- resumes the same challenge;
- does not record `p95 unknown` as an architecture weakness unless the rubric actually targets it.

## Scenario 3 — learner says "I don't know"

Pass if:

- teacher does not continue interrogating advanced criteria;
- records the honest assessment;
- teaches the minimum missing model;
- asks one reconstruction question;
- does not launch another baseline until the episode closes.

## Scenario 4 — speech-to-text

Pass if:

- challenge is delivered one main question at a time;
- obvious transcription noise is interpreted without polishing reasoning;
- material ambiguity is clarified;
- persisted learner response preserves the actual reasoning.

## Scenario 5 — short remaining time

With fewer than ten minutes left, Learning OS should not start a new long design/implementation challenge that cannot reasonably reach feedback/closure.

Pass if the system replans with remaining time rather than following an old full-session mission blindly.

## Scenario 6 — due FSRS review plus active focus

Pass if:

- a short due retrieval can occur;
- current focus still receives meaningful forward-progress time;
- review debt does not consume the whole session;
- any answer exposure correctly resets the relevant durability memory contact.

## Scenario 7 — Day 1 focus

Given a runtime/backpressure soft focus:

- selector may choose a true prerequisite or due/retest exception;
- otherwise it should prefer objectives inside the current focus;
- ending the day does not manufacture mastery;
- unresolved evidence remains globally available later.

# Recommended rollout

## Wave 1 — learner-facing contract repair

Docs/Skill only plus live dogfood:

1. visible teaching invariant;
2. stop-after-question;
3. clarification vs answer-bearing help;
4. reconstruction before transition;
5. confirmation before next attempt;
6. speech-aware chunking;
7. learner transcript preservation;
8. state-jargon suppression;
9. challenge-size/atomic-criteria guidance;
10. replan after each episode.

## Wave 2 — small teacher runtime helper if needed

Implement pure `TurnDirective` derivation if another fresh teacher still violates Wave 1.

## Wave 3 — orchestration flexibility

Design and implement only the demonstrated product gaps:

- diagnostic breadth cap;
- remaining-time session envelope;
- optional soft focus envelope.

Keep FSRS unchanged unless retrieval scheduling itself is shown to be wrong.

## Wave 4 — persistence only for restart gaps

Only if live use shows fresh-agent continuity failures during multi-turn episodes:

- response segments;
- small scoped preferences;
- durable reconstruction checkpoint.

# Bottom line

The system does not need more tutoring cleverness. It needs a cleaner boundary between **selection**, **interaction**, **evidence**, and **time**.

The flexible design is:

```text
Learning OS selects one valuable episode
        |
        v
teacher adapts dynamically inside that episode
        |
        v
learner predicts / reasons / builds / debugs
        |
        v
kernel records actual evidence
        |
        v
teacher visibly repairs + learner reconstructs
        |
        v
episode closes
        |
        v
Learning OS replans from new state + remaining time
```

FSRS determines when clean retrieval should return. The daily/session orchestrator determines how much time is available. The teacher determines how to use the current minutes without inventing learner truth. A soft focus mechanism can preserve a curriculum arc without turning the arc into a brittle prerequisite chain.

That separation gives the learner continuity, dynamic questions, strong mental-model repair, spaced retrieval, and personalized pacing while keeping Learning OS authoritative and replaceable.