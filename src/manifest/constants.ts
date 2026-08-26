import {
  DEFAULT_LANGUAGE_MANIFESTS,
  LANGUAGES,
  MANIFEST_FILES,
  NODE_PACKAGE_MANAGERS,
  PYTHON_MANIFEST_FILES,
  PYTHON_PACKAGE_MANAGERS,
} from "../providers/constants";
import type { DependencyManager, SupportedLanguage } from "../types";

export const SCOPED_PACKAGE_PATTERN = /^(?:@([^/]+?)[/])?([^/]+?)$/;
export const PACKAGE_NAME_EXCLUSIONS = ["node_modules", "favicon.ico"];
export const VERSION_PREFIXES = ["==", ">=", "<=", "~=", ">", "<", "=", "^", "~"] as const;
export const REPEATING_VERSION_PREFIXES = ["^", "~"] as const;
export const STRICT_INEQUALITY_VERSION_PREFIXES = [">", "<"] as const;

const REPEATING_VERSION_PREFIX_SET = new Set<string>(REPEATING_VERSION_PREFIXES);
export const VERSION_COMPARISON_PREFIXES = VERSION_PREFIXES.filter(
  (prefix) => !REPEATING_VERSION_PREFIX_SET.has(prefix),
);

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
export const escapeRegex = (value: string): string => value.replace(REGEX_SPECIAL_CHARS, "\\$&");
export const createRegexAlternation = (values: readonly string[]): string =>
  values.map(escapeRegex).join("|");

const repeatingPrefixCharacterClass = REPEATING_VERSION_PREFIXES.map(escapeRegex).join("");
export const VERSION_PREFIX_PATTERN = new RegExp(
  `^(?:${createRegexAlternation(VERSION_COMPARISON_PREFIXES)}|[${repeatingPrefixCharacterClass}]+|v)`,
);

export const DEP_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export const DEFAULT_FILE_MATCHERS: Record<SupportedLanguage, string[]> = {
  [LANGUAGES.NODEJS]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.NODEJS].slice(),
  [LANGUAGES.GO]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.GO].slice(),
  [LANGUAGES.PYTHON]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.PYTHON].slice(),
  [LANGUAGES.RUST]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.RUST].slice(),
  [LANGUAGES.CIRCLECI]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.CIRCLECI].slice(),
  [LANGUAGES.DOCKER]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.DOCKER].slice(),
  [LANGUAGES.GITHUB_ACTIONS]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.GITHUB_ACTIONS].slice(),
  [LANGUAGES.HELM]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.HELM].slice(),
  [LANGUAGES.KUBERNETES]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.KUBERNETES].slice(),
  [LANGUAGES.KUSTOMIZE]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.KUSTOMIZE].slice(),
  [LANGUAGES.TERRAFORM]: DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.TERRAFORM].slice(),
};

export const PYTHON_MANIFEST_NAMES = new Set<string>(PYTHON_MANIFEST_FILES);
export const DEFAULT_IGNORE_PATTERNS = [
  "**/.git/**",
  "**/.next/**",
  "**/.venv/**",
  "**/node_modules/**",
  "**/*.dockerignore",
] as const;
export const VERSION_RESOLUTION_CONCURRENCY = 8;
export const SUPPORTED_LANGUAGE_NAMES = new Set<string>(Object.values(LANGUAGES));
export const NODE_MANAGER_NAMES = new Set<string>(Object.values(NODE_PACKAGE_MANAGERS));

export const STANDARD_LOCKFILES: Partial<Record<DependencyManager, readonly string[]>> = {
  [NODE_PACKAGE_MANAGERS.BUN]: [MANIFEST_FILES.BUN_LOCK, MANIFEST_FILES.BUN_LOCK_BINARY],
  [NODE_PACKAGE_MANAGERS.NPM]: [MANIFEST_FILES.NPM_LOCK, MANIFEST_FILES.NPM_SHRINKWRAP],
  [NODE_PACKAGE_MANAGERS.PNPM]: [MANIFEST_FILES.PNPM_LOCK],
  [NODE_PACKAGE_MANAGERS.YARN]: [MANIFEST_FILES.YARN_LOCK],
  [PYTHON_PACKAGE_MANAGERS.PIPENV]: ["Pipfile.lock"],
  [PYTHON_PACKAGE_MANAGERS.POETRY]: ["poetry.lock"],
  [PYTHON_PACKAGE_MANAGERS.UV]: [MANIFEST_FILES.UV_LOCK],
  [LANGUAGES.GO]: [MANIFEST_FILES.GO_SUM],
  [LANGUAGES.RUST]: [MANIFEST_FILES.CARGO_LOCK],
};
