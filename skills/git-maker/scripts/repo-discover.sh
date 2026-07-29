#!/usr/bin/env bash
# repo-discover.sh - detect current or descendant git repositories
# Usage: ./repo-discover.sh [start_dir]

set -euo pipefail

START_DIR="${1:-.}"

if [ ! -d "$START_DIR" ]; then
  echo "Error: Directory not found: $START_DIR" >&2
  exit 1
fi

cd "$START_DIR"

if ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "current|$ROOT"
  exit 0
fi

FOUND=0
while IFS= read -r git_path; do
  [ -z "$git_path" ] && continue
  if ROOT="$(git -C "$(dirname "$git_path")" rev-parse --show-toplevel 2>/dev/null)"; then
    echo "descendant|$ROOT"
    FOUND=1
  fi
done < <(
  find . \
    \( -name .git -type d -prune -print \) -o \
    \( -type d \( \
      -name node_modules -o -name dist -o -name build -o -name .next -o \
      -name .turbo -o -name .cache -o -name coverage -o -name vendor \
    \) -prune \) -o \
    \( -name .git -type f -print \) 2>/dev/null |
    sort -u
)

if [ "$FOUND" -eq 0 ]; then
  echo "Error: No git repository found from $START_DIR" >&2
  exit 1
fi
