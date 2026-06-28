#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
mkdir -p "$WORK_DIR/.github/workflows"
cp "$FIXTURE_DIR/github-actions-workflow.yml.fixture" "$WORK_DIR/.github/workflows/ci.yml"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"actions/checkout":"v5"},{"actions/setup-node":"v5"}]}
JSON

run_update "$WORK_DIR"

assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" "uses: actions/checkout@v5" "checkout action updated"
assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" 'uses: "actions/setup-node@v5"' "quoted action updated"
assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" "uses: ./.github/actions/local" "local action preserved"
assert_file_contains "$WORK_DIR/.github/workflows/ci.yml" "uses: docker://alpine:3.19" "docker action preserved"
