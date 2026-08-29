#!/usr/bin/env node
import fs from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, logger } from "../observability";
import { checkFiles } from "../manifest";
import { versionCache } from "../manifest";
import {
  createSpinner,
  cyan,
  formatCliLegend,
  formatCliStyleguide,
  glimmer,
  gradient,
  gray,
  green,
  red,
  shortStatus,
  type Spinner,
} from "../dx/output";
import { CLI_STYLEGUIDE_LOADER_INTERVAL_MS } from "../dx/output/constants";
import { SYMBOLS } from "../dx/report/constants";
import { Prompt } from "../dx";
import { exec } from "../utils/process";
import { glob } from "../utils/fs";
import { DEFAULT_IGNORE_PATTERNS } from "../manifest/constants";
import {
  expandTargets,
  CONFIG_FILES,
  formatValidationErrors,
  loadConfig,
  normalizeConfigShape,
  validateConfig,
} from "../config";
import { normalizeBinaryArgv, parseArgs, showHelp } from "./utils";
import {
  analyzeOnboardingProject,
  createOnboardingSetup,
  onboardingError,
  parseOnboardingRepository,
} from "./init";
import type {
  OnboardingAnswers,
  OnboardingEnforcement,
  OnboardingMode,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSetup,
  OnboardingSourceFile,
} from "./init";
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
  GO_MINOR_VERSION_PATTERN,
  GO_TOOLCHAIN_VERSION_PATTERN,
  GO_VERSION_PATTERN,
  MANAGER_PLACEHOLDER,
  MISE_VERSION_PATTERN,
  NODE_MANAGERS,
  REGEX_SPECIAL_CHARACTERS_PATTERN,
  RUST_TOOLCHAIN_CHANNEL_PATTERN,
  RUST_TOOLCHAIN_VERSION_PATTERN,
  TOOL_VERSIONS_VERSION_PATTERN,
  UPPERCASE_IDENTIFIER_PATTERN,
  VERSIONED_MANAGERS,
  WORKFLOW_AREAS,
  WORKFLOW_LABELS,
} from "./constants";
import {
  ONBOARDING_CONFIG_PATH,
  ONBOARDING_PNPM_WORKSPACE_FILE,
  ONBOARDING_SCAN_IGNORE_PATTERNS,
  ONBOARDING_SOURCE_PATTERNS,
} from "./init/constants";
import type {
  InitGitHubActionsOptions,
  RenderWorkflowOptions,
  WorkflowArea,
  WorkflowDefinition,
} from "./types";
import { format } from "../dx/report";
import { LANGUAGES, MANIFEST_FILES, PYTHON_PACKAGE_MANAGERS } from "../providers/constants";
import {
  CLI_ERROR_EXIT_CODE,
  INIT_TYPES,
  INTERNAL_OPTION_FIELDS,
  TARGET_OVERRIDE_FIELDS,
} from "../constants";
import type {
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
} from "../types";
import type { BinaryArgv } from "./types";

export { configureBinaryHost } from "./utils";

export const programDependencies = { checkFiles, exec, loadConfig };

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
  if (typeof value === "string") return [value];
  return [];
};

const stringOption = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const suppressOutput = (options: { quiet?: unknown; silent?: unknown }): boolean =>
  Boolean(options.quiet) || Boolean(options.silent);

const isCiOutput = (): boolean => Boolean(process.env.CI || process.env.GITHUB_ACTIONS);

const isPackageScriptOutput = (): boolean => Boolean(process.env.npm_lifecycle_event);

const shouldUseStatusSpinner = (shouldShowStatus: boolean): boolean => {
  if (!shouldShowStatus) return false;
  if (isCiOutput()) return false;

  const hasTty = Boolean(process.stdout.isTTY);
  if (hasTty) return true;

  return isPackageScriptOutput();
};

const styleguideLoaderText = (frameIndex: number): string => {
  return `🤼‍♀️ ${glimmer("codependence", { frameIndex })} wrestling...`;
};

const waitForExitSignal = (): Promise<void> =>
  new Promise((resolveExit) => {
    const cleanup = (): void => {
      process.off("SIGINT", cleanup);
      process.off("SIGTERM", cleanup);
      resolveExit();
    };
    process.once("SIGINT", cleanup);
    process.once("SIGTERM", cleanup);
  });

const shouldLoopStyleguideLoader = (): boolean => {
  if (!shouldUseStatusSpinner(true)) return false;
  return isDirectExecution(process.argv);
};

const startStyleguideShimmerLoop = (spinner: Spinner): NodeJS.Timeout => {
  let frameIndex = 1;
  const interval = setInterval(() => {
    frameIndex += 1;
    spinner.text = styleguideLoaderText(frameIndex);
  }, CLI_STYLEGUIDE_LOADER_INTERVAL_MS);
  return interval;
};

const loopStyleguideLoader = async (): Promise<void> => {
  if (!shouldLoopStyleguideLoader()) return;

  const spinner = createSpinner(styleguideLoaderText(1), { interactive: true }).start();
  const shimmerInterval = startStyleguideShimmerLoop(spinner);
  await waitForExitSignal();
  clearInterval(shimmerInterval);
  spinner.stop();
};

const isOnboardingMode = (value: string | undefined): value is OnboardingMode =>
  value === "verbose" || value === "precise";

const isOnboardingEnforcement = (value: string | undefined): value is OnboardingEnforcement => {
  if (value === "local") return true;
  if (value === "github") return true;
  return value === "both";
};

const readOnboardingFile = (rootDir: string, path: string): OnboardingSourceFile => ({
  path,
  content: fs.readFileSync(join(rootDir, path), "utf8"),
});

const onboardingRootFiles = (rootDir: string): OnboardingSourceFile[] =>
  fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(({ name }) => {
      if (name === ONBOARDING_PNPM_WORKSPACE_FILE) return readOnboardingFile(rootDir, name);
      return { path: name, content: "" };
    });

const onboardingManifestFiles = (rootDir: string): OnboardingSourceFile[] => {
  const paths = glob(ONBOARDING_SOURCE_PATTERNS, {
    cwd: rootDir,
    ignore: DEFAULT_IGNORE_PATTERNS.concat(ONBOARDING_SCAN_IGNORE_PATTERNS),
  });
  return paths.map((path) => readOnboardingFile(rootDir, path));
};

