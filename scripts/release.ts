import { spawnSync } from "node:child_process";
import {
  DEFAULT_RELEASE_TIMEOUT_MINUTES,
  PRE_RELEASES,
  RELEASE_INCREMENTS,
  RELEASE_POLL_INTERVAL_MS,
  RELEASE_VERSION_PATTERN,
  SAFE_SHELL_ARG_PATTERN,
  STABLE_VERSION_PATTERN,
} from "./constants";
import { readPackageVersion, runReleaseTag } from "./tag-release";
import type {
  PreRelease,
  ReleaseArgs,
  ReleaseIncrement,
  ReleaseItArgsOptions,
  ReleaseLogger,
  ReleaseOptions,
  ReleasePlan,
  ReleaseRunner,
  TagPlan,
} from "./types";

export type {
  PreRelease,
  ReleaseArgs,
  ReleaseIncrement,
  ReleaseItArgsOptions,
  ReleaseLogger,
  ReleaseOptions,
  ReleasePlan,
  ReleaseRunner,
  TagPlan,
} from "./types";

interface PullRequestState {
  mergeCommit?: { oid?: string } | null;
  mergeStateStatus?: string;
  mergedAt?: string | null;
  state: string;
}

interface ReleasePullRequest extends PullRequestState {
  url: string;
}

interface ReleaseContext {
  cwd: string;
  logger: ReleaseLogger;
  pollIntervalMs: number;
  runner: ReleaseRunner;
}

export function parseArgs(args: readonly string[]): ReleaseArgs {
  if (args.includes("--no-wait")) {
    throw new Error("--no-wait cannot safely tag the merged release commit");
  }

  const increment = parseIncrement(args);
  const preRelease = parsePreRelease(args);
  const timeoutMinutes = parseTimeout(args);
  const dryRun = args.includes("--dry-run");
  return Object.assign(
    { dryRun, timeoutMinutes },
    increment ? { increment } : undefined,
    preRelease ? { preRelease } : undefined,
  );
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
  const releaseArgs = options.preRelease ? [`--preRelease=${options.preRelease}`, ...args] : args;
  if (options.version) return [options.version, ...releaseArgs];
  if (options.increment) return [`--increment=${options.increment}`, ...releaseArgs];
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
  return [command, ...args].map(quoteShellArg).join(" ");
}

export function buildReleaseBranch(version: string): string {
  return `release/v${version}`;
}

