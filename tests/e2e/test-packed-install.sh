#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
WORK_DIR="$(mktemp -d)"
PACK_DIR="$WORK_DIR/pack"
PROJECT_DIR="$WORK_DIR/project"
NPM_CACHE_DIR="$WORK_DIR/npm-cache"
BUN_PROJECT_DIR="$WORK_DIR/bun-project"

pass() { printf '[PASS] %s\n' "$1"; }
fail() {
  printf '[FAIL] %s\n' "$1"
  exit 1
}

resolve_root_dir() {
  root="$(dirname "$(dirname "$SCRIPT_DIR")")"
  [ ! -f "$SCRIPT_DIR/package.json" ] || root="$SCRIPT_DIR"
  printf '%s\n' "$root"
}

ROOT_DIR="$(resolve_root_dir)"

resolve_fixture_dir() {
  for candidate in "$SCRIPT_DIR" "$SCRIPT_DIR/fixtures" "$ROOT_DIR" "$ROOT_DIR/tests/e2e/fixtures"; do
    [ -f "$candidate/rust-Cargo.toml.fixture" ] || continue
    cd "$candidate" && pwd
    return
  done

  printf '%s\n' "$ROOT_DIR/tests/e2e/fixtures"
}

FIXTURE_DIR="$(resolve_fixture_dir)"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

assert_file_exists() {
  file="${1:?file is required}"
  label="${2:?label is required}"

  [ -f "$file" ] || report_file_exists_failure
  pass "$label"
}

assert_file_equals() {
  expected="${1:?expected is required}"
  actual="${2:?actual is required}"
  label="${3:?label is required}"

  cmp -s "$expected" "$actual" || report_file_equals_failure
  pass "$label"
}

assert_tar_contains() {
  tarball="${1:?tarball is required}"
  path="${2:?path is required}"
  label="${3:?label is required}"

  tar -tf "$tarball" | grep -Fq "$path" || report_tar_contains_failure
  pass "$label"
}

pack_package() {
  mkdir -p "$PACK_DIR"
  pack_output="$WORK_DIR/npm-pack.log"
  npm --cache "$NPM_CACHE_DIR" --silent pack "$ROOT_DIR" --ignore-scripts --pack-destination "$PACK_DIR" >"$pack_output" 2>&1 || report_pack_failure
  PACK_FILE="$(find "$PACK_DIR" -maxdepth 1 -name '*.tgz' | head -n 1)"

  assert_file_exists "$PACK_FILE" "npm pack creates tarball"
  assert_tar_contains "$PACK_FILE" "package/dist/cli.js" "packed package includes CLI"
  assert_tar_contains "$PACK_FILE" "package/src/config/schema.json" "packed package includes schema"
  ! tar -tf "$PACK_FILE" | grep -q '^package/scripts/' || fail "packed package excludes development scripts"
}

install_package() {
  mkdir -p "$PROJECT_DIR"
  cat >"$PROJECT_DIR/package.json" <<JSON
{"private":true,"type":"module","dependencies":{"codependence":"file:$PACK_FILE"}}
JSON

  (
    cd "$PROJECT_DIR"
    install_output="$WORK_DIR/npm-install.log"
    npm --cache "$NPM_CACHE_DIR" install --no-audit --no-fund >"$install_output" 2>&1 || report_install_failure "$install_output"
  )

  assert_file_exists "$PROJECT_DIR/node_modules/codependence/dist/cli.js" "packed install exposes CLI"
  assert_file_exists "$PROJECT_DIR/node_modules/codependence/src/config/schema.json" "packed install exposes schema"
}

run_installed_update() {
  root="${1:?root is required}"
  update_output="$WORK_DIR/packed-update.log"
  node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" --rootDir "$root" --config "$root/.codependencerc" --update --quiet >"$update_output" 2>&1 || report_update_failure
}

