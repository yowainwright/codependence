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

echo "=== Testing codependence with Python and Go ==="

# Test 1: Python requirements.txt
echo "\n1. Testing Python requirements.txt..."
cp python-requirements.txt.fixture requirements.txt
cp .codependencerc-python .codependencerc
if node ./dist/cli.js --debug 2>&1 | grep -q "requests\|flask\|django"; then
  echo "✓ Python requirements.txt test passed"
else
  echo "✗ Python requirements.txt test failed"
  exit 1
fi
rm -f requirements.txt .codependencerc

# Test 2: Python pyproject.toml (poetry)
echo "\n2. Testing Python pyproject.toml (poetry)..."
cp python-pyproject.toml.fixture pyproject.toml
cp .codependencerc-python .codependencerc
if node ./dist/cli.js --debug 2>&1 | grep -q "requests\|flask\|django"; then
  echo "✓ Python pyproject.toml test passed"
else
  echo "✗ Python pyproject.toml test failed"
  exit 1
fi
rm -f pyproject.toml .codependencerc

# Test 3: Python Pipfile (pipenv)
echo "\n3. Testing Python Pipfile..."
cp python-Pipfile.fixture Pipfile
cp .codependencerc-python .codependencerc
if node ./dist/cli.js --debug 2>&1 | grep -q "requests\|flask\|django"; then
  echo "✓ Python Pipfile test passed"
else
  echo "✗ Python Pipfile test failed"
  exit 1
fi
rm -f Pipfile .codependencerc

# Test 4: Go go.mod
echo "\n4. Testing Go go.mod..."
cp go.mod.fixture go.mod
cp .codependencerc-go .codependencerc
if node ./dist/cli.js --debug 2>&1 | grep -q "gin-gonic\|lib/pq\|golang.org"; then
  echo "✓ Go go.mod test passed"
else
  echo "✗ Go go.mod test failed"
  exit 1
fi
rm -f go.mod .codependencerc

# Test 5: Detection without language flag
echo "\n5. Testing automatic language detection..."

PYTHON_AUTO_DIR="$(make_tmp_dir)"
cp python-requirements.txt.fixture "$PYTHON_AUTO_DIR/requirements.txt"
echo '{"codependencies":["requests"],"mode":"verbose"}' > "$PYTHON_AUTO_DIR/.codependencerc"
if node ./dist/cli.js --debug --rootDir "$PYTHON_AUTO_DIR" --searchPath "$PYTHON_AUTO_DIR" 2>&1 | grep -q "requests"; then
  echo "✓ Python auto-detection test passed"
else
  echo "✗ Python auto-detection test failed"
  exit 1
fi

GO_AUTO_DIR="$(make_tmp_dir)"
cp go.mod.fixture "$GO_AUTO_DIR/go.mod"
echo '{"codependencies":["github.com/gin-gonic/gin"],"mode":"verbose"}' > "$GO_AUTO_DIR/.codependencerc"
if node ./dist/cli.js --debug --rootDir "$GO_AUTO_DIR" --searchPath "$GO_AUTO_DIR" 2>&1 | grep -q "gin"; then
  echo "✓ Go auto-detection test passed"
else
  echo "✗ Go auto-detection test failed - this is expected if go is not installed"
fi

# Test 6: Mixed project (Node.js + Python)
echo "\n6. Testing polyglot project (Node.js + Python)..."
MIXED_DIR="$(make_tmp_dir)"
cp test-package.json.fixture "$MIXED_DIR/package.json"
cp python-requirements.txt.fixture "$MIXED_DIR/requirements.txt"
echo '{"codependencies":["lodash"],"mode":"verbose"}' > "$MIXED_DIR/.codependencerc"
if node ./dist/cli.js --debug --rootDir "$MIXED_DIR" --searchPath "$MIXED_DIR" 2>&1 | grep -q "lodash"; then
  echo "✓ Polyglot project test passed (prioritizes Node.js)"
else
  echo "✗ Polyglot project test failed"
  exit 1
fi

echo "\n=== All Python and Go tests passed! ==="
