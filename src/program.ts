import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "node:path";
import { createLogger, logger } from "./logger";
import { assertTargetLockfiles, checkFiles } from "./scripts";
import { versionCache } from "./utils/cache";
import { createSpinner } from "./utils/spinner";
import { cyan, bold, green, gray, red } from "./utils/colors";
import { SYMBOLS } from "./utils/constants";
import { Prompt } from "./utils/prompts";
import { expandTargets, formatValidationErrors, loadConfig, validateConfig } from "./config";
import { parseArgs, showHelp } from "./cli/parser";
import {
  ACTION_MANAGERS,
  ACTION_REF,
  ASSIGNMENT_PATTERN,
  CHECKOUT_REF,
  CRON_SCHEDULE_PATTERN,
  DEFAULT_ACTION_SCHEDULE,
  DEFAULT_TOKEN_SECRET,
  ENVIRONMENT_VERSION_PATTERN,
  EXACT_TOOL_VERSION_PATTERN,
  GENERATED_ACTION_HEADER,
  GO_TOOLCHAIN_VERSION_PATTERN,
  GO_VERSION_PATTERN,
  MANAGER_PLACEHOLDER,
  MISE_VERSION_PATTERN,
  NODE_MANAGERS,
  REGEX_SPECIAL_CHARACTERS_PATTERN,
  TOOL_VERSIONS_VERSION_PATTERN,
  UPPERCASE_IDENTIFIER_PATTERN,
  VERSIONED_MANAGERS,
  WORKFLOW_AREAS,
  WORKFLOW_LABELS,
} from "./cli/constants";
import type {
  InitGitHubActionsOptions,
  RenderWorkflowOptions,
  WorkflowArea,
  WorkflowDefinition,
} from "./cli/types";
import { format } from "./utils/formatters";
import { LANGUAGES, MANIFEST_FILES, PYTHON_PACKAGE_MANAGERS } from "./providers/constants";
import {
  CLI_ERROR_EXIT_CODE,
  INIT_TYPES,
  INTERNAL_OPTION_FIELDS,
  TARGET_OVERRIDE_FIELDS,
} from "./constants";
import {
  ActionConfigs,
  Options,
  PackageJSON,
  CodependenceConfig,
  DependencyInfo,
  CheckFiles,
  InitInput,
  InitType,
  DependencyManager,
  ProgressHandler,
  TargetRunResult,
  CodependenceTarget,
} from "./types";

const gradient = (text: string) => bold(cyan(text));

const isInitType = (value: string | undefined): value is InitType =>
  INIT_TYPES.includes(value as InitType);

const collectInitDeps = (args: string[]): string[] => {
  const flagIndex = args.findIndex((arg) => arg.startsWith("-"));
  const positionalArgs = flagIndex === -1 ? args : args.slice(0, flagIndex);

  return positionalArgs.filter((arg) => !isInitType(arg));
};

const resolveInitDeps = (optionDeps: unknown, positionalDeps: string[]): string[] => {
  if (Array.isArray(optionDeps)) return optionDeps as string[];

  return positionalDeps;
};

const stringListOption = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
};

const stringOption = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const areaForManager = (manager: DependencyManager): WorkflowArea => {
  if (NODE_MANAGERS.has(manager)) return "node";
  if (manager === PYTHON_PACKAGE_MANAGERS.UV) return "python";
  if (manager === LANGUAGES.GO) return "go";
  return "infrastructure";
};

const configuredTargets = (rootDir: string): CodependenceTarget[] => {
  const result = loadConfig(undefined, rootDir);
  if (!result) {
    throw new Error(
      "Codependence configuration not found. Add manager targets before running `codependence init actions`.",
    );
  }

  const targets = result.config.targets;
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error(
      "Codependence configuration must define manager targets before GitHub Actions can be generated.",
    );
  }

  return targets as CodependenceTarget[];
};

