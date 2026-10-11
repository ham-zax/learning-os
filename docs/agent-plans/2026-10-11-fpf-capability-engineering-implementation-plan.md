# Mechanism-aware Practice and Teacher Support Implementation Plan

**Goal:** Add code-level facilities for defensible practice-task authoring, contextual instructional-support recommendations, five-capability scaffold delivery, and offline quality inspection, without a second learner-state or study-planning system.

**Architecture:** Human/AI authors propose non-durable task candidates; a pure validator and teacher-bound read-only adapter return findings before the established `registerChallenge(challenge, intent)` boundary. A bounded pure advisory helper interprets already available intent/feedback and returns support choices, never automatic actions. A generalized content loader exposes optional, safe-to-replay instructional material under the current exposure kernel, and offline evaluation reports keep mechanical findings apart from review judgments and independent learning evidence.

**Tech Stack:** TypeScript, Zod, Node 22+, SQLite via existing `better-sqlite3`, established CLI/kernel APIs, Markdown/JSON source packs. No required model provider, new DB table, package dependency, FPF server or runtime FPF corpus.

**Research/design companion:** [2026-10-11-fpf-capability-engineering-design.md](2026-10-11-fpf-capability-engineering-design.md). Read first for rationale, original FPF pattern sources, external research caveats, and ownership decisions. This is an implementation plan, not an instruction to execute the work during planning.

**Baseline:** Canonical WebHarness ARM `/home/ubuntu/repo/learning-os`; inspected `main` at `3a65c44bf398f99380f60911e8673b09d5fc7ae6`. This plan was written without altering application code, curriculum, learner state, or executing tests.

## Global Constraints

- Use WebHarness **ARM** for every Learning OS repository/CLI/kernel/file/Git operation; do not switch to the normal WebHarness server or `/home/hamza/repo/learning-os`.
- Preserve accepted `docs/decisions/0005-authority-transitions.md`, `docs/kernel-contracts.md`, `docs/architecture.md`, `docs/evidence-model.md`, `AGENTS.md` and `docs/teacher-agent-protocol.md` authority. Contracts win over plans.
- Do not modify `src/selection/`, `src/scheduler/`, `src/kernel/evidence.ts`, `src/kernel/foundation.ts`, `src/plan/today.ts`, or managed `data/profiles/**` for this wave. No new scheduler, evidence projection, objective selector, profile or generic stored teacher hypothesis. If a required behavior cannot be achieved without altering one of these boundaries, stop that task and document the exact contract conflict rather than quietly bypassing it.
- Exactly five existing capabilities (`explain|predict|implement|debug|design`) and five task forms (`explanation|runtime_trace|implementation|debugging|design`). An authoring candidate must not choose a different goal/objective/task form/novelty from the selected `ChallengeIntent`.
- Preserve immutable selected `ChallengeIntent`/authoring-contract semantics, challenge and rubric freezing, actual response text, assessment and correction owner, hint/exposure-before-visible-reveal, `requireReconstruction` for causal repair, interview/mock assessment-first policy, session continuation, FSRS timing and learner consent.
- Ad-hoc chats stay ephemeral unless the learner explicitly promotes curriculum/evidence; no inferred durable capability from self-report, language fluency, assisted practice or generated artifacts.
- Use one canonical skill source (`skills/learning-os-teacher`); `.agents` and `.claude` links already refer to it. Keep the portable protocol copy and docs protocol consistent; no giant FPF appendix in main `SKILL.md`, no FPF library at runtime.
- Sole-user project, coherent direct work, no feature flags, second experimental platform or formal A/B requirement. No automatic untrusted-code execution. No secret/personal data in generated content or reports.
- Existing sibling plan `2026-10-11-implementation-plan.md` still has unchecked pack audit and replay/verification tasks. Integrate its unfinished audit rather than claiming it has been completed. Do not rewrite committed historical plans as if they were implementation evidence.

## File map and responsibility (before tasks)

