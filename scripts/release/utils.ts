import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADDED_SCHEMA_REVISION_LINE_PATTERN,
  ADDED_SCHEMA_UPDATED_LINE_PATTERN,
  COMMIT_PATTERN,
  CONFIG_SCHEMA_PATH,
  DEFAULT_RELEASE_TIMEOUT_MINUTES,
  FORMULA_BODY,
  FORMULA_HEADER,
  HOMEBREW_STABLE_VERSION_PATTERN,
  PACKAGE_JSON_PATH,
  PACKAGE_RELEASE_FILES,
  PRE_RELEASES,
  PRE_RELEASE_VERSION_PATTERN,
  PUBLISHED_RELEASE_VERSION_PATTERN,
  RELEASE_FILES,
  RELEASE_INCREMENTS,
  RELEASE_POLL_INTERVAL_MS,
  RELEASE_REPOSITORY,
  RELEASE_VERSION_PATTERN,
  REMOVED_SCHEMA_REVISION_LINE_PATTERN,
  REMOVED_SCHEMA_UPDATED_LINE_PATTERN,
  REMOVED_VERSION_LINE_PATTERN,
  SAFE_SHELL_ARG_PATTERN,
  SCHEMA_REVISION_LINE_PATTERN,
  SCHEMA_UPDATED_LINE_PATTERN,
  STABLE_VERSION_PATTERN,
  TAG_VERSION_PATTERN,
  TEST_PUBLISHED_RELEASE_COMMANDS,
} from "./constants";
import type {
  BrewCliOptions,
  Fetch,
  FormulaInput,
  FormulaOptions,
  FormulaSource,
  GitHubRelease,
  GitResult,
  GitRunner,
  HomebrewReleaseState,
  HomebrewReleaseStateOptions,
  HomebrewTapUpdateOptions,
  HomebrewTapUpdateResult,
  LocalFormulaOptions,
  PackageManifest,
  PreRelease,
  PublishedFormulaOptions,
  PublishedReleaseOptions,
  PullRequestState,
  ReleaseArgs,
  ReleaseAsset,
  ReleaseAssetUploadOptions,
  ReleaseIncrement,
  ReleaseItArgsOptions,
  ReleaseOptions,
  ReleasePlan,
  ReleasePullRequest,
  ReleasePullRequestTarget,
  ReleaseReadyOptions,
  ReleaseRunner,
  ReleaseTagArgs,
  ReleaseTagOptions,
  ReportOptions,
  TagPlan,
} from "./types";
import { readToolVersionInputs, resolveToolVersions } from "../ci/tool-versions.js";

export type { GitResult, GitRunner, ReleaseTagOptions } from "./types";

type ConfigSchema = Record<string, unknown>;

export const sha256 = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

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
    "GitHub auto-merges this PR after checks and reviews pass.",
    "The release command then pushes the version tag.",
  ].join("\n");
}

