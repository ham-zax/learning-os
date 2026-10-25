# OpenCode DeepSeek harness probes

Date: 2026-10-25. Status: bounded experiment complete, no overall teaching gain established.

## Scope and method

The user requests teaching-harness improvement using OpenCode DeepSeek 4.1.
The live catalog provides `opencode2api/deepseek-v4.1-flash-free`.
All eleven T3 child tasks return that model, the OpenCode provider, and `variant: max`.
Ten tasks produce actual teaching replies. One supplies an independent fresh diagnosis.

Two synthetic ad-hoc cases cover closure bindings/copies and recursive return flow.
Each teacher gets the same case-specific prior context and learner message in a
fresh task. The teacher receives no evaluator rubric or expected answer. Tasks
share the current checkout and have a read-only assignment. No learner database
is prepared or intentionally opened. The coordinator makes no kernel or source
code changes during these trials. Existing mixed working-tree changes are preserved.

The parent reviews replies without blinding. Relevant claims receive small Node
counterexample checks. Available action traces identify instruction reads and
execution. They are not OS-level sandbox attestations. The closure baseline and
combined-candidate task messages match exactly. Source availability is shared,
but external concurrent source mutations are not independently audited.

The cases are development probes, not hidden holdouts or a complete teacher
benchmark. There are no real learner follow-ups, retention observations, or
statistical estimates of a model-wide failure rate.

## Observations

- Baseline: two replies. The closure mechanism is correct, but an optional
  shallow-copy claim lacks the nested-reference limit. The recursion reply
  provides a useful caller/return trace.
- Generic self-check advice: one reply. The teacher never demonstrably reads
  the changed reference. The reply cannot estimate that edit's effect.
- Comparison-format advice: one reply, followed by three replies with an
  explicit depth trigger. Closure contrasts improve in those observed outputs.
  Recursion replies introduce argument/return confusion, a flawed counting
  analogy, and an unqualified stack-trace claim. A consistent overall gain is
  not established. The format is not reliably followed either.
- Accuracy and analogy checks: three replies. One recursion reply executes a
  correct trace but says the addition line runs four times. Replay shows four
  calls and three additions. The second recursion reply avoids the identified
  errors. The closure reply then describes a copied value as a separate capture
  mode, obscuring that both examples still close over bindings.
- Fresh diagnosis: the reviewer identifies errors in supporting prose despite
  correct core traces. Parent replay confirms the default Node stack trace reports
  10 frames, not one entry for every paused call. The reviewer's suggestion that
  three clean samples would prove the cause is rejected as too strong.

Execution is useful evidence, but it does not automatically establish that the
surrounding prose agrees with the trace. An isolated improved reply is also not
evidence of reliable improvement across prompts.

## Decision and delivered change

Reject all three content-edit variants. Restore the exact baseline reasoning
playbook. Do not retain a speculative prompt change merely because it sounds useful.

Retain one routing clarification in AGENTS.md and the teacher skill: requested
mechanism depth explicitly triggers the existing reasoning playbook. That route
matches the reference's existing stated purpose. Later traces show reference
loading, but this small experiment does not prove a model-wide routing success rate.

The delivered routing-only combination is not independently rerun after the
playbook restoration. Its relative links and instruction consistency pass static
checks. Do not label the delivered combination a benchmark winner.

The repository test suite passes 283 tests across 33 files during the experiment.
Type checking passes. Final link, exact-restoration, and whitespace checks pass.
These software checks do not establish teaching effectiveness. No commit is made
from the mixed working tree, and the pre-existing index remains intact.

## Artifacts and retrospective

Raw synthetic replies, instruction snapshots/hashes, trace excerpts, and a
nonblind closure comparison receipt remain outside Git at
`/tmp/learning-os-deepseek41-qy9yjkm8`. T3 child results also retain the replies.
Client IDs and the chronological record appear in the
[experiment plan](../agent-plans/2026-10-25-deepseek-teaching-harness.md).
The earlier favorable closure comparison concerns a rejected intermediate
candidate and must not be reused as validation of the delivered instructions.

Two failures cost time: an edited reference was never loaded, and correct code
output hid false supporting prose. Proposed evaluation improvements now appear in
[future improvements](../future-improvements.md). They are proposals, not implemented
capabilities or authorization for another experiment.
