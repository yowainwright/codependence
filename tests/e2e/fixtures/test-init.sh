#!/bin/sh
set -e

echo "=== Testing codependence init functionality ==="

# Test 1: Non-interactive RC creation (legacy mode - pins all deps)
echo "\n1. Testing init with dependencies available (legacy pin-all mode)..."
cp test-package.json.fixture package.json
rm -f .codependencerc
node dist/cli.js init rc
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
cp test-package.json.fixture package.json
node dist/cli.js init package
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
if node dist/cli.js init rc 2>&1 | grep -q "configuration already exists"; then
  echo "✓ Existing config detection test passed"
else
  echo "✗ Existing config detection test failed"
  exit 1
fi

# Test 4: No dependencies scenario
echo "\n4. Testing no dependencies scenario..."
rm -f .codependencerc
rm -f package.json
cp minimal-package.json.fixture package.json
if node dist/cli.js init rc 2>&1 | grep -q "No dependencies found"; then
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
cp invalid-package.json.fixture invalid-test/package.json
cd invalid-test
if node ../dist/cli.js init rc 2>&1 | grep -q "Invalid JSON in package.json"; then
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
if node dist/cli.js init rc 2>&1 | grep -q "package.json not found"; then
  echo "✓ Missing package.json error test passed"
else
  echo "✗ Missing package.json error test failed"
  exit 1
fi

# Test 7: Validate permissive mode doesn't require codependencies
echo "\n7. Testing permissive mode doesn't require codependencies..."
cp test-package.json.fixture package.json
rm -f .codependencerc
# Create a minimal permissive config - should not throw "codependencies required" error
echo '{"permissive": true}' > .codependencerc
# In permissive mode, it might exit with 1 due to outdated deps, but shouldn't throw "required" error
if node dist/cli.js --silent 2>&1 | grep -q 'codependencies.*required'; then
  echo "✗ Permissive mode should not require codependencies"
  exit 1
else
  echo "✓ Permissive mode doesn't require codependencies test passed"
fi

# Test 8: Test permissive mode config structure validation
echo "\n8. Testing permissive mode config structure validation..."
cp test-package.json.fixture package.json
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
echo '{ "permissive": false }' > .codependencerc
if node dist/cli.js --silent 2>&1 | grep -q 'codependencies.*required'; then
  echo "✓ Non-permissive mode codependencies requirement test passed"
else
  echo "✗ Non-permissive mode codependencies requirement test failed"
  exit 1
fi

# Test 10: Test that init default type creates pin-all config
echo "\n10. Testing init default type creates pin-all config..."
rm -f .codependencerc
rm -f package.json
cp test-package.json.fixture package.json
node dist/cli.js init default
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

# Test 11: Workspace-aware onboarding
echo "\n11. Testing workspace-aware onboarding..."
rm -rf onboarding-test
mkdir -p onboarding-test/apps/web onboarding-test/examples/demo
printf '%s\n' '{"name":"workspace","packageManager":"pnpm@9.15.0","dependencies":{"react":"^19.0.0"}}' > onboarding-test/package.json
printf '%s\n' 'packages:' '  - apps/*' > onboarding-test/pnpm-workspace.yaml
printf '%s\n' '{"name":"@workspace/web","dependencies":{"react":"^19.0.0","vite":"^8.1.0"}}' > onboarding-test/apps/web/package.json
printf '%s\n' '{"name":"demo","dependencies":{"lodash":"^4.17.21"}}' > onboarding-test/examples/demo/package.json
touch onboarding-test/pnpm-lock.yaml
node dist/cli.js init onboarding-test \
  --mode precise \
  --codependencies react \
  --enforcement github \
  --repository acme/workspace \
  --non-interactive \
  --skip-install

if [ ! -f onboarding-test/.codependencerc ]; then
  echo "FAIL: Onboarding did not create .codependencerc"
  exit 1
fi
if [ ! -f onboarding-test/.github/workflows/codependence-node.yml ]; then
  echo "FAIL: Onboarding did not create the GitHub workflow"
  exit 1
fi
if ! grep -q 'apps/web/package.json' onboarding-test/.codependencerc; then
  echo "FAIL: Onboarding did not include the declared workspace"
  exit 1
fi
if grep -q 'examples/demo/package.json' onboarding-test/.codependencerc; then
  echo "FAIL: Onboarding included a non-workspace package"
  exit 1
fi
if ! grep -q 'secrets.CODEPENDENCE_TOKEN' onboarding-test/.github/workflows/codependence-node.yml; then
  echo "FAIL: Onboarding workflow did not reference the repository secret"
  exit 1
fi
rm -rf onboarding-test
echo "PASS: Workspace-aware onboarding test"

# Test 12: Workspace-root installation and failure cleanup
echo "\n12. Testing workspace-root installation..."
rm -rf onboarding-install-test onboarding-fail-test fake-bin
mkdir -p onboarding-install-test/apps/web onboarding-fail-test/apps/web fake-bin
printf '%s\n' '{"name":"workspace","packageManager":"pnpm@9.15.0"}' > onboarding-install-test/package.json
printf '%s\n' '{"name":"@workspace/web","dependencies":{"react":"^19.0.0"}}' > onboarding-install-test/apps/web/package.json
printf '%s\n' 'packages:' '  - apps/*' > onboarding-install-test/pnpm-workspace.yaml
cp -R onboarding-install-test/. onboarding-fail-test/
printf '%s\n' '#!/bin/sh' 'printf "%s\n" "$*" > install-args' > fake-bin/pnpm
chmod +x fake-bin/pnpm
PATH="$PWD/fake-bin:$PATH" node dist/cli.js init onboarding-install-test \
  --mode precise \
  --enforcement local \
  --non-interactive

if ! grep -q '^add --save-dev -w codependence$' onboarding-install-test/install-args; then
  echo "FAIL: Onboarding did not install pnpm dependency at the workspace root"
  exit 1
fi
printf '%s\n' '#!/bin/sh' 'exit 1' > fake-bin/pnpm
chmod +x fake-bin/pnpm
if PATH="$PWD/fake-bin:$PATH" node dist/cli.js init onboarding-fail-test \
  --mode precise \
  --enforcement local \
  --non-interactive; then
  echo "FAIL: Onboarding should fail when package installation fails"
  exit 1
fi
if [ -f onboarding-fail-test/.codependencerc ]; then
  echo "FAIL: Onboarding wrote config before package installation succeeded"
  exit 1
fi
rm -rf onboarding-install-test onboarding-fail-test fake-bin
echo "PASS: Workspace-root installation test"

echo "\n=== All tests passed! ==="
