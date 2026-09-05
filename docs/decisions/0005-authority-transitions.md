# ADR 0005: Govern learner claims through explicit authority transitions

**Status:** Accepted

## Context

Learning OS already separates append-only learner evidence from rebuildable projections, keeps scheduler timing separate from pedagogical interpretation, and treats the teacher as a replaceable client of the kernel. Recent architecture review exposed a different class of risk: useful but provisional information can silently acquire more authority than the observations justify.

Examples include a teacher hypothesis becoming a durable misconception, a useful practice interaction being treated as qualifying evidence, an authentic artifact being treated as proof of learner ownership, or a fresh teacher interpreting a prior guided success as independent capability.

The system also needs to remain useful in realistic technical environments where documentation, tests, debuggers, repository search, or other tools may be part of the target capability rather than answer-bearing help.

## Decision

Adopt **Evidence Ecology** as the governing architecture lens and make **authority transitions** explicit.

The operating rule is:

> **Flexible exploration. Exact promotion. Inspectable authority.**

### Epistemic layers

Treat information according to the authority it is entitled to carry:

```text
1. observations
   attempts, responses, artifacts, frozen challenge/rubric, hints,
   exposures, verification output, assessment results
   -> strongest durable authority

2. projections
   readiness, transfer, durability, weakness summaries, review cards
   -> rebuildable interpretations over authoritative history

3. bounded live-episode coordination
   active challenge/attempt, pending action, reconstruction obligation,
   and other resumable interaction commitments required to continue safely
   -> operational authority that must not become mastery/evidence by itself

4. teacher interpretation
   causal hypothesis, analogy, explanation strategy, playbook choice,
   feedback focus
   -> lowest authority; cheap to discard or revise
```

Authority decreases as interpretation increases. Persistence does not by itself make an interpretation more true.

### Authority transitions

Whenever a weaker claim becomes a stronger one, an explicit owner and proof requirement must exist.

Representative transitions include:

```text
teacher-authored activity -> frozen assessable challenge
learner response/artifact -> objective-specific EvidenceEvent
EvidenceEvent history -> readiness/transfer/durability projection
observed error -> persistent misconception/weakness consequence
selected next move -> opened attempt
learner-visible answer-bearing teaching -> exposure provenance
conversation state -> durable resumable interaction state
```

The component that owns the stronger claim owns the promotion decision. Teachers may propose observations and assessments through public contracts but may not bypass the owning kernel boundary. A selected challenge intent is therefore scoped to the goal that authorized it; intent-aware challenge registration must revalidate that the current goal execution scope still authorizes the selected objective before freezing a new assessable challenge, and opening an attempt from that challenge must revalidate the same scope and session-goal identity before learner work begins.

### Promotion failure is not pedagogical failure

If an interaction cannot legitimately cross an authority boundary, preserve whatever lower-authority value remains.

Examples:

- answer-bearing help can remain useful teaching exposure while preventing clean retrieval evidence;
- a defective assessment opportunity may be rejected/voided without deleting the learner's historical response or memory contact;
- an authentic project task may remain useful work even when its provenance is insufficient for an independent-capability claim.

Do not weaken evidence standards merely to preserve the interaction. Downgrade the claim instead.

### Support-aware evidence

Do not define professional independence as the absence of every external tool.

Evidence is interpreted against the **frozen support semantics of the challenge**: support that is part of the intended performance environment is different from support that supplies the target answer/reasoning.

V1 does **not** add a generic permission matrix or another support-state subsystem. When support conditions materially affect what the attempt proves, the teacher must state those conditions prospectively in the frozen challenge prompt and/or criteria. Existing hint and exposure provenance continues to record teacher-provided answer-bearing assistance. A structured support field should be added only if real use demonstrates that the frozen challenge artifact cannot reconstruct the required semantics reliably.

### Inspectable authority

Consequential claims about the learner must be explainable from kernel-owned history.

Add an objective-scoped read model that exposes the current projection together with the effective/invalidated evidence history, challenge surfaces, weaknesses, and exposure provenance needed for a compatible teacher to answer questions such as:

- Why is this objective still guided rather than independent?
- What evidence supports or contradicts transfer/durability?
- Which attempts are currently ineffective because of evidence revision?
- What prior answer-bearing exposure is relevant?

This read model is for explanation and audit. It does not create evidence, change projections, select work, or grant the learner unilateral authority to rewrite state.

When a learner disputes provenance, the teacher should inspect the authoritative receipt and use existing correction contracts when a concrete assessment/evidence error is established. Mere disagreement does not mutate history.

### Least-privilege teacher context

The kernel may retain broad learner history while individual teaching decisions should request only the smallest context needed for the active question. Prefer objective-scoped receipts and existing bounded continuation/preparation views over indiscriminate learner-history dumps.

### Semantic handoff integrity

Teacher replaceability requires more than recovering bytes. A fresh teacher may choose different pedagogy, but the operational meaning of `proven`, `unproven`, `hinted`, `exposed`, `independent`, `due`, and unresolved interaction obligations must survive handoff.

Historical observations should also remain interpretable after teacher guidance evolves. Raw evidence therefore outranks long-lived pedagogical interpretation.

## Deferred mechanisms

The following remain evidence-gated extensions rather than part of this accepted implementation wave:

- a new structured support-environment schema;
- diagnostic micro-probe or sentinel-probe selector reasons;
- goal-pulled objective creation from live project work;
- explicit evidence-diversity/correlation scoring;
- persistent teacher hypotheses or a generic live-episode JSON store;
- a universal semantic-contract/claims engine;
- a second AI evidence arbiter;
- new exposure-correction machinery absent a demonstrated false-exposure recovery need.

These may be added only after concrete product behavior demonstrates that existing owners and read models are insufficient.

## Consequences

### Positive

- Teacher flexibility can increase without weakening learner-state honesty.
- Projection claims become auditable without turning projections into independent truth.
- Realistic tool use can be distinguished conceptually from answer-bearing assistance without an immediate schema explosion.
- Fresh teachers can explain learner state from objective-scoped provenance rather than broad chat memory.
- Future architecture work has a clear test: identify the authority transition, its owner, and the proof needed to cross it.

### Negative

- Teachers must tolerate uncertainty instead of promoting every plausible interpretation.
- Some useful interactions will intentionally remain practice/exposure rather than qualifying evidence.
- The objective receipt exposes more kernel detail to teacher clients, so learner-facing prose must still hide internal IDs and implementation terminology by default.

## Rejected alternatives

### Add one universal semantic-contract manager

Rejected because evidence qualification, challenge validity, projections, scheduling, and domain identity already have local authoritative owners. A universal manager would duplicate those owners and become another source of truth.

### Persist richer teacher hypotheses for continuity

Rejected because teacher interpretations are deliberately lower-authority and more disposable than observations. Persist only bounded interaction commitments that future correctness actually requires.

### Treat all external assistance as contamination

Rejected because documentation, debuggers, tests, repository search, and other tools may be part of the capability being assessed. What matters is whether support replaces the target capability under the frozen challenge contract.

### Treat every authentic artifact as qualifying evidence

Rejected because artifact correctness does not prove learner ownership, independence, or the absence of answer-bearing support.