| File | Action | Sole responsibility |
| --- | --- | --- |
| `docs/research/pack-variant-audit.md` | Create | Review the existing 18 cases and 4 scaffold packs before modification; declare keep/repair rationale and execution oracles. |
| `src/knowledge/practice-design.ts` | Create | Provider-neutral Zod schema and types for a candidate + its teacher-only causal contrast/oracle metadata. |
| `src/knowledge/practice-quality.ts` | Create | Pure candidate-vs-intent, contrast, novelty, rubric, duplicate-surface and answer-leakage findings; no writes/LLM/runner. |
| `src/knowledge/challenge-calibration.ts` | Modify | Adapt existing calibrated prediction packs into candidate review, preserve same/variant/transfer selection and build paths. |
| Six existing `knowledge/*/challenges/*/calibration.json` files | Modify | Explicit decisive condition/contrast metadata, kept private and consistent with existing frozen criteria. |
| `src/teacher.ts` | Modify | Read-only teacher-facing entry points for candidate review and instructional-support options. |
| `src/teacher-support.ts` | Create | Pure, bounded instructional-support advice from intent, directive, feedback, explicit observation and available material. |
| `src/knowledge/scaffolds.ts` | Modify | Discover old prediction-attached and new standalone scoped scaffolds, validate optional named stages, produce safe material. |
| `src/kernel/scaffolds.ts` | Modify | Preserve presentation safety; replay stage from stable source path instead of inferring stage from exposure type. |
| `knowledge/backend-systems/scaffolds/database-transactions-debug/` | Create | One curated `debug/debugging` example grounded in an existing backend concept. |
| `knowledge/backend-systems/scaffolds/state-ownership-design/` | Create | One curated `design/design` example grounded in an existing backend concept. |
| `knowledge/frontend-revision/scaffolds/js-promises-implement/` | Create | One curated `implement/implementation` example grounded in existing JS promises concept. |
| `knowledge/frontend-revision/scaffolds/js-async-await-explain/` | Create | One curated `explain/explanation` example grounded in existing JS async concept. |
| `src/evaluation/practice-quality.ts` | Create | Offline aggregation/formatting of task-quality findings without pretending to grade learning. |
| `src/evaluation/cli.ts` | Modify | Expose offline practice-quality review via the existing `eval:teacher` shell surface. |
| `docs/teacher-agent-protocol.md` | Modify | Specify when agents ask for review/advice, how to keep solution metadata private, when to avoid extra support. |
| `skills/learning-os-teacher/SKILL.md` | Modify minimally | Point to selective practice authoring/support guidance, not repeat a full method. |
| `skills/learning-os-teacher/references/teacher-protocol.md` | Modify | Portable summary of the same safety/purpose boundaries. |
| `skills/learning-os-teacher/references/problem-solving-implementation-playbook.md` | Modify minimally | Show how selected intent flows through candidate review and application for `implement/debug/design`. |
| `docs/coding-courses.md` | Modify | Document new standalone scaffold directory convention and authoring constraints. |
| `docs/teacher-evaluation.md` | Modify | Define what offline candidate reports prove and don't prove. |

Never place teacher-only solutions in learner-facing Markdown or `publicPrompt`. New content additions go through the existing `knowledge` discovery and package privacy rules. No new `src/db/*` files or schema migrations in this plan.

## Interfaces to implement exactly

The following is the intended public shape; use the existing `ChallengeIntent`, `ChallengeSpecInput`, `PedagogyDirective`, `SessionFeedback` and `TaskForm` types rather than duplicating their enums.

### Candidate and review (`src/knowledge/practice-design.ts`, `src/knowledge/practice-quality.ts`)

```ts
interface PracticeCandidate {
  intent: ChallengeIntent;                // exact selected object; retain goalId/weakness/avoidance
  proposedChallenge: ChallengeSpecInput;  // frozen only after review + registerChallenge
  targetRelation: string;                 // teacher-only subject claim to examine
  contrasts: Array<{
    condition: string;                    // decision-bearing difference for this contrast
    observable: string;                   // exact output slice, criterion, invariant, or consequence
    correctPrediction: string;            // expected result projected onto that same observable
    rival: { claim: string; predicted: string }; // rival projection on the SAME observable
  }>;
  variation: {
    anchor:
      | { kind: "published_case"; packId: string; caseId: string }
      | { kind: "frozen_challenge"; challengeId: string; version: number }
      | null;
    changedCondition: string | null;
    changedApplication: string | null;
  };
  oracle: {
    basis: "trusted_execution" | "frozen_rubric" | "human_review" | "mixed";
    sourceRef: string;                    // authorized and reviewable; never solution in prompt
    expectedOutput: string[] | null;      // proposed private oracle; not independently verified
  };
}

type PracticeFindingCode =
  | "intent_mismatch" | "rubric_invalid" | "missing_contrast"
  | "rival_not_discriminated" | "changed_condition_unproven"
  | "recent_surface_reused" | "answer_leakage" | "oracle_unverified"
  | "semantic_review_required";

type PracticeReview = {
  disposition: "blocked" | "needs_review" | "structurally_ready";
  findings: Array<{ code: PracticeFindingCode; explanation: string }>;
  challenge: ChallengeSpecInput | null;   // null if blocked
};

function reviewPracticeCandidate(input: {
  candidate: PracticeCandidate;
  recentPrompts: readonly string[];
  anchorContext?: { publicPrompt: string; targetRelation: string } | null;
  trustedExecution?: {
    sourceRef: string;
    actualOutput: string[];
    exitCode: number;
    verifier: "curated_fixture" | "authorized_runner";
  } | null;                                // supplied by trusted host adapter, never candidate JSON
}): PracticeReview;
```

