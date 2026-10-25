# Teaching quality harness repair

## Mission and baseline

Improve teacher instructions and evaluation after checking the supplied handoff.
Teaching quality is the objective. Tool counts and token use are descriptive costs.
Baseline: HEAD `0ccffc2`, with existing staged edits in the teacher skill, kernel
questions, subquestion tests, and package lock. Preserve those edits and the index.

The read-set includes AGENTS.md, the teacher skill, the canonical teacher protocol,
its portable reference, research and reasoning references, the evidence model,
ad-hoc scenarios, assessment calibration, evaluator CLI, and evaluation tests/docs.

## Demonstrated defects

- The skill invalidates all criteria for any causal misconception. The calibration
  case `right_order_wrong_model` instead preserves the correct output criterion.
- Entry instructions ban research tools even when current technical facts matter.
  The canonical protocol requires proportionate primary-source research.
- Always-on instructions prescribe graph/payment examples and word ranges across topics.
- Skill reference routing excludes teaching guidance for workflows already in its table.
- Existing reply inspection supplies a rubric but no controlled comparison receipt.

## Changes and checks

1. Repair entry routing and criterion-based assessment. Preserve atomic commands,
   learner response identity, exposure timing, reconstruction, and learner consent.
2. Add diverse ad-hoc probes. Keep reviewer criteria out of exported teacher prompts.
3. Add an offline comparison of evidence-backed reviewer judgments. Require matched
   conditions and separate teaching judgments, integrity checks, and operating costs.
   Missing evidence stays unresolved. No model-family grades or automatic promotion.
4. Run evaluator tests, the repository test suite, type checking, and diff checks.

Architecture review: no kernel, database, scheduling, or evidence schema changes.
The CLI adds an evaluation-only command. TDD route: off. Tests check the new
comparison contract, not the wording of teaching instructions.

Finish when these repairs and checks are complete. Fresh-model teaching quality,
unseen-case generalization, and delayed learning remain empirical questions.
Do not claim the handoff's tool savings, table superiority, or model rankings as facts.

## Results

- The evaluator now exposes nine public ad-hoc development probes and an offline
  paired-review comparison. Neither feature automatically scores teaching quality.
- All 283 tests across 33 files passed. Type checking and whitespace checks passed.
- Two fresh Claive/Codex sessions used `gpt-6.1-sol`, medium effort, read-only mode,
  the same four public assessment cases, and separate frozen instruction snapshots.
  No expected decisions were supplied. No database or learner-code execution was
  permitted. The staged skill at task entry supplied the baseline snapshot.
- The baseline passed 3/4 selected calibration cases. It marked every criterion
  wrong in `right_order_wrong_model`. The candidate passed 4/4 and retained the
  correct output criterion while rejecting the false causal explanation.
- The cases were `complete_causal_answer`, `right_order_wrong_model`,
  `whole_call_deferred`, and `ambiguous_later`. The existing calibration scorer
  checked decisions mechanically. Full calibration exit status was 1 for both
  submissions because the other calibration cases were deliberately absent.
- Worker IDs: baseline `9efc08b29d48`, candidate `8508a89c852e`. Local snapshots,
  actual decisions, metadata and the selected-case summary remain outside Git at
  `/tmp/learning-os-quality-probe-wrmn7tbe`. Workers completed without file edits.

This is one sample per variant and an assessment-policy application probe, not
a learner-facing teaching trial. It covers neither general teaching quality,
instruction discovery, reference loading, nor delayed learning. The four new
teaching probes remain unrun. No numerical teaching improvement is established.
Existing staged changes remain in the index. No commit is made from this mixed
working tree.

## Later integration audit

The user subsequently authorizes final review, commit, and push to origin/main.
That authorization supersedes the earlier instruction to leave this work uncommitted.
Review includes the pre-existing staged kernel and lockfile changes.

The integration audit finds an untested frozen-context lookup querying a nonexistent
`challenges` table instead of `challenge_versions`. It also finds default-question
scope metadata being silently dropped, invalid context types being silently
inherited, and literal `null` text losing its meaning. The parent corrects these
boundaries, rejects null chunking, adds failure-rollback and inheritance coverage,
and synchronizes the public kernel contract. This later audit is distinct from
the instruction-only experiments described above.

Fresh checks: 64 focused tests and all 295 repository tests pass. Type checking,
build, package privacy (614 files), installed dependency consistency, 28 relative
document links, and whitespace checks pass. A fetch shows no divergence between
main and origin/main before the final commit. No managed learner state is changed.

Independent Codex review uses `gpt-6.1-sol`, xhigh reasoning, default service tier.
Client ID: `los-final-code-review-20261025-1`. The completed review reports no
material findings or blocking issues across the staged, unstaged, and ten new
files. The reviewer changes no files and leaves runtime checks with the parent.
Proceed with the authorized commit and push to origin/main. Do not force-push.
