import { LANGUAGES, NODE_PACKAGE_MANAGERS, PYTHON_PACKAGE_MANAGERS } from "../providers/constants";
import type {
  CheckFiles,
  CodependenceTarget,
  DependencyManager,
  Options,
  SupportedLanguage,
} from "../types";

export const VALID_MANAGERS = [
  ...Object.values(NODE_PACKAGE_MANAGERS),
  ...Object.values(PYTHON_PACKAGE_MANAGERS),
  LANGUAGES.GO,
  LANGUAGES.RUST,
  LANGUAGES.DOCKER,
  LANGUAGES.GITHUB_ACTIONS,
] as const;

const NODE_MANAGERS = new Set<string>(Object.values(NODE_PACKAGE_MANAGERS));
const PYTHON_MANAGERS = new Set<string>(Object.values(PYTHON_PACKAGE_MANAGERS));

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
});

const targetOptions = (target: CodependenceTarget, options: Options): CheckFiles => {
  const { manager, ...policy } = target;
  const language = languageForManager(manager);

  return {
    ...sharedOptions(options),
    ...policy,
    language,
    packageManager: manager,
  };
};

export const expandTargets = (options: Options): CheckFiles[] => {
  if (!options.targets) return [options];

  return options.targets.map((target) => targetOptions(target, options));
};
