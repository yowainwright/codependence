#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to root directory for Docker builds
cd "$ROOT_DIR"

echo "🤼‍♀️ Codependence Docker Test Runner"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed or not in PATH"
    exit 1
fi

# Use docker compose or docker-compose based on availability
COMPOSE_CMD="docker compose -f e2e/docker-compose.yml"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose -f e2e/docker-compose.yml"
fi

case "${1:-test}" in
    "test")
        print_status "Running automated tests..."
        docker build --target test -t codependence-test -f e2e/Dockerfile . && docker run --rm codependence-test:latest
        print_success "Automated tests completed!"
        ;;
    
    "dev")
        print_status "Starting interactive development environment..."
        print_warning "You'll be dropped into a shell where you can test commands manually"
        $COMPOSE_CMD run --rm dev
        ;;
    
    "build")
        print_status "Building project in Docker..."
        docker build --target builder -t codependence-builder -f e2e/Dockerfile .
        print_success "Build completed!"
        ;;
    
    "clean")
        print_status "Cleaning up Docker resources..."
        docker rmi codependence-test codependence-builder 2>/dev/null || true
        docker system prune -f
        print_success "Cleanup completed!"
        ;;
    
    "help"|"--help"|"-h")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  test    Run automated tests (default)"
        echo "  dev     Start interactive development environment"
        echo "  build   Build the project in Docker"
        echo "  clean   Clean up Docker resources"
        echo "  help    Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                    # Run tests"
        echo "  $0 test              # Run tests"
        echo "  $0 dev               # Interactive testing"
        echo "  $0 build             # Build project"
        echo "  $0 clean             # Clean up"
        ;;
    
    *)
        print_error "Unknown command: $1"
        print_status "Run '$0 help' for usage information"
        exit 1
        ;;
esac
