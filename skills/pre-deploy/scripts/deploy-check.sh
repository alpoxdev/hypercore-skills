#!/usr/bin/env bash
# deploy-check.sh - Full pre-deploy checks for node/rust/python
# Usage: deploy-check.sh [--parallel|--sequential]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${PRE_DEPLOY_MODE:-parallel}"

case "${1:-}" in
  --parallel|"")
    ;;
  --sequential)
    MODE=sequential
    ;;
  -h|--help)
    echo "Usage: deploy-check.sh [--parallel|--sequential]"
    echo "Environment: PRE_DEPLOY_MODE=parallel|sequential (default: parallel)"
    exit 0
    ;;
  *)
    echo "Error: unknown argument: $1" >&2
    exit 2
    ;;
esac

if [ "$MODE" != parallel ] && [ "$MODE" != sequential ]; then
  echo "Error: PRE_DEPLOY_MODE must be parallel or sequential" >&2
  exit 2
fi

echo "=========================================="
echo "  Pre-Deploy Verification"
echo "=========================================="

if [ ! -x "$SCRIPT_DIR/lint-check.sh" ]; then
  echo "Error: lint-check.sh not found or not executable" >&2
  exit 1
fi
if [ ! -x "$SCRIPT_DIR/build-run.sh" ]; then
  echo "Error: build-run.sh not found or not executable" >&2
  exit 1
fi
if [ ! -x "$SCRIPT_DIR/stack-detect.sh" ]; then
  echo "Error: stack-detect.sh not found or not executable" >&2
  exit 1
fi

run_sequential() {
  echo ""
  echo "[1/2] Running quality checks..."
  "$SCRIPT_DIR/lint-check.sh"

  echo ""
  echo "[2/2] Running build phase..."
  "$SCRIPT_DIR/build-run.sh"
}

run_parallel() {
  local lint_log build_log lint_pid build_pid lint_rc=0 build_rc=0

  lint_log="$(mktemp "${TMPDIR:-/tmp}/pre-deploy-lint.XXXXXX")"
  build_log="$(mktemp "${TMPDIR:-/tmp}/pre-deploy-build.XXXXXX")"

  echo ""
  echo "[1+2/2] Running quality checks and build concurrently..."

  "$SCRIPT_DIR/lint-check.sh" >"$lint_log" 2>&1 &
  lint_pid=$!
  "$SCRIPT_DIR/build-run.sh" >"$build_log" 2>&1 &
  build_pid=$!

  wait "$lint_pid" || lint_rc=$?
  wait "$build_pid" || build_rc=$?

  echo ""
  echo "--- Quality checks ---"
  cat "$lint_log"
  echo ""
  echo "--- Build phase ---"
  cat "$build_log"
  rm -f "$lint_log" "$build_log"

  if [ "$lint_rc" -ne 0 ] || [ "$build_rc" -ne 0 ]; then
    return 1
  fi
}

if [ "$MODE" = parallel ]; then
  run_parallel
else
  run_sequential
fi

echo ""
echo "=========================================="
echo "  ✓ All checks passed - Ready to deploy"
echo "=========================================="
