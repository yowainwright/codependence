#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=helpers.sh
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

# Docker variable references are literal expected output.

# shellcheck disable=SC2016
node_tag_line='FROM node:${NODE_VERSION}-slim AS builder'
# Docker variable references are literal expected output.
# shellcheck disable=SC2016
variable_tag_line='FROM alpine:${ALPINE_VERSION} AS variable-tag'
digest_line="FROM alpine@sha256:0123456789abcdef"
scratch_line="FROM scratch AS empty-root"

assert_pinned_images() {
  assert_file_equals "$FIXTURE_DIR/expected/docker-Dockerfile.expected" "$WORK_DIR/Dockerfile" "docker update matches golden output"

  assert_file_contains "$WORK_DIR/Dockerfile" "ARG NODE_VERSION=24" "composed tag argument updated"
  assert_file_contains "$WORK_DIR/Dockerfile" "$node_tag_line" "composed tag suffix preserved"
  assert_file_contains "$WORK_DIR/Dockerfile" "FROM nginx:1.27-alpine" "runtime image updated"
  assert_file_contains "$WORK_DIR/Dockerfile" "ARG ALPINE_VERSION=3.20" "variable tag argument updated"
  assert_file_contains "$WORK_DIR/Dockerfile" "$variable_tag_line" "variable tag reference preserved"
  assert_file_contains "$WORK_DIR/Dockerfile" "$digest_line" "digest image preserved"
  assert_file_contains "$WORK_DIR/Dockerfile" "$scratch_line" "scratch image preserved"
  assert_file_unchanged_after_update "$WORK_DIR" "$WORK_DIR/Dockerfile" "docker update is idempotent"
}

write_pinned_images_codependencerc() {
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"node":"24-slim"},{"nginx":"1.27-alpine"},{"alpine":"3.20"}]}
JSON
}

test_pinned_images() {
  make_tmp_dir
  cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
  write_pinned_images_codependencerc

  run_update "$WORK_DIR"

  assert_pinned_images
}

write_latest_image_codependencerc() {
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":["alpine"]}
JSON
}

test_latest_image() {
  make_tmp_dir
  cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
  write_latest_image_codependencerc

  run_update "$WORK_DIR"

  assert_file_not_contains "$WORK_DIR/Dockerfile" "ARG ALPINE_VERSION=3.19" "Docker Hub tag resolved"
  assert_file_contains "$WORK_DIR/Dockerfile" "$variable_tag_line" "resolved ARG reference preserved"
  assert_file_contains "$WORK_DIR/Dockerfile" "$digest_line" "resolved update preserves digest image"
  assert_file_unchanged_after_update "$WORK_DIR" "$WORK_DIR/Dockerfile" "resolved Docker update is idempotent"
}

write_repeated_image_codependencerc() {
  cat >"$WORK_DIR/Dockerfile" <<'DOCKERFILE'
FROM node:20-slim
FROM node:20-alpine
DOCKERFILE
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":["node"]}
JSON
}

test_repeated_image() {
  make_tmp_dir
  write_repeated_image_codependencerc

  run_update "$WORK_DIR"

  assert_file_not_contains "$WORK_DIR/Dockerfile" "FROM node:20-slim" "first repeated image tag resolved"
  assert_file_not_contains "$WORK_DIR/Dockerfile" "FROM node:20-alpine" "second repeated image tag resolved"
  assert_file_contains "$WORK_DIR/Dockerfile" "-slim" "first repeated image family preserved"
  assert_file_contains "$WORK_DIR/Dockerfile" "-alpine" "second repeated image family preserved"
}

write_precise_images_codependencerc() {
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"precise","codependencies":[{"node":"20-slim"},{"nginx":"1.25-alpine"}]}
JSON
}

test_precise_images() {
  make_tmp_dir
  cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$WORK_DIR/Dockerfile"
  write_precise_images_codependencerc

  run_update "$WORK_DIR"

  assert_file_not_contains "$WORK_DIR/Dockerfile" "ARG ALPINE_VERSION=3.19" "Docker precise mode resolves unpinned images"
  assert_file_contains "$WORK_DIR/Dockerfile" "$digest_line" "Docker precise mode preserves digest image"
}

main() {
  require_built_cli
  test_pinned_images
  test_latest_image
  test_repeated_image
  test_precise_images
}

main
