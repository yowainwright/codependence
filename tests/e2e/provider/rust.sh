#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
cp "$FIXTURE_DIR/rust-Cargo.toml.fixture" "$WORK_DIR/Cargo.toml"
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"mode":"verbose","codependencies":[{"serde":"1.0.210"},{"tokio":"1.40.0"},{"pretty-assertions":"1.4.1"},{"cc":"1.1.30"},{"libc":"0.2.155"}]}
JSON

run_update "$WORK_DIR"

assert_file_contains "$WORK_DIR/Cargo.toml" 'serde = "1.0.210"' "direct dependency updated"
assert_file_contains "$WORK_DIR/Cargo.toml" 'tokio = { version = "1.40.0", features = ["full"] }' "inline dependency updated"
assert_file_contains "$WORK_DIR/Cargo.toml" 'pretty_assertions = "1.4.1"' "dev dependency updated"
assert_file_contains "$WORK_DIR/Cargo.toml" 'cc = "1.1.30"' "build dependency updated"
assert_file_contains "$WORK_DIR/Cargo.toml" 'libc = "0.2.155"' "target dependency updated"
assert_file_contains "$WORK_DIR/Cargo.toml" 'local-crate = { path = "../local-crate" }' "path dependency preserved"
