#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
REMOTE="${2:-origin}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$REPO_PATH/logs/updater"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/update-$(date +%Y%m%d).log"

log() {
  local msg="[$(date +"%Y-%m-%d %H:%M:%S")] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

if ! command -v git >/dev/null 2>&1; then
  log "ERROR: git not found in PATH"
  exit 1
fi

cd "$REPO_PATH"

if [[ ! -d .git ]]; then
  log "ERROR: this folder is not a git repo: $REPO_PATH"
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  log "Current branch is '$current_branch'; switching to '$BRANCH'"
  git checkout "$BRANCH"
fi

git fetch "$REMOTE" "$BRANCH" --prune
behind="$(git rev-list --count "HEAD..$REMOTE/$BRANCH")"

if [[ "$behind" -le 0 ]]; then
  log "No updates. Already at latest $REMOTE/$BRANCH"
  exit 0
fi

log "Found $behind new commit(s). Pulling updates..."
git pull --ff-only "$REMOTE" "$BRANCH"
new_head="$(git rev-parse --short HEAD)"
log "Update complete. HEAD is now $new_head"
