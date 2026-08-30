#!/bin/bash

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$ROOT_DIR"

NODE_SLIM_IMAGE="$(node scripts/ci/tool-versions.js node-slim-image)"
INIT_IMAGE="codependence-test:latest"
MULTILANG_IMAGE="codependence-multilang-test:latest"
COMMAND="${1:-all}"

echo "Codependence Multi-Language E2E Test Runner"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
    local label="$1"
    shift

    if "$@"; then
        print_success "$label"
    else
        print_error "$label"
        exit 1
    fi
}

build_init_image() {
    run_step "Built Node.js init test image" docker build \
        --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" \
        --target test \
        -t "$INIT_IMAGE" \
        -f tests/e2e/Dockerfile .
}

run_init_tests() {
    run_step "Node.js init tests passed!" docker run --rm "$INIT_IMAGE"
}

build_multilang_image() {
    run_step "Built multi-language test image" docker build \
        --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" \
        --target multilang-test \
        -t "$MULTILANG_IMAGE" \
        -f tests/e2e/Dockerfile.multilang .
}

run_multilang_tests() {
    run_step "Multi-language tests passed!" docker run --rm "$MULTILANG_IMAGE"
}

run_go_update_tests() {
    run_step "Go update tests passed!" docker run --rm "$MULTILANG_IMAGE" ./test-go-update.sh
}

run_provider_update_tests() {
    run_step "Provider update tests passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/all.sh
}

run_new_package_manager_tests() {
    run_step "New package manager e2es passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/new-package-managers.sh
}

run_provider_rust_tests() {
    run_step "Rust provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/rust.sh
}

run_provider_docker_tests() {
    run_step "Docker provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/docker.sh
}

run_provider_circleci_tests() {
    run_step "CircleCI provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/circleci.sh
}

run_provider_github_actions_tests() {
    run_step "GitHub Actions provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/github-actions.sh
}

run_provider_helm_tests() {
    run_step "Helm provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/helm.sh
}

run_provider_kubernetes_tests() {
    run_step "Kubernetes provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/kubernetes.sh
}

run_provider_kustomize_tests() {
    run_step "Kustomize provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/kustomize.sh
}

run_provider_terraform_tests() {
    run_step "Terraform provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/terraform.sh
}

run_provider_uv_tests() {
    run_step "uv pyproject provider e2e passed!" docker run --rm "$MULTILANG_IMAGE" ./provider/uv.sh
}

run_agent_skill_tests() {
    run_step "Agent skill install tests passed!" docker run --rm "$MULTILANG_IMAGE" node --test ./tests/e2e/scripts/install/index.test.ts
}

run_packed_install_tests() {
    run_step "Packed install smoke tests passed!" docker run --rm "$MULTILANG_IMAGE" ./test-packed-install.sh
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
    docker image rm --force "$INIT_IMAGE" "$MULTILANG_IMAGE" >/dev/null 2>&1 || true
}

enable_cleanup() {
    trap cleanup_docker_resources EXIT
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
}

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

case "$COMMAND" in
    "init"|"multilang"|"python"|"go"|"go-update"|"provider-updates"|"new-package-managers"|"rust"|"docker"|"circleci"|"github-actions"|"helm"|"kubernetes"|"kustomize"|"terraform"|"uv"|"agent-skills"|"packed-install"|"verify-init-env"|"verify-multilang-env"|"all")
        enable_cleanup
        ;;
esac

