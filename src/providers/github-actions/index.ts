import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type {
  DependencyManifest,
  DependencyProvider,
  GitHubActionRef,
  GitHubActionsProviderOptions,
  GitHubCommit,
  GitHubFetch,
  GitHubRelease,
  GitHubTag,
  ParsedVersionTag,
} from "../types";
import {
  DEFAULT_GITHUB_API_URL,
  GITHUB_ACTIONS_PATTERNS,
  SAFE_VERSION_LABEL,
  STABLE_VERSION_TAG,
  VERSION_COMMENT,
} from "./constants";

export type { GitHubActionsProviderOptions } from "../types";

const resolvedVersionLabels = new Map<string, string>();

const defaultFetch: GitHubFetch = (url, init) => globalThis.fetch(url, init);

const actionRepository = (packageName: string): string =>
  packageName.split("/").slice(0, 2).map(encodeURIComponent).join("/");

const versionLabelKey = (packageName: string, version: string): string => {
  const repository = actionRepository(packageName);
  return `${repository}@${version}`;
};

const rememberVersionLabel = (packageName: string, version: string, label: string): void => {
  const key = versionLabelKey(packageName, version);
  resolvedVersionLabels.set(key, label);
};

const versionLabelsFor = (dependencies: Record<string, string>): Record<string, string> => {
  const entries = Object.entries(dependencies).map(([name, version]) => {
    const label = resolvedVersionLabels.get(versionLabelKey(name, version));
    if (!label) return null;

    return [name, label];
  });
  const labeledEntries = entries.filter((entry): entry is string[] => entry !== null);
  return Object.fromEntries(labeledEntries);
};

const parseVersionTag = (name: string): ParsedVersionTag | null => {
  const match = name.match(STABLE_VERSION_TAG);
  if (!match) return null;

  const versionParts = [match[1], match[2]?.slice(1), match[3]?.slice(1)];
  const parts = versionParts.map((part) => Number(part || 0));
  const specificity = versionParts.filter(Boolean).length;
  return { name, parts, specificity };
};

const compareVersionTags = (left: ParsedVersionTag, right: ParsedVersionTag): number => {
  const differenceIndex = left.parts.findIndex((part, index) => part !== right.parts[index]);
  if (differenceIndex === -1) return right.specificity - left.specificity;

  return right.parts[differenceIndex] - left.parts[differenceIndex];
};

const latestStableTag = (tags: string[]): string | null => {
  const candidates = tags.map(parseVersionTag);
  const stableTags = candidates.filter((tag): tag is ParsedVersionTag => tag !== null);
  const sortedTags = stableTags.sort(compareVersionTags);
  return sortedTags[0]?.name || null;
};

const apiHeaders = (token?: string): Record<string, string> => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "codependence",
  };
  if (!token) return headers;

  const authorization = `Bearer ${token}`;
  return { ...headers, Authorization: authorization };
};

const assertApiResponse = (response: Response, repository: string): void => {
  if (response.ok) return;

  const status = response.statusText
    ? `${response.status} ${response.statusText}`
    : response.status.toString();
  throw new Error(`GitHub API request failed for ${repository}: ${status}`);
};

const readReleaseTag = async (response: Response): Promise<string | null> => {
  const release = (await response.json()) as GitHubRelease;
  return typeof release.tag_name === "string" ? release.tag_name : null;
};

const readTagNames = async (response: Response): Promise<string[]> => {
  const tags = (await response.json()) as GitHubTag[];
  if (!Array.isArray(tags)) return [];

  return tags.map((tag) => tag.name).filter((name): name is string => typeof name === "string");
};

const readCommitSha = async (response: Response): Promise<string | null> => {
  const commit = (await response.json()) as GitHubCommit;
  if (typeof commit.sha === "string") return commit.sha;

  return null;
};

const updateVersionComment = (suffix: string, label?: string): string => {
  const hasSafeLabel = label && SAFE_VERSION_LABEL.test(label);
  if (!hasSafeLabel) return suffix;

  const hasNoComment = suffix.trim().length === 0;
  if (hasNoComment) return ` # ${label}`;
  if (!VERSION_COMMENT.test(suffix)) return suffix;

  return ` # ${label}`;
};

const isExternalAction = (name: string): boolean => {
  if (name.startsWith("./")) return false;
  if (name.startsWith("../")) return false;
  if (name.startsWith("docker://")) return false;

  return true;
};

const isShaPinnedRef = (version: string): boolean =>
  (version.length === 40 || version.length === 64) &&
  version
    .toLowerCase()
    .split("")
    .every((char) => "0123456789abcdef".includes(char));

const readUsesLine = (line: string): GitHubActionRef | null => {
  const match = line.match(GITHUB_ACTIONS_PATTERNS.USES_LINE);
  if (!match) return null;

  const name = match[3];
  if (!isExternalAction(name)) return null;

  const actionRef = { name, version: match[4] };
  return actionRef;
};

