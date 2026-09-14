# Durable Question Presentation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline for the approved implementation. No delegation is needed.

**Goal:** Resume a concrete self-contained question in response and reconstruction phases without automatically repeating teaching.

**Architecture:** Extend attempt subquestions rather than introduce a second episode store. Isolate question persistence/presentation in `src/kernel/questions.ts`; preserve foundation exports and expose the new operations through the teacher and continuation boundaries.

**Tech Stack:** TypeScript, better-sqlite3 migrations, Zod, Vitest.

**Spec:** [Approved design](question-presentation-design.md).

## Global constraints

- Existing frozen assessment/evidence/scheduling ownership stays authoritative.
- Exercises remain optional; context complaints are not assessed responses.
- Preserve the user's existing skill edit and canonical learner state.
- No external-agent output guarantee or invented recovered history.

## Task 1: Persist and present questions across repair

Files: `src/db/database.ts`, `src/db/types.ts`, new `src/kernel/questions.ts`, `src/kernel/foundation.ts`, `src/teacher.ts`, `src/study/continuation.ts`, new `tests/question-presentation.test.ts`, existing subquestion tests.

- [x] Write a regression using a temporary fixture: assess an incorrect response, record reconstruction-required exposure, open a question with context, replace it by sequence with atomic chunking, reopen the DB and compare `continuation.presentation.markdown` exactly. Assert it excludes the teaching text and no evidence/card changes occur.
- [x] Run `npm test -- tests/question-presentation.test.ts` and observe the missing boundary fail.
- [x] Add migration 18 fields `purpose`, `context_text`, `question_chunking`, `superseded_at`; replace pending-index and active-phase/immutability guards. Preserve migration 17.
- [x] Implement `openAttemptSubquestion`, `replaceAttemptSubquestion`, `answerAttemptSubquestion`, `getAttemptSubquestions`, `getSessionQuestionPresentation` in the question module. Derive phase from the active attempt/session and use transactions for writes. Migrate question callers to the canonical question module; do not keep foundation compatibility re-exports.
- [x] Add reconstruction completion and submission guards excluding superseded questions. Bind new teacher methods and add presentation to the resume result.
- [x] Extend tests for stale IDs, replacement rollback, opt-out, answered status and migration. The migration-20 clean cutover removes inherited chunking and partial-question compatibility; every persisted question is complete and uses explicit chunking.

## Task 2: Integrate teacher behavior and verify

Files: `docs/kernel-contracts.md`, `docs/teacher-agent-protocol.md`, `docs/README.md`, `docs/learning-experience-review-2026-09-14.md`, portable skill and reference.

- [x] Document purpose-specific lifecycle, ready/answered presentation states, exact display, replacement and exposure boundaries.
- [x] Run `npm test`, `npm run build`, and strict TypeScript checking of affected tests. Check local links in changed Markdown and `git diff --check`.
- [x] Inspect the final diff and record verified scope plus the live-agent limitation. Checkpoint/include changed canonical profiles if committing, as required by repository policy.

## Execution record

Completed inline. The initial implementation established durable presentation and reconstruction. The migration-20 clean cutover then converged the subsystem on one contract: complete presentation-ready rows, explicit chunking, criterion-scoped atomic questions, and direct imports from the question module with no runtime legacy branch. See the design for the remaining external-agent behavior limitation.