const collectOnboardingFiles = (rootDir: string): OnboardingSourceFile[] => {
  const rootEntries = onboardingRootFiles(rootDir).map((file) => [file.path, file] as const);
  const manifestEntries = onboardingManifestFiles(rootDir).map((file) => [file.path, file] as const);
  return Array.from(new Map(rootEntries.concat(manifestEntries)).values());
};

const selectOnboardingMode = async (
  prompt: Prompt,
  options: Record<string, unknown>,
): Promise<OnboardingMode> => {
  const configured = stringOption(options.mode);
  if (isOnboardingMode(configured)) return configured;
  const isNonInteractive = Boolean(options.nonInteractive);
  if (isNonInteractive) throw new Error("Onboarding requires --mode");
  const selected = await prompt.radio("How should Codependence manage dependencies?", [
    { name: "Update everything except selected pinned dependencies", value: "precise" },
    { name: "Update only selected dependencies", value: "verbose" },
  ]);
  return selected as OnboardingMode;
};

const dependencyChoice = ({ name, usages }: OnboardingProject["dependencies"][number]) => {
  const locations = usages.map(({ path, range }) => `${path}: ${range}`).join(", ");
  return { name: `${name} (${locations})`, value: name };
};

const selectOnboardingDependencies = (
  prompt: Prompt,
  project: OnboardingProject,
  options: Record<string, unknown>,
): Promise<string[]> => {
  if (options.codependencies !== undefined) {
    return Promise.resolve(stringListOption(options.codependencies));
  }
  if (project.dependencies.length === 0) return Promise.resolve([]);
  const isNonInteractive = Boolean(options.nonInteractive);
  if (isNonInteractive) return Promise.resolve([]);
  const choices = project.dependencies.map(dependencyChoice);
  return prompt.select("Select dependencies for this policy", choices);
};

const selectOnboardingEnforcement = async (
  prompt: Prompt,
  options: Record<string, unknown>,
): Promise<OnboardingEnforcement> => {
  const configured = stringOption(options.enforcement);
  if (isOnboardingEnforcement(configured)) return configured;
  const isNonInteractive = Boolean(options.nonInteractive);
  if (isNonInteractive) throw new Error("Onboarding requires --enforcement");
  const selected = await prompt.radio("Where should Codependence run?", [
    { name: "Locally and in GitHub Actions", value: "both" },
    { name: "GitHub Actions", value: "github" },
    { name: "Local CLI", value: "local" },
  ]);
  return selected as OnboardingEnforcement;
};

const selectOnboardingRepository = async (
  prompt: Prompt,
  enforcement: OnboardingEnforcement,
  options: Record<string, unknown>,
): Promise<OnboardingRepository | undefined> => {
  if (enforcement === "local") return undefined;
  const configured = stringOption(options.repository);
  if (configured) return parseOnboardingRepository(configured);
  const isNonInteractive = Boolean(options.nonInteractive);
  if (isNonInteractive) throw new Error("GitHub onboarding requires --repository");
  const answer = await prompt.input("GitHub repository (owner/name)");
  return parseOnboardingRepository(answer);
};

const onboardingVersionOption = (
  manager: DependencyManager,
  value: unknown,
): string | undefined => {
  const values = stringListOption(value);
  const assignment = values.find((item) => item.startsWith(`${manager}=`));
  if (assignment) return assignment.slice(manager.length + 1);
  const hasSingleUnassignedValue = values.length === 1 && !values[0].includes("=");
  if (hasSingleUnassignedValue) return values[0];
  return undefined;
};

const ensureOnboardingVersion = async (
  prompt: Prompt,
  project: OnboardingProject,
  enforcement: OnboardingEnforcement,
  options: Record<string, unknown>,
): Promise<OnboardingProject> => {
  const shouldKeepProject = !project.manager || Boolean(project.managerVersion) || enforcement === "local";
  if (shouldKeepProject) return project;
  const configured = onboardingVersionOption(project.manager, options.version);
  if (configured) return Object.assign({}, project, { managerVersion: configured });
  const isNonInteractive = Boolean(options.nonInteractive);
  if (isNonInteractive) throw new Error("GitHub onboarding requires --version");
  const managerVersion = await prompt.input(`Exact ${project.manager} version`);
  return Object.assign({}, project, { managerVersion });
};

const collectOnboardingAnswers = async (
  prompt: Prompt,
  project: OnboardingProject,
  options: Record<string, unknown>,
): Promise<OnboardingAnswers> => {
  const mode = await selectOnboardingMode(prompt, options);
  const selectedDependencies = await selectOnboardingDependencies(prompt, project, options);
  const enforcement = await selectOnboardingEnforcement(prompt, options);
  const repository = await selectOnboardingRepository(prompt, enforcement, options);
  return { mode, selectedDependencies, enforcement, repository };
};

const packageConfigArtifact = (
  rootDir: string,
  codependence: Record<string, unknown> | string,
): OnboardingSetup["artifacts"][number] => {
  const path = MANIFEST_FILES.PACKAGE_JSON;
  const packageJson = JSON.parse(fs.readFileSync(join(rootDir, path), "utf8"));
  const updatedPackage = Object.assign({}, packageJson, { codependence });
  const content = `${JSON.stringify(updatedPackage, null, 2)}\n`;
  return { path, content };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  const isObject = typeof value === "object" && value !== null;
  if (!isObject) return false;
  return !Array.isArray(value);
};

const manifestPath = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const path = value.path;
  const hasPath = typeof path === "string";
  if (hasPath) return path;
  return undefined;
};

const mergeManifest = (existing: unknown, generated: unknown): Record<string, unknown> => {
  if (!isRecord(generated)) return {};
  if (!isRecord(existing)) return generated;
  const { codependencies: _codependencies, permissive: _permissive, ...preserved } = existing;
  return Object.assign({}, preserved, generated);
};

