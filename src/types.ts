export type Options = {
  isTestingCLI?: boolean;
  codependencies?: Record<string, string>;
  files?: Array<string>;
  rootDir?: string;
  ignore?: Array<string>;
  update?: boolean;
  debug?: boolean;
  silent?: boolean;
  addDeps?: boolean;
  install?: boolean;
};

export type CheckFiles = {
  codependencies?: Record<string, string>;
  files?: Array<string>;
  rootDir?: string;
  ignore?: Array<string>;
  update?: boolean;
  debug?: boolean;
  silent?: boolean;
  addDeps?: boolean;
  install?: boolean;
};

export type CheckDependenciesForVersionOptions = {
  isUpdating?: boolean;
  isDebugging?: boolean;
  isSilent?: boolean;
  isAddingDeps?: boolean;
  isInstallingDeps?: boolean;
};

export type CheckMatches = {
  codependencies?: Record<string, string>;
  rootDir: string;
  files: Array<string>;
  isUpdating?: boolean;
  isDebugging?: boolean;
  isSilent?: boolean;
  isAddingDeps?: boolean;
  isInstallingDeps?: boolean;
};

export type PackageJSON = {
  path: string;
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
};

export type DepsToUpdate = {
  depList: DepToUpdateItem[];
  devDepList: DepToUpdateItem[];
  peerDepList: DepToUpdateItem[];
};
