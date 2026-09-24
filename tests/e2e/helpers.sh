# shellcheck shell=sh
# Shared variables are consumed by the provider test scripts.
# shellcheck disable=SC2034
WORK_DIR=""
TMP_DIRS=""

resolve_root_dir() {
  for candidate in "$SCRIPT_DIR" "$SCRIPT_DIR/.." "$SCRIPT_DIR/../.." "$SCRIPT_DIR/../../.."; do
    [ -f "$candidate/dist/cli.js" ] || continue
    cd "$candidate" && pwd
    return
  done

  cd "$SCRIPT_DIR/../.." && pwd
}

resolve_fixture_dir() {
  root="${1:?root is required}"

  for candidate in "$SCRIPT_DIR" "$SCRIPT_DIR/.." "$SCRIPT_DIR/fixtures" "$root/tests/e2e/fixtures"; do
    [ -f "$candidate/rust-Cargo.toml.fixture" ] || continue
    cd "$candidate" && pwd
    return
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
  base_dir="$(provider_tmp_base_dir)"
  WORK_DIR="$(mktemp -d "$base_dir/codependence-provider.XXXXXX")"
  TMP_DIRS="$TMP_DIRS $WORK_DIR"
}

make_tmp_file() {
  base_dir="$(provider_tmp_base_dir)"
  mktemp "$base_dir/codependence-provider.XXXXXX"
}

provider_tmp_base_dir() {
  base_dir="${CODEPENDENCE_E2E_TMPDIR:-$ROOT_DIR/tmp/e2e}"
  mkdir -p "$base_dir"
  printf '%s\n' "$base_dir"
}

cleanup_provider_e2e() {
  for dir in $TMP_DIRS; do
    rm -rf "$dir"
  done
}

require_built_cli() {
  case "$BINARY_CLI" in
  "") [ -f "$CLI" ] || fail "dist/cli.js not found - run nub run build-dist first" ;;
  *) [ -x "$BINARY_CLI" ] || fail "$BINARY_CLI not found or not executable" ;;
  esac
}

run_cli() {
  case "$BINARY_CLI" in
  "") node "$CLI" "$@" ;;
  *) "$BINARY_CLI" "$@" ;;
  esac
}

assert_file_contains() {
  file="${1:?file is required}"
  pattern="${2:?pattern is required}"
  label="${3:?label is required}"

  grep -Fq -- "$pattern" "$file" || report_missing_pattern
  pass "$label"
}

assert_file_not_contains() {
  file="${1:?file is required}"
  pattern="${2:?pattern is required}"
  label="${3:?label is required}"

  ! grep -Fq -- "$pattern" "$file" || report_unexpected_pattern

  pass "$label"
}

assert_file_equals() {
  expected="${1:?expected is required}"
  actual="${2:?actual is required}"
  label="${3:?label is required}"

  cmp -s "$expected" "$actual" || report_file_mismatch
  pass "$label"
}

assert_file_unchanged_after_update() {
  root="${1:?root is required}"
  file="${2:?file is required}"
  label="${3:?label is required}"
  before_file="$(make_tmp_file)"
  cp "$file" "$before_file"
  run_update "$root"
  assert_snapshot_unchanged "$before_file" "$file" "$label" "Expected file to remain unchanged after second update"
}

assert_update_fails_unchanged() {
  root="${1:?root is required}"
  file="${2:?file is required}"
  expected_message="${3:?expected_message is required}"
  label="${4:?label is required}"
  before_file="$(make_tmp_file)"
  cp "$file" "$before_file"
  run_update_expect_failure "$root" "$expected_message" "$label"
  assert_snapshot_unchanged "$before_file" "$file" "$label leaves file unchanged" "Expected file to remain unchanged after failed update"
}

run_update() {
  root="${1:?root is required}"
  exit_code=0
  output=$(run_cli --rootDir "$root" --config "$root/.codependencerc" --update --quiet 2>&1) || exit_code=$?
  assert_update_succeeded
}

run_update_from_root() {
  root="${1:?root is required}"
  exit_code=0
  output=$(cd "$root" && run_cli --config .codependencerc --update --quiet 2>&1) || exit_code=$?
  assert_update_succeeded
}

assert_file_unchanged_after_update_from_root() {
  root="${1:?root is required}"
  file="${2:?file is required}"
  label="${3:?label is required}"
  before_file="$(make_tmp_file)"
  cp "$file" "$before_file"
  run_update_from_root "$root"
  assert_snapshot_unchanged "$before_file" "$file" "$label" "Expected file to remain unchanged after second update"
}

run_update_expect_failure() {
  root="${1:?root is required}"
  expected_message="${2:?expected_message is required}"
  label="${3:?label is required}"
  exit_code=0
  output=$(run_cli --rootDir "$root" --config "$root/.codependencerc" --update 2>&1) || exit_code=$?
  [ "$exit_code" -ne 0 ] || report_unexpected_success
  printf '%s\n' "$output" | grep -Fq "$expected_message" || report_missing_error
  pass "$label fails with expected error"
}

assert_snapshot_unchanged() {
  snapshot="${1:?snapshot is required}"
  file="${2:?file is required}"
  label="${3:?label is required}"
  diagnostic="${4:?diagnostic is required}"
  cmp -s "$snapshot" "$file" || report_changed_snapshot
  rm -f "$snapshot"
  pass "$label"
}

assert_update_succeeded() {
  [ "$exit_code" -eq 0 ] || report_update_failure
  ! printf '%s\n' "$output" | grep -q "Failed to fetch version\|Error: Command failed" || report_resolver_failure
}

report_missing_pattern() {
  printf 'Expected to find: %s\n' "$pattern"
  printf 'In file: %s\n' "$file"
  fail "$label"
}

report_unexpected_pattern() {
  printf 'Expected not to find: %s\n' "$pattern"
  fail "$label"
}

report_file_mismatch() {
  printf 'Expected file to match: %s\n' "$expected"
  printf 'Actual file: %s\n' "$actual"
  diff -u "$expected" "$actual" || :
  fail "$label"
}

report_unexpected_success() {
  printf '%s\n' "$output"
  fail "$label should fail"
}

report_missing_error() {
  printf '%s\nExpected failure message: %s\n' "$output" "$expected_message"
  fail "$label failure message"
}

report_changed_snapshot() {
  printf '%s: %s\n' "$diagnostic" "$file"
  diff -u "$snapshot" "$file" || :
  rm -f "$snapshot"
  fail "$label"
}

report_update_failure() {
  printf '%s\n' "$output"
  fail "codependence --update exited with $exit_code"
}

report_resolver_failure() {
  printf '%s\n' "$output"
  fail "codependence --update had resolver errors"
}
