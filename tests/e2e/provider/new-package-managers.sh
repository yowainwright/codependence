#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

sh "$SCRIPT_DIR/circleci.sh"
sh "$SCRIPT_DIR/helm.sh"
sh "$SCRIPT_DIR/kubernetes.sh"
sh "$SCRIPT_DIR/kustomize.sh"
sh "$SCRIPT_DIR/terraform.sh"
