#!/bin/sh
set -e

echo "=== Testing codependence init functionality ==="

# Test 1: Non-interactive RC creation
echo "\n1. Testing init with dependencies available..."
cp test-package.json package.json
rm -f .codependencerc
node dist/index.js init rc
echo "✓ Non-interactive RC creation test passed"

# Test 2: Package.json configuration
echo "\n2. Testing package.json configuration..."
rm -f .codependencerc
rm -f package.json
cp test-package.json package.json
node dist/index.js init package
echo "✓ Package.json configuration test passed"

# Test 3: Existing config detection
echo "\n3. Testing existing config detection..."
node dist/index.js init rc
echo "✓ Existing config detection test passed"

# Test 4: No dependencies scenario
echo "\n4. Testing no dependencies scenario..."
rm -f .codependencerc
cp minimal-package.json package.json
if node dist/index.js init rc 2>&1 | grep -q "No dependencies found"; then
  echo "✓ No dependencies error test passed"
else
  echo "✗ No dependencies error test failed"
  exit 1
fi

# Test 5: Invalid JSON scenario
echo "\n5. Testing invalid JSON scenario..."
rm -f .codependencerc
cp invalid-package.json package.json
if node dist/index.js init rc 2>&1 | grep -q "Invalid package config\|Invalid JSON"; then
  echo "✓ Invalid JSON error test passed"
else
  echo "✗ Invalid JSON error test failed"
  exit 1
fi

# Test 6: Missing package.json scenario
echo "\n6. Testing missing package.json scenario..."
rm -f package.json
rm -f .codependencerc
if node dist/index.js init rc 2>&1 | grep -q "package.json not found"; then
  echo "✓ Missing package.json error test passed"
else
  echo "✗ Missing package.json error test failed"
  exit 1
fi

echo "\n=== All tests passed! ==="