- `PracticeCandidateSchema` must parse the same nested shape at runtime; use Zod `.strict()` and explicit nonempty bounded fields. Reject unsafe path traversal in any path used to open curricular material through `codingCourseFile` / `safe-path` existing owner.
- `reviewPracticeCandidate` checks intent/target/novelty/context alignment and frozen criterion references using already available `ChallengeSpecSchema` and `ChallengeIntentSchema`. It does not attempt to determine why a human actually answered a question incorrectly.
- Require at least one contrast. For `rival_not_discriminated`, compare **each rival to the correct prediction on the exact same declared observable**, after whitespace normalization. A syntactic difference alone does not prove semantic discrimination: retain `semantic_review_required` unless the observable and predictions are independently grounded. A candidate can have multiple wrong models with distinct output slices; never compare a `predictedFinal` string with a full trace as though they were the same observable.
- `candidate.oracle.expectedOutput` is **untrusted proposed data**, even when written by an AI or labeled as trusted. Only a separately obtained `trustedExecution` input from an authorized executor can establish the actual output; compare it with `expectedOutput` and check `sourceRef` equality and `exitCode===0`. The pure reviewer invokes no shell/LLM/runner. If execution is required but missing, mismatched, or failing, return `oracle_unverified` and a non-ready disposition; never guess the actual output. The `trustedExecution` envelope itself must come from the trusted host or offline curated-code verifier, not a model-authored payload.
- `structurally_ready` means only that structural blocking checks have passed, *not* approval to register a challenge without final domain judgment. `blocked` must produce `challenge:null`.
- A first `same` case has `anchor:null`. A `variant`/`transfer` anchor may be a **published calibrated case** or a **frozen learner challenge**; do not conflate catalog `caseId` with runtime `challengeId`/version. The adapter resolves published anchors from source calibration and frozen anchors through `getChallenge`; pass their known public context as `anchorContext` to the pure reviewer. A missing required anchor is `needs_review` or `blocked` depending on whether a novelty guarantee would be violated. `recentPrompts` come from `intent.avoidRecentChallenges`; failure to recover a required previous challenge is `blocked`.

### Instructional advice (`src/teacher-support.ts`)

```ts
type TeacherObservation = {
  kind: "none" | "wording_or_access" | "no_first_move"
    | "missing_relation" | "observed_wrong_model" | "integration_gap"
    | "explicit_answer_request";
  basis: "learner_request" | "assessed_response" | "teacher_hypothesis";
  evidenceEventId?: string;              // required for an assessed_response diagnosis
  criterionId?: string;                  // required when tied to a frozen criterion
};

type SupportOption = {
  kind: "none" | "neutral_rephrase" | "worked_example" | "completion"
    | "contrast" | "guided_step" | "direct_explanation";
  packId: string | null;
  stage: "worked_example" | "completion" | "contrast" | "guided_step" | null;
  reason: string;
  qualification: string;                // what the observation justifies, not mastery
  requiresExposure: boolean;            // advisory reminder; kernel enforces actual effects
};

function recommendInstructionalSupport(input: {
  intent: ChallengeIntent;
  directive: PedagogyDirective;
  feedback: SessionFeedback | null;
  observation: TeacherObservation;
  availableScaffolds: readonly ScaffoldDescriptor[];
}): { options: SupportOption[]; caveats: string[] };
```