const selectManagers = (
  targets: CodependenceTarget[],
  requested: DependencyManager[] = [],
): DependencyManager[] => {
  const configured = [...new Set(targets.map(({ manager }) => manager))];
  const configuredSet = new Set(configured);
  const requestedSet = new Set(requested);
  const selected =
    requested.length > 0 ? configured.filter((manager) => requestedSet.has(manager)) : configured;
  const missing = requested.filter((manager) => !configuredSet.has(manager));

  if (missing.length > 0) {
    throw new Error(`Unknown configured target manager(s): ${missing.join(", ")}`);
  }

  const unsupported = selected.filter((manager) => !ACTION_MANAGERS.has(manager));
  if (unsupported.length > 0) {
    throw new Error(
      `GitHub Action setup does not support target manager(s): ${unsupported.join(", ")}`,
    );
  }

  return selected;
};

const assignment = (value: string, label: string): readonly [string, string] => {
  const match = value.match(ASSIGNMENT_PATTERN);
  if (match) return [match[1], match[2]];

  throw new Error(`${label} must use name=value entries: ${value}`);
};

const parseAssignments = (values: string[] = [], label: string): Map<string, string> =>
  new Map(values.map((value) => assignment(value, label)));

const readFile = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");

const readPackageManagerVersion = (rootDir: string, manager: DependencyManager): string => {
  const content = readFile(join(rootDir, MANIFEST_FILES.PACKAGE_JSON));
  if (!content) return "";

  try {
    const packageJson = JSON.parse(content) as { packageManager?: unknown };
    const packageManager = packageJson.packageManager;
    if (typeof packageManager !== "string") return "";

    const prefix = `${manager}@`;
    return packageManager.startsWith(prefix) ? packageManager.slice(prefix.length) : "";
  } catch {
    return "";
  }
};

const readGoVersion = (rootDir: string): string => {
  const content = readFile(join(rootDir, MANIFEST_FILES.GO_MOD));
  const toolchain = content.match(GO_TOOLCHAIN_VERSION_PATTERN)?.[1];
  if (toolchain) return toolchain;

  return content.match(GO_VERSION_PATTERN)?.[1] || "";
};

const escapedPattern = (value: string): string =>
  value.replace(REGEX_SPECIAL_CHARACTERS_PATTERN, "\\$&");

const managerVersionPattern = (pattern: string, manager: string): RegExp => {
  const managerPattern = escapedPattern(manager);
  return new RegExp(pattern.replace(MANAGER_PLACEHOLDER, managerPattern), "m");
};

const readMiseVersion = (rootDir: string, manager: DependencyManager): string => {
  const pattern = managerVersionPattern(MISE_VERSION_PATTERN, manager);
  const standard = readFile(join(rootDir, "mise.toml")).match(pattern)?.[1];
  if (standard) return standard;

  return readFile(join(rootDir, ".mise.toml")).match(pattern)?.[1] || "";
};

const readToolVersionsVersion = (rootDir: string, manager: DependencyManager): string => {
  const content = readFile(join(rootDir, ".tool-versions"));
  const pattern = managerVersionPattern(TOOL_VERSIONS_VERSION_PATTERN, manager);
  return content.match(pattern)?.[1] || "";
};

const readEnvironmentVersion = (rootDir: string, manager: DependencyManager): string => {
  const content = readFile(join(rootDir, "versions.env"));
  const key = `${manager.replaceAll("-", "_").toUpperCase()}_VERSION`;
  const pattern = managerVersionPattern(ENVIRONMENT_VERSION_PATTERN, key);
  return content.match(pattern)?.[1] || "";
};

const targetRoots = (
  rootDir: string,
  targets: CodependenceTarget[],
): Map<DependencyManager, string> =>
  new Map(targets.map((target) => [target.manager, resolve(rootDir, target.rootDir || ".")]));

const metadataVersion = (rootDir: string, manager: DependencyManager): string =>
  readMiseVersion(rootDir, manager) ||
  readToolVersionsVersion(rootDir, manager) ||
  readEnvironmentVersion(rootDir, manager);

