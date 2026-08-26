import {
  COMMIT_PATTERN,
  DEFAULT_RELEASE_TIMEOUT_MINUTES,
  PRE_RELEASE_VERSION_PATTERN,
  RELEASE_POLL_INTERVAL_MS,
  RELEASE_REPOSITORY,
  REMOVED_VERSION_LINE_PATTERN,
} from "./constants";
import {
  buildCurrentVersionTagPlan,
  buildPullRequestBody,
  buildReleaseBranch,
  buildReleaseItArgs,
  buildReleasePlan,
  commandText,
  createRunner,
  formatReleasePlan,
  parseArgs,
  parseReleaseVersion,
  parseTagArgs,
  readPackageVersion,
  releaseTagExists,
  resolveAvailableReleaseVersion,
  runReleaseTag,
} from "./utils";
import type {
  PullRequestState,
  ReleaseArgs,
  ReleaseContext,
  ReleaseOptions,
  ReleasePullRequest,
  ReleasePullRequestTarget,
  ReleaseRunner,
} from "./types";

export type {
  GitResult,
  GitRunner,
  PreRelease,
  ReleaseArgs,
  ReleaseIncrement,
  ReleaseItArgsOptions,
  ReleaseLogger,
  ReleaseOptions,
  ReleasePlan,
  ReleaseRunner,
  ReleaseTagOptions,
  TagPlan,
} from "./types";

export {
  assertMissingTag,
  assertReleaseReady,
  buildCurrentVersionTagPlan,
  buildPullRequestBody,
  buildReleaseBranch,
  buildReleaseItArgs,
  buildReleasePlan,
  buildTagPushArgs,
  commandText,
  createGitRunner,
  createRunner,
  formatReleasePlan,
  formatShellCommand,
  formatTagName,
  gitText,
  incrementPreReleaseVersion,
  incrementStableVersion,
  parseArgs,
  parseReleaseVersion,
  parseTagArgs,
  quoteShellArg,
  readPackageVersion,
  releaseTagExists,
  resolveAvailableReleaseVersion,
  runReleaseTag,
} from "./utils";

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

function resolveReleaseVersion(runner: ReleaseRunner, releaseArgs: ReleaseArgs): string {
  const command = "./node_modules/.bin/release-it";
  const args = ["--release-version"].concat(buildReleaseItArgs(releaseArgs));
  const version = parseReleaseVersion(commandText(runner, command, args));
  return resolveAvailableReleaseVersion(runner, releaseArgs, version);
}

function assertReleaseTagAvailable(runner: ReleaseRunner, version: string): void {
  const tagName = `v${version}`;
  if (releaseTagExists(runner, tagName)) throw new Error(`Release tag already exists: ${tagName}`);
}

function assertRepositoryAutoMergeEnabled(runner: ReleaseRunner): void {
  const args = ["api", `repos/${RELEASE_REPOSITORY}`, "--jq", ".allow_auto_merge"];
  const setting = commandText(runner, "gh", args);
  if (setting === "true") return;
  if (setting === "false")
    throw new Error(`enable "Allow auto-merge" on ${RELEASE_REPOSITORY}`);
  throw new Error(`Unable to read repository auto-merge setting for ${RELEASE_REPOSITORY}`);
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
  const fields = "url,state,mergedAt,mergeCommit,baseRefName,headRefName,headRefOid";
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

function ensureLocalReleaseBranch(runner: ReleaseRunner, branch: string): void {
  if (localReleaseBranchExists(runner, branch)) return;
  const source = `refs/heads/${branch}`;
  runCommand(runner, "git", ["fetch", "origin", `${source}:${source}`]);
}

function readRemoteReleaseBranchCommit(runner: ReleaseRunner, branch: string): string | undefined {
  const args = ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`];
  const result = runner("git", args);
  if (result.status === 2) return undefined;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Unable to check remote branch: ${branch}`);
  }
  const commit = result.stdout.trim().split(/\s+/)[0];
  if (COMMIT_PATTERN.test(commit)) return commit;
  throw new Error(`Invalid remote branch commit: ${branch}`);
}