test_installed_cli_updates_providers() {
  provider_root="$WORK_DIR/providers"
  mkdir -p "$provider_root/.github/workflows"
  cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$provider_root/Dockerfile"
  cp "$FIXTURE_DIR/github-actions-workflow.yml.fixture" "$provider_root/.github/workflows/ci.yml"
  cp "$FIXTURE_DIR/rust-Cargo.toml.fixture" "$provider_root/Cargo.toml"
  write_provider_config

  run_installed_update "$provider_root"

  assert_file_equals "$FIXTURE_DIR/expected/docker-Dockerfile.expected" "$provider_root/Dockerfile" "packed CLI updates Dockerfile exactly"
  assert_file_equals "$FIXTURE_DIR/expected/github-actions-workflow.yml.expected" "$provider_root/.github/workflows/ci.yml" "packed CLI updates workflow exactly"
  assert_file_equals "$FIXTURE_DIR/expected/rust-Cargo.toml.expected" "$provider_root/Cargo.toml" "packed CLI updates Cargo.toml exactly"
}

test_installed_legacy_compatibility() {
  legacy_root="$WORK_DIR/legacy"
  mkdir -p "$legacy_root"
  cp "$ROOT_DIR/tests/fixtures/0.3.1/package.json" "$legacy_root/package.json"

  node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" \
    -s "$legacy_root" \
    -r "$legacy_root/" \
    -f package.json \
    -i '**/node_modules/**' \
    -u \
    --silent

  assert_legacy_versions

  assert_legacy_commonjs_entry

  "$PROJECT_DIR/node_modules/.bin/cdp" --help >/dev/null
  pass "packed package preserves 0.3.1 compatibility"
}

test_installed_bunx_smoke() {
  command -v bunx >/dev/null 2>&1 || fail "bunx executable is available"
  mkdir -p "$BUN_PROJECT_DIR"
  cat >"$BUN_PROJECT_DIR/package.json" <<JSON
{"private":true,"type":"module","dependencies":{"codependence":"file:$PACK_FILE"}}
JSON

  (
    cd "$BUN_PROJECT_DIR"
    bun install >/dev/null
    bunx codependence --help >/dev/null
    bunx cdp --help >/dev/null
  )

  pass "packed package runs through bunx"
}

test_installed_target_selection() {
  prepare_selected_targets
  run_selected_bun_target

  grep -q '"lodash": "4.17.21"' "$target_root/package.json" || fail "selected Bun target update"
  grep -q 'FROM alpine:3.19' "$target_root/Dockerfile" || fail "unselected Docker target"

  printf '{"name":"fixture","version":"1.0.0","dependencies":{"lodash":"4.17.20"}}\n' >"$target_root/package.json"
  rm "$target_root/bun.lock"
  ! run_selected_bun_target >/dev/null 2>&1 || fail "missing selected target lockfile"

  grep -q '"lodash":"4.17.20"' "$target_root/package.json" || fail "lockfile preflight"
  manifest_only="false"
  run_selected_bun_target "$manifest_only"
  grep -q '"lodash": "4.17.21"' "$target_root/package.json" || fail "manifest-only target update"
  pass "packed package selects managers and preflights lockfiles"
}

test_default_workflows() {
  prepare_default_workflows
  run_default_workflow_init >/dev/null

  assert_workflow_files
  assert_workflow_targets
  assert_workflow_defaults
  ! run_default_workflow_init >/dev/null 2>&1 || fail "generated workflows require explicit replacement"

  run_default_workflow_init --force >/dev/null
}

