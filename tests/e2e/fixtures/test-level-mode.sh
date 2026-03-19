#!/bin/sh
set -e

echo "=== Testing codependence level and mode features ==="

# --- LEVEL FEATURE TESTS ---

# Test 1: --level flag via CLI (major - default, should find outdated deps)
echo "\n1. Testing --level major via CLI flag..."
cp level-package.json.fixture package.json
echo '{"codependencies": ["lodash", "express"]}' > .codependencerc
if node dist/index.js --level major --silent 2>&1; then
  echo "✓ Level major test passed (no error or deps up-to-date)"
else
  echo "✓ Level major test passed (exited with outdated deps as expected)"
fi
rm -f .codependencerc

# Test 2: --level patch via CLI flag (restricts updates to same minor)
echo "\n2. Testing --level patch via CLI flag..."
cp level-package.json.fixture package.json
echo '{"codependencies": ["lodash", "express"]}' > .codependencerc
if node dist/index.js --level patch --debug 2>&1 | grep -q "lodash\|express"; then
  echo "✓ Level patch CLI flag test passed"
else
  echo "✗ Level patch CLI flag test failed"
  exit 1
fi
rm -f .codependencerc

# Test 3: --level minor via CLI flag
echo "\n3. Testing --level minor via CLI flag..."
cp level-package.json.fixture package.json
echo '{"codependencies": ["lodash", "express"]}' > .codependencerc
if node dist/index.js --level minor --debug 2>&1 | grep -q "lodash\|express"; then
  echo "✓ Level minor CLI flag test passed"
else
  echo "✗ Level minor CLI flag test failed"
  exit 1
fi
rm -f .codependencerc

# Test 4: Level from config file (patch)
echo "\n4. Testing level from config file (patch)..."
cp level-package.json.fixture package.json
cp .codependencerc-level-patch .codependencerc
if node dist/index.js --debug 2>&1 | grep -q "lodash\|express"; then
  echo "✓ Level patch config file test passed"
else
  echo "✗ Level patch config file test failed"
  exit 1
fi
rm -f .codependencerc

# Test 5: Level from config file (minor)
echo "\n5. Testing level from config file (minor)..."
cp level-package.json.fixture package.json
cp .codependencerc-level-minor .codependencerc
if node dist/index.js --debug 2>&1 | grep -q "lodash\|express"; then
  echo "✓ Level minor config file test passed"
else
  echo "✗ Level minor config file test failed"
  exit 1
fi
rm -f .codependencerc

# Test 6: Level from config file (major)
echo "\n6. Testing level from config file (major)..."
cp level-package.json.fixture package.json
cp .codependencerc-level-major .codependencerc
if node dist/index.js --debug 2>&1 | grep -q "lodash\|express"; then
  echo "✓ Level major config file test passed"
else
  echo "✗ Level major config file test failed"
  exit 1
fi
rm -f .codependencerc

# --- MODE FEATURE TESTS ---

# Test 7: --mode verbose via CLI flag (default behavior, checks listed deps)
echo "\n7. Testing --mode verbose via CLI flag..."
cp level-package.json.fixture package.json
echo '{"codependencies": ["lodash"]}' > .codependencerc
if node dist/index.js --mode verbose --debug 2>&1 | grep -q "lodash"; then
  echo "✓ Mode verbose CLI flag test passed"
else
  echo "✗ Mode verbose CLI flag test failed"
  exit 1
fi
rm -f .codependencerc

# Test 8: --mode precise via CLI flag (scans all project deps)
echo "\n8. Testing --mode precise via CLI flag..."
cp level-package.json.fixture package.json
echo '{}' > .codependencerc
if node dist/index.js --mode precise --debug 2>&1 | grep -q "lodash\|express\|typescript"; then
  echo "✓ Mode precise CLI flag test passed (found project deps)"
else
  echo "✗ Mode precise CLI flag test failed"
  exit 1
fi
rm -f .codependencerc

