# Recover stepwise teaching from history

## Mission and evidence

The user asks for renewed teaching improvement through historical inspection,
critical thinking, and lateral thinking. Preserve the existing checkout and index.
No learner-state or kernel mutation is authorized by this teaching experiment.

Historical source evidence:

- `25786a7`: pre-shortening teacher skill, 8,469 words in the inspected snapshot.
- `a3232f1`: progressive instruction routing, October 24.
- `07133f3`: explicit stepwise-construction feature, October 24. The skill directly
  routes adopted first-principles builds to that method. Its skill has 1,598 words.
- `0ccffc2`: October 25 atomic-feedback feature plus an action-table rewrite.
  The rewrite removes that explicit stepwise entry route. The reference body survives.
- Current skill at this task's start: 1,658 words. Word count does not establish
  quality. The demonstrated difference is routing and teaching-mode selection.

Snapshots live outside Git at `/tmp/learning-os-stepwise-tw34mm91`.

## Critical reasoning

H1: the teaching method was deleted. Falsified: the stepwise reference remains.
H2: its explicit activation route was lost. Supported by the historical skill diff.
H3: the previous evaluation was too narrow to assess interactive teaching.
Supported: its ten teaching trials contain no actual learner follow-up sequence.
None of these findings establishes that the old version is universally better.

## Lateral exploration

The earlier approach was a way to obtain accurate, useful teaching. Alternatives:

- Restore explicit teaching-mode selection and its on-demand procedures.
- Evaluate an actual conversational sequence, including a learner misconception
  and a later preference change, instead of judging only standalone explanations.
- Supply checked execution evidence. Earlier trials show that correct execution
  alone does not guarantee accurate surrounding prose.
- Add a separate reviewer. Existing optional review remains consent-bound and is
  not made mandatory for ordinary lessons.

Select the first two for a bounded experiment. A wholesale historical restore
would also restore stale kernel procedures and is not justified.

## Probe and mutation boundary

First observe current DeepSeek on an explicitly adopted stepwise build. Resume
with a learner answer to its actual question. Then restore the missing explicit
route and procedure details only where the evidence supports them. Preserve
explanation-only/no-quiz requests and existing tracked exposure obligations.

Use OpenCode `opencode2api/deepseek-v4.1-flash-free`, `variant: max`, in fresh
tasks with actual prior conversational text. Initial before/after prompts match.
Later synthetic learner turns respond to the question actually asked, so those
trajectories are not identical-prompt causal comparisons or human-learning proof.
Keep reviewer criteria and historical conclusions out of teacher prompts.

Success means observed mode selection, use of the learner's stated reason,
bounded repair, and respect for a switch to explanation-only. Do not claim mastery
or retention. Keep modern atomic kernel procedures. Check links, affected source
contracts if any, and actual teaching behavior. No source test changes are planned.

## Current checkpoint

The baseline teaches the first return completely and asks for `sum(2)` next.
It supports the core mechanism, but does not elicit the first missing inference
as the historical stepwise method specifies. A follow-up now supplies an actual
wrong reason about the caller returning its child's value unchanged.

Client IDs: `los-stepwise-baseline-entry-20261025-1` and
`los-stepwise-baseline-repair-20261025-1`.

Baseline action evidence shows the teacher did find and read the stepwise section.
Therefore the missing entry route is not sufficient to explain the observed reply.
The method's operational boundary also needs checking: the baseline supplies the
first inference, then its repair says a returned value does not replace the whole
child call, when it does replace that child-call expression inside the caller.

Candidate: restore an explicit early ad-hoc interaction route, broaden the adopted
stepwise method to a focused relation, and distinguish supplied premises from the
target inference. Feedback uses the learner's actual reason and names participants,
exchanged values/actions, and the pending operation in the same local example.
Preserve the explicit switch to explanation-only, ordinary optional questions,
all tracked actions, exposure semantics, kernel contracts, and learner state.

Change necessity: docs/instructions only. No architecture or persistence change.
The new route and method are one instruction ownership boundary. Do not restore
historical kernel signatures or introduce a second durable lesson state.

Candidate entry observation: the teacher gives caller/return premises and asks
the learner for `sum(1)`'s addition and return value without giving that result.
The matched baseline already gave `sum(1) = 1` and moved to `sum(2)`. This supports
better execution of the adopted inference-before-reveal method in one initial turn.
The candidate action trace shows direct skill and stepwise-reference reads.

The next synthetic learner answer responds to the question actually asked:
`It returns 0 unchanged, because sum(0) already did the calculation.`
The baseline's corresponding wrong reason concerned `sum(2)` returning 1 unchanged.
Do not score these different follow-up messages as an identical-input A/B pair.
Client IDs: `los-stepwise-candidate-entry-20261025-1` and
`los-stepwise-candidate-repair-20261025-1`.

The candidate repair correctly separates the child's returned 0 from the caller's
pending addition. It then assumes the learner already trusts the later result 6,
which the supplied conversation never establishes. This improves role precision
but still exposes later steps and invents learner knowledge.

Refinement: repair from established premises only. Do not attribute an unexplained
later result to the learner or reveal the remaining path to justify the current
step. Repeat the identical current learner turn with the same actual prior reply.
An unrelated punctuation repair splits one semicolon into two sentences in the
skill's route paragraph. It changes no teaching condition or action.

The refined repair uses the child's returned value as one operand in the caller's
pending addition. It avoids the previously invented known result 6 and leaves an
application of the same caller-work relation open at `sum(2)`. Its numeric trace is
correct. This is a matched current-turn improvement over the earlier candidate,
using the same actual previous teacher reply and learner message.

Continue the actual trajectory with a sufficient `sum(2)` answer plus a request
for direct explanation and no more questions. Then test adopted stepwise teaching
on an algebra relation. No further instruction edits are planned during those runs.
Client IDs: `los-stepwise-refined-repair-20261025-1` and
`los-stepwise-candidate-optout-20261025-1`.

The explanation-only switch succeeds in the observed trajectory. The teacher
acknowledges the sufficient `sum(2)` answer, explains `sum(3) = 3 + 3 = 6`, and asks
no further question. It neither restarts the lesson nor creates learner evidence.

Final development transfer probe: adopted stepwise derivation of the sign rule
using given distribution, zero/one multiplication, and additive cancellation.
Reviewer checks fixed before the reply: use supplied prior knowledge, ask one
relevant inference without giving its answer, keep algebra sound, and invent no
mastery or learner state. This is a different topic, not a secret held-out case.
Client ID: `los-stepwise-candidate-algebra-20261025-1`.

## Final disposition

Retain the recovered interaction route and refined stepwise procedure. The algebra
probe asks for the next distributive inference without supplying its answer. The
refined recursion sequence repairs the local wrong relation and respects the
subsequent explanation-only request. These are bounded observed improvements,
not evidence of general factual reliability or human learning gains.

Seven teacher tasks complete. All 283 tests and type checking pass. Document links,
the stepwise anchor, and whitespace checks pass. The canonical protocol's stale
skill-section description now names the early interaction route. No kernel,
schema, source-test, or learner-state changes occur in this task. The mixed index
remains intact, and no commit is made.

The [result report](../research/2026-10-25-recovered-stepwise-teaching.md) records the
delivered changes, actual observations, synthetic-trajectory limits, and short
retrospective. It supersedes provisional interpretations above.
