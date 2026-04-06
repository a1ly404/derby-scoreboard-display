#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
REMOTE="${2:-origin}"
INTERVAL="${3:-120}"
RUN_ONCE="${4:-false}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/update-overlay.sh"
LOG_DIR="$REPO_PATH/logs/autoupdater"
RUNTIME_DIR="$REPO_PATH/runtime"
LOCK_FILE="$RUNTIME_DIR/autoupdate.lock"

mkdir -p "$LOG_DIR" "$RUNTIME_DIR"
LOG_FILE="$LOG_DIR/autoupdate-$(date +%Y%m%d).log"

log() {
  local msg="[$(date +"%Y-%m-%d %H:%M:%S")] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

if [[ -f "$LOCK_FILE" ]]; then
  log "Another auto-update process is already running. Exiting."
  exit 0
fi

echo "$$" > "$LOCK_FILE"

if [[ "$RUN_ONCE" == "true" ]]; then
  "$UPDATE_SCRIPT" "$BRANCH" "$REMOTE"
  exit 0
fi

log "Starting watcher for $REMOTE/$BRANCH every $INTERVAL seconds"
while true; do
  if ! "$UPDATE_SCRIPT" "$BRANCH" "$REMOTE"; then
    log "Watcher iteration error: update failed"
  fi
  sleep "$INTERVAL"
done
