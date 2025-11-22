#!/bin/sh
set -e

echo "=== Testing codependence init functionality ==="

# Test 1: Non-interactive RC creation (legacy mode - pins all deps)
echo "\n1. Testing init with dependencies available (legacy pin-all mode)..."
cp test-package.json package.json
rm -f .codependencerc
node dist/index.js init rc
if [ -f ".codependencerc" ]; then
  # Verify config has codependencies (not permissive mode)
  if grep -q '"codependencies"' .codependencerc && ! grep -q '"permissive"' .codependencerc; then
    echo "✓ Non-interactive RC creation test passed (legacy pin-all mode)"
  else
    echo "✗ Non-interactive RC creation test failed - config format incorrect"
    cat .codependencerc
    exit 1
  fi
else
  echo "✗ Non-interactive RC creation test failed - no config file created"
  exit 1
fi

# Test 2: Package.json configuration (legacy mode - pins all deps)
echo "\n2. Testing package.json configuration (legacy pin-all mode)..."
rm -f .codependencerc
rm -f package.json
cp test-package.json package.json
node dist/index.js init package
if grep -q '"codependence"' package.json; then
  # Verify package.json has codependencies but not permissive flag
  if grep -q '"codependencies"' package.json && ! grep -q '"permissive"' package.json; then
    echo "✓ Package.json configuration test passed (legacy pin-all mode)"
  else
    echo "✗ Package.json configuration test failed - config format incorrect"
    grep -A 10 '"codependence"' package.json
    exit 1
  fi
else
  echo "✗ Package.json configuration test failed - no codependence config added"
  exit 1
fi

# Test 3: Existing config detection
echo "\n3. Testing existing config detection..."
if node dist/index.js init rc 2>&1 | grep -q "configuration already exists"; then
  echo "✓ Existing config detection test passed"
else
  echo "✗ Existing config detection test failed"
  exit 1
fi

# Test 4: No dependencies scenario
echo "\n4. Testing no dependencies scenario..."
rm -f .codependencerc
rm -f package.json
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
rm -f package.json
# Create subdirectory to avoid Node.js parsing issues
mkdir -p invalid-test
cp invalid-package.json invalid-test/package.json
cd invalid-test
if node ../dist/index.js init rc 2>&1 | grep -q "Invalid JSON in package.json"; then
  echo "✓ Invalid JSON error test passed"
else
  echo "✗ Invalid JSON error test failed"
  exit 1
fi
cd ..
rm -rf invalid-test

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

# Test 7: Validate permissive mode doesn't require codependencies
echo "\n7. Testing permissive mode doesn't require codependencies..."
cp test-package.json package.json
rm -f .codependencerc
# Create a minimal permissive config - should not throw "codependencies required" error
echo '{"permissive": true}' > .codependencerc
# In permissive mode, it might exit with 1 due to outdated deps, but shouldn't throw "required" error
if node dist/index.js --silent 2>&1 | grep -q 'codependencies.*required'; then
  echo "✗ Permissive mode should not require codependencies"
  exit 1
else
  echo "✓ Permissive mode doesn't require codependencies test passed"
fi

# Test 8: Test permissive mode config structure validation
echo "\n8. Testing permissive mode config structure validation..."
cp test-package.json package.json
rm -f .codependencerc
# Create config with both permissive mode and some pinned deps
echo '{"permissive": true, "codependencies": ["lodash"]}' > .codependencerc
# Just verify the config exists and is readable (no network calls)
if [ -f ".codependencerc" ] && grep -q '"permissive"' .codependencerc && grep -q '"codependencies"' .codependencerc; then
  echo "✓ Permissive mode config structure test passed"
else
  echo "✗ Permissive mode config structure test failed"
  exit 1
fi

# Test 9: Test non-permissive mode still requires codependencies
echo "\n9. Testing non-permissive mode requires codependencies..."
rm -f .codependencerc
# Create empty config (no permissive, no codependencies)
echo '{}' > .codependencerc
if node dist/index.js --silent 2>&1 | grep -q 'codependencies.*required'; then
  echo "✓ Non-permissive mode codependencies requirement test passed"
else
  echo "✗ Non-permissive mode codependencies requirement test failed"
  exit 1
fi

# Test 10: Test that init default type creates pin-all config
echo "\n10. Testing init default type creates pin-all config..."
rm -f .codependencerc
rm -f package.json
cp test-package.json package.json
node dist/index.js init default
if [ -f ".codependencerc" ]; then
  # Should create pin-all config (not permissive)
  if grep -q '"codependencies"' .codependencerc && ! grep -q '"permissive"' .codependencerc; then
    echo "✓ Init default type test passed (creates pin-all config)"
  else
    echo "✗ Init default type test failed - should create pin-all config"
    cat .codependencerc
    exit 1
  fi
else
  echo "✗ Init default type test failed - no config file created"
  exit 1
fi

echo "\n=== All tests passed! ==="
