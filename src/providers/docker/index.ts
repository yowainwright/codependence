import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type {
  DependencyManifest,
  DependencyProvider,
  DockerArgument,
  DockerArgumentReference,
  DockerArguments,
  DockerImage,
} from "../types";
import { DOCKER_PATTERNS } from "./constants";

const emptyManifest = (filePath: string): DependencyManifest => {
  const manifest = {
    filePath,
    dependencies: {},
  };
  return manifest;
};

const isScratchImage = (image: DockerImage): boolean => image.name === "scratch";

const hasDockerVariable = (image: string): boolean => image.includes("$");

const readDockerArgument = (line: string): DockerArgument | null => {
  const match = line.match(DOCKER_PATTERNS.ARG_LINE);
  if (!match) return null;

  return { name: match[2], value: match[5] };
};

const dockerArgumentReference = (value: string): DockerArgumentReference | null => {
  const match = value.match(DOCKER_PATTERNS.ARG_REFERENCE);
  if (!match) return null;

  const matchIndex = match.index || 0;
  const prefix = value.slice(0, matchIndex);
  const suffix = value.slice(matchIndex + match[0].length);
  const remainingValue = `${prefix}${suffix}`;
  if (remainingValue.includes("$")) return null;

  const name = match[1] || match[2];
  return name ? { name, prefix, suffix } : null;
};

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

const resolveDockerVersion = (version: string, args: DockerArguments): string | null => {
  if (!hasDockerVariable(version)) return version;

  const reference = dockerArgumentReference(version);
  if (!reference) return null;

  const argumentValue = args[reference.name];
  return argumentValue ? `${reference.prefix}${argumentValue}${reference.suffix}` : null;
};

const argumentValueForVersion = (
  version: string,
  reference: DockerArgumentReference,
): string | null => {
  const hasPrefix = version.startsWith(reference.prefix);
  const hasSuffix = version.endsWith(reference.suffix);
  if (!hasPrefix || !hasSuffix) return null;

  const suffixStart = reference.suffix ? -reference.suffix.length : undefined;
  return version.slice(reference.prefix.length, suffixStart) || null;
};

const readDockerFromLine = (line: string, args: DockerArguments): DockerImage | null => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match) return null;
  if (match[3].trimStart().startsWith("@")) return null;

  const imageSpec = splitDockerImage(match[2]);
  if (hasDockerVariable(imageSpec.name)) return null;
  if (isScratchImage(imageSpec)) return null;

  const version = resolveDockerVersion(imageSpec.version, args);
  if (!version) return null;

  return { name: imageSpec.name, version };
};

const readDockerArguments = (lines: string[]): DockerArguments =>
  lines.reduce((args, line) => {
    const argument = readDockerArgument(line);
    if (argument) args[argument.name] = argument.value;
    return args;
  }, {} as DockerArguments);

const requestedArgumentUpdate = (
  line: string,
  args: DockerArguments,
  dependencies: Record<string, string>,
): readonly [string, string] | null => {
  const match = line.match(DOCKER_PATTERNS.FROM_LINE);
  if (!match || match[3].trimStart().startsWith("@")) return null;

  const imageSpec = splitDockerImage(match[2]);
  if (hasDockerVariable(imageSpec.name) || isScratchImage(imageSpec)) return null;

  const reference = dockerArgumentReference(imageSpec.version);
  if (!reference) return null;

  const argumentDefault = args[reference.name];
  const version = dependencies[imageSpec.name];
  if (!argumentDefault || !version) return null;

  const argumentValue = argumentValueForVersion(version, reference);
  return argumentValue ? [reference.name, argumentValue] : null;
};

const collectArgumentUpdates = (
  lines: string[],
  args: DockerArguments,
  dependencies: Record<string, string>,
): DockerArguments => {
  const updates: DockerArguments = {};
  const conflicts = new Set<string>();

  lines.forEach((line) => {
    const update = requestedArgumentUpdate(line, args, dependencies);
    if (!update) return;

    const [name, version] = update;
    if (updates[name] && updates[name] !== version) conflicts.add(name);
    updates[name] = version;
  });

  conflicts.forEach((name) => delete updates[name]);
  return updates;
};

const updateDockerArgumentLine = (line: string, updates: DockerArguments): string => {
  const match = line.match(DOCKER_PATTERNS.ARG_LINE);
  if (!match) return line;

  const version = updates[match[2]];
  if (!version) return line;

  return `${match[1]}${match[2]}${match[3]}${match[4]}${version}${match[4]}${match[6]}`;
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
    const args: DockerArguments = {};

    for (const line of content.split("\n")) {
      const argument = readDockerArgument(line);
      if (argument) args[argument.name] = argument.value;

      const imageSpec = readDockerFromLine(line, args);
      if (!imageSpec) continue;

      manifest.dependencies[imageSpec.name] = imageSpec.version;
    }

    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const args = readDockerArguments(lines);
    const updates = collectArgumentUpdates(lines, args, manifest.dependencies);
    const updatedLines = lines.map((line) => {
      const updatedArgument = updateDockerArgumentLine(line, updates);
      return updateDockerFromLine(updatedArgument, manifest.dependencies);
    });

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = packageName.match(DOCKER_PATTERNS.PACKAGE_NAME) !== null;
    return isValid;
  }
}
