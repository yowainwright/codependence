#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$ROOT_DIR"

echo "🌍 Codependence Multi-Language E2E Test Runner"
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

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

case "${1:-all}" in
    "init")
        print_status "Running Node.js init tests..."
        docker build --target test -t codependence-test -f tests/e2e/Dockerfile . && \
        docker run --rm codependence-test:latest
        print_success "Node.js init tests passed!"
        ;;

    "multilang"|"python"|"go")
        print_status "Running multi-language tests (Python + Go)..."
        docker build --target multilang-test -t codependence-multilang-test -f tests/e2e/Dockerfile.multilang . && \
        docker run --rm codependence-multilang-test:latest
        print_success "Multi-language tests passed!"
        ;;

    "all")
        print_status "Running all e2e tests..."

        print_status "1/2: Node.js init tests..."
        docker build --target test -t codependence-test -f tests/e2e/Dockerfile . && \
        docker run --rm codependence-test:latest
        print_success "Node.js tests passed!"

        print_status "2/2: Multi-language tests..."
        docker build --target multilang-test -t codependence-multilang-test -f tests/e2e/Dockerfile.multilang . && \
        docker run --rm codependence-multilang-test:latest
        print_success "Multi-language tests passed!"

        print_success "All e2e tests passed! 🎉"
        ;;

    "clean")
        print_status "Cleaning up Docker resources..."
        docker rmi codependence-test codependence-multilang-test 2>/dev/null || true
        docker system prune -f
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