export function buildPullRequestBody(version: string): string {
  return [
    `Release v${version}.`,
    "",
    "This PR was created by `bun run release`.",
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

function createReleaseContext(options: ReleaseOptions): ReleaseContext {
  const cwd = options.cwd ?? process.cwd();
  return {
    cwd,
    logger: options.logger ?? console,
    pollIntervalMs: options.pollIntervalMs ?? RELEASE_POLL_INTERVAL_MS,
    runner: options.runner ?? createRunner(cwd),
  };
}

function normalizeOptions(options: ReleaseOptions): ReleaseArgs {
  return {
    dryRun: options.dryRun ?? false,
    increment: options.increment,
    preRelease: options.preRelease,
    timeoutMinutes: options.timeoutMinutes ?? DEFAULT_RELEASE_TIMEOUT_MINUTES,
  };
}

function parseIncrement(args: readonly string[]): ReleaseIncrement | undefined {
  const flag = args.find((arg) => arg.startsWith("--increment="));
  const flagValue = flag?.split("=")[1];
  if (flagValue) return validateIncrement(flagValue);

  const positional = args.find((arg) => RELEASE_INCREMENTS.has(arg as ReleaseIncrement));
  return positional as ReleaseIncrement | undefined;
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
  if (Number.isInteger(timeout) && timeout > 0) return timeout;
  throw new Error(`Invalid timeout: ${value}`);
}

function commandText(runner: ReleaseRunner, command: string, args: readonly string[]): string {
  const result = runner(command, args);
  if (result.status === 0) return result.stdout.trim();
  throw new Error(result.stderr.trim() || `${command} ${args.join(" ")} failed`);
}

function runCommand(runner: ReleaseRunner, command: string, args: readonly string[]): void {
  commandText(runner, command, args);
}

function assertMainReady(runner: ReleaseRunner): void {
  const branch = commandText(runner, "git", ["branch", "--show-current"]);
  if (branch !== "main") throw new Error("Run releases from main");

  const status = commandText(runner, "git", ["status", "--short"]);
  if (status) throw new Error("Working tree must be clean before starting a release");
  assertMainMatchesOrigin(runner);
}

function assertMainMatchesOrigin(runner: ReleaseRunner): void {
  runCommand(runner, "git", ["fetch", "origin", "main", "--tags"]);
  const head = commandText(runner, "git", ["rev-parse", "HEAD"]);
  const upstream = commandText(runner, "git", ["rev-parse", "origin/main"]);
  if (head !== upstream) throw new Error("Local main must match origin/main before release");
}

export function isPreReleaseVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

export function isStableVersion(version: string): boolean {
  return STABLE_VERSION_PATTERN.test(version);
}

export function incrementPreReleaseVersion(version: string, preRelease: PreRelease): string {
  const match = version.match(/^(\d+\.\d+\.\d+)-([0-9A-Za-z.-]+)\.(\d+)(\+[0-9A-Za-z.-]+)?$/);
  if (!match || match[2] !== preRelease) {
    throw new Error(`Unable to advance ${preRelease} release version: ${version}`);
  }

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
  if (!isStableVersion(version)) {
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

function resolveReleaseVersion(runner: ReleaseRunner, releaseArgs: ReleaseArgs): string {
  const command = "./node_modules/.bin/release-it";
  const args = ["--release-version", ...buildReleaseItArgs(releaseArgs)];
  const version = parseReleaseVersion(commandText(runner, command, args));
  return resolveAvailableReleaseVersion(runner, releaseArgs, version);
}

function assertReleaseTagAvailable(runner: ReleaseRunner, version: string): void {
  const tagName = `v${version}`;
  if (releaseTagExists(runner, tagName)) throw new Error(`Release tag already exists: ${tagName}`);
}

function createReleaseCommit(
  runner: ReleaseRunner,
  releaseArgs: ReleaseArgs,
  version: string,
): void {
  const options = { preRelease: releaseArgs.preRelease, version };
  const args = buildReleaseItArgs(options);
  runCommand(runner, "./node_modules/.bin/release-it", args);
}

function buildPullRequestArgs(version: string, branch: string): string[] {
  const title = `chore(release): v${version}`;
  const body = buildPullRequestBody(version);
  return ["pr", "create", "--base", "main", "--head", branch, "--title", title, "--body", body];
}

function readPullRequestUrl(runner: ReleaseRunner, reference: string): string {
  const args = ["pr", "view", reference, "--json", "url"];
  const output = commandText(runner, "gh", args);
  const parsed = JSON.parse(output) as { url?: string };
  if (parsed.url) return parsed.url;
  throw new Error(`Unable to find release PR for ${reference}`);
}

function createPullRequest(context: ReleaseContext, version: string, branch: string): string {
  const result = context.runner("gh", buildPullRequestArgs(version, branch));
  if (result.status === 0) return result.stdout.trim();

  const error = result.stderr.trim() || "no error output";
  context.logger.warn(`gh pr create failed: ${error}`);
  return readPullRequestUrl(context.runner, branch);
}

function findReleasePullRequest(
  runner: ReleaseRunner,
  branch: string,
): ReleasePullRequest | undefined {
  const fields = "url,state,mergedAt,mergeCommit";
  const args = ["pr", "list", "--head", branch, "--state", "all", "--json", fields, "--limit", "1"];
  const pullRequests = JSON.parse(commandText(runner, "gh", args)) as ReleasePullRequest[];
  return pullRequests.at(0);
}

function localReleaseBranchExists(runner: ReleaseRunner, branch: string): boolean {
  const args = ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`];
  const result = runner("git", args);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(result.stderr.trim() || `Unable to check local branch: ${branch}`);
}

function remoteReleaseBranchExists(runner: ReleaseRunner, branch: string): boolean {
  const args = ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`];
  const result = runner("git", args);
  if (result.status === 0) return true;
  if (result.status === 2) return false;
  throw new Error(result.stderr.trim() || `Unable to check remote branch: ${branch}`);
}

function readBranchVersion(runner: ReleaseRunner, branch: string): string {
  const manifest = commandText(runner, "git", ["show", `${branch}:package.json`]);
  const { version } = JSON.parse(manifest) as { version?: unknown };
  if (typeof version === "string") return version;
  throw new Error(`package.json version is missing on ${branch}`);
}

function checkoutReleaseBranch(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
  branch: string,
): void {
  const exists = localReleaseBranchExists(context.runner, branch);
  const args = exists ? ["switch", branch] : ["switch", "--create", branch];
  runCommand(context.runner, "git", args);
  if (exists && readBranchVersion(context.runner, branch) === version) return;
  createReleaseCommit(context.runner, releaseArgs, version);
}

function restoreMain(runner: ReleaseRunner): void {
  const branch = commandText(runner, "git", ["branch", "--show-current"]);
  if (branch === "main") return;
  runCommand(runner, "git", ["switch", "main"]);
}

function pushReleaseBranch(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
  branch: string,
): void {
  try {
    checkoutReleaseBranch(context, releaseArgs, version, branch);
    runCommand(context.runner, "git", ["push", "--set-upstream", "origin", branch]);
  } finally {
    restoreMain(context.runner);
  }
}

function resolveReleasePullRequest(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
  branch: string,
): string {
  const existing = findReleasePullRequest(context.runner, branch);
  if (existing) {
    context.logger.log(`Resuming ${existing.url}`);
    return existing.url;
  }
  if (!remoteReleaseBranchExists(context.runner, branch)) {
    pushReleaseBranch(context, releaseArgs, version, branch);
  }
  const prUrl = createPullRequest(context, version, branch);
  context.logger.log(`Opened ${prUrl}`);
  return prUrl;
}

function readPullRequestState(
  runner: ReleaseRunner,
  prUrl: string,
  fields: string,
): PullRequestState {
  const args = ["pr", "view", prUrl, "--json", fields];
  const output = commandText(runner, "gh", args);
  const state = JSON.parse(output) as PullRequestState;
  return state;
}

function readMergeCommit(state: PullRequestState, prUrl: string): string {
  const mergeCommit = state.mergeCommit?.oid;
  if (mergeCommit) return mergeCommit;
  throw new Error(`Release PR is merged without a merge commit: ${prUrl}`);
}

function assertPullRequestOpen(state: PullRequestState, prUrl: string, deadline: number): void {
  if (state.state === "CLOSED") throw new Error(`Release PR closed without merging: ${prUrl}`);
  if (Date.now() <= deadline) return;
  throw new Error(`Timed out waiting for release PR: ${prUrl}`);
}

async function delay(milliseconds: number) {
  await Bun.sleep(milliseconds);
}

function refreshReleaseBranch(context: ReleaseContext, prUrl: string): void {
  context.logger.log(`Updating release PR branch from main: ${prUrl}`);
  runCommand(context.runner, "gh", ["pr", "update-branch", prUrl]);
}

function assertReadinessCanContinue(
  state: PullRequestState,
  prUrl: string,
  deadline: number,
): void {
  assertPullRequestOpen(state, prUrl, deadline);
  if (state.mergeStateStatus !== "DIRTY") return;
  throw new Error(`Release PR has merge conflicts: ${prUrl}`);
}

async function pollForMergeReadiness(context: ReleaseContext, prUrl: string, deadline: number) {
  const fields = "state,mergedAt,mergeCommit,mergeStateStatus";
  const state = readPullRequestState(context.runner, prUrl, fields);
  if (state.mergedAt) return readMergeCommit(state, prUrl);

  assertReadinessCanContinue(state, prUrl, deadline);
  const isMergeable = ["CLEAN", "UNSTABLE"].includes(state.mergeStateStatus ?? "");
  if (isMergeable) return undefined;
  if (state.mergeStateStatus === "BEHIND") refreshReleaseBranch(context, prUrl);

  context.logger.log(`Waiting for release PR checks to pass: ${prUrl}`);
  await delay(context.pollIntervalMs);
  return pollForMergeReadiness(context, prUrl, deadline);
}

async function waitForMergeCompletion(context: ReleaseContext, prUrl: string, deadline: number) {
  const fields = "state,mergedAt,mergeCommit";
  const state = readPullRequestState(context.runner, prUrl, fields);
  if (state.mergedAt) return readMergeCommit(state, prUrl);

  assertPullRequestOpen(state, prUrl, deadline);
  context.logger.log(`Waiting for release PR to merge: ${prUrl}`);
  await delay(context.pollIntervalMs);
  return waitForMergeCompletion(context, prUrl, deadline);
}

function mergeReleasePullRequest(context: ReleaseContext, prUrl: string, deadline: number) {
  const args = ["pr", "merge", "--squash", "--delete-branch", prUrl];
  runCommand(context.runner, "gh", args);
  return waitForMergeCompletion(context, prUrl, deadline);
}

function resolveMergeCommit(
  context: ReleaseContext,
  prUrl: string,
  deadline: number,
  existingMergeCommit?: string,
) {
  if (existingMergeCommit) return Promise.resolve(existingMergeCommit);
  return mergeReleasePullRequest(context, prUrl, deadline);
}

function checkoutMergedMain(runner: ReleaseRunner): void {
  runCommand(runner, "git", ["switch", "main"]);
  runCommand(runner, "git", ["pull", "--ff-only", "origin", "main"]);
}

function shouldTagCurrentVersion(releaseArgs: ReleaseArgs, packageVersion: string): boolean {
  const hasVersionChange = Boolean(releaseArgs.preRelease || releaseArgs.increment);
  return !hasVersionChange && isPreReleaseVersion(packageVersion);
}

function pushVersionTag(context: ReleaseContext, version: string, targetCommit?: string): number {
  const git = (args: readonly string[]) => context.runner("git", args);
  return runReleaseTag({
    cwd: context.cwd,
    git,
    logger: context.logger,
    targetCommit,
    version,
  });
}

function resumeMergedVersion(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
): number | undefined {
  if (releaseTagExists(context.runner, `v${version}`)) return undefined;
  const pullRequest = findReleasePullRequest(context.runner, buildReleaseBranch(version));
  if (!pullRequest?.mergedAt) return undefined;
  const mergeCommit = readMergeCommit(pullRequest, pullRequest.url);
  if (!releaseArgs.dryRun) return pushVersionTag(context, version, mergeCommit);
  context.logger.log(formatReleasePlan(buildCurrentVersionTagPlan(version)));
  return 0;
}

function runCurrentVersionRelease(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  packageVersion: string,
): number {
  if (!releaseArgs.dryRun) {
    const code = pushVersionTag(context, packageVersion);
    context.logger.log(`Tagged current package version ${packageVersion}.`);
    return code;
  }

  assertReleaseTagAvailable(context.runner, packageVersion);
  context.logger.log(formatReleasePlan(buildCurrentVersionTagPlan(packageVersion)));
  return 0;
}

function assertVersionChangeRequested(releaseArgs: ReleaseArgs): void {
  if (releaseArgs.preRelease || releaseArgs.increment) return;
  throw new Error("Stable releases require an explicit increment: patch, minor, or major");
}

async function publishReleasePullRequest(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
) {
  const branch = buildReleaseBranch(version);
  const prUrl = resolveReleasePullRequest(context, releaseArgs, version, branch);
  const deadline = Date.now() + releaseArgs.timeoutMinutes * 60_000;
  const existingCommit = await pollForMergeReadiness(context, prUrl, deadline);
  const mergeCommit = await resolveMergeCommit(context, prUrl, deadline, existingCommit);
  checkoutMergedMain(context.runner);
  return pushVersionTag(context, version, mergeCommit);
}

async function runVersionRelease(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  packageVersion: string,
) {
  assertVersionChangeRequested(releaseArgs);
  const resumed = resumeMergedVersion(context, releaseArgs, packageVersion);
  if (resumed !== undefined) return resumed;
  const version = resolveReleaseVersion(context.runner, releaseArgs);
  if (!releaseArgs.dryRun) return publishReleasePullRequest(context, releaseArgs, version);

  context.logger.log(formatReleasePlan(buildReleasePlan(version)));
  return 0;
}

export async function runRelease(options: ReleaseOptions = {}) {
  const context = createReleaseContext(options);
  const releaseArgs = normalizeOptions(options);
  assertMainReady(context.runner);
  const packageVersion = options.packageVersion ?? readPackageVersion(context.cwd);
  const isCurrentVersionRelease = shouldTagCurrentVersion(releaseArgs, packageVersion);
  if (isCurrentVersionRelease) {
    return runCurrentVersionRelease(context, releaseArgs, packageVersion);
  }
  return runVersionRelease(context, releaseArgs, packageVersion);
}

if (import.meta.main) {
  try {
    process.exitCode = await runRelease(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
