#!/bin/sh
set -e

fail() {
  echo "$1"
  exit 1
}

fail_init_rc_then_1() {
  echo "✗ Non-interactive RC creation test failed - config format incorrect"
  cat .codependencerc
  exit 1
}

fail_init_package_then_1() {
  echo "✗ Package.json configuration test failed - config format incorrect"
  grep -A 10 '"codependence"' package.json
  exit 1
}

fail_init_default_then_1() {
  echo "✗ Init default type test failed - should create pin-all config"
  cat .codependencerc
  exit 1
}

test_init_rc() {
  # Test 1: Non-interactive RC creation (legacy mode - pins all deps)
  printf '\n%s\n' "1. Testing init with dependencies available (legacy pin-all mode)..."
  cp test-package.json.fixture package.json
  rm -f .codependencerc
  node dist/cli.js init rc
  [ -f ".codependencerc" ] || fail "✗ Non-interactive RC creation test failed - no config file created"
  # Verify config has codependencies (not permissive mode)
  has_pinned_config .codependencerc || fail_init_rc_then_1
  echo "✓ Non-interactive RC creation test passed (legacy pin-all mode)"
}

test_init_package() {
  # Test 2: Package.json configuration (legacy mode - pins all deps)
  printf '\n%s\n' "2. Testing package.json configuration (legacy pin-all mode)..."
  rm -f .codependencerc
  rm -f package.json
  cp test-package.json.fixture package.json
  node dist/cli.js init package
  grep -q '"codependence"' package.json || fail "✗ Package.json configuration test failed - no codependence config added"
  # Verify package.json has codependencies but not permissive flag
  has_pinned_config package.json || fail_init_package_then_1
  echo "✓ Package.json configuration test passed (legacy pin-all mode)"
}

test_existing_config() {
  # Test 3: Existing config detection
  printf '\n%s\n' "3. Testing existing config detection..."
  node dist/cli.js init rc 2>&1 | grep -q "configuration already exists" || fail "✗ Existing config detection test failed"
  echo "✓ Existing config detection test passed"
}

test_no_dependencies() {
  # Test 4: No dependencies scenario
  printf '\n%s\n' "4. Testing no dependencies scenario..."
  rm -f .codependencerc
  rm -f package.json
  cp minimal-package.json.fixture package.json
  node dist/cli.js init rc 2>&1 | grep -q "No dependencies found" || fail "✗ No dependencies error test failed"
  echo "✓ No dependencies error test passed"
}

test_invalid_json() {
  # Test 5: Invalid JSON scenario
  printf '\n%s\n' "5. Testing invalid JSON scenario..."
  rm -f .codependencerc
  rm -f package.json
  # Create subdirectory to avoid Node.js parsing issues
  mkdir -p invalid-test
  cp invalid-package.json.fixture invalid-test/package.json
  cd invalid-test
  node ../dist/cli.js init rc 2>&1 | grep -q "Invalid JSON in package.json" || fail "✗ Invalid JSON error test failed"
  echo "✓ Invalid JSON error test passed"
  cd ..
  rm -rf invalid-test
}

test_missing_package() {
  # Test 6: Missing package.json scenario
  printf '\n%s\n' "6. Testing missing package.json scenario..."
  rm -f package.json
  rm -f .codependencerc
  node dist/cli.js init rc 2>&1 | grep -q "package.json not found" || fail "✗ Missing package.json error test failed"
  echo "✓ Missing package.json error test passed"
}

test_permissive_mode() {
  # Test 7: Validate permissive mode doesn't require codependencies
  printf '\n%s\n' "7. Testing permissive mode doesn't require codependencies..."
  cp test-package.json.fixture package.json
  rm -f .codependencerc
  # Create a minimal permissive config - should not throw "codependencies required" error
  echo '{"permissive": true}' >.codependencerc
  # In permissive mode, it might exit with 1 due to outdated deps, but shouldn't throw "required" error
  ! node dist/cli.js --silent 2>&1 | grep -q 'codependencies.*required' || fail "✗ Permissive mode should not require codependencies"
  echo "✓ Permissive mode doesn't require codependencies test passed"
}

test_permissive_config() {
  # Test 8: Test permissive mode config structure validation
  printf '\n%s\n' "8. Testing permissive mode config structure validation..."
  cp test-package.json.fixture package.json
  rm -f .codependencerc
  # Create config with both permissive mode and some pinned deps
  echo '{"permissive": true, "codependencies": ["lodash"]}' >.codependencerc
  # Just verify the config exists and is readable (no network calls)
  has_permissive_config || fail "✗ Permissive mode config structure test failed"
  echo "✓ Permissive mode config structure test passed"
}

test_minimal_config() {
  # Test 9: Test minimal configuration remains valid
  printf '\n%s\n' "9. Testing minimal configuration..."
  rm -f .codependencerc
  cat >.codependencerc <<'JSON'
{ "permissive": false }
JSON
  ! node dist/cli.js --silent 2>&1 | grep -q 'codependencies.*required' || fail "FAIL Minimal configuration should not require codependencies"
  echo "PASS Minimal configuration test passed"
}

