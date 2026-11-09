#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Change to root directory for Docker builds

TEST_IMAGE="codependence-test:latest"
BUILDER_IMAGE="codependence-builder:latest"
LEVEL_MODE_IMAGE="codependence-level-mode-test:latest"
COMMAND="${1:-test}"
SCENARIO="${2:-}"

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

cleanup_docker_resources() {
  docker image rm --force "$TEST_IMAGE" "$BUILDER_IMAGE" "$LEVEL_MODE_IMAGE" >/dev/null 2>&1 || :
}

enable_cleanup() {
  trap cleanup_docker_resources EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

command_test() {
  enable_cleanup
  print_status "Running automated tests..."
  docker build --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" --target test -t "$TEST_IMAGE" -f tests/e2e/Dockerfile .
  docker run --rm "$TEST_IMAGE"
  print_success "Automated tests completed!"
}

command_dev() {
  print_status "Starting interactive development environment..."
  "${COMPOSE_CMD[@]}" run --build --rm dev "${SCENARIO:-init}"
}

command_scenarios() {
  enable_cleanup
  docker build --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" --target test -t "$TEST_IMAGE" -f tests/e2e/Dockerfile .
  docker run --rm "$TEST_IMAGE" bash ./test-scenarios.sh "${SCENARIO:-all}"
}

command_build() {
  print_status "Building project in Docker..."
  docker build --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" --target builder -t "$BUILDER_IMAGE" -f tests/e2e/Dockerfile .
  print_success "Build completed!"
}

command_level_mode() {
  enable_cleanup
  print_status "Running level and mode feature tests..."
  docker build --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" --target test -t "$LEVEL_MODE_IMAGE" -f tests/e2e/Dockerfile.level-mode .
  docker run --rm "$LEVEL_MODE_IMAGE"
  print_success "Level and mode tests completed!"
}

command_all() {
  enable_cleanup
  print_status "Running all e2e test suites..."
  docker build --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" --target test -t "$TEST_IMAGE" -f tests/e2e/Dockerfile .
  docker run --rm "$TEST_IMAGE"
  print_success "Init tests completed!"
  docker build --build-arg "NODE_SLIM_IMAGE=$NODE_SLIM_IMAGE" --target test -t "$LEVEL_MODE_IMAGE" -f tests/e2e/Dockerfile.level-mode .
  docker run --rm "$LEVEL_MODE_IMAGE"
  print_success "Level and mode tests completed!"
  docker run --rm "$TEST_IMAGE" bash ./test-scenarios.sh all
  print_success "All e2e test suites completed!"
}

command_clean() {
  print_status "Cleaning up Docker resources..."
  cleanup_docker_resources
  print_success "Cleanup completed!"
}

command_help() {
  printf 'Usage: %s [command] [scenario]\n\n' "$0"
  cat "$SCRIPT_DIR/fixtures/test-help.txt"
  printf '\nExamples:\n'
  printf '  %s                    # Run init tests\n' "$0"
  printf '  %s level-mode        # Run level/mode tests\n' "$0"
  printf '  %s all               # Run all tests\n' "$0"
  printf '  %s dev major-updates # Interactive major-update sandbox\n' "$0"
  printf '  %s scenarios         # Run all CLI scenarios\n' "$0"
  printf '  %s build             # Build project\n' "$0"
  printf '  %s clean             # Clean up\n' "$0"
}

command_unknown() {
  print_error "Unknown command: $COMMAND"
  print_status "Run '$0 help' for usage information"
  exit 1
}

docker_missing() {
  print_error "Docker is not installed or not in PATH"
  exit 1
}

choose_compose_command() {
  COMPOSE_CMD=(docker compose -f tests/e2e/docker-compose.yml)
  docker compose version >/dev/null 2>&1 && return 0
  command -v docker-compose >/dev/null 2>&1 || compose_missing
  COMPOSE_CMD=(docker-compose -f tests/e2e/docker-compose.yml)
}

compose_missing() {
  print_error "Docker Compose is not installed or not in PATH"
  exit 1
}

dispatch_command() {
  case "$COMMAND" in
  "test") command_test ;;
  "dev") command_dev ;;
  "scenarios") command_scenarios ;;
  "build") command_build ;;
  "level-mode") command_level_mode ;;
  "all") command_all ;;
  "clean") command_clean ;;
  "help" | "--help" | "-h") command_help ;;
  *) command_unknown ;;
  esac
}

main() {
  cd "$ROOT_DIR"
  case "$COMMAND" in
  "help" | "--help" | "-h")
    command_help
    return
    ;;
  esac
  NODE_SLIM_IMAGE="$(node scripts/ci/tool-versions.js node-slim-image)"
  export NODE_SLIM_IMAGE
  echo "Codependence Docker Test Runner"
  echo "==================================="
  command -v docker >/dev/null 2>&1 || docker_missing
  choose_compose_command
  dispatch_command
}

main "$@"
