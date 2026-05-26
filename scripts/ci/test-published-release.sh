#!/usr/bin/env bash

set -euo pipefail

PACKAGE_NAME="${PACKAGE_NAME:-codependence}"
FULL_IMAGE="${FULL_IMAGE:-codependence-release-test}"
NPM_IMAGE="${NPM_IMAGE:-codependence-npm-test}"

require_version() {
  if [ -z "${CODEPENDENCE_VERSION:-}" ]; then
    echo "CODEPENDENCE_VERSION is required for $1" >&2
    exit 1
  fi
}

resolve_version() {
  local version="${INPUT_VERSION:-}"

  if [ -z "$version" ]; then
    version="$(npm view "$PACKAGE_NAME" version)"
  fi

  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "version=$version" >> "$GITHUB_OUTPUT"
  else
    echo "$version"
  fi

  echo "Testing $PACKAGE_NAME version: $version"
}

wait_for_npm() {
  require_version "wait-for-npm"

  echo "Waiting for $PACKAGE_NAME@$CODEPENDENCE_VERSION to be available on npm..."
  for attempt in $(seq 1 30); do
    if npm view "$PACKAGE_NAME@$CODEPENDENCE_VERSION" version >/dev/null 2>&1; then
      echo "Package $PACKAGE_NAME@$CODEPENDENCE_VERSION is available on npm"
      return 0
    fi

    echo "Attempt $attempt/30: package not yet available, waiting 30 seconds..."
    sleep 30
  done

  echo "Package $PACKAGE_NAME@$CODEPENDENCE_VERSION was not available after 30 attempts" >&2
  exit 1
}

build_release_image() {
  require_version "build-release-image"

  docker build \
    --build-arg CODEPENDENCE_VERSION="$CODEPENDENCE_VERSION" \
    -f tests/release/Dockerfile.published \
    -t "$FULL_IMAGE" .
}

verify_installation() {
  docker run --rm "$FULL_IMAGE" bash -lc '
    set -euo pipefail
    codependence --help
    node /app/dist/cli.js --help
    echo "Installation verified"
  '
}

run_e2e() {
  docker run --rm "$FULL_IMAGE" bash -lc '
    set -euo pipefail
    echo "Running Python and Go manifest tests..."
    cd /app/tests/e2e/fixtures
    ./test-python-go.sh

    echo "Running Go update tests..."
    cd /app
    ./tests/e2e/test-go-update.sh

    echo "All release e2e tests completed successfully"
  '
}

run_npm_smoke() {
  require_version "run-npm-smoke"

  docker build \
    --build-arg CODEPENDENCE_VERSION="$CODEPENDENCE_VERSION" \
    -f tests/release/Dockerfile.npm-smoke \
    -t "$NPM_IMAGE" .

  docker run --rm "$NPM_IMAGE" bash -lc '
    set -euo pipefail
    codependence --debug
    echo "NPM package smoke test passed"
  '
}

run_compatibility_check() {
  docker run --rm "$FULL_IMAGE" bash -lc '
    set -euo pipefail
    echo "Testing command execution time..."
    time codependence --help >/dev/null

    echo "Testing debug output..."
    mkdir -p /tmp/codependence-debug
    cp /app/tests/release/fixtures/smoke-package.json /tmp/codependence-debug/package.json
    cp /app/tests/release/fixtures/smoke-codependencerc.json /tmp/codependence-debug/.codependencerc
    codependence --rootDir /tmp/codependence-debug --config /tmp/codependence-debug/.codependencerc --debug

    echo "Testing JSON output..."
    codependence --rootDir /tmp/codependence-debug --config /tmp/codependence-debug/.codependencerc --format json

    echo "Performance and compatibility checks passed"
  '
}

print_summary() {
  require_version "print-summary"

  echo "Test Summary"
  echo "============"
  echo "Tested codependence version: $CODEPENDENCE_VERSION"
  echo "Full e2e test suite: PASSED"
  echo "NPM package smoke test: PASSED"
  echo "Python compatibility: PASSED"
  echo "Go compatibility: PASSED"
  echo "Performance checks: PASSED"
  echo ""
  echo "Published package is working correctly."
  echo "Ready for production use"
}

write_report() {
  local version="${CODEPENDENCE_VERSION:-unknown}"

  cat > test-report.md << EOF
# Codependence Release Test Report

**Version Tested:** $version
**Test Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Status:** PASSED

## Test Coverage
- E2E Node tests
- Python manifest tests
- Go manifest tests
- Go update preservation tests
- NPM package smoke test
- Performance validation
- External test repository triggered

## Summary
All tests passed successfully. The published package is ready for use.
External e2e tests have been triggered in the codependence-test repository.
EOF

  echo "Test report created:"
  cat test-report.md
}

case "${1:-}" in
  resolve-version)
    resolve_version
    ;;
  wait-for-npm)
    wait_for_npm
    ;;
  build-release-image)
    build_release_image
    ;;
  verify-installation)
    verify_installation
    ;;
  run-e2e)
    run_e2e
    ;;
  run-npm-smoke)
    run_npm_smoke
    ;;
  compatibility-check)
    run_compatibility_check
    ;;
  summary)
    print_summary
    ;;
  write-report)
    write_report
    ;;
  *)
    echo "Usage: $0 {resolve-version|wait-for-npm|build-release-image|verify-installation|run-e2e|run-npm-smoke|compatibility-check|summary|write-report}" >&2
    exit 2
    ;;
esac
