WORK_DIR=""
TMP_DIRS=""

resolve_root_dir() {
  for candidate in "$SCRIPT_DIR/.." "$SCRIPT_DIR/../.." "$SCRIPT_DIR/../../.."; do
    if [ -f "$candidate/dist/cli.js" ]; then
      cd "$candidate" && pwd
      return
    fi
  done

  cd "$SCRIPT_DIR/../../.." && pwd
}

resolve_fixture_dir() {
  root="$1"

  for candidate in "$SCRIPT_DIR" "$SCRIPT_DIR/.." "$SCRIPT_DIR/../fixtures" "$root/tests/e2e/fixtures"; do
    if [ -f "$candidate/rust-Cargo.toml.fixture" ]; then
      cd "$candidate" && pwd
      return
    fi
  done

  printf '%s\n' "$root/tests/e2e/fixtures"
}

ROOT_DIR="$(resolve_root_dir)"
FIXTURE_DIR="$(resolve_fixture_dir "$ROOT_DIR")"
CLI="$ROOT_DIR/dist/cli.js"
BINARY_CLI="${CODEPENDENCE_E2E_BINARY:-}"

pass() {
  printf '[PASS] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  exit 1
}

make_tmp_dir() {
  WORK_DIR="$(mktemp -d)"
  TMP_DIRS="$TMP_DIRS $WORK_DIR"
}

cleanup_provider_e2e() {
  for dir in $TMP_DIRS; do
    rm -rf "$dir"
  done
}

require_built_cli() {
  if [ -n "$BINARY_CLI" ]; then
    if [ -x "$BINARY_CLI" ]; then
      return
    fi

    fail "$BINARY_CLI not found or not executable"
  fi

  if [ -f "$CLI" ]; then
    return
  fi

  fail "dist/cli.js not found - run bun run build-dist first"
}

run_cli() {
  if [ -n "$BINARY_CLI" ]; then
    "$BINARY_CLI" "$@"
    return
  fi

  node "$CLI" "$@"
}

assert_file_contains() {
  file="$1"
  pattern="$2"
  label="$3"

  if grep -Fq -- "$pattern" "$file"; then
    pass "$label"
    return
  fi

  printf 'Expected to find: %s\n' "$pattern"
  printf 'In file: %s\n' "$file"
  fail "$label"
}

assert_file_not_contains() {
  file="$1"
  pattern="$2"
  label="$3"

  if grep -Fq -- "$pattern" "$file"; then
    printf 'Expected not to find: %s\n' "$pattern"
    fail "$label"
  fi

  pass "$label"
}

assert_file_equals() {
  expected="$1"
  actual="$2"
  label="$3"

  if cmp -s "$expected" "$actual"; then
    pass "$label"
    return
  fi

  printf 'Expected file to match: %s\n' "$expected"
  printf 'Actual file: %s\n' "$actual"
  diff -u "$expected" "$actual" || true
  fail "$label"
}

assert_file_unchanged_after_update() {
  root="$1"
  file="$2"
  label="$3"
  before_file="$(mktemp)"
  cp "$file" "$before_file"

  run_update "$root"

  if cmp -s "$before_file" "$file"; then
    rm -f "$before_file"
    pass "$label"
    return
  fi

  printf 'Expected file to remain unchanged after second update: %s\n' "$file"
  diff -u "$before_file" "$file" || true
  rm -f "$before_file"
  fail "$label"
}

assert_update_fails_unchanged() {
  root="$1"
  file="$2"
  expected_message="$3"
  label="$4"
  before_file="$(mktemp)"
  cp "$file" "$before_file"

  run_update_expect_failure "$root" "$expected_message" "$label"

  if cmp -s "$before_file" "$file"; then
    rm -f "$before_file"
    pass "$label leaves file unchanged"
    return
  fi

  printf 'Expected file to remain unchanged after failed update: %s\n' "$file"
  diff -u "$before_file" "$file" || true
  rm -f "$before_file"
  fail "$label leaves file unchanged"
}

run_update() {
  root="$1"
  output=""
  exit_code=0

  output=$(run_cli --rootDir "$root" --config "$root/.codependencerc" --update --quiet 2>&1) || exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    printf '%s\n' "$output"
    fail "codependence --update exited with $exit_code"
  fi

  if printf '%s\n' "$output" | grep -q "Failed to fetch version\|Error: Command failed"; then
    printf '%s\n' "$output"
    fail "codependence --update had resolver errors"
  fi
}

run_update_expect_failure() {
  root="$1"
  expected_message="$2"
  label="$3"
  output=""
  exit_code=0

  output=$(run_cli --rootDir "$root" --config "$root/.codependencerc" --update 2>&1) || exit_code=$?
  if [ "$exit_code" -eq 0 ]; then
    printf '%s\n' "$output"
    fail "$label should fail"
  fi

  if printf '%s\n' "$output" | grep -Fq "$expected_message"; then
    pass "$label fails with expected error"
    return
  fi

  printf '%s\n' "$output"
  printf 'Expected failure message: %s\n' "$expected_message"
  fail "$label failure message"
}
