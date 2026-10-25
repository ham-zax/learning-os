# DeepSeek teaching harness experiment

## Scope and baseline

The user requests harness improvement using OpenCode DeepSeek 4.1.
The live OpenCode and T3 catalogs expose `opencode2api/deepseek-v4.1-flash-free`.
Use the OpenCode provider with `variant: max` for all teacher trials.
Preserve the existing mixed working tree and index. Do not modify learner databases.

Teaching accuracy, causal clarity, adaptation, learner agency, and honest
assessment govern decisions. Tool counts and response length are descriptive only.
Do not impose a model-dependent grade or infer retention from generated lessons.

Baseline instruction snapshots and hashes live outside Git at
`/tmp/learning-os-deepseek41-qy9yjkm8`. The baseline is the repaired working tree,
not HEAD. Fresh T3 child tasks share the current checkout. Do not edit instructions
while a baseline child can still read them. Children receive synthetic prior context
and the learner's actual request, without evaluator rubrics or expected replies.

## Experiment sequence

1. Observe fresh DeepSeek teacher replies under the repaired harness.
2. Identify a specific teaching gap from actual replies or action traces.
3. Propose one focused change at its instruction owner. Preserve evidence and
   exposure rules, learner consent, and successful teaching behavior.
4. Probe with the same model/options and scenarios in fresh sessions. Compare
   evidence for each quality dimension. Repeat the target case to check variation.
5. Check a different topic or request as a transfer/regression probe. Public cases
   and editor-authored cases are development evidence, not blinded holdouts.
6. Retain only supported changes. Record negative or inconclusive results.
   After two attempts without measured gain, stop and diagnose the bottleneck.

The parent reviews actual replies and checks executable examples where relevant.
No automatic model judge can establish human learning. Any source/configuration
change requires the repository's appropriate checks. Documentation-only repairs
need link and whitespace checks, plus observed behavioral probes for skill changes.

## Current checkpoint

- Baseline closure lesson: task client ID
  `los-ds41-baseline-depth-20261025-1`, OpenCode DeepSeek, maximum variant.
- Model and returned options match the requested selection.
- Baseline closure reply explains the shared binding and copied primitive correctly.
  Its unrequested object appendix states that mutation of an original object does
  not change a spread copy, without limiting the claim to the flat example.
  A Node counterexample shows a shared nested object changing through both copies.
  Another check shows spread omits non-enumerable own properties. Neither issue
  invalidates the correct central closure explanation.
- Baseline recursion reply explains waiting frames and traces returns as 0, 1, 3,
  and 6. Preserve this concrete teaching and the explanation-first boundary.
  Task client ID: `los-ds41-baseline-recursion-20261025-1`.
- The baseline closure action trace shows the teacher reading the actual skill
  and playbook. The playbook is therefore a demonstrated instruction owner.
- Candidate 1 adds comparison, scope, and claim-boundary guidance to the playbook's
  invocation section. It names no JavaScript-specific answer or benchmark case.
  No always-on instruction, kernel, evaluator, or learner-state contract changes.
- Candidate 1 failed. Its closure lesson added factory, browser, delayed snapshot,
  object aliasing, loop, and universal debugging sections. It concluded that
  different callback observations imply different captured slots. A Node example
  shows callbacks observing the same binding at different times. Core closure
  mechanics stayed useful, but precision and scope did not improve. Reject it.
- Candidate 2 replaces the vague advice with a triggered explanation structure
  for learners who know definitions and ask why two cases differ: one paired
  example, a causal trace, and a bounded rule. Broad lessons remain unconstrained.
- Next: probe candidate 2 before any retention claim. If the second attempt has
  no measured gain, stop and seek a fresh diagnosis under the repository policy.

### Provenance correction

Inspection of Candidate 1's complete T3 activity shows no tool reads. The teacher
did not demonstrably load the edited reference. Its poor reply is evidence of
the teacher's behavior, not a causal estimate of Candidate 1's instruction edit.
The earlier "failed" label means the attempted workflow did not improve the
observed reply. Do not interpret it as evidence that the reference wording caused
the reply. Entry triggers mention broad lessons and persistent confusion, while
this scenario requests depth on a narrow distinction. Investigate that route
before further wording changes. Candidate 2 is already running against its frozen
snapshot. Do not edit entry instructions while that trial can still read them.

### Candidate 2 observation and route closure

The completed Candidate 2 trace shows the teacher reading the changed playbook,
reading local closure material, and executing its example. The reply places live
and copied readings in one counter example with a stepwise value trace. Its object
alias example distinguishes property mutation from rebinding and makes no shallow
spread independence claim. It does not conclude that callback disagreement proves
different captured slots. These are observed improvements in one trial, not a
population estimate. Additional parameter/reference examples remain a scope concern.

The initial failed instruction-discovery trial also demonstrates a route gap.
AGENTS.md and the skill now name requested mechanism depth as an explicit playbook
trigger, matching the reference's existing purpose. This is part of the same
instruction ownership boundary. Repeat and regression trials use this final
combined candidate. Treat those separately from the playbook-only trial.

