# Durable question presentation

Status: Approved and implemented on 2026-09-14. [Implementation plan and verification](question-presentation-implementation-plan.md). Scoped atomic questions added afterwards: an `atomic` question must target one frozen criterion with a demonstration note; see migration 19.

## Observed problem

Live teaching repeatedly supplied a solution when the learner requested task context, returned to oversized questions after a chunking request, and regenerated reconstruction prompts on restart. Updated skill instructions alone did not correct this. Migration 17 only permits subquestions before submission, while causal reconstruction happens after assessment. A reconstruction obligation therefore survives restart without its exact pending question. A later live test showed the follow-on failure: the agent saved a four-demand reconstruction prompt and labeled it `atomic`, and the kernel faithfully repeated it because `atomic` was only metadata.

## Decision

Extend the existing attempt subquestion owner to cover `response` and `reconstruction` purposes. Keep task context separate from the question, and store the question's `default|atomic` presentation constraint. Preserve replaced questions with a supersession timestamp; never fabricate an answer to replace or abandon one. At most one unanswered, non-superseded question may exist for an attempt. The kernel derives purpose from the active session phase, not caller preference.

Reconstruction questions are legal only on the active submitted attempt during feedback with reconstruction required. Response questions retain the existing unsubmitted/collect-response rule. Answers and replacements must identify the specific pending sequence. Completed reconstruction must not bypass an unanswered reconstruction question. Explicit opt-out remains possible without supplying an answer. Completed reconstruction text remains assisted observation, never a new evidence event.

Add `getSessionQuestionPresentation(sessionId)` and include its result on `getStudyContinuation(...)`'s resume branch. A ready presentation contains a fixed orientation, saved task context, current question, purpose, sequence, chunking, and rendered Markdown. It excludes previous answers, solutions, rubric rationale and teaching artifacts. Existing full resume state remains available for assessment and debugging.

Missing questions return `needs_question`; legacy rows without context return `needs_context` together with their saved prompt/chunking/scope metadata. If a migrated legacy `atomic` row has null scope, restoring its context also requires choosing one frozen criterion and a demonstration note so the replacement satisfies the v19 atomic-scope invariant. Neither case synthesizes history. Once the latest question was answered, return `answered` so the teacher assesses/integrates the response instead of silently preparing a bonus drill. Non-question phases return `not_waiting`.

## Public operations

```ts
openAttemptSubquestion(attemptId, { promptText, contextText?, questionChunking?, scopeCriterionId?, scopeNote? })
replaceAttemptSubquestion(attemptId, { seq, promptText, contextText?, questionChunking?, scopeCriterionId?, scopeNote? })
answerAttemptSubquestion(attemptId, { seq, responseText })
getSessionQuestionPresentation(sessionId)
```

Context omitted from a replacement is retained, as are chunking and scope. Chunking omitted from a replacement or next question retains the episode's most recent setting, falling back to the profile preference. A caller may explicitly update it when the learner changes their preference. New context must contain the exact relevant code/facts, without answer-bearing explanation. The kernel checks nonempty strings and validates atomic scope against the frozen challenge criteria, but cannot determine their pedagogical neutrality or count reasoning demands in free text.

## Teacher workflow

1. Consult continuation as before. Prefer its presentation for a resumed question.
2. If preparation is needed, prepare the question under existing frozen criteria, persist its context and prompt, then obtain the presentation.
3. Present its Markdown and stop. A context request redisplays the same presentation without a state mutation or a new exposure.
4. A size/wording complaint replaces the identified pending question; preserve history and assistance semantics. Do not interpret the complaint as a learner answer.
5. Record actual answers against their sequence. Review against the frozen criteria; ask another part only when it is still needed. Resolve reconstruction through the existing completion/opt-out boundary.

## Boundaries and alternatives

Another long skill rule leaves regeneration uncontrolled. A fully controlled chat renderer could enforce exact output but is a larger product change. This design makes the existing agent path concrete and repeatable without claiming control over arbitrary external-agent prose. It does not semantically certify one reasoning demand, detect answer leaks, add a scheduler, persist transcripts, or require exercises/scratchpads.

## Migration and verification

Migration 18 adds nullable context, purpose defaulting to response, chunking, and supersession to existing rows; rebuilds relevant guards/indexes without deleting history. Version 17 rows keep their exact text and IDs and report missing context honestly. Exercise migration on temporary databases before opening canonical learner state.

Regression scenarios: required repair -> broad question -> atomic replacement -> repeated context read -> database reopen -> same small question and code; no teaching content in presentation; stale answer/replacement rejected; invalid replacement rolls back; completed reconstruction refuses a pending question while opt-out closes truthfully; answered question does not auto-generate another; response-mode behavior and migrated history remain intact.

Automated tests establish persistence and rendering. A subsequent live agent evaluation is required to establish whether the agent actually presents the returned material without embellishing it.

## Delivery verification

All 48 tests across nine files and the TypeScript build passed. Strict checking of the affected test files passed. A temporary checkout of the actual committed version 17 code verified that its answered/pending records upgrade to version 18 with exact historical text and IDs intact.

Both canonical profiles were backed up outside the repository, upgraded and checkpointed: frontend from schema 17 and backend-systems from schema 16 to schema 18. Comparing every pre-existing column and row with the backups found no changes across frontend's 33 tables and backend's 32 tables. Both passed SQLite integrity and foreign-key checks. The frontend learner changes that predated implementation were preserved. No pending question or learner response was invented during migration.