const collectDependencyVersions = (actionRefs: GitHubActionRef[]): Record<string, string[]> => {
  const versions = new Map<string, string[]>();
  actionRefs.forEach(({ name, version }) => {
    const currentVersions = versions.get(name) || [];
    versions.set(name, currentVersions.concat(version));
  });
  return Object.fromEntries(versions);
};

export const updateGitHubActionsUsesLine = (
  line: string,
  dependencies: Record<string, string>,
  versionLabels: Record<string, string> = {},
): string => {
  const match = line.match(GITHUB_ACTIONS_PATTERNS.USES_LINE);
  if (!match) return line;

  const name = match[3];
  if (!isExternalAction(name)) return line;

  const version = dependencies[name];
  if (!version) return line;

  const isCurrentSha = isShaPinnedRef(match[4]);
  const isTargetSha = isShaPinnedRef(version);
  if (isCurrentSha && !isTargetSha) return line;

  const suffix = updateVersionComment(match[6], versionLabels[name]);
  const updatedLine = `${match[1]}${match[2]}${name}@${version}${match[5]}${suffix}`;
  return updatedLine;
};

export class GitHubActionsProvider implements DependencyProvider {
  readonly language = LANGUAGES.GITHUB_ACTIONS;
  readonly capabilities = {
    supportsLatestResolution: true,
    supportsPreciseMode: true,
    versionStrategy: "exact",
  } as const;
  private readonly apiUrl: string;
  private readonly fetch: GitHubFetch;
  private readonly headers: Record<string, string>;

  constructor(options: GitHubActionsProviderOptions = {}) {
    const environmentToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const apiUrl = options.apiUrl || process.env.GITHUB_API_URL || DEFAULT_GITHUB_API_URL;
    const token = options.token || environmentToken;
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.fetch = options.fetch || defaultFetch;
    this.headers = apiHeaders(token);
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const repository = actionRepository(packageName);
    const version = await this.getLatestTag(repository);
    return this.resolveVersionSpec(packageName, version);
  }

  async resolveVersionSpec(packageName: string, version: string): Promise<string> {
    if (isShaPinnedRef(version)) return version;

    const repository = actionRepository(packageName);
    const sha = await this.getCommitSha(repository, version);
    rememberVersionLabel(packageName, sha, version);
    return sha;
  }

  private async getLatestTag(repository: string): Promise<string> {
    const releaseTag = await this.getLatestReleaseTag(repository);
    if (releaseTag) return releaseTag;

    const tags = await this.getRepositoryTags(repository);
    const latestTag = latestStableTag(tags);
    if (latestTag) return latestTag;

    throw new Error(`No stable GitHub Action tag found for ${repository}`);
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const repository = actionRepository(packageName);
    return this.getRepositoryTags(repository);
  }

  private async getLatestReleaseTag(repository: string): Promise<string | null> {
    const url = `${this.apiUrl}/repos/${repository}/releases/latest`;
    const response = await this.fetch(url, { headers: this.headers });
    if (response.status === 404) return null;

    assertApiResponse(response, repository);
    return readReleaseTag(response);
  }

  private async getRepositoryTags(repository: string): Promise<string[]> {
    const url = `${this.apiUrl}/repos/${repository}/tags?per_page=100`;
    const response = await this.fetch(url, { headers: this.headers });
    assertApiResponse(response, repository);
    return readTagNames(response);
  }

  private async getCommitSha(repository: string, version: string): Promise<string> {
    const encodedVersion = encodeURIComponent(version);
    const urlParts = [this.apiUrl, "repos", repository, "commits", encodedVersion];
    const url = urlParts.join("/");
    const request = { headers: this.headers };
    const response = await this.fetch(url, request);
    assertApiResponse(response, repository);
    const sha = await readCommitSha(response);
    if (sha) return sha;

    throw new Error("GitHub commit response did not include a SHA");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const actionRefs = content.split("\n").map(readUsesLine);
    const externalRefs = actionRefs.filter(
      (actionRef): actionRef is GitHubActionRef => actionRef !== null,
    );
    const entries = externalRefs.map(({ name, version }) => [name, version]);
    const dependencies = Object.fromEntries(entries);
    const dependencyVersions = collectDependencyVersions(externalRefs);

    return { filePath, dependencies, dependencyVersions };
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const versionLabels = versionLabelsFor(manifest.dependencies);
    const updatedLines = lines.map((line) =>
      updateGitHubActionsUsesLine(line, manifest.dependencies, versionLabels),
    );
    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = packageName.match(GITHUB_ACTIONS_PATTERNS.PACKAGE_NAME) !== null;
    return isValid;
  }
}
