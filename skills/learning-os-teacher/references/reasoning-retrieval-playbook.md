# Reasoning and retrieval playbook

Use this reference when the current Learning OS-selected episode needs specialized concept construction, retrieval repair, discrimination, transfer, or learner-requested depth, **or** when a broad ad-hoc learning request needs concept construction and pacing. Do not load or execute it merely because the techniques are available. "Read what the last message did" and the "already know the basics" routing row apply to any teaching turn, including ad-hoc exploration where Learning OS has selected nothing.

## Contents

- Invocation rule
- Broad ad-hoc concept construction
- Fast routing
- Read what the last message did
- Cognitive-direction rotation
- Retrieval-first study
- Retrieval and brain dump
- Pattern noticing and guided discovery
- Confusion-pair discrimination
- Repair the right thing
- Prediction and self-verification
- Boundary tests and thought experiments
- Prior-knowledge bridges
- Progressive integration span
- Causal chunks and naturalistic retrieval
- Scaffolding and worked examples
- Stop rules

## Invocation rule

Use at most the smallest technique that resolves the present learning need. Do not chain techniques by default. A correct and sufficient answer normally closes the episode.

Never use a playbook technique to select a new tracked objective, review, transfer, retest, or weakness. Learning OS owns those decisions. In ad-hoc exploration, the teacher may choose the next explanatory connection within the learner's request; that is not tracked selection.

## Broad ad-hoc concept construction

Use when a learner asks for a substantial introduction covering multiple related mechanisms without adopting tracked curriculum. The learner's requested scope informs an **ephemeral explanation path**, not a new Learning OS goal, assessment, or review plan.

- **Find the causal backbone:** pick one realistic problem that makes the central mechanism necessary. Relate it to the learner's stated programming or domain knowledge without assuming competence from familiarity. Use the same example as a through-line instead of unrelated definitions.
- **Build and integrate:** explain the minimum mechanism, then add a few closely connected insights whose relationships the learner can reason about (for example, decision loop → shared state → conditional transition). This is not a concept quota: a narrow gap may need only one relation. Name technical terms once their role is clear. Preserve a conceptual overview when explicitly requested, but defer implementation detail that would obscure the foundation. If the learner asks how to build something, connect the model to a small usable example rather than deferring practical use indefinitely. Verify version-sensitive framework/API details against current authoritative sources before teaching them.
- **Calibrate density, not arbitrary length:** before adding another concept, ask whether it relies on a relation not yet established. Avoid both an encyclopedia-like first response and one-trivial-fact-per-turn questioning. A diagram, small trace, or worked example should clarify one causal relation, with an accessible explanation.
- **Invite construction at a meaningful boundary:** when useful and the learner has enough structure, pose one question that asks them to predict behavior, connect two mechanisms, or explain a trade-off. End there; do not append the answer. Direct explanation is appropriate when a cold question would only test unfamiliar terminology or the learner asked to be taught first. An explanation-only request needs no question; “one question” is a ceiling, not a requirement.
- **Use the response to choose the next *explanatory* move:** correct the actual faulty relation, fill one missing prerequisite, increase integration if they connect the parts, or answer a new question without reheating the old lesson. Respect a request for more substantive novelty or less detail. No claimed mastery, formal score, new objective, future review, or durable learner state follows from this conversational adaptation.

Example: for a graph-based agent framework, show a small `decide → tool → decide/finish` loop; connect node/edge/state to that loop; ask what must survive a pause; only then introduce checkpoint persistence and its limits. This is an illustration of causal sequencing, **not** a prescribed lesson template or a requirement to ask the question verbatim.

### Adapt across turns

Keep only a lightweight conversational thread: what the learner wants, the example already in use, what they actually said, and the unresolved relationship. Do not create a lesson-state file or a proficiency ledger.

- **They connect the parts:** acknowledge the specific connection briefly and, if they ask to continue, advance to the next useful implication using the same example. Do not repeat the introduction or demand a second proof of the same point.
- **They show a wrong relation:** contrast its predicted behavior with one small counterexample, repair that relation, and invite a retry only if useful. For example, a checkpoint of program state does not by itself establish exactly-once behavior for an external payment; keep the explanation at that boundary rather than restarting graph terminology.
- **They are unsure or partial:** supply the missing link or a smaller worked example. Do not infer a misconception from “I don't know,” and do not keep guessing with Socratic questions when instruction is needed.
- **They change direction or pace:** answer the new request and adjust density. Earlier requests for first principles do not override a later request for practice, more depth, or less detail.
- **They are done:** synthesize the reusable mechanism and its relevant limit if useful, then stop. Conversational success supports the next explanation, not a mastery, retention, or review claim.

These adaptation moves also help teach a kernel-selected tracked episode. There, the frozen criteria, exposure-before-display, reconstruction, and feedback lifecycle still govern; they do not authorize a different objective or a new attempt.

