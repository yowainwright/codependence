import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NUB_PRELOAD_OPTION_PATTERN,
  TEST_COVERAGE_ARGS,
  TEST_COVERAGE_DIR,
  TEST_COVERAGE_EXCLUDE,
  TEST_COVERAGE_FLAG,
  TEST_COVERAGE_INCLUDE,
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

const createCoverageArgs = (loaderUrl: string): string[] => {
  const root = fileURLToPath(new URL("../../", loaderUrl));
  const include = `--test-coverage-include=${coverageGlob(root, TEST_COVERAGE_INCLUDE)}`;
  const exclude = `--test-coverage-exclude=${coverageGlob(root, TEST_COVERAGE_EXCLUDE)}`;
  return TEST_COVERAGE_ARGS.concat(include, exclude);
};

const createNodeArgs = (options: TestRunnerOptions, loaderUrl: string): string[] => {
  const baseArgs = ["--import", loaderUrl];
  const coverageArgs = options.coverageEnabled ? createCoverageArgs(loaderUrl) : [];
  const testArgs = ["--test"].concat(options.testArgs);
  return baseArgs.concat(coverageArgs, testArgs);
};

const createTestEnvironment = (coverageEnabled: boolean): NodeJS.ProcessEnv => {
  const nodeOptions = process.env.NODE_OPTIONS;
  const usesNativeTypeScript = Boolean(process.features.typescript);
  if (!coverageEnabled || !nodeOptions || !usesNativeTypeScript) return process.env;

  const filteredOptions = nodeOptions.replace(NUB_PRELOAD_OPTION_PATTERN, "").trim();
  return { ...process.env, NODE_OPTIONS: filteredOptions };
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
  const env = createTestEnvironment(options.coverageEnabled);
  const result = spawnSync(process.execPath, nodeArgs, { env, stdio: "inherit" });

  if (result.error) throw result.error;
  assertCoverageReport(options.coverageEnabled, result.status);
  process.exitCode = result.status ?? 1;
};
