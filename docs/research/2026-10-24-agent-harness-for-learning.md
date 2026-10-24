# Agent Harness for Learning Things — source review (2026-10-24)

**Scope:** Compare one external teaching-system design with the current Learning OS contract.
This note changes no learner state and adds no evidence claim.

## Source

- Video: <https://youtu.be/nfTDljFG2g0>, channel Eero Alvar, 22:38.
- Captions: Arabic, auto-generated. The points below are paraphrases of an automatic transcript, not verbatim speech.
- Transcript: `/tmp/opencode/2026-10-24-teaching-idea-source.md` (local copy, not in Git).

## The design in the source

1. **Learning is two processes.** Teaching fixes understanding. Practice makes it retrievable.
   The main AI risk is skipping the productive struggle and creating an illusion of learning.
2. **Understanding is not retrieval.** A learner can follow a derivation and still fail to recall the
   relation when a problem needs it. Retrieval is cue-driven. Practice widens and strengthens the cue set
   that brings the right idea back.
3. **The learner's reasoning is the primary data channel.** Right/wrong alone cannot separate two learners
   with the same wrong answer and different models. Every interaction therefore carries a free-text
   "thinking" field, plus a confidence estimate.
4. **Teaching has three phases.** Explore by fast multiple-choice probes that binary-search the knowledge
   boundary; plan the minimal dependency chain from what the learner holds to the target; teach by walking
   that chain one intuitive step at a time, where each step is predicted, taught, then checked.
5. **Practice is retrieval under cues, not a problem set.** Difficulty has two levers: how many independent
   ideas one problem integrates, and how familiar the cues are. Hints are small pushes toward the next move.
6. **A durable reasoning record spans sessions.** Sessions condense into idea threads and inference links,
   drawn as a graph whose depth axis is reasoning depth. The graph shows coverage today, not mastery.
7. **The harness framing.** An agent harness is everything around the model that lets it act on an external
   system. For learning, that system is the learner's mind. "You are the system being operated on."
8. **Presentation serves the data rate.** Long text walls are bad mainly because they reduce continuous
   information about the learner's understanding, not because they are tiring to read.
9. **Optional subagents** read PDFs, check facts, draw SVGs, and build interactive demos.

## Mapping to Learning OS

| Source idea | Current Learning OS | Decision |
| --- | --- | --- |
| Teaching and practice are distinct processes | `ChallengeIntent` selects teaching or retrieval work; the selector and FSRS own timing | Already aligned |
| Understanding is not usable retrieval | Readiness, transfer, durability, and FSRS are separate projections | Already aligned |
| Reasoning, not the verdict, is the signal | `responseText`, assessment rationale, `observedErrors`, reconstruction | Partly present. Add one teacher rule: use the stated reason to choose the next move; never promote chat to evidence |
| Explore the knowledge boundary first | Onboarding intake, `diagnose_first`, initial diagnostics | Tracked work already has this. Ad-hoc work has none, and must not gain a compulsory quiz |
| Minimal dependency path to the target | Prerequisite closure, study focus, deterministic selection | Kernel already owns this. Ad-hoc path stays ephemeral |
| Predict, teach, verify at every step | `commitBeforeReveal`, Predict operator, one-question ceiling | Adopt as an opt-in stepwise mode, not a default |
| Difficulty = integration span × cue familiarity | `novelty` (`same`, `variant`, `transfer`) and changed-surface rules | Adopt as two authoring heuristics. Add no intent field |
| Durable reasoning graph across sessions | Append-only evidence, projections, session tables | Defer. Evidence is the durable record. A graph would be a read model, not a new source of truth |
| Confidence estimate | Confidence is metadata, never correctness | Reject as a default prompt. Keep the existing rule |
| SVG and interactive-demo subagents | Text-first boundary; no HTML, server, browser, or screenshot for an ordinary lesson | Reject for ordinary teaching. Explicit artifact requests keep their existing route |
| Short steps, no long text walls | Density calibration and efficient conversational teaching | Already aligned |

## What this changes

Two teacher-execution rules, both documentation only:

1. **Stepwise construction for an adopted deep build.** When the learner asks for a full conceptual build,
   or the dependency chain is clearly long and they ask for depth, walk one inference per step. Ask for the
   next inference, confirm or repair it, then state the step. This is the source's teach loop, bounded by
   the existing exposure, stop, and ad-hoc rules. Ordinary explanation stays the default.
2. **Two authoring levers.** Integration span and cue familiarity describe why one `variant` is harder than
   another. Raise one at a time. They are teacher heuristics; `novelty` remains authoritative.

## What this does not change

- No kernel method, schema, selection rule, FSRS behavior, or learner-state field.
- No durable ad-hoc lesson state and no mastery claim from conversation.
- No multiple-choice exploration by default, no confidence prompt, no visual pipeline.
- No new evidence type for "reasoning": the assessed response and its rationale already carry it.

The source is a strong independent statement of the two-process model and the cue-set view of practice.
Its kernel-worthy parts are already present. Its process architecture is worth copying; its artifacts are not.