function readRefVersion(runner: ReleaseRunner, ref: string): string {
  const manifest = commandText(runner, "git", ["show", `${ref}:package.json`]);
  const { version } = JSON.parse(manifest) as { version?: unknown };
  if (typeof version === "string") return version;
  throw new Error(`package.json version is missing on ${ref}`);
}

function isDiffChangeLine(line: string): boolean {
  const isChange = line.startsWith("+") || line.startsWith("-");
  const isHeader = line.startsWith("+++") || line.startsWith("---");
  const isReleaseChange = isChange && !isHeader;
  return isReleaseChange;
}

function assertReleaseDiff(
  runner: ReleaseRunner,
  base: string,
  target: string,
  version: string,
): void {
  const args = ["diff", "--unified=0", base, target, "--", "package.json"];
  const diff = commandText(runner, "git", args);
  const changes = diff.split("\n").filter(isDiffChangeLine);
  const addedVersion = `+  "version": "${version}",`;
  const isVersionOnly =
    changes.length === 2 &&
    REMOVED_VERSION_LINE_PATTERN.test(changes[0] ?? "") &&
    changes[1] === addedVersion;
  if (isVersionOnly) return;
  throw new Error(`Unverified release diff: ${target}`);
}

function assertReleaseFiles(runner: ReleaseRunner, target: string): void {
  const args = ["diff-tree", "--no-commit-id", "--name-only", "-r", target];
  const changedFiles = commandText(runner, "git", args);
  if (changedFiles === "package.json") return;
  throw new Error(`Unverified release files: ${target}`);
}

function assertReleaseCommitShape(runner: ReleaseRunner, branch: string, version: string): void {
  const parent = commandText(runner, "git", ["rev-parse", `${branch}^`]);
  const main = commandText(runner, "git", ["rev-parse", "origin/main"]);
  if (parent !== main) throw new Error(`Unverified release parent: ${branch}`);
  assertReleaseFiles(runner, branch);
  assertReleaseDiff(runner, "origin/main", branch, version);
}

function readFirstParent(runner: ReleaseRunner, commit: string): string {
  if (!COMMIT_PATTERN.test(commit)) throw new Error(`Invalid merge commit: ${commit}`);
  const args = ["rev-list", "--first-parent", "--parents", "origin/main"];
  const history = commandText(runner, "git", args);
  const commitLine = history.split("\n").find((line) => line.startsWith(`${commit} `));
  const parts = commitLine?.split(/\s+/) ?? [];
  if (parts.length === 2) return parts[1] ?? "";
  throw new Error(`Unverified release ancestry: ${commit}`);
}

function assertMergedReleaseCommit(runner: ReleaseRunner, commit: string, version: string): void {
  const parent = readFirstParent(runner, commit);
  const mergedVersion = readRefVersion(runner, commit);
  if (mergedVersion !== version) throw new Error(`Unexpected merged version: ${mergedVersion}`);
  assertReleaseFiles(runner, commit);
  assertReleaseDiff(runner, parent, commit, version);
}

function readReleaseBranchCommit(runner: ReleaseRunner, branch: string, version: string): string {
  const branchVersion = readRefVersion(runner, branch);
  if (branchVersion !== version)
    throw new Error(`Unexpected version on ${branch}: ${branchVersion}`);
  const title = commandText(runner, "git", ["log", "-1", "--format=%s", branch]);
  if (title !== `chore(release): ${version}`)
    throw new Error(`Unverified release commit: ${branch}`);
  assertReleaseCommitShape(runner, branch, version);
  return commandText(runner, "git", ["rev-parse", `refs/heads/${branch}`]);
}

function assertReleaseBranchBase(runner: ReleaseRunner, branch: string): void {
  const head = commandText(runner, "git", ["rev-parse", `refs/heads/${branch}`]);
  const main = commandText(runner, "git", ["rev-parse", "origin/main"]);
  if (head === main) return;
  throw new Error(`Unverified release branch: ${branch}`);
}

