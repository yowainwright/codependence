import { readFileSync, writeFileSync } from "fs";
import { logger } from "../../logger";
import { LANGUAGES } from "../constants";
import { GITHUB_ACTIONS_PACKAGE_MANAGER, GITHUB_ACTIONS_PACKAGE_NAME_PATTERN } from "./constants";
import type { DependencyManifest, DependencyProvider, ProviderOptions } from "../types";

type ActionRef = {
  name: string;
  prefix: string;
  suffix: string;
  version: string;
};

type GitHubRelease = {
  tag_name?: string;
};

type GitHubTag = {
  name?: string;
};

const packageNamePattern = new RegExp(GITHUB_ACTIONS_PACKAGE_NAME_PATTERN);

const withFinalNewline = (content: string): string => {
  if (content.endsWith("\n")) return content;
  return content + "\n";
};

const isQuote = (char: string): boolean => {
  return char === '"' || char === "'";
};

const firstWhitespaceIndex = (value: string): number => {
  const match = value.match(/\s/);
  if (!match) return value.length;
  if (match.index === undefined) return value.length;
  return match.index;
};

const repoName = (packageName: string): string | null => {
  const parts = packageName.split("/");
  if (parts.length < 2) return null;
  return parts[0] + "/" + parts[1];
};

const githubApiUrl = (packageName: string, path: string): string | null => {
  const repo = repoName(packageName);
  if (!repo) return null;
  return "https://api.github.com/repos/" + repo + path;
};

const GITHUB_REQUEST_OPTIONS: RequestInit = {
  headers: {
    "User-Agent": "codependence (https://github.com/yowainwright/codependence)",
  },
};

const tagNames = (tags: GitHubTag[]): string[] => {
  return tags.reduce((acc: string[], tag) => {
    if (!tag.name) return acc;
    return acc.concat(tag.name);
  }, []);
};

export class GitHubActionsProvider implements DependencyProvider {
  readonly language = LANGUAGES.GITHUB_ACTIONS;
  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const release = await this.getLatestRelease(packageName);
    if (release) return release;
    return this.getLatestTag(packageName);
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const tags = await this.getTags(packageName, 100);
    return tagNames(tags);
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const dependencies: Record<string, string> = {};

    content.split("\n").forEach((line) => {
      const action = parseGithubActionLine(line);
      if (!action) return;
      dependencies[action.name] = action.version;
    });

    return { filePath, dependencies };
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updated = content
      .split("\n")
      .map((line) => updateGithubActionLine(line, manifest.dependencies))
      .join("\n");

    writeFileSync(filePath, withFinalNewline(updated));
  }

  validatePackageName(packageName: string): boolean {
    return packageNamePattern.test(packageName);
  }

  private async fetchJson(url: string) {
    try {
      const response = await fetch(url, GITHUB_REQUEST_OPTIONS);
      if (!response.ok) return null;

      const json = await response.json();
      return json;
    } catch (error) {
      if (this.options.debug) {
        logger.error("Failed to get GitHub action data from " + url, error as Error);
      }
      return null;
    }
  }

  private async getLatestRelease(packageName: string): Promise<string> {
    const url = githubApiUrl(packageName, "/releases/latest");
    if (!url) return "";

    const json = await this.fetchJson(url);
    if (!json) return "";

    const release = json as GitHubRelease;
    return release.tag_name || "";
  }

  private async getLatestTag(packageName: string) {
    const tags = await this.getTags(packageName, 1);
    const firstTag = tags[0];
    if (!firstTag) return "";
    return firstTag.name || "";
  }

  private async getTags(packageName: string, perPage: number) {
    const url = githubApiUrl(packageName, "/tags?per_page=" + perPage);
    if (!url) return [] as GitHubTag[];

    const json = await this.fetchJson(url);
    if (!json) return [] as GitHubTag[];

    const tags = json as GitHubTag[];
    return tags;
  }
}

const findUsesValueStart = (line: string): number | null => {
  const marker = "uses:";
  const markerIndex = line.indexOf(marker);
  if (markerIndex === -1) return null;

  const leading = line.slice(0, markerIndex);
  const leadingWithoutDash = leading.replace("-", "");
  if (leadingWithoutDash.trim().length > 0) return null;

  const rawStart = markerIndex + marker.length;
  const rest = line.slice(rawStart);
  const trimmedRest = rest.trimStart();
  const trimmedCount = rest.length - trimmedRest.length;
  return rawStart + trimmedCount;
};

const isSkippedActionRef = (name: string): boolean => {
  if (name.startsWith("./")) return true;
  if (name.startsWith("docker://")) return true;
  return false;
};

const quotedRefStart = (valueStart: number, firstChar: string): number => {
  if (isQuote(firstChar)) return valueStart + 1;
  return valueStart;
};

const quotedRefEnd = (refAndSuffix: string, firstChar: string): number => {
  if (isQuote(firstChar)) return refAndSuffix.indexOf(firstChar);
  return firstWhitespaceIndex(refAndSuffix);
};

export const parseGithubActionLine = (line: string): ActionRef | null => {
  const valueStart = findUsesValueStart(line);
  if (valueStart === null) return null;

  const firstChar = line[valueStart] || "";
  const refStart = quotedRefStart(valueStart, firstChar);
  const rest = line.slice(refStart);
  const atIndex = rest.indexOf("@");
  if (atIndex === -1) return null;

  const name = rest.slice(0, atIndex);
  if (isSkippedActionRef(name)) return null;

  const versionStart = atIndex + 1;
  const refAndSuffix = rest.slice(versionStart);
  const refEnd = quotedRefEnd(refAndSuffix, firstChar);
  if (refEnd === -1) return null;

  const version = refAndSuffix.slice(0, refEnd);
  if (!version) return null;

  const prefixEnd = refStart + versionStart;
  const suffixStart = prefixEnd + refEnd;

  return {
    name,
    prefix: line.slice(0, prefixEnd),
    suffix: line.slice(suffixStart),
    version,
  };
};

export const updateGithubActionLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const action = parseGithubActionLine(line);
  if (!action) return line;

  const newVersion = dependencies[action.name];
  if (!newVersion) return line;

  return action.prefix + newVersion + action.suffix;
};

export { GITHUB_ACTIONS_PACKAGE_MANAGER };
