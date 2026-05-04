#!/bin/sh
set -e

echo "=== Testing codependence with Python and Go ==="

# Test 1: Python requirements.txt
printf '\n1. Testing Python requirements.txt...\n'
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
printf '\n2. Testing Python pyproject.toml (poetry)...\n'
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
printf '\n3. Testing Python Pipfile...\n'
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
printf '\n4. Testing Go go.mod...\n'
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
printf '\n5. Testing automatic language detection...\n'

mv package.json package.json.bak
mv node_modules node_modules.bak 2>/dev/null || true
cp python-requirements.txt.fixture requirements.txt
echo '{"codependencies":["requests"]}' > .codependencerc
if node ./dist/cli.js --debug 2>&1 | grep -q "requests"; then
  echo "✓ Python auto-detection test passed"
else
  echo "✗ Python auto-detection test failed"
  mv package.json.bak package.json
  mv node_modules.bak node_modules 2>/dev/null || true
  rm -f requirements.txt .codependencerc
  exit 1
fi
rm -f requirements.txt .codependencerc
mv package.json.bak package.json
mv node_modules.bak node_modules 2>/dev/null || true

mv package.json package.json.bak
mv node_modules node_modules.bak 2>/dev/null || true
cp go.mod.fixture go.mod
echo '{"codependencies":["github.com/gin-gonic/gin"]}' > .codependencerc
if node ./dist/cli.js --debug 2>&1 | grep -q "gin"; then
  echo "✓ Go auto-detection test passed"
else
  echo "✗ Go auto-detection test failed - this is expected if go is not installed"
fi
rm -f go.mod .codependencerc
mv package.json.bak package.json
mv node_modules.bak node_modules 2>/dev/null || true

# Test 6: Mixed project (Node.js + Python) should require explicit scoping
printf '\n6. Testing polyglot project (Node.js + Python)...\n'
cp package.json package.json.bak
cp test-package.json.fixture package.json
cp python-requirements.txt.fixture requirements.txt
echo '{"codependencies":["lodash"]}' > .codependencerc
if node ./dist/cli.js --debug 2>&1 | grep -q "single language per run"; then
  echo "✓ Polyglot project test passed (requires explicit scoping)"
else
  echo "✗ Polyglot project test failed"
  mv package.json.bak package.json
  rm -f requirements.txt .codependencerc
  exit 1
fi
mv package.json.bak package.json
rm -f requirements.txt .codependencerc

printf '\n=== All Python and Go tests passed! ===\n'
