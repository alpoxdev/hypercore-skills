#!/usr/bin/env bash
# repo-status.sh - summarize git state for one repository
# Usage: ./repo-status.sh [repo]

set -euo pipefail

REPO="${1:-.}"

if [ ! -d "$REPO" ]; then
  echo "Error: Directory not found: $REPO" >&2
  exit 1
fi

cd "$REPO"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: Not a git repository: $REPO" >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
STATUS_SHORT="$(git status --short --no-renames)"
STAGED_STAT="$(git diff --staged --stat)"
UNSTAGED_STAT="$(git diff --stat)"

echo "repo|$ROOT"
echo "status|begin"
if [ -n "$STATUS_SHORT" ]; then
  printf '%s\n' "$STATUS_SHORT"
fi
echo "status|end"

echo "staged|begin"
if [ -z "$STAGED_STAT" ]; then
  echo "(no staged changes)"
else
  printf '%s\n' "$STAGED_STAT"
fi
echo "staged|end"

echo "unstaged|begin"
UNTRACKED_FILES="$(
  while IFS= read -r line; do
    if [ "${line:0:2}" = "??" ]; then
      printf '%s\n' "${line:3}"
    fi
  done <<< "$STATUS_SHORT"
)"

if [ -z "$UNSTAGED_STAT" ] && [ -z "$UNTRACKED_FILES" ]; then
  echo "(no unstaged changes)"
else
  if [ -n "$UNSTAGED_STAT" ]; then
    printf '%s\n' "$UNSTAGED_STAT"
  fi

  if [ -n "$UNTRACKED_FILES" ]; then
    while IFS= read -r untracked_file; do
      [ -n "$untracked_file" ] && echo "untracked: $untracked_file"
    done <<< "$UNTRACKED_FILES"
  fi
fi
echo "unstaged|end"