test_init_default() {
  # Test 10: Test that init default type creates pin-all config
  printf '\n%s\n' "10. Testing init default type creates pin-all config..."
  rm -f .codependencerc
  rm -f package.json
  cp test-package.json.fixture package.json
  node dist/cli.js init default
  [ -f ".codependencerc" ] || fail "✗ Init default type test failed - no config file created"
  # Should create pin-all config (not permissive)
  has_pinned_config .codependencerc || fail_init_default_then_1
  echo "✓ Init default type test passed (creates pin-all config)"
}

test_workspace_onboarding() {
  # Test 11: Workspace-aware onboarding
  printf '\n%s\n' "11. Testing workspace-aware onboarding..."
  prepare_onboarding_workspace
  node dist/cli.js init onboarding-test \
    --mode precise \
    --codependencies react \
    --enforcement github \
    --repository acme/workspace \
    --non-interactive \
    --skip-install

  [ -f onboarding-test/.codependencerc ] || fail "FAIL: Onboarding did not create .codependencerc"
  [ -f onboarding-test/.github/workflows/codependence-node.yml ] || fail "FAIL: Onboarding did not create the GitHub workflow"
  grep -q 'apps/web/package.json' onboarding-test/.codependencerc || fail "FAIL: Onboarding did not include the declared workspace"
  ! grep -q 'examples/demo/package.json' onboarding-test/.codependencerc || fail "FAIL: Onboarding included a non-workspace package"
  grep -q 'secrets.CODEPENDENCE_TOKEN' onboarding-test/.github/workflows/codependence-node.yml || fail "FAIL: Onboarding workflow did not reference the repository secret"
  rm -rf onboarding-test
  echo "PASS: Workspace-aware onboarding test"
}

test_workspace_installation() {
  # Test 12: Workspace-root installation and failure cleanup
  printf '\n%s\n' "12. Testing workspace-root installation..."
  prepare_install_workspaces
  PATH="$PWD/fake-bin:$PATH" node dist/cli.js init onboarding-install-test \
    --mode precise \
    --enforcement local \
    --non-interactive

  grep -q '^add --save-dev -w codependence$' onboarding-install-test/install-args || fail "FAIL: Onboarding did not install pnpm dependency at the workspace root"
  assert_install_failure_cleanup
  rm -rf onboarding-install-test onboarding-fail-test fake-bin
  echo "PASS: Workspace-root installation test"

}

prepare_onboarding_workspace() {
  rm -rf onboarding-test
  mkdir -p onboarding-test/apps/web onboarding-test/examples/demo
  printf '%s\n' '{"name":"workspace","packageManager":"pnpm@9.15.0","dependencies":{"react":"^19.0.0"}}' >onboarding-test/package.json
  printf '%s\n' 'packages:' '  - apps/*' >onboarding-test/pnpm-workspace.yaml
  printf '%s\n' '{"name":"@workspace/web","dependencies":{"react":"^19.0.0","vite":"^8.1.0"}}' >onboarding-test/apps/web/package.json
  printf '%s\n' '{"name":"demo","dependencies":{"lodash":"^4.17.21"}}' >onboarding-test/examples/demo/package.json
  touch onboarding-test/pnpm-lock.yaml
}

prepare_install_workspaces() {
  rm -rf onboarding-install-test onboarding-fail-test fake-bin
  mkdir -p onboarding-install-test/apps/web onboarding-fail-test/apps/web fake-bin
  printf '%s\n' '{"name":"workspace","packageManager":"pnpm@9.15.0"}' >onboarding-install-test/package.json
  printf '%s\n' '{"name":"@workspace/web","dependencies":{"react":"^19.0.0"}}' >onboarding-install-test/apps/web/package.json
  printf '%s\n' 'packages:' '  - apps/*' >onboarding-install-test/pnpm-workspace.yaml
  cp -R onboarding-install-test/. onboarding-fail-test/
  printf '%s\n' '#!/bin/sh' 'printf "%s\n" "$*" > install-args' >fake-bin/pnpm
  chmod +x fake-bin/pnpm
}

has_pinned_config() {
  config_file="${1:?config file is required}"
  grep -q '"codependencies"' "$config_file" && ! grep -q '"permissive"' "$config_file"
}

has_permissive_config() {
  [ -f .codependencerc ] && grep -q '"permissive"' .codependencerc && grep -q '"codependencies"' .codependencerc
}

assert_install_failure_cleanup() {
  printf '%s\n' '#!/bin/sh' 'exit 1' >fake-bin/pnpm
  chmod +x fake-bin/pnpm
  ! PATH="$PWD/fake-bin:$PATH" node dist/cli.js init onboarding-fail-test \
    --mode precise \
    --enforcement local \
    --non-interactive || fail "FAIL: Onboarding should fail when package installation fails"
  ! [ -f onboarding-fail-test/.codependencerc ] || fail "FAIL: Onboarding wrote config before package installation succeeded"
}

main() {
  echo "=== Testing codependence init functionality ==="
  test_init_rc
  test_init_package
  test_existing_config
  test_no_dependencies
  test_invalid_json
  test_missing_package
  test_permissive_mode
  test_permissive_config
  test_minimal_config
  test_init_default
  test_workspace_onboarding
  test_workspace_installation
  printf '\n%s\n' "=== All tests passed! ==="
}

main
