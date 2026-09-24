#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=helpers.sh
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

write_circleci_dependencies_codependencerc() {
  cat >"$WORK_DIR/.circleci/config.yml" <<'YAML'
version: 2.1
orbs:
  node: circleci/node@7.1.0 # orb
jobs:
  test:
    docker:
      - image: "cimg/node:22.11" # image
      - image: "<< parameters.image >>"
YAML
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"targets":[{"manager":"circleci","mode":"verbose","codependencies":[{"circleci/node":"7.2.0"},{"cimg/node":"22.12"}]}]}
JSON
}

test_circleci_dependencies() {
  make_tmp_dir
  mkdir -p "$WORK_DIR/.circleci"
  write_circleci_dependencies_codependencerc

  run_update_from_root "$WORK_DIR"

  assert_file_contains "$WORK_DIR/.circleci/config.yml" "circleci/node@7.2.0 # orb" "circleci orb updated"
  assert_file_contains "$WORK_DIR/.circleci/config.yml" 'image: "cimg/node:22.12" # image' "circleci executor image updated"
  assert_file_contains "$WORK_DIR/.circleci/config.yml" 'image: "<< parameters.image >>"' "circleci templated image preserved"
  assert_file_unchanged_after_update_from_root "$WORK_DIR" "$WORK_DIR/.circleci/config.yml" "circleci update is idempotent"
}

main() {
  require_built_cli
  test_circleci_dependencies
}

main
