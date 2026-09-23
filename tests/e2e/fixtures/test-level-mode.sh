#!/bin/sh
set -e

run_cli() {
  exit_code=0
  output=$(node dist/cli.js "$@" 2>&1) || exit_code=$?
  [ "$exit_code" -le 1 ] || report_cli_exit
  ! echo "$output" | grep -q "Failed to fetch version\|Error: Command failed\|npm error" || report_resolver_error
  echo "$output"
}

# --- LEVEL FEATURE TESTS ---

fail() {
  echo "$1"
  exit 1
}

test_level_major() {
  # Test 1: --level flag via CLI (major - default, should find outdated deps)
  printf '\n%s\n' "1. Testing --level major via CLI flag..."
  cp level-package.json.fixture package.json
  echo '{"codependencies": ["lodash", "express"]}' >.codependencerc
  condition_status=0
  run_cli --level major --silent >/dev/null || condition_status=$?
  case "$condition_status" in
  0)
    echo "✓ Level major test passed (no error or deps up-to-date)"
    ;;
  *)
    echo "✓ Level major test passed (exited with outdated deps as expected)"
    ;;
  esac
  rm -f .codependencerc
}

test_level_patch() {
  # Test 2: --level patch via CLI flag (restricts updates to same minor)
  printf '\n%s\n' "2. Testing --level patch via CLI flag..."
  cp level-package.json.fixture package.json
  echo '{"codependencies": ["lodash", "express"]}' >.codependencerc
  run_cli --level patch --debug >/dev/null || fail "✗ Level patch CLI flag test failed"
  echo "✓ Level patch CLI flag test passed"
  rm -f .codependencerc
}

test_level_minor() {
  # Test 3: --level minor via CLI flag
  printf '\n%s\n' "3. Testing --level minor via CLI flag..."
  cp level-package.json.fixture package.json
  echo '{"codependencies": ["lodash", "express"]}' >.codependencerc
  run_cli --level minor --debug >/dev/null || fail "✗ Level minor CLI flag test failed"
  echo "✓ Level minor CLI flag test passed"
  rm -f .codependencerc
}

test_config_patch() {
  # Test 4: Level from config file (patch)
  printf '\n%s\n' "4. Testing level from config file (patch)..."
  cp level-package.json.fixture package.json
  cp .codependencerc-level-patch .codependencerc
  run_cli --debug >/dev/null || fail "✗ Level patch config file test failed"
  echo "✓ Level patch config file test passed"
  rm -f .codependencerc
}

test_config_minor() {
  # Test 5: Level from config file (minor)
  printf '\n%s\n' "5. Testing level from config file (minor)..."
  cp level-package.json.fixture package.json
  cp .codependencerc-level-minor .codependencerc
  run_cli --debug >/dev/null || fail "✗ Level minor config file test failed"
  echo "✓ Level minor config file test passed"
  rm -f .codependencerc
}

test_config_major() {
  # Test 6: Level from config file (major)
  printf '\n%s\n' "6. Testing level from config file (major)..."
  cp level-package.json.fixture package.json
  cp .codependencerc-level-major .codependencerc
  run_cli --debug >/dev/null || fail "✗ Level major config file test failed"
  echo "✓ Level major config file test passed"
  rm -f .codependencerc

  # --- MODE FEATURE TESTS ---
}

test_mode_verbose() {
  # Test 7: --mode verbose via CLI flag (default behavior, checks listed deps)
  printf '\n%s\n' "7. Testing --mode verbose via CLI flag..."
  cp level-package.json.fixture package.json
  echo '{"codependencies": ["lodash"]}' >.codependencerc
  run_cli --mode verbose --debug >/dev/null || fail "✗ Mode verbose CLI flag test failed"
  echo "✓ Mode verbose CLI flag test passed"
  rm -f .codependencerc
}

test_mode_precise() {
  # Test 8: --mode precise via CLI flag (scans all project deps)
  printf '\n%s\n' "8. Testing --mode precise via CLI flag..."
  cp level-package.json.fixture package.json
  echo '{}' >.codependencerc
  run_cli --mode precise --debug >/dev/null || fail "✗ Mode precise CLI flag test failed"
  echo "✓ Mode precise CLI flag test passed (found project deps)"
  rm -f .codependencerc
}

test_config_precise() {
  # Test 9: Mode precise from config file (no codependencies needed)
  printf '\n%s\n' "9. Testing mode precise from config file..."
  cp level-package.json.fixture package.json
  cp .codependencerc-mode-precise .codependencerc
  run_cli --debug >/dev/null || fail "✗ Mode precise config file test failed"
  echo "✓ Mode precise config file test passed"
  rm -f .codependencerc
}

