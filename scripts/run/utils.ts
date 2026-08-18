import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { TEST_COVERAGE_ARGS, TEST_COVERAGE_DIR, TEST_COVERAGE_FLAG } from "./constants.ts";
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
};

const createNodeArgs = (options: TestRunnerOptions, loaderUrl: string): string[] => {
  const baseArgs = ["--import", loaderUrl];
  const coverageArgs = options.coverageEnabled ? TEST_COVERAGE_ARGS : [];
  const testArgs = ["--test"].concat(options.testArgs);
  return baseArgs.concat(coverageArgs, testArgs);
};

export const runTests = (args: string[], loaderUrl: string): void => {
  const options = parseTestRunnerOptions(args);
  prepareCoverage(options.coverageEnabled);

  const nodeArgs = createNodeArgs(options, loaderUrl);
  const result = spawnSync(process.execPath, nodeArgs, { stdio: "inherit" });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
};
