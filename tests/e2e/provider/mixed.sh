#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli

make_tmp_dir
mkdir -p "$WORK_DIR/.github/workflows"
cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
cp "$FIXTURE_DIR/github-actions-workflow.yml.fixture" "$WORK_DIR/.github/workflows/ci.yml"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","files":["Dockerfile",".github/workflows/ci.yml"],"codependencies":[{"node":"24-slim"},{"nginx":"1.27-alpine"},{"alpine":"3.20"},{"actions/checkout":"v5"},{"actions/setup-node":"v5"}]}
JSON

run_update "$WORK_DIR"
assert_file_equals "$FIXTURE_DIR/expected/docker-Dockerfile.expected" "$WORK_DIR/Dockerfile" "mixed provider docker output matches golden"
assert_file_equals "$FIXTURE_DIR/expected/github-actions-workflow.yml.expected" "$WORK_DIR/.github/workflows/ci.yml" "mixed provider github actions output matches golden"

make_tmp_dir
mkdir -p "$WORK_DIR/.github/workflows"
cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
cp "$FIXTURE_DIR/github-actions-workflow.yml.fixture" "$WORK_DIR/.github/workflows/ci.yml"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"precise","files":["Dockerfile",".github/workflows/ci.yml"]}
JSON

docker_before="$(mktemp)"
actions_before="$(mktemp)"
cp "$WORK_DIR/Dockerfile" "$docker_before"
cp "$WORK_DIR/.github/workflows/ci.yml" "$actions_before"

run_update_expect_failure "$WORK_DIR" "Latest resolution currently supports one provider" "mixed provider precise mode"
assert_file_equals "$docker_before" "$WORK_DIR/Dockerfile" "mixed provider failed precise leaves Dockerfile unchanged"
assert_file_equals "$actions_before" "$WORK_DIR/.github/workflows/ci.yml" "mixed provider failed precise leaves workflow unchanged"
rm -f "$docker_before" "$actions_before"