## Fast routing

| Learner situation | Prefer | Avoid |
| --- | --- | --- |
| Current model is unknown | brief free recall or brain dump | definition-first lecture |
| Learner can plausibly infer a principle | pattern noticing or one guided-discovery probe | long Socratic sequence |
| Learner confuses two nearby concepts | confusion-pair discrimination | two independent definition questions |
| Causal behavior can be observed | prediction before reveal | showing decisive output first |
| Learner's prediction conflicts with evidence | self-verification | immediately replacing their reasoning with yours |
| Learner wants deeper understanding | one boundary test or thought experiment | automatic multi-stage lesson |
| Prior knowledge may help or mislead | positive/negative transfer bridge | assuming analogy is valid because vocabulary is similar |
| Learner remembers the fact but not the reusable sequence | causal chunk | isolated trivia drill |
| Learner knows pieces but not the whole | increase integration span | adding unrelated difficulty |
| Learner lacks enough structure to begin | minimal scaffold/worked example | full solution when a smaller cue would work |
| Learner's message asks something new ("but why does it even need a name?") after understanding the last answer | answer the new question; say in a clause what from before still holds | re-explaining the earlier definition |
| Learner says they already know the basics (ad-hoc exploration only; nothing assessed or recorded) | short refresher, then practice; let the first attempt show any real gap | re-teaching foundations or adding a quiz |
| Answer is already sufficient | close | another pedagogical operator |

## Read what the last message did

Before explaining anything, decide what the learner's latest message did. Most wasted turns come from answering the old question.

| The message... | Do this | Not this |
| --- | --- | --- |
| asks a new question | Answer the new question. Say in a clause what from before still holds. | Re-explain the earlier answer. |
| keeps the question but uses a wrong relation | Name that relation, show where it fails on this case, ask for the corrected one. | Re-teach the whole topic. |
| shows a missing piece (a term, a step, how two things connect) | Supply that piece and nothing else. | A longer lecture or a prettier diagram. |
| disputes a premise or definition | Check the definition or source with them. | Say the same claim more fluently. |
| understands but prefers a different choice | Stop explaining. The decision is theirs. | Push until they agree. |

If you cannot tell which one it is, ask one small question whose answers lead to different next moves (for example: "which of these should count equally here?").

This is something to notice, not a step to run on every turn. In an active graded attempt, supplying a piece or showing where a relation fails can reveal target reasoning; record the hint or exposure before showing it, exactly as usual.

## Cognitive-direction rotation

When repeated interactions are becoming one-dimensional, vary the cognitive direction without creating a new capability or mandatory sequence:

- **Generation:** produce the explanation, design, prediction, code, or model.
- **Recognition:** discriminate a near-miss, spot the violated invariant, choose between competing traces, or identify the bug.
- **Reflection:** explain which clue/invariant separated the alternatives or where prior reasoning failed.

Use this as a variety heuristic only. Do not automatically run all three directions in one episode.

## Retrieval-first study

Use retrieval-first as an episode strategy when the selected work benefits from seeing the learner's current model before instruction:

```text
orient
-> generate before instruction
-> inspect the learner model
-> teach only the missing relationship
-> reconstruct when needed
-> stop
```

"Generate" depends on the selected capability: recall/brain dump for explanation, committed outcome for prediction, hypothesis/discriminating observation for debugging, ownership/invariant/flow construction for design, or the smallest plan/attempt for implementation. These are opening moves: a correct plan or hypothesis satisfies only the frozen criteria it actually demonstrates. Keep implementation/debugging episodes open until any selected production, repair, and verification criteria are satisfied. Use one compact move, not a compulsory pretest battery.

Keep cold outcomes distinct:

- retrieval absence ("I don't remember") does not demonstrate a specific misconception;
- a partial model supports targeted teaching of the missing relationship;
- a coherent wrong model can justify precise causal repair when the response actually demonstrates it;
- a correct sufficient model closes normally without unnecessary teaching.

Orientation is semantic. Neutral topic/section headings may frame recall. A heading, summary, diagram, example, or takeaway that gives away the target rule/mechanism is answer-bearing and must use the normal hint/exposure boundary. Calling it a preview does not make it neutral.

Do not force retrieval-first when prerequisites are missing, required reconstruction is pending, the learner explicitly chooses teaching exposure, or interview/mock rules require a different assessment boundary. Learning OS still chooses any later variant, transfer, retest, or delayed review.

## Retrieval and brain dump

Use clean retrieval before teaching when an unprimed signal is useful.

- **Free recall:** ask for the governing mechanism, invariant, or causal sequence without answer choices.
- **Brain dump:** ask the learner to externalize what they currently think, especially for a new concept whose model is uncertain.
- Keep the surface small. Do not ask for every detail when one discriminating relationship is enough.
- If retrieval failure is the only blocker and a hint is allowed, use the frozen challenge hint lifecycle instead of converting the failure into a conceptual diagnosis.

