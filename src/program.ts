import { readFileSync, writeFileSync, existsSync } from "fs";
import { createLogger, logger } from "./logger";
import { checkFiles } from "./scripts";
import { versionCache } from "./utils/cache";
import { createSpinner } from "./utils/spinner";
import { cyan, bold, green, gray, red } from "./utils/colors";
import { SYMBOLS } from "./utils/symbols";
import { Prompt } from "./utils/prompts";
import { formatValidationErrors, loadConfig, validateConfig } from "./config";
import { parseArgs, showHelp } from "./cli/parser";
import { format } from "./utils/formatters";
import { MANIFEST_FILES } from "./providers/constants";
import { Options, PackageJSON, CodependenceConfig, DependencyInfo } from "./types";

const gradient = (text: string) => bold(cyan(text));
const CLI_ERROR_EXIT_CODE = 2;
const INIT_TYPES = ["rc", "package", "default"] as const;

type InitType = (typeof INIT_TYPES)[number];
type InitInput = InitType | string[];

const isInitType = (value: string | undefined): value is InitType =>
  INIT_TYPES.includes(value as InitType);

const collectInitDeps = (args: string[]): string[] => {
  const flagIndex = args.findIndex((arg) => arg.startsWith("-"));
  const positionalArgs = flagIndex === -1 ? args : args.slice(0, flagIndex);

  return positionalArgs.filter((arg) => !isInitType(arg));
};

const resolveInitDeps = (
  optionDeps: unknown,
  positionalDeps: string[],
): string[] => {
  if (Array.isArray(optionDeps)) return optionDeps as string[];

  return positionalDeps;
};

const validateRequestedInitDeps = (
  requestedDeps: string[],
  allDeps: Record<string, string>,
): void => {
  const missingDeps = requestedDeps.filter((dep) => allDeps[dep] === undefined);
  if (missingDeps.length === 0) return;

  throw new Error(
    `Requested dependencies not found in package.json: ${missingDeps.join(", ")}`,
  );
};

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const internalOptionFields = new Set(["isCLI", "isTesting"]);

const publicConfigOptions = (options: Options): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(options).filter(([key]) => !internalOptionFields.has(key)),
  );

export const mergeConfigs = (
  options: Options,
  baseConfig: Record<string, unknown>,
  pathConfig: Record<string, unknown>,
): Options => {
  const hasPathConfig = Object.keys(pathConfig).length > 0;
  const effectiveBaseConfig = hasPathConfig ? {} : baseConfig;
  const hasCodependenceKey =
    pathConfig?.codependence !== undefined &&
    typeof pathConfig.codependence === "object" &&
    pathConfig.codependence !== null;
  const normalizedPathConfig = hasCodependenceKey
    ? (pathConfig.codependence as Record<string, unknown>)
    : pathConfig;

  const updatedConfig = {
    ...effectiveBaseConfig,
    ...normalizedPathConfig,
    ...options,
    isCLI: true,
  };

  const {
    config: _usedConfig,
    searchPath: _usedSearchPath,
    isTestingCLI: _isTestingCLI,
    isTestingAction: _isTestingAction,
    ...updatedOptions
  } = updatedConfig;

  return updatedOptions as Options;
};

const validateEffectiveConfig = (options: Options): void => {
  const result = validateConfig(publicConfigOptions(options));
  if (result.valid) return;

  throw new Error(`Invalid config\n${formatValidationErrors(result.errors)}`);
};

const loadActionConfigs = (
  options: Options,
): {
  baseConfig: Record<string, unknown>;
  pathConfig: Record<string, unknown>;
} => {
  if (options.config) {
    const configFileResult = loadConfig(options.config);
    if (!configFileResult) throw new Error(`Config file not found: ${options.config}`);
    return { baseConfig: {}, pathConfig: configFileResult.config };
  }

  const result = loadConfig(undefined, options.searchPath);
  if (!result) return { baseConfig: {}, pathConfig: {} };

  return { baseConfig: result.config, pathConfig: {} };
};