function checkoutReleaseBranch(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
  branch: string,
): string {
  const exists = localReleaseBranchExists(context.runner, branch);
  const args = exists ? ["switch", branch] : ["switch", "--create", branch];
  runCommand(context.runner, "git", args);
  const hasReleaseVersion = exists && readRefVersion(context.runner, branch) === version;
  const shouldAssertBranchBase = exists && !hasReleaseVersion;
  if (shouldAssertBranchBase) assertReleaseBranchBase(context.runner, branch);
  if (!hasReleaseVersion) createReleaseCommit(context.runner, releaseArgs, version);
  return readReleaseBranchCommit(context.runner, branch, version);
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
): string {
  try {
    const commit = checkoutReleaseBranch(context, releaseArgs, version, branch);
    runCommand(context.runner, "git", ["push", "--set-upstream", "origin", branch]);
    return commit;
  } finally {
    restoreMain(context.runner);
  }
}

function verifyExistingPullRequest(
  runner: ReleaseRunner,
  pullRequest: ReleasePullRequest,
  branch: string,
  version: string,
): string {
  assertPullRequestRefs(pullRequest, branch);
  ensureLocalReleaseBranch(runner, branch);
  const commit = readReleaseBranchCommit(runner, branch, version);
  if (pullRequest.headRefOid === commit) return commit;
  throw new Error(`Release PR head does not match ${branch}`);
}

function assertPullRequestRefs(pullRequest: ReleasePullRequest, branch: string): void {
  const hasExpectedRefs = pullRequest.baseRefName === "main" && pullRequest.headRefName === branch;
  if (hasExpectedRefs) return;
  throw new Error(`Unverified release PR: ${pullRequest.url}`);
}

function verifyMergedPullRequest(
  runner: ReleaseRunner,
  pullRequest: ReleasePullRequest,
  branch: string,
  version: string,
): string {
  assertPullRequestRefs(pullRequest, branch);
  const commit = readMergeCommit(pullRequest, pullRequest.url);
  assertMergedReleaseCommit(runner, commit, version);
  return commit;
}

function verifyRemoteReleaseBranch(
  runner: ReleaseRunner,
  branch: string,
  version: string,
  remoteCommit: string,
): string {
  ensureLocalReleaseBranch(runner, branch);
  const commit = readReleaseBranchCommit(runner, branch, version);
  if (remoteCommit === commit) return commit;
  throw new Error(`Remote release branch does not match ${branch}`);
}

function resumeReleasePullRequest(
  context: ReleaseContext,
  pullRequest: ReleasePullRequest | undefined,
  version: string,
  branch: string,
): ReleasePullRequestTarget | undefined {
  if (!pullRequest) return undefined;
  context.logger.log(`Resuming ${pullRequest.url}`);
  if (pullRequest.mergedAt) {
    const mergeCommit = verifyMergedPullRequest(context.runner, pullRequest, branch, version);
    return { mergeCommit, url: pullRequest.url };
  }
  const headCommit = verifyExistingPullRequest(context.runner, pullRequest, branch, version);
  return { headCommit, url: pullRequest.url };
}

function resolveReleaseBranchCommit(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
  branch: string,
): string {
  const remoteCommit = readRemoteReleaseBranchCommit(context.runner, branch);
  if (!remoteCommit) return pushReleaseBranch(context, releaseArgs, version, branch);
  return verifyRemoteReleaseBranch(context.runner, branch, version, remoteCommit);
}

