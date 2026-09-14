# Operating the coding revision courses

Learning OS teaches programming and technical reasoning through a replaceable agent. These routes connect existing objectives to source material and practical work; they do not introduce another learning engine. For conversational execution, read [the technical revision playbook](technical-revision-teacher.md) and the canonical [teacher protocol](teacher-agent-protocol.md).

## Discover before selecting a learner

Use `createTeacherWorkspace()` with an explicit `knowledgeRoot` when not running from the repository root.

```ts
const courses = workspace.listCourses();
const frontend = workspace.getCourse('frontend-revision');
const backend = workspace.getCourse('backend-systems');
const sources = workspace.listCourseResources('frontend-revision');
```

Discovery is read-only and creates no profile or database. Course JSON and Markdown are reusable repository content. Sources have a role, URL and/or local locator. The existing sibling `js/resources.json` and `frontend-framework/resources.json` remain their source registries; no parallel resource database is created. Check `localAvailable` before using a local resource. Follow its official URL or report absence instead of pretending an unavailable file was read.

`knowledge/frontend-revision/INDEX.md` recommends the JavaScript/browser core. React, Angular and internals are independent branches, not three mandatory passes through the same idea. `knowledge/backend-systems/INDEX.md` provides seven phases, not seven calendar days. Both packs preserve the existing concept IDs.

## New learner: existing onboarding, exact scope

```ts
const draft = workspace.buildCourseOnboardingProposal({
  courseId: 'frontend-revision',
  unitIds: ['f02'],
  intake: learnerSuppliedIntake,
  now: new Date().toISOString(),
});
```

Omitting `unitIds` selects the course's declared default units, not every branch. The wrapper maps only selected concept/capability pairs to existing `mustCover` intake. Existing learner exclusions, experience and additional requested targets remain explicit inputs. Inspect the returned proposal and unresolved questions; do not assume a full course is automatically feasible or already confirmed.

Use the existing confirmation/application boundary after the learner adopts the proposal. Onboarding still requires its learner-owned information; one-episode continuation does not silently invent an onboarding budget. Prior experience may select diagnostic/revision strategy but never creates mastery.

## Existing learner: reconnect, do not recreate

Open the intended profile with `workspace.openProfile(profileId)`, then recover its existing goal and continuation. Do not create a replacement profile just to attach a new course.

`bound.attachCourseReferences({goalId, courseId})` fills missing reference paths for matching existing goal concepts and their prerequisite closure. It preserves nonempty existing paths, concept identity, ownership, prerequisites, evidence, scope and review state. The result lists linked and preserved references. It does not enroll new targets or overwrite a custom source selection.

`bound.getCourseProgress(goalId, courseId)` shows phase targets and their actual selected/state information. Course target IDs name concept/capability pairs; the returned state retains the learner's actual objective ID, including imported IDs. An unselected capability remains unselected. `completionClaim: false` means the view itself does not certify course completion; inspect effective evidence/receipts and the goal's real requirements.

`bound.setCourseStudyFocus({goalId,courseId,unitId})` chooses only currently active objective IDs from that unit. It does not activate missing capabilities. If the learner explicitly adopts a missing practical capability, create it through `kernel.createLearningObjective(...)` and `setGoalObjective(...)` with the existing concept identity and intended requirements. Preserve all existing settings when editing a goal-objective record; the setter is not a partial-patch API.

Keep existing active work first. A new course reference is not permission to erase an open attempt or required reconstruction. The backend's historical Day 1 focus remains valid historical intent even though the reusable route calls it a phase.

## One useful episode without a fictional clock

```ts
const continuation = bound.kernel.getStudyContinuation({
  goalId,
  now: new Date().toISOString(),
  oneEpisode: true,
});
```

For these revision routes, use this explicit one-step request when there is no actual minute allowance. It resumes unfinished work first; otherwise it asks the existing planner for at most one item. The returned episode mission uses `workLimit: 'one_episode'` and null available/planned/unallocated minute totals. An item's estimated size is not promised duration or consumed time. Never convert tool latency, a break or that estimate into learner active time.

A real time allowance uses `availableMinutes` instead. The two inputs are mutually exclusive. Omitting both preserves the original `needs_budget` behavior. The agent/admin CLI exposes `tutor continue <goal> --one-episode`; normal learners do not need to type it.

One episode includes its necessary feedback/repair and may span several turns. It does not mean infinite questions, automatic mastery or a fixed amount of study. After closure, call continuation again. Respect existing standing continuation consent rather than asking for the same permission repeatedly.

## Practical work and valid evidence

Each pack has `LABS.md` and small original deliberately faulty starters. Exercises and scratchpads are optional: copy a selected file to a disposable learner workspace only after the learner adopts that practical work or under an applicable standing instruction. Otherwise continue conversationally. Freeze the actual capability, environment, criteria and permitted help before the learner answers. A cold prediction precedes decisive execution. The learner must own the target reasoning; agent-written code does not establish independent implementation.

Node models do not prove browser/framework or PostgreSQL behavior. Run the environment needed by the frozen claim, or report the narrower evidence actually available. Keep regression checks of Learning OS separate from teaching labs. Never manufacture results or weaken evidence rules because setup failed.

## Notes and return points

Use `getRevisionNoteContext({scope})` and `saveRevisionNote({context,markdown})`, passing the context unchanged. A note request or standing note preference permits a compact note after meaningful closure, not a full transcript after every turn. Retain the learner's actual model/error, one useful example, a boundary and a recall prompt; omit unsupported sections.

Use current focus or historical focus-episode scope for phase notes. Notes stay derived snapshots and can become stale. Viewing answer-bearing notes during an active cold attempt needs the normal exposure handling. Saving a note does not itself show it or create retrieval evidence.

## What stays unchanged

The five programming capabilities, frozen authoring contracts, one-evidence-event-per-objective rule, reconstruction, append-only corrections, goal-local scope and FSRS scheduling remain authoritative. No language-level rubric, source-question completion percentage, automatic interview certificate or secondary spaced-review calendar is introduced.
