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
  version?: string;
}

export interface ReleaseReadyOptions {
  dryRun?: boolean;
  requireUpstream?: boolean;
}

export interface ReleaseTagArgs {
  dryRun: boolean;
}

export interface PackageManifest {
  version?: unknown;
}

export type PreRelease = "alpha" | "beta" | "rc";
export type ReleaseRunner = (
  command: string,
  args: readonly string[],
) => GitResult;
export type ReleaseLogger = Pick<Console, "error" | "log" | "warn">;

export interface ReleaseOptions {
  cwd?: string;
  dryRun?: boolean;
  logger?: ReleaseLogger;
  preRelease?: PreRelease;
  runner?: ReleaseRunner;
}

export interface ReleaseArgs {
  dryRun: boolean;
  preRelease?: PreRelease;
}

export interface ReleaseItArgsOptions {
  preRelease?: PreRelease;
  version?: string;
}

export interface ReleasePlan {
  commands: string[];
  steps: string[];
  tagName: string;
  version: string;
}
