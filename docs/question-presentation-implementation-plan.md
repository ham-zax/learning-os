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
- [x] Implement `openAttemptSubquestion`, `replaceAttemptSubquestion`, `answerAttemptSubquestion`, `getAttemptSubquestions`, `getSessionQuestionPresentation` in the question module. Derive phase from the active attempt/session and use transactions for writes. Re-export existing foundation APIs for compatibility.
- [x] Add reconstruction completion and submission guards excluding superseded questions. Bind new teacher methods and add presentation to the resume result.
- [x] Extend tests for stale IDs, replacement rollback, opt-out, answered status, inherited chunking, legacy missing context and version 17 migration. Run focused tests.

## Task 2: Integrate teacher behavior and verify

Files: `docs/kernel-contracts.md`, `docs/teacher-agent-protocol.md`, `docs/README.md`, `docs/learning-experience-review-2026-09-14.md`, portable skill and reference.

- [x] Document purpose-specific lifecycle, missing/answered presentation states, exact display, replacement and exposure boundaries.
- [x] Run `npm test`, `npm run build`, and strict TypeScript checking of affected tests. Check local links in changed Markdown and `git diff --check`.
- [x] Inspect the final diff and record verified scope plus the live-agent limitation. Checkpoint/include changed canonical profiles if committing, as required by repository policy.

## Execution record

Completed inline. The initial three regression cases failed on the absent presentation API and submitted-attempt rejection; after implementation all 48 tests passed. Production build and strict checking of the affected tests passed. A temporary checkout of committed v17 code also verified the real v17-to-v18 upgrade with preserved answered/pending history. See the design for the remaining external-agent behavior limitation.
