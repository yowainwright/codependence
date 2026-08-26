#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/helpers.sh"

trap cleanup_provider_e2e EXIT

require_built_cli
make_tmp_dir
cat > "$WORK_DIR/main.tf" <<'HCL'
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
cat > "$WORK_DIR/.codependencerc" <<'JSON'
{"targets":[{"manager":"terraform","mode":"verbose","codependencies":[{"hashicorp/aws":"~> 5.31"},{"terraform-aws-modules/vpc/aws":"5.9.0"},{"github.com/acme/app":"v1.2.4"}]}]}
JSON

run_update_from_root "$WORK_DIR"

assert_file_contains "$WORK_DIR/main.tf" 'version = "~> 5.31" # provider' "terraform provider constraint updated"
assert_file_contains "$WORK_DIR/main.tf" 'version = "5.9.0" # module' "terraform registry module updated"
assert_file_contains "$WORK_DIR/main.tf" 'source = "git::https://github.com/acme/app.git?ref=v1.2.4" # git module' "terraform git module ref updated"
assert_file_unchanged_after_update_from_root "$WORK_DIR" "$WORK_DIR/main.tf" "terraform update is idempotent"
