export const TEST_COVERAGE_FLAG = "--coverage";
export const TEST_COVERAGE_DIR = "coverage";
export const TEST_COVERAGE_REPORT = `${TEST_COVERAGE_DIR}/lcov.info`;
export const TEST_COVERAGE_INCLUDES = ["src/**/*.ts", "scripts/**/*.ts"];
export const TEST_COVERAGE_EXCLUDES = [
  "tests/**/*.ts",
  "scripts/build/**/*.ts",
  "scripts/run/**/*.ts",
  "scripts/release/index.ts",
];
export const TEST_COVERAGE_ARGS = [
  "--experimental-test-coverage",
  "--test-coverage-lines=80",
  "--test-reporter=spec",
  "--test-reporter-destination=stdout",
  "--test-reporter=lcov",
  `--test-reporter-destination=${TEST_COVERAGE_REPORT}`,
];
