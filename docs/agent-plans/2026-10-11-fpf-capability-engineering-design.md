# Design: mechanism-aware practice and evidence-bound instructional support

**Status:** Proposed engineering design, not an implementation or an assertion of improved learning outcomes.

**Date:** 2026-10-11. **Receiving project:** Learning OS at `/home/ubuntu/repo/learning-os` on WebHarness ARM.

**Companion:** [2026-10-11-fpf-capability-engineering-implementation-plan.md](2026-10-11-fpf-capability-engineering-implementation-plan.md) defines exact implementation tasks. Read this design first; accepted repository contracts override either plan.

## 1. Decision and motivation

The first FPF-inspired teaching update (commits `15018cb` through `3a65c44`) mainly changed conversational guidance and two user-visible kernel strings. Preserve that work. The next improvement must deliver reusable **software capabilities**, not another mandatory teacher prompt or a second learning kernel:

1. Construct and inspect candidate practice tasks that discriminate correct reasoning from plausible wrong models.
2. Advise the conversational teacher on suitable *within-episode* support, based on the selected work, actual feedback, and explicitly qualified observations.
3. Make curated instruction available for `explain`, `predict`, `implement`, `debug`, and `design`, not only `predict/runtime_trace`.
4. Evaluate task quality and teacher decisions from actual artifacts and existing evidence while distinguishing code correctness, explanation quality, assisted success, and independent performance.

**Position:** The host AI or human authors draft content; a local, provider-neutral Learning OS layer checks contracts, provenance, and available deterministic facts; the established teacher/kernel boundaries authorize and persist any assessable learner interaction. FPF is design inspiration and a research source, **not** an executable dependency, new learner model, planning authority, or required service.

**Owner constraints:** One-user project; direct, coherent implementation instead of a new feature-flag platform, A/B infrastructure, or heavyweight deployment program. Agent-agnostic, offline-capable teacher. Ad-hoc explorations remain ephemeral unless deliberately promoted. No automatic modification of real profiles or `data/` while implementing. Use WebHarness ARM only. The earlier plans' unfinished pack audit and replay checks remain outstanding work; do not mark them complete merely because this design exists.

## 2. Verified baseline and the actual gaps

Investigated canonical HEAD `3a65c44bf398f99380f60911e8673b09d5fc7ae6` (clean at inspection); the existing [teacher-upgrade rationale](2026-10-11-teacher-upgrade-from-fpf.md) and [implementation plan](2026-10-11-implementation-plan.md) remain separate and partially unchecked.

| Existing implementation | Real capability | Remaining limitation / consequence |
| --- | --- | --- |
| `src/selection/selector.ts`, `src/selection/types.ts` | Chooses goal-bound intent: objective, capability, task form, novelty, weakness, avoidance | Correct owner; must **not** be replaced by a candidate-generator ranking objective priorities. |
| `src/knowledge/challenge-calibration.ts` | Discovers six `predict/runtime_trace` packs, three cases each; binds to intent and freezes a selected case | Predetermined cases; no general inspectable candidate-quality contract, authoring contract for all forms, or validated derivation of why a variant discriminates. |
| `knowledge/{frontend-revision,backend-systems}/challenges/` | 18 curated same/variant/transfer cases, with executable outputs and declared wrong-model predictions | Meaningful contrasts mostly exist, but their decision-changing relation is not explicitly evaluated as a reusable design output; old pack audit still pending. |
| `src/knowledge/scaffolds.ts` | Four optional prediction scaffold packs, two stages (`worked_example`, `completion`) | Discovery requires a calibrated prediction parent; cannot independently supply explanation/debug/implementation/design scaffolds. |
| `src/kernel/scaffolds.ts` | Records teaching artifacts/exposure before returning content and replays their exact persisted bytes | Replay labels stage by exposure type, conflating different future scaffold stages; source-path matcher recognizes only `challenges/.../scaffold/*.md`. |
| `src/teacher-pedagogy.ts` | Tiny `guided|independent`/commit/chunking guardrail | No read-only structured advice for an *observed* gap; should remain modest and non-authoritative. |
| `src/kernel/feedback.ts` | Immutable assessment-derived per-criterion status and help provenance | Exposes facts but does not determine which support is useful; semantic interpretation is appropriately teacher-owned. |
| `src/evaluation/{teacher-scenarios,assessment-calibration,learning-outcomes}.ts` | Synthetic lifecycle checks, assessor calibration, read-only descriptive follow-up reports | Can miss weak explanations, false causal reasoning behind correct output, cosmetic variants and wasted turns; no validated causal improvement claim. |
| `src/knowledge/search.ts` | Title/tag/prerequisite concept matching | Not a provenance-qualified search over explanatory passages; a separate possible later extension, not prerequisite to this wave. |

