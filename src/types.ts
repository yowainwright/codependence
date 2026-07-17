import type {
  LANGUAGES,
  NODE_PACKAGE_MANAGERS,
  PYTHON_PACKAGE_MANAGERS,
} from "./providers/constants";
import type { VersionStrategy } from "./providers/types";
import type { INIT_TYPES } from "./constants";

export type CodeDependenciesItem = string | Record<string, string>;
export type CodeDependencies = Array<CodeDependenciesItem>;

export type Level = "patch" | "minor" | "major";
export type Mode = "verbose" | "precise";
export type InitType = (typeof INIT_TYPES)[number];
export type InitInput = InitType | string[];
export type SupportedLanguage = (typeof LANGUAGES)[keyof typeof LANGUAGES];
export type DependencyManager =
  | (typeof NODE_PACKAGE_MANAGERS)[keyof typeof NODE_PACKAGE_MANAGERS]
  | (typeof PYTHON_PACKAGE_MANAGERS)[keyof typeof PYTHON_PACKAGE_MANAGERS]
  | typeof LANGUAGES.GO
  | typeof LANGUAGES.RUST
  | typeof LANGUAGES.DOCKER
  | typeof LANGUAGES.GITHUB_ACTIONS;

export type CodependenceTarget = {
  manager: DependencyManager;
  codependencies?: CodeDependencies;
  files?: Array<string>;
  rootDir?: string;
  ignore?: Array<string>;
  permissive?: boolean;
  level?: Level;
  mode?: Mode;
};

export type Options = {
  isTestingCLI?: boolean;
  isTestingAction?: boolean;
  isTesting?: boolean;
  isCLI?: boolean;
  codependencies?: CodeDependencies;
  files?: Array<string>;
  config?: string;
  rootDir?: string;
  ignore?: Array<string>;
  update?: boolean;
  debug?: boolean;
  silent?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  searchPath?: string;
  yarnConfig?: boolean;
  permissive?: boolean;
  language?: SupportedLanguage;
  dryRun?: boolean;
  interactive?: boolean;
  watch?: boolean;
  noCache?: boolean;
  format?: "json" | "markdown" | "table";
  outputFile?: string;
  level?: Level;
  mode?: Mode;
  targets?: CodependenceTarget[];
};

export type CheckFiles = {
  codependencies?: CodeDependencies;
  files?: Array<string>;
  rootDir?: string;
  ignore?: Array<string>;
  update?: boolean;
  debug?: boolean;
  silent?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  isCLI?: boolean;
  isTesting?: boolean;
  yarnConfig?: boolean;
  permissive?: boolean;
  language?: SupportedLanguage;
  dryRun?: boolean;
  interactive?: boolean;
  noCache?: boolean;
  format?: "json" | "markdown" | "table";
  onProgress?: (current: number, total: number, packageName: string) => void;
  level?: Level;
  mode?: Mode;
  packageManager?: DependencyManager;
  deferFailure?: boolean;
  onDeferredFailure?: () => void;
};

export type CheckDependenciesForVersionOptions = {
  isUpdating?: boolean;
  isDebugging?: boolean;
  isSilent?: boolean;
  isVerbose?: boolean;
  isQuiet?: boolean;
  isTesting?: boolean;
  permissive?: boolean;
  level?: Level;
  versionStrategy?: VersionStrategy;
};

export type CheckMatches = {
  versionMap: Record<string, string>;
  rootDir: string;
  files: Array<string>;
  isUpdating?: boolean;
  isDebugging?: boolean;
  isSilent?: boolean;
  isVerbose?: boolean;
  isQuiet?: boolean;
  isCLI?: boolean;
  isTesting?: boolean;
  level?: Level;
};

export type CodependenceConfig = {
  codependencies?: CodeDependencies;
  permissive?: boolean;
  language?: SupportedLanguage;
  level?: Level;
  mode?: Mode;
  targets?: CodependenceTarget[];
};

export type PackageJSON = {
  path: string;
  codependence?: CodependenceConfig;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  name: string;
  version: string;
};

export type DepToUpdateItem = {
  name: string;
  expected: string;
  actual: string;
  exact: string;
};

export type DepsToUpdate = {
  depList: DepToUpdateItem[];
  devDepList: DepToUpdateItem[];
  peerDepList: DepToUpdateItem[];
  optionalDepList: DepToUpdateItem[];
};

export type ExecFunction = (
  command: string,
  args: string[],
  options?: { cwd?: string; maxRetries?: number; retryDelay?: number },
) => Promise<{ stdout: string; stderr: string }>;

export type ValidateFunction = (packageName: string) => {
  validForNewPackages: boolean;
  validForOldPackages: boolean;
  errors?: string[];
};

export type ConstructVersionMapOptions = {
  codependencies: CodeDependencies;
  exec?: ExecFunction;
  debug?: boolean;
  yarnConfig?: boolean;
  isTesting?: boolean;
  validate?: ValidateFunction;
  noCache?: boolean;
  onProgress?: (current: number, total: number, packageName: string) => void;
  resolveVersion?: (packageName: string) => Promise<string>;
  cachePrefix?: string;
};

export type PerformanceMetrics = {
  totalPackages: number;
  cacheHits: number;
  cacheMisses: number;
  durationMs: number;
  startTime: number;
};

export type VersionDiff = {
  package: string;
  current: string;
  latest: string;
  isPinned: boolean;
  willUpdate: boolean;
};

export type DependencyInfo = {
  name: string;
  current: string;
  latest: string;
  isPinned?: boolean;
};

export type InteractiveResult = {
  shouldUpdate: boolean;
  depNames: string[];
  versionMap: Record<string, string>;
};

export type ProgressHandler = NonNullable<CheckFiles["onProgress"]>;

export type TargetRunResult = {
  diffs: VersionDiff[];
  failed: boolean;
};

export type ActionConfigs = {
  baseConfig: Record<string, unknown>;
  pathConfig: Record<string, unknown>;
};
