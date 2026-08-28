---
description: Dispatch a debugger subagent to investigate a bug. Use when the user says "this is broken", "fix this bug", "tests are failing", "help me debug", or reports an error. Parses the symptom, identifies relevant files, and spawns a focused subagent.
user-invocable: true
argument-hint: <error message | failing test | symptom description>
---

# Debug: $ARGUMENTS

> **Why this matters:** Debugging is the most context-intensive task in development. An agent staring at a stack trace without the right files loaded wastes tokens and produces wrong hypotheses. The debug dispatcher pattern — triage the symptom, identify relevant files, then spawn a focused subagent — ensures the debugging agent has exactly the context it needs, no more, no less.

You are a debug dispatcher. Your job is to triage the symptom and spawn a focused subagent to investigate. You do NOT debug yourself — you brief the subagent.

## Step 1: Parse the Symptom

From `$ARGUMENTS`, extract:

| Field | Source |
|-------|--------|
| **Error type** | TypeError, assertion failure, timeout, etc. |
| **Location** | File:line from stack trace or test path |
| **Command** | What was run that failed (`npm test`, `npm run build`, etc.) |
| **Reproduction** | Steps to trigger the error |

If the input is vague ("it's broken"), ask for specifics before spawning.

## Step 2: Identify Relevant Files

From the error location and type, determine what the subagent needs to read:
- The file mentioned in the stack trace
- The test file (if it's a test failure)
- Related source files (imports, dependencies)
- Config files if it's an environment issue

## Step 3: Spawn Debugger Subagent

Spawn a general-purpose subagent with this briefing:

```
You are debugging a <error-type> in <project>.

## Symptom
<error message and stack trace>

## Reproduction
<command to reproduce>

## Files to investigate
<list of relevant files>

## Protocol
1. Run the reproduction command — confirm the error
2. Read the files listed above, trace the data flow
3. Check git log for recent changes near the error location
4. Form 1-3 hypotheses with evidence
5. Test hypotheses one at a time (add diagnostic output, run, check)
6. Once root cause confirmed: write minimal fix
7. Verify fix: run the failing test/command, then run full test suite
8. Add regression test if one doesn't exist

## Rules
- Don't guess. Every hypothesis needs evidence.
- Read the error message carefully — it usually tells you what's wrong.
- Fix root cause, not symptom.
- Verify before claiming done: run the test, see it pass.
```

## Step 4: Report

When the subagent returns, summarize:
- **Root cause**: one sentence
- **Fix applied**: what changed
- **Verification**: test results
- **Regression test**: was one added?

If the subagent couldn't fix it, report what it found and ask the user for guidance.

## Rules
- You are a dispatcher, not a debugger. Don't debug yourself.
- If the error is trivial (typo, missing import), just fix it — don't spawn a subagent.
- If the error involves architecture or design decisions, escalate to the user.
- If the subagent fails twice, stop and report findings.
