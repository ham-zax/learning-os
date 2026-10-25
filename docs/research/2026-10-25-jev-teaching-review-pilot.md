# Jev review pilot: ad-hoc teaching and tracked workflow

Date: 2026-10-25. Status: completed bounded development pilot.

## Decision

Keep Jev advisory and on request. The tested reviewer can identify some learner-
context and tracked-workflow defects, but it misses a technical explanation defect.
Do not use a clean Jev judgment as a factual certificate, assessment authority,
state-mutation permission, or delivery gate. No automatic reviewer is enabled.

For tracked review, supply actual applicable instruction excerpts, the frozen task
and criteria, relevant public state, and ordered action evidence. This was already
the documented input contract. Correcting the experiment's summaries to source
excerpts removes a false alarm on the tested correct completion.

## Method and ground truth

The user authorizes external review of synthetic material in both teaching routes.
The existing unmodified `reviewTeacherReply` and `reviewTeacherSession` functions
send native TypeSafe requests. All 32 requests return `jev-1.14.0` and complete all
three judgments. Each request retains the existing 15-second deadline and no-retry
policy. Calls are sequential. Keys come from the environment and are not logged.

There are ten distinct cases, each initially reviewed twice in a fixed shuffled
order. Neutral case IDs and payloads omit expected labels, source filenames, and
sound/flawed variant names. The primary checks are `support` for ad-hoc replies
and `workflow` for tracked sessions. Labels freeze before the first request.

The coordinator supplies labels. They use executed code facts, actual synthetic
conversation premises, and independent public-kernel/evaluator evidence. These
are hand-picked development examples, not blind human annotations or a population
sample. Repeated requests measure repeat agreement only, not independent coverage.

Four ad-hoc inputs contain actual prior synthetic DeepSeek replies:

- A correct recursion explanation and one with argument/return confusion and an
  unqualified claim about stack-trace coverage.
- A local stepwise repair using established premises and one that attributes trust
  in a later result to the learner without conversational support.

Six tracked inputs are deliberately scripted replays, not autonomous teacher runs.
Each uses a separate disposable database and public teacher-kernel methods:

- Correct frozen prediction, actual deterministic verification, verbatim submission,
  assessment, and atomic completion versus an otherwise matching unclosed episode
  that the transcript claims is complete.
- Exposure recorded before versus after a scripted presentation event.
- Neutral clarification of an ambiguous referent versus a premature incorrect
  assessment that invents a wrong causal model.

The first completion has `feedbackClosed: true`, phase `complete`, pending action
`none`, and four passing evaluator checks. Its defective counterpart remains in
phase `feedback` with pending action `present_feedback`. The ambiguity controls
also have independently inspectable state differences. Both exposure-order cases
end with passing database checks. Their ordering distinction comes from the actual
replay event log, not final database state. Presentation events are transcript-sink
emissions, not claims that a real person saw a UI.

## Initial results

All primary labels repeat identically across the two calls per case.

- Ad-hoc: detects one of two distinct defects. It catches invented learner knowledge,
  but misses the argument/return and stack-trace problems. Both sound controls
  receive no primary concern. No other check flags the missed technical case.
- Tracked with instruction summaries: detects all three distinct defects, but
  flags one of three sound controls. The false alarm concerns the correct calibrated
  completion. It flags both workflow and pedagogy on that case.
- No request fails, times out, or returns an incomplete review. No primary judgment
  abstains. Deliberately missing-evidence cases are not tested, so appropriate
  uncertainty handling remains unmeasured.

These are primary-label results. The other two judgments are retained in raw
reports and are not additional independent accuracy samples. Confidence is model-
reported metadata. No confidence threshold is tuned or used to hide errors.

## Input-contract correction

The initial tracked payloads paraphrase workflow rules. The review documentation
requires actual applicable source excerpts. After observing the initial results,
the coordinator replaces those summaries with 6,262 characters of verbatim
instruction excerpts. Labels, action evidence, context, and native reviewer
questions remain unchanged. The six tracked cases receive two more reviews each.

With source excerpts, all three distinct tracked defects receive a concern and all
three sound controls receive no concern, in both repetitions. The earlier false
alarm disappears. All three judgments agree with those primary results. This
follow-up corrects an input-contract omission. It is not independent held-out
validation, and it does not establish the cause of the model's earlier concern.
The adapter returns judgments, not explanations, so no rationale is invented.

## Measured latency and cost limits

- Initial 20 calls: median 160 ms, nearest-rank empirical p95 283 ms, maximum 1,729 ms.
- Source-excerpt tracked 12 calls: median 192 ms, nearest-rank empirical p95 and
  maximum 6,816 ms. With only twelve calls, that p95 is simply the maximum.
- Zero request failures across 32 calls. This does not establish a production SLA.

Times cover the reviewer function, including network and response processing.
They exclude teaching, corpus preparation, source inspection, and human review.
Provider timing, load, and connection warming are not controlled. Do not attribute
the latency difference solely to excerpt size or claim an end-to-end speedup.

The existing adapter exposes no billed token usage. Reasoning-agent usage and
effective subscription cost are also unavailable. No dollar cost or overall token
saving is claimed. There is no user learning, retention, or revision-outcome measure.

## Practical use

Use the existing optional review commands when a learner requests them. In ad-hoc
teaching, Jev can offer a second check on supplied learner context and request fit.
Technical claims still need source evidence, execution where relevant, and teacher
reasoning. In tracked work, provide actual current rules and ordered actions.
The kernel remains authoritative for evidence and lifecycle state. A model's
judgment cannot replace deterministic state checks or repair a past exposure order.

The corrected tracked smoke results justify this limited advisory use. They do
not justify mandatory reviews, automatic grading, or general factual approval.
No production reviewer code, teacher policy, profile, or managed learner database
changes are introduced. Only experiment documentation changes in the repository.

## Artifacts and retrospective

Raw inputs, frozen labels, hashes, replay scripts, six disposable databases,
actual events, database inspections, and all reviewer outputs remain outside Git at
`/tmp/learning-os-jev-pilot-ia8mwh8p`.
Initial summaries are in `pilot-report.json`. Corrected results are in
`source-report.json`. The [plan](../agent-plans/2026-10-25-jev-teaching-review-pilot.md)
records the input-contract correction and stopping rule.

The main avoidable cost was paraphrasing required source instructions. A future
review-input builder could attach source excerpts and provenance mechanically.
That is a proposal in future improvements, not an implemented guarantee. The
missed technical defect also shows why repeat stability is not correctness.
