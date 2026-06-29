#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"node":"24-slim"},{"nginx":"1.27-alpine"},{"alpine":"3.20"}]}
JSON

run_update "$WORK_DIR"

assert_file_equals "$FIXTURE_DIR/expected/docker-Dockerfile.expected" "$WORK_DIR/Dockerfile" "docker update matches golden output"

variable_tag_line='FROM alpine:${ALPINE_VERSION} AS variable-tag'
digest_line="FROM alpine@sha256:0123456789abcdef"
scratch_line="FROM scratch AS empty-root"

assert_file_contains "$WORK_DIR/Dockerfile" "FROM node:24-slim AS builder" "builder image updated"
assert_file_contains "$WORK_DIR/Dockerfile" "FROM nginx:1.27-alpine" "runtime image updated"
assert_file_contains "$WORK_DIR/Dockerfile" "$variable_tag_line" "variable tag preserved"
assert_file_contains "$WORK_DIR/Dockerfile" "$digest_line" "digest image preserved"
assert_file_contains "$WORK_DIR/Dockerfile" "$scratch_line" "scratch image preserved"
assert_file_unchanged_after_update "$WORK_DIR" "$WORK_DIR/Dockerfile" "docker update is idempotent"

make_tmp_dir
cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":["node"]}
JSON

assert_update_fails_unchanged "$WORK_DIR" "$WORK_DIR/Dockerfile" "docker provider requires explicit version pins" "docker string codependency"

make_tmp_dir
cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"precise"}
JSON

assert_update_fails_unchanged "$WORK_DIR" "$WORK_DIR/Dockerfile" "docker provider requires explicit version pins" "docker precise mode"