const detectedVersion = (
  rootDir: string,
  targetDir: string,
  manager: DependencyManager,
): string => {
  const packageManagerVersion = NODE_MANAGERS.has(manager)
    ? readPackageManagerVersion(targetDir, manager)
    : "";
  const goVersion = manager === LANGUAGES.GO ? readGoVersion(targetDir) : "";
  const targetMetadataVersion = metadataVersion(targetDir, manager);
  const rootMetadataVersion = targetDir === rootDir ? "" : metadataVersion(rootDir, manager);

  return packageManagerVersion || goVersion || targetMetadataVersion || rootMetadataVersion;
};

const exactVersion = (manager: DependencyManager, version: string): string => {
  const isExact = EXACT_TOOL_VERSION_PATTERN.test(version);
  if (isExact) return version;

  throw new Error(`${manager} requires an exact tool version, received: ${version}`);
};

const resolveVersion = (
  rootDir: string,
  manager: DependencyManager,
  roots: Map<DependencyManager, string>,
  overrides: Map<string, string>,
): string => {
  const targetDir = roots.get(manager) || rootDir;
  const version = overrides.get(manager) || detectedVersion(rootDir, targetDir, manager);
  return version ? exactVersion(manager, version) : "";
};

const resolveVersions = (
  rootDir: string,
  targets: CodependenceTarget[],
  managers: DependencyManager[],
  overrides: Map<string, string>,
): Map<DependencyManager, string> => {
  const roots = targetRoots(rootDir, targets);
  const versioned = managers.filter((manager) => VERSIONED_MANAGERS.has(manager));
  const entries = versioned.map(
    (manager) => [manager, resolveVersion(rootDir, manager, roots, overrides)] as const,
  );
  const missing = entries.filter(([, version]) => !version).map(([manager]) => manager);

  if (missing.length > 0) {
    const examples = missing.map((manager) => `${manager}=<version>`).join(" ");
    throw new Error(
      `Missing exact tool version for: ${missing.join(", ")}. Pass --version ${examples}.`,
    );
  }

  return new Map(entries);
};

const groupedManagers = (managers: DependencyManager[]): Map<WorkflowArea, DependencyManager[]> =>
  managers.reduce((groups, manager) => {
    const area = areaForManager(manager);
    const values = groups.get(area) || [];
    groups.set(area, values.concat(manager));
    return groups;
  }, new Map<WorkflowArea, DependencyManager[]>());

const workflowDefinitions = (
  managers: DependencyManager[],
  schedules: Map<string, string>,
): WorkflowDefinition[] => {
  const groups = groupedManagers(managers);

  return WORKFLOW_AREAS.flatMap((area) => {
    const areaManagers = groups.get(area);
    if (!areaManagers) return [];

    return [
      {
        area,
        label: WORKFLOW_LABELS[area],
        managers: areaManagers,
        schedule: schedules.get(area) || DEFAULT_ACTION_SCHEDULE,
      },
    ];
  });
};

const defaultManagerCommand = (manager: DependencyManager): string => {
  if (NODE_MANAGERS.has(manager)) return `${manager} install`;
  if (manager === PYTHON_PACKAGE_MANAGERS.UV) return "uv lock";
  if (manager === LANGUAGES.GO) return "go mod tidy";
  return "git diff --check";
};

const postUpdateCommand = (
  definition: WorkflowDefinition,
  overrides: Map<string, string>,
): string => {
  const areaOverride = overrides.get(definition.area);
  if (areaOverride) return areaOverride;

  const commands = definition.managers.map(
    (manager) => overrides.get(manager) || defaultManagerCommand(manager),
  );
  return [...new Set(commands)].join(" && ");
};

const yamlString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const yamlListInput = (name: string, values: string[]): string => {
  if (values.length === 1) return `          ${name}: ${values[0]}`;

  const lines = values.map((value) => `            ${value}`).join("\n");
  return `          ${name}: |\n${lines}`;
};

