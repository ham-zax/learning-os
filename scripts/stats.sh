#!/usr/bin/env bash
# stats.sh [topic]
# Print progress summary for a topic
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

STATE_DIR="$(jq -r '.state_dir' "$REPO_DIR/config.json")"
[[ "$STATE_DIR" != /* ]] && STATE_DIR="$REPO_DIR/${STATE_DIR#./}"

TODAY="$(date +%Y-%m-%d)"

print_stats() {
  local state_file="$1"
  jq -r --arg today "$TODAY" '
    .topic as $topic |
    .phase as $phase |
    .concepts as $c |
    ($c | to_entries | map(.value.status) | group_by(.) | map({(.[0]): length}) | add // {}) as $counts |
    ($c | to_entries | map(.value.history | length) | add // 0) as $total_reviews |
    ($c | to_entries | map(select(.value.nextReview != null and .value.nextReview <= $today)) | length) as $due |
    "Topic: \($topic)",
    "Phase: \($phase)",
    "Concepts:",
    "  unseen:    \($counts.unseen // 0)",
    "  learning:  \($counts.learning // 0)",
    "  reviewing: \($counts.reviewing // 0)",
    "  mastered:  \($counts.mastered // 0)",
    "Total reviews done: \($total_reviews)",
    "Due today: \($due)",
    "Last session: \(.lastSession // "never")"
  ' "$state_file"
}

TOPIC="${1:-}"
if [[ -n "$TOPIC" ]]; then
  STATE_FILE="$STATE_DIR/$TOPIC.json"
  [[ ! -f "$STATE_FILE" ]] && { echo "No state file for topic: $TOPIC" >&2; exit 1; }
  print_stats "$STATE_FILE"
else
  found=0
  for f in "$STATE_DIR"/*.json; do
    [[ -f "$f" ]] || continue
    echo "---"
    print_stats "$f"
    found=1
  done
  [[ $found -eq 0 ]] && echo "No state files found in $STATE_DIR"
fi
