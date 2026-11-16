import type {
  DependencyManifest,
  GitHubActionRef,
  GitHubCommit,
  GitHubFetch,
  GitHubRelease,
  GitHubTag,
  ParsedVersionTag,
} from "../types";
import {
  GITHUB_ACTIONS_PATTERNS,
  SAFE_VERSION_LABEL,
  STABLE_VERSION_TAG,
  VERSION_COMMENT,
} from "./constants";

export type { GitHubActionsProviderOptions } from "../types";

export const capabilities = {
  supportsLatestResolution: true,
  supportsPreciseMode: true,
  versionStrategy: "exact",
} as const;

const resolvedVersionLabels = new Map<string, string>();

export const defaultFetch: GitHubFetch = globalThis.fetch.bind(globalThis);

export const actionRepository = (packageName: string): string =>
  packageName.split("/").slice(0, 2).map(encodeURIComponent).join("/");

const versionLabelKey = (packageName: string, version: string): string => {
  const repository = actionRepository(packageName);
  return `${repository}@${version}`;
};

export const rememberVersionLabel = (packageName: string, version: string, label: string): void => {
  const key = versionLabelKey(packageName, version);
  resolvedVersionLabels.set(key, label);
};

export const versionLabelsFor = (dependencies: Record<string, string>): Record<string, string> => {
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

export const latestStableTag = (tags: string[]): string | null => {
  const candidates = tags.map(parseVersionTag);
  const stableTags = candidates.filter((tag): tag is ParsedVersionTag => tag !== null);
  const sortedTags = stableTags.concat().sort(compareVersionTags);
  return sortedTags[0]?.name || null;
};

export const apiHeaders = (token?: string): Record<string, string> => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "codependence",
  };
  if (!token) return headers;

  const authorization = `Bearer ${token}`;
  return Object.assign({}, headers, { Authorization: authorization });
};

export const assertApiResponse = (response: Response, repository: string): void => {
  if (response.ok) return;

  const status = response.statusText
    ? `${response.status} ${response.statusText}`
    : response.status.toString();
  throw new Error(`GitHub API request failed for ${repository}: ${status}`);
};

export const readReleaseTag = async (response: Response): Promise<string | null> => {
  const release = (await response.json()) as GitHubRelease;
  const tagName = release.tag_name;
  if (typeof tagName !== "string") return null;
  return tagName;
};

export const readTagNames = async (response: Response): Promise<string[]> => {
  const tags = (await response.json()) as GitHubTag[];
  if (!Array.isArray(tags)) return [];

  return tags.map((tag) => tag.name).filter((name): name is string => typeof name === "string");
};

export const readCommitSha = async (response: Response): Promise<string | null> => {
  const commit = (await response.json()) as GitHubCommit;
  if (typeof commit.sha === "string") return commit.sha;

  return null;
};

const updateVersionComment = (suffix: string, label?: string): string => {
  const hasSafeLabel = label && SAFE_VERSION_LABEL.test(label);
  if (!hasSafeLabel) return suffix;

  const hasComment = suffix.trim().length > 0;
  if (!hasComment) return ` # ${label}`;
  if (!VERSION_COMMENT.test(suffix)) return suffix;

  return ` # ${label}`;
};

const isExternalAction = (name: string): boolean => {
  if (name.startsWith("./")) return false;
  if (name.startsWith("../")) return false;
  if (name.startsWith("docker://")) return false;

  return true;
};

export const isShaPinnedRef = (version: string): boolean =>
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
  const shouldPreserveCurrentSha = isCurrentSha && !isTargetSha;
  if (shouldPreserveCurrentSha) return line;

  const suffix = updateVersionComment(match[6], versionLabels[name]);
  const updatedLine = `${match[1]}${match[2]}${name}@${version}${match[5]}${suffix}`;
  return updatedLine;
};

export const parseManifest = (filePath: string, content: string): DependencyManifest => {
  const actionRefs = content.split("\n").map(readUsesLine);
  const externalRefs = actionRefs.filter(
    (actionRef): actionRef is GitHubActionRef => actionRef !== null,
  );
  const entries = externalRefs.map(({ name, version }) => [name, version]);
  const dependencies = Object.fromEntries(entries);
  const dependencyVersions = collectDependencyVersions(externalRefs);

  return { filePath, dependencies, dependencyVersions };
};
