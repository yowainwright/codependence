import { LANGUAGES } from "../providers/constants";
import type {
  CheckFiles,
  CodependenceTarget,
  DependencyManager,
  Options,
  SupportedLanguage,
} from "../types";
import { DEFAULT_MANAGER_FILES, NODE_MANAGERS, PYTHON_MANAGERS } from "./constants";

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
    packageManager: manager,
  };
};

export const expandTargets = (options: Options): CheckFiles[] => {
  if (!options.targets) return [options];

  return options.targets.map((target) => targetOptions(target, options));
};

export { loadConfig } from "./loader";
export { validateConfig, formatValidationErrors } from "./validator";
export { CONFIG_FILES, CONFIG_FILE_NAMES, VALID_MANAGERS } from "./constants";
export type { ConfigResult, ValidationError, ValidationResult } from "./types";