## Pattern noticing and guided discovery

Use when the learner can reasonably infer the principle from a compact phenomenon.

```text
minimal contrast
-> learner notices what changes/repeats
-> one inference probe
-> name/formalize the principle if useful
```

Do not make guided discovery a ritual. If one useful inference probe does not create progress, diagnose the blocker or teach the minimum. Interview/mock assessment does not become guided discovery.

## Confusion-pair discrimination

Use when two concepts are individually familiar but systematically conflated.

Author a case where the competing models predict different outcomes, then ask for the discriminating feature.

Examples of useful structures:

```text
A and B look similar
-> what observation separates them?
-> which invariant belongs only to A or B?
-> what near-miss answer would be tempting, and why is it wrong?
```

Prefer this over asking for two memorized definitions. MCQ can be useful when the distractors encode real competing models rather than trivia, but it is a recognition/discrimination technique, not the default evidence shape for an `explain` objective. When explanation quality is being assessed, require the learner's rationale or explanation rather than treating a choice alone as sufficient explanation evidence.

## Repair the right thing

When an explanation did not land, decide what is missing before changing it:

- a fact or relation is missing -> add that fact. A better diagram or table will not.
- everything is there but hard to follow -> change the form (labels, order, one table or sketch).
- the learner needs a nudge -> give a hint (recorded first when an attempt is active) and treat the next answer as assisted.

Say where an example or analogy stops working. Where useful, include one case in which a tempting shortcut gives the right answer by coincidence, so it is not over-generalized.

## Prediction and self-verification

When decisive output, logs, execution, or metrics are available and clean evidence matters:

```text
learner predicts
-> commit
-> reveal/execute
-> learner compares prediction with observation
-> identify first divergence
```

Self-verification is valuable after the evidence boundary is safe. Ask the learner to locate where their reasoning first diverged before giving a polished correction.

Do not expose the decisive observation before the required commitment. If the comparison itself reveals target reasoning during an active attempt, use the normal exposure lifecycle.

## Boundary tests and thought experiments

Use to test whether a rule is causal rather than memorized.

Good moves:

- change one assumption;
- ask what evidence would falsify the current rule;
- find a counterexample;
- move to a boundary condition;
- preserve the mechanism while changing the surface.

Use one such move when it materially discriminates understanding or the learner asks for depth. Do not automatically append it after a good answer.

## Prior-knowledge bridges

When durable context actually establishes relevant prior knowledge, distinguish positive from negative transfer:

```text
what transfers unchanged?
what only looks similar?
which old heuristic becomes dangerous here?
what invariant replaces it?
```

Validate analogies structurally: map roles, relationships, and invariants, not just terminology. Do not infer prior expertise from confidence or chat familiarity. That caution is about evidence. When choosing how to teach in ad-hoc exploration, believe the learner's own statement of what they already know.

## Progressive integration span

Use when the learner can handle local pieces but struggles to coordinate them.

Increase span without inventing a new mastery state:

```text
local mechanism
-> mechanism + one neighbor
-> end-to-end flow across interacting mechanisms
```

Example: pool -> pool + transaction -> request + pool + transaction + lock + response.

Only increase span when integration is part of the selected objective/criteria or the learner explicitly wants a system-level model. Do not turn every concept into an end-to-end architecture exercise.

## Causal chunks and naturalistic retrieval

Prefer reusable causal units over isolated trivia when the selected objective depends on a sequence or relationship.

Example:

```text
current stack finishes
-> microtasks drain
-> next task begins
```

is usually more useful than memorizing one disconnected scheduler fact.

When Learning OS has already selected due retrieval, it may be presented naturally inside a compatible realistic surface rather than as a flashcard-like interruption, provided objective-specific evidence remains clean. The teacher does not decide that an unrelated concept is due and does not merge objectives when the frozen criteria cannot assess them independently.

## Scaffolding and worked examples

Use the smallest assistance that lets the learner continue thinking.

```text
independent attempt
-> minimal cue
-> structural cue/hint if allowed
-> worked example or direct teaching only when needed
-> later fresh no-hint attempt when independent evidence is required
```

A worked example is teaching exposure, not independent performance. Co-construction is guided. Withdraw assistance once it is no longer needed.

## Stop rules

Stop the playbook escalation when any of these is true:

- the learner gives a correct and sufficient answer;
- one targeted correction resolves a small gap;
- the current technique is no longer producing inference;
- further depth is not required by the selected objective/criteria;
- the learner did not ask for deeper exploration;
- continuing would contaminate interview/mock or independent evidence.

Rich capability is not a requirement to use rich pedagogy every turn.
