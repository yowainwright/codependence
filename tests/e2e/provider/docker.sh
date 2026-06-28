#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"node":"24-slim"},{"nginx":"1.27-alpine"}]}
JSON

run_update "$WORK_DIR"

assert_file_contains "$WORK_DIR/Dockerfile" "FROM node:24-slim AS builder" "builder image updated"
assert_file_contains "$WORK_DIR/Dockerfile" "FROM nginx:1.27-alpine" "runtime image updated"