export async function action(options: Options = {}): Promise<void | Options> {
  const isVerbose = options.verbose;
  const isDebug = options.debug;
  const isQuiet = options.quiet || false;

  let logLevel: "verbose" | "debug" | "info" = "info";
  if (isVerbose) {
    logLevel = "verbose";
  } else if (isDebug) {
    logLevel = "debug";
  }

  const loggerConfig = {
    level: logLevel,
    silent: isQuiet,
    structured: false,
  };
  const logger = createLogger(loggerConfig);

  const { baseConfig, pathConfig } = loadActionConfigs(options);
  const updatedOptions = mergeConfigs(options, baseConfig, pathConfig);

  const isTestingCLI =
    (options as Record<string, unknown>).isTestingCLI === true;
  const isTestingAction =
    (options as Record<string, unknown>).isTestingAction === true;

  // capture/test CLI options
  if (isTestingCLI) {
    console.info({ updatedOptions });
    return;
  }

  // capture action unit test options
  if (isTestingAction) return updatedOptions;

  let spinner: ReturnType<typeof createSpinner> | null = null;

  try {
    const hasCodependencies =
      Array.isArray(updatedOptions.codependencies) &&
      updatedOptions.codependencies.length > 0;
    const hasNoExplicitMode = !updatedOptions.mode;
    if (hasNoExplicitMode) {
      if (updatedOptions.permissive === true) {
        updatedOptions.mode = "precise";
      } else if (updatedOptions.permissive === false || hasCodependencies) {
        updatedOptions.mode = "verbose";
      } else {
        updatedOptions.mode = "precise";
      }
    }

    validateEffectiveConfig(updatedOptions);

    const isDryRun = updatedOptions.dryRun === true;
    const isWatchMode = updatedOptions.watch === true;

    if (isDryRun) {
      console.log(cyan(`\n${SYMBOLS.info} Dry run - no files will be modified\n`));
    }

    if (isWatchMode) {
      await runWatchMode(updatedOptions);
      return;
    }

    const startTime = Date.now();
    const formatType = updatedOptions.format || "table";
    const shouldUseFormatter = updatedOptions.format !== undefined;

    spinner = !shouldUseFormatter
      ? createSpinner(`🤼‍♀️ ${gradient(`codependence`)} wrestling...\n`).start()
      : null;

    const optionsWithProgress = {
      ...updatedOptions,
      onProgress: (current: number, total: number, packageName: string) => {
        if (spinner) {
          spinner.text = `🤼‍♀️ ${gradient(`codependence`)} checking ${packageName} (${current}/${total})`;
        }
      },
    };

    const diffs = await checkFiles(optionsWithProgress);
    const duration = Date.now() - startTime;

    if (shouldUseFormatter && diffs) {
      const dependencyInfo: DependencyInfo[] = diffs.map((diff) => ({
        name: diff.package,
        current: diff.current,
        latest: diff.latest,
        isPinned: diff.isPinned,
      }));

      const formattedOutput = format(dependencyInfo, formatType, duration);

      if (updatedOptions.outputFile) {
        writeFileSync(updatedOptions.outputFile, formattedOutput);
        console.log(`Output written to ${updatedOptions.outputFile}`);
      } else {
        console.log(formattedOutput);
      }
    } else {
      const successMessage = isDryRun
        ? `🤼‍♀️ ${gradient(`codependence`)} dry run complete!`
        : `🤼‍♀️ ${gradient(`codependence`)} pinned!`;

      if (spinner) {
        spinner.succeed(successMessage);
      }

      const shouldShowMetrics = updatedOptions.verbose === true;
      if (shouldShowMetrics) {
        showPerformanceMetrics(duration);
      }
    }
  } catch (err) {
    spinner?.stop();
    logger.error(errorMessage(err));
    process.exit(CLI_ERROR_EXIT_CODE);
  }
}

