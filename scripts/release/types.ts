export interface GitResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type GitRunner = (args: readonly string[]) => GitResult;
export type TagReleaseLogger = Pick<Console, "error" | "log">;

export interface ReleaseTagOptions {
  cwd?: string;
  dryRun?: boolean;
  git?: GitRunner;
  logger?: TagReleaseLogger;
  requireUpstream?: boolean;
  targetCommit?: string;
  version?: string;
}

export interface ReleaseReadyOptions {
  dryRun?: boolean;
  requireUpstream?: boolean;
  targetCommit?: string;
}

export interface ReleaseTagArgs {
  dryRun: boolean;
}

export interface PackageManifest {
  version?: unknown;
}

export type PreRelease = "alpha" | "beta" | "rc";
export type ReleaseIncrement = "patch" | "minor" | "major";
export type ReleaseRunner = (command: string, args: readonly string[]) => GitResult;
export type ReleaseLogger = Pick<Console, "error" | "log" | "warn">;

export interface ReleaseOptions {
  cwd?: string;
  dryRun?: boolean;
  increment?: ReleaseIncrement;
  logger?: ReleaseLogger;
  packageVersion?: string;
  pollIntervalMs?: number;
  preRelease?: PreRelease;
  runner?: ReleaseRunner;
  timeoutMinutes?: number;
}

export interface ReleaseArgs {
  dryRun: boolean;
  increment?: ReleaseIncrement;
  preRelease?: PreRelease;
  timeoutMinutes: number;
}

export interface ReleaseItArgsOptions {
  increment?: ReleaseIncrement;
  preRelease?: PreRelease;
  version?: string;
}

export interface ReleasePlan {
  branch: string;
  pullRequestTitle: string;
  steps: string[];
  tagName: string;
  version: string;
}

export interface TagPlan {
  commands: string[];
  steps: string[];
  tagName: string;
  version: string;
}

export interface PullRequestState {
  mergeCommit?: { oid?: string } | null;
  mergeStateStatus?: string;
  mergedAt?: string | null;
  state: string;
}

export interface ReleasePullRequest extends PullRequestState {
  baseRefName?: string;
  headRefName?: string;
  headRefOid?: string;
  url: string;
}

export interface ReleasePullRequestTarget {
  headCommit?: string;
  mergeCommit?: string;
  url: string;
}

export interface ReleaseContext {
  cwd: string;
  logger: ReleaseLogger;
  pollIntervalMs: number;
  runner: ReleaseRunner;
}