Final combined instruction snapshots live under the local experiment's `final/`
directory. Closure repeat client ID: `los-ds41-final-depth-repeat-20261025-1`.
The user asks whether the workflow is edit → OpenCode/DeepSeek trial → inspect →
edit. Confirm that workflow while preserving the active experiment. Teaching
quality remains the objective. The next substantive step is the recursion
regression trial after inspecting the closure repeat. No final retention claim yet.

### Combined candidate: repeat and regression observations

The final closure repeat reads the actual skill and updated playbook. It correctly
traces a live binding and a copied primitive, states that callback order still
matters, and distinguishes object alias mutation from rebinding. The earlier
unsupported shallow-spread and exclusive-diagnosis claims do not recur. The reply
still adds parameter and reference variants, so the one-pair scope rule is not
consistently followed. Do not claim that the edit solves scope expansion.

The final recursion reply retains the correct 0 → 1 → 3 → 6 return trace and does
not impose a prediction quiz. Its sentence that the recursive call "never computes
the total" can obscure that each callee computes a smaller total. Mark that wording
unresolved rather than automatically attributing it to the changed harness.
Repeat the unchanged recursion prompt before claiming preservation broadly.

Client IDs: `los-ds41-final-recursion-20261025-1` and
`los-ds41-final-recursion-repeat-20261025-1`.
The full repository suite passes 283 tests across 33 files, and type checking
passes. Those checks establish software contracts, not teaching effectiveness.

The recursion repeat again preserves the numerical trace, but adds a flawed
five-person analogy. Person 1 receives 3 from person 2 and adds one for person 2.
The reply instead says person 1 hears 4 and person 4 adds one for themselves.
Correct arithmetic alone therefore cannot establish a sound explanation.

Two output-guidance attempts do not establish a reliable overall gain. Stop
editing. Apply the critical-thinking diagnostic route and request one fresh
diagnosis from the original quality goal and raw snapshots/replies, excluding
the coordinator's theory and conclusions. Keep the current candidate provisional.

Fresh diagnosis client ID: `los-ds41-fresh-quality-diagnosis-20261025-1`.
It uses the requested OpenCode model at maximum variant. Its brief contains the
original goal, raw before/after replies, and instruction snapshots, not this plan
or the coordinator's proposed causal explanation. Wait for that result before
another source/instruction edit.

An actual paired depth-review receipt and comparison report live in the local
experiment directory. Exact T3 teacher prompts match. The reviewer is the parent,
not blinded. Accuracy improves on that pair, while scope adaptation remains a
concern. The recursion concern prevents treating that report as an overall win.
The input explicitly discloses that external concurrent source changes were not
independently audited. Costs remain descriptive and never determine the result.

### Fresh diagnosis and accuracy-focused candidate

The fresh reviewer finds unsupported supporting detail rather than missing core
mechanism knowledge. It identifies argument/return confusion, an analogy whose
arithmetic differs, and an incorrect claim that a default stack trace lists every
paused frame. Parent replay confirms Node's default trace limit is 10 and the
observed trace reports 10 `sum` frames. The reviewer correctly treats learner
impact and the instruction change's marginal effect as unmeasured.

Reject the reviewer's implication that three clean samples would prove a missing
check or that one failure proves an inability to use analogies. Small samples
cannot establish either conclusion. Use repeated samples as bounded evidence only.

Remove the unproven comparison-format candidate. Keep the explicit depth trigger.
The accuracy-focused candidate instead strengthens the existing analogy owner:
trace one input and its operations through both examples, disclose differences,
and use the actual example if a valid mapping is unavailable. A short invocation
check distinguishes arguments, return values, operations, and limited runtime
observations. No case-specific answer, recursion-only prohibition, word quota,
external reviewer requirement, or evidence contract change is introduced.

Run two unchanged recursion trials and one unchanged closure trial. Stop this
bounded experiment after inspecting those replies. Retain only a supported local
instruction improvement, or restore the baseline prose if no gain is supported.

Accuracy trial 1 reads the changed reference and executes an instrumented trace,
but its prose says the recursive addition line executes four times. Parent replay
shows four calls and three additions. Execution alone does not prevent a prose
contradiction. Do not claim that this edit eliminates the failure class.

Accuracy trial 2 preserves the direction of arguments and return values and uses
the correct 0, 1, 3, 6 trace. It avoids the flawed analogy and unqualified stack
trace claim. A closure trial remains as the final preservation check.
Client IDs: `los-ds41-accuracy-recursion-20261025-1`,
`los-ds41-accuracy-recursion-20261025-2`, and
`los-ds41-accuracy-depth-20261025-1`.

## Final disposition

The final closure reply blurs copied values and captured bindings. The three
content-edit variants do not establish a reliable overall gain. Reject them and
restore the reasoning playbook exactly to its experiment baseline. Retain only
the explicit requested-depth trigger in AGENTS.md and the skill. That routing-only
combination receives static checks, not another teacher trial. No instruction
variant is promoted as a benchmark winner.

The bounded experiment is complete after ten teaching trials and one fresh
diagnosis. The [result report](../research/2026-10-25-deepseek-harness-probes.md)
supersedes provisional positive interpretations above. It records retained and
rejected changes, evidence limits, actual checks, and the short retrospective.
