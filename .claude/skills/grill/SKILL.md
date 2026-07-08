---
description: Design tree interview — exhaustive exploration of design space before planning.
user-invocable: true
argument-hint: <topic>
---

# Grill: $ARGUMENTS

> **Why this matters:** Most design failures aren't technical — they're incomplete thinking. The code works, but it doesn't handle the edge case no one asked about. The grill protocol forces exhaustive exploration of the design space *before* planning, because discovering gaps during implementation costs 10x more than discovering them during design. The six question categories (Scope, Edge Cases, Design Decisions, Interactions, Verification, Tool-Specific) are derived from the most common failure modes in agentic development.

## Protocol
1. Read CONTEXT.md if it exists (domain awareness)
2. Read .claude/rules/grill-checklist.md — use the 6 categories of questions as your interview framework
3. Interview relentlessly about every aspect of $ARGUMENTS
4. Walk down each branch of the design tree, resolving dependencies
5. For each question, provide recommended answer with rationale
6. Ask one question at a time — wait for response
7. If answerable from codebase, explore instead of asking
8. Challenge vague language — propose precise terms

## Question Categories (from grill-checklist.md)
1. **Scope** — non-goals, opt-in/out, interactions
2. **Edge Cases** — empty, malformed, concurrent, macOS vs Linux, missing deps
3. **Design Decisions** — alternatives, simplest version, real vs theoretical
4. **Interactions** — gate.sh, pipeline stages, existing behavior, docs
5. **Verification** — how to prove works, failure modes, minimum test, hidden tests
6. **Tool-Specific** — macOS bash 3.2, missing deps, timeout, --help

## Completion
Session ends when all branches resolved or user says "done"/"plan it".

On completion:
1. Present summary of all decisions made
2. Write Clarifications section for the plan
3. Note any CONTEXT.md terms needing update
