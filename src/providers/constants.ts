export const LANGUAGES = {
  GO: "go",
  NODEJS: "nodejs",
  PYTHON: "python",
} as const;

export const NODE_PACKAGE_MANAGERS = {
  BUN: "bun",
  NPM: "npm",
  PNPM: "pnpm",
  YARN: "yarn",
} as const;

export const PYTHON_PACKAGE_MANAGERS = {
  CONDA: "conda",
  PIP: "pip",
  PIPENV: "pipenv",
  POETRY: "poetry",
  UV: "uv",
} as const;

export const MANIFEST_FILES = {
  BUN_CONFIG: "bunfig.toml",
  BUN_LOCK: "bun.lock",
  BUN_LOCK_BINARY: "bun.lockb",
  CONDA_ENVIRONMENT_YAML: "environment.yaml",
  CONDA_ENVIRONMENT_YML: "environment.yml",
  GO_MOD: "go.mod",
  GO_SUM: "go.sum",
  NPM_LOCK: "package-lock.json",
  NPM_SHRINKWRAP: "npm-shrinkwrap.json",
  PACKAGE_JSON: "package.json",
  PIPFILE: "Pipfile",
  PNPM_LOCK: "pnpm-lock.yaml",
  PNPM_WORKSPACE: "pnpm-workspace.yaml",
  PYPROJECT: "pyproject.toml",
  REQUIREMENTS: "requirements.txt",
  UV_LOCK: "uv.lock",
  YARN_LOCK: "yarn.lock",
  YARN_RC: ".yarnrc",
  YARN_RC_YML: ".yarnrc.yml",
} as const;

export const NODE_PACKAGE_MANAGER_NAMES = Object.values(NODE_PACKAGE_MANAGERS);

export const NODE_PACKAGE_MANAGER_LOCKFILES = {
  [NODE_PACKAGE_MANAGERS.BUN]: [
    MANIFEST_FILES.BUN_LOCK,
    MANIFEST_FILES.BUN_LOCK_BINARY,
    MANIFEST_FILES.BUN_CONFIG,
  ],
  [NODE_PACKAGE_MANAGERS.NPM]: [
    MANIFEST_FILES.NPM_LOCK,
    MANIFEST_FILES.NPM_SHRINKWRAP,
  ],
  [NODE_PACKAGE_MANAGERS.PNPM]: [
    MANIFEST_FILES.PNPM_LOCK,
    MANIFEST_FILES.PNPM_WORKSPACE,
  ],
  [NODE_PACKAGE_MANAGERS.YARN]: [
    MANIFEST_FILES.YARN_LOCK,
    MANIFEST_FILES.YARN_RC,
    MANIFEST_FILES.YARN_RC_YML,
  ],
} as const;

export const PYTHON_MANIFEST_FILES = [
  MANIFEST_FILES.REQUIREMENTS,
  MANIFEST_FILES.PYPROJECT,
  MANIFEST_FILES.PIPFILE,
  MANIFEST_FILES.CONDA_ENVIRONMENT_YML,
  MANIFEST_FILES.CONDA_ENVIRONMENT_YAML,
] as const;

export const CONDA_MANIFEST_FILES = [
  MANIFEST_FILES.CONDA_ENVIRONMENT_YML,
  MANIFEST_FILES.CONDA_ENVIRONMENT_YAML,
] as const;

export const DEFAULT_LANGUAGE_MANIFESTS = {
  [LANGUAGES.NODEJS]: [MANIFEST_FILES.PACKAGE_JSON],
  [LANGUAGES.GO]: [MANIFEST_FILES.GO_MOD],
  [LANGUAGES.PYTHON]: PYTHON_MANIFEST_FILES,
} as const;