function resolveReleasePullRequest(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
  branch: string,
): ReleasePullRequestTarget {
  const pullRequest = findReleasePullRequest(context.runner, branch);
  const resumed = resumeReleasePullRequest(context, pullRequest, version, branch);
  if (resumed) return resumed;
  const headCommit = resolveReleaseBranchCommit(context, releaseArgs, version, branch);
  const prUrl = createPullRequest(context, version, branch);
  context.logger.log(`Opened ${prUrl}`);
  return { headCommit, url: prUrl };
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
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function readAlreadyMergedCommit(
  context: ReleaseContext,
  prUrl: string,
  deadline: number,
): string | undefined {
  const fields = "state,mergedAt,mergeCommit,mergeStateStatus";
  const state = readPullRequestState(context.runner, prUrl, fields);
  if (state.mergedAt) return readMergeCommit(state, prUrl);
  assertReadinessCanContinue(state, prUrl, deadline);
  return undefined;
}

async function waitForMergeCompletion(context: ReleaseContext, prUrl: string, deadline: number) {
  const fields = "state,mergedAt,mergeCommit,mergeStateStatus";
  const state = readPullRequestState(context.runner, prUrl, fields);
  if (state.mergedAt) return readMergeCommit(state, prUrl);

  assertReadinessCanContinue(state, prUrl, deadline);
  context.logger.log(`Waiting for release PR to merge: ${prUrl}`);
  await delay(context.pollIntervalMs);
  return waitForMergeCompletion(context, prUrl, deadline);
}

function buildAutoMergeArgs(headCommit: string, prUrl: string): string[] {
  return [
    "pr",
    "merge",
    "--auto",
    "--squash",
    "--delete-branch",
    "--match-head-commit",
    headCommit,
    prUrl,
  ];
}

function queueReleasePullRequestAutoMerge(
  context: ReleaseContext,
  target: ReleasePullRequestTarget,
  deadline: number,
) {
  if (!target.headCommit) throw new Error(`Release PR head is unverified: ${target.url}`);
  const mergedCommit = readAlreadyMergedCommit(context, target.url, deadline);
  if (mergedCommit) return Promise.resolve(mergedCommit);
  const args = buildAutoMergeArgs(target.headCommit, target.url);
  runCommand(context.runner, "gh", args);
  return waitForMergeCompletion(context, target.url, deadline);
}

function resolveMergeCommit(
  context: ReleaseContext,
  target: ReleasePullRequestTarget,
  deadline: number,
) {
  if (target.mergeCommit) return Promise.resolve(target.mergeCommit);
  return queueReleasePullRequestAutoMerge(context, target, deadline);
}

function checkoutMergedMain(runner: ReleaseRunner): void {
  runCommand(runner, "git", ["switch", "main"]);
  runCommand(runner, "git", ["pull", "--ff-only", "origin", "main"]);
}

function shouldTagCurrentVersion(releaseArgs: ReleaseArgs, packageVersion: string): boolean {
  const hasVersionChange = Boolean(releaseArgs.preRelease || releaseArgs.increment);
  const isPreRelease = PRE_RELEASE_VERSION_PATTERN.test(packageVersion);
  const shouldTagCurrent = !hasVersionChange && isPreRelease;
  return shouldTagCurrent;
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
  const branch = buildReleaseBranch(version);
  const pullRequest = findReleasePullRequest(context.runner, branch);
  if (!pullRequest?.mergedAt) return undefined;
  const mergeCommit = verifyMergedPullRequest(context.runner, pullRequest, branch, version);
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
  const hasVersionChange = releaseArgs.preRelease || releaseArgs.increment;
  if (hasVersionChange) return;
  throw new Error("Stable releases require an explicit increment: patch, minor, or major");
}

async function publishReleasePullRequest(
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
) {
  const branch = buildReleaseBranch(version);
  const target = resolveReleasePullRequest(context, releaseArgs, version, branch);
  const deadline = Date.now() + releaseArgs.timeoutMinutes * 60_000;
  const mergeCommit = await resolveMergeCommit(context, target, deadline);
  checkoutMergedMain(context.runner);
  assertMergedReleaseCommit(context.runner, mergeCommit, version);
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
  if (!releaseArgs.dryRun) assertRepositoryAutoMergeEnabled(context.runner);
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

const isTagCommand = process.argv[2] === "tag";
const shouldRunTagCommand = Boolean(import.meta.main) && isTagCommand;
const shouldRunReleaseCommand = Boolean(import.meta.main) && !isTagCommand;

if (shouldRunTagCommand) {
  try {
    process.exitCode = runReleaseTag(parseTagArgs(process.argv.slice(3)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (shouldRunReleaseCommand) {
  try {
    process.exitCode = await runRelease(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