const versionInput = (
  managers: DependencyManager[],
  versions: Map<DependencyManager, string>,
): string => {
  const versioned = managers.filter((manager) => versions.has(manager));
  if (versioned.length === 0) return "";
  if (versioned.length === 1) {
    return `\n          version: ${versions.get(versioned[0])}`;
  }

  const assignments = versioned.map((manager) => `${manager}=${versions.get(manager)}`);
  return `\n${yamlListInput("version", assignments)}`;
};

const renderWorkflow = (options: RenderWorkflowOptions): string => {
  const targetInput = yamlListInput("targets", options.managers);
  const toolVersions = versionInput(options.managers, options.versions);
  const command = yamlString(options.postUpdateCommand);
  const secretExpression = ["$", `{{ secrets.${options.tokenSecret} }}`].join("");

  return `${GENERATED_ACTION_HEADER}
name: Codependence ${options.label} updates

on:
  schedule:
    - cron: "${options.schedule}"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: ${CHECKOUT_REF}
        with:
          persist-credentials: false

      - uses: ${ACTION_REF}
        with:
${targetInput}${toolVersions}
          pull-request: true
          token: ${secretExpression}
          post-update-command: ${command}
`;
};

const workflowPath = (rootDir: string, area: WorkflowArea): string =>
  join(rootDir, ".github", "workflows", `codependence-${area}.yml`);

const assertSafeWrites = (rootDir: string, paths: string[], force: boolean): void => {
  if (force) return;

  const existing = paths.filter(existsSync);
  if (existing.length === 0) return;

  const names = existing.map((path) => relative(rootDir, path));
  throw new Error(
    `Refusing to overwrite existing workflow(s): ${names.join(", ")}. Pass --force to replace them.`,
  );
};

const tokenSecret = (value = DEFAULT_TOKEN_SECRET): string => {
  if (UPPERCASE_IDENTIFIER_PATTERN.test(value)) return value;

  throw new Error(`Invalid GitHub secret name: ${value}`);
};

const assertAssignmentKeys = (
  assignments: Map<string, string>,
  allowed: Set<string>,
  label: string,
): void => {
  const unknown = [...assignments.keys()].filter((key) => !allowed.has(key));
  if (unknown.length === 0) return;

  throw new Error(`Unknown ${label}: ${unknown.join(", ")}`);
};

const assertSchedules = (schedules: Map<string, string>): void => {
  const invalid = [...schedules.entries()]
    .filter(([, value]) => !CRON_SCHEDULE_PATTERN.test(value))
    .map(([area]) => area);
  if (invalid.length === 0) return;

  throw new Error(`Invalid cron schedule for: ${invalid.join(", ")}`);
};

const writeWorkflows = (
  rootDir: string,
  definitions: WorkflowDefinition[],
  versions: Map<DependencyManager, string>,
  commands: Map<string, string>,
  secretName: string,
): void => {
  mkdirSync(join(rootDir, ".github", "workflows"), { recursive: true });
  definitions.forEach((definition) => {
    const workflow = renderWorkflow({
      ...definition,
      postUpdateCommand: postUpdateCommand(definition, commands),
      tokenSecret: secretName,
      versions,
    });
    writeFileSync(workflowPath(rootDir, definition.area), workflow);
  });
};

export const initGitHubActions = (options: InitGitHubActionsOptions = {}): string[] => {
  const rootDir = resolve(options.rootDir || process.cwd());
  const targets = configuredTargets(rootDir);
  const managers = selectManagers(targets, options.targets);
  const versionsInput = parseAssignments(options.versions, "Versions");
  const commands = parseAssignments(options.postUpdateCommands, "Post-update commands");
  const schedules = parseAssignments(options.schedules, "Schedules");
  const areas = new Set(managers.map(areaForManager));
  const managerNames = new Set<string>(managers);
  const commandKeys = new Set<string>([...managerNames, ...areas]);

  assertAssignmentKeys(versionsInput, managerNames, "version manager(s)");
  assertAssignmentKeys(commands, commandKeys, "post-update command target(s)");
  assertAssignmentKeys(schedules, areas, "schedule area(s)");
  assertSchedules(schedules);

  const versions = resolveVersions(rootDir, targets, managers, versionsInput);
  const definitions = workflowDefinitions(managers, schedules);
  const paths = definitions.map(({ area }) => workflowPath(rootDir, area));
  assertSafeWrites(rootDir, paths, options.force === true);
  writeWorkflows(rootDir, definitions, versions, commands, tokenSecret(options.tokenSecret));
  return paths;
};

