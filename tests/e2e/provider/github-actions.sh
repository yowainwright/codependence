#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=helpers.sh
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

write_github_actions_codependencerc() {
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"actions/checkout":"v5"},{"actions/setup-node":"v5"},{"actions/cache":"v5"}]}
JSON
}

test_github_actions() {
  make_tmp_dir
  mkdir -p "$WORK_DIR/.github/workflows"
  cp "$FIXTURE_DIR/github-actions-workflow.yml.fixture" "$WORK_DIR/.github/workflows/ci.yml"
  write_github_actions_codependencerc

  run_update "$WORK_DIR"

  assert_file_equals "$FIXTURE_DIR/expected/github-actions-workflow.yml.expected" "$WORK_DIR/.github/workflows/ci.yml" "github actions update matches golden output"

  assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" "uses: actions/checkout@v5" "checkout action updated"
  assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" 'uses: "actions/setup-node@v5"' "quoted action updated"
  assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" "uses: actions/cache@0123456789abcdef0123456789abcdef01234567" "sha action preserved"
  assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" "uses: ./.github/actions/local" "local action preserved"
  assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" "uses: docker://alpine:3.19" "docker action preserved"
  assert_file_unchanged_after_update "$WORK_DIR" "$WORK_DIR/.github/workflows/ci.yml" "github actions update is idempotent"
}

main() {
  require_built_cli
  test_github_actions
}

main
