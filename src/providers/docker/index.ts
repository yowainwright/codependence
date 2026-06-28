import { readFileSync, writeFileSync } from "fs";
import { logger } from "../../logger";
import { LANGUAGES } from "../constants";
import { DOCKER_PACKAGE_MANAGER, DOCKER_PATTERNS } from "./constants";
import type { DependencyManifest, DependencyProvider, ProviderOptions } from "../types";

type ImageRef = {
  name: string;
  tag: string;
};

type DockerTag = {
  name: string;
};

type DockerTagsResponse = {
  results?: DockerTag[];
};

const withFinalNewline = (content: string): string => {
  if (content.endsWith("\n")) return content;
  return content + "\n";
};

const splitImageRef = (imageRef: string): ImageRef | null => {
  const lastSlash = imageRef.lastIndexOf("/");
  const lastColon = imageRef.lastIndexOf(":");
  const hasTag = lastColon > lastSlash;
  if (!hasTag) return null;

  const name = imageRef.slice(0, lastColon);
  const tag = imageRef.slice(lastColon + 1);
  if (!name || !tag) return null;

  return { name, tag };
};

export const parseDockerFromLine = (line: string): ImageRef | null => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return null;
  return splitImageRef(match[2]);
};

export const updateDockerFromLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return line;

  const image = splitImageRef(match[2]);
  if (!image) return line;

  const newVersion = dependencies[image.name];
  if (!newVersion) return line;

  const updatedRef = image.name + ":" + newVersion;
  return match[1] + updatedRef + match[3];
};

const dockerHubRepoFromParts = (parts: string[]): string | null => {
  if (parts.length === 1) return "library/" + parts[0];
  if (parts.length === 2) return parts.join("/");
  return null;
};

const normalizeDockerHubRepo = (packageName: string): string | null => {
  const parts = packageName.split("/");
  const firstPart = parts[0];
  const hasRegistry = firstPart.includes(".") || firstPart.includes(":");
  const isDockerIo = firstPart === "docker.io";
  const unsupportedRegistry = hasRegistry && !isDockerIo;
  if (unsupportedRegistry) return null;

  if (!isDockerIo) return dockerHubRepoFromParts(parts);

  const repoParts = parts.slice(1);
  return dockerHubRepoFromParts(repoParts);
};

const dockerHubTagsUrl = (packageName: string): string | null => {
  const repo = normalizeDockerHubRepo(packageName);
  if (!repo) return null;
  return "https://registry.hub.docker.com/v2/repositories/" + repo + "/tags?page_size=100";
};

const firstUsefulTag = (tags: DockerTag[] | undefined): string => {
  if (!tags) return "";

  const tag = tags.find((item) => item.name !== "latest");
  if (!tag) return "";
  return tag.name;
};

export class DockerProvider implements DependencyProvider {
  readonly language = LANGUAGES.DOCKER;
  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const payload = await this.getTags(packageName);
    if (!payload) return "";
    return firstUsefulTag(payload.results);
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const payload = await this.getTags(packageName);
    if (!payload) return [];
    if (!payload.results) return [];
    return payload.results.map((tag) => tag.name);
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const dependencies: Record<string, string> = {};

    content.split("\n").forEach((line) => {
      const image = parseDockerFromLine(line);
      if (!image) return;
      dependencies[image.name] = image.tag;
    });

    return { filePath, dependencies };
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updated = content
      .split("\n")
      .map((line) => updateDockerFromLine(line, manifest.dependencies))
      .join("\n");

    writeFileSync(filePath, withFinalNewline(updated));
  }

  validatePackageName(packageName: string): boolean {
    return DOCKER_PATTERNS.PACKAGE_NAME.test(packageName);
  }

  private async getTags(packageName: string): Promise<DockerTagsResponse | null> {
    const url = dockerHubTagsUrl(packageName);
    if (!url) return null;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const json = await response.json();
      return json as DockerTagsResponse;
    } catch (error) {
      if (this.options.debug) {
        logger.error("Failed to get docker tags for " + packageName, error as Error);
      }
      return null;
    }
  }
}

export { DOCKER_PACKAGE_MANAGER };