function buildReleaseSteps(branch: string, tagName: string): string[] {
  return [
    "verify clean, up-to-date main",
    "verify repository auto-merge is enabled",
    `create ${branch}`,
    "run release-it without pushing main or creating a tag",
    "stamp schema metadata from the release version",
    "push the release branch",
    "open a release PR",
    "queue auto-merge for the release PR",
    "wait for GitHub to merge the release PR",
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

export function formatReleaseDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function updateSchemaMetadata(
  schema: ConfigSchema,
  version: string,
  date = new Date(),
): ConfigSchema {
  formatTagName(version);
  return {
    ...schema,
    "x-revision": version,
    "x-updated": formatReleaseDate(date),
  };
}

function replaceJsonField(content: string, key: string, value: unknown): string {
  const pattern = new RegExp(`^(\\s*"${key}"\\s*:\\s*)[^,\\n]*(,?)$`, "m");
  if (!pattern.test(content)) throw new Error(`schema ${key} is missing`);
  return content.replace(pattern, `$1${JSON.stringify(value)}$2`);
}

export function renderSchemaMetadata(content: string, version: string, date = new Date()): string {
  const schema = JSON.parse(content) as ConfigSchema;
  const updatedSchema = updateSchemaMetadata(schema, version, date);
  const withRevision = replaceJsonField(content, "x-revision", updatedSchema["x-revision"]);
  return replaceJsonField(withRevision, "x-updated", updatedSchema["x-updated"]);
}

export function writeSchemaMetadata(cwd: string, version: string, date = new Date()): void {
  const schemaPath = join(cwd, CONFIG_SCHEMA_PATH);
  const content = readFileSync(schemaPath, "utf8");
  writeFileSync(schemaPath, renderSchemaMetadata(content, version, date));
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

export function createSpawnRunner(cwd = process.cwd()): ReleaseRunner {
  return createRunner(cwd);
}

export function commandSucceeded(result: GitResult): boolean {
  return result.status === 0;
}

export function runOrThrow(
  runner: ReleaseRunner,
  command: string,
  args: readonly string[],
): GitResult {
  const result = runner(command, args);
  if (commandSucceeded(result)) return result;
  throw new Error(`${command} ${args.join(" ")} failed`);
}

export const requiredEnv = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name];
  if (value) return value;
  throw new Error(`${name} is required`);
};

export function requireVersion(version: string | undefined, command: string): asserts version {
  if (!version) throw new Error(`CODEPENDENCE_VERSION is required for ${command}`);
}

function createReleaseContext(options: ReleaseOptions): ReleaseContext {
  const cwd = options.cwd ?? process.cwd();
  return {
    cwd,
    logger: options.logger ?? console,
    pollIntervalMs: options.pollIntervalMs ?? RELEASE_POLL_INTERVAL_MS,
    runner: options.runner ?? createRunner(cwd),
    schemaMetadataWriter: options.schemaMetadataWriter ?? writeSchemaMetadata,
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
  context: ReleaseContext,
  releaseArgs: ReleaseArgs,
  version: string,
): void {
  const options = { preRelease: releaseArgs.preRelease, version };
  const args = buildReleaseItArgs(options);
  runCommand(context.runner, "./node_modules/.bin/release-it", args);
  context.schemaMetadataWriter(context.cwd, version);
  runCommand(context.runner, "git", ["add", CONFIG_SCHEMA_PATH]);
  runCommand(context.runner, "git", ["commit", "--amend", "--no-edit", "--no-verify"]);
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

function assertPackageReleaseDiff(
  runner: ReleaseRunner,
  base: string,
  target: string,
  version: string,
): void {
  const args = ["diff", "--unified=0", base, target, "--", PACKAGE_JSON_PATH];
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

function isAddedSchemaRevisionLine(line: string, version: string): boolean {
  const match = line.match(ADDED_SCHEMA_REVISION_LINE_PATTERN);
  if (!match) return false;
  return match[1] === version;
}

function assertSchemaRevisionChange(changes: readonly string[], version: string): void {
  const revisionChanges = changes.filter((line) => SCHEMA_REVISION_LINE_PATTERN.test(line));
  const [removedRevision, addedRevision] = revisionChanges;
  const hasTwoRevisionChanges = revisionChanges.length === 2;
  const hasRemovedRevision = REMOVED_SCHEMA_REVISION_LINE_PATTERN.test(removedRevision ?? "");
  const hasAddedRevision = isAddedSchemaRevisionLine(addedRevision ?? "", version);
  const hasRevisionChange = hasTwoRevisionChanges && hasRemovedRevision && hasAddedRevision;

  if (hasRevisionChange) return;
  throw new Error("Unverified release schema revision");
}

function assertSchemaUpdatedChange(changes: readonly string[]): void {
  const updatedChanges = changes.filter((line) => SCHEMA_UPDATED_LINE_PATTERN.test(line));
  if (updatedChanges.length === 0) return;
  const [removedUpdated, addedUpdated] = updatedChanges;
  const hasTwoUpdatedChanges = updatedChanges.length === 2;
  const hasRemovedUpdated = REMOVED_SCHEMA_UPDATED_LINE_PATTERN.test(removedUpdated ?? "");
  const hasAddedUpdated = ADDED_SCHEMA_UPDATED_LINE_PATTERN.test(addedUpdated ?? "");
  const hasUpdatedChange = hasTwoUpdatedChanges && hasRemovedUpdated && hasAddedUpdated;

  if (hasUpdatedChange) return;
  throw new Error("Unverified release schema date");
}

function assertSchemaReleaseDiff(
  runner: ReleaseRunner,
  base: string,
  target: string,
  version: string,
): void {
  const args = ["diff", "--unified=0", base, target, "--", CONFIG_SCHEMA_PATH];
  const diff = commandText(runner, "git", args);
  const changes = diff.split("\n").filter(isDiffChangeLine);
  const metadataChanges = changes.filter((line) => {
    const isRevision = SCHEMA_REVISION_LINE_PATTERN.test(line);
    const isUpdated = SCHEMA_UPDATED_LINE_PATTERN.test(line);
    return isRevision || isUpdated;
  });
  if (changes.length !== metadataChanges.length) {
    throw new Error(`Unverified release diff: ${target}`);
  }
  assertSchemaRevisionChange(changes, version);
  assertSchemaUpdatedChange(changes);
}

function assertReleaseDiff(
  runner: ReleaseRunner,
  base: string,
  target: string,
  version: string,
): void {
  assertPackageReleaseDiff(runner, base, target, version);
  assertSchemaReleaseDiff(runner, base, target, version);
}

function readChangedFiles(runner: ReleaseRunner, target: string): string[] {
  const args = ["diff-tree", "--no-commit-id", "--name-only", "-r", target];
  return commandText(runner, "git", args).split("\n").filter(Boolean).sort();
}

function sameFiles(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertReleaseFiles(runner: ReleaseRunner, target: string): void {
  const changedFiles = readChangedFiles(runner, target);
  const hasReleaseFiles = sameFiles(changedFiles, RELEASE_FILES);
  if (hasReleaseFiles) return;
  throw new Error(`Unverified release files: ${target}`);
}

function assertReleaseParent(runner: ReleaseRunner, branch: string): void {
  const parent = commandText(runner, "git", ["rev-parse", `${branch}^`]);
  const main = commandText(runner, "git", ["rev-parse", "origin/main"]);
  if (parent !== main) throw new Error(`Unverified release parent: ${branch}`);
}

function assertReleaseCommitShape(runner: ReleaseRunner, branch: string, version: string): void {
  assertReleaseParent(runner, branch);
  assertReleaseFiles(runner, branch);
  assertReleaseDiff(runner, "origin/main", branch, version);
}

function canCompleteReleaseFiles(changedFiles: readonly string[]): boolean {
  const hasCompleteFiles = sameFiles(changedFiles, RELEASE_FILES);
  const hasPackageOnlyFiles = sameFiles(changedFiles, PACKAGE_RELEASE_FILES);
  return hasCompleteFiles || hasPackageOnlyFiles;
}

function completeInterruptedReleaseCommit(
  context: ReleaseContext,
  version: string,
  branch: string,
): void {
  assertReleaseParent(context.runner, branch);
  assertPackageReleaseDiff(context.runner, "origin/main", branch, version);

  const changedFiles = readChangedFiles(context.runner, branch);
  if (!canCompleteReleaseFiles(changedFiles)) {
    throw new Error(`Unverified release files: ${branch}`);
  }
  if (sameFiles(changedFiles, RELEASE_FILES)) return;

  context.schemaMetadataWriter(context.cwd, version);
  runCommand(context.runner, "git", ["add", CONFIG_SCHEMA_PATH]);
  runCommand(context.runner, "git", ["commit", "--amend", "--no-edit", "--no-verify"]);
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
  if (hasReleaseVersion) completeInterruptedReleaseCommit(context, version, branch);
  if (!hasReleaseVersion) createReleaseCommit(context, releaseArgs, version);
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

export const validateStableVersion = (version: string): void => {
  if (HOMEBREW_STABLE_VERSION_PATTERN.test(version)) return;
  throw new Error(`Invalid stable version: ${version}`);
};

export const npmTarballUrl = (version: string): string =>
  `https://registry.npmjs.org/codependence/-/codependence-${version}.tgz`;

export const compareStableVersions = (left: string, right: string): number => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const index = leftParts.findIndex((part, partIndex) => part !== rightParts[partIndex]);
  if (index === -1) return 0;

  const leftPart = leftParts[index] ?? 0;
  const rightPart = rightParts[index] ?? 0;
  if (leftPart > rightPart) return 1;
  return -1;
};

export const extractFormulaVersion = (content: string): string | null => {
  const match = content.match(/codependence-([0-9]+\.[0-9]+\.[0-9]+)\.tgz/);
  return match?.[1] ?? null;
};

export const renderFormula = ({ digest, url }: FormulaSource): string => {
  const source = [`  url "${url}"`, `  sha256 "${digest}"`];
  return FORMULA_HEADER.concat(source, FORMULA_BODY, "").join("\n");
};

export const fetchPublishedTarball = async (
  url: string,
  fetchImpl: Fetch = fetch,
): Promise<Buffer> => {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Unable to download published tarball: ${response.status}`);
  const content = await response.arrayBuffer();
  return Buffer.from(content);
};

const createFormula = (content: Buffer, { outputPath, version }: FormulaOptions): FormulaInput => {
  validateStableVersion(version);
  const url = npmTarballUrl(version);
  const digest = sha256(content);
  writeFileSync(outputPath, renderFormula({ digest, url }));
  return { digest, url, version };
};

export const createPublishedFormula = async ({
  fetchImpl = fetch,
  outputPath,
  version,
}: PublishedFormulaOptions): Promise<FormulaInput> => {
  const url = npmTarballUrl(version);
  const content = await fetchPublishedTarball(url, fetchImpl);
  return createFormula(content, { outputPath, version });
};

export const createLocalFormula = ({
  outputPath,
  tarballPath,
  version,
}: LocalFormulaOptions): FormulaInput => {
  const content = readFileSync(tarballPath);
  return createFormula(content, { outputPath, version });
};

const githubHeaders = (token: string, accept: string): Record<string, string> => ({
  Accept: accept,
  Authorization: `Bearer ${token}`,
  "User-Agent": "codependence-release",
});

const githubApiBase = (env: Record<string, string | undefined>): string =>
  (env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");

const tapRepository = (env: Record<string, string | undefined>): string =>
  env.TAP_REPOSITORY || "yowainwright/homebrew-tap";

const tapFormulaPath = (env: Record<string, string | undefined>): string =>
  env.TAP_FORMULA_PATH || "Formula/codependence.rb";

const tapOwner = (repository: string): string => repository.split("/")[0];

const isString = (value: unknown): value is string => typeof value === "string";

const githubApiUrl = (
  env: Record<string, string | undefined>,
  path: string,
  params: Record<string, string> = {},
): string => {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  return `${githubApiBase(env)}/${path}${suffix}`;
};

const readGithubText = async (url: string, token: string, fetchImpl: Fetch): Promise<string> => {
  const response = await fetchImpl(url, {
    headers: githubHeaders(token, "application/vnd.github.raw"),
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.text();
};

const githubJsonRequest = async (
  url: string,
  token: string,
  fetchImpl: Fetch,
  method = "GET",
  body?: unknown,
): Promise<unknown> => {
  const init = {
    body: body ? JSON.stringify(body) : undefined,
    headers: githubHeaders(token, "application/vnd.github+json"),
    method,
  };
  const response = await fetchImpl(url, init);
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.json();
};

const readGithubJson = async (
  url: string,
  token: string,
  fetchImpl: Fetch,
): Promise<unknown | null> => {
  const response = await fetchImpl(url, {
    headers: githubHeaders(token, "application/vnd.github+json"),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.json();
};

const objectSha = (value: unknown): string => {
  const record = value as { object?: { sha?: unknown }; sha?: unknown };
  const sha = record.object?.sha ?? record.sha;
  if (isString(sha)) return sha;
  throw new Error("GitHub response did not include a SHA");
};

const releaseHasAssets = (release: unknown, formulaPath: string, arch: string): boolean => {
  const isObject = Boolean(release) && typeof release === "object";
  if (!isObject) return false;

  const record = release as { assets?: Array<{ name?: unknown }>; draft?: unknown };
  const hasDraftFlag = typeof record.draft === "boolean";
  if (!hasDraftFlag) return false;
  if (record.draft) return false;

  const names = new Set(record.assets?.map((asset) => asset.name).filter(isString));
  const requiredAssets = [
    formulaPath,
    `codependence-darwin-${arch}`,
    `codependence-darwin-${arch}.sigstore.json`,
  ];
  return requiredAssets.every((name) => names.has(name));
};

const binaryArch = (): string => {
  if (process.arch === "arm64") return "arm64";
  if (process.arch === "x64") return "x64";
  throw new Error(`Unsupported architecture: ${process.arch}`);
};

export const checkHomebrewReleaseState = async ({
  arch = binaryArch(),
  env,
  fetchImpl = fetch,
}: HomebrewReleaseStateOptions): Promise<HomebrewReleaseState> => {
  const version = requiredEnv(env, "VERSION");
  const tapToken = requiredEnv(env, "TAP_TOKEN");
  const repoToken = requiredEnv(env, "GITHUB_TOKEN");
  const sourceRepository = requiredEnv(env, "GITHUB_REPOSITORY");
  const formulaPath = requiredEnv(env, "FORMULA_PATH");
  const repository = tapRepository(env);
  const formulaPathInTap = tapFormulaPath(env);
  const formulaUrl = githubApiUrl(env, `repos/${repository}/contents/${formulaPathInTap}`);
  const formula = await readGithubText(formulaUrl, tapToken, fetchImpl);
  const tapVersion = extractFormulaVersion(formula);
  const hasNewerTap = Boolean(tapVersion && compareStableVersions(version, tapVersion) < 0);
  if (hasNewerTap) {
    return {
      reason: `Homebrew tap already has newer codependence ${tapVersion}; skipping ${version}`,
      skip: true,
    };
  }

  if (tapVersion !== version) return { skip: false };

  const releaseUrl = githubApiUrl(env, `repos/${sourceRepository}/releases/tags/v${version}`);
  const release = await readGithubJson(releaseUrl, repoToken, fetchImpl);
  if (!releaseHasAssets(release, formulaPath, arch)) return { skip: false };
  return {
    reason: `Homebrew formula and release assets already published for ${version}`,
    skip: true,
  };
};

const readTapBranchSha = async (
  env: Record<string, string | undefined>,
  token: string,
  branch: string,
  fetchImpl: Fetch,
): Promise<string | null> => {
  const repository = tapRepository(env);
  const url = githubApiUrl(env, `repos/${repository}/git/ref/heads/${branch}`);
  const response = await readGithubJson(url, token, fetchImpl);
  return response ? objectSha(response) : null;
};

const resetTapBranch = async (
  env: Record<string, string | undefined>,
  token: string,
  branch: string,
  fetchImpl: Fetch,
): Promise<void> => {
  const repository = tapRepository(env);
  const baseSha = await readTapBranchSha(env, token, "main", fetchImpl);
  if (!baseSha) throw new Error("Homebrew tap main branch was not found");

  const existingSha = await readTapBranchSha(env, token, branch, fetchImpl);
  const refsPath = existingSha ? `git/refs/heads/${branch}` : "git/refs";
  const method = existingSha ? "PATCH" : "POST";
  const body = existingSha
    ? { force: true, sha: baseSha }
    : { ref: `refs/heads/${branch}`, sha: baseSha };
  const url = githubApiUrl(env, `repos/${repository}/${refsPath}`);
  await githubJsonRequest(url, token, fetchImpl, method, body);
};

const readTapFormulaSha = async (
  env: Record<string, string | undefined>,
  token: string,
  branch: string,
  fetchImpl: Fetch,
): Promise<string> => {
  const repository = tapRepository(env);
  const path = tapFormulaPath(env);
  const url = githubApiUrl(env, `repos/${repository}/contents/${path}`, { ref: branch });
  const response = await githubJsonRequest(url, token, fetchImpl);
  return objectSha(response);
};

const writeTapFormula = async (
  env: Record<string, string | undefined>,
  token: string,
  branch: string,
  fileSha: string,
  fetchImpl: Fetch,
): Promise<void> => {
  const repository = tapRepository(env);
  const path = tapFormulaPath(env);
  const formula = readFileSync(requiredEnv(env, "FORMULA_PATH"), "utf8");
  const content = Buffer.from(formula).toString("base64");
  const message = `codependence ${requiredEnv(env, "VERSION")}`;
  const body = { branch, content, message, sha: fileSha };
  const url = githubApiUrl(env, `repos/${repository}/contents/${path}`);
  await githubJsonRequest(url, token, fetchImpl, "PUT", body);
};

const findOpenTapPullRequest = async (
  env: Record<string, string | undefined>,
  token: string,
  branch: string,
  fetchImpl: Fetch,
): Promise<{ number: number; url: string } | null> => {
  const repository = tapRepository(env);
  const head = `${tapOwner(repository)}:${branch}`;
  const url = githubApiUrl(env, `repos/${repository}/pulls`, { head, state: "open" });
  const response = await githubJsonRequest(url, token, fetchImpl);
  const [pullRequest] = response as Array<{ html_url?: unknown; number?: unknown }>;
  const hasPullRequest = typeof pullRequest?.number === "number" && isString(pullRequest.html_url);
  return hasPullRequest ? { number: pullRequest.number, url: pullRequest.html_url } : null;
};

const upsertTapPullRequest = async (
  env: Record<string, string | undefined>,
  token: string,
  branch: string,
  fetchImpl: Fetch,
): Promise<string> => {
  const repository = tapRepository(env);
  const title = `codependence ${requiredEnv(env, "VERSION")}`;
  const body = `${title}\n\nAutomated formula update.`;
  const existing = await findOpenTapPullRequest(env, token, branch, fetchImpl);
  if (existing) {
    const url = githubApiUrl(env, `repos/${repository}/pulls/${existing.number}`);
    await githubJsonRequest(url, token, fetchImpl, "PATCH", { body, title });
    return existing.url;
  }

  const url = githubApiUrl(env, `repos/${repository}/pulls`);
  const response = await githubJsonRequest(url, token, fetchImpl, "POST", {
    base: "main",
    body,
    head: branch,
    title,
  });
  const pullRequest = response as { html_url?: unknown };
  if (isString(pullRequest.html_url)) return pullRequest.html_url;
  throw new Error("GitHub pull request response did not include a URL");
};

export const updateHomebrewTap = async ({
  env,
  fetchImpl = fetch,
}: HomebrewTapUpdateOptions): Promise<HomebrewTapUpdateResult> => {
  const token = requiredEnv(env, "TAP_TOKEN");
  const formulaPath = requiredEnv(env, "FORMULA_PATH");
  const repository = tapRepository(env);
  const path = tapFormulaPath(env);
  const formulaUrl = githubApiUrl(env, `repos/${repository}/contents/${path}`);
  const current = await readGithubText(formulaUrl, token, fetchImpl);
  if (current === readFileSync(formulaPath, "utf8")) return { changed: false };

  const branch = env.TAP_BRANCH || "codependence-release";
  await resetTapBranch(env, token, branch, fetchImpl);
  const fileSha = await readTapFormulaSha(env, token, branch, fetchImpl);
  await writeTapFormula(env, token, branch, fileSha, fetchImpl);
  const pullRequestUrl = await upsertTapPullRequest(env, token, branch, fetchImpl);
  return { branch, changed: true, pullRequestUrl };
};

export const writeHomebrewTapUpdate = async (options: HomebrewTapUpdateOptions): Promise<void> => {
  const result = await updateHomebrewTap(options);
  if (!result.changed) {
    process.stdout.write("::notice::Homebrew tap formula already current\n");
    return;
  }

  const outputPath = options.env.GITHUB_OUTPUT;
  const output = `tap-pr-url=${result.pullRequestUrl}\n`;
  if (outputPath) appendFileSync(outputPath, output);
  process.stdout.write(`::notice::Homebrew tap PR ready: ${result.pullRequestUrl}\n`);
};

export const writeHomebrewReleaseState = async (
  options: HomebrewReleaseStateOptions,
): Promise<void> => {
  const state = await checkHomebrewReleaseState(options);
  const output = `skip=${state.skip ? "true" : "false"}\n`;
  const outputPath = options.env.GITHUB_OUTPUT;
  if (outputPath) appendFileSync(outputPath, output);
  else process.stdout.write(output);
  if (state.reason) process.stdout.write(`::notice::${state.reason}\n`);
};

export const createLocalFormulaFromEnv = (
  env: Record<string, string | undefined>,
  version: string,
): void => {
  const outputPath = requiredEnv(env, "FORMULA_PATH");
  const tarballPath = requiredEnv(env, "TARBALL_PATH");
  createLocalFormula({ outputPath, tarballPath, version });
};

export const runBrewCli = async ({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl,
}: BrewCliOptions = {}): Promise<void> => {
  const command = argv[0] ?? "generate";
  const version = requiredEnv(env, "VERSION");
  validateStableVersion(version);
  if (command === "validate-version") return;
  if (command === "check-state") return writeHomebrewReleaseState({ env, fetchImpl });
  if (command === "update-tap") return writeHomebrewTapUpdate({ env, fetchImpl });
  if (command === "generate-local") return createLocalFormulaFromEnv(env, version);
  if (command !== "generate") throw new Error(`Unknown command: ${command}`);

  const outputPath = requiredEnv(env, "FORMULA_PATH");
  await createPublishedFormula({ fetchImpl, outputPath, version });
};

function githubJson(runner: ReleaseRunner, args: readonly string[]): unknown {
  return JSON.parse(commandText(runner, "gh", args));
}

function flattenReleasePages(value: unknown): GitHubRelease[] {
  const pages = Array.isArray(value) ? value : [];
  return pages.flatMap((page) => (Array.isArray(page) ? page : [])) as GitHubRelease[];
}

function findReleaseByTag(
  runner: ReleaseRunner,
  repository: string,
  releaseTag: string,
): GitHubRelease {
  const endpoint = `repos/${repository}/releases?per_page=100`;
  const releases = githubJson(runner, ["api", "--paginate", "--slurp", endpoint]);
  const release = flattenReleasePages(releases).find((item) => item.tag_name === releaseTag);
  if (release) return release;
  throw new Error(`Release not found: ${releaseTag}`);
}

function releaseUploadBaseUrl(release: GitHubRelease, repository: string): string {
  const uploadUrl = release.upload_url?.split("{")[0] ?? "";
  const expectedUrl = `https://uploads.github.com/repos/${repository}/releases/${release.id}/assets`;
  if (uploadUrl === expectedUrl) return uploadUrl;
  throw new Error(`Unexpected release upload URL: ${uploadUrl}`);
}

function assetName(assetPath: string): string {
  return assetPath.split("/").at(-1) ?? assetPath;
}

function assetDigest(assetPath: string): string {
  const digest = sha256(readFileSync(assetPath));
  return `sha256:${digest}`;
}

function isAttestationBundle(name: string): boolean {
  return name.endsWith(".sigstore.json");
}

function attestationSubjectDigests(content: string): string {
  const bundle = JSON.parse(content) as { dsseEnvelope?: { payload?: string }; payload?: string };
  const payload = bundle.dsseEnvelope?.payload ?? bundle.payload ?? "";
  if (!payload) return "";
  const statement = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as {
    subject?: Array<{ digest?: { sha256?: string } }>;
  };
  const digests = statement.subject?.flatMap((subject) => subject.digest?.sha256 ?? []) ?? [];
  const sortedDigests = digests.toSorted();
  return sortedDigests.join(",");
}

function publishedAssetContent(runner: ReleaseRunner, assetUrl: string): string {
  const result = runner("gh", ["api", "--header", "Accept: application/octet-stream", assetUrl]);
  if (result.status === 0) return result.stdout;
  throw new Error(result.stderr.trim() || `Unable to read published asset: ${assetUrl}`);
}

function attestationSubjectMatches(
  runner: ReleaseRunner,
  publishedAssetUrl: string,
  assetPath: string,
): boolean {
  const expectedSubjects = attestationSubjectDigests(readFileSync(assetPath, "utf8"));
  const publishedContent = publishedAssetContent(runner, publishedAssetUrl);
  const publishedSubjects = attestationSubjectDigests(publishedContent);
  const hasExpectedSubjects = Boolean(expectedSubjects);
  const subjectsMatch = expectedSubjects === publishedSubjects;
  return hasExpectedSubjects && subjectsMatch;
}

function uploadReleaseAsset(runner: ReleaseRunner, uploadUrl: string, assetPath: string): void {
  const name = assetName(assetPath);
  const query = new URLSearchParams({ name }).toString();
  const assetUrl = `${uploadUrl}?${query}`;
  runOrThrow(runner, "gh", [
    "api",
    "--method",
    "POST",
    "--header",
    "Content-Type: application/octet-stream",
    "--input",
    assetPath,
    assetUrl,
  ]);
}

function verifyExistingReleaseAsset(
  runner: ReleaseRunner,
  asset: ReleaseAsset,
  assetPath: string,
): void {
  const name = assetName(assetPath);
  const publishedDigest = asset.digest ?? "unavailable";
  if (publishedDigest === assetDigest(assetPath)) return;
  if (publishedDigest === "unavailable") {
    throw new Error(`Release asset digest unavailable: ${name}`);
  }
  const isMatchingAttestation =
    isAttestationBundle(name) &&
    Boolean(asset.url) &&
    attestationSubjectMatches(runner, asset.url, assetPath);
  if (isMatchingAttestation) return;
  if (isAttestationBundle(name)) {
    throw new Error(`Release attestation subject digest mismatch: ${name}`);
  }
  throw new Error(`Release asset digest mismatch: ${name}`);
}

function publishReleaseAsset(
  runner: ReleaseRunner,
  release: GitHubRelease,
  uploadUrl: string,
  assetPath: string,
): void {
  const name = assetName(assetPath);
  const existingAsset = release.assets?.find((asset) => asset.name === name);
  if (!existingAsset) {
    uploadReleaseAsset(runner, uploadUrl, assetPath);
    return;
  }
  verifyExistingReleaseAsset(runner, existingAsset, assetPath);
}

export function runUploadReleaseAssetsCli({
  argv = process.argv.slice(2),
  env = process.env,
  logger = console,
  runner = createSpawnRunner(),
}: ReleaseAssetUploadOptions = {}): number {
  const [releaseTag, ...assetPaths] = argv;
  if (!releaseTag) throw new Error("Release tag is required");
  if (assetPaths.length === 0) throw new Error("At least one release asset is required");

  const repository = requiredEnv(env, "GITHUB_REPOSITORY");
  const release = findReleaseByTag(runner, repository, releaseTag);
  const uploadUrl = releaseUploadBaseUrl(release, repository);
  assetPaths.forEach((assetPath) => publishReleaseAsset(runner, release, uploadUrl, assetPath));
  logger.log(release.id);
  return 0;
}

export function stripTagPrefix(version: string): string {
  if (version.startsWith("v")) return version.slice(1);
  return version;
}

export function validateReleaseVersion(version: string): void {
  if (PUBLISHED_RELEASE_VERSION_PATTERN.test(version)) return;
  throw new Error(`Invalid release version: ${version}`);
}

export function packageSpec(packageName: string, version: string): string {
  return `${packageName}@${version}`;
}

export function buildDockerBuildArgs({
  dockerfile,
  image,
  nodeAlpineImage,
  version,
}: {
  dockerfile: string;
  image: string;
  nodeAlpineImage: string;
  version: string;
}): string[] {
  return [
    "build",
    "--build-arg",
    `CODEPENDENCE_VERSION=${version}`,
    "--build-arg",
    `NODE_ALPINE_IMAGE=${nodeAlpineImage}`,
    "-f",
    dockerfile,
    "-t",
    image,
    ".",
  ];
}

export function buildDockerRunShellArgs(image: string, script: string): string[] {
  return ["run", "--rm", image, "bash", "-lc", script];
}

export function releaseE2eScript(): string {
  return [
    "set -euo pipefail",
    'echo "Running Python and Go manifest tests..."',
    "cd /app/tests/e2e/fixtures",
    "./test-python-go.sh",
    'echo "Running Go update tests..."',
    "cd /app",
    "./tests/e2e/test-go-update.sh",
    'echo "All release e2e tests completed successfully"',
  ].join("\n");
}

export function legacyCompatibilityScript(): string {
  return [
    'echo "Testing 0.3.1 compatibility..."',
    'NODE_PATH="$(npm root -g)" node -e "const { script } = require(\'codependence\'); if (typeof script !== \'function\') process.exit(1)"',
    "mkdir -p /tmp/codependence-legacy",
    "cp /app/tests/fixtures/0.3.1/package.json /tmp/codependence-legacy/package.json",
    "cd /tmp/codependence-legacy",
    "codependence -s \"$PWD\" -r \"$PWD/\" -f package.json -i '**/node_modules/**' -u --silent",
    'node -e "const p = require(\'./package.json\'); if (p.dependencies.lodash !== \'^4.17.21\' || p.dependencies[\'fs-extra\'] !== \'10.0.0\') process.exit(1)"',
    "cdp --help >/dev/null",
  ].join("\n");
}

export function compatibilityScript(): string {
  return [
    "set -euo pipefail",
    'echo "Testing command execution time..."',
    "time codependence --help >/dev/null",
    'echo "Testing debug output..."',
    "mkdir -p /tmp/codependence-debug",
    "cp /app/tests/release/fixtures/smoke-package.json /tmp/codependence-debug/package.json",
    "cp /app/tests/release/fixtures/smoke-codependencerc.json /tmp/codependence-debug/.codependencerc",
    "codependence --rootDir /tmp/codependence-debug --config /tmp/codependence-debug/.codependencerc --debug",
    'echo "Testing JSON output..."',
    "codependence --rootDir /tmp/codependence-debug --config /tmp/codependence-debug/.codependencerc --format json",
    legacyCompatibilityScript(),
    'echo "Performance and compatibility checks passed"',
  ].join("\n");
}

export function formatSummary(version: string): string {
  return [
    "Test Summary",
    "============",
    `Tested codependence version: ${version}`,
    "Full e2e test suite: PASSED",
    "NPM package smoke test: PASSED",
    "Python compatibility: PASSED",
    "Go compatibility: PASSED",
    "0.3.1 compatibility: PASSED",
    "Performance checks: PASSED",
    "",
    "Published package is working correctly.",
    "Ready for production use",
  ].join("\n");
}

export function formatReport({ date, version }: ReportOptions): string {
  return [
    "# Codependence Release Test Report",
    "",
    `**Version Tested:** ${version}`,
    `**Test Date:** ${date}`,
    "**Status:** PASSED",
    "",
    "## Test Coverage",
    "- E2E Node tests",
    "- Python manifest tests",
    "- Go manifest tests",
    "- Go update preservation tests",
    "- 0.3.1 compatibility contract",
    "- NPM package smoke test",
    "- Performance validation",
    "",
    "## Summary",
    "All tests passed successfully. The published package is ready for use.",
    "",
  ].join("\n");
}

function writeOutput(outputPath: string | undefined, key: string, value: string): void {
  if (outputPath) writeFileSync(outputPath, `${key}=${value}\n`, { flag: "a" });
}

function nodeAlpineImage(env: Record<string, string | undefined>): string {
  const versions = resolveToolVersions(readToolVersionInputs({ env })) as {
    nodeAlpineImage: string;
  };
  return versions.nodeAlpineImage;
}

function resolveRequestedVersion(
  version: string | undefined,
  packageName: string,
  runner: ReleaseRunner,
): string {
  if (version) return stripTagPrefix(version);
  return runOrThrow(runner, "npm", ["view", packageName, "version"]).stdout.trim();
}

function waitForNpmPackage(packageName: string, version: string, runner: ReleaseRunner): void {
  const spec = packageSpec(packageName, version);
  const attempts = Array.from({ length: 30 }, (_, index) => index + 1);
  const available = attempts.some((attempt) => {
    const result = runner("npm", ["view", spec, "version"]);
    if (commandSucceeded(result)) return true;
    if (attempt === attempts.length) return false;
    console.log(`Attempt ${attempt}/30: package not yet available, waiting 30 seconds...`);
    runOrThrow(runner, "sleep", ["30"]);
    return false;
  });
  if (available) return;
  throw new Error(`Package ${spec} was not available after 30 attempts`);
}

function runResolveVersion(
  env: Record<string, string | undefined>,
  packageName: string,
  runner: ReleaseRunner,
): number {
  const resolvedVersion = resolveRequestedVersion(env.INPUT_VERSION, packageName, runner);
  validateReleaseVersion(resolvedVersion);
  writeOutput(env.GITHUB_OUTPUT, "version", resolvedVersion);
  console.log(`Testing ${packageName} version: ${resolvedVersion}`);
  return 0;
}

function runBuildReleaseImage(
  env: Record<string, string | undefined>,
  fullImage: string,
  version: string,
  runner: ReleaseRunner,
): number {
  runOrThrow(
    runner,
    "docker",
    buildDockerBuildArgs({
      dockerfile: "tests/release/Dockerfile.published",
      image: fullImage,
      nodeAlpineImage: nodeAlpineImage(env),
      version,
    }),
  );
  return 0;
}

function runVerifyInstallation(fullImage: string, runner: ReleaseRunner): number {
  const script = [
    "set -euo pipefail",
    "codependence --help",
    "node /app/dist/cli.js --help",
    'echo "Installation verified"',
  ].join("\n");
  runOrThrow(runner, "docker", buildDockerRunShellArgs(fullImage, script));
  return 0;
}

function runNpmSmoke(
  env: Record<string, string | undefined>,
  npmImage: string,
  version: string,
  runner: ReleaseRunner,
): number {
  runOrThrow(
    runner,
    "docker",
    buildDockerBuildArgs({
      dockerfile: "tests/release/Dockerfile.npm-smoke",
      image: npmImage,
      nodeAlpineImage: nodeAlpineImage(env),
      version,
    }),
  );
  const script = ["set -euo pipefail", "codependence --debug", 'echo "NPM package smoke test passed"'].join("\n");
  runOrThrow(runner, "docker", buildDockerRunShellArgs(npmImage, script));
  return 0;
}

function formatReportDate(): string {
  return new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function runTestPublishedReleaseCli({
  argv = process.argv.slice(2),
  env = process.env,
  runner = createSpawnRunner(),
}: PublishedReleaseOptions = {}): number {
  const command = argv[0];
  const packageName = env.PACKAGE_NAME || "codependence";
  const fullImage = env.FULL_IMAGE || "codependence-release-test";
  const npmImage = env.NPM_IMAGE || "codependence-npm-test";
  const version = env.CODEPENDENCE_VERSION;

  if (command === "resolve-version") return runResolveVersion(env, packageName, runner);
  if (command === "wait-for-npm") {
    requireVersion(version, command);
    console.log(`Waiting for ${packageSpec(packageName, version)} to be available on npm...`);
    waitForNpmPackage(packageName, version, runner);
    console.log(`Package ${packageSpec(packageName, version)} is available on npm`);
    return 0;
  }
  if (command === "build-release-image") {
    requireVersion(version, command);
    return runBuildReleaseImage(env, fullImage, version, runner);
  }
  if (command === "verify-installation") return runVerifyInstallation(fullImage, runner);
  if (command === "run-e2e") {
    runOrThrow(runner, "docker", buildDockerRunShellArgs(fullImage, releaseE2eScript()));
    return 0;
  }
  if (command === "run-npm-smoke") {
    requireVersion(version, command);
    return runNpmSmoke(env, npmImage, version, runner);
  }
  if (command === "compatibility-check") {
    runOrThrow(runner, "docker", buildDockerRunShellArgs(fullImage, compatibilityScript()));
    return 0;
  }
  if (command === "summary") {
    requireVersion(version, command);
    console.log(formatSummary(version));
    return 0;
  }
  if (command === "write-report") {
    const report = formatReport({ date: formatReportDate(), version: version || "unknown" });
    writeFileSync("test-report.md", report);
    console.log("Test report created:");
    console.log(report);
    return 0;
  }

  const commands = Array.from(TEST_PUBLISHED_RELEASE_COMMANDS).join("|");
  throw new Error(`Usage: test-published {${commands}}`);
}
