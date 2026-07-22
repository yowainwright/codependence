#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
WORK_DIR="$(mktemp -d)"
PROJECT_DIR="$WORK_DIR/project"
HOME_DIR="$WORK_DIR/home"
CODEX_DIR="$WORK_DIR/codex-home"

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

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

script_command() {
  node -e '
    const packageJson = require(process.argv[1]);
    const script = packageJson.scripts[process.argv[2]];
    if (!script) process.exit(1);
    process.stdout.write(script);
  ' "$ROOT_DIR/package.json" "$1"
}

run_package_script() {
  script_name="$1"
  use_codex_home="${2:-false}"
  command="$(script_command "$script_name")"

  mkdir -p "$PROJECT_DIR/node_modules" "$HOME_DIR" "$CODEX_DIR"
  mkdir -p "$PROJECT_DIR/scripts"
  if [ ! -e "$PROJECT_DIR/node_modules/eslint-plugin-legibility" ]; then
    cp -RL "$ROOT_DIR/node_modules/eslint-plugin-legibility" "$PROJECT_DIR/node_modules/eslint-plugin-legibility"
  fi
  cp "$ROOT_DIR/scripts/install-legibility-skill.js" "$PROJECT_DIR/scripts/install-legibility-skill.js"

  (
    cd "$PROJECT_DIR"
    PATH="$ROOT_DIR/node_modules/.bin:$PATH"
    HOME="$HOME_DIR"
    output_file="$WORK_DIR/package-script-output.log"
    export PATH HOME

    if [ "$use_codex_home" = "true" ]; then
      CODEX_HOME="$CODEX_DIR"
      export CODEX_HOME
    else
      unset CODEX_HOME
    fi

    if sh -c "$command" > "$output_file" 2>&1; then
      exit 0
    fi

    cat "$output_file"
    exit 1
  )
}

assert_file_exists() {
  file="$1"
  label="$2"

  if [ -f "$file" ]; then
    pass "$label"
    return
  fi

  echo "Expected file: $file"
  fail "$label"
}

test_global_installs() {
  run_package_script "skills:install"
  assert_file_exists "$HOME_DIR/.agents/skills/eslint-plugin-legibility/SKILL.md" "generic skill installed globally"

  run_package_script "skills:install:codex" "true"
  assert_file_exists "$CODEX_DIR/skills/eslint-plugin-legibility/SKILL.md" "Codex skill installed globally"

  run_package_script "skills:install:claude"
  assert_file_exists "$HOME_DIR/.claude/rules/eslint-plugin-legibility.md" "Claude rule installed globally"
}

test_local_installs() {
  run_package_script "skills:install:local"
  assert_file_exists "$PROJECT_DIR/.agents/skills/eslint-plugin-legibility/SKILL.md" "generic skill installed locally"

  run_package_script "skills:install:codex:local"
  assert_file_exists "$PROJECT_DIR/.codex/skills/eslint-plugin-legibility/SKILL.md" "Codex skill installed locally"

  run_package_script "skills:install:claude:local"
  assert_file_exists "$PROJECT_DIR/.claude/rules/eslint-plugin-legibility.md" "Claude rule installed locally"
}

main() {
  if [ ! -x "$ROOT_DIR/node_modules/.bin/eslint-plugin-legibility-install-skill" ]; then
    fail "eslint-plugin-legibility-install-skill not found - run bun install first"
  fi

  test_global_installs
  test_local_installs
}

main
