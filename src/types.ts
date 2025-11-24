export type CodeDependenciesItem = string | Record<string, string>;
export type CodeDependencies = Array<CodeDependenciesItem>;

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
  dryRun?: boolean;
  interactive?: boolean;
  watch?: boolean;
  noCache?: boolean;
  format?: "json" | "markdown" | "table";
  outputFile?: string;
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
  dryRun?: boolean;
  interactive?: boolean;
  noCache?: boolean;
  format?: "json" | "markdown" | "table";
  onProgress?: (current: number, total: number, packageName: string) => void;
};

export type CheckDependenciesForVersionOptions = {
  isUpdating?: boolean;
  isDebugging?: boolean;
  isSilent?: boolean;
  isVerbose?: boolean;
  isQuiet?: boolean;
  isTesting?: boolean;
  permissive?: boolean;
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
};

export type CodependenceConfig = {
  codependencies?: CodeDependencies;
  permissive?: boolean;
};

export type PackageJSON = {
  path: string;
  codependence?: CodependenceConfig;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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