- Expose `reviewPracticeCandidate(candidate)` and `getInstructionalSupportOptions({intent, feedbackSessionId?, observation})` on `createTeacherKernel()` as **read-only methods**. The wrapper resolves recent frozen prompts and the current `PedagogyDirective`; if `feedbackSessionId` exists, it reads `getSessionFeedback` but never performs assessment or selection. It passes the available descriptors from `listScaffoldPacks()` filtered to concept/capability/task form.
- If `feedbackSessionId` is supplied, use `resumeSession` and its active challenge/authoring contract to require the selected `goalId` and `objectiveId` to match the supplied intent before reading feedback. If the contract is absent, return an explicit scope caveat and `none`, rather than advise from a different session. If `observation.basis === "assessed_response"`, verify `evidenceEventId` belongs to that session's effective feedback objective and `criterionId` is an existing assessed criterion; without matching authoritative data, return `none`/caveat. A `teacher_hypothesis` never becomes an observed misconception by wording or type.
- For `complete_feedback` with all criteria met, prefer `none` regardless of hypothetical wish to add exercises. `explicit_answer_request` honors learner agency and sets `requiresExposure` for any answer-bearing option; the teacher calls the existing kernel before showing it. In pending interview/mock, return coaching only if feedback phase permits it. The helper never calls `prepareScaffoldPresentation`, `recordExposure`, or `openAttempt`.
- A `null` feedback result must not be interpreted as a failure, and unavailable matching scaffold packs produce a safe direct text option rather than invented pack IDs.
- The `ScaffoldDescriptor` schema comes from the generalized loader in Task 5 (below). Define the shared type there; do not create a parallel registry.

### Content and stage model (`src/knowledge/scaffolds.ts`)

```ts
type ScaffoldStage = "worked_example" | "completion" | "contrast" | "guided_step";
interface ScaffoldDescriptor {
  packId: string;
  title: string;
  objective: { conceptId: string; capabilityId: SelectionCapabilityId; taskForm: TaskForm };
  scopeNote: string;
  stages: ScaffoldStage[];             // only stages present in this pack
}
```

Legacy prediction-attached packs stay under `knowledge/<course>/challenges/<pack>/scaffold/scaffold.json` and retain their published `packId`. Independent packs live under `knowledge/<course>/scaffolds/<pack-id>/scaffold.json`; their IDs must be globally unique across both layouts. New manifests retain `version:1`, `title`, `objective`, `scopeNote`, `stages` and optional trusted executable `checks`. Unlike prediction packs, standalone manifests are not forced to declare `runtime_trace` or executable checks. Every declared stage maps to a bounded Markdown file and teacher-only notes. Use `sourceRef` to distinguish stages on replay, not only `exposureType`. Stage ID must correspond to an allowlisted material basename (`worked-example.md`, `completion.md`, `contrast.md`, `guided-step.md`) to preserve replay meaning.

## Ordered implementation tasks (one direct engineering wave)

### Task 1: Close and reuse the existing variant audit as design input

**Files:** Create `docs/research/pack-variant-audit.md`; inspect `src/knowledge/challenge-calibration.ts`, `src/knowledge/scaffolds.ts`, the six `calibration.json` files, and all four current `scaffold/scaffold.json` files.

**Interfaces:** Consumes existing `novelty`, `wrongModels`, `expectedOutput` and curated source files. Produces one source-grounded table of all 18 cases plus four curated scaffold pairs.

**Steps:**
- [ ] Enumerate all `same`, `variant`, and `transfer` cases, noting base/anchor, exact decision-changing condition, correct model, wrong-model prediction, independently executable output when applicable, and selected objective.
- [ ] Distinguish cosmetic surface changes from genuine causal changes; do not treat different console output alone as proof of changed causal reasoning.
- [ ] Record `keep`, `repair`, or `unresolved` per case with a short reason; inspect completion materials separately from frozen assessment cases and note any inadvertent answer leakage.
- [ ] If an existing case is unsound, mark repair in the audit and perform the smallest content correction in Task 3 rather than rewriting all packs blindly.

**Acceptance criteria:** Every current prediction case and curated scaffold pack has a source link/relative path and qualified verdict. Existing audit was previously *not* done; the document must not call it previously verified.

### Task 2: Add the candidate contract and pure quality reviewer

**Files:** Create `src/knowledge/practice-design.ts` and `src/knowledge/practice-quality.ts`.

**Interfaces:** Consumes exact `ChallengeIntent`, `ChallengeSpecInput`, current frozen rubric structure, recent prompt text and candidate-specific private contrast/oracle metadata. Produces `PracticeCandidateSchema`, `PracticeReview`, and `reviewPracticeCandidate(input)` defined above.

