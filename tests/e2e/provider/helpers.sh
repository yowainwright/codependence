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
  if [ -f "$CLI" ]; then
    return
  fi

  fail "dist/cli.js not found - run bun run build-dist first"
}

assert_file_contains() {
  file="$1"
  pattern="$2"
  label="$3"

  if grep -Fq "$pattern" "$file"; then
    pass "$label"
    return
  fi

  printf 'Expected to find: %s\n' "$pattern"
  printf 'In file: %s\n' "$file"
  fail "$label"
}

run_update() {
  root="$1"
  output=""
  exit_code=0

  output=$(node "$CLI" --rootDir "$root" --config "$root/.codependencerc" --update --quiet 2>&1) || exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    printf '%s\n' "$output"
    fail "codependence --update exited with $exit_code"
  fi

  if printf '%s\n' "$output" | grep -q "Failed to fetch version\|Error: Command failed"; then
    printf '%s\n' "$output"
    fail "codependence --update had resolver errors"
  fi
}
