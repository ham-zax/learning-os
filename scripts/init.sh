#!/usr/bin/env bash
# init.sh <topic> [--force]
# Initialize state file for a topic from manifest.json
set -euo pipefail

TOPIC="${1:-}"
FORCE="${2:-}"

if [[ -z "$TOPIC" ]]; then
  echo "Usage: init.sh <topic> [--force]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

STATE_DIR="$(jq -r '.state_dir' "$REPO_DIR/config.json")"
KNOWLEDGE_DIR="$(jq -r '.knowledge_dir' "$REPO_DIR/config.json")"

# Resolve relative paths
[[ "$STATE_DIR" != /* ]] && STATE_DIR="$REPO_DIR/${STATE_DIR#./}"
[[ "$KNOWLEDGE_DIR" != /* ]] && KNOWLEDGE_DIR="$REPO_DIR/${KNOWLEDGE_DIR#./}"

STATE_FILE="$STATE_DIR/$TOPIC.json"
MANIFEST="$KNOWLEDGE_DIR/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Error: manifest not found at $MANIFEST" >&2
  exit 1
fi

if [[ -f "$STATE_FILE" && "$FORCE" != "--force" ]]; then
  echo "Error: state file already exists: $STATE_FILE (use --force to overwrite)" >&2
  exit 1
fi

TODAY="$(date +%Y-%m-%d)"

# Build concepts object from manifest
CONCEPTS="$(jq '[.concepts[] | {key: .id, value: {status: "unseen", ef: 2.5, interval: 0, repetitions: 0, nextReview: null, lastGrade: null, history: []}}] | from_entries' "$MANIFEST")"

jq -n \
  --arg topic "$TOPIC" \
  --arg created "$TODAY" \
  --argjson concepts "$CONCEPTS" \
  '{topic: $topic, phase: 1, created: $created, lastSession: null, concepts: $concepts, sessionLog: []}' \
  > "$STATE_FILE"

echo "Initialized $STATE_FILE with $(echo "$CONCEPTS" | jq 'keys | length') concepts"
