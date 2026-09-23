#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=helpers.sh
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

write_helm_dependencies_codependencerc() {
  cat >"$WORK_DIR/Chart.yaml" <<'YAML'
apiVersion: v2
name: chart-name
version: 1.0.0
dependencies:
  - name: postgresql
    repository: https://charts.bitnami.com/bitnami
    version: "15.1.0" # chart dependency
YAML
  cat >"$WORK_DIR/values.yaml" <<'YAML'
image:
  registry: docker.io
  repository: bitnami/nginx
  tag: "1.27.0" # deployed image
YAML
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"targets":[{"manager":"helm","mode":"verbose","codependencies":[{"postgresql":"15.2.0"},{"docker.io/bitnami/nginx":"1.27.1"}]}]}
JSON
}

test_helm_dependencies() {
  make_tmp_dir
  write_helm_dependencies_codependencerc

  run_update_from_root "$WORK_DIR"

  assert_file_contains "$WORK_DIR/Chart.yaml" 'version: "15.2.0" # chart dependency' "helm chart dependency updated"
  assert_file_contains "$WORK_DIR/values.yaml" 'tag: "1.27.1" # deployed image' "helm values image tag updated"
  assert_file_unchanged_after_update_from_root "$WORK_DIR" "$WORK_DIR/Chart.yaml" "helm chart update is idempotent"
  assert_file_unchanged_after_update_from_root "$WORK_DIR" "$WORK_DIR/values.yaml" "helm values update is idempotent"
}

main() {
  require_built_cli
  test_helm_dependencies
}

main
