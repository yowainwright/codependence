#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
cat > "$WORK_DIR/kustomization.yaml" <<'YAML'
resources:
  - deployment.yaml
images:
  - name: busybox
    newName: alpine
    newTag: "3.19" # image tag
YAML
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"targets":[{"manager":"kustomize","mode":"verbose","codependencies":[{"alpine":"3.20"}]}]}
JSON

run_update_from_root "$WORK_DIR"

assert_file_contains "$WORK_DIR/kustomization.yaml" 'newTag: "3.20" # image tag' "kustomize image tag updated"
assert_file_contains "$WORK_DIR/kustomization.yaml" "newName: alpine" "kustomize image name preserved"
assert_file_unchanged_after_update_from_root "$WORK_DIR" "$WORK_DIR/kustomization.yaml" "kustomize update is idempotent"