Relevant authority: `AGENTS.md`, `CLAUDE.md`, `docs/decisions/0005-authority-transitions.md`, `docs/kernel-contracts.md`, `docs/architecture.md`, `docs/evidence-model.md`, `docs/teacher-agent-protocol.md`. Accepted ADRs and kernel contracts win if a draft here conflicts.

## 3. Research, source quality, and design translation

### 3.1 FPF publications inspected

FPF source snapshot: [ailev/FPF](https://github.com/ailev/FPF), commit `e2c6ac1e97dae9b9f54f707477f7d86a12d91852` (2026-10-10); local source checkout `/tmp/fpf-ailev-review-20261011`, outside Learning OS. This snapshot contains FPF Core and DPF Suite publications. Its `USING-FPF.md` says to retrieve actual pattern bodies and their conditions, not treat contents titles or a pattern list as sufficient. The relevant texts and application conditions were inspected.

| Source | Contribution used in this design | Non-contribution / boundary |
| --- | --- | --- |
| Human Capability Development `HCD.3` | Compare plausible reasons for a struggle before declaring a capability deficit | Cannot diagnose a specific learner from a wrong answer alone. |
| `HCD.6`, `HCD.6.1` | Design practice around a representative task and a decision-changing contrast | Does not supply a programming task generator or guarantee distractor quality. |
| `HCD.9`, `HCD.10` | Preserve first attempt/support and vary practice condition for a named purpose | Does not select FSRS due dates or authorize a new objective. |
| `HCD.11`–`HCD.14` | Separate demonstrated action, transfer, retention/tool dependence, and revisions from observed results | Does not replace kernel evidence/replay. |
| `HCD.18`, `HCD.19` | Evaluate instructional material for a specified audience/task/criterion and smallest effective repair | Does not establish learning benefit just by inspecting artifacts. |
| Explanation Design `EXD.2`, `EXD.4`, `EXD.6` | Build bounded explanatory examples, adapt dialogue to learner contributions, and stop useless revisions | Existing teacher playbooks already implement portions; do not re-add the same prompts. |
| Knowledge-Corpus Access `KCAE.SEARCH`, `KCAE.ASSESS`, `KCAE.EVAL` | Ground retrieval/evaluation in actual use and full costs | Full-text/semantic indexing is optional, not the first engineering dependency. |
| Method Engineering `ME.3`, `ME.11`, `ME.14` | Derive requirements from work, inspect actual enactment, and compare alternatives | More process is not itself a user benefit. |
| Core `C.11.DUA`, `A.19.ECS` | Keep evidence and evaluation requirements proportionate, define what a score measures | No universal quality metric or master score. |

Pattern links: [Explanation Design](https://github.com/ailev/FPF/blob/e2c6ac1e97dae9b9f54f707477f7d86a12d91852/Engineering%20DPF%20Suite/EXPLANATION-DESIGN-PRINCIPLES-FRAMEWORK.md), [Human Capability Development](https://github.com/ailev/FPF/blob/e2c6ac1e97dae9b9f54f707477f7d86a12d91852/Engineering%20DPF%20Suite/HUMAN-CAPABILITY-DEVELOPMENT-PRINCIPLES-FRAMEWORK.md), [Knowledge-Corpus Access](https://github.com/ailev/FPF/blob/e2c6ac1e97dae9b9f54f707477f7d86a12d91852/Engineering%20DPF%20Suite/KNOWLEDGE-CORPUS-ACCESS-ENGINEERING-PRINCIPLES-FRAMEWORK.md). Independently worded design: reference ideas and IDs; don't transplant long source passages into code or instructions. If future edits reproduce adapted FPF expression, comply with the repository's CC BY 4.0 scope/attribution requirements.

### 3.2 External empirical constraints, not product-effect guarantees

- [Atkinson, Renkl & Merrill (2003)](https://eric.ed.gov/?id=EJ678596): combining fading of worked steps with prompts about the underlying principle improved near/far transfer in their studied tasks. **Use:** allow targeted completion and relation-specific feedback; **limit:** not evidence that our software improves adult programming mastery.
- [Hou, Ericson & Wang, Parsons problems](https://par.nsf.gov/servlets/purl/10510493): 89-undergraduate classroom study reported better scaffolded practice performance/efficiency but similar posttest scores. **Use:** completion/ordering help is worthwhile, but scaffold success is not independent learning.
- [Brunmair & Richter (2019)](https://pubmed.ncbi.nlm.nih.gov/31556629/): interleaving effects depend on task/content similarity. **Use:** vary confusable mechanisms selectively, not indiscriminately rotate unrelated topics.
- [Bastani et al. (2025), PNAS](https://doi.org/10.1073/pnas.2422633122): unrestricted AI help could raise practice performance without corresponding unassisted achievement; guardrailed tutoring reduced that failure in the studied high-school math context. **Use:** preserve answer-before-exposure and evaluate unassisted work. **Limit:** domain and learner population differ.
- [Liu et al. (2026), AAAI](https://doi.org/10.1609/aaai.v40i47.41509): in a comparison involving five selected MCQs and logs from 80 learners, human-authored distractors received higher expert ratings; the AI distractors nevertheless showed some promising engagement patterns. [Crk & Gultepe (2026), Frontiers in Education](https://doi.org/10.3389/feduc.2026.1837523): in a small, 42-student computer-science-course assessment, several measured psychometric differences between validated LLM and human items were not statistically significant. **Use:** generated items are reviewable *candidates*, not automatically correct, discriminating or equivalent in a new domain. Sample sizes and item types limit transfer to Learning OS's open-response coding tasks.

These studies and FPF patterns motivate proposed mechanisms, not proof of their effectiveness in Learning OS. `docs/research/pedagogy-priorities.md` already discusses much of the broader evidence. Do not duplicate it into a new teaching-science theory.

## 4. Core architecture and authority

```text
Learning OS selected ChallengeIntent (unchanged)
             |
   authoring from human/host AI
             v
 CandidatePractice (draft, non-durable, teacher-only contrasts + answer basis)
             |
        quality checks --> reject / needs-human-review / structurally-qualified
             |
    approved ChallengeSpecInput + unchanged original intent
             v
 registerChallenge() -> frozen challenge + authoring contract -> attempt
                                      |
                           assessment/feedback/history
                                      v
              read-only instructional support suggestions
                                      |
              host teacher chooses authorized material
                                      v
 prepareScaffoldPresentation() OR existing hint/exposure API
                                      |
                              learner-visible support
```

**No silent authority promotion:** A candidate's `wrongModel` is a hypothetical counterprediction, *not* a learner misconception. A source, solver trace, or LLM-generated rubric is not evidence of learner capability. Suggestions are not selected objectives or stored weaknesses. `registerChallenge` must revalidate the goal-bound intent; a rejected/stale intent returns to selector ownership. Assessment and evidence creation happen only through existing kernel methods after a learner attempt. A frozen challenge's current rubric, hints, answer privacy, novelty and evaluation requirements outrank any advisory output.

**State/lifetime:** Candidate reports and support suggestions are in-memory/read-only outputs. Only approved frozen challenge objects and ordinary hint/exposure/attempt/assessment events are durable. Save edited curriculum files only when explicitly promoted; ad-hoc lessons need no files, curriculum, or evidence. No DB schema migration is needed in the first implementation; if a genuinely necessary persisted distinction later emerges, write a separate ADR and migration.

### 4.1 Mechanism-aware candidate authoring

A small, explicit schema supplements—never replaces—`ChallengeSpec`:

- **Bound input:** the exact selected `ChallengeIntent`, including `goalId`, objective, capability, task form, delivery context, novelty, selected weakness, avoidance list and `requiresChangedSurface`.
- **Candidate:** public question/artifact, proposed frozen criteria and verification basis, truth/solution source, target relation, decisive condition, selected rival model(s) with separately predicted outcomes, intended variation versus a cited **published case** or existing frozen challenge, with the two identifier namespaces kept distinct, and declared learner-visible support assumptions.
- **Checks:** schema/rubric consistency; selected-intent identity; single target assumption unless existing contract explicitly authorizes multiple; correct-vs-rival prediction difference **on the same observable for each rival**; meaningful variation rationale for `variant` and genuinely changed application for `transfer`; duplicate/recent surface; answer leakage; source and executable-verification status. A changed filename or numerals alone is not accepted as proof of transfer.
- **Disposition:** `blocked` with exact findings, `needs_review` with unresolved semantic/verification questions, or `structurally_ready` with explicit remaining human/agent responsibility. **Never** call a mechanically checked result “pedagogically validated.”
- **Generator neutrality:** Any AI agent can propose the candidate as JSON, including a claimed expected output; that claim is not trusted verifier evidence. An authorized runner supplies actual execution separately from the model-authored proposal. The kernel runs no LLM, chooses no pedagogical objective, and never executes untrusted proposed code automatically. Trusted curated executable cases can continue through existing Node verification; new arbitrary code requires an explicitly authorized, isolated executor and recorded results before claiming deterministic validation.

A rival-model prediction is useful only when it *differs from* the correct observable under the proposed case; such a difference is necessary, but not sufficient, for a good diagnostic. For `explain/design/debug/implement`, the discriminating observable may be a specific rubric criterion or feasible artifact consequence rather than a console trace; do not fabricate a numeric/automatic oracle where none exists. Preserve the raw proposal privately until reviewed, then register the existing `ChallengeSpecInput` unchanged in semantics.

**Example:** An async JavaScript candidate tests whether an `await` pauses only the current async function, versus the entire caller. A variant changes the actual suspension/ordering relation; the wrong model must make a different prediction. The teacher-facing report spells out the condition and contrast. The learner-facing public prompt contains neither the rival model nor the answer key.

### 4.2 Instructional support advice, not automatic pedagogy

Support suggestions consume the current selected intent, the existing `PedagogyDirective`, optional already-authoritative `SessionFeedback` (criterion statuses, valid evidence refs, hint level), a **bounded, explicitly qualified** current observation such as learner-requested help or teacher-noted difficulty, and available scaffold descriptors. The pure helper returns zero or more suggestions (`worked_example`, `contrast`, `completion`, `guided_step`, `direct_explanation`, `neutral_rephrase`, `none`) with justification, limitations, and any exposure/reconstruction obligation. It **does not** execute them, open a new attempt, persist a diagnosis, set readiness, select transfer, or schedule review.

| Qualifying input | Possible suggestion | Fail-closed condition |
| --- | --- | --- |
| Explicit request for direct answer | Honor request; record answer-bearing exposure when inside a frozen attempt | Never label subsequent answer clean retrieval. |
| Wording/access complaint without demonstrated wrong model | Neutral restatement or atomic question | Don't invent misconception or leak target reasoning. |
| Specific assessed wrong causal relation | Focused contrast and reconstruction using existing protocol | Must be tied to actual unmet criterion / evidence, not just fluent speculation. |
| Missing first move with inadequate prerequisite structure | One bounded example or completion scaffold | The assessment phase must permit coaching and record help. |
| Assisted success | Recommend less-support-dependent *future* material when appropriate | Only Learning OS chooses the next eligible task or review. |
| No reliable observation, sufficient correct answer, or unresolved authorization | `none`, plain teacher judgment, or direct close | Do not demand extra diagnostic questions or turn a guess into learner state. |

A read-only adviser can return *options* but must not convert diagnostic hypotheses into objective weaknesses. Scope its outputs to the current episode and do not add a new global support-planning graph. Retain the tiny existing `getPedagogyRecommendation` as the baseline starting guardrail.

### 4.3 Five-capability scaffold delivery

The current `prediction pack -> scaffold` directory/manifest coupling is a real limitation. Keep four existing curated prediction packs where they are. In addition, allow standalone scaffold sources in `knowledge/<course>/scaffolds/<pack-id>/` with manifest and learner markdown. A unified discovery layer returns a pack descriptor with `conceptId`, one capability (`explain|predict|implement|debug|design`), matching `TaskForm`, available **named stages**, and source path. Initial stage vocabulary: `worked_example`, `completion`, `contrast`, `guided_step`; a pack declares only stages it actually supplies. Unavailable stages are errors, not implicit fallbacks. Content for `debug`/`implement` may use real code/artifacts; design/explain stages may use causal maps or criteria instead of invented executable outputs.

Keep `listScaffoldPacks`, `getScaffoldMaterial`, `prepareScaffoldPresentation`, and `getSessionScaffoldPresentations` as the public teacher interaction shapes wherever practical; generalize internal loaders, not the teacher's authority. **Every answer-bearing stage** goes through the current atomically persisted teaching artifact and exposure path before returned markdown is displayed. Before presentation, check current session/attempt, target `conceptId`+capability, task form, stage availability, and delivery-context restrictions. In interview/mock, instruction remains feedback-only. No automatic material show or stage progression.

**Replay migration design:** Existing stored content is immutable. Replay returns the stored `teaching_artifacts.content` and original `source_ref`, not reloaded curriculum. The current replay stage deduction (`worked_example_shown` => worked example, all other explanation exposures => completion) becomes invalid with more stage kinds. Derive a stable stage from the *source path/material basename* using an explicit allowlisted mapping for old and new layouts; stage classification may be `unknown` for an older/unrecognized path but must still preserve the exact content. Exposure type remains a record of what was shown, not a substitute for a stage identifier. No rewrite of `data/profiles/**` and no pretending a pre-display record proves the user viewed it.

### 4.4 Offline quality and evaluation

Keep four distinct evaluation questions:

1. **Candidate validity:** Does the draft match intent and rubric, have a warranted answer, and discriminate stated alternative models? Mechanical failures can block; conceptual adequacy is reviewed.
2. **Teacher compliance:** Were hints and exposures recorded before display, was answer privacy preserved, did an answer or preference route correctly, did a fresh teacher honor saved state? Reuse `src/evaluation/teacher-scenarios.ts` and `docs/teacher-evaluation.md` with synthetic databases.
3. **Instructional usefulness:** Did the example expose the target relation, avoid needless repetition, and support a targeted correction? Human-reviewed, source-grounded criteria; no self-scoring based on the teacher's own claims.
4. **Independent learning:** Did a learner later solve an unseen, unassisted, criterion-matched task, at what active study cost? Only existing evidence receipts and the read-only outcomes report can support that observation. No statistical/causal claim without a dedicated study; owner need not run a pilot to ship internal code improvements.

Prefer an offline report which outputs a small set of separate characteristic statuses (`satisfied`, `failed`, `unresolved`) and reasons/provenance over a fabricated aggregate “teaching quality score.” A semantic evaluator's uncertainty is explicit. Never use that report to modify mastery, due cards, or weaknesses. Existing tests and package-release checks cover software regressions; sample content review remains a distinct judgment.

### 4.5 Optional source access, out of this implementation wave

`src/knowledge/search.ts` is metadata-oriented. FPF KCAE suggests future edition-aware passage retrieval, but this is **not** a prerequisite for task calibration or support. If repeated real explanations demonstrate source grounding failures, plan a separate read-only source registry/search over already-authorized course materials, with provider-independent access and source-version boundaries. Do not pull private learner files into external indexes, build a generic vector database, or invent retrieval confidence based on uncalibrated similarity.

## 5. Rejected options and trade-offs

| Alternative | Why not now |
| --- | --- |
| Add FPF patterns/40 pages of instructions to every teacher turn | Context cost and rigidity; first wave already fixed main prompt-routing mistakes. |
| Let a model generate and instantly freeze any challenge | Hallucinated code/rubric, answer leakage, wrong model not actually discriminated, lost selector authority. |
| Automatically execute candidate code from arbitrary model output | Untrusted execution/security boundary; requires explicit isolated executor, not a regular `node` shell. |
| Replace FSRS or weakness projections with a dynamic pedagogy planner | Violates accepted ADR, causes two sources of learner truth. |
| Infer persistent “frustration”, “ability”, or “learning style” from dialogue | Unsupported inference and a parallel learner profile. |
| Generalize every curriculum loader and rewrite current packs at once | Risk without evidence; add a focused scaffold-discovery seam, preserve existing calibrated prediction API. |
| Build a live learning experiment or scoring dashboard | Owner is one learner and doesn't request a pilot; implement an honest offline review surface instead. |

## 6. Delivery and success boundary

Deliver as one coherent engineering wave in the companion plan, with ordered tasks because prerequisites are real, **not** because an external phased rollout or deployment bureaucracy is required. No new FPF runtime requirement. No new DB tables. No change to profile state, FSRS, objective selection, challenge freezing, or evidence correction.

**Acceptance means:** (a) an agent can submit a candidate whose structural/semantic unknowns are reported before freeze; (b) a deliberately cosmetic variant and nondiscriminating rival prediction are identified; (c) guided help can be recommended from explicitly scoped facts without being mistaken for learner truth; (d) nonprediction scaffold content is discoverable and safely exposed; (e) an interrupted presentation can be replayed with the exact saved bytes and truthful stage; (f) quality reports separate mechanical compliance, human judgment, and actual learner outcomes. Existing cases must continue to work.

**Not a success claim:** New code does **not** prove faster or deeper learning. It gives a stronger basis for authoring, delivering, and evaluating teaching with less guesswork. Real learner outcomes remain an empirical question.

## 7. Source/revision references and handoff

- Learning OS source revisions examined: `3a65c44`, and original implementation plans at `docs/agent-plans/2026-10-11-*.md`; current kernel/teacher contracts take precedence.
- FPF: source revision above; `USING-FPF.md`, selected Core/Explanation/Human Capability/Method/Knowledge-Corpus pattern bodies; links above. Future changes should re-check the actually used edition and conditions; do not assume all FPF versions say the same thing.
- Existing project research: `docs/research/pedagogy-priorities.md`, `docs/scaffold-fading-pilot.md`, `docs/teacher-evaluation.md`, `docs/learning-outcome-pilot.md`.
- External literature cited in §3.2 supports bounded design choices, not quantified product uplift.
- Implementation specifics, file map, interfaces, case examples, and required validation: [companion plan](2026-10-11-fpf-capability-engineering-implementation-plan.md).
