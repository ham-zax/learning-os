# Teacher quality evaluation pilot

This pilot checks the replaceable teacher layer separately from kernel lifecycle tests. All learner state it creates is synthetic and isolated in a temporary SQLite database. It never opens a managed profile. The evaluator checks durable actions mechanically; a reviewer still checks whether the learner-facing text actually teaches well.

## Episode scenarios

List cases:

```bash
npm run eval:teacher -- list
```

Prepare one case:

```bash
npm run eval:teacher -- prepare ambiguous_answer
```

The command prints a temporary directory, `tutor.db`, the goal/session IDs, and the learner's incoming message. Give a **fresh compatible teacher** the database path, then send `learnerMessage` as a separate chat message exactly as printed, without a label or added line breaks. This keeps the exact-response check meaningful. The teacher should follow `docs/teacher-agent-protocol.md` and use `createTeacherKernel(createDatabase(dbPath))` as its public execution boundary. The scenario is already partway through a durable episode; the teacher should call `getStudyContinuation(...)` before responding and should not read scenario source or expected checks during the run.

After the teacher responds and closes the database:

```bash
npm run eval:teacher -- inspect /path/printed/by/prepare
```

The report has automated checks and case-specific reviewer questions. Inspect the actual learner-facing message and tool/action order. A passing database report does **not** certify question neutrality, correct technical explanation, or that exposure was recorded immediately before it was shown. Record those judgments separately with short evidence from the run. Avoid scoring a teacher from its self-report alone.

The sixteen scenarios cover sufficient success, ambiguous wording, a causal misconception, an unclear blocker, question overload, a fresh-session answer, a changed-surface transfer answer, a direct answer request, and four calibrated backend predictions. The backend cases include a fully correct last-seat prediction, a serialized last-seat misconception, correct retry output with faulty reasoning, and an underspecified retry answer. They freeze a challenge from a Learning OS selected intent before the fresh teacher sees the response. The transfer scenario is a frozen changed-surface task; it does not itself test the selector's decision to request transfer. The `im_stuck` database checks only establish that no false evidence or exposure was recorded; a reviewer must judge the visible blocker question. Four `scaffold_*` scenarios cover revision friction after curated instruction: interruption after a recorded presentation, a completion exercise followed by return to the frozen question, a sufficient assisted answer, and a declined offer of further instruction. They need a human reviewer for the visible conversation; see [the revision-friction checklist](revision-friction-checklist.md). Add a case when live use shows a distinct repeated failure; do not turn every protocol sentence into a scenario.

The repository integration test separately exercises selected intent → calibrated authoring → freeze → presentation → database close/reopen → answer → deterministic verification → assessment → evidence. That test checks kernel continuity, not the judgment or wording of an independent model teacher.

## Assessor calibration

Print the answer set without gold labels:

```bash
npm run eval:teacher -- assessor-cases
```

Ask an assessor to return JSON in the printed `outputShape`, with one decision per case. Save that JSON outside the repository and score it:

```bash
npm run eval:teacher -- grade-assessments /path/to/decisions.json
```

The report shows exact result/criterion agreement and counts false `correct` grades. It intentionally leaves rationale quality, misconception coding, and the wording of a proposed clarification for human review. The cases include the original async question and calibrated concurrent-reservation and retry predictions. Each public case includes its code and frozen criteria without the answer key. In particular, a correct output with a false causal explanation should not become a wholly correct result.

This pilot is an evaluation aid, not learner evidence, a scheduler input, or a production model grader. Run it across fresh teacher implementations before treating its results as evidence of cross-teacher consistency.

The exact-response check diagnoses whether the teacher passed the incoming message unchanged. It runs only in this offline pilot; it is not a learner-facing confirmation step or a gate before feedback. For a complete pending answer, the public kernel supports one-call `submitAttempt(attemptId, { questionSeq: seq, responseText })`, which stores identical text in the question and attempt. Exact capture of raw web-chat message bytes still depends on what text the connected agent's bridge supplies to that call.

## Small dogfood measurement

After real learner episodes, read existing goal-local records without adding learner-state fields:

```bash
npm run eval:teacher -- metrics /path/to/tutor.db <goal-id>
```

The command opens the database read-only and prints counts of assessed/effective events, valid retrievals delayed at least seven days, correct changed-surface transfer events, evidence revisions, post-assessment exposures, answered reconstruction questions, and abandoned unsubmitted episodes. It prints no learner responses. Compare the same goal after later study sessions; keep the learner-facing interaction unchanged. These counts are observations, not a causal estimate of teaching quality or a claim that the learner is done. The repository has not run a longitudinal learner pilot merely because this report exists.

## Learning-outcome reporting

For a bounded pilot comparing teaching conditions on delayed, unassisted tasks, see [learning-outcome-pilot.md](learning-outcome-pilot.md). `npm run eval:teacher -- outcomes MANIFEST [AS_OF]` opens the listed databases read-only and reports baseline and delayed scores, assistance status, elapsed delay, recorded active time, and missing follow-ups. It reports descriptive change only; it performs no baseline adjustment and makes no causal claim.
