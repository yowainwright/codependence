#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=helpers.sh
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

write_uv_dependencies_codependencerc() {
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"requests":"==2.32.0"},{"pytest":"==8.2.0"},{"mkdocs":"==1.6.0"},{"mypy":"==1.10.0"}]}
JSON
}

test_uv_dependencies() {
  make_tmp_dir
  cp "$FIXTURE_DIR/python-uv-pyproject.toml.fixture" "$WORK_DIR/pyproject.toml"
  cp "$FIXTURE_DIR/uv.lock.fixture" "$WORK_DIR/uv.lock"
  write_uv_dependencies_codependencerc

  run_update "$WORK_DIR"

  assert_file_contains "$WORK_DIR/pyproject.toml" '"requests==2.32.0"' "project dependency updated"
  assert_file_contains "$WORK_DIR/pyproject.toml" '"pytest==8.2.0"' "dev dependency group updated"
  assert_file_contains "$WORK_DIR/pyproject.toml" '"mkdocs==1.6.0"' "optional dependency updated"
  assert_file_contains "$WORK_DIR/pyproject.toml" '"mypy==1.10.0"' "named dependency group updated"
  assert_file_contains "$WORK_DIR/pyproject.toml" '"flask>=2.2.0"' "untouched dependency preserved"
}

main() {
  require_built_cli
  test_uv_dependencies
}

main
