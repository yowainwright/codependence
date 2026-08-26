import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { FORMULA_BODY, FORMULA_HEADER, STABLE_VERSION_PATTERN } from "./constants";
import type {
  Fetch,
  FormulaInput,
  FormulaOptions,
  FormulaSource,
  HomebrewReleaseState,
  HomebrewReleaseStateOptions,
  HomebrewTapUpdateOptions,
  HomebrewTapUpdateResult,
  LocalFormulaOptions,
  PublishedFormulaOptions,
} from "./types";

export const validateStableVersion = (version: string): void => {
  if (STABLE_VERSION_PATTERN.test(version)) return;
  throw new Error(`Invalid stable version: ${version}`);
};

export const npmTarballUrl = (version: string): string =>
  `https://registry.npmjs.org/codependence/-/codependence-${version}.tgz`;

export const compareStableVersions = (left: string, right: string): number => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const index = leftParts.findIndex((part, partIndex) => part !== rightParts[partIndex]);
  if (index === -1) return 0;

  return leftParts[index] > rightParts[index] ? 1 : -1;
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
  const url = new URL(`${githubApiBase(env)}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
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
  if (!release || typeof release !== "object") return false;

  const record = release as { assets?: Array<{ name?: unknown }>; draft?: unknown };
  if (record.draft !== false) return false;

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