test_targeted_workflow() {
  prepare_targeted_workflow
  node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" \
    init actions \
    --rootDir "$targeted_root" \
    --target go \
    --version go=1.25.3 \
    --schedule 'go=30 7 * * 5' \
    --post-update-command 'go=task go:tidy' >/dev/null

  assert_file_exists "$targeted_workflow" "packed CLI initializes selected workflow"
  node_targeted_workflow="$targeted_root/.github/workflows/codependence-node.yml"
  ! [ -f "$node_targeted_workflow" ] || fail "packed CLI skips unselected workflow"

  expected_schedule='cron: "30 7 * * 5"'
  expected_command="post-update-command: '(cd -- ''backend'' && task go:tidy)'"
  grep -Fq 'version: 1.25.3' "$targeted_workflow" || fail "workflow version override"
  grep -Fq "$expected_schedule" "$targeted_workflow" || fail "workflow schedule override"
  grep -Fq "$expected_command" "$targeted_workflow" || fail "workflow command override"
}

test_missing_tool_version() {
  missing_version_root="$WORK_DIR/init-actions-missing-version"
  mkdir -p "$missing_version_root"
  write_missing_version_config
  ! node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" \
    init actions \
    --rootDir "$missing_version_root" >/dev/null 2>&1 || fail "packed CLI requires an exact tool version"
  ! [ -d "$missing_version_root/.github/workflows" ] || fail "packed CLI avoids partial writes on version errors"
}

test_invalid_workflow_schedule() {
  invalid_schedule_root="$WORK_DIR/init-actions-invalid-schedule"
  mkdir -p "$invalid_schedule_root"
  write_invalid_schedule_config
  ! node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" \
    init actions \
    --rootDir "$invalid_schedule_root" \
    --version go=1.25.3 \
    --schedule go=weekly >/dev/null 2>&1 || fail "packed CLI rejects an invalid schedule"
  ! [ -d "$invalid_schedule_root/.github/workflows" ] || fail "packed CLI avoids partial writes on schedule errors"
  pass "packed CLI safely initializes split GitHub Actions workflows"
}

test_installed_init_actions() {
  test_default_workflows
  test_targeted_workflow
  test_missing_tool_version
  test_invalid_workflow_schedule
}

test_installed_docker_action_workflow() {
  docker_root="$WORK_DIR/init-actions-docker"
  docker_workflow="$docker_root/.github/workflows/codependence-docker.yml"
  mkdir -p "$docker_root"
  printf '%s\n' '{"targets":[{"manager":"docker"},{"manager":"github-actions"}]}' >"$docker_root/.codependencerc"
  node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" \
    init actions --rootDir "$docker_root" >/dev/null
  assert_file_exists "$docker_workflow" "packed CLI initializes Docker-only workflow"
  grep -q 'targets: docker' "$docker_workflow" || fail "generated Docker-only target"
  ! grep -q 'github-actions' "$docker_workflow" || fail "generated Docker workflow isolates GitHub Actions"
  grep -q 'pull-request: true' "$docker_workflow" || fail "generated Docker PR mode"
}

test_installed_package_exports() {
  (
    cd "$PROJECT_DIR"
    assert_installed_exports
  )
  pass "packed package exposes API and schema without installing agent configuration"
}

main() {
  pack_package
  install_package
  test_installed_package_exports
  test_installed_cli_updates_providers
  test_installed_legacy_compatibility
  test_installed_bunx_smoke
  test_installed_target_selection
  test_installed_init_actions
  test_installed_docker_action_workflow
}

write_provider_config() {
  cat >"$provider_root/.codependencerc" <<'JSON'
{"mode":"verbose","files":["Dockerfile",".github/workflows/ci.yml","Cargo.toml"],"codependencies":[{"node":"24-slim"},{"nginx":"1.27-alpine"},{"alpine":"3.20"},{"actions/checkout":"v5"},{"actions/setup-node":"v5"},{"serde":"1.0.210"},{"tokio":"1.40.0"},{"serde-json":"1.0.145"},{"pretty-assertions":"1.4.1"},{"cc":"1.1.30"},{"libc":"0.2.155"}]}
JSON
}

