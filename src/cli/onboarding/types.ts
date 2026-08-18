import type { DependencyManager } from "../../types";

export class OnboardingError extends Error {
  readonly cause?: unknown;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super(message);
    this.name = "OnboardingError";
    this.cause = cause;
  }
}

export type OnboardingManager = "bun" | "npm" | "pnpm" | "yarn";

export type OnboardingMode = "verbose" | "precise";

export type OnboardingEnforcement = "local" | "github" | "both";

export type OnboardingDependencySection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

export interface OnboardingSourceFile {
  path: string;
  content: string;
}

export interface OnboardingFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export type OnboardingFetcher = (url: string) => Promise<OnboardingFetchResponse>;

export interface OnboardingPackageJson {
  name?: string;
  packageManager?: string;
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface OnboardingManifest {
  path: string;
  name: string;
  manager: DependencyManager;
}

export interface OnboardingDependencyUsage {
  path: string;
  range: string;
  sections: OnboardingDependencySection[];
}

export interface OnboardingDependency {
  name: string;
  usages: OnboardingDependencyUsage[];
}

export interface OnboardingProject {
  manager?: OnboardingManager;
  managerVersion?: string;
  workspace: boolean;
  manifests: OnboardingManifest[];
  dependencies: OnboardingDependency[];
}

export interface ParsedOnboardingManifest extends Omit<OnboardingManifest, "manager"> {
  packageJson: OnboardingPackageJson;
}

export interface DependencyUsageEntry extends OnboardingDependencyUsage {
  name: string;
}

export interface OnboardingRepository {
  owner: string;
  name: string;
}

export interface OnboardingAnswers {
  mode: OnboardingMode;
  selectedDependencies: string[];
  enforcement: OnboardingEnforcement;
  repository?: OnboardingRepository;
}

export interface OnboardingArtifact {
  path: string;
  content: string;
}

export interface OnboardingTokenSetup {
  secretName: string;
  personalAccessTokenUrl: string;
  repositorySecretUrl: string;
  permissions: string[];
}

export interface OnboardingCommand {
  command: OnboardingManager;
  args: string[];
}

export interface OnboardingSetup {
  artifacts: OnboardingArtifact[];
  installCommand?: string;
  install?: OnboardingCommand;
  verifyCommand: string;
  tokenSetup?: OnboardingTokenSetup;
}

export interface OnboardingCommandSet {
  installCommand?: string;
  install?: OnboardingCommand;
  verifyCommand: string;
}

export interface OnboardingManagerDetection {
  manager: OnboardingManager;
  managerVersion?: string;
}

export interface RepositoryMetadata {
  defaultBranch: string;
}

export interface RepositoryTreeEntry {
  path: string;
  type: string;
}

export interface RepositoryTree {
  tree: RepositoryTreeEntry[];
  truncated: boolean;
}

export interface WorkspaceMatchState {
  excluded: boolean;
  included: boolean;
}
