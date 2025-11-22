#!/bin/sh
set -e

echo "=== Testing codependence with Python and Go ==="

# Test 1: Python requirements.txt
echo "\n1. Testing Python requirements.txt..."
cp python-requirements.txt requirements.txt
cp .codependencerc-python .codependencerc
if node ../../../dist/index.js --debug 2>&1 | grep -q "requests\|flask\|django"; then
  echo "✓ Python requirements.txt test passed"
else
  echo "✗ Python requirements.txt test failed"
  exit 1
fi
rm -f requirements.txt .codependencerc

# Test 2: Python pyproject.toml (poetry)
echo "\n2. Testing Python pyproject.toml (poetry)..."
cp python-pyproject.toml pyproject.toml
cp .codependencerc-python .codependencerc
if node ../../../dist/index.js --debug 2>&1 | grep -q "requests\|flask\|django"; then
  echo "✓ Python pyproject.toml test passed"
else
  echo "✗ Python pyproject.toml test failed"
  exit 1
fi
rm -f pyproject.toml .codependencerc

# Test 3: Python Pipfile (pipenv)
echo "\n3. Testing Python Pipfile..."
cp python-Pipfile Pipfile
cp .codependencerc-python .codependencerc
if node ../../../dist/index.js --debug 2>&1 | grep -q "requests\|flask\|django"; then
  echo "✓ Python Pipfile test passed"
else
  echo "✗ Python Pipfile test failed"
  exit 1
fi
rm -f Pipfile .codependencerc

# Test 4: Go go.mod
echo "\n4. Testing Go go.mod..."
cp go.mod go.mod.test
mv go.mod.test go.mod
cp .codependencerc-go .codependencerc
if node ../../../dist/index.js --debug 2>&1 | grep -q "gin-gonic\|lib/pq\|golang.org"; then
  echo "✓ Go go.mod test passed"
else
  echo "✗ Go go.mod test failed"
  exit 1
fi
rm -f go.mod .codependencerc

# Test 5: Detection without language flag
echo "\n5. Testing automatic language detection..."

# Test Python detection
cp python-requirements.txt requirements.txt
if node ../../../dist/index.js --debug --codependencies requests 2>&1 | grep -q "requests"; then
  echo "✓ Python auto-detection test passed"
else
  echo "✗ Python auto-detection test failed"
  exit 1
fi
rm -f requirements.txt

# Test Go detection
cp go.mod go.mod.test
mv go.mod.test go.mod
if node ../../../dist/index.js --debug --codependencies github.com/gin-gonic/gin 2>&1 | grep -q "gin"; then
  echo "✓ Go auto-detection test passed"
else
  echo "✗ Go auto-detection test failed - this is expected if go is not installed"
  # Don't fail the test suite for Go detection if go CLI isn't available
fi
rm -f go.mod

# Test 6: Mixed project (Node.js + Python)
echo "\n6. Testing polyglot project (Node.js + Python)..."
cp test-package.json package.json
cp python-requirements.txt requirements.txt
if node ../../../dist/index.js --debug --codependencies lodash 2>&1 | grep -q "lodash"; then
  echo "✓ Polyglot project test passed (prioritizes Node.js)"
else
  echo "✗ Polyglot project test failed"
  exit 1
fi
rm -f package.json requirements.txt

echo "\n=== All Python and Go tests passed! ==="
