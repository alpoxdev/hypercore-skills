#!/usr/bin/env bash
# git-push.sh - compatibility wrapper for the optimized git-maker push path
# Usage: ./git-push.sh [--force]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAST_HELPER="$SCRIPT_DIR/git-maker-fast.sh"

if [ ! -x "$FAST_HELPER" ]; then
  echo "Error: git-maker-fast.sh not found or not executable" >&2
  exit 1
fi

exec "$FAST_HELPER" push "$@"
