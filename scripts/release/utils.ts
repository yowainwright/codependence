import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMMIT_PATTERN,
  DEFAULT_RELEASE_TIMEOUT_MINUTES,
  PRE_RELEASES,
  RELEASE_INCREMENTS,
  RELEASE_VERSION_PATTERN,
  SAFE_SHELL_ARG_PATTERN,
  STABLE_VERSION_PATTERN,
  TAG_VERSION_PATTERN,
} from "./constants";
import type {
  GitRunner,
  PackageManifest,
  PreRelease,
  ReleaseArgs,
  ReleaseIncrement,
  ReleaseItArgsOptions,
  ReleasePlan,
  ReleaseReadyOptions,
  ReleaseRunner,
  ReleaseTagArgs,
  ReleaseTagOptions,
  TagPlan,
} from "./types";

export type { GitResult, GitRunner, ReleaseTagOptions } from "./types";

function parseIncrement(args: readonly string[]): ReleaseIncrement | undefined {
  const flag = args.find((arg) => arg.startsWith("--increment="));
  const flagValue = flag?.split("=")[1];
  if (flagValue) return validateIncrement(flagValue);

  const argSet = new Set(args);
  return Array.from(RELEASE_INCREMENTS).find((increment) => argSet.has(increment));
}

function validateIncrement(value: string): ReleaseIncrement {
  if (RELEASE_INCREMENTS.has(value as ReleaseIncrement)) return value as ReleaseIncrement;
  throw new Error(`Invalid release increment: ${value}`);
}

function parsePreRelease(args: readonly string[]): PreRelease | undefined {
  const flag = args.find((arg) => arg.startsWith("--preRelease="));
  const value = flag?.split("=")[1];
  if (!value) return undefined;
  if (PRE_RELEASES.has(value as PreRelease)) return value as PreRelease;
  throw new Error(`Invalid prerelease identifier: ${value}`);
}

function parseTimeout(args: readonly string[]): number {
  const flag = args.find((arg) => arg.startsWith("--timeout-minutes="));
  const value = flag?.split("=")[1];
  if (!value) return DEFAULT_RELEASE_TIMEOUT_MINUTES;

  const timeout = Number(value);
  const isPositiveInteger = Number.isInteger(timeout) && timeout > 0;
  if (isPositiveInteger) return timeout;
  throw new Error(`Invalid timeout: ${value}`);
}

export function parseArgs(args: readonly string[]): ReleaseArgs {
  const argSet = new Set(args);
  if (argSet.has("--no-wait"))
    throw new Error("--no-wait cannot safely tag the merged release commit");

  const increment = parseIncrement(args);
  const preRelease = parsePreRelease(args);
  const timeoutMinutes = parseTimeout(args);
  const dryRun = argSet.has("--dry-run");
  const options = { dryRun, timeoutMinutes };
  const incrementOption = increment ? { increment } : undefined;
  const preReleaseOption = preRelease ? { preRelease } : undefined;
  return Object.assign(options, incrementOption, preReleaseOption);
}

function baseReleaseItArgs(): string[] {
  return [
    "--git.tag=false",
    "--git.push=false",
    "--git.requireUpstream=false",
    "--git.getLatestTagFromAllRefs=true",
    "--ci",
  ];
}

export function buildReleaseItArgs(options: ReleaseItArgsOptions): string[] {
  const args = baseReleaseItArgs();
  const preReleaseArgs = [`--preRelease=${options.preRelease}`].concat(args);
  const releaseArgs = options.preRelease ? preReleaseArgs : args;
  if (options.version) return [options.version].concat(releaseArgs);
  if (options.increment) return [`--increment=${options.increment}`].concat(releaseArgs);
  return releaseArgs;
}

export function parseReleaseVersion(output: string): string {
  const matches = output.match(RELEASE_VERSION_PATTERN);
  const version = matches?.at(-1);
  if (!version) throw new Error("Unable to resolve release version");
  return version;
}

export function quoteShellArg(arg: string): string {
  if (SAFE_SHELL_ARG_PATTERN.test(arg)) return arg;
  return JSON.stringify(arg);
}

export function formatShellCommand(command: string, args: readonly string[]): string {
  return [command].concat(args).map(quoteShellArg).join(" ");
}

export function buildReleaseBranch(version: string): string {
  return `release/v${version}`;
}

export function buildPullRequestBody(version: string): string {
  return [
    `Release v${version}.`,
    "",
    "This PR was created by `nub run release`.",
    "After checks pass, the release command merges this PR and pushes the version tag.",
  ].join("\n");
}

function buildReleaseSteps(branch: string, tagName: string): string[] {
  return [
    "verify clean, up-to-date main",
    `create ${branch}`,
    "run release-it without pushing main or creating a tag",
    "push the release branch",
    "open a release PR",
    "wait for required checks",
    "squash-merge the release PR",
    "pull merged main",
    `push ${tagName} to trigger publishing`,
  ];
}