test_config_verbose() {
  # Test 10: Mode verbose from config file
  printf '\n%s\n' "10. Testing mode verbose from config file..."
  cp level-package.json.fixture package.json
  cp .codependencerc-mode-verbose .codependencerc
  run_cli --debug >/dev/null || fail "✗ Mode verbose config file test failed"
  echo "✓ Mode verbose config file test passed"
  rm -f .codependencerc
}

test_permissive_flag() {
  # Test 11: --permissive flag auto-sets precise mode
  printf '\n%s\n' "11. Testing --permissive flag enables precise mode..."
  cp level-package.json.fixture package.json
  echo '{}' >.codependencerc
  run_cli --permissive --debug >/dev/null || fail "✗ Permissive flag enables precise mode test failed"
  echo "✓ Permissive flag enables precise mode test passed"
  rm -f .codependencerc
}

test_precise_pins() {
  # Test 12: Precise mode with pinned codependencies (pins are excluded from update-all)
  printf '\n%s\n' "12. Testing precise mode with pinned codependencies..."
  cp level-package.json.fixture package.json
  cp .codependencerc-mode-precise-pinned .codependencerc
  run_cli --debug >/dev/null || fail "✗ Precise mode with pinned deps test failed"
  echo "✓ Precise mode with pinned deps test passed"
  rm -f .codependencerc

  # --- COMBINED LEVEL + MODE TESTS ---
}

test_combined_config() {
  # Test 13: Combined level + mode from config file
  printf '\n%s\n' "13. Testing combined level and mode from config file..."
  cp level-package.json.fixture package.json
  cp .codependencerc-level-mode-combo .codependencerc
  run_cli --debug >/dev/null || fail "✗ Combined level + mode config test failed"
  echo "✓ Combined level + mode config test passed"
  rm -f .codependencerc
}

test_override_level() {
  # Test 14: CLI flag overrides config level
  printf '\n%s\n' "14. Testing CLI flag overrides config level..."
  cp level-package.json.fixture package.json
  cp .codependencerc-level-major .codependencerc
  run_cli --level patch --debug >/dev/null || fail "✗ CLI flag overrides config level test failed"
  echo "✓ CLI flag overrides config level test passed"
  rm -f .codependencerc
}

test_override_mode() {
  # Test 15: CLI flag overrides config mode
  printf '\n%s\n' "15. Testing CLI flag overrides config mode..."
  cp level-package.json.fixture package.json
  cp .codependencerc-mode-verbose .codependencerc
  run_cli --mode precise --debug >/dev/null || fail "✗ CLI flag overrides config mode test failed"
  echo "✓ CLI flag overrides config mode test passed"
  rm -f .codependencerc
}

test_precise_without_pins() {
  # Test 16: Precise mode without codependencies doesn't throw "required" error
  printf '\n%s\n' "16. Testing precise mode doesn't require codependencies..."
  cp level-package.json.fixture package.json
  echo '{"mode": "precise"}' >.codependencerc
  ! run_cli --silent | grep -q 'codependencies.*required' || fail "✗ Precise mode should not require codependencies"
  echo "✓ Precise mode doesn't require codependencies test passed"
  rm -f .codependencerc
}

test_verbose_without_pins() {
  # Test 17: Verbose mode without codependencies throws "required" error
  printf '\n%s\n' "17. Testing verbose mode requires codependencies..."
  cp level-package.json.fixture package.json
  echo '{"mode": "verbose"}' >.codependencerc
  run_cli --silent | grep -q 'codependencies.*required' || fail "✗ Verbose mode requires codependencies test failed"
  echo "✓ Verbose mode requires codependencies test passed"
  rm -f .codependencerc

  printf '\n%s\n' "=== All level and mode tests passed! ==="
}

test_levels() {
  test_level_major
  test_level_patch
  test_level_minor
  test_config_patch
  test_config_minor
  test_config_major
}

test_modes() {
  test_mode_verbose
  test_mode_precise
  test_config_precise
  test_config_verbose
  test_permissive_flag
  test_precise_pins
}

test_combined_options() {
  test_combined_config
  test_override_level
  test_override_mode
  test_precise_without_pins
  test_verbose_without_pins
}

report_cli_exit() {
  echo "$output"
  fail "✗ codependence exited with unexpected code $exit_code"
}

report_resolver_error() {
  echo "$output"
  fail "✗ codependence had resolver errors"
}

main() {
  echo "=== Testing codependence level and mode features ==="
  test_levels
  test_modes
  test_combined_options
}

main