export const formatPerformanceMetrics = (
  duration: number,
  stats: { hits: number; misses: number; size: number },
  hitRate: number,
): string[] => {
  const lines: string[] = [];
  lines.push(`\n${SYMBOLS.arrow} Performance:`);
  lines.push(`  ${SYMBOLS.dot} Completed in ${duration}ms`);

  const hasCache = stats.size > 0;
  if (hasCache) {
    lines.push(
      `  ${SYMBOLS.info} Cache: ${stats.hits} hits, ${stats.misses} misses (${hitRate.toFixed(1)}% hit rate)`,
    );
    lines.push(`  ${SYMBOLS.info} ${stats.size} packages cached\n`);
  } else {
    lines.push(`  ${SYMBOLS.info} No cache hits (first run)\n`);
  }

  return lines;
};

const showPerformanceMetrics = (duration: number): void => {
  const stats = versionCache.getStats();
  const hitRate = versionCache.getHitRate();
  const lines = formatPerformanceMetrics(duration, stats, hitRate);
  lines.forEach((line) => console.log(line));
};

const runWatchMode = async (options: Options): Promise<void> => {
  console.log(cyan(`\n${SYMBOLS.info} Watch mode enabled - checking every 30 seconds...\n`));
  console.log(gray("Press Ctrl+C to stop\n"));
  let isChecking = false;

  const checkDependencies = async () => {
    if (isChecking) {
      console.log(gray("Previous check still running, skipping this interval."));
      return;
    }

    isChecking = true;
    const now = new Date().toLocaleTimeString();
    console.log(gray(`\n[${now}] Checking dependencies...`));

    try {
      await checkFiles(options);
      console.log(green(`${SYMBOLS.success} All dependencies checked (${now})`));
    } catch (err) {
      console.error(red(`${SYMBOLS.error} Check failed: ${(err as Error).message}`));
    } finally {
      isChecking = false;
    }
  };

  await checkDependencies();

  setInterval(checkDependencies, 30000);
};