const mergeManifestConfigs = (
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> => {
  const idsByPath = new Map(
    Object.entries(existing)
      .map(([id, value]) => [manifestPath(value), id] as const)
      .filter(([path]) => path !== undefined),
  );
  return Object.entries(generated).reduce((entries, [generatedId, value]) => {
    const path = manifestPath(value);
    const id = (path && idsByPath.get(path)) || generatedId;
    const entry = mergeManifest(entries[id], value);
    return Object.assign({}, entries, { [id]: entry });
  }, existing);
};

const hasFlatPolicy = (config: Record<string, unknown>): boolean => {
  if ("targets" in config) return true;
  return TARGET_OVERRIDE_FIELDS.some((field) => field in config);
};

const mergeOnboardingConfig = (
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> => {
  const existingEntries = existing.config;
  const generatedEntries = generated.config;
  if (!isRecord(generatedEntries)) throw new Error("Generated configuration is invalid");
  const canMergeFlatConfig = existingEntries === undefined && !hasFlatPolicy(existing);
  if (canMergeFlatConfig) {
    return Object.assign({}, existing, generated);
  }
  if (!isRecord(existingEntries)) {
    throw new Error("Init cannot safely replace a flat or targets configuration");
  }
  const config = mergeManifestConfigs(existingEntries, generatedEntries);
  return Object.assign({}, existing, { config });
};

const configContent = (config: Record<string, unknown>): string =>
  `${JSON.stringify(config, null, 2)}\n`;

const assertLoadedConfig = (config: Record<string, unknown>): void => {
  if (!("config" in config)) return;
  assertValidConfig(config);
};

const assertValidConfig = (config: Record<string, unknown>): void => {
  const result = validateConfig(config, { requirePolicy: false });
  if (result.valid) return;
  throw new Error(`Invalid config\n${formatValidationErrors(result.errors)}`);
};

const existingConfigArtifacts = (
  rootDir: string,
  content: string,
): OnboardingSetup["artifacts"] | undefined => {
  const result = CONFIG_FILES.reduce<ReturnType<typeof loadConfig>>(
    (found, filename) => found || programDependencies.loadConfig(join(rootDir, filename)),
    null,
  );
  if (!result) return undefined;
  assertLoadedConfig(result.config);

  const path = relative(rootDir, result.filepath);
  if (path.startsWith("..")) throw new Error("Init only updates configuration in its directory");
  const generated = JSON.parse(content) as Record<string, unknown>;
  const merged = mergeOnboardingConfig(result.config, generated);
  if (path !== MANIFEST_FILES.PACKAGE_JSON) return [{ path, content: configContent(merged) }];
  return [packageConfigArtifact(rootDir, merged)];
};

const newConfigArtifacts = (
  rootDir: string,
  project: OnboardingProject,
  content: string,
): OnboardingSetup["artifacts"] => {
  const hasPackageJson = fs.existsSync(join(rootDir, MANIFEST_FILES.PACKAGE_JSON));
  const hasSingleNodeManifest =
    project.manifests.length === 1 && project.manifests[0].path === MANIFEST_FILES.PACKAGE_JSON;
  if (hasSingleNodeManifest) {
    return [packageConfigArtifact(rootDir, JSON.parse(content))];
  }

  const config = { path: ONBOARDING_CONFIG_PATH, content };
  if (!hasPackageJson) return [config];
  const pointer = `./${ONBOARDING_CONFIG_PATH}`;
  const packageJson = packageConfigArtifact(rootDir, pointer);
  return [packageJson, config];
};

const prepareOnboardingSetup = (
  rootDir: string,
  project: OnboardingProject,
  setup: OnboardingSetup,
): OnboardingSetup => {
  const config = setup.artifacts.find(({ path }) => path === ONBOARDING_CONFIG_PATH);
  if (!config) return setup;

  const workflows = setup.artifacts.filter(({ path }) => path !== ONBOARDING_CONFIG_PATH);
  const existing = existingConfigArtifacts(rootDir, config.content);
  const configArtifacts = existing || newConfigArtifacts(rootDir, project, config.content);
  return Object.assign({}, setup, { artifacts: configArtifacts.concat(workflows) });
};

const assertOnboardingWrites = (rootDir: string, setup: OnboardingSetup, force: boolean): void => {
  if (force) return;
  const workflows = setup.artifacts.filter(({ path }) => path.startsWith(".github/workflows/"));
  const existing = workflows.filter(({ path }) => fs.existsSync(join(rootDir, path)));
  if (existing.length === 0) return;
  throw new Error(
    `Refusing to overwrite onboarding files: ${existing.map(({ path }) => path).join(", ")}`,
  );
};

const writeOnboardingArtifacts = (rootDir: string, setup: OnboardingSetup): void => {
  setup.artifacts.forEach(({ path, content }) => {
    const destination = join(rootDir, path);
    fs.mkdirSync(dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  });
};

const snapshotOnboardingArtifacts = (rootDir: string, artifacts: OnboardingSetup["artifacts"]) =>
  artifacts.map(({ path }) => {
    const destination = join(rootDir, path);
    const content = fs.existsSync(destination) ? fs.readFileSync(destination, "utf8") : undefined;
    return { path, content };
  });

const restoreOnboardingArtifacts = (
  rootDir: string,
  snapshots: ReturnType<typeof snapshotOnboardingArtifacts>,
): void => {
  snapshots.forEach(({ path, content }) => {
    const destination = join(rootDir, path);
    const shouldRemove = content === undefined && fs.existsSync(destination);
    if (shouldRemove) return fs.unlinkSync(destination);
    if (content === undefined) return;
    fs.writeFileSync(destination, content);
  });
};

const needsGeneratedWorkflows = (answers: OnboardingAnswers, setup: OnboardingSetup): boolean => {
  if (answers.enforcement === "local") return false;
  return !setup.artifacts.some(({ path }) => path.startsWith(".github/workflows/"));
};

const generatedOnboardingWorkflows = (
  rootDir: string,
  options: Record<string, unknown>,
): OnboardingSetup["artifacts"] => {
  const paths = initGitHubActions({
    force: Boolean(options.force),
    postUpdateCommands: stringListOption(options.postUpdateCommand),
    rootDir,
    schedules: stringListOption(options.schedule),
    tokenSecret: stringOption(options.tokenSecret),
    versions: stringListOption(options.version),
  });
  return paths.map((path) => ({
    path: relative(rootDir, path),
    content: fs.readFileSync(path, "utf8"),
  }));
};

const writeConfiguredOnboarding = (
  rootDir: string,
  answers: OnboardingAnswers,
  setup: OnboardingSetup,
  options: Record<string, unknown>,
): OnboardingSetup => {
  const snapshots = snapshotOnboardingArtifacts(rootDir, setup.artifacts);
  writeOnboardingArtifacts(rootDir, setup);
  if (!needsGeneratedWorkflows(answers, setup)) return setup;
  try {
    const workflows = generatedOnboardingWorkflows(rootDir, options);
    return Object.assign({}, setup, { artifacts: setup.artifacts.concat(workflows) });
  } catch (cause) {
    restoreOnboardingArtifacts(rootDir, snapshots);
    throw cause;
  }
};

const installOnboardingCli = async (
  rootDir: string,
  answers: OnboardingAnswers,
  setup: OnboardingSetup,
  skipInstall: boolean,
  showProgress: boolean,
): Promise<void> => {
  const needsLocalCli = answers.enforcement === "local" || answers.enforcement === "both";
  const shouldSkipInstall = !needsLocalCli || skipInstall;
  if (shouldSkipInstall) return;
  if (!setup.install) return;
  const spinner = showProgress
    ? createSpinner(`Installing codependence with ${setup.install.command}...`).start()
    : null;
  try {
    await programDependencies.exec(setup.install.command, setup.install.args, { cwd: rootDir });
    spinner?.succeed("Installed codependence");
  } catch (cause) {
    spinner?.fail("Could not install codependence");
    throw cause;
  }
};

const printOnboardingResult = (
  project: OnboardingProject,
  setup: OnboardingSetup,
  existingPaths: Set<string>,
): void => {
  logger.print(`Configured ${project.manifests.length} manifest(s).`);
  setup.artifacts.forEach(({ path }) => {
    const action = existingPaths.has(path) ? "Updated" : "Created";
    logger.print(`${action} ${path}`);
  });
  logger.print(`Verify with: ${setup.verifyCommand}`);
  if (!setup.tokenSetup) return;
  logger.print(`Create a fine-grained PAT: ${setup.tokenSetup.personalAccessTokenUrl}`);
  setup.tokenSetup.permissions.forEach((permission) => logger.print(`- ${permission}`));
  logger.print(
    `Save it as ${setup.tokenSetup.secretName}: ${setup.tokenSetup.repositorySecretUrl}`,
  );
};

interface ConfiguredOnboarding {
  answers: OnboardingAnswers;
  project: OnboardingProject;
  setup: OnboardingSetup;
}

const configureOnboarding = async (
  prompt: Prompt,
  project: OnboardingProject,
  options: Record<string, unknown>,
): Promise<ConfiguredOnboarding> => {
  const answers = await collectOnboardingAnswers(prompt, project, options);
  const versionedProject = await ensureOnboardingVersion(
    prompt,
    project,
    answers.enforcement,
    options,
  );
  const setup = createOnboardingSetup(versionedProject, answers);
  return { answers, project: versionedProject, setup };
};

const applyOnboarding = async (
  rootDir: string,
  configured: ConfiguredOnboarding,
  options: Record<string, unknown>,
): Promise<void> => {
  const { answers, project } = configured;
  const setup = prepareOnboardingSetup(rootDir, project, configured.setup);
  const existingPaths = new Set(
    setup.artifacts
      .filter(({ path }) => fs.existsSync(join(rootDir, path)))
      .map(({ path }) => path),
  );
  assertOnboardingWrites(rootDir, setup, Boolean(options.force));
  const showProgress = !suppressOutput(options);
  await installOnboardingCli(rootDir, answers, setup, Boolean(options.skipInstall), showProgress);
  const writtenSetup = writeConfiguredOnboarding(rootDir, answers, setup, options);
  printOnboardingResult(project, writtenSetup, existingPaths);
};

const runOnboardingPrompt = async (
  rootDir: string,
  project: OnboardingProject,
  options: Record<string, unknown>,
): Promise<void> => {
  const prompt = new Prompt();
  try {
    const configured = await configureOnboarding(prompt, project, options);
    await applyOnboarding(rootDir, configured, options);
  } finally {
    prompt.close();
  }
};

const onboardingWorkflow = async (options: Record<string, unknown>): Promise<void> => {
  const rootDir = resolve(stringOption(options.rootDir) || process.cwd());
  const files = collectOnboardingFiles(rootDir);
  const project = analyzeOnboardingProject(files);
  await runOnboardingPrompt(rootDir, project, options);
};

export const onboardAction = async (options: Record<string, unknown>): Promise<void> => {
  try {
    await onboardingWorkflow(options);
  } catch (cause) {
    throw onboardingError(cause);
  }
};

const areaForManager = (manager: DependencyManager): WorkflowArea => {
  if (NODE_MANAGERS.has(manager)) return "node";
  if (manager === PYTHON_PACKAGE_MANAGERS.UV) return "python";
  if (manager === LANGUAGES.GO) return "go";
  if (manager === LANGUAGES.RUST) return "rust";
  if (manager === LANGUAGES.DOCKER) return "docker";
  return "infrastructure";
};

const actionConfigFiles = (): string[] => {
  const rcFiles = CONFIG_FILES.filter((filename) => filename !== MANIFEST_FILES.PACKAGE_JSON);
  return rcFiles.concat(MANIFEST_FILES.PACKAGE_JSON);
};

const configuredTargets = (rootDir: string): CodependenceTarget[] => {
  const result = actionConfigFiles().reduce<ReturnType<typeof loadConfig>>(
    (found, filename) => found || programDependencies.loadConfig(join(rootDir, filename)),
    null,
  );
  if (!result) {
    throw new Error(
      "Codependence configuration not found. Add manager targets before running `codependence init actions`.",
    );
  }

  assertValidConfig(result.config);
  const configRootDir = dirname(result.filepath);
  const normalizedConfig = normalizeConfigShape(result.config, configRootDir);
  const targets = normalizedConfig.targets;
  const hasTargets = Array.isArray(targets) && targets.length > 0;
  if (!hasTargets) {
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
  const configured = Array.from(new Set(targets.map(({ manager }) => manager)));
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

const readFile = (path: string): string =>
  fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

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

  const version = content.match(GO_VERSION_PATTERN)?.[1] || "";
  return GO_MINOR_VERSION_PATTERN.test(version) ? `${version}.0` : version;
};

const readRustVersion = (rootDir: string): string => {
  const toolchainToml = readFile(join(rootDir, "rust-toolchain.toml"));
  const tomlChannel = toolchainToml.match(RUST_TOOLCHAIN_CHANNEL_PATTERN)?.[1];
  if (tomlChannel) return tomlChannel;

  const toolchain = readFile(join(rootDir, "rust-toolchain"));
  const legacyChannel = toolchain.match(RUST_TOOLCHAIN_CHANNEL_PATTERN)?.[1];
  return legacyChannel || toolchain.trim();
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
  const rustVersion = manager === LANGUAGES.RUST ? readRustVersion(targetDir) : "";
  const targetMetadataVersion = metadataVersion(targetDir, manager);
  const rootMetadataVersion = targetDir === rootDir ? "" : metadataVersion(rootDir, manager);

  const versions = [
    packageManagerVersion,
    goVersion,
    rustVersion,
    targetMetadataVersion,
    rootMetadataVersion,
  ];
  return versions.find(Boolean) ?? "";
};

const exactVersion = (manager: DependencyManager, version: string): string => {
  const isRust = manager === LANGUAGES.RUST;
  const normalizedVersion = isRust && version.startsWith("v") ? version.slice(1) : version;
  const isExactVersion = EXACT_TOOL_VERSION_PATTERN.test(normalizedVersion);
  const isExactRustVersion = !isRust || RUST_TOOLCHAIN_VERSION_PATTERN.test(normalizedVersion);
  const isValidVersion = isExactVersion && isExactRustVersion;
  if (isValidVersion) return normalizedVersion;

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
  if (manager === LANGUAGES.RUST) return "cargo generate-lockfile";
  return "git diff --check";
};

const shellString = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;

const commandForRoot = (command: string, rootDir = "."): string => {
  if (rootDir === ".") return command;

  return `(cd -- ${shellString(rootDir)} && ${command})`;
};

const managerCommands = (
  manager: DependencyManager,
  targets: CodependenceTarget[],
  overrides: Map<string, string>,
): string[] => {
  const command = overrides.get(manager) || defaultManagerCommand(manager);
  const roots = targets
    .filter((target) => target.manager === manager)
    .map((target) => target.rootDir || ".");

  return Array.from(new Set(roots.map((rootDir) => commandForRoot(command, rootDir))));
};

const postUpdateCommand = (
  definition: WorkflowDefinition,
  targets: CodependenceTarget[],
  overrides: Map<string, string>,
): string => {
  const areaOverride = overrides.get(definition.area);
  const areaIsManager = definition.managers.includes(definition.area as DependencyManager);
  const shouldUseAreaOverride = Boolean(areaOverride) && !areaIsManager;
  if (shouldUseAreaOverride) return areaOverride;

  const commands = definition.managers.flatMap((manager) =>
    managerCommands(manager, targets, overrides),
  );
  return Array.from(new Set(commands)).join(" && ");
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

const workflowTargetsManager = (content: string, manager: DependencyManager): boolean => {
  const lines = content.split("\n");
  const targetIndex = lines.findIndex((line) => line.trimStart().startsWith("targets:"));
  if (targetIndex === -1) return false;

  const targetLine = lines[targetIndex];
  const targetValue = targetLine.trim().slice("targets:".length).trim();
  if (targetValue !== "|") return targetValue === manager;

  const indentation = targetLine.search(/\S/);
  const followingLines = lines.slice(targetIndex + 1);
  const boundaryIndex = followingLines.findIndex(
    (line) => line.trim().length > 0 && line.search(/\S/) <= indentation,
  );
  const targetLines =
    boundaryIndex === -1 ? followingLines : followingLines.slice(0, boundaryIndex);
  return targetLines.some((line) => line.trim() === manager);
};

const legacyInfrastructureWorkflowPath = (
  rootDir: string,
  managers: DependencyManager[],
): string | undefined => {
  const includesDocker = managers.includes(LANGUAGES.DOCKER);
  if (!includesDocker) return undefined;

  const path = workflowPath(rootDir, "infrastructure");
  if (!fs.existsSync(path)) return undefined;

  const content = fs.readFileSync(path, "utf8");
  const isGenerated = content.startsWith(GENERATED_ACTION_HEADER);
  const targetsDocker = workflowTargetsManager(content, LANGUAGES.DOCKER);
  const isDockerWorkflow = isGenerated && targetsDocker;
  return isDockerWorkflow ? path : undefined;
};

const migrateLegacyInfrastructureWorkflow = (path: string): void => {
  const content = fs.readFileSync(path, "utf8");
  const targetsGitHubActions = workflowTargetsManager(content, LANGUAGES.GITHUB_ACTIONS);
  if (!targetsGitHubActions) {
    fs.unlinkSync(path);
    return;
  }

  const workflow = content
    .split("\n")
    .filter((line) => line.trim() !== LANGUAGES.DOCKER)
    .join("\n");
  fs.writeFileSync(path, workflow);
};

const assertSafeWrites = (rootDir: string, paths: string[], force: boolean): void => {
  if (force) return;

  const existing = paths.filter(fs.existsSync);
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
  const unknown = Array.from(assignments.keys()).filter((key) => !allowed.has(key));
  if (unknown.length === 0) return;

  throw new Error(`Unknown ${label}: ${unknown.join(", ")}`);
};

const assertSchedules = (schedules: Map<string, string>): void => {
  const invalid = Array.from(schedules.entries())
    .filter(([, value]) => !CRON_SCHEDULE_PATTERN.test(value))
    .map(([area]) => area);
  if (invalid.length === 0) return;

  throw new Error(`Invalid cron schedule for: ${invalid.join(", ")}`);
};

const writeWorkflows = (
  rootDir: string,
  targets: CodependenceTarget[],
  definitions: WorkflowDefinition[],
  versions: Map<DependencyManager, string>,
  commands: Map<string, string>,
  secretName: string,
): void => {
  fs.mkdirSync(join(rootDir, ".github", "workflows"), { recursive: true });
  definitions.forEach((definition) => {
    const workflow = renderWorkflow(Object.assign({}, definition, {
      postUpdateCommand: postUpdateCommand(definition, targets, commands),
      tokenSecret: secretName,
      versions,
    }));
    fs.writeFileSync(workflowPath(rootDir, definition.area), workflow);
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
  const commandKeys = new Set<string>(Array.from(managerNames).concat(Array.from(areas)));

  assertAssignmentKeys(versionsInput, managerNames, "version manager(s)");
  assertAssignmentKeys(commands, commandKeys, "post-update command target(s)");
  assertAssignmentKeys(schedules, areas, "schedule area(s)");
  assertSchedules(schedules);

  const versions = resolveVersions(rootDir, targets, managers, versionsInput);
  const definitions = workflowDefinitions(managers, schedules);
  const paths = definitions.map(({ area }) => workflowPath(rootDir, area));
  const force = Boolean(options.force);
  const writesInfrastructure = areas.has("infrastructure");
  const legacyPath = writesInfrastructure
    ? undefined
    : legacyInfrastructureWorkflowPath(rootDir, managers);
  const protectedPaths = legacyPath ? paths.concat(legacyPath) : paths;
  assertSafeWrites(rootDir, protectedPaths, force);
  writeWorkflows(
    rootDir,
    targets,
    definitions,
    versions,
    commands,
    tokenSecret(options.tokenSecret),
  );
  const migrationPath = force ? legacyPath : undefined;
  if (!migrationPath) return paths;
  migrateLegacyInfrastructureWorkflow(migrationPath);
  return paths;
};

const initActions = (options: Record<string, unknown>, positionalTargets: string[]): void => {
  const requestedTargets = stringListOption(options.target);
  const targets = requestedTargets.length > 0 ? requestedTargets : positionalTargets;
  const paths = initGitHubActions({
    force: Boolean(options.force),
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
  const codependenceConfig = pathConfig.codependence;
  const hasCodependenceKey = typeof codependenceConfig === "object" && codependenceConfig !== null;
  const normalizedPathConfig = hasCodependenceKey
    ? (codependenceConfig as Record<string, unknown>)
    : pathConfig;
  const effectiveBaseConfig = omitOverriddenTargets(selectedBaseConfig, options);
  const effectivePathConfig = omitOverriddenTargets(normalizedPathConfig, options);

  const mergedConfig = Object.assign({}, effectiveBaseConfig, effectivePathConfig, options, {
    isCLI: true,
  });
  const hasExplicitUpdate = Boolean(options.update);
  const hasExplicitDryRun = options.dryRun !== undefined;
  const hasInheritedDryRun = Boolean(mergedConfig.dryRun);
  const shouldDisableInheritedDryRun =
    hasExplicitUpdate && hasInheritedDryRun && !hasExplicitDryRun;
  let updatedConfig = mergedConfig;
  if (shouldDisableInheritedDryRun) {
    updatedConfig = Object.assign({}, mergedConfig, { dryRun: false });
  }

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
  const hasConfiguredMode = Boolean(options.targets || options.mode);
  if (hasConfiguredMode) return options;

  const hasCodependencies = Boolean(options.codependencies?.length);
  if (options.permissive) return Object.assign({}, options, { mode: "precise" });
  const hasExplicitPermissive = options.permissive !== undefined;
  const shouldUseVerboseMode = hasExplicitPermissive || hasCodependencies;
  if (shouldUseVerboseMode) {
    return Object.assign({}, options, { mode: "verbose" });
  }

  return Object.assign({}, options, { mode: "precise" });
};

const runTarget = async (
  result: TargetRunResult,
  options: CheckFiles,
  onProgress: ProgressHandler,
  onBeforeOutput: NonNullable<CheckFiles["onBeforeOutput"]>,
  deferFailure: boolean,
): Promise<TargetRunResult> => {
  let targetFailed = false;
  const onDeferredFailure = () => {
    targetFailed = true;
  };
  const checkOptions = Object.assign({}, options, {
    onProgress,
    onBeforeOutput,
    deferFailure,
    onDeferredFailure,
  });
  const diffs = await programDependencies.checkFiles(checkOptions);
  const allDiffs = diffs ? result.diffs.concat(diffs) : result.diffs;
  const failed = result.failed || targetFailed;
  return { diffs: allDiffs, failed };
};

const runTargets = (
  targets: CheckFiles[],
  onProgress: ProgressHandler,
  onBeforeOutput: NonNullable<CheckFiles["onBeforeOutput"]> = () => {},
): Promise<TargetRunResult> => {
  return targets.reduce(
    async (result, target) => runTarget(await result, target, onProgress, onBeforeOutput, true),
    Promise.resolve<TargetRunResult>({ diffs: [], failed: false }),
  );
};

const loadActionConfigs = (options: Options): ActionConfigs => {
  if (options.config) {
    const configFileResult = programDependencies.loadConfig(options.config);
    if (!configFileResult) throw new Error(`Config file not found: ${options.config}`);
    assertLoadedConfig(configFileResult.config);
    const configRootDir = dirname(configFileResult.filepath);
    const normalizedConfig = normalizeConfigShape(configFileResult.config, configRootDir);
    return { baseConfig: {}, pathConfig: normalizedConfig };
  }

  const result = programDependencies.loadConfig(undefined, options.searchPath);
  if (!result) return { baseConfig: {}, pathConfig: {} };

  assertLoadedConfig(result.config);
  const configRootDir = dirname(result.filepath);
  const normalizedConfig = normalizeConfigShape(result.config, configRootDir);
  return { baseConfig: normalizedConfig, pathConfig: {} };
};

const actionLogLevel = (options: Options): "verbose" | "debug" | "info" => {
  if (options.verbose) return "verbose";
  if (options.debug) return "debug";
  return "info";
};

export async function action(options: Options = {}): Promise<void | Options> {
  const { baseConfig, pathConfig } = loadActionConfigs(options);
  const mergedOptions = mergeConfigs(options, baseConfig, pathConfig);
  const isOutputSuppressed = suppressOutput(mergedOptions);
  const loggerConfig = {
    level: actionLogLevel(mergedOptions),
    silent: isOutputSuppressed,
  };
  const actionLogger = createLogger(loggerConfig);

  const isTestingCLI = Boolean((options as Record<string, unknown>).isTestingCLI);
  const isTestingAction = Boolean((options as Record<string, unknown>).isTestingAction);

  if (isTestingCLI) {
    logger.print({ updatedOptions: mergedOptions });
    return;
  }

  if (isTestingAction) return mergedOptions;

  try {
    const updatedOptions = withDefaultMode(mergedOptions);
    validateEffectiveConfig(updatedOptions);
    const targets = expandTargets(updatedOptions);

    const isDryRun = Boolean(updatedOptions.dryRun);
    const isWatchMode = Boolean(updatedOptions.watch);

    if (isDryRun) {
      actionLogger.print(cyan(`\n${SYMBOLS.info} Dry run - no files will be modified\n`));
    }

    if (isWatchMode) {
      await runWatchMode(targets);
      return;
    }

    const startTime = Date.now();
    const formatType = updatedOptions.format || "table";
    const shouldUseFormatter = updatedOptions.format !== undefined;
    const shouldShowStatus = !shouldUseFormatter && !isOutputSuppressed;

    const statusText = (packageName?: string, current?: number, total?: number): string => {
      const base = `🤼‍♀️ ${gradient(`codependence`)}`;
      if (!packageName) return `${base} wrestling...`;

      return `${base} checking ${packageName} (${current}/${total})`;
    };
    const useStatusSpinner = shouldUseStatusSpinner(shouldShowStatus);
    const spinner = useStatusSpinner
      ? createSpinner(statusText(), { interactive: true }).start()
      : undefined;
    let didPrintStaticStatus = false;
    const printStaticStatus = (): void => {
      const shouldPrintStaticStatus = shouldShowStatus && !spinner && !didPrintStaticStatus;
      if (!shouldPrintStaticStatus) return;

      actionLogger.print(statusText());
      didPrintStaticStatus = true;
    };
    const stopStatus = (): void => {
      spinner?.stop();
    };
    const onProgress: ProgressHandler = (current, total, packageName) => {
      if (!shouldShowStatus) return;

      printStaticStatus();
      if (spinner) spinner.text = statusText(packageName, current, total);
    };
    const onBeforeOutput = (): void => {
      stopStatus();
    };

    printStaticStatus();
    const { diffs, failed } = await runTargets(targets, onProgress, onBeforeOutput).catch(
      (err: unknown) => {
        stopStatus();
        throw err;
      },
    );
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
        fs.writeFileSync(updatedOptions.outputFile, formattedOutput);
        actionLogger.print(`Output written to ${updatedOptions.outputFile}`);
      } else {
        actionLogger.print(formattedOutput);
      }
    } else {
      const successMessage = isDryRun
        ? "dry run complete!"
        : "pinned!";
      const failureMessage = "found dependency issues.";

      if (shouldShowStatus) {
        stopStatus();
        const resultMessage = failed
          ? shortStatus(SYMBOLS.error, failureMessage)
          : shortStatus(SYMBOLS.success, successMessage);
        actionLogger.print(resultMessage);
      }

      const shouldShowMetrics = Boolean(updatedOptions.verbose);
      if (shouldShowMetrics) {
        showPerformanceMetrics(duration);
      }
    }
  } catch (err) {
    actionLogger.error(errorMessage(err));
    process.exit(CLI_ERROR_EXIT_CODE);
  }
}

export const formatPerformanceMetrics = (
  duration: number,
  stats: { hits: number; misses: number; size: number },
  hitRate: number,
): string[] => {
  const hasCache = stats.size > 0;
  const cacheLines = hasCache
    ? [
        `  ${SYMBOLS.info} Cache: ${stats.hits} hits, ${stats.misses} misses (${hitRate.toFixed(1)}% hit rate)`,
        `  ${SYMBOLS.info} ${stats.size} packages cached\n`,
      ]
    : [`  ${SYMBOLS.info} No cache hits (first run)\n`];
  return [`\n${SYMBOLS.arrow} Performance:`, `  ${SYMBOLS.dot} Completed in ${duration}ms`].concat(
    cacheLines,
  );
};

const showPerformanceMetrics = (duration: number): void => {
  const stats = versionCache.getStats();
  const hitRate = versionCache.getHitRate();
  const lines = formatPerformanceMetrics(duration, stats, hitRate);
  lines.forEach((line) => logger.print(line));
};

const runWatchMode = async (targets: CheckFiles[]): Promise<void> => {
  logger.print(cyan(`\n${SYMBOLS.info} Watch mode enabled - checking every 30 seconds...\n`));
  logger.print(gray("Press Ctrl+C to stop\n"));
  let isChecking = false;

  const checkDependencies = async () => {
    if (isChecking) {
      logger.print(gray("Previous check still running, skipping this interval."));
      return;
    }

    isChecking = true;
    const now = new Date().toLocaleTimeString();
    logger.print(gray(`\n[${now}] Checking dependencies...`));

    try {
      const { failed } = await runTargets(targets, () => {});
      if (failed) {
        logger.printError(red(`${SYMBOLS.error} Dependency issues found (${now})`));
        return;
      }
      logger.print(green(`${SYMBOLS.success} All dependencies checked (${now})`));
    } catch (err) {
      logger.printError(red(`${SYMBOLS.error} Check failed: ${(err as Error).message}`));
    } finally {
      isChecking = false;
    }
  };

  await checkDependencies();

  setInterval(checkDependencies, 30000);
};

export async function initAction(input?: InitInput, codependencies: string[] = []): Promise<void> {
  try {
    const hasArrayInput = Array.isArray(input);
    const type = hasArrayInput ? undefined : input;
    const requestedDeps = hasArrayInput ? input : codependencies;
    const rcPath = ".codependencerc";
    const packageJsonPath = MANIFEST_FILES.PACKAGE_JSON;
    const hasConfig = fs.existsSync(rcPath);
    const hasPackageJsonConfig = (() => {
      if (!fs.existsSync(packageJsonPath)) return false;
      try {
        const content = fs.readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(content);
        return Boolean(packageJson.codependence);
      } catch {
        return false;
      }
    })();

    const hasExistingConfig = hasConfig || hasPackageJsonConfig;
    if (hasExistingConfig) {
      logger.warn("Codependence configuration already exists. Skipping initialization.");
      return;
    }

    const hasPackageJson = fs.existsSync(packageJsonPath);
    if (!hasPackageJson) {
      throw new Error("package.json not found in the current directory");
    }

    const content = fs.readFileSync(packageJsonPath, "utf8");
    let packageJson: PackageJSON;
    try {
      packageJson = JSON.parse(content) as PackageJSON;
    } catch (parseError) {
      throw new Error(`Invalid JSON in package.json: ${parseError}`);
    }

    const allDeps = Object.assign(
      {},
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.peerDependencies,
    );

    const hasPackageDeps = Object.keys(allDeps).length > 0;
    const shouldRequirePackageDeps = requestedDeps.length === 0;
    const shouldRejectEmptyPackage = !hasPackageDeps && shouldRequirePackageDeps;
    if (shouldRejectEmptyPackage) {
      throw new Error("No dependencies found in package.json");
    }

    validateRequestedInitDeps(requestedDeps, allDeps);

    logger.print(`\n🤼‍♀️ Welcome to ${gradient("Codependence")} setup!\n`);
    logger.print("Codependence helps you manage dependency versions in your project.\n");

    let pinnedDeps: string[] = [];
    let outputType: "rc" | "package" = "rc";
    let usePermissive = true;
    const hasRequestedDeps = requestedDeps.length > 0;

    const shouldUseRequestedDeps = Boolean(type) || hasRequestedDeps;
    if (shouldUseRequestedDeps) {
      pinnedDeps = hasRequestedDeps ? requestedDeps : Object.keys(allDeps);
      outputType = type === "package" ? "package" : "rc";
      usePermissive = false;
    } else {
      const prompt = new Prompt();
      const managementMode = await prompt.radio("How would you like to manage your dependencies?", [
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
        logger.print(
          `\n${SYMBOLS.bullet} In permissive mode, you'll select dependencies to PIN (keep at current version).`,
        );
        logger.print("   All other dependencies will be updated to their latest versions.\n");

        const depChoices = Object.keys(allDeps).map((dep) => {
          const currentVersion = allDeps[dep];
          return {
            name: `${dep} (currently: ${currentVersion})`,
            value: dep,
          };
        });

        const userPinnedDeps = await prompt.select(
          "Select dependencies to PIN at their current versions (others will update to latest):",
          depChoices,
        );
        pinnedDeps = userPinnedDeps;

        if (pinnedDeps.length === 0) {
          logger.print(
            `\n${SYMBOLS.success} Great! All dependencies will be updated to latest versions.`,
          );
        }
      } else {
        // Pin all dependencies mode
        usePermissive = false;
        pinnedDeps = Object.keys(allDeps);
        logger.print(
          `\n${SYMBOLS.pinned} All dependencies will be pinned at their current versions.`,
        );
      }

      const shouldPromptForOutput = pinnedDeps.length > 0 || managementMode === "permissive";
      if (shouldPromptForOutput) {
        const outputLocation = await prompt.radio(
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

    const config: CodependenceConfig = Object.assign({}, codependenciesConfig, permissiveConfig);

    if (outputType === "package") {
      const updatedPackageJson = Object.assign({}, packageJson, {
        codependence: config,
      });
      fs.writeFileSync(packageJsonPath, JSON.stringify(updatedPackageJson, null, 2));
      logger.print("Added codependence configuration to package.json");
    } else {
      fs.writeFileSync(rcPath, JSON.stringify(config, null, 2));
      logger.print("Created .codependencerc configuration file");
    }

    logger.print(`\n🤼‍♀️ ${gradient("Codependence")} setup complete!\n`);

    if (usePermissive) {
      logger.print("> Next steps:");
      logger.print("   • Run `codependence --update` to update dependencies");
      if (pinnedDeps.length > 0) {
        logger.print(`   • These dependencies will stay pinned: ${pinnedDeps.join(", ")}`);
      }
      logger.print("   • All other dependencies will update to latest versions\n");
    } else {
      logger.print("> Next steps:");
      logger.print("   • Run `codependence` to check dependency versions");
      logger.print("   • Run `codependence --update` to update dependencies\n");
    }
  } catch (err) {
    logger.error((err as Error).message || (err as string).toString());
  }
}

const guidedInitOptions = (
  initType: InitType | undefined,
  initDeps: string[],
  options: Record<string, unknown>,
): Record<string, unknown> => {
  const rootDir = initDeps[0] || stringOption(options.rootDir);
  const rootOption = rootDir ? { rootDir } : {};
  const configOptions = initType === "config" ? { enforcement: "local", skipInstall: true } : {};
  return Object.assign({}, options, rootOption, configOptions);
};

const runInitCommand = async (args: string[], options: Record<string, unknown>): Promise<void> => {
  const initType = args.find(isInitType);
  const initIndex = args.indexOf("init");
  const initArgs = args.slice(initIndex + 1);
  const initDeps = collectInitDeps(initArgs);
  if (initType === "actions") return initActions(options, initDeps);

  const usesGuidedConfig = initType === "config" || initType === undefined;
  if (usesGuidedConfig) return onboardAction(guidedInitOptions(initType, initDeps, options));

  const codependencies = resolveInitDeps(options.codependencies, initDeps);
  return initAction(initType, codependencies);
};

export async function run(args: string[] = process.argv): Promise<void> {
  const parsed = parseArgs(args);
  const isHelpRequested = Boolean(parsed.options.help);
  if (isHelpRequested) {
    showHelp();
    return;
  }

  const isStyleguideRequested = Boolean(parsed.options.styleguide);
  if (isStyleguideRequested) {
    logger.print(formatCliStyleguide());
    await loopStyleguideLoader();
    return;
  }

  const isLegendRequested = Boolean(parsed.options.legend);
  if (isLegendRequested) {
    logger.print(formatCliLegend());
    return;
  }

  if (parsed.command === "onboard") throw new Error("Unknown command: onboard");

  const isInitCommand = args.includes("init");
  if (isInitCommand) return runInitCommand(args, parsed.options);

  await action(parsed.options as Options);
}

export const runBinary = async (argv: BinaryArgv, runProgram: typeof run = run): Promise<void> => {
  try {
    await runProgram(normalizeBinaryArgv(argv));
  } catch (error) {
    const err = error as Error;
    logger.error(err.message || err.toString());
    process.exit(2);
  }
};

const isDirectExecution = (argv: BinaryArgv): boolean => {
  const scriptPath = argv[1];
  if (!scriptPath) return false;
  try {
    const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));
    const executablePath = fs.realpathSync(resolve(scriptPath));
    return modulePath === executablePath;
  } catch {
    return false;
  }
};

if (isDirectExecution(process.argv)) await runBinary(process.argv);