export function buildReleasePlan(version: string): ReleasePlan {
  const branch = buildReleaseBranch(version);
  const tagName = `v${version}`;
  return {
    branch,
    pullRequestTitle: `chore(release): ${tagName}`,
    steps: buildReleaseSteps(branch, tagName),
    tagName,
    version,
  };
}

export function buildCurrentVersionTagPlan(version: string): TagPlan {
  const tagName = `v${version}`;
  const tagArgs = ["tag", "--annotate", tagName, "--message", `Release ${version}`];
  return {
    commands: [
      formatShellCommand("git", tagArgs),
      formatShellCommand("git", ["push", "origin", `refs/tags/${tagName}`]),
    ],
    steps: ["verify clean, up-to-date main", `push ${tagName} to trigger publishing`],
    tagName,
    version,
  };
}

function formatDetailedPlan(plan: ReleasePlan, summary: string[]): string {
  const steps = plan.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const details = [`Branch: ${plan.branch}`, `PR title: ${plan.pullRequestTitle}`];
  return summary.concat(details, "", steps).join("\n");
}

export function formatReleasePlan(plan: ReleasePlan | TagPlan): string {
  const summary = [`Dry run release commands for ${plan.tagName}`, `Version: ${plan.version}`];
  if ("branch" in plan) return formatDetailedPlan(plan, summary);

  const steps = plan.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const commands = plan.commands.map((command, index) => `${index + 1}. ${command}`).join("\n");
  return summary.concat("", "Steps:", steps, "", "Commands:", commands).join("\n");
}

export function createRunner(cwd: string): ReleaseRunner {
  return (command, args) => {
    const result = spawnSync(command, Array.from(args), { cwd, encoding: "utf8" });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  };
}

export function commandText(
  runner: ReleaseRunner,
  command: string,
  args: readonly string[],
): string {
  const result = runner(command, args);
  if (result.status === 0) return result.stdout.trim();
  throw new Error(result.stderr.trim() || `${command} ${args.join(" ")} failed`);
}

export function incrementPreReleaseVersion(version: string, preRelease: PreRelease): string {
  const match = version.match(/^(\d+\.\d+\.\d+)-([0-9A-Za-z.-]+)\.(\d+)(\+[0-9A-Za-z.-]+)?$/);
  if (!match) throw new Error(`Unable to advance ${preRelease} release version: ${version}`);
  const hasMatchingIdentifier = match[2] === preRelease;
  if (!hasMatchingIdentifier)
    throw new Error(`Unable to advance ${preRelease} release version: ${version}`);

  const next = Number(match[3]) + 1;
  return `${match[1]}-${preRelease}.${next}${match[4] ?? ""}`;
}

export function incrementStableVersion(version: string, increment: ReleaseIncrement): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Unable to advance stable release version: ${version}`);

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (increment === "major") return `${major + 1}.0.0`;
  if (increment === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function releaseTagExists(runner: ReleaseRunner, tagName: string): boolean {
  const local = runner("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`]);
  if (local.status === 0) return true;
  if (local.stderr.trim()) throw new Error(local.stderr.trim());

  const remote = runner("git", ["ls-remote", "--tags", "origin", `refs/tags/${tagName}`]);
  if (remote.status !== 0) {
    throw new Error(remote.stderr.trim() || `Unable to check remote tag: ${tagName}`);
  }
  return remote.stdout.trim().length > 0;
}

function resolveStableVersion(
  runner: ReleaseRunner,
  version: string,
  increment: ReleaseIncrement,
  attempt = 0,
): string {
  if (attempt >= 100) throw new Error(`Unable to find an available release tag for ${version}`);
  if (!releaseTagExists(runner, `v${version}`)) return version;
  const candidate = incrementStableVersion(version, increment);
  return resolveStableVersion(runner, candidate, increment, attempt + 1);
}

function resolvePreReleaseVersion(
  runner: ReleaseRunner,
  version: string,
  preRelease: PreRelease,
  attempt = 0,
): string {
  if (attempt >= 100) throw new Error(`Unable to find an available release tag for ${version}`);
  if (!releaseTagExists(runner, `v${version}`)) return version;
  const candidate = incrementPreReleaseVersion(version, preRelease);
  return resolvePreReleaseVersion(runner, candidate, preRelease, attempt + 1);
}

function resolveStableReleaseVersion(
  runner: ReleaseRunner,
  releaseArgs: ReleaseArgs,
  version: string,
): string {
  if (!releaseArgs.increment) {
    throw new Error("Stable release resolution requires an explicit increment");
  }
  if (!STABLE_VERSION_PATTERN.test(version)) {
    throw new Error(`release-it resolved a prerelease version for a stable release: ${version}`);
  }
  return resolveStableVersion(runner, version, releaseArgs.increment);
}