**Steps:**
- [ ] Implement strict Zod candidate/contrasts/oracle/variation schemas and useful exported types. Do not introduce a new capability/task enum or learner database field.
- [ ] Validate goal/objective/capability/task form/novelty/context; report failure with `intent_mismatch` rather than rewriting the intent. Check challenge rubric targets against the proposed intent and require criteria that can actually be assessed.
- [ ] Reject empty or mechanically identical rival consequences on their own declared observables as nondiscriminating; qualify all non-executable semantic claims as review-required. Check same/variant/transfer surface and causal delta separately; refuse same-code recent-prompt reuse when explicitly avoided.
- [ ] Scan proposed public text for **exact** teacher-only answer/rival strings and answer-key markers, emitting `answer_leakage` for direct matches. Label this as a limited leak check, not an exhaustive semantic detector.
- [ ] Return an ordered set of precise findings with `blocked`, `needs_review`, or `structurally_ready`. No DB reads, file writes, LLM calls, network, execution, or side effects from the pure function.

**Acceptance criteria:** A candidate with a mismatched objective, cosmetic-only transfer claim, identical rival result **on the same observable**, ungrounded oracle, or leaked exact answer cannot be misreported as fully qualified. The reviewer never creates a challenge or evidence event by itself.

### Task 3: Route calibrated prediction packs through the reviewer

**Files:** Modify `src/knowledge/challenge-calibration.ts`, all six `knowledge/*/challenges/*/calibration.json` files and `src/teacher.ts`.

**Interfaces:** Consumes selected prediction intent, `findCalibratedPredictionCase`, `loadCalibratedPredictionPack`, `buildCalibratedPredictionChallenge`, previous frozen prompts via `getChallenge`, and Task 2 reviewer. Produces `reviewPracticeCandidate(candidate)` in the public teacher kernel (exact name throughout); curated cases supply their explicit decision condition/contrast metadata.

**Steps:**
- [ ] Extend the `PredictionCalibrationSchema` case metadata with `targetRelation`, `decisionCondition` and `variantRelation`: `{kind:"base"}` for same, or `{kind:"changed_condition"|"changed_application", anchorCaseId:string}` for variant/transfer. Resolve `anchorCaseId` inside its **published pack**, not in the learner's challenge DB. Populate all 18 cases consistently with Task 1; do not change case IDs, valid expected outputs, or objective identities.
- [ ] Provide a small adapter mapping each existing wrong-model prediction (`predictedOutput`, `predictedFinal`, `predictedFirstUpdate`) to its **own contrast**, with the matching slice of the **proposed** correct output on the identical observable. Supply any *actually observed* output separately as `trustedExecution`. Do not collapse a partial-output prediction into a full output comparison or compare different scopes; if the correct projection cannot be derived from the pack's expected output unambiguously, return `needs_review`.
- [ ] Preserve existing discovery's `predict/runtime_trace` guard, novelty matching, recent-code-surface avoidance and `BuildCalibratedPredictionChallengeInput` signature. Review the built case before any new registration; return only verified metadata to the teacher, never into `publicPrompt`.
- [ ] Add the `createTeacherKernel().reviewPracticeCandidate` read-only adapter that resolves every required `avoidRecentChallenges` entry; if any historical challenge is missing, return a blocking finding without guessing.
- [ ] When Task 1 finds a defective calibrated case, replace only its defective source/content and align expected outputs and wrong-model predictions to trusted verification. Do not silently change previously frozen challenges in learner DBs.

**Acceptance criteria:** Six published packs remain discoverable, each with same/variant/transfer. Teacher can inspect a selected case and see causal/novelty findings before `registerChallenge`. Old already-frozen attempts keep their original rubric/source semantics; a new candidate never bypasses the goal-bound freeze authority.

### Task 4: Add read-only instructional support recommendations

**Files:** Create `src/teacher-support.ts`; modify `src/teacher.ts`.

**Interfaces:** Consumes `ChallengeIntent`, existing `derivePedagogyDirective` result, `getSessionFeedback` output (optional, read-only), `TeacherObservation`, and `ScaffoldDescriptor[]` from Task 5. Produces `recommendInstructionalSupport()` and public `getInstructionalSupportOptions()` exactly as above.

**Steps:**
- [ ] Implement the small disposition table from design §4.2; favor zero or one targeted suggestion when known facts suffice, and return `none` when the situation is underdetermined or already complete.
- [ ] Bind any optional `feedbackSessionId` to the same goal/objective through the active frozen challenge's persisted authoring contract before using its feedback. Require an exact assessed evidence/criterion match for `assessed_response` observations. Do not promote `teacher_hypothesis`, previous chat statements, or self-rated confidence into a stable diagnosis.
- [ ] Filter available packs to the already-selected concept/capability/task form. Suggest only a stage that descriptor declares; fall back to direct teacher explanation when no pack fits, not a fabricated pack.
- [ ] Express assistance/exposure as **needed action metadata**, never perform it. Honor answer requests and interview/mock restrictions by preserving existing teacher protocol behavior.
- [ ] Expose the helper through `createTeacherKernel()` without any storage migration or change to existing `getPedagogyRecommendation()`. Keep agent-specific messaging/graphics out of pure logic.

