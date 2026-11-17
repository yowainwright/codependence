import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type {
  DependencyManifest,
  DependencyProvider,
  GitHubActionsProviderOptions,
  GitHubFetch,
} from "../types";
import { DEFAULT_GITHUB_API_URL, GITHUB_ACTIONS_PATTERNS } from "./constants";

export type { GitHubActionsProviderOptions } from "../types";

import {
  defaultFetch,
  actionRepository,
  rememberVersionLabel,
  versionLabelsFor,
  latestStableTag,
  apiHeaders,
  assertApiResponse,
  readReleaseTag,
  readTagNames,
  readCommitSha,
  isShaPinnedRef,
  updateGitHubActionsUsesLine,
  parseManifest,
  capabilities,
} from "./utils";
export { updateGitHubActionsUsesLine } from "./utils";

export class GitHubActionsProvider implements DependencyProvider {
  readonly language = LANGUAGES.GITHUB_ACTIONS;
  readonly capabilities = capabilities;
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

  getAllVersions(packageName: string): Promise<string[]> {
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
    return parseManifest(filePath, content);
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
