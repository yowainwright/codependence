#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=helpers.sh
source "$SCRIPT_DIR/helpers.sh"
trap cleanup_provider_e2e EXIT
SCENARIOS=(init monorepo major-updates security verbose-mode precise-mode basic-check permissive-mode)

prepare_scenario() {
  local name="${1:?scenario is required}" manifest
  make_tmp_dir
  cp -R "$FIXTURE_DIR/scenarios/$name/." "$WORK_DIR/"
  while IFS= read -r -d '' manifest; do
    cp "$manifest" "${manifest%package-test.json}package.json"
  done < <(find "$WORK_DIR" -name package-test.json -print0)
}

scenario_run() {
  local expected="${1:?expected exit is required}" status=0
  shift
  output=$(cd "$WORK_DIR" && "$@" 2>&1) || status=$?
  [ "$status" -eq "$expected" ] && return 0
  printf '%s\n' "$output"
  fail "Expected exit $expected, received $status: $*"
}

assert_version() {
  node -e '
    const [file, section, name, version] = process.argv.slice(1);
    const manifest = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
    require("node:assert/strict").equal(manifest[section][name], version);
  ' "$WORK_DIR/${4:-package.json}" "$1" "$2" "$3"
  pass "$2 remains at expected version $3"
}

update_scenario() {
  scenario_run 0 run_cli --config package.json --update "$@"
}

test_init() {
  scenario_run 0 run_cli init rc
  assert_file_contains "$WORK_DIR/.codependencerc" 'codependencies' 'init rc writes config'
  prepare_scenario init
  scenario_run 0 run_cli init --mode precise --codependencies react --enforcement github \
    --repository acme/sandbox --version npm=11.0.0 --non-interactive --skip-install
  assert_file_contains "$WORK_DIR/package.json" 'precise' 'guided init writes policy'
  assert_file_contains "$WORK_DIR/.github/workflows/codependence-node.yml" '11.0.0' 'init writes workflow'
}

test_monorepo() {
  update_scenario --quiet
  assert_version dependencies lodash '^4.17.21' packages/web/package.json
  assert_version dependencies chalk 4.1.2 packages/api/package.json
  prepare_scenario monorepo
  cp "$WORK_DIR/init-package-test.json" "$WORK_DIR/package.json"
  scenario_run 0 run_cli init config --mode precise --codependencies chalk --non-interactive --skip-install
  assert_file_contains "$WORK_DIR/.codependencerc" 'packages/web/package.json' 'init discovers workspace manifests'
}

test_major_updates() {
  scenario_run 0 python3 "$SCRIPT_DIR/scripts/test-binary-interactive.py" "$CLI" "$WORK_DIR" major-decline
  assert_version dependencies react 18.2.0
  assert_version dependencies semver 7.6.0
  prepare_scenario major-updates
  scenario_run 0 python3 "$SCRIPT_DIR/scripts/test-binary-interactive.py" "$CLI" "$WORK_DIR" major-accept
  assert_version dependencies react 19.0.0
  prepare_scenario major-updates
  cp "$WORK_DIR/duplicate-package-test.json" "$WORK_DIR/package.json"
  scenario_run 0 python3 "$SCRIPT_DIR/scripts/test-binary-interactive.py" "$CLI" "$WORK_DIR" major-decline
  assert_version dependencies chalk 4.1.1
  assert_version devDependencies chalk 3.0.0
  prepare_scenario major-updates
  scenario_run 0 python3 "$SCRIPT_DIR/scripts/test-binary-interactive.py" "$CLI" "$WORK_DIR" major-ci
  assert_version dependencies react 19.0.0
}

test_security() {
  scenario_run 0 npm install --package-lock-only --ignore-scripts --workspaces=false
  scenario_run 1 npm audit --json
  update_scenario --level patch --quiet
  assert_version dependencies undici 7.30.1
  assert_version dependencies ip-address 10.7.4
  scenario_run 0 npm install --package-lock-only --ignore-scripts --workspaces=false
  scenario_run 0 npm audit --json
  scenario_run 0 node "$ROOT_DIR/node_modules/pastoralist/dist/index.js" \
    --dry-run --checkSecurity --strict --outputFormat json --refresh-cache
  printf '%s\n' "$output" | node -e '
    let text = "";
    process.stdin.on("data", chunk => { text += chunk; });
    process.stdin.on("end", () => {
      require("node:assert/strict").equal(JSON.parse(text).securityAlertCount, 0);
    });
  '
  pass 'patched fixture passes npm and Pastoralist security checks'
}

test_verbose_mode() {
  update_scenario --verbose
  assert_version dependencies lodash '^4.17.21'
  assert_version dependencies react 18.2.0
  assert_version dependencies chalk 4.1.1
}

test_precise_mode() {
  update_scenario --quiet
  assert_version dependencies react 18.2.0
  assert_file_not_contains "$WORK_DIR/package.json" '^4.17.20' 'precise updates unpinned lodash'
}

test_basic_check() {
  cp "$WORK_DIR/package.json" "$WORK_DIR/before.json"
  scenario_run 1 run_cli --config package.json --dryRun
  assert_file_equals "$WORK_DIR/before.json" "$WORK_DIR/package.json" 'dry run leaves manifest unchanged'
  scenario_run 1 run_cli --config package.json --format json --noCache
  printf '%s\n' "$output" | node -e 'JSON.parse(require("node:fs").readFileSync(0, "utf8"));'
  update_scenario --level patch --quiet
  assert_version dependencies lodash '^4.17.21'
  assert_version dependencies react 18.2.0
  update_scenario --level minor --quiet
  assert_version dependencies react 18.3.1
  scenario_run 0 run_cli --config package.json --format markdown
}

test_permissive_mode() {
  update_scenario --quiet
  assert_version dependencies react 17.0.2
  assert_version dependencies react-dom 17.0.2
  assert_version dependencies react-router 5.3.3
  assert_file_not_contains "$WORK_DIR/package.json" '4.17.19' 'permissive updates unpinned lodash'
}

manual_scenario() {
  mkdir -p "$WORK_DIR/bin"
  ln -s "${BINARY_CLI:-$CLI}" "$WORK_DIR/bin/codependence"
  ln -s "$ROOT_DIR/node_modules/pastoralist/dist/index.js" "$WORK_DIR/bin/pastoralist"
  printf 'Sandbox: %s\nExit the shell to discard changes.\n' "$WORK_DIR"
  (
    cd "$WORK_DIR"
    export PATH="$WORK_DIR/bin:$PATH"
    unset CI GITHUB_ACTIONS
    bash --noprofile --norc -i
  )
}

run_scenario() {
  local name="${1:?scenario is required}"
  prepare_scenario "$name"
  "test_${name//-/_}"
  pass "$name"
}

validate_scenario() {
  local name
  for name in "${SCENARIOS[@]}"; do
    [ "$1" != "$name" ] || return 0
  done
  fail "Unknown scenario: $1. Available: ${SCENARIOS[*]}"
}

main() {
  local action="${1:-all}" name
  require_built_cli
  case "$action" in
  list) printf '%s\n' "${SCENARIOS[@]}" ;;
  dev)
    validate_scenario "${2:-init}"
    prepare_scenario "${2:-init}"
    manual_scenario
    ;;
  all) for name in "${SCENARIOS[@]}"; do run_scenario "$name"; done ;;
  *)
    validate_scenario "$action"
    run_scenario "$action"
    ;;
  esac
}

main "$@"
