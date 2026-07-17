import {
  DEFAULT_LANGUAGE_MANIFESTS,
  LANGUAGES,
  MANIFEST_FILES,
  NODE_PACKAGE_MANAGERS,
  PYTHON_PACKAGE_MANAGERS,
} from "../providers/constants";
import type { DependencyManager } from "../types";
import type { SplitState } from "./types";

export const CONFIG_FILES = [
  ".codependencerc",
  ".codependencerc.json",
  ".codependencerc.yaml",
  ".codependencerc.yml",
  MANIFEST_FILES.PACKAGE_JSON,
] as const;

export const CONFIG_FILE_NAMES = CONFIG_FILES as readonly string[];

export const VALID_LANGUAGES = [
  LANGUAGES.NODEJS,
  LANGUAGES.PYTHON,
  LANGUAGES.GO,
  LANGUAGES.RUST,
  LANGUAGES.DOCKER,
  LANGUAGES.GITHUB_ACTIONS,
] as const;
export const VALID_MANAGERS = [
  ...Object.values(NODE_PACKAGE_MANAGERS),
  ...Object.values(PYTHON_PACKAGE_MANAGERS),
  LANGUAGES.GO,
  LANGUAGES.RUST,
  LANGUAGES.DOCKER,
  LANGUAGES.GITHUB_ACTIONS,
] as const;
export const VALID_LEVELS = ["patch", "minor", "major"] as const;
export const VALID_MODES = ["verbose", "precise"] as const;
export const VALID_FORMATS = ["json", "markdown", "table"] as const;
export const TARGET_POLICY_FIELDS = [
  "codependencies",
  "permissive",
  "files",
  "ignore",
  "level",
  "mode",
  "rootDir",
] as const;
export const TARGET_FIELDS = ["manager", ...TARGET_POLICY_FIELDS] as const;
export const BOOLEAN_OPTION_FIELDS = [
  "update",
  "debug",
  "silent",
  "verbose",
  "quiet",
  "yarnConfig",
  "dryRun",
  "interactive",
  "watch",
  "noCache",
] as const;
export const KNOWN_FIELDS = [
  "codependencies",
  "permissive",
  "language",
  "files",
  "ignore",
  "level",
  "mode",
  "rootDir",
  ...BOOLEAN_OPTION_FIELDS,
  "format",
  "outputFile",
  "targets",
] as const;

export const NODE_MANAGERS = new Set<string>(Object.values(NODE_PACKAGE_MANAGERS));
export const PYTHON_MANAGERS = new Set<string>(Object.values(PYTHON_PACKAGE_MANAGERS));
export const DEFAULT_MANAGER_FILES = {
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
  [LANGUAGES.GITHUB_ACTIONS]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.GITHUB_ACTIONS],
} satisfies Record<DependencyManager, readonly string[]>;

export const SPLIT_INITIAL: SplitState = {
  items: [],
  quote: null,
  braceDepth: 0,
  bracketDepth: 0,
  current: "",
};