export async function initAction(
  input?: InitInput,
  codependencies: string[] = [],
): Promise<void> {
  const spinner = createSpinner(
    `🤼‍♀️ ${gradient(`codependence`)} initializing...\n`,
  ).start();

  try {
    const hasArrayInput = Array.isArray(input);
    const type = hasArrayInput ? undefined : input;
    const requestedDeps = hasArrayInput ? input : codependencies;
    const rcPath = ".codependencerc";
    const packageJsonPath = MANIFEST_FILES.PACKAGE_JSON;
    const hasConfig = existsSync(rcPath);
    const hasPackageJsonConfig = (() => {
      if (!existsSync(packageJsonPath)) return false;
      try {
        const content = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(content);
        return !!packageJson.codependence;
      } catch {
        return false;
      }
    })();

    if (hasConfig || hasPackageJsonConfig) {
      spinner.stop();
      logger.warn("Codependence configuration already exists. Skipping initialization.");
      return;
    }

    const hasPackageJson = existsSync(packageJsonPath);
    if (!hasPackageJson) {
      throw new Error("package.json not found in the current directory");
    }

    const content = readFileSync(packageJsonPath, "utf8");
    let packageJson: PackageJSON;
    try {
      packageJson = JSON.parse(content) as PackageJSON;
    } catch (parseError) {
      throw new Error(`Invalid JSON in package.json: ${parseError}`);
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    const hasPackageDeps = Object.keys(allDeps).length > 0;
    const shouldRequirePackageDeps = requestedDeps.length === 0;
    if (!hasPackageDeps && shouldRequirePackageDeps) {
      throw new Error("No dependencies found in package.json");
    }

    validateRequestedInitDeps(requestedDeps, allDeps);

    spinner.stop();

    console.log(`\n🤼‍♀️ Welcome to ${gradient("Codependence")} setup!\n`);
    console.log(
      "Codependence helps you manage dependency versions in your project.\n",
    );

    let pinnedDeps: string[] = [];
    let outputType: "rc" | "package" = "rc";
    let usePermissive = true;
    const hasRequestedDeps = requestedDeps.length > 0;

    if (type || hasRequestedDeps) {
      pinnedDeps = hasRequestedDeps ? requestedDeps : Object.keys(allDeps);
      outputType = type === "package" ? "package" : "rc";
      usePermissive = false;
    } else {
      const prompt = new Prompt();
      const managementMode = await prompt.list(
        "How would you like to manage your dependencies?",
        [
          {
            name: `${SYMBOLS.arrow} Permissive mode (recommended) - Update all dependencies to latest, except those you want to pin`,
            value: "permissive",
          },
          {
            name: `${SYMBOLS.pinned} Pin all dependencies - Keep all dependencies at their current versions`,
            value: "all",
          },
        ],
      );

      if (managementMode === "permissive") {
        usePermissive = true;
        console.log(
          `\n${SYMBOLS.bullet} In permissive mode, you'll select dependencies to PIN (keep at current version).`,
        );
        console.log(
          "   All other dependencies will be updated to their latest versions.\n",
        );

        const depChoices = Object.keys(allDeps).map((dep) => {
          const currentVersion = allDeps[dep];
          return {
            name: `${dep} (currently: ${currentVersion})`,
            value: dep,
          };
        });

        const userPinnedDeps = await prompt.checkbox(
          "Select dependencies to PIN at their current versions (others will update to latest):",
          depChoices,
        );
        pinnedDeps = userPinnedDeps;

        if (pinnedDeps.length === 0) {
          console.log(
            `\n${SYMBOLS.success} Great! All dependencies will be updated to latest versions.`,
          );
        }
      } else {
        // Pin all dependencies mode
        usePermissive = false;
        pinnedDeps = Object.keys(allDeps);
        console.log(
          `\n${SYMBOLS.pinned} All dependencies will be pinned at their current versions.`,
        );
      }

      const shouldPromptForOutput =
        pinnedDeps.length > 0 || managementMode === "permissive";
      if (shouldPromptForOutput) {
        const outputLocation = await prompt.list(
          "Where would you like to save the configuration?",
          [
            { name: ".codependencerc (recommended)", value: "rc" },
            { name: MANIFEST_FILES.PACKAGE_JSON, value: "package" },
          ],
        );
        outputType = outputLocation as "rc" | "package";
      }

      prompt.close();
    }

    const hasPinnedDeps = pinnedDeps.length > 0;
    const codependenciesConfig = hasPinnedDeps
      ? { codependencies: pinnedDeps }
      : {};
    const permissiveConfig = usePermissive ? { permissive: true } : {};

    const config: CodependenceConfig = {
      ...codependenciesConfig,
      ...permissiveConfig,
    };

    const spinner2 = createSpinner("Creating configuration...").start();

    if (outputType === "package") {
      const updatedPackageJson = {
        ...packageJson,
        codependence: config,
      };
      writeFileSync(
        packageJsonPath,
        JSON.stringify(updatedPackageJson, null, 2),
      );
      spinner2.succeed("Added codependence configuration to package.json");
    } else {
      writeFileSync(rcPath, JSON.stringify(config, null, 2));
      spinner2.succeed("Created .codependencerc configuration file");
    }

    console.log(`\n🤼‍♀️ ${gradient("Codependence")} setup complete!\n`);

    if (usePermissive) {
      console.log("> Next steps:");
      console.log("   • Run `codependence --update` to update dependencies");
      if (pinnedDeps.length > 0) {
        console.log(
          `   • These dependencies will stay pinned: ${pinnedDeps.join(", ")}`,
        );
      }
      console.log(
        "   • All other dependencies will update to latest versions\n",
      );
    } else {
      console.log("> Next steps:");
      console.log("   • Run `codependence` to check dependency versions");
      console.log("   • Run `codependence --update` to update dependencies\n");
    }
  } catch (err) {
    spinner.stop();
    logger.error((err as Error).message || (err as string).toString());
  }
}

export async function run(args: string[] = process.argv): Promise<void> {
  const parsed = parseArgs(args);

  const isHelpRequested = parsed.options.help === true;
  if (isHelpRequested) {
    showHelp();
    return;
  }

  const isInitCommand = args.includes("init");
  if (isInitCommand) {
    const initType = args.find(isInitType);
    const initIndex = args.indexOf("init");
    const initArgs = args.slice(initIndex + 1);
    const initDeps = collectInitDeps(initArgs);
    const codependencies = resolveInitDeps(parsed.options.codependencies, initDeps);
    await initAction(initType, codependencies);
    return;
  }

  await action(parsed.options as Options);
}
