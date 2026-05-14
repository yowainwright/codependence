#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(mktemp -d)"

resolve_root_dir() {
  if [ -f "$SCRIPT_DIR/dist/index.js" ]; then
    echo "$SCRIPT_DIR"
  else
    echo "$(dirname "$(dirname "$SCRIPT_DIR")")"
  fi
}

resolve_fixture_dir() {
  local root="$1"
  if [ -f "$SCRIPT_DIR/go.mod-replace.fixture" ]; then
    echo "$SCRIPT_DIR"
  else
    echo "$root/tests/e2e/fixtures"
  fi
}

ROOT_DIR="$(resolve_root_dir)"
FIXTURE_DIR="$(resolve_fixture_dir "$ROOT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

setup_work_dir() {
  cp "$ROOT_DIR/dist/index.js" "$WORK_DIR/" || fail "dist/index.js not found — run bun run build-dist first"
  cp -r "$ROOT_DIR/dist" "$WORK_DIR/" 2>/dev/null || true
}

write_rc() {
  echo "$1" > "$WORK_DIR/.codependencerc"
}

run_update() {
  (cd "$WORK_DIR" && node index.js --update 2>&1 || true)
}

run_check() {
  (cd "$WORK_DIR" && node index.js --debug 2>&1 || true)
}

assert_file_contains() {
  local file="$1" pattern="$2" label="$3"
  if grep -q "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

test_replace_directive_preserved() {
  info "replace directive preserved after --update"
  cp "$FIXTURE_DIR/go.mod-replace.fixture" "$WORK_DIR/go.mod"
  write_rc '{"codependencies":["github.com/gin-gonic/gin","github.com/lib/pq"],"language":"go"}'
  run_update
  assert_file_contains "$WORK_DIR/go.mod" \
    "replace github.com/old/module v1.0.0 => github.com/fork/module v2.0.0" \
    "replace directive preserved"
}

test_indirect_comments_preserved() {
  info "// indirect comments preserved after --update"
  cp "$FIXTURE_DIR/go.mod-indirect.fixture" "$WORK_DIR/go.mod"
  write_rc '{"codependencies":["github.com/gin-gonic/gin","github.com/lib/pq"],"language":"go"}'
  run_update
  assert_file_contains "$WORK_DIR/go.mod" "// indirect" "// indirect comments preserved"
}

test_packages_detected() {
  info "go packages are detected"
  cp "$FIXTURE_DIR/go.mod.fixture" "$WORK_DIR/go.mod"
  write_rc '{"codependencies":["github.com/gin-gonic/gin","github.com/lib/pq","golang.org/x/crypto"],"language":"go"}'
  OUTPUT=$(run_check)
  if echo "$OUTPUT" | grep -q "gin-gonic\|lib/pq\|golang.org"; then
    pass "go packages detected"
  else
    fail "go packages not detected in output"
  fi
}

main() {
  echo "Go Update E2E Tests"
  echo "==================="
  cd "$ROOT_DIR"
  setup_work_dir
  test_replace_directive_preserved
  test_indirect_comments_preserved
  test_packages_detected
  echo ""
  echo "All Go update tests passed."
}

main
