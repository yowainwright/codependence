import { LANGUAGES } from "../providers/constants";
import type {
  CheckFiles,
  CodependenceManifest,
  CodependenceTarget,
  DependencyManager,
  Options,
  SupportedLanguage,
} from "../types";
import { DEFAULT_MANAGER_FILES, NODE_MANAGERS, PYTHON_MANAGERS } from "./constants";

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
  const files = configuredFiles ?? [...DEFAULT_MANAGER_FILES[manager]];

  return {
    ...sharedOptions(options),
    ...policy,
    files,
    language,
    lockfile: target.lockfile ?? options.lockfile,
    packageManager: manager,
  };
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

export { loadConfig } from "./loader";
export { validateConfig, formatValidationErrors } from "./validator";
export { CONFIG_FILES, CONFIG_FILE_NAMES, VALID_MANAGERS } from "./constants";
export type { ConfigResult, ValidationError, ValidationResult } from "./types";
