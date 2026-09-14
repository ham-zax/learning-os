# Durable question presentation

Status: Approved and implemented. The current schema requires every persisted question to be presentation-ready, with explicit chunking and atomic questions scoped to one frozen criterion.

## Observed problem

Live teaching repeatedly supplied a solution when the learner requested task context, returned to oversized questions after a chunking request, and regenerated reconstruction prompts on restart. Protocol instructions alone were insufficient: the kernel needed to persist the exact pending question and make atomic scope structural rather than trusting an `atomic` label.

## Decision

Extend the existing attempt subquestion owner to cover `response` and `reconstruction` purposes. Keep task context separate from the question, and store the question's `default|atomic` presentation constraint. Preserve replaced questions with a supersession timestamp; never fabricate an answer to replace or abandon one. At most one unanswered, non-superseded question may exist for an attempt. The kernel derives purpose from the active session phase, not caller preference.

Reconstruction questions are legal only on the active submitted attempt during feedback with reconstruction required. Response questions retain the existing unsubmitted/collect-response rule. Answers and replacements must identify the specific pending sequence. Completed reconstruction must not bypass an unanswered reconstruction question. Explicit opt-out remains possible without supplying an answer. Completed reconstruction text remains assisted observation, never a new evidence event.

Add `getSessionQuestionPresentation(sessionId)` and include its result on `getStudyContinuation(...)`'s resume branch. A ready presentation contains a fixed orientation, saved task context, current question, purpose, sequence, chunking, and rendered Markdown. It excludes previous answers, solutions, rubric rationale and teaching artifacts. Existing full resume state remains available for assessment and debugging.

The `purpose` value is for the system, not the learner. Learner-facing Markdown
uses simple, natural language and common words. For a follow-up after teaching, it says we
looked at the idea earlier and asks the learner to explain it in their own words.
If something is still unclear, the teacher can go over it again. Do not show terms
such as `reconstruction`, `pending_action`, or `retrieval_valid` to the learner.

Missing questions return `needs_question`; there is no persisted partial-question state. Once a question is inserted it already has exact task context, explicit chunking, and any required atomic scope. Once the latest question was answered, return `answered` so the teacher assesses/integrates the response instead of silently preparing a bonus drill. Non-question phases return `not_waiting`.

## Public operations

```ts
openAttemptSubquestion(attemptId, { promptText, contextText, questionChunking, scopeCriterionId?, scopeNote? })
replaceAttemptSubquestion(attemptId, { seq, promptText, contextText, questionChunking, scopeCriterionId?, scopeNote? })
answerAttemptSubquestion(attemptId, { seq, responseText })
getSessionQuestionPresentation(sessionId)
```

Question creation and replacement both take a complete presentation contract. `contextText` and `questionChunking` are required on every call; `default` carries no scope, while `atomic` requires `scopeCriterionId` and `scopeNote`. The caller obtains the desired chunking from the current pedagogy/preference decision before authoring the question instead of relying on persistence-layer inheritance. Context must contain the exact relevant code/facts without answer-bearing explanation. The kernel checks nonempty strings and validates atomic scope against the frozen challenge criteria, but cannot determine pedagogical neutrality or count reasoning demands in free text.

## Teacher workflow

1. Consult continuation as before. Prefer its presentation for a resumed question.
2. If preparation is needed, prepare the question under existing frozen criteria, persist its context and prompt, then obtain the presentation.
3. Present its Markdown and stop. A context request redisplays the same presentation without a state mutation or a new exposure.
4. A size/wording complaint replaces the identified pending question; preserve history and assistance semantics. Do not interpret the complaint as a learner answer.
5. Record actual answers against their sequence. Review against the frozen criteria; ask another part only when it is still needed. Resolve reconstruction through the existing completion/opt-out boundary.

## Boundaries and alternatives

Another long skill rule leaves regeneration uncontrolled. A fully controlled chat renderer could enforce exact output but is a larger product change. This design makes the existing agent path concrete and repeatable without claiming control over arbitrary external-agent prose. It does not semantically certify one reasoning demand, detect answer leaks, add a scheduler, persist transcripts, or require exercises/scratchpads.

## Verification boundary

The current schema requires non-empty context on every persisted row, enforces the default/atomic scope shape in SQL, and validates atomic criterion ownership on insertion. There is no runtime compatibility branch for partial or unscoped atomic questions.

Important regression scenarios are: required repair -> broad question -> atomic replacement -> repeated context read -> database reopen -> same small question and code; no teaching content in presentation; stale answer/replacement rejected; invalid replacement rolls back; completed reconstruction refuses a pending question while opt-out closes truthfully; and an answered question does not auto-generate another.

Persistence/rendering checks can establish the kernel boundary. Live agent evaluation is still required to establish whether a particular conversational agent presents the returned material without embellishing it.