const initActions = (options: Record<string, unknown>, positionalTargets: string[]): void => {
  const requestedTargets = stringListOption(options.target);
  const targets = requestedTargets.length > 0 ? requestedTargets : positionalTargets;
  const paths = initGitHubActions({
    force: options.force === true,
    postUpdateCommands: stringListOption(options.postUpdateCommand),
    rootDir: stringOption(options.rootDir),
    schedules: stringListOption(options.schedule),
    targets: targets as DependencyManager[],
    tokenSecret: stringOption(options.tokenSecret),
    versions: stringListOption(options.version),
  });

  paths.forEach((path) => logger.info(`Created ${path}`));
};

const validateRequestedInitDeps = (
  requestedDeps: string[],
  allDeps: Record<string, string>,
): void => {
  const missingDeps = requestedDeps.filter((dep) => allDeps[dep] === undefined);
  if (missingDeps.length === 0) return;

  throw new Error(`Requested dependencies not found in package.json: ${missingDeps.join(", ")}`);
};

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const publicConfigOptions = (options: Options): Record<string, unknown> =>
  Object.fromEntries(Object.entries(options).filter(([key]) => !INTERNAL_OPTION_FIELDS.has(key)));

const omitOverriddenTargets = (
  config: Record<string, unknown>,
  options: Options,
): Record<string, unknown> => {
  const hasTargetOverride = TARGET_OVERRIDE_FIELDS.some((field) => options[field] !== undefined);
  if (!hasTargetOverride) return config;

  const { targets: _targets, ...flatConfig } = config;
  return flatConfig;
};

