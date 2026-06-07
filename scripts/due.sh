#!/usr/bin/env bash
# due.sh [topic]
# Show concepts due for review (nextReview <= today, or null = due)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

STATE_DIR="$(jq -r '.state_dir' "$REPO_DIR/config.json")"
[[ "$STATE_DIR" != /* ]] && STATE_DIR="$REPO_DIR/${STATE_DIR#./}"

TODAY="$(date +%Y-%m-%d)"

check_topic() {
  local state_file="$1"
  local topic
  topic="$(jq -r '.topic' "$state_file")"

  local due
  due="$(jq -r --arg today "$TODAY" '
    .concepts | to_entries[]
    | select(.value.nextReview == null or .value.nextReview <= $today)
    | "\(.key) [\(.value.status)] next: \(.value.nextReview // "never reviewed")"
  ' "$state_file")"

  if [[ -n "$due" ]]; then
    echo "=== $topic ==="
    echo "$due"
  else
    echo "=== $topic === (nothing due)"
  fi
}

TOPIC="${1:-}"
if [[ -n "$TOPIC" ]]; then
  STATE_FILE="$STATE_DIR/$TOPIC.json"
  [[ ! -f "$STATE_FILE" ]] && { echo "No state file for topic: $TOPIC" >&2; exit 1; }
  check_topic "$STATE_FILE"
else
  found=0
  for f in "$STATE_DIR"/*.json; do
    [[ -f "$f" ]] || continue
    check_topic "$f"
    found=1
  done
  [[ $found -eq 0 ]] && echo "No state files found in $STATE_DIR"
fi