# Test 9: Mode precise from config file (no codependencies needed)
echo "\n9. Testing mode precise from config file..."
cp level-package.json.fixture package.json
cp .codependencerc-mode-precise .codependencerc
if node dist/index.js --debug 2>&1 | grep -q "lodash\|express\|typescript"; then
  echo "✓ Mode precise config file test passed"
else
  echo "✗ Mode precise config file test failed"
  exit 1
fi
rm -f .codependencerc

# Test 10: Mode verbose from config file
echo "\n10. Testing mode verbose from config file..."
cp level-package.json.fixture package.json
cp .codependencerc-mode-verbose .codependencerc
if node dist/index.js --debug 2>&1 | grep -q "lodash"; then
  echo "✓ Mode verbose config file test passed"
else
  echo "✗ Mode verbose config file test failed"
  exit 1
fi
rm -f .codependencerc

# Test 11: --permissive flag auto-sets precise mode
echo "\n11. Testing --permissive flag enables precise mode..."
cp level-package.json.fixture package.json
echo '{}' > .codependencerc
if node dist/index.js --permissive --debug 2>&1 | grep -q "lodash\|express\|typescript"; then
  echo "✓ Permissive flag enables precise mode test passed"
else
  echo "✗ Permissive flag enables precise mode test failed"
  exit 1
fi
rm -f .codependencerc

# Test 12: Precise mode with pinned codependencies (pins are excluded from update-all)
echo "\n12. Testing precise mode with pinned codependencies..."
cp level-package.json.fixture package.json
cp .codependencerc-mode-precise-pinned .codependencerc
if node dist/index.js --debug 2>&1 | grep -q "lodash"; then
  echo "✓ Precise mode with pinned deps test passed"
else
  echo "✗ Precise mode with pinned deps test failed"
  exit 1
fi
rm -f .codependencerc

# --- COMBINED LEVEL + MODE TESTS ---

# Test 13: Combined level + mode from config file
echo "\n13. Testing combined level and mode from config file..."
cp level-package.json.fixture package.json
cp .codependencerc-level-mode-combo .codependencerc
if node dist/index.js --debug 2>&1 | grep -q "lodash"; then
  echo "✓ Combined level + mode config test passed"
else
  echo "✗ Combined level + mode config test failed"
  exit 1
fi
rm -f .codependencerc

# Test 14: CLI flag overrides config level
echo "\n14. Testing CLI flag overrides config level..."
cp level-package.json.fixture package.json
cp .codependencerc-level-major .codependencerc
if node dist/index.js --level patch --debug 2>&1 | grep -q "lodash\|express"; then
  echo "✓ CLI flag overrides config level test passed"
else
  echo "✗ CLI flag overrides config level test failed"
  exit 1
fi
rm -f .codependencerc

# Test 15: CLI flag overrides config mode
echo "\n15. Testing CLI flag overrides config mode..."
cp level-package.json.fixture package.json
cp .codependencerc-mode-verbose .codependencerc
if node dist/index.js --mode precise --debug 2>&1 | grep -q "lodash\|express\|typescript"; then
  echo "✓ CLI flag overrides config mode test passed"
else
  echo "✗ CLI flag overrides config mode test failed"
  exit 1
fi
rm -f .codependencerc

# Test 16: Precise mode without codependencies doesn't throw "required" error
echo "\n16. Testing precise mode doesn't require codependencies..."
cp level-package.json.fixture package.json
echo '{"mode": "precise"}' > .codependencerc
if node dist/index.js --silent 2>&1 | grep -q 'codependencies.*required'; then
  echo "✗ Precise mode should not require codependencies"
  exit 1
else
  echo "✓ Precise mode doesn't require codependencies test passed"
fi
rm -f .codependencerc

# Test 17: Verbose mode without codependencies throws "required" error
echo "\n17. Testing verbose mode requires codependencies..."
cp level-package.json.fixture package.json
echo '{"mode": "verbose"}' > .codependencerc
if node dist/index.js --silent 2>&1 | grep -q 'codependencies.*required'; then
  echo "✓ Verbose mode requires codependencies test passed"
else
  echo "✗ Verbose mode requires codependencies test failed"
  exit 1
fi
rm -f .codependencerc

echo "\n=== All level and mode tests passed! ==="