export function resolveAvailableReleaseVersion(
  runner: ReleaseRunner,
  releaseArgs: ReleaseArgs,
  version: string,
): string {
  if (!releaseArgs.preRelease) return resolveStableReleaseVersion(runner, releaseArgs, version);
  return resolvePreReleaseVersion(runner, version, releaseArgs.preRelease);
}

export function parseTagArgs(args: readonly string[]): ReleaseTagArgs {
  return { dryRun: args.includes("--dry-run") };
}

export function formatTagName(version: string): string {
  if (!TAG_VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid package version: ${version}`);
  }
  return `v${version}`;
}

export function buildTagPushArgs(tagName: string): string[] {
  return ["push", "origin", `refs/tags/${tagName}`];
}

export function readPackageVersion(cwd: string): string {
  const manifest = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as PackageManifest;
  if (typeof manifest.version !== "string") throw new Error("package.json version is missing");
  return manifest.version;
}

export function createGitRunner(cwd: string): GitRunner {
  return (args) => {
    const result = spawnSync("git", Array.from(args), { cwd, encoding: "utf8" });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  };
}

export function gitText(git: GitRunner, args: readonly string[], message: string): string {
  const result = git(args);
  if (result.status === 0) return result.stdout.trim();
  throw new Error(result.stderr.trim() || message);
}

export function assertMissingTag(git: GitRunner, tagName: string): void {
  const localTag = git(["rev-parse", "-q", "--verify", `refs/tags/${tagName}`]);
  if (localTag.status === 0) throw new Error(`Local tag already exists: ${tagName}`);

  const remoteTag = git(["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tagName}`]);
  if (remoteTag.status === 0) throw new Error(`Remote tag already exists: ${tagName}`);
  if (remoteTag.status === 2) return;
  throw new Error(remoteTag.stderr.trim() || `Unable to check remote tag: ${tagName}`);
}

function assertTargetCommitOnMain(git: GitRunner, targetCommit: string): void {
  if (!COMMIT_PATTERN.test(targetCommit)) throw new Error(`Invalid target commit: ${targetCommit}`);

  const result = git(["merge-base", "--is-ancestor", targetCommit, "origin/main"]);
  if (result.status === 0) return;
  throw new Error(`Target commit is not on origin/main: ${targetCommit}`);
}

export function assertReleaseReady(
  git: GitRunner,
  tagName: string,
  { dryRun = false, requireUpstream = true, targetCommit }: ReleaseReadyOptions = {},
): void {
  const branch = gitText(git, ["branch", "--show-current"], "Unable to read current branch");
  if (branch !== "main") throw new Error("Release tags must be created from main");

  const status = gitText(git, ["status", "--short"], "Unable to read working tree status");
  if (status) throw new Error("Working tree must be clean before tagging a release");

  if (!dryRun) gitText(git, ["fetch", "origin", "main", "--tags"], "Unable to fetch origin/main");
  if (targetCommit) assertTargetCommitOnMain(git, targetCommit);
  if (!requireUpstream) {
    assertMissingTag(git, tagName);
    return;
  }

  const head = gitText(git, ["rev-parse", "HEAD"], "Unable to read HEAD");
  const upstream = gitText(git, ["rev-parse", "origin/main"], "Unable to read origin/main");
  if (head !== upstream) throw new Error("Local main must match origin/main before tagging");

  assertMissingTag(git, tagName);
}

function buildCreateTagArgs(version: string, tagName: string, targetCommit?: string): string[] {
  const args = ["tag", "--annotate", tagName, "--message", `Release ${version}`];
  if (targetCommit) return args.concat(targetCommit);
  return args;
}

export function runReleaseTag({
  cwd = process.cwd(),
  dryRun = false,
  git = createGitRunner(cwd),
  logger = console,
  requireUpstream = true,
  targetCommit,
  version = readPackageVersion(cwd),
}: ReleaseTagOptions = {}): number {
  const tagName = formatTagName(version);
  assertReleaseReady(git, tagName, { dryRun, requireUpstream, targetCommit });

  if (dryRun) {
    logger.log(`Dry run: would create and push ${tagName}`);
    return 0;
  }

  const createTagArgs = buildCreateTagArgs(version, tagName, targetCommit);
  gitText(git, createTagArgs, "Unable to create tag");
  const push = git(buildTagPushArgs(tagName));
  if (push.status === 0) {
    logger.log(`Pushed ${tagName}`);
    return 0;
  }

  git(["tag", "--delete", tagName]);
  throw new Error(push.stderr.trim() || `Unable to push ${tagName}`);
}
