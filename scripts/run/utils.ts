import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEST_COVERAGE_ARGS,
  TEST_COVERAGE_DIR,
  TEST_COVERAGE_EXCLUDES,
  TEST_COVERAGE_FLAG,
  TEST_COVERAGE_INCLUDES,
  TEST_COVERAGE_REPORT,
} from "./constants.ts";
import type { TestRunnerOptions } from "./types.ts";

const resolveTypeScriptSpecifier = (specifier: string, parentURL: string): string => {
  const sourcePath = fileURLToPath(new URL(specifier, parentURL));
  if (existsSync(`${sourcePath}.ts`)) return `${specifier}.ts`;
  if (existsSync(`${sourcePath}/index.ts`)) return `${specifier}/index.ts`;
  return specifier;
};

export const registerTypeScriptResolver = (): void => {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const isLocalImport = specifier.startsWith(".") && context.parentURL;
      if (!isLocalImport) return nextResolve(specifier, context);

      const resolvedSpecifier = resolveTypeScriptSpecifier(specifier, context.parentURL);
      return nextResolve(resolvedSpecifier, context);
    },
  });
};

const parseTestRunnerOptions = (args: string[]): TestRunnerOptions => ({
  coverageEnabled: args.includes(TEST_COVERAGE_FLAG),
  testArgs: args.filter((arg) => arg !== TEST_COVERAGE_FLAG),
});

const prepareCoverage = (coverageEnabled: boolean): void => {
  if (!coverageEnabled) return;
  mkdirSync(TEST_COVERAGE_DIR, { recursive: true });
  rmSync(TEST_COVERAGE_REPORT, { force: true });
};

const coverageGlob = (root: string, pattern: string): string =>
  resolve(root, pattern).replaceAll("\\", "/");

const createCoverageIncludeArgs = (root: string): string[] =>
  TEST_COVERAGE_INCLUDES.map((pattern) => `--test-coverage-include=${coverageGlob(root, pattern)}`);

const createCoverageExcludeArgs = (root: string): string[] =>
  TEST_COVERAGE_EXCLUDES.map((pattern) => `--test-coverage-exclude=${coverageGlob(root, pattern)}`);

const createCoverageArgs = (loaderUrl: string): string[] => {
  const root = fileURLToPath(new URL("../../", loaderUrl));
  const includes = createCoverageIncludeArgs(root);
  const excludes = createCoverageExcludeArgs(root);
  return TEST_COVERAGE_ARGS.concat(includes, excludes);
};

const createNodeArgs = (options: TestRunnerOptions, loaderUrl: string): string[] => {
  const baseArgs = ["--import", loaderUrl];
  const coverageArgs = options.coverageEnabled ? createCoverageArgs(loaderUrl) : [];
  const testArgs = ["--test"].concat(options.testArgs);
  return baseArgs.concat(coverageArgs, testArgs);
};

const createTestEnvironment = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  return env;
};

const assertCoverageReport = (coverageEnabled: boolean, status: number | null): void => {
  const successfulCoverage = coverageEnabled && status === 0;
  if (!successfulCoverage) return;
  const report = readFileSync(TEST_COVERAGE_REPORT, "utf8");
  if (!report.includes("SF:")) throw new Error("Coverage report contains no source files");
};

export const runTests = (args: string[], loaderUrl: string): void => {
  const options = parseTestRunnerOptions(args);
  prepareCoverage(options.coverageEnabled);

  const nodeArgs = createNodeArgs(options, loaderUrl);
  const env = createTestEnvironment();
  const result = spawnSync(process.execPath, nodeArgs, { env, stdio: "inherit" });

  if (result.error) throw result.error;
  assertCoverageReport(options.coverageEnabled, result.status);
  process.exitCode = result.status ?? 1;
};
