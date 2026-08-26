#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
mkdir -p "$WORK_DIR/k8s"
cat > "$WORK_DIR/k8s/deployment.yaml" <<'YAML'
containers:
  - name: app
    image: "ghcr.io/acme/web:2.4.0" # app image
initContainers:
  - name: init
    image: busybox:1.36.1
YAML
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"targets":[{"manager":"kubernetes","mode":"verbose","codependencies":[{"ghcr.io/acme/web":"2.5.0"},{"busybox":"1.36.2"}]}]}
JSON

run_update_from_root "$WORK_DIR"

assert_file_contains "$WORK_DIR/k8s/deployment.yaml" 'image: "ghcr.io/acme/web:2.5.0" # app image' "kubernetes container image updated"
assert_file_contains "$WORK_DIR/k8s/deployment.yaml" "image: busybox:1.36.2" "kubernetes init container image updated"
assert_file_unchanged_after_update_from_root "$WORK_DIR" "$WORK_DIR/k8s/deployment.yaml" "kubernetes update is idempotent"
