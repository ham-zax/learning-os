#!/bin/bash
# orchestrator-dispatch-gate.sh — PreToolUse hook that enforces the orchestrator-dispatches pattern
# The main session (orchestrator) should delegate implementation to subagents, not write code directly.
# Blocks Edit/Write/NotebookEdit on the main thread. Subagents pass through unconditionally.
#
# Based on TapAgents' orchestrator-dispatch-gate.py pattern.
# Tested on macOS bash 3.2 and Linux bash 5+.

set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool // empty')

# Only gate Edit, Write, NotebookEdit
case "$TOOL" in
  Edit|Write|NotebookEdit) ;;
  *) exit 0 ;;
esac

# Check if this is a subagent call (has agent_id or agent_type)
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

# Subagents pass through unconditionally
[ -n "$AGENT_ID" ] && exit 0
[ -n "$AGENT_TYPE" ] && exit 0

# --- Main thread: check for allowed paths ---
# The orchestrator can edit certain files (memory, config, docs) but not source code
FILE_PATH=$(echo "$INPUT" | jq -r '.input.file_path // .input.path // empty')

if [ -n "$FILE_PATH" ]; then
  # Allow memory files
  echo "$FILE_PATH" | grep -qE '\.claude/projects/.*/memory/' && exit 0
  # Allow CLAUDE.md
  echo "$FILE_PATH" | grep -qE 'CLAUDE\.md$' && exit 0
  # Allow .claude/config/
  echo "$FILE_PATH" | grep -qE '\.claude/config/' && exit 0
  # Allow .claude/settings.json
  echo "$FILE_PATH" | grep -qE '\.claude/settings\.json$' && exit 0
  # Allow plans/ directory
  echo "$FILE_PATH" | grep -qE '(plans|specs|issues|docs)/' && exit 0
  # Allow /tmp/ files
  echo "$FILE_PATH" | grep -qE '^/tmp/' && exit 0
  # Allow STATUS.md, DECISIONS.md, CONTEXT.md
  echo "$FILE_PATH" | grep -qE '(STATUS|DECISIONS|CONTEXT)\.md$' && exit 0
fi

# --- Block: orchestrator should delegate, not implement ---
echo "ORCHESTRATOR DISPATCH GATE: The main session should delegate to subagents, not $TOOL directly." >&2
echo "Use Agent() to spawn a coder/reviewer for this task." >&2
echo "If you need to edit config/memory/docs, the path may need to be added to the allowlist." >&2
echo "File: $FILE_PATH" >&2
exit 2