export const mergeConfigs = (
  options: Options,
  baseConfig: Record<string, unknown>,
  pathConfig: Record<string, unknown>,
): Options => {
  const hasPathConfig = Object.keys(pathConfig).length > 0;
  const selectedBaseConfig = hasPathConfig ? {} : baseConfig;
  const hasCodependenceKey =
    pathConfig?.codependence !== undefined &&
    typeof pathConfig.codependence === "object" &&
    pathConfig.codependence !== null;
  const normalizedPathConfig = hasCodependenceKey
    ? (pathConfig.codependence as Record<string, unknown>)
    : pathConfig;
  const effectiveBaseConfig = omitOverriddenTargets(selectedBaseConfig, options);
  const effectivePathConfig = omitOverriddenTargets(normalizedPathConfig, options);

  const updatedConfig = {
    ...effectiveBaseConfig,
    ...effectivePathConfig,
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

const withDefaultMode = (options: Options): Options => {
  if (options.targets || options.mode) return options;

  const hasCodependencies = Boolean(options.codependencies?.length);
  if (options.permissive === true) return { ...options, mode: "precise" };
  if (options.permissive === false || hasCodependencies) {
    return { ...options, mode: "verbose" };
  }

  return { ...options, mode: "precise" };
};

const runTarget = async (
  result: TargetRunResult,
  options: CheckFiles,
  onProgress: ProgressHandler,
  deferFailure: boolean,
): Promise<TargetRunResult> => {
  let targetFailed = false;
  const onDeferredFailure = () => {
    targetFailed = true;
  };
  const diffs = await checkFiles({
    ...options,
    onProgress,
    deferFailure,
    onDeferredFailure,
  });
  const allDiffs = diffs ? [...result.diffs, ...diffs] : result.diffs;
  const failed = result.failed || targetFailed;
  return { diffs: allDiffs, failed };
};

const runTargets = (
  targets: CheckFiles[],
  onProgress: ProgressHandler,
): Promise<TargetRunResult> => {
  const deferFailure = targets.length > 1;
  return targets.reduce(
    async (result, target) => runTarget(await result, target, onProgress, deferFailure),
    Promise.resolve<TargetRunResult>({ diffs: [], failed: false }),
  );
};

const loadActionConfigs = (options: Options): ActionConfigs => {
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
  const mergedOptions = mergeConfigs(options, baseConfig, pathConfig);

  const isTestingCLI = (options as Record<string, unknown>).isTestingCLI === true;
  const isTestingAction = (options as Record<string, unknown>).isTestingAction === true;

  // capture/test CLI options
  if (isTestingCLI) {
    console.info({ updatedOptions: mergedOptions });
    return;
  }

  // capture action unit test options
  if (isTestingAction) return mergedOptions;

  let spinner: ReturnType<typeof createSpinner> | null = null;

  try {
    const updatedOptions = withDefaultMode(mergedOptions);
    validateEffectiveConfig(updatedOptions);
    const targets = expandTargets(updatedOptions);
    targets.forEach(assertTargetLockfiles);

    const isDryRun = updatedOptions.dryRun === true;
    const isWatchMode = updatedOptions.watch === true;

    if (isDryRun) {
      console.log(cyan(`\n${SYMBOLS.info} Dry run - no files will be modified\n`));
    }

    if (isWatchMode) {
      await runWatchMode(targets);
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

    const { diffs, failed } = await runTargets(targets, optionsWithProgress.onProgress);
    const duration = Date.now() - startTime;

    if (shouldUseFormatter) {
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
      const failureMessage = `${gradient(`codependence`)} found dependency issues.`;

      if (spinner) {
        if (failed) spinner.fail(failureMessage);
        else spinner.succeed(successMessage);
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

const runWatchMode = async (targets: CheckFiles[]): Promise<void> => {
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
      const { failed } = await runTargets(targets, () => {});
      if (failed) {
        console.error(red(`${SYMBOLS.error} Dependency issues found (${now})`));
        return;
      }
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

export async function initAction(input?: InitInput, codependencies: string[] = []): Promise<void> {
  const spinner = createSpinner(`🤼‍♀️ ${gradient(`codependence`)} initializing...\n`).start();

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
    console.log("Codependence helps you manage dependency versions in your project.\n");

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
      const managementMode = await prompt.list("How would you like to manage your dependencies?", [
        {
          name: `${SYMBOLS.arrow} Permissive mode (recommended) - Update all dependencies to latest, except those you want to pin`,
          value: "permissive",
        },
        {
          name: `${SYMBOLS.pinned} Pin all dependencies - Keep all dependencies at their current versions`,
          value: "all",
        },
      ]);

      if (managementMode === "permissive") {
        usePermissive = true;
        console.log(
          `\n${SYMBOLS.bullet} In permissive mode, you'll select dependencies to PIN (keep at current version).`,
        );
        console.log("   All other dependencies will be updated to their latest versions.\n");

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

      const shouldPromptForOutput = pinnedDeps.length > 0 || managementMode === "permissive";
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
    const codependenciesConfig = hasPinnedDeps ? { codependencies: pinnedDeps } : {};
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
      writeFileSync(packageJsonPath, JSON.stringify(updatedPackageJson, null, 2));
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
        console.log(`   • These dependencies will stay pinned: ${pinnedDeps.join(", ")}`);
      }
      console.log("   • All other dependencies will update to latest versions\n");
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
    if (initType === "actions") {
      initActions(parsed.options, initDeps);
      return;
    }

    const codependencies = resolveInitDeps(parsed.options.codependencies, initDeps);
    await initAction(initType, codependencies);
    return;
  }

  await action(parsed.options as Options);
}
