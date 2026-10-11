# Kernel-connected fresh-teacher probes — 2026-10-12

**Scope:** One bounded, synthetic dogfood batch over four of the existing sixteen tracked teacher scenarios. These are genuine isolated model runs and public-kernel calls, **not** human learner sessions, cross-provider evaluations or long-term learning outcomes.

## Execution boundary

- Host: non-ARM WebHarness/WSL; repository baseline `6fb0942`.
- Each case was generated with `npm run -s eval:teacher -- prepare CASE_ID /tmp/.../CASE_ID`, creating an isolated synthetic SQLite database **outside the repository**. The model was instructed not to access `data/profiles/**`, evaluator source, gold checks or unrelated state.
- OpenAI Codex CLI model as reported by invocation logs: `gpt-6.1-sol`, low reasoning effort, ephemeral individual sessions, `workspace-write` sandbox rooted at `/tmp/learning-os-tracked-probe-20261012`. The model could read the repository's Teacher skill and protocol and invoke the **public kernel** against the synthetic database.
- Initial attempts to use `npm run -s kernel -- --db ...` failed because the agent's sandbox disallowed `tsx`'s local IPC listener (`listen EPERM ... /tmp/tsx-1000/33.pipe`). This was **an environment limitation, not a teaching-policy defect**; those runs are not counted as successful kernel-connected episodes. After the normal `npm run build`, `node /home/hamza/repo/learning-os/dist/kernel-cli.js --db /tmp/.../tutor.db METHOD [args]` exercised the same public kernel without the IPC socket. The corrected executions had exit status zero.
- Each run resumed the frozen attempt using `getStudyContinuation`, made kernel calls based on the learner message and saved a separate actual learner-facing reply. Inspections used the existing `npm run -s eval:teacher -- inspect` command and the corresponding saved reply. Model logs/replies are outside version control, with exact output fingerprints below.

## Results and targeted corrections

| Case | Final automated checks | Actual behavior and manual-review boundary | Reply SHA-256 |
| --- | ---: | --- | --- |
| `answer_requested` | **2/2** | Gave the correct `A → end → B` execution order with an explanation; logged `recordExposure` for the answer before emitting the reply; no independent evidence. The automated checker verifies exposure but not the natural-language timing of presentation. | `82a8a37237b792725459de8449976195d011815614b949f7387d787eb6f53bd3` |
| `ambiguous_answer` (revised) | **3/3** | Asked one neutral clarification of “It happens later.”, saved the original answer and opened a focused follow-up without scoring or exposure. Original fixture “Later.” caused the first fresh agent to reasonably interpret **postponement** rather than a technical answer; the scenario and its exact-response expectation were corrected at the evaluator owner, not the kernel. | `d2a148b77373677e45dfa55fd521e857b9f511ed092d52ba0139223c8f6a19a8` |
| `causal_model_error` | **3/3** | Repaired the observed whole-async-deferred misconception, saved answer-bearing explanation as exposure with reconstruction required, and asked specifically why A is synchronous and B is delayed. Does not establish subsequent learner reconstruction. | `ca4d3ec04d033535a9bebc8c8c0942dd27458a56157dbc16c9592d62489b1478` |
| `scaffold_interrupted_after_presentation` (revised) | **4/4** | Before adjustment, the teacher reported assisted status and asked whether the example arrived but only summarized the *topic*, omitting the saved question itself. A narrowly revised Teacher skill/protocol now asks for the saved question once. A fresh run restated the exact reasoning request about the one-seat scenario, acknowledged the prior exposure, asked whether material came through, and created no duplicate exposure. | `ce1bddb2cab7a7c01b289f33f022e63bbbe4a2192ce24563653d4c7c67a1c291` |

**What the counts mean:** all **12/12** final synthetic database assertions pass across these four cases. That is not a measured 12/12 semantic-teaching score; text quality remains judgmental and should be independently inspected against each scenario's human rubric. The original `ambiguous_answer` replay failed 1/3 because the model treated “Later.” as deferral; this failed trial is preserved as diagnostic evidence rather than erased.

## Disposition and limits

- Narrow production change: explicitly tell a resumed scaffold teacher to **briefly restate the actual saved pending question once** (not the worked-example solution), while retaining exposure and learner-agency rules. No new state model or scheduler was introduced.
- Narrow evaluation-fixture change: replace the ambiguous phrase “Later.” with the genuinely technically under-specified “It happens later.” and update its exact-response assertion. Do not interpret a learner's genuine request to postpone as a misconception.
- The other **twelve** tracked scenarios were not run by an independent model in this batch. Current software tests still cover their kernel invariants, not actual teacher responses.
- No human learning gains, cross-session retention, provider portability or owner approval is claimed. This is engineering and behavioral dogfood, not a longitudinal outcome pilot.
