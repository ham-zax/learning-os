---
id: status-and-handoff
title: STATUS, the Journal, and the Handoff
difficulty: 2
prerequisites: [ticket-lifecycle]
tags: [workflow, process, judgment]
---

## Summary
`STATUS.md` is the pickup point and holds **live state only** — what is next, what is blocked, what is broken. History goes in `docs/journal/` (newest first). Both are updated **in the same commit as the work**, because a handoff that lives only in a chat transcript dies when the session ends.

## Key Points
- STATUS answers *"what do I do now"*. The journal answers *"what happened"*. The split is FDY-125.
- **Do not append dated entries to STATUS.** Update it by **deletion** — remove what is no longer true.
- Evidence this is hard: FDY-125 moved **3,031 lines** out on 2026-08-11, and it had to be done again on 2026-08-15 after STATUS regrew to 1,275 lines in three days. FDY-175 exists to budget it mechanically, *because two manual prunes in four days is the evidence that asking nicely does not work.*
- **Ticket counts are deliberately absent** from STATUS — derive them from `index.json`. Mirroring them in prose cost three wrong numbers on 2026-08-12 alone (FDY-126).
- **If STATUS disagrees with the ADRs, specs or tickets, they win and STATUS is stale — say so.**
- Session-end protocol: STATUS + dated journal entry, in the same commit as the work. That is step 7 (REPORT) of the loop.

## Deep Dive
The interesting content here is not the file layout — it is that the repo treats its own process failures as **evidence** and responds with mechanism rather than exhortation. STATUS grew to 3,031 excess lines; that produced a ticket. It regrew within three days; that produced the explicit conclusion that asking nicely does not work, and a second ticket to enforce a budget mechanically. Duplicated ticket counts produced three wrong numbers in one day; the response was to ban the duplication and point at the machine-readable source.

That is the same instinct as ADR-0008's "a convention that isn't a failing build decays," applied to documentation. If you propose a process improvement in this repo, expect the question: *what makes it fail when someone forgets?*

"Update by deletion" is genuinely counterintuitive and worth practising. The natural move on finishing a session is to append what you did. But an append-only status file becomes a journal with extra steps, and its usefulness — being readable in one sitting at the start of a session — decays with every entry. What you did goes in the journal. What is *now true* replaces what is no longer true.

## Practice Questions
1. What goes in STATUS versus the journal?
2. How do you update STATUS, and why is appending wrong?
3. STATUS says a ticket is blocked; `index.json` says it is closed. Which wins?
4. Why are ticket counts deliberately absent from STATUS?
5. What general pattern do FDY-125, FDY-175 and FDY-126 illustrate about how this repo fixes process problems?

## Common Misconceptions
- "STATUS is the project history" → Live state only. History is the journal.
- "Add a dated entry at the end of each session" → Explicitly forbidden; that is what broke it twice.
- "STATUS is authoritative" → It is the *first* read, not the last word. Specs, ADRs and tickets outrank it.
- "Summarising ticket counts in prose is helpful" → It produced three wrong numbers in a day. Derive from `index.json`.

## References
- `STATUS.md` header
- `CLAUDE.md` §Session-start / §Session-end protocol
- `docs/workflow.md` §The loop step 7
