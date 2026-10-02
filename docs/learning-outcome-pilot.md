# Learning-outcome pilot (proposed)

Status: proposed design plus read-only reporting tooling. **No pilot has been run.** Passing software tests shows the report is computed as described; it does not show that any teaching policy improves learning. The delayed follow-up is a human, time-dependent step.

This implements the "run a bounded learning-outcome pilot" milestone in [scaffold-fading-pilot.md](scaffold-fading-pilot.md), following [pedagogy-priorities.md](research/pedagogy-priorities.md). Existing dogfood counts (`metrics`) describe activity, not teaching effectiveness.

## Question and conditions

Does a curated scaffold sequence (worked example, completion, then independent work) lead to better **delayed, unassisted** performance on unfamiliar tasks than current teaching, at comparable study time?

| Condition | Teaching |
| --- | --- |
| `current_teaching` | The teacher's present policy, without the curated scaffold packs |
| `curated_scaffold` | The same teacher, offering the pack's worked example and completion where the learner needs help |

Everything else is held constant: teacher, delivery context, objective family difficulty, feedback style and total study time.

## Design

- **Matched objective families.** Choose pairs of unfamiliar objectives of similar difficulty (for example promises and transaction traces). Assign one of each pair to each condition. Record each pair's difficulty rating before teaching; report it, do not tune it afterwards.
- **Counterbalance.** Alternate which family receives which condition and which is studied first (`AB` / `BA`) across learners where feasible. Record the order in `taskDesign.order`. With one learner, order and family effects cannot be separated from the condition; say so.
- **Baseline.** Before teaching, give an equivalent unseen task per objective. Use the existing frozen-challenge flow so the result is an ordinary evidence event with no help.
- **Delayed task.** After roughly one week, give a different unseen task from the same task form and difficulty. Never reuse the baseline or teaching code. Follow-up timing is a pilot choice, not an FSRS replacement; the scheduler continues to own review.
- **Frozen rubrics.** Write and freeze each rubric (and, for executable tasks, the checking source) before teaching. Keep held-out task text outside `knowledge/` so normal curriculum discovery, packaging and scaffold lookup never expose it.
- **Study time.** Record `activeTimeSeconds` when submitting each study attempt. Keep total study time comparable between conditions. Time that was not recorded stays unknown.
- **Secondary measures** (read from existing records, not scored here): hint depth, reveal frequency, recurring misconception, return.

## Held-out materials

Store baseline and delayed task text, rubrics and answer keys in a directory outside the repository's `knowledge/` tree. A manifest may name it in `heldOutMaterialsDirectory`; the loader rejects a path inside the curriculum. The reporting tool never reads that directory.

## Reporting tool

```bash
npm run eval:teacher -- outcomes MANIFEST.json [AS_OF_ISO]
```

The command opens each database read-only and prints JSON. It writes no evidence, review cards, schedules or mastery state. Keep manifests and databases outside Git; manifests use anonymized identifiers only.

### Manifest

```json
{
  "version": 1,
  "pilotId": "pilot-1",
  "databases": { "learner-01": "../private/learner-01/tutor.db" },
  "heldOutMaterialsDirectory": "../private/held-out",
  "entries": [{
    "entryId": "L01-promises",
    "learnerRef": "L01",
    "objectiveRef": "OBJ-A",
    "condition": "curated_scaffold",
    "database": "learner-01",
    "taskDesign": { "form": "runtime_trace", "difficulty": "medium", "order": "AB" },
    "baseline": { "evidenceId": "<evidence event id>" },
    "followUp": { "evidenceId": "<evidence event id>" },
    "intendedFollowUpDate": "2026-10-09",
    "studyTime": { "attemptIds": [12, 13, 14], "minimumCoverage": 1 }
  }]
}
```

Use `"followUp": null` until the learner returns. Relative database paths resolve against the manifest's directory. `studyTime.attemptIds` are the study-period attempts in the same database; `minimumCoverage` is the fraction of them that must carry recorded time before the total is used.

### What it reports

Per entry: baseline and follow-up result and score, whether each was independent, hint level and pre-response exposures, the actual elapsed days between assessments, how late the follow-up was against the intended date, recorded active time, and any notes. Per condition: counts by follow-up status and descriptive means, each with its own n.

- **Corrections.** An invalidated evidence reference is followed to its corrected replacement; an invalidated reference with no replacement is reported as `invalidated` and excluded.
- **Assistance.** A follow-up counts as independent only when the kernel recorded valid retrieval with no hint and no pre-response exposure. An assisted follow-up is listed as `assisted`, not as independent success, and is excluded from the delayed-score mean and from change. An assisted baseline is likewise excluded from change.
- **Missing follow-ups.** `not_returned` (due, no evidence) and `pending` (not yet due) are counted, never scored as success or zero.
- **Time.** Taken only from `attempts.time_spent_seconds`. Unknown (null or missing attempts) is never counted as zero and never replaced by wall-clock duration. If coverage of the declared attempts falls below `minimumCoverage`, usable time is reported as unknown. A recorded zero is a value but gives no per-minute rate.
- **Scores.** `correct` 1, `partially_correct` 0.5, `incorrect` 0, `ungradable` unscored. This is a coarse convention; report raw results alongside any score.

### What it does not do

`simpleChange` is later minus earlier score, with gain per recorded study minute where time is usable. It is **not** baseline-adjusted, and the report states `baselineAdjustment: "not_performed"` and `causalClaim: "none"`. A genuine adjustment (for example modelling the delayed score on the baseline, condition, order and difficulty) needs a separate model specified before looking at outcomes. Do not read raw gain per minute alone: it can reward learners who already knew the material and hide weak absolute scores, so report it next to raw baseline and delayed scores.

## Running it (human steps)

1. Prepare and freeze the matched baseline and delayed tasks outside the repository.
2. Run baselines, teach each objective under its assigned condition, recording active time on every study attempt.
3. Wait roughly one week; run the delayed tasks without help.
4. Build the manifest from the recorded evidence ids and study attempt ids.
5. Run `outcomes`, report non-returners and assisted follow-ups, and review the notes before interpreting any means.

## Limitations

A single learner can show feasibility and personal usefulness, not a population effect. Small samples, imperfect matching, order and family effects, grader error and unrecorded study time can each outweigh a real difference. Treat results as direction-finding.
