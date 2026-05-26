#!/bin/bash

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$ROOT_DIR"

BUN_VERSION="$(node scripts/ci/tool-versions.js bun-version)"
NODE_SLIM_IMAGE="$(node scripts/ci/tool-versions.js node-slim-image)"

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
        --build-arg "BUN_VERSION=$BUN_VERSION" \
        --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" \
        --target test \
        -t codependence-test \
        -f tests/e2e/Dockerfile .
}

run_init_tests() {
    run_step "Node.js init tests passed!" docker run --rm codependence-test:latest
}

build_multilang_image() {
    run_step "Built multi-language test image" docker build \
        --build-arg "BUN_VERSION=$BUN_VERSION" \
        --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" \
        --target multilang-test \
        -t codependence-multilang-test \
        -f tests/e2e/Dockerfile.multilang .
}

run_multilang_tests() {
    run_step "Multi-language tests passed!" docker run --rm codependence-multilang-test:latest
}

run_go_update_tests() {
    run_step "Go update tests passed!" docker run --rm codependence-multilang-test:latest ./test-go-update.sh
}

verify_init_environment() {
    docker run --rm --entrypoint=/bin/sh codependence-test:latest -c '
        set -e
        ls -la dist/
        ls -la node_modules/
        echo "Environment setup verified"
    '
}

verify_multilang_environment() {
    docker run --rm --entrypoint=/bin/sh codependence-multilang-test:latest -c '
        set -e
        echo "Checking Node.js..."
        node --version
        echo "Checking Python..."
        python3 --version
        pip3 --version
        poetry --version
        echo "Checking Go..."
        go version
        echo "All language environments verified"
    '
}

clean_images() {
    docker rmi codependence-test:latest codependence-multilang-test:latest 2>/dev/null || true
    docker system prune -f
}

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

case "${1:-all}" in
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

    "verify-init-env")
        print_status "Verifying Node.js init Docker environment..."
        verify_init_environment
        ;;

    "verify-multilang-env")
        print_status "Verifying multi-language Docker environment..."
        verify_multilang_environment
        ;;

    "all")
        print_status "Running all e2e tests..."

        print_status "1/3: Node.js init tests..."
        build_init_image
        run_init_tests

        print_status "2/3: Multi-language tests..."
        build_multilang_image
        run_multilang_tests

        print_status "3/3: Go update tests..."
        run_go_update_tests

        print_success "All e2e tests passed!"
        ;;

    "clean")
        print_status "Cleaning up Docker resources..."
        clean_images
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
