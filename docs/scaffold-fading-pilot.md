# Pedagogical improvements: first implementation

Status: first implementation slice; learning effectiveness remains unmeasured.

The [research synthesis](research/pedagogy-priorities.md) prioritizes structured worked examples, selective scaffold withdrawal, discrimination between confusable mechanisms, feedback tied to the learner's failed model, and delayed independent outcomes. These are research-informed hypotheses for Learning OS. Passing software tests or improving assisted accuracy does not establish improved learning rates.

## Implemented scope

Four curated prediction packs now offer optional instruction:

| Pack | Capability / task | Worked example | Completion task |
| --- | --- | --- | --- |
| `js-async-await-predict` | `predict` / `runtime_trace` | Separate the synchronous call prefix from an `await` continuation | Complete a trace and explain the suspension boundary |
| `retries-idempotency-predict` | `predict` / `runtime_trace` | Recover a recorded result after a lost reply; distinguish a separate operation | Choose the retry identity, complete the trace and explain the lookup |
| `js-promises-predict` | `predict` / `runtime_trace` | Contrast a `then` callback that returns an inner promise with one that only starts work | Complete a trace where one step is returned and the next is not |
| `database-transactions-predict` | `predict` / `runtime_trace` | Contrast a check made before an interleaving with a check and update inside one protected section | Complete a trace where a lock covers only the update |

Each pack has a strict `scaffold/scaffold.json`, learner Markdown, and executable Node examples. Answer keys for completion live in teacher notes and separate solution sources. Tests execute the exact learner Markdown code and verify the corresponding outputs. The retry models are sequential, retain process memory and make no claim about overlapping calls, restart durability or distributed effects. The transaction models are deterministic in-memory Node interleavings; they do not prove PostgreSQL isolation behavior.

The public workspace offers read-only discovery and teacher preparation. The bound kernel additionally records exposure and replays the persisted instruction. The JSON kernel CLI exposes these same methods. This is an agent integration surface: normal learners continue in chat.

There is no schema change, stage-progress table or migration. The existing immutable teaching artifacts, exposure events, session checkpoints and frozen challenges own durable state.

## Teacher decisions and evidence boundaries

Select work with `getStudyContinuation(...)` first. Use the current pedagogy directive, learner response and explicit requests to decide whether instruction is needed. A learner who can already attempt the problem meaningfully does not have to pass through either scaffold. Interview/mock coaching waits until debrief. Do not reveal examples just because they are available.

The possible route is worked example → completion → independent variant → transfer; it is not a mandatory sequence. Withdraw assistance when the learner demonstrates the relevant reasoning. Reintroduce only the smallest useful assistance when a response identifies a gap. Later independent cases still come from the existing selector and calibrated authoring boundary. FSRS continues to own when eligible retrieval is due.

Worked examples and completion prompts are **instruction**. They use different code from the frozen assessment. Do not grade a completion answer against the original assessment's answer key, substitute its prompt for the frozen challenge, or treat it as independent implementation/prediction evidence. Return to the actual frozen prompt before submitting an assessment, or use the completion as repair/reconstruction after assessment. If a distinct completion task needs assessment, author and freeze a separate challenge with its own rubric before its answer; preserve its assistance history.

Subquestions remain governed by the existing question protocol. Persist any question that the learner must resume; use the appropriate frozen criterion and purpose. The scaffold helper does not open a question, submit work, create evidence, advance a stage or close feedback. It also cannot decide whether the material is the minimum repair needed for a particular misconception.

## Public contract

```ts
const workspace = createTeacherWorkspace({ knowledgeRoot });
const packs = workspace.listScaffoldPacks();
const preview = workspace.getScaffoldMaterial("async-predict", "completion");
// preview.teacherOnly.notes contains answer keys. Do not display the whole object.

const bound = workspace.openProfile(profileId);
try {
  // Session and frozen active attempt have already been chosen through Learning OS.
  const presentation = bound.kernel.prepareScaffoldPresentation(sessionId, {
    packId: "js-async-await-predict",
    stage: "worked_example", // or "completion"
  });
  // Only now may the teacher show presentation.markdown.
} finally {
  bound.close();
}
```

`listScaffoldPacks()` returns published scaffold summaries, not solutions. `getScaffoldMaterial(packId, stage)` returns teacher preparation content and creates no learner state; reading it privately is not learner exposure. Before displaying any preview content, use `prepareScaffoldPresentation(...)`, or record the exact edited material with the existing `recordExposure(...)` boundary. Showing edited material while recording the original pack would create false provenance.

`prepareScaffoldPresentation(sessionId, {packId, stage, requireReconstruction?})`:

