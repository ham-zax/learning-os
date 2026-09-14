# Adaptive feedback and effort control

Status: implementation contract for the current teacher boundary.

Learning OS already owns assessment, repair obligations, challenge selection and
FSRS scheduling. The missing connection is a small, usable view of the current
answer and explicit effort preferences that survive a fresh teacher connection.

## Answer depth and feedback

`getSessionFeedback(sessionId)` is a read-only view of the active attempt, its
effective assessment and frozen criteria. Study continuation includes this view.
It does not introduce another learner model or classify free text.

- Before assessment, the teacher checks whether the answer is sufficient to
  grade. Ambiguous wording gets one neutral clarification of the same criterion,
  saved through the existing subquestion operations. No failure, hint or exposure
  is inferred from ambiguity alone. A clarification that teaches is recorded as
  assistance before it is shown.
- After assessment, the view names the met, unmet and unassessed criteria, the
  evaluator's rationale, and whether the evidence was valid retrieval. A fully
  correct answer calls for specific feedback and closing the current feedback
  step, without another question. This can close the episode or uncover other
  unresolved work in the same session; it does not claim whole-concept mastery.
- A partial/incorrect assessment calls for review of the particular gap. The
  teacher distinguishes a slip from a demonstrated causal misconception. Only
  the latter requires focused teaching and reconstruction, recorded before
  disclosure with the existing exposure operation. An ungradable response is
  assessment uncertainty, not proof of a misconception.
- A persisted reconstruction obligation takes priority. Reconstruction remains
  assisted learning, creates no additional evidence and cannot extend FSRS
  intervals. Use the saved atomic question rather than replaying the whole task.
- Revised or invalidated evidence is reflected immediately in the view.

Feedback should state what this answer demonstrated, the particular gap (if any),
and the reason for any further question. Private criterion descriptions are
teacher context, not content to reveal before the learner has answered.

## Effort control

The profile preference `practicalWork` is `ask_first` (default) or
`conversation_only`. A nullable session override has the same values: null
inherits the profile. Only an explicit lasting preference changes the profile;
“this episode” belongs to the session. A read-only planning override covers a
choice made before a session exists; carry it into the session when starting.

`ask_first` is not blanket consent. Creating/editing a scratchpad, running learner
code, or assigning implementation starts only after the learner adopts that work
(including an explicit request or existing authorization). A generic “continue”
does not reverse a decline. A later explicit change of mind can change the
session override. Conversation-only planning defers implementation objectives
without changing their goal requirements, evidence, due dates or readiness.
Execution-required challenges also cannot open in a conversation-only session.
Reading code and reasoning about it conversationally remain supported.

Declining already-open practical work uses the existing unsubmitted-session
abandonment path, without a fabricated failed answer. Pending reconstruction is
still conversational unless the learner explicitly opts out of that obligation.

## Transfer and retention

No new queue or scheduler is introduced. With prior attempt history, an unresolved
failure or active weakness now requests a variant for the next selected check,
even when only one task form is available. This closes the repeat-the-same-trace
gap without prematurely declaring the next check to be transfer. The goal selector chooses
transfer only when its prerequisites and goal requirements allow it. Its
`requiresChangedSurface` and `avoidRecentChallenges` fields constrain authoring.
For example, an async ordering repair can later be checked through competing
search responses, if that assesses the selected objective. Merely renaming log
labels does not establish transfer. Delayed retrieval is selected when the
existing FSRS card becomes due; neither immediate reconstruction nor a promise
to revisit something counts as retained knowledge.

## Verification boundary

Executable synthetic scenarios cover sufficient answers, neutral clarification,
repair/reconstruction, evidence corrections, session restart, practical-work
decline and changed-surface/due selection. They use disposable databases and the
public teacher boundary, never canonical learner responses as test fixtures.

These tests verify state transitions and the information given to a teacher.
They cannot establish that an arbitrary external model asks a good clarification
or teaches concisely. The teacher protocol and portable Skill define those
semantic obligations; live connected-session probes must assess actual wording.

Implementation checks (2026-09-14): the full suite passes 66 tests across 13 files,
including [feedback/clarification/repair scenarios](../tests/adaptive-feedback.test.ts),
[effort and reconnection scenarios](../tests/effort-choice.test.ts), and
[repair-to-transfer-to-retention](../tests/transfer-retention.test.ts). Source and
test typechecking and the production build pass. These are deterministic kernel
scenarios with synthetic answers, not evaluations of a live ChatGPT teacher.

The canonical frontend and backend-systems upgrades preserved all existing values
across 32 tables per profile, including session pointers, questions, responses,
exposures, evidence and review cards. Both match the fresh baseline schema and
pass SQLite integrity and foreign-key checks. Frontend session 1 still requires
its saved reconstruction; backend session 8 still awaits its response.

## Schema v22 to v23

The runtime still opens one current baseline schema. This change adds two effort
fields and drops no data. Existing profile rows receive `ask_first`; existing
sessions receive null (inheritance), without inventing a learner preference.

For an independently maintained v22 profile, stop its writers and take a SQLite
backup before applying this explicit conversion in one transaction:

```sql
BEGIN IMMEDIATE;
ALTER TABLE sessions ADD COLUMN practical_work TEXT
  CHECK (practical_work IN ('ask_first', 'conversation_only'));
ALTER TABLE interaction_preferences ADD COLUMN practical_work TEXT NOT NULL DEFAULT 'ask_first'
  CHECK (practical_work IN ('ask_first', 'conversation_only'));
PRAGMA user_version = 23;
COMMIT;
```

Verify the starting `user_version` is exactly 22 before running it. Check every
pre-existing column/row against the backup, `integrity_check`, `foreign_key_check`
and schema parity with a fresh v23 database. Checkpoint the managed profile before
committing its canonical database. Do not run this against another version or
replace a learner's database with a different profile's copy.