case "$COMMAND" in
    "init")
        print_status "Running Node.js init tests..."
        build_init_image
        run_init_tests
        ;;

    "multilang"|"python"|"go")
        print_status "Running multi-language tests (Python + Go)..."
        build_multilang_image
        run_multilang_tests
        ;;

    "go-update")
        print_status "Running Go update tests..."
        build_multilang_image
        run_go_update_tests
        ;;

    "provider-updates")
        print_status "Running provider update tests..."
        build_multilang_image
        run_provider_update_tests
        ;;

    "new-package-managers")
        print_status "Running new package manager e2es..."
        build_multilang_image
        run_new_package_manager_tests
        ;;

    "rust")
        print_status "Running Rust provider e2e..."
        build_multilang_image
        run_provider_rust_tests
        ;;

    "docker")
        print_status "Running Docker provider e2e..."
        build_multilang_image
        run_provider_docker_tests
        ;;

    "circleci")
        print_status "Running CircleCI provider e2e..."
        build_multilang_image
        run_provider_circleci_tests
        ;;

    "github-actions")
        print_status "Running GitHub Actions provider e2e..."
        build_multilang_image
        run_provider_github_actions_tests
        ;;

    "helm")
        print_status "Running Helm provider e2e..."
        build_multilang_image
        run_provider_helm_tests
        ;;

    "kubernetes")
        print_status "Running Kubernetes provider e2e..."
        build_multilang_image
        run_provider_kubernetes_tests
        ;;

    "kustomize")
        print_status "Running Kustomize provider e2e..."
        build_multilang_image
        run_provider_kustomize_tests
        ;;

    "terraform")
        print_status "Running Terraform provider e2e..."
        build_multilang_image
        run_provider_terraform_tests
        ;;

    "uv")
        print_status "Running uv pyproject provider e2e..."
        build_multilang_image
        run_provider_uv_tests
        ;;

    "agent-skills")
        print_status "Running agent skill install tests..."
        build_multilang_image
        run_agent_skill_tests
        ;;

    "packed-install")
        print_status "Running packed install smoke tests..."
        build_multilang_image
        run_packed_install_tests
        ;;

    "verify-init-env")
        print_status "Verifying Node.js init Docker environment..."
        build_init_image
        verify_init_environment
        ;;

    "verify-multilang-env")
        print_status "Verifying multi-language Docker environment..."
        build_multilang_image
        verify_multilang_environment
        ;;

    "all")
        print_status "Running all e2e tests..."

        print_status "1/6: Node.js init tests..."
        build_init_image
        run_init_tests

        print_status "2/6: Multi-language tests..."
        build_multilang_image
        run_multilang_tests

        print_status "3/6: Go update tests..."
        run_go_update_tests

        print_status "4/6: Provider update tests..."
        run_provider_update_tests

        print_status "5/6: Agent skill install tests..."
        run_agent_skill_tests

        print_status "6/6: Packed install smoke tests..."
        run_packed_install_tests

        print_success "All e2e tests passed!"
        ;;

    "clean")
        print_status "Cleaning up Docker resources..."
        cleanup_docker_resources
        print_success "Cleanup complete!"
        ;;

    "help"|"--help"|"-h")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  all         Run all e2e tests (default)"
        echo "  init        Run Node.js init tests only"
        echo "  multilang   Run Python + Go tests only"
        echo "  python      Run Python + Go tests only (alias)"
        echo "  go          Run Python + Go tests only (alias)"
        echo "  go-update   Run Go update/preserve tests only"
        echo "  provider-updates Run provider update tests"
        echo "  new-package-managers Run new package manager e2es"
        echo "  rust             Run Rust provider e2e only"
        echo "  docker           Run Docker provider e2e only"
        echo "  circleci         Run CircleCI provider e2e only"
        echo "  github-actions   Run GitHub Actions provider e2e only"
        echo "  helm             Run Helm provider e2e only"
        echo "  kubernetes       Run Kubernetes provider e2e only"
        echo "  kustomize        Run Kustomize provider e2e only"
        echo "  terraform        Run Terraform provider e2e only"
        echo "  uv               Run uv pyproject provider e2e only"
        echo "  agent-skills     Run packaged agent skill install tests"
        echo "  packed-install   Run packed package install smoke tests"
        echo "  verify-init-env       Verify the Node.js init Docker image"
        echo "  verify-multilang-env  Verify the Python + Go Docker image"
        echo "  clean       Clean up Docker resources"
        echo "  help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                 # Run all tests"
        echo "  $0 init           # Run Node.js tests"
        echo "  $0 multilang      # Run Python/Go tests"
        echo "  $0 clean          # Clean up"
        ;;

    *)
        print_error "Unknown command: $1"
        print_status "Run '$0 help' for usage information"
        exit 1
        ;;
esac