1. Validates strict input and authored pack content, bounded to 64 KiB per material file. Assets must resolve inside the course; the runtime does not execute them.
2. Requires an active, non-ended session collecting a response or presenting feedback; validates the active attempt and frozen challenge identity/version. Interview/mock scaffolding is rejected before submission and allowed during feedback.
3. Matches exactly one frozen target by concept and capability, and the challenge's task form. Imported objective IDs are supported. Wrong objectives, inactive attempts and malformed content fail without writing exposure or teaching artifacts.
4. Records the exact learner Markdown as an immutable teaching artifact and an objective-specific exposure in the same database transaction.
5. Returns learner-safe material and durable references only after commit. Teacher notes and completion solution sources are excluded.

Worked examples use `worked_example_shown`; completion prompts use `explanation_shown` because their partial solution and subgoals supply target reasoning. Before-response exposure makes subsequent performance assisted under existing evidence rules. Presentation creates no evidence or FSRS state. Post-submission feedback does not retroactively contaminate the already-submitted answer; its exposure is a later memory contact.

For causal/foundational repair during feedback, pass `requireReconstruction: true`, then save the necessary reconstruction question with the existing question operations. The flag persists the obligation atomically and is rejected before feedback. Do not use it for every minor slip or as a generic extra quiz.

After interruption, resume the session first and call `getSessionScaffoldPresentations(sessionId)` when its exposure history contains a scaffold. This read-only method retrieves the active attempt's exact persisted material without needing the current curriculum files. It creates no second exposure. Replaying an old presentation is not evidence of another learner answer. Saved subquestions and reconstruction state determine any pending response; do not regenerate a new lesson or infer stage completion from an exposure.

Existing aliases `async-predict` and `idempotency-predict` resolve to canonical pack IDs. Durable source references use the canonical knowledge path.

## Remaining implementation milestones

| Priority | Work | Acceptance boundary |
| --- | --- | --- |
| 1 — delivered | Four optional scaffold packs and durable presentation/replay | Executable examples; no answer-key leakage in presentation; assisted success does not advance FSRS; repair survives restart |
| 2 | Audit existing variants and add selected confusable contrasts | Assess the decisive mechanism on a changed surface; remove topic cues where appropriate; validate each frozen key |
| 3 | Improve targeted feedback and uncertainty handling | Feedback follows demonstrated gaps; correct-but-uncertain responses receive concise reinforcement without changing correctness; no blanket extra questions |
| 4 | Add conditional exploration/consolidation examples | Exploratory attempts precede instruction only where prerequisites allow meaningful work; consolidation relates to the learner's actual model |
| 5 — tooling delivered, pilot not run | Run a bounded learning-outcome pilot | Equivalent unseen baseline/delayed tasks, frozen rubrics, assistance history and reliable time measurements; report uncertainty and non-returners |

Each milestone needs a separate scoped change and verification. Do not implement a second selector, mastery scalar or forced five-stage lesson engine to satisfy this roadmap. Extending content to other capabilities requires appropriate task forms and executable checks, rather than reusing a prediction rubric everywhere.

## Learning-outcome evaluation

The primary outcome is delayed unassisted performance on unfamiliar tasks, adjusted for baseline ability. Also report raw scores, task difficulty and active study minutes; gain per minute alone can hide poor absolute performance. Approximate one-week and later follow-ups are pilot design choices, not a second spaced-review schedule or a reason to override FSRS.

Compare one curated scaffold policy with current teaching on matched unfamiliar objective families. Keep study time comparable, counterbalance order where feasible, and track hint depth, reveal frequency, recurring misconception and non-return. Do not treat every repeated attempt by the same learner as an independent participant. A single-learner pilot can establish feasibility and personal usefulness, not population effectiveness. Do not claim a percentage learning-rate improvement from this implementation.

This slice supplies reproducible instruction and preserves assistance provenance. A separate read-only reporting command (`npm run eval:teacher -- outcomes MANIFEST`, see [learning-outcome-pilot.md](learning-outcome-pilot.md)) computes descriptive baseline, delayed independent, change and gain-per-recorded-minute figures from a manifest. It does not run an experiment, adjust for baseline, supply reliable time instrumentation, author held-out measurement packs or show a policy effect. The delayed pilot itself has not been run, and those remain necessary before an effectiveness claim.

## Verification

`tests/scaffold-content.test.ts` verifies every pack's executable sources, exact Markdown code, worked traces and completion solutions. `tests/scaffold-material.test.ts` verifies discovery, teacher-only separation, exposure before return, wrong-target rejection, transactional failure, assisted evidence/FSRS behavior and replay after database restart without curriculum access. `tests/kernel-cli.test.ts` checks method discovery and knowledge routing outside the repository working directory.

Use `npm run typecheck`, `npm test` and `npm run build` for integration. Package privacy checking additionally requires intentionally public curriculum sources to be tracked in Git; do not weaken that gate to publish unreviewed files.
