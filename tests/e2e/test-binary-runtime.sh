#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=helpers.sh
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

write_package_manager_subprocess_codependencerc() {
  cp "$FIXTURE_DIR/binary-package-manager/binary-package-manager.sh" "$WORK_DIR/bin/npm"
  chmod +x "$WORK_DIR/bin/npm"

  cp "$FIXTURE_DIR/binary-package-manager/package.json.fixture" "$WORK_DIR/package.json"

  cp "$FIXTURE_DIR/binary-package-manager/codependencerc.fixture" "$WORK_DIR/.codependencerc"
}

test_package_manager_subprocess() {
  make_tmp_dir
  mkdir -p "$WORK_DIR/bin"

  write_package_manager_subprocess_codependencerc

  PATH="$WORK_DIR/bin:$PATH"
  export PATH
  run_update "$WORK_DIR"
  assert_file_contains "$WORK_DIR/package.json" '"lodash": "4.17.21"' "binary package-manager subprocess"
}

write_concurrent_subprocesses_codependencerc() {
  cp "$FIXTURE_DIR/binary-concurrency/binary-concurrency.sh" "$WORK_DIR/bin/npm"
  chmod +x "$WORK_DIR/bin/npm"

  cp "$FIXTURE_DIR/binary-concurrency/package.json.fixture" "$WORK_DIR/package.json"

  cp "$FIXTURE_DIR/binary-concurrency/codependencerc.fixture" "$WORK_DIR/.codependencerc"
}

test_concurrent_subprocesses() {
  make_tmp_dir
  mkdir -p "$WORK_DIR/bin" "$WORK_DIR/running"
  write_concurrent_subprocesses_codependencerc

  PATH="$WORK_DIR/bin:$PATH"
  BINARY_CONCURRENCY_DIR="$WORK_DIR/running"
  export PATH BINARY_CONCURRENCY_DIR
  run_update "$WORK_DIR"
  assert_file_contains "$WORK_DIR/package.json" '"alpha": "2.0.0"' "binary concurrent subprocesses"
  assert_file_contains "$WORK_DIR/package.json" '"beta": "2.0.0"' "binary concurrent subprocess output"
}

write_go_subprocess_codependencerc() {
  cp "$FIXTURE_DIR/binary-go/binary-go.sh" "$WORK_DIR/bin/go"
  chmod +x "$WORK_DIR/bin/go"

  cp "$FIXTURE_DIR/binary-go/go.mod.fixture" "$WORK_DIR/go.mod"

  cp "$FIXTURE_DIR/binary-go/codependencerc.fixture" "$WORK_DIR/.codependencerc"
}

test_go_subprocess() {
  make_tmp_dir
  mkdir -p "$WORK_DIR/bin"
  write_go_subprocess_codependencerc

  PATH="$WORK_DIR/bin:$PATH"
  GO_TIDY_LOG="$WORK_DIR/go-tidy.log"
  export PATH GO_TIDY_LOG
  run_update "$WORK_DIR"
  assert_file_contains "$WORK_DIR/go.mod" 'example.com/dependency v1.1.0' "binary Go resolver subprocess"
  assert_file_contains "$WORK_DIR/go-tidy.log" 'tidied' "binary synchronous Go subprocess"
}

write_interactive_prompts_package_json() {
  cat >"$WORK_DIR/package.json" <<'JSON'
{
  "name": "binary-interactive-test",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "4.17.21"
  }
}
JSON
}

test_interactive_prompts() {
  make_tmp_dir
  write_interactive_prompts_package_json

  python3 "$SCRIPT_DIR/scripts/test-binary-interactive.py" "$BINARY_CLI" "$WORK_DIR"
  assert_file_contains "$WORK_DIR/package.json" '"codependencies"' "binary streaming TTY prompts"
  assert_file_contains "$WORK_DIR/package.json" '"lodash"' "binary streaming TTY output"
}

main() {
  require_built_cli
  test_package_manager_subprocess
  test_concurrent_subprocesses
  test_go_subprocess
  test_interactive_prompts
}

main
