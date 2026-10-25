# Recovered stepwise teaching: historical audit and probes

Status: retained bounded instruction improvement. Date: 2026-10-25.

## What history shows

The user recalls a step-related teaching feature before recent harness changes.
Commit `07133f3`, dated October 24, adds **Stepwise construction** and a direct
teacher-skill route for an adopted first-principles build. The earlier shortening
commit is `a3232f1`. Today's `0ccffc2` combines atomic kernel feedback features
with an action-table rewrite that removes the explicit stepwise entry route.
The teaching method survives in the reference. It was not deleted outright.

The inspected pre-shortening skill has 8,469 words. The stepwise-feature version
has 1,598. The current task baseline has 1,658. These counts do not establish
teaching quality. The important historical difference is explicit interaction
selection and inference-before-reveal, not document length.

The earlier unsuccessful experiment examined standalone explanations without
actual learner follow-up sequences. It cannot establish that all teaching
capabilities are unimprovable or that instruction shortening caused its errors.

## Reasoning and delivered change

Critical analysis distinguishes a deleted method, a lost route, and an evaluation
that misses interactive behavior. Source inspection rejects the first explanation
and supports the latter two. The baseline teacher nevertheless finds the existing
reference, so a route-only repair is insufficient for the observed behavior.

The lateral-thinking concept fan moves from "add accuracy reminders" to alternative
ways to improve teaching: recover interaction selection, evaluate real conversational
trajectories, supply execution evidence, or add a reviewer. This work chooses the
first two. It preserves current atomic kernel procedures and introduces no mandatory
external reviewer, second lesson database, or automatic learner-state mutation.

The retained instruction changes:

- Put ad-hoc interaction choice before the tracked command table.
- Route an explicitly adopted stepwise build directly to its existing procedure.
- Apply that procedure to a focused relation as well as a full conceptual build.
- Separate supplied premises from the inference the learner will make.
- Repair the stated wrong relation using local participants, values, and pending work.
- Use established premises. Do not invent a learner-known later result or reveal
  the rest of the path to justify the current step.
- End guided questioning when the learner requests direct explanation.

The canonical protocol's stale reference to a removed skill section now names the
actual early interaction route. Ordinary explanations remain question-optional.
Tracked exposure, grading, reconstruction, and evidence contracts remain authoritative.

## Seven actual DeepSeek probes

All seven T3 teacher tasks use OpenCode `opencode2api/deepseek-v4.1-flash-free`
with returned `variant: max`. They receive synthetic learner turns without reviewer
rubrics. They have read-only assignments and no learner database is prepared.

1. **Baseline entry.** The learner requests a stepwise return-path build. The teacher
   supplies `sum(1) = 1`, then asks for `sum(2)`. It reads the existing stepwise section.
2. **Baseline wrong-reason follow-up.** The learner says `sum(2)` returns its child's
   1 unchanged. The teacher confuses replacing the child-call expression with
   replacing the caller's whole expression.
3. **Candidate entry, same initial prompt.** The teacher supplies return/caller
   premises, then asks for `sum(1)`'s addition and value before giving that result.
4. **Candidate follow-up.** The local correction is more precise, but assumes the
   learner already trusts the later result 6. That invented premise is a defect.
5. **Refined follow-up, identical current-turn prompt.** The teacher explains the
   pending caller addition without inventing that known result or showing the
   whole remaining path. It leaves the next use of the relation open at `sum(2)`.
6. **Sufficient answer plus explanation-only switch.** The learner supplies the
   correct `sum(2)` result and asks for no more questions. The teacher acknowledges
   it, explains `sum(3) = 3 + 3 = 6`, and asks no further question.
7. **Algebra transfer.** Using supplied distribution and zero/one facts, the teacher
   sets up `(-1)*(1+(-1))` and asks for its expansion. It does not give that expansion
   or the entire sign-rule derivation before the learner can infer the next relation.

These replies support improved execution of the opted-in teaching interaction in
the observed cases. The refined repair and explanation-only switch are useful
behavioral evidence. The algebra case checks another topic. They do not establish
a model-wide gain in factual accuracy, learning, retention, or instruction compliance.

## Evidence limits and checks

The parent reviewer is not blinded. Initial entry prompts match. Adaptive follow-ups
respond to the actual teacher question, so the baseline and candidate follow-up
learner messages differ. The repair refinement uses an identical current-turn
prompt. Do not describe the entire trajectory as a randomized identical-input A/B test.

Different instruction versions appear in the sequence. The refined final instructions
receive repair, preference-switch, and algebra probes. Their initial recursion entry
is not independently repeated after the narrow repair refinement. There are no real
learner responses or hidden holdouts. Reconstructed conversations are synthetic.

All 283 repository tests across 33 files and type checking pass. Relevant document
links, the stepwise anchor, and whitespace checks pass. These software checks do not
score teaching. No tests, kernel implementation, schema, or learner database changes
are introduced in this task. Existing staged changes remain intact. No commit is made.

Raw replies and before/after/historical instruction snapshots remain outside Git at
`/tmp/learning-os-stepwise-tw34mm91`. The [experiment plan](../agent-plans/2026-10-25-recover-stepwise-teaching.md)
records task client IDs and intermediate findings.

## Short retrospective

Historical inspection found an interaction route that the essay-focused experiment
missed. Keep mode selection and source inspection explicit in future evaluations.
The first repaired reply still invented learner knowledge. Future probes must check
the conversational premises as well as numerical output. These are evaluation
proposals, not proof that the remaining factual-reliability problem is solved.