**Acceptance criteria:** `getInstructionalSupportOptions` is repeatable for identical inputs, never writes to SQLite, cannot assert mastery or choose future work, and never emits a nonexistent scaffold stage. A complete answer triggers no gratuitous pedagogical extension.

### Task 5: Generalize curated scaffolds without breaking immutable replay

**Files:** Modify `src/knowledge/scaffolds.ts`, `src/kernel/scaffolds.ts`, `src/teacher.ts` only as needed to expose generalized descriptors.

**Interfaces:** Consumes `listScaffoldPacks()`, `getScaffoldMaterial()`, `prepareScaffoldPresentation()`, `getSessionScaffoldPresentations()` and existing `recordExposure()` transaction. Produces the shared `ScaffoldDescriptor`/`ScaffoldStage` contract above, loaders for legacy and standalone layouts, and truthful persisted replay.

**Steps:**
- [ ] Discover both directory layouts using course-bound `codingCourseFile`/safe-path checks and manifest validation. Preserve all four legacy pack IDs and stage formats. Enforce unique IDs across both layouts and reject malformed/missing/oversize stage material.
- [ ] Allow each manifest to declare any nonempty subset of the four stage kinds and any of the five capabilities with matching `TaskForm`; don't impose a universal lesson sequence.
- [ ] Preserve the existing `prepareScaffoldPresentation` transaction and checks: active session/attempt, non-disposed challenge, exact objective concept+capability, task form, stage, response/feedback phase, interview/mock feedback-only, exposure record + teaching artifact before returned content. Never record exposure on a rejected presentation.
- [ ] Normalize stage identity using the allowlisted material filename when reading existing `source_ref`, recognizing both old and new layout; keep original `exposure_type` separately and return `unknown` stage for an unrecognized legacy path rather than falsely calling it `completion`. Persisted artifact content must be read from the stored `teaching_artifacts` bytes, never reloaded from the mutable source.
- [ ] Ensure source-ref path validation and selected-stage lookup reject `..`, absolute paths, wrong concept, wrong capability, wrong form, missing stage and duplicate ID. Preserve the original behavior of declined instructions and required reconstruction.

**Acceptance criteria:** Existing saved worked/completion artifacts still replay exactly after restart and when source files change or disappear. Newly added `contrast` and `guided_step` stages retain their stage identity during replay even when their exposure type matches `completion`. No external learner state is touched by discovery.

### Task 6: Supply one real nonprediction scaffold per remaining capability

**Files:** Create content trees:
- `knowledge/backend-systems/scaffolds/database-transactions-debug/{scaffold.json,worked-example.md,guided-step.md}`
- `knowledge/backend-systems/scaffolds/state-ownership-design/{scaffold.json,worked-example.md,contrast.md}`
- `knowledge/frontend-revision/scaffolds/js-promises-implement/{scaffold.json,worked-example.md,completion.md}`
- `knowledge/frontend-revision/scaffolds/js-async-await-explain/{scaffold.json,worked-example.md,contrast.md}`

**Interfaces:** Consume existing registered concept IDs `database-transactions-and-concurrent-correctness`, `state-ownership-and-cache-consistency`, `js-promises`, `js-async-await`; each manifest's matching capability+form and available stage paths. Produce four self-contained, teacher-reviewed material packs discoverable by Task 5 loader. Existing `predict/runtime_trace` packs supply the fifth capability.

**Steps:**
- [ ] Author `debug/debugging` material contrasting a concurrency hypothesis with the observation that refutes it; expose exactly the invariant and procedure needed, not a preanswered active challenge.
- [ ] Author `design/design` material that compares state ownership/invalidation alternatives on one specific consistency requirement, including limits/trade-offs and no fabricated single numeric answer.
- [ ] Author `implement/implementation` partial code/completion material for Promise return/propagation behavior, including explicit teacher-only expected result and an optional separately trusted verification artifact when appropriate. Do not treat a generated code snippet as verified merely because it parses.
- [ ] Author `explain/explanation` material that contrasts “async body immediately starts” with “async function fully deferred”, demanding the actual causal relation rather than memorized output.
- [ ] Verify new material's incidental prerequisites, semantics, objective fit, authority/privacy, stage availability and absence of another pack's assessment answer. Each `scaffold.json` contains teacher notes; learner-facing `.md` contains no teacher-only solution key.

