import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { LANGUAGES, MANIFEST_FILES } from "../providers/constants";
import type {
  CheckFiles,
  CodependenceManifest,
  CodependenceTarget,
  DependencyManager,
  Options,
  SupportedLanguage,
} from "../types";
import { CONFIG_FILES, DEFAULT_MANAGER_FILES, NODE_MANAGERS, PYTHON_MANAGERS } from "./constants";
import type { ConfigResult } from "./types";
import { ConfigLoadError, loadPackageJson, loadRcFile } from "./utils";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  const isObject = typeof value === "object" && value !== null;
  if (!isObject) return false;
  return !Array.isArray(value);
};

const manifestTarget = (value: unknown, rootDir?: string): CodependenceTarget => {
  const { name: _name, path, ...target } = value as CodependenceManifest;
  const root = rootDir ? { rootDir } : {};
  return Object.assign({}, target, root, { files: [path] });
};

export const normalizeConfigShape = (
  config: Record<string, unknown>,
  rootDir?: string,
): Record<string, unknown> => {
  if (!isRecord(config.config)) return config;
  const targets = Object.values(config.config).map((entry) => manifestTarget(entry, rootDir));
  const { config: _config, ...rest } = config;
  return Object.assign({}, rest, { targets });
};

const languageForManager = (manager: DependencyManager): SupportedLanguage => {
  if (NODE_MANAGERS.has(manager)) return LANGUAGES.NODEJS;
  if (PYTHON_MANAGERS.has(manager)) return LANGUAGES.PYTHON;

  return manager as SupportedLanguage;
};

const sharedOptions = (options: Options): CheckFiles => ({
  isCLI: options.isCLI,
  isTesting: options.isTesting,
  update: options.update,
  debug: options.debug,
  silent: options.silent,
  verbose: options.verbose,
  quiet: options.quiet,
  dryRun: options.dryRun,
  interactive: options.interactive,
  noCache: options.noCache,
  format: options.format,
  rootDir: options.rootDir,
  ignore: options.ignore,
});

const targetOptions = (target: CodependenceTarget, options: Options): CheckFiles => {
  const { manager, files: configuredFiles, ...policy } = target;
  const language = languageForManager(manager);
  const files = configuredFiles ?? DEFAULT_MANAGER_FILES[manager].slice();

  return Object.assign({}, sharedOptions(options), policy, {
    files,
    language,
    lockfile: target.lockfile ?? options.lockfile,
    packageManager: manager,
  });
};

const selectedTargets = (options: Options): CodependenceTarget[] => {
  const targets = options.targets ?? [];
  const requested = options.target;
  if (!requested?.length) return targets;

  const requestedManagers = new Set(requested);
  const selected = targets.filter(({ manager }) => requestedManagers.has(manager));
  const foundManagers = new Set(selected.map(({ manager }) => manager));
  const missingManagers = requested.filter((manager) => !foundManagers.has(manager));
  if (missingManagers.length > 0) {
    throw new Error(`Unknown target manager(s): ${missingManagers.join(", ")}`);
  }

  return selected;
};

const expandFlatOptions = (options: Options): CheckFiles[] => {
  const requested = options.target ?? [];
  if (requested.length > 0) {
    throw new Error(`Unknown target manager(s): ${requested.join(", ")}`);
  }

  return [options];
};

export const expandTargets = (options: Options): CheckFiles[] => {
  if (!options.targets) return expandFlatOptions(options);

  return selectedTargets(options).map((target) => targetOptions(target, options));
};

export { validateConfig, formatValidationErrors } from "./validation";
export { CONFIG_FILES, CONFIG_FILE_NAMES, VALID_MANAGERS } from "./constants";
export type { ConfigResult, ValidationError, ValidationResult } from "./types";

const packageConfigResult = (
  filepath: string,
  config: Record<string, unknown> | string | null,
): ConfigResult | null => {
  if (!config) return null;
  if (typeof config !== "string") return { config, filepath };
  const configPath = resolve(dirname(filepath), config);
  if (!existsSync(configPath)) {
    throw new ConfigLoadError(filepath, `referenced config does not exist: ${config}`);
  }
  return { config: loadRcFile(configPath), filepath: configPath };
};

const loadPackageConfig = (filepath: string): ConfigResult | null =>
  packageConfigResult(filepath, loadPackageJson(filepath));

const loadCandidate = (directory: string, filename: string): ConfigResult | null => {
  const filepath = resolve(directory, filename);
  if (!existsSync(filepath)) return null;
  return { config: loadRcFile(filepath), filepath };
};

const readPackageConfig = (
  filepath: string,
): { config: ReturnType<typeof loadPackageJson>; cause?: unknown } => {
  try {
    return { config: loadPackageJson(filepath) };
  } catch (cause) {
    return { config: null, cause };
  }
};

const preferredPackageConfig = (
  directory: string,
): { config: ConfigResult | null; cause?: unknown } => {
  const filepath = resolve(directory, MANIFEST_FILES.PACKAGE_JSON);
  if (!existsSync(filepath)) return { config: null };
  const loaded = readPackageConfig(filepath);
  if (loaded.cause) return { config: null, cause: loaded.cause };
  return { config: packageConfigResult(filepath, loaded.config) };
};

const loadConfigFromDirectory = (directory: string): ConfigResult | null => {
  const preferred = preferredPackageConfig(directory);
  if (preferred.config) return preferred.config;
  const config = CONFIG_FILES.slice(1).reduce<ConfigResult | null>(
    (result, filename) => result || loadCandidate(directory, filename),
    null,
  );
  if (config) return config;
  if (preferred.cause) throw preferred.cause;
  return null;
};

const searchForConfig = (searchFrom: string): ConfigResult | null => {
  let currentDirectory = resolve(searchFrom);
  const root = resolve("/");
  while (currentDirectory !== root) {
    const config = loadConfigFromDirectory(currentDirectory);
    if (config) return config;
    currentDirectory = dirname(currentDirectory);
  }
  return null;
};

const loadExplicitConfig = (filepath: string): ConfigResult | null => {
  const resolvedPath = resolve(filepath);
  if (!existsSync(resolvedPath)) return null;
  if (filepath.endsWith(MANIFEST_FILES.PACKAGE_JSON)) return loadPackageConfig(resolvedPath);
  return { config: loadRcFile(resolvedPath), filepath: resolvedPath };
};

export const loadConfig = (filepath?: string, searchFrom = process.cwd()): ConfigResult | null => {
  if (filepath) return loadExplicitConfig(filepath);
  return searchForConfig(searchFrom);
};
