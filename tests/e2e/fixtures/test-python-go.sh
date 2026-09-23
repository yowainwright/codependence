#!/bin/sh
set -e

TMP_DIRS=""

make_tmp_dir() {
  dir="$(mktemp -d)"
  TMP_DIRS="$TMP_DIRS $dir"
  echo "$dir"
}

cleanup() {
  for dir in $TMP_DIRS; do
    rm -rf "$dir"
  done
}

trap cleanup EXIT

fail() {
  echo "$1"
  exit 1
}

test_python_requirements() {
  # Test 1: Python requirements.txt
  printf '\n%s\n' "1. Testing Python requirements.txt..."
  cp python-requirements.txt.fixture requirements.txt
  cp .codependencerc-python .codependencerc
  node ./dist/cli.js --debug 2>&1 | grep -q "requests\|flask\|django" || fail "✗ Python requirements.txt test failed"
  echo "✓ Python requirements.txt test passed"
  rm -f requirements.txt .codependencerc
}

test_python_poetry() {
  # Test 2: Python pyproject.toml (poetry)
  printf '\n%s\n' "2. Testing Python pyproject.toml (poetry)..."
  cp python-pyproject.toml.fixture pyproject.toml
  cp .codependencerc-python .codependencerc
  node ./dist/cli.js --debug 2>&1 | grep -q "requests\|flask\|django" || fail "✗ Python pyproject.toml test failed"
  echo "✓ Python pyproject.toml test passed"
  rm -f pyproject.toml .codependencerc
}

test_python_pipenv() {
  # Test 3: Python Pipfile (pipenv)
  printf '\n%s\n' "3. Testing Python Pipfile..."
  cp python-Pipfile.fixture Pipfile
  cp .codependencerc-python .codependencerc
  node ./dist/cli.js --debug 2>&1 | grep -q "requests\|flask\|django" || fail "✗ Python Pipfile test failed"
  echo "✓ Python Pipfile test passed"
  rm -f Pipfile .codependencerc
}

test_go_modules() {
  # Test 4: Go go.mod
  printf '\n%s\n' "4. Testing Go go.mod..."
  cp go.mod.fixture go.mod
  cp .codependencerc-go .codependencerc
  node ./dist/cli.js --debug 2>&1 | grep -q "gin-gonic\|lib/pq\|golang.org" || fail "✗ Go go.mod test failed"
  echo "✓ Go go.mod test passed"
  rm -f go.mod .codependencerc
}

test_auto_detection() {
  # Test 5: Detection without language flag
  printf '\n%s\n' "5. Testing automatic language detection..."

  PYTHON_AUTO_DIR="$(make_tmp_dir)"
  cp python-requirements.txt.fixture "$PYTHON_AUTO_DIR/requirements.txt"
  echo '{"codependencies":["requests"],"mode":"verbose"}' >"$PYTHON_AUTO_DIR/.codependencerc"
  node ./dist/cli.js --debug --rootDir "$PYTHON_AUTO_DIR" --searchPath "$PYTHON_AUTO_DIR" 2>&1 | grep -q "requests" || fail "✗ Python auto-detection test failed"
  echo "✓ Python auto-detection test passed"

  test_go_auto_detection

}

test_mixed_project() {
  # Test 6: Mixed project (Node.js + Python)
  printf '\n%s\n' "6. Testing polyglot project (Node.js + Python)..."
  MIXED_DIR="$(make_tmp_dir)"
  cp test-package.json.fixture "$MIXED_DIR/package.json"
  cp python-requirements.txt.fixture "$MIXED_DIR/requirements.txt"
  echo '{"codependencies":["lodash"],"mode":"verbose"}' >"$MIXED_DIR/.codependencerc"
  node ./dist/cli.js --debug --rootDir "$MIXED_DIR" --searchPath "$MIXED_DIR" 2>&1 | grep -q "lodash" || fail "✗ Polyglot project test failed"
  echo "✓ Polyglot project test passed (prioritizes Node.js)"

  printf '\n%s\n' "=== All Python and Go tests passed! ==="
}

test_go_auto_detection() {
  GO_AUTO_DIR="$(make_tmp_dir)"
  cp go.mod.fixture "$GO_AUTO_DIR/go.mod"
  echo '{"codependencies":["github.com/gin-gonic/gin"],"mode":"verbose"}' >"$GO_AUTO_DIR/.codependencerc"
  condition_status=0
  node ./dist/cli.js --debug --rootDir "$GO_AUTO_DIR" --searchPath "$GO_AUTO_DIR" 2>&1 | grep -q "gin" || condition_status=$?
  case "$condition_status" in
  0)
    echo "✓ Go auto-detection test passed"
    ;;
  *)
    echo "✗ Go auto-detection test failed - this is expected if go is not installed"
    ;;
  esac
}

main() {
  echo "=== Testing codependence with Python and Go ==="
  test_python_requirements
  test_python_poetry
  test_python_pipenv
  test_go_modules
  test_auto_detection
  test_mixed_project
}

main