**Acceptance criteria:** Four new packs match one of each previously unsupported capability, all discoverable without pretending to be calibrated `predict` packs. Calling the wrong pack for another objective or task form is rejected before any exposure record. Stages are useful without automatically being shown.

### Task 7: Add offline quality reporting (no learning claims)

**Files:** Create `src/evaluation/practice-quality.ts`; modify `src/evaluation/cli.ts`, `docs/teacher-evaluation.md`.

**Interfaces:** Consumes `PracticeReview` from Task 2 and existing published calibration metadata. Produces `npm run eval:teacher -- practice-quality [PACK_ID]`, a read-only report of per-case quality findings and missing/qualified oracles. Keep the existing CLI modes unchanged.

**Steps:**
- [ ] Enumerate current published prediction packs and apply Task 2 review to cases with source oracles and within-pack published-case contrast anchors. Construct an explicitly labeled **offline synthetic `ChallengeIntent`** matching each pack's concept/capability/form/novelty, solely for review; never call real learner selection, registration, or a profile database. Only for the repository's trusted, versioned `.mjs` fixtures, run the existing bounded Node source check and pass its actual output through the separate `trustedExecution` input; do not execute arbitrary candidate code. Report case ID, objective, novelty, changed decision condition, mechanically checked divergence, unresolved conceptual judgment, and findings.
- [ ] For a requested `PACK_ID`, use `resolveCalibratedPredictionPack` and inspect just that pack. For all, aggregate cases while preserving separate `blocked`, `needs_review`, `structurally_ready` counts—never invent a scalar score or causal learning gain.
- [ ] Do not run the teacher, read profiles, update `data/`, execute arbitrary generated code, print private solutions to learner-facing channels, or auto-fix authoring files. This is a developer/admin review command only.
- [ ] Extend `docs/teacher-evaluation.md` to distinguish case validity, state safety, model output calibration, teacher conversational effectiveness and actual delayed learner success. The existing `outcomes` report stays read-only and descriptive; no new condition labels that misrepresent what was studied.

**Acceptance criteria:** One command reports all six packs or one selected pack, clearly identifies missing semantic evidence, and produces zero learner-state changes. It does not claim that a teacher-model replay or executable output proves durable learning.

### Task 8: Wire agents to the new optional capabilities without swelling prompt rules

**Files:** Modify `docs/teacher-agent-protocol.md`, `skills/learning-os-teacher/SKILL.md`, `skills/learning-os-teacher/references/teacher-protocol.md`, `skills/learning-os-teacher/references/problem-solving-implementation-playbook.md`, `docs/coding-courses.md`.

**Interfaces:** Consumes `createTeacherKernel().reviewPracticeCandidate()`, `getInstructionalSupportOptions()`, `listScaffoldPacks()` and `prepareScaffoldPresentation()`. Produces a small, explicit agent workflow:

```text
selected intent -> draft candidate -> inspect quality report -> teacher/domain approval
-> registerChallenge(candidate.proposedChallenge, unchanged intent) -> attempt
-> inspect actual feedback -> choose advice if useful -> record exposure before display
-> resume/reconstruct through existing kernel
```

**Steps:**
- [ ] Add concise invocation rules: candidate review is optional for an already sound frozen case; never reject inherited valid challenge because an improved version could be prettier. Existing selected intent remains authoritative.
- [ ] Tell the teacher how to interpret `blocked`, `needs_review`, `structurally_ready` and private model metadata without leaking the key or treating structural success as subject truth.
- [ ] Explain that the support helper supplies options, not automatic intervention; a learner changing the question is not a graded misconception; an explicit request for a refresher/answer or ad-hoc exploration still follows current consent and ephemeral rules.
- [ ] Document new scaffold directories, source-ref/stage semantics, allowed manifests, and exposure/replay responsibility. Keep the portable and repo protocols semantically aligned without pasting the implementation plan into either.

**Acceptance criteria:** A fresh provider-compatible teacher can find the new APIs and use them without opening an unauthorized new attempt or silently writing learner history. The Teacher skill remains compact and source-first; no model/vendor-specific tool requirements appear.

### Task 9: Close the implementation with the repository's existing integration contract

