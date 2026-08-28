---
name: compaction-strategy
description: Context compaction strategy for agent sessions.
---

# Compaction Strategy

## Why

Context window is the #1 constraint in agentic coding. Performance degrades as context fills. Compaction keeps context clean and efficient.

## When to Compact

- **Between unrelated tasks** — After completing one task, before starting another
- **After failed attempts** — Summarize lesson, discard failed approach details
- **When context feels heavy** — If you're running out of space or performance degrades
- **Before spawning subagents** — Clean context for parent, fresh context for child

## How to Compact

### 1. Summarize Current State

```
## Current State (compacted)
- Task: [what you're working on]
- Progress: [what's done, what remains]
- Key findings: [important discoveries]
- Next step: [what to do next]
```

### 2. Discard Failed Approaches

Don't keep:
- Full error output from failed attempts
- Detailed reasoning about why approach X didn't work
- Multiple iterations of the same problem

Do keep:
- One-line summary of what failed and why
- Lesson learned for future reference
- Final working solution

### 3. Use Subagents for Investigation

- Spawn separate agents for research — they have isolated context
- Subagents return findings, not full investigation logs
- Parent keeps only the conclusion, not the process

### 4. Monitor Context Budget

- If context feels heavy, summarize current state and start fresh
- Use `/compact` command if available
- Prefer line ranges in reads (don't dump entire files)
- Batch independent reads to reduce round trips

## Anti-Patterns

- ❌ Keeping full error logs "just in case"
- ❌ Retaining multiple failed approaches in context
- ❌ Dumping entire files when you need 10 lines
- ❌ Keeping subagent investigation details (keep only findings)

## Examples

### Before Compaction

```
I tried approach A, which failed because of X. Then I tried approach B, which
failed because of Y. Then I tried approach C, which also failed because of Z.
The error messages were:
[paste 50 lines of error output]
[paste 30 lines of stack trace]
[paste 20 lines of code that didn't work]
Finally, approach D worked because...
```

### After Compaction

```
## Key Finding
Approach D works because [reason]. Approaches A, B, C failed due to [one-line each].

## Current State
- Task: [what you're working on]
- Progress: [what's done]
- Next step: [what to do next]
```
