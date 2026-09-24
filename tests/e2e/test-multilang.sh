#!/bin/bash

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

INIT_IMAGE="codependence-test:latest"
MULTILANG_IMAGE="codependence-multilang-test:latest"
COMMAND="${1:-all}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

run_step() {
  local label="${1:?label is required}"
  shift

  "$@" || step_failed "$label"
  print_success "$label succeeded"
}

build_init_image() {
  run_step "Node.js init image build" docker build \
    --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" \
    --target test \
    -t "$INIT_IMAGE" \
    -f tests/e2e/Dockerfile .
}

run_init_tests() {
  run_step "Node.js init tests" docker run --rm "$INIT_IMAGE"
}

build_multilang_image() {
  run_step "Multi-language image build" docker build \
    --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" \
    --target multilang-test \
    -t "$MULTILANG_IMAGE" \
    -f tests/e2e/Dockerfile.multilang .
}

run_multilang_tests() {
  run_step "Multi-language tests" docker run --rm "$MULTILANG_IMAGE"
}

run_go_update_tests() {
  run_step "Go update tests" docker run --rm "$MULTILANG_IMAGE" ./test-go-update.sh
}

run_provider_update_tests() {
  run_step "Provider update tests" docker run --rm "$MULTILANG_IMAGE" ./test-provider-all.sh
}

run_new_package_manager_tests() {
  run_step "New package manager e2es" docker run --rm "$MULTILANG_IMAGE" ./test-provider-new-package-managers.sh
}

run_provider_rust_tests() {
  run_step "Rust provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-rust.sh
}

run_provider_docker_tests() {
  run_step "Docker provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-docker.sh
}

run_provider_circleci_tests() {
  run_step "CircleCI provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-circleci.sh
}

run_provider_github_actions_tests() {
  run_step "GitHub Actions provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-github-actions.sh
}

run_provider_helm_tests() {
  run_step "Helm provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-helm.sh
}

run_provider_kubernetes_tests() {
  run_step "Kubernetes provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-kubernetes.sh
}

run_provider_kustomize_tests() {
  run_step "Kustomize provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-kustomize.sh
}

run_provider_terraform_tests() {
  run_step "Terraform provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-terraform.sh
}

run_provider_uv_tests() {
  run_step "uv pyproject provider e2e" docker run --rm "$MULTILANG_IMAGE" ./test-provider-uv.sh
}

run_agent_skill_tests() {
  run_step "Agent skill install tests" docker run --rm "$MULTILANG_IMAGE" node --test ./tests/e2e/scripts/install/index.test.ts
}

run_packed_install_tests() {
  run_step "Packed install smoke tests" docker run --rm "$MULTILANG_IMAGE" ./test-packed-install.sh
}

verify_init_environment() {
  docker run --rm --entrypoint=/bin/sh "$INIT_IMAGE" -c '
        set -e
        test -x dist/cli.js
        test -f package.json
    '
}

verify_multilang_environment() {
  docker run --rm --entrypoint=/bin/sh "$MULTILANG_IMAGE" -c '
        set -e
        echo "Checking Node.js..."
        node --version
        echo "Checking Python..."
        python3 --version
        echo "Checking Go..."
        go version
        echo "All language environments verified"
    '
}

cleanup_docker_resources() {
  docker image rm --force "$INIT_IMAGE" "$MULTILANG_IMAGE" >/dev/null 2>&1 || :
}

