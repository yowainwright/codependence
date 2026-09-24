#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"

main() {
  sh "$SCRIPT_DIR/test-provider-rust.sh"
  sh "$SCRIPT_DIR/test-provider-circleci.sh"
  sh "$SCRIPT_DIR/test-provider-helm.sh"
  sh "$SCRIPT_DIR/test-provider-kubernetes.sh"
  sh "$SCRIPT_DIR/test-provider-kustomize.sh"
  sh "$SCRIPT_DIR/test-provider-terraform.sh"
  sh "$SCRIPT_DIR/test-provider-docker.sh"
  sh "$SCRIPT_DIR/test-provider-github-actions.sh"
  sh "$SCRIPT_DIR/test-provider-mixed.sh"
  sh "$SCRIPT_DIR/test-provider-uv.sh"
}

main
