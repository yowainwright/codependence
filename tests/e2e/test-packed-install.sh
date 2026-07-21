#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
WORK_DIR="$(mktemp -d)"
PACK_DIR="$WORK_DIR/pack"
PROJECT_DIR="$WORK_DIR/project"
NPM_CACHE_DIR="$WORK_DIR/npm-cache"
PLUGIN_PACKAGE_DIR="$WORK_DIR/eslint-plugin-legibility"

pass() { printf '[PASS] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1"; exit 1; }

resolve_root_dir() {
  if [ -f "$SCRIPT_DIR/package.json" ]; then
    echo "$SCRIPT_DIR"
    return
  fi

  echo "$(dirname "$(dirname "$SCRIPT_DIR")")"
}

ROOT_DIR="$(resolve_root_dir)"

resolve_fixture_dir() {
  for candidate in "$SCRIPT_DIR" "$SCRIPT_DIR/fixtures" "$ROOT_DIR" "$ROOT_DIR/tests/e2e/fixtures"; do
    if [ -f "$candidate/rust-Cargo.toml.fixture" ]; then
      cd "$candidate" && pwd
      return
    fi
  done

  printf '%s\n' "$ROOT_DIR/tests/e2e/fixtures"
}

FIXTURE_DIR="$(resolve_fixture_dir)"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

assert_file_exists() {
  file="$1"
  label="$2"

  if [ -f "$file" ]; then
    pass "$label"
    return
  fi

  printf 'Expected file: %s\n' "$file"
  fail "$label"
}

assert_file_equals() {
  expected="$1"
  actual="$2"
  label="$3"

  if cmp -s "$expected" "$actual"; then
    pass "$label"
    return
  fi

  diff -u "$expected" "$actual" || true
  fail "$label"
}

assert_tar_contains() {
  tarball="$1"
  path="$2"
  label="$3"

  if tar -tf "$tarball" | grep -Fq "$path"; then
    pass "$label"
    return
  fi

  tar -tf "$tarball"
  fail "$label"
}

pack_package() {
  mkdir -p "$PACK_DIR"
  pack_output="$WORK_DIR/npm-pack.log"
  if ! npm --cache "$NPM_CACHE_DIR" --silent pack "$ROOT_DIR" --ignore-scripts --pack-destination "$PACK_DIR" > "$pack_output" 2>&1; then
    cat "$pack_output"
    fail "npm pack creates tarball"
  fi
  PACK_FILE="$(find "$PACK_DIR" -maxdepth 1 -name '*.tgz' | head -n 1)"

  assert_file_exists "$PACK_FILE" "npm pack creates tarball"
  assert_tar_contains "$PACK_FILE" "package/dist/cli.js" "packed package includes CLI"
  assert_tar_contains "$PACK_FILE" "package/scripts/install-legibility-skill.js" "packed package includes skill installer"
}

prepare_local_legibility_package() {
  cp -RL "$ROOT_DIR/node_modules/eslint-plugin-legibility" "$PLUGIN_PACKAGE_DIR"
  node - "$PLUGIN_PACKAGE_DIR/package.json" <<'NODE'
const fs = require("node:fs");
const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
delete pkg.scripts;
delete pkg.devDependencies;
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
NODE
}

install_package() {
  mkdir -p "$PROJECT_DIR"
  cat > "$PROJECT_DIR/package.json" <<JSON
{"private":true,"type":"module","dependencies":{"codependence":"file:$PACK_FILE","eslint-plugin-legibility":"file:$PLUGIN_PACKAGE_DIR"}}
JSON

  (
    cd "$PROJECT_DIR"
    install_output="$WORK_DIR/npm-install.log"
    if ! npm --cache "$NPM_CACHE_DIR" install --ignore-scripts --no-audit --no-fund > "$install_output" 2>&1; then
      cat "$install_output"
      exit 1
    fi
  )

  assert_file_exists "$PROJECT_DIR/node_modules/codependence/dist/cli.js" "packed install exposes CLI"
  assert_file_exists "$PROJECT_DIR/node_modules/codependence/scripts/install-legibility-skill.js" "packed install exposes skill script"
  assert_file_exists "$PROJECT_DIR/node_modules/eslint-plugin-legibility/bin/agent/install.js" "packed install has legibility installer dependency"
}

run_installed_update() {
  root="$1"
  update_output="$WORK_DIR/packed-update.log"
  if node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" --rootDir "$root" --config "$root/.codependencerc" --update --quiet > "$update_output" 2>&1; then
    return
  fi

  cat "$update_output"
  fail "packed CLI update"
}

test_installed_cli_updates_providers() {
  provider_root="$WORK_DIR/providers"
  mkdir -p "$provider_root/.github/workflows"
  cp "$FIXTURE_DIR/docker-Dockerfile.fixture" "$provider_root/Dockerfile"
  cp "$FIXTURE_DIR/github-actions-workflow.yml.fixture" "$provider_root/.github/workflows/ci.yml"
  cp "$FIXTURE_DIR/rust-Cargo.toml.fixture" "$provider_root/Cargo.toml"
  cat > "$provider_root/.codependencerc" <<'JSON'
{"mode":"verbose","files":["Dockerfile",".github/workflows/ci.yml","Cargo.toml"],"codependencies":[{"node":"24-slim"},{"nginx":"1.27-alpine"},{"actions/checkout":"v5"},{"actions/setup-node":"v5"},{"serde":"1.0.210"},{"tokio":"1.40.0"},{"serde-json":"1.0.145"},{"pretty-assertions":"1.4.1"},{"cc":"1.1.30"},{"libc":"0.2.155"}]}
JSON

  run_installed_update "$provider_root"

  assert_file_equals "$FIXTURE_DIR/expected/docker-Dockerfile.expected" "$provider_root/Dockerfile" "packed CLI updates Dockerfile exactly"
  assert_file_equals "$FIXTURE_DIR/expected/github-actions-workflow.yml.expected" "$provider_root/.github/workflows/ci.yml" "packed CLI updates workflow exactly"
  assert_file_equals "$FIXTURE_DIR/expected/rust-Cargo.toml.expected" "$provider_root/Cargo.toml" "packed CLI updates Cargo.toml exactly"
}

test_installed_legacy_compatibility() {
  legacy_root="$WORK_DIR/legacy"
  mkdir -p "$legacy_root"
  cp "$ROOT_DIR/tests/integration/fixtures/0.3.1/package.json" "$legacy_root/package.json"

  node "$PROJECT_DIR/node_modules/codependence/dist/cli.js" \
    -s "$legacy_root" \
    -r "$legacy_root/" \
    -f package.json \
    -i '**/node_modules/**' \
    -u \
    --silent

  node - "$legacy_root/package.json" <<'NODE'
const fs = require("node:fs");
const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pkg.dependencies.lodash !== "^4.17.21") process.exit(1);
if (pkg.dependencies["fs-extra"] !== "10.0.0") process.exit(1);
NODE

  node - "$PROJECT_DIR/node_modules/codependence" <<'NODE'
const entry = require(process.argv[2]);
if (typeof entry.script !== "function") process.exit(1);
NODE

  "$PROJECT_DIR/node_modules/.bin/cdp" --help >/dev/null
  pass "packed package preserves 0.3.1 compatibility"
}

test_installed_skill_script() {
  (
    cd "$PROJECT_DIR"
    node node_modules/codependence/scripts/install-legibility-skill.js codex --local >/dev/null
  )

  assert_file_exists "$PROJECT_DIR/.codex/skills/eslint-plugin-legibility/SKILL.md" "packed skill installer writes Codex skill"
}

main() {
  if [ ! -d "$ROOT_DIR/node_modules/eslint-plugin-legibility" ]; then
    fail "eslint-plugin-legibility not installed - run bun install first"
  fi

  pack_package
  prepare_local_legibility_package
  install_package
  test_installed_cli_updates_providers
  test_installed_legacy_compatibility
  test_installed_skill_script
}

main