enable_cleanup() {
  trap cleanup_docker_resources EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

command_init() {
  enable_cleanup
  print_status "Running Node.js init tests..."
  build_init_image
  run_init_tests
}

command_multilang() {
  enable_cleanup
  print_status "Running multi-language tests (Python + Go)..."
  build_multilang_image
  run_multilang_tests
}

command_go_update() {
  enable_cleanup
  print_status "Running Go update tests..."
  build_multilang_image
  run_go_update_tests
}

command_provider_updates() {
  enable_cleanup
  print_status "Running provider update tests..."
  build_multilang_image
  run_provider_update_tests
}

command_new_package_managers() {
  enable_cleanup
  print_status "Running new package manager e2es..."
  build_multilang_image
  run_new_package_manager_tests
}

command_rust() {
  enable_cleanup
  print_status "Running Rust provider e2e..."
  build_multilang_image
  run_provider_rust_tests
}

command_docker() {
  enable_cleanup
  print_status "Running Docker provider e2e..."
  build_multilang_image
  run_provider_docker_tests
}

command_circleci() {
  enable_cleanup
  print_status "Running CircleCI provider e2e..."
  build_multilang_image
  run_provider_circleci_tests
}

command_github_actions() {
  enable_cleanup
  print_status "Running GitHub Actions provider e2e..."
  build_multilang_image
  run_provider_github_actions_tests
}

command_helm() {
  enable_cleanup
  print_status "Running Helm provider e2e..."
  build_multilang_image
  run_provider_helm_tests
}

command_kubernetes() {
  enable_cleanup
  print_status "Running Kubernetes provider e2e..."
  build_multilang_image
  run_provider_kubernetes_tests
}

command_kustomize() {
  enable_cleanup
  print_status "Running Kustomize provider e2e..."
  build_multilang_image
  run_provider_kustomize_tests
}

command_terraform() {
  enable_cleanup
  print_status "Running Terraform provider e2e..."
  build_multilang_image
  run_provider_terraform_tests
}

command_uv() {
  enable_cleanup
  print_status "Running uv pyproject provider e2e..."
  build_multilang_image
  run_provider_uv_tests
}

command_agent_skills() {
  enable_cleanup
  print_status "Running agent skill install tests..."
  build_multilang_image
  run_agent_skill_tests
}

command_packed_install() {
  enable_cleanup
  print_status "Running packed install smoke tests..."
  build_multilang_image
  run_packed_install_tests
}

command_verify_init_env() {
  enable_cleanup
  print_status "Verifying Node.js init Docker environment..."
  build_init_image
  verify_init_environment
}

command_verify_multilang_env() {
  enable_cleanup
  print_status "Verifying multi-language Docker environment..."
  build_multilang_image
  verify_multilang_environment
}

run_remaining_suites() {
  print_status "3/6: Go update tests..."
  run_go_update_tests

  print_status "4/6: Provider update tests..."
  run_provider_update_tests

  print_status "5/6: Agent skill install tests..."
  run_agent_skill_tests

  print_status "6/6: Packed install smoke tests..."
  run_packed_install_tests

  print_success "All e2e tests passed!"
}

command_all() {
  enable_cleanup
  print_status "Running all e2e tests..."

  print_status "1/6: Node.js init tests..."
  build_init_image
  run_init_tests

  print_status "2/6: Multi-language tests..."
  build_multilang_image
  run_multilang_tests

  run_remaining_suites
}

command_clean() {
  print_status "Cleaning up Docker resources..."
  cleanup_docker_resources
  print_success "Cleanup complete!"
}

command_help() {
  printf 'Usage: %s [command]\n\n' "$0"
  cat "$SCRIPT_DIR/fixtures/test-multilang-help.txt"
  printf '\nExamples:\n'
  printf '  %s                 # Run all tests\n' "$0"
  printf '  %s init           # Run Node.js tests\n' "$0"
  printf '  %s multilang      # Run Python/Go tests\n' "$0"
  printf '  %s clean          # Clean up\n' "$0"
}

command_unknown() {
  print_error "Unknown command: $COMMAND"
  print_status "Run '$0 help' for usage information"
  exit 1
}

require_docker_error() {
  print_error "Docker is not installed"
  exit 1
}

step_failed() {
  print_error "${1:?label is required} failed"
  exit 1
}

dispatch_provider() {
  case "$COMMAND" in
  "rust") command_rust ;;
  "docker") command_docker ;;
  "circleci") command_circleci ;;
  "github-actions") command_github_actions ;;
  "helm") command_helm ;;
  "kubernetes") command_kubernetes ;;
  "kustomize") command_kustomize ;;
  "terraform") command_terraform ;;
  "uv") command_uv ;;
  esac
}

dispatch_command() {
  case "$COMMAND" in
  "init") command_init ;;
  "multilang" | "python" | "go") command_multilang ;;
  "go-update") command_go_update ;;
  "provider-updates") command_provider_updates ;;
  "new-package-managers") command_new_package_managers ;;
  "agent-skills") command_agent_skills ;;
  "packed-install") command_packed_install ;;
  "verify-init-env") command_verify_init_env ;;
  "verify-multilang-env") command_verify_multilang_env ;;
  "all") command_all ;;
  "clean") command_clean ;;
  "help" | "--help" | "-h") command_help ;;
  "rust" | "docker" | "circleci" | "github-actions") dispatch_provider ;;
  "helm" | "kubernetes" | "kustomize" | "terraform" | "uv") dispatch_provider ;;
  *) command_unknown ;;
  esac
}

main() {
  cd "$ROOT_DIR"
  NODE_SLIM_IMAGE="$(node scripts/ci/tool-versions.js node-slim-image)"
  export NODE_SLIM_IMAGE
  echo "Codependence Multi-Language E2E Test Runner"
  echo "=============================================="
  command -v docker >/dev/null 2>&1 || require_docker_error
  dispatch_command
}

main "$@"
