#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH='' cd -- "$SCRIPT_DIR/../.." && pwd)"
BIN="$ROOT_DIR/artifacts/codependence"

fail() {
  printf '[FAIL] %s\n' "$1"
  exit 1
}

main() {
  nub run build:bin

  help_output=$("$BIN" --help)
  printf '%s\n' "$help_output" | grep -Fq "Codependence" || fail "binary help"
  printf '[PASS] binary help\n'

  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-binary-runtime.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-docker.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-circleci.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-github-actions.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-helm.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-kubernetes.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-kustomize.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-rust.sh"
  CODEPENDENCE_E2E_BINARY="$BIN" "$SCRIPT_DIR/test-provider-terraform.sh"
}

main "$@"
