#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=helpers.sh
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

write_terraform_dependencies_codependencerc() {
  cat >"$WORK_DIR/main.tf" <<'HCL'
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.30" # provider
    }
  }
}

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.8.1" # module
}

module "app" {
  source = "git::https://github.com/acme/app.git?ref=v1.2.3" # git module
}
HCL
  cat >"$WORK_DIR/.codependencerc" <<'JSON'
{"targets":[{"manager":"terraform","mode":"verbose","codependencies":[{"hashicorp/aws":"~> 5.31"},{"terraform-aws-modules/vpc/aws":"5.9.0"},{"github.com/acme/app":"v1.2.4"}]}]}
JSON
} # noqa: LEG038 -- This function only writes literal fixture data.

test_terraform_dependencies() {
  make_tmp_dir
  write_terraform_dependencies_codependencerc

  run_update_from_root "$WORK_DIR"

  assert_file_contains "$WORK_DIR/main.tf" 'version = "~> 5.31" # provider' "terraform provider constraint updated"
  assert_file_contains "$WORK_DIR/main.tf" 'version = "5.9.0" # module' "terraform registry module updated"
  assert_file_contains "$WORK_DIR/main.tf" 'source = "git::https://github.com/acme/app.git?ref=v1.2.4" # git module' "terraform git module ref updated"
  assert_file_unchanged_after_update_from_root "$WORK_DIR" "$WORK_DIR/main.tf" "terraform update is idempotent"
}

main() {
  require_built_cli
  test_terraform_dependencies
}

main
