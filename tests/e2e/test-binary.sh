#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
BIN="$ROOT_DIR/dist/bin/codependence"

fail() {
  printf '[FAIL] %s\n' "$1"
  exit 1
}

bun run build:bin

help_output=$("$BIN" --help)
printf '%s\n' "$help_output" | grep -Fq "Codependence" || fail "binary help"
printf '[PASS] binary help\n'

CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/provider/docker.sh"
CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/provider/github-actions.sh"
CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/provider/rust.sh"