**Files:** Update *only this implementation plan's* completion record/checklist and the Task 1 audit when work is actually done; do not rewrite already committed lesson history.

**Interfaces:** Consumes tasks 1–8 and existing required repository integration checks from `docs/scaffold-fading-pilot.md` and the package's `prepublishOnly` contract.

**Steps:**
- [ ] Confirm public `createTeacherKernel` signatures, shared Zod types, and changed manifest shapes are consistent. Inspect that the pure reviewers/adviser cannot mutate evidence, select objectives, or schedule cards.
- [ ] Perform the mandated integration checks for scaffold changes: `npm run typecheck`, `npm test`, and `npm run build` (see `docs/scaffold-fading-pilot.md`). If this wave is intended for package publication, also use `npm run check:package` (package prepublish contract). Treat the existing evaluation and calibrated content checks as bounded tools, not human learning efficacy proof.
- [ ] Check `git status` for unauthorized paths (`data/`, secrets, source-key fixtures), verify symlinks still target the single canonical skill, and record any deliberate nonpassing checks accurately rather than declaring success.
- [ ] Optionally review a small synthetic reply set from the existing teacher evaluation scenarios and old trigonometry/meditation examples for needless prompting and safety; these replays are not equivalent to delayed independent learner outcomes. The prior unfinished plan owns its original replays and must not be silently closed by this work.
- [ ] Document any narrower implementation or unsolved oracle/replay edge case in this plan; make no learning-performance promises. Commit only after completed work has an inspectable diff, and push only when explicitly requested.

**Acceptance criteria:** No accidental modification of real learner state; repository typecheck/test/build integration contract passes or exceptions are explicitly documented; package gate passes if shipping; docs and feature names match actual exported APIs; only done tasks are checked off.

## Dependency order, branch points, and stop conditions

- Tasks **1 → 2 → 3** create auditable candidate review, with Task 1 determining whether old packs need repair. Task **5 → 6** enables five-capability material. Task **4** consumes Task 5's `ScaffoldDescriptor`; it may be coded after Tasks 5–6 despite its conceptual order here. Task **7** consumes Task 2 and Task 3. Task **8** follows the stabilized interfaces; Task **9** closes the wave.
- **Source-grounding branch:** If a proposed practice task has no defendable oracle, return `needs_review`; do not make up expected output or substitute a model's fluent explanation for subject truth.
- **Execution safety branch:** Existing trusted curated code may run through the repo's established checks. Arbitrary agent-generated code has no automatic execution permission; request a separate isolated execution plan if verification requires it.
- **Multi-target branch:** This wave primarily authors single-objective cases. Existing kernel accepts more complex challenges, but reviewer must mark them `needs_review` unless it can explicitly preserve every selected contract and rubric association. Do not flatten multiple assessed objectives into one private “skill score.”
- **Historic state branch:** Do not reclassify old exposure stages using a new content file; infer from stored `source_ref` only when recognized, and expose `unknown` otherwise. Never update old `teaching_artifacts` bytes.
- **Scope branch:** If coverage of `implement/debug/design/explain` requires adding new task forms or scheduling logic, stop and reconsider the design. The task-form vocabulary already covers them.
- **Provider portability branch:** An agent lacking the new advisory call or qualified source material still uses existing protocol. No second app-specific teacher.

## Done checklist (all unchecked until implementation)

- [ ] 18-case / four-scaffold source-grounded audit completed, with keep/repair decisions.
- [ ] Candidate/contrast schema and side-effect-free quality reviewer implemented.
- [ ] All six published prediction packs integrate reviewed causal/novelty metadata without changing frozen historical attempts.
- [ ] Read-only teacher support advisory uses real assessed context, handles uncertainty, and never chooses new work.
- [ ] Generalized scaffold loader and immutable replay work for both path layouts and stage kinds.
- [ ] Four nonprediction scaffold packs are discoverable, correctly scoped and safely presented.
- [ ] Developer-only practice-quality reporting distinguishes structural checks from semantic judgment and outcomes.
- [ ] Teacher skill, portable protocol, repository protocol and coding-course docs describe one coherent behavior.
- [ ] Required integration checks and worktree/privacy inspection completed, with results recorded.

**Out of scope:** FPF MCP/runtime integration; a generic vector knowledge index; new learner/proficiency/scheduler tables; authoring new objectives without authorization; an LLM-controlled autonomous lesson planner; real-user experiments or formal A/B infrastructure; migration of archived learner DBs; every other FPF publication. Reconsider these only in a separate task justified by a concrete failure.
