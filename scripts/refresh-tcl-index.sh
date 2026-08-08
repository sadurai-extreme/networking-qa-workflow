#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# refresh-tcl-index.sh
# Pulls the latest exos-tcl-automation from GitHub, rebuilds the proc index,
# and hot-reloads the backend.
#
# Required (one-time setup):
#   echo "GITHUB_TOKEN=ghp_yourtoken" >> /root/.env
#
# Schedule (weekly, Sunday 02:00):
#   0 2 * * 0 /root/networking-qa-workflow/scripts/refresh-tcl-index.sh >> /root/networking-qa-workflow/logs/tcl-index.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_OWNER="extremenetworks-emu"
REPO_NAME="exos-tcl-automation"
REPO_BRANCH="main"
CLONE_DIR="/root/${REPO_NAME}"
AUTOMATION_SUBDIR="automation"          # path inside repo to index
INDEXER="/root/networking-qa-workflow/scripts/index-tcl-libs.js"
BACKEND_RELOAD="http://localhost:5100/api/tcl-index/reload"
ENV_FILE="/root/.env"

echo "=== TCL Index Refresh — $(date '+%Y-%m-%d %H:%M:%S') ==="

# ── Load GITHUB_TOKEN ─────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -o allexport; source "$ENV_FILE"; set +o allexport
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN not set. Add it to $ENV_FILE:"
  echo "  echo 'GITHUB_TOKEN=ghp_yourtoken' >> $ENV_FILE"
  exit 1
fi

CLONE_URL="https://${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"

# ── Clone or pull ─────────────────────────────────────────────────────────────
if [ -d "${CLONE_DIR}/.git" ]; then
  echo "Pulling latest from ${REPO_OWNER}/${REPO_NAME}@${REPO_BRANCH}..."
  # Use token URL in case remote was cloned with old token
  git -C "$CLONE_DIR" remote set-url origin "$CLONE_URL"
  git -C "$CLONE_DIR" fetch --quiet origin "$REPO_BRANCH"
  LOCAL=$(git -C "$CLONE_DIR" rev-parse HEAD)
  REMOTE=$(git -C "$CLONE_DIR" rev-parse "origin/${REPO_BRANCH}")
  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "Already up to date (commit: ${LOCAL:0:8}). Skipping re-index."
    exit 0
  fi
  git -C "$CLONE_DIR" pull --ff-only origin "$REPO_BRANCH"
  echo "Updated to commit: $(git -C "$CLONE_DIR" rev-parse --short HEAD)"
else
  echo "Cloning ${REPO_OWNER}/${REPO_NAME}..."
  git clone --depth 1 --branch "$REPO_BRANCH" "$CLONE_URL" "$CLONE_DIR"
  echo "Cloned at commit: $(git -C "$CLONE_DIR" rev-parse --short HEAD)"
fi

# ── Run indexer ───────────────────────────────────────────────────────────────
AUTOMATION_PATH="${CLONE_DIR}/${AUTOMATION_SUBDIR}"
if [ ! -d "$AUTOMATION_PATH" ]; then
  echo "ERROR: automation dir not found at $AUTOMATION_PATH"
  exit 1
fi

echo "Indexing TCL libs from: $AUTOMATION_PATH"
source /root/.nvm/nvm.sh
nvm use 16 >/dev/null 2>&1
node "$INDEXER" "$AUTOMATION_PATH"

# ── Hot-reload backend ────────────────────────────────────────────────────────
echo "Reloading backend index..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_RELOAD")
if [ "$RESPONSE" = "200" ]; then
  echo "Backend reloaded successfully."
else
  echo "WARNING: Backend reload returned HTTP $RESPONSE (backend may be down)."
fi

echo "=== Done ==="
