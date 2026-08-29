import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMMIT_PATTERN,
  CONFIG_SCHEMA_PATH,
  DEFAULT_RELEASE_TIMEOUT_MINUTES,
  FORMULA_BODY,
  FORMULA_HEADER,
  HOMEBREW_STABLE_VERSION_PATTERN,
  PRE_RELEASES,
  RELEASE_INCREMENTS,
  RELEASE_VERSION_PATTERN,
  SAFE_SHELL_ARG_PATTERN,
  STABLE_VERSION_PATTERN,
  TAG_VERSION_PATTERN,
} from "./constants";
import type {
  Fetch,
  FormulaInput,
  FormulaOptions,
  FormulaSource,
  GitRunner,
  HomebrewReleaseState,
  HomebrewReleaseStateOptions,
  HomebrewTapUpdateOptions,
  HomebrewTapUpdateResult,
  LocalFormulaOptions,
  PackageManifest,
  PreRelease,
  PublishedFormulaOptions,
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

type ConfigSchema = Record<string, unknown>;

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

export const sha256 = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

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

export const requiredEnv = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name];
  if (value) return value;
  throw new Error(`${name} is required`);
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
