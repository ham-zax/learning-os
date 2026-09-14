# Coding revision course delivery — 2026-09-05

Status: Delivery record reconciled against the staged checkout on 2026-09-14. This document records implementation and observed state, not learner readiness or an accepted specification for future work.

## Delivered scope

- `knowledge/frontend-revision/`: eight available units, with three default JavaScript/browser core units, separate React and Angular branches, and an optional React-internals branch. Thirty-seven concept references and two original teaching starters.
- `knowledge/backend-systems/`: seven conceptual phases, twelve concept references, and two original concurrency/retry starters. Phases are not prescribed calendar days.
- Course manifests, source locators, selective onboarding proposals, reference attachment, derived progress, and active-unit focus use existing workspace/kernel boundaries.
- `getStudyContinuation({ goalId, now, oneEpisode: true })` resumes existing work first or selects at most one task without inventing a time allowance. Episode budget totals are null; supplied numeric budgets retain time fitting. The CLI exposes `--one-episode`.
- Conversation remains the primary learning interface. Exercises and scratchpads require learner adoption or an applicable standing instruction. Course availability does not automatically activate every capability or authorize exercise setup.

Source registries remain with their existing owners. Descriptive course material and the four intentionally faulty starters do not establish learner competence. A Node concurrency model does not establish database, browser, React, or Angular correctness.

## Canonical learner-state changes included with the course wave

The review compared the current canonical database contents with `440be26ab63d27aaec124a2119ce866762b6cb11`, using read-only SQLite connections and temporary copies of the committed baseline.

- Frontend has 35 active goal objectives, including the two added implementation targets, and 37 attached course references. Fourteen existing objective records changed diagnostic/preparation metadata. A new study-focus episode is present.
- Backend retains its 16 active goal objectives and has 12 attached course references. Goal/topic planning metadata changed to retire the previous deadline and intensive time allowance.
- Attempts, sessions, assessment evidence events/revisions, review cards/events, and hint observations were unchanged relative to that baseline for both profiles.
- The frontend database contains two additional exposure rows and two corresponding teaching artifacts. Each profile contains one revision note that was absent from the baseline. These pre-existing staged changes were preserved; this review did not create teaching exposure or generate learner notes.
- Both databases advanced from schema version 15 to 16 through the existing migration path. Migration 16 explicitly discards old goal-unscoped authoring contracts; the frontend's one former V1 contract is consequently absent. The frozen challenge and attempt remain. This is an existing migration behavior, not a new course migration.

The earlier two delivery narratives disagreed about whether notes and exposures changed and where private backups were retained. Those unsupported blanket preservation and backup-location claims have been removed. This consolidated record states only the comparison established during review. It does not infer that an exposure was shown merely because a row exists, or reinterpret the learner's historical interactions.

Canonical databases are versioned under the repository policy and must be checkpointed before staging. SQLite sidecars remain untracked. The accidentally staged zero-byte `data/tutor.db` placeholder was removed; it was not a usable legacy learner database.

## Staging-review corrections

- Course progress and focus resolve targets by concept/capability and preserve imported objective IDs, instead of assuming every learner uses the course's canonical ID spelling.
- Canonical and portable teacher guidance now explicitly preserve optional exercises, conversational alternatives, and standing learner authorization.
- The detailed learning-experience findings are linked from the documentation index; their proposed future implementation remains separate from this course wave.
- Regression checks cover imported objective IDs, selective read-only course proposals, reference attachment, path containment, episode selection, actual minute limits, CLI bounds, and resume-first behavior.

## Verification scope

The review checks source/runtime contracts, course structure, local link integrity, and database integrity. It does not certify every external reference's current contents, all framework versions, measured learning gains, or the learner's interview readiness. Runtime-dependent teaching still requires the declared environment and prospective frozen criteria.

See [course operations](coding-courses.md) for current usage and the [learning-experience review](learning-experience-review-2026-09-14.md) for the prioritized future work. This record does not imply a remote push or deployment.
