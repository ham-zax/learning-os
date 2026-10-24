# Progressive teacher instructions

Status: Implemented with bounded routing and static checks. The user authorized implementation after the instruction audit.

## Scope and baseline

The entry path contains 21,774 words across AGENTS.md, the teacher skill, and the repository protocol.
The skill repeats detailed procedures that the protocol already owns.
The ad-hoc evaluator also requires a question where current teaching instructions make questions optional.

Decision: change the instruction loading boundary and that evaluation criterion.
Keep the current kernel, CLI, persistence, scheduler, assessment contracts, and presentation helper unchanged.
Do not add a policy engine, state machine, external reviewer, or another learner model.

The baseline is `main` at `25786a7` plus the user's existing uncommitted efficient-teaching changes.
Preserve those installation, execution, visualization, and ad-hoc boundaries in the new entry point.
Do not stage or commit the mixed working tree during this task.

## Ownership and implementation

1. Make `skills/learning-os-teacher/SKILL.md` the short executable entry router.
   Keep authority, route selection, essential permission/evidence boundaries, and conditional references there.
   Remove detailed lifecycle duplication only where `docs/teacher-agent-protocol.md` already provides the procedure.
2. Make protocol loading conditional in AGENTS.md and in the protocol itself.
   Link the active section rather than requiring the full manual at session entry.
   Preserve authoritative checkout checks and current profile-bound continuation before teaching.
3. Route from existing `StudyContinuation`, `QuestionPresentation`, `SessionFeedback.nextAction`, and `PedagogyDirective` values.
   The model still interprets learner intent. It must not display a saved question without reconciling the latest message.
4. Keep the portable protocol as the explicit fallback when repository documentation is unavailable.
   Do not load both protocol versions. Do not claim connected tracked teaching if its required state is inaccessible.
5. Make the broad ad-hoc evaluation criterion accept a sufficient explanation without a question.
   Do not weaken criteria for learner-state truth, source support, exposure, or tracked challenge correctness.

## Preservation map

- Environment and profile selection: repository protocol, environment-routing reference, and entry safeguards.
- Onboarding: repository protocol's Onboarding workflow.
- Saved questions and response identity: Present the saved question and Preserve question identity.
- Assessment, feedback, and reconstruction: Adapt feedback to the actual answer and kernel contracts for the active operation.
- Challenge selection, authoring, calibration, and stale intent: Challenge authoring, Review an inherited frozen challenge narrowly, and Assessable challenge lifecycle.
- Study preferences, practical-work consent, revision notes, and interview signals: their existing named protocol sections.
- Teaching techniques: existing reasoning, debugging, implementation, and performance playbooks, selected only for the current need.
- Installation and ordinary-lesson visual limits: concise entry safeguards and existing research/presentation references.

## Checks and stopping

TDD Route: off / skipped. No test creation or test changes are planned.
Use document link and heading checks, a same-cause reference scan, and TypeScript checking for the changed evaluator text.
The skill-editing workflow requires behavior validation. Compare three synthetic routing cases before and after the edit with the same Pi model.
The worker reads instructions only. It must not access learner databases, install dependencies, or execute proposed learner actions.
These cases check ad-hoc consent, response identity, and exposure-before-answer. They do not establish general model reliability.

Finish when the short entry routes to the existing authoritative procedures, no default path still mandates reading the full manual,
the evaluation wording agrees, and the bounded checks pass. Report actual context reduction and remaining validation limits.

## Result

- The main skill is now 103 lines and 1,573 words, down from 510 lines and 8,885 words.
- AGENTS.md plus the main skill now contain 3,134 words. The prior mandatory AGENTS/skill/protocol set contained 21,774 words.
  The protocol remains an authoritative on-demand manual. These document counts exclude the current procedure and curriculum, host prompts, and tool results.
- The web starter prompt and environment reference use the same conditional-read boundary.
- Existing lifecycle sections retain onboarding, calibration, response identity, feedback, reconstruction, practical-work preferences, revision notes, and interview guidance.
- The ad-hoc evaluation criterion now accepts a sufficient explanation without a question.
- A small-model check used two fresh read-only Pi sessions with `mimo-v2.6-flash-free`, at maximum supported effort, and the same three synthetic cases.
  Both returned the expected installation/question decisions, saved response sequence, and exposure-before-reveal action.
  The baseline read the 8,885-word skill. The candidate read the then-current 1,553-word skill plus selected procedure sections.
  The candidate still read some unnecessary presentation guidance; its trigger was subsequently narrowed.
  It also requested clarification of answer-reveal closure; the canonical exposure section now explicitly distinguishes reveal from submission or abandonment.
- Relative links and section anchors resolved. Skill frontmatter parsed. TypeScript checking and whitespace checking passed.
- No automated tests, live teaching session, learner-state operation, package installation, or kernel change occurred.
  The two worker sessions completed their read-only checks and were closed. No further delegation is needed.

The sampled decisions do not establish general model reliability or a latency improvement. The last two wording clarifications received static review only.
Global host instructions and skill catalogs remain outside this repository change. Existing uncommitted work remains uncommitted.
