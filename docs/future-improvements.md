# Future improvements

Proposals only. These items do not authorize implementation.

## Generate current evaluation coverage from the scenario registry

The teaching-quality audit found current documentation describing sixteen tracked
cases while the executable registry and tests contain twenty-eight. This audit
corrects that prose. A future documentation check could derive current coverage
from the registry while preserving dated historical pilot counts. Add such a
check if coverage prose drifts again. Do not turn historical results into claims
about the current suite.

## Record instruction access in harness experiments

One DeepSeek trial did not read the edited reference. A reply comparison alone
could not distinguish a missed instruction route from ineffective wording.
Propose an evaluation receipt field for observed instruction access, with trace
references and an explicit unknown state. A harness hash must not count as proof
that a teacher read the file. Keep this separate from reply-quality judgments.

## Check supporting explanations, not only the main trace

The DeepSeek trials often produced correct return values while adding a false
analogy, statement count, or stack-trace claim. Propose development probes that
check those supporting claims against small executable counterexamples. Keep
model-generated prose review evidence-based. Passing a code example must not
automatically certify the surrounding explanation or establish learner retention.

## Include adopted teaching modes and preference changes in evaluation

The historical audit recovers a stepwise method that standalone explanation probes
did not exercise. Propose synthetic multi-turn cases for adopted guided construction,
wrong reasons, invented learner knowledge, and a later switch to explanation-only.
Use actual prior teacher replies in resumed context. Keep matched initial prompts
separate from adaptive follow-ups, whose learner answers can legitimately differ.
Such tests check interaction behavior, not real learner understanding or retention.

## Build review inputs from actual applicable instruction excerpts

The Jev pilot's instruction summaries falsely flagged a correct tracked completion.
Repeating the same cases with actual source excerpts removed that false alarm.
Propose a small optional input builder that attaches selected current instruction
excerpts, source hashes, public state, and ordered action evidence. Preserve scope,
privacy, and missing-evidence disclosure. Do not infer that hashes prove execution,
or make Jev a delivery gate. The observed result covers a small development set.