assert_legacy_versions() {
  node - "$legacy_root/package.json" <<'NODE'
const fs = require("node:fs");
const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pkg.dependencies.lodash !== "^4.17.21") process.exit(1);
if (pkg.dependencies["fs-extra"] !== "10.0.0") process.exit(1);
NODE
}

assert_legacy_commonjs_entry() {
  node - "$PROJECT_DIR/node_modules/codependence" <<'NODE'
const entry = require(process.argv[2]);
if (typeof entry.script !== "function") process.exit(1);
NODE
}

write_target_package() {
  cat >"$target_root/package.json" <<'JSON'
{"name":"fixture","version":"1.0.0","dependencies":{"lodash":"4.17.20"}}
JSON
}

write_target_config() {
  cat >"$target_root/.codependencerc" <<'JSON'
{"targets":[{"manager":"bun","files":["package.json"],"codependencies":[{"lodash":"4.17.21"}],"mode":"verbose"},{"manager":"docker","files":["Dockerfile"],"codependencies":[{"alpine":"3.20"}],"mode":"verbose"}]}
JSON
}

write_workflow_targets() {
  cat >"$action_root/.codependencerc" <<'JSON'
{
  "targets": [
    { "manager": "bun" },
    { "manager": "uv" },
    { "manager": "go" },
    { "manager": "rust" },
    { "manager": "docker" },
    { "manager": "circleci", "codependencies": [{ "circleci/node": "7.2.0" }] },
    { "manager": "github-actions" },
    { "manager": "helm", "codependencies": [{ "redis": "20.6.3" }] },
    { "manager": "kubernetes", "codependencies": [{ "nginx": "1.27.0" }] },
    { "manager": "kustomize", "codependencies": [{ "nginx": "1.27.0" }] },
    { "manager": "terraform", "codependencies": [{ "hashicorp/aws": "5.31.0" }] }
  ]
}
JSON
}

write_workflow_package() {
  cat >"$action_root/package.json" <<'JSON'
{
  "name": "fixture",
  "packageManager": "bun@1.3.14"
}
JSON
}

write_targeted_workflow_config() {
  cat >"$targeted_root/.codependencerc" <<'JSON'
{
  "targets": [
    { "manager": "bun" },
    { "manager": "go", "rootDir": "backend" }
  ]
}
JSON
}

write_targeted_workflow_package() {
  cat >"$targeted_root/package.json" <<'JSON'
{
  "name": "fixture",
  "packageManager": "bun@1.3.14"
}
JSON
}

write_missing_version_config() {
  cat >"$missing_version_root/.codependencerc" <<'JSON'
{"targets":[{"manager":"uv"}]}
JSON
}

write_invalid_schedule_config() {
  cat >"$invalid_schedule_root/.codependencerc" <<'JSON'
{"targets":[{"manager":"go"}]}
JSON
}

assert_installed_exports() {
  node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import codependence, { schema } from "codependence";
const require = createRequire(import.meta.url);
const commonjs = require("codependence");
const schemaPath = require.resolve("codependence/schema.json");
assert.equal(typeof codependence, "function");
assert.equal(typeof commonjs.codependence, "function");
assert.deepEqual(schema, JSON.parse(readFileSync(schemaPath, "utf8")));
assert.deepEqual(commonjs.schema, schema);
for (const path of ["AGENTS.md", "CLAUDE.md", ".agents", ".claude", ".codex"]) {
  assert.equal(existsSync(path), false, `install must not create ${path}`);
}
NODE
}

report_file_exists_failure() {
  printf 'Expected file: %s\n' "$file"
  fail "$label"
}

report_file_equals_failure() {
  diff -u "$expected" "$actual" || :
  fail "$label"
}

report_tar_contains_failure() {
  tar -tf "$tarball"
  fail "$label"
}

report_pack_failure() {
  cat "$pack_output"
  fail "npm pack creates tarball"
}

report_install_failure() {
  cat "${1:?install output is required}"
  exit 1
}

report_update_failure() {
  cat "$update_output"
  fail "packed CLI update"
}

