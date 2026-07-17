import {
  DEFAULT_LANGUAGE_MANIFESTS,
  LANGUAGES,
  MANIFEST_FILES,
  NODE_PACKAGE_MANAGERS,
  PYTHON_PACKAGE_MANAGERS,
} from "../providers/constants";
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
const DEFAULT_MANAGER_FILES = {
  [NODE_PACKAGE_MANAGERS.BUN]: [MANIFEST_FILES.PACKAGE_JSON],
  [NODE_PACKAGE_MANAGERS.NPM]: [MANIFEST_FILES.PACKAGE_JSON],
  [NODE_PACKAGE_MANAGERS.PNPM]: [MANIFEST_FILES.PACKAGE_JSON],
  [NODE_PACKAGE_MANAGERS.YARN]: [MANIFEST_FILES.PACKAGE_JSON],
  [PYTHON_PACKAGE_MANAGERS.CONDA]: [
    MANIFEST_FILES.CONDA_ENVIRONMENT_YML,
    MANIFEST_FILES.CONDA_ENVIRONMENT_YAML,
  ],
  [PYTHON_PACKAGE_MANAGERS.PIP]: [MANIFEST_FILES.REQUIREMENTS],
  [PYTHON_PACKAGE_MANAGERS.PIPENV]: [MANIFEST_FILES.PIPFILE],
  [PYTHON_PACKAGE_MANAGERS.POETRY]: [MANIFEST_FILES.PYPROJECT],
  [PYTHON_PACKAGE_MANAGERS.UV]: [MANIFEST_FILES.PYPROJECT],
  [LANGUAGES.GO]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.GO],
  [LANGUAGES.RUST]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.RUST],
  [LANGUAGES.DOCKER]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.DOCKER],
  [LANGUAGES.GITHUB_ACTIONS]:
    DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.GITHUB_ACTIONS],
} satisfies Record<DependencyManager, readonly string[]>;

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
