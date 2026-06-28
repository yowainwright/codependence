#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
cp "$FIXTURE_DIR/python-uv-pyproject.toml.fixture" "$WORK_DIR/pyproject.toml"
cp "$FIXTURE_DIR/uv.lock.fixture" "$WORK_DIR/uv.lock"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"requests":"==2.32.0"},{"pytest":"==8.2.0"},{"mkdocs":"==1.6.0"},{"mypy":"==1.10.0"}]}
JSON

run_update "$WORK_DIR"

assert_file_contains "$WORK_DIR/pyproject.toml" '"requests==2.32.0"' "project dependency updated"
assert_file_contains "$WORK_DIR/pyproject.toml" '"pytest==8.2.0"' "dev dependency group updated"
assert_file_contains "$WORK_DIR/pyproject.toml" '"mkdocs==1.6.0"' "optional dependency updated"
assert_file_contains "$WORK_DIR/pyproject.toml" '"mypy==1.10.0"' "named dependency group updated"
assert_file_contains "$WORK_DIR/pyproject.toml" '"flask>=2.2.0"' "untouched dependency preserved"