run_selected_bun_target() {
  lockfile_policy="${1:-true}"
  (
    cd "$target_root"
    node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" \
      --config .codependencerc --target bun --lockfile "$lockfile_policy" --update --quiet
  )
}

prepare_selected_targets() {
  target_root="$WORK_DIR/targets"
  mkdir -p "$target_root"
  write_target_package
  : >"$target_root/bun.lock"
  printf 'FROM alpine:3.19\n' >"$target_root/Dockerfile"
  write_target_config

}

prepare_default_workflows() {
  action_root="$WORK_DIR/init-actions"
  workflow_dir="$action_root/.github/workflows"
  node_workflow="$workflow_dir/codependence-node.yml"
  python_workflow="$workflow_dir/codependence-python.yml"
  go_workflow="$workflow_dir/codependence-go.yml"
  rust_workflow="$workflow_dir/codependence-rust.yml"
  infrastructure_workflow="$workflow_dir/codependence-infrastructure.yml"
  mkdir -p "$action_root"
  write_workflow_targets
  write_workflow_package
  printf 'module example.com/fixture\n\ngo 1.26\n' >"$action_root/go.mod"
  printf '[toolchain]\nchannel = "1.88.0"\n' >"$action_root/rust-toolchain.toml"

}

assert_workflow_files() {
  assert_file_exists "$node_workflow" "packed CLI initializes Node workflow"
  assert_file_exists "$python_workflow" "packed CLI initializes Python workflow"
  assert_file_exists "$go_workflow" "packed CLI initializes Go workflow"
  assert_file_exists "$rust_workflow" "packed CLI initializes Rust workflow"
  assert_file_exists "$infrastructure_workflow" "packed CLI initializes infrastructure workflow"

}

assert_workflow_targets() {
  grep -q 'targets: bun' "$node_workflow" || fail "generated Node target"
  grep -q 'version: 0.8.0' "$python_workflow" || fail "generated Python version"
  grep -q 'version: 1.26.0' "$go_workflow" || fail "generated exact Go version"
  grep -q 'version: 1.88.0' "$rust_workflow" || fail "generated exact Rust version"
  grep -q 'cargo generate-lockfile' "$rust_workflow" || fail "generated Rust lockfile command"
  grep -q 'github-actions' "$infrastructure_workflow" || fail "generated GitHub Actions target"
  grep -q 'helm' "$infrastructure_workflow" || fail "generated Helm target"
  grep -q 'circleci' "$infrastructure_workflow" || fail "generated CircleCI target"
  grep -q 'kubernetes' "$infrastructure_workflow" || fail "generated Kubernetes target"
  grep -q 'kustomize' "$infrastructure_workflow" || fail "generated Kustomize target"
  grep -q 'terraform' "$infrastructure_workflow" || fail "generated Terraform target"
}

assert_workflow_defaults() {
  default_schedule='cron: "0 9 * * 1"'
  pull_request_mode='pull-request: true'
  for workflow_file in "$node_workflow" "$python_workflow" "$go_workflow" "$rust_workflow" "$infrastructure_workflow"; do
    grep -Fq "$default_schedule" "$workflow_file" || fail "workflow default schedule"
    grep -Fq "$pull_request_mode" "$workflow_file" || fail "workflow pull request mode"
  done

}

prepare_targeted_workflow() {
  targeted_root="$WORK_DIR/init-actions-targeted"
  targeted_workflow="$targeted_root/.github/workflows/codependence-go.yml"
  mkdir -p "$targeted_root"
  write_targeted_workflow_config
  write_targeted_workflow_package
  mkdir -p "$targeted_root/backend"
  printf 'module example.com/fixture\n\ngo 1.26.4\n' >"$targeted_root/backend/go.mod"

}

run_default_workflow_init() {
  node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" init actions \
    --rootDir "$action_root" --version uv=0.8.0 "$@"
}

main
