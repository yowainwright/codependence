import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import { DOCKER_PATTERNS } from "./constants";

type DockerImage = {
  readonly name: string;
  readonly version: string;
};

const emptyManifest = (filePath: string): DependencyManifest => {
  const manifest = {
    filePath,
    dependencies: {},
  };
  return manifest;
};

const isScratchImage = (image: DockerImage): boolean => image.name === "scratch";

const hasDockerVariable = (image: string): boolean => image.includes("$");

const unsupportedDockerResolution = (): Error =>
  new Error(
    'Docker provider requires explicit version pins, e.g. {"node":"24-slim"}; latest resolution and precise mode are not supported yet.',
  );

const splitDockerImage = (image: string): DockerImage => {
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  const hasTag = lastColon > lastSlash;

  if (!hasTag) {
    const imageSpec = { name: image, version: "latest" };
    return imageSpec;
  }

  const name = image.slice(0, lastColon);
  const version = image.slice(lastColon + 1);
  const imageSpec = { name, version };
  return imageSpec;
};

const readDockerFromLine = (line: string): DockerImage | null => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return null;
  if (hasDockerVariable(match[2])) return null;
  if (match[3].trimStart().startsWith("@")) return null;

  const imageSpec = splitDockerImage(match[2]);
  if (isScratchImage(imageSpec)) return null;

  return imageSpec;
};

export const updateDockerFromLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return line;
  if (hasDockerVariable(match[2])) return line;
  if (match[3].trimStart().startsWith("@")) return line;

  const imageSpec = splitDockerImage(match[2]);
  if (isScratchImage(imageSpec)) return line;

  const version = dependencies[imageSpec.name];
  if (!version) return line;

  const updatedImage = `${imageSpec.name}:${version}`;
  const updatedLine = `${match[1]}${updatedImage}${match[3]}`;
  return updatedLine;
};

export class DockerProvider implements DependencyProvider {
  readonly language = LANGUAGES.DOCKER;
  readonly capabilities = {
    supportsLatestResolution: false,
    supportsPreciseMode: false,
    versionStrategy: "exact",
  } as const;

  async getLatestVersion(_packageName: string): Promise<string> {
    throw unsupportedDockerResolution();
  }

  async getAllVersions(_packageName: string): Promise<string[]> {
    throw unsupportedDockerResolution();
  }

  readManifest(filePath: string): DependencyManifest {
    const manifest = emptyManifest(filePath);
    const content = readFileSync(filePath, "utf8");

    for (const line of content.split("\n")) {
      const imageSpec = readDockerFromLine(line);
      if (!imageSpec) continue;

      manifest.dependencies[imageSpec.name] = imageSpec.version;
    }

    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updatedLines: string[] = [];

    for (const line of content.split("\n")) {
      const updatedLine = updateDockerFromLine(line, manifest.dependencies);
      updatedLines.push(updatedLine);
    }

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = DOCKER_PATTERNS.PACKAGE_NAME.test(packageName);
    return isValid;
  }
}
