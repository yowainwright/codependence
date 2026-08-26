import { basename, dirname } from "path";
import type { DependencyManifest, ResolvedDependencyVersions } from "../types";

export interface YamlFieldLine {
  readonly indent: number;
  readonly key: string;
  readonly listItem: boolean;
  readonly raw: string;
}

export interface ScalarRange {
  readonly end: number;
  readonly start: number;
  readonly value: string;
}

export interface ImageReference {
  readonly name: string;
  readonly version: string;
}

export const INFRA_TEMPLATE_PATTERN = /{{|}}|\$\{|<<|>>/;
export const DIGEST_PATTERN = /^sha256:[a-fA-F0-9]{64}$/;

const IMAGE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const IMAGE_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const GENERIC_INFRA_DIRECTORIES = new Set([".circleci", "k8s", "kubernetes", "manifests"]);

export const infraManifestName = (filePath: string): string => {
  const directory = basename(dirname(filePath));
  const parent = basename(dirname(dirname(filePath)));
  const hasProjectParent = Boolean(parent && parent !== ".");
  const shouldUseProjectParent = GENERIC_INFRA_DIRECTORIES.has(directory) && hasProjectParent;
  if (shouldUseProjectParent) {
    return parent;
  }

  const hasDirectoryName = Boolean(directory && directory !== ".");
  if (hasDirectoryName) return directory;
  return basename(filePath);
};

export const emptyInfraManifest = (filePath: string): DependencyManifest => ({
  dependencies: {},
  filePath,
  name: infraManifestName(filePath),
});

export const manifestOnlyResolution = (provider: string): never => {
  throw new Error(
    `${provider} provider requires explicit version pins and does not support latest resolution yet`,
  );
};

export const hasTemplate = (value: string | undefined): boolean => {
  if (!value) return false;
  return INFRA_TEMPLATE_PATTERN.test(value);
};

export const isSafeImageName = (value: string | undefined): value is string => {
  if (!value) return false;
  if (hasTemplate(value)) return false;
  return IMAGE_NAME_PATTERN.test(value);
};

export const isSafeImageVersion = (value: string | undefined): value is string => {
  if (!value) return false;
  if (hasTemplate(value)) return false;
  return IMAGE_TAG_PATTERN.test(value);
};

export const isSafeDigest = (value: string | undefined): value is string => {
  if (!value) return false;
  if (hasTemplate(value)) return false;
  return DIGEST_PATTERN.test(value);
};

const readQuotedScalarRange = (raw: string, start: number): ScalarRange | null => {
  const quote = raw[start];
  const valueStart = start + 1;
  const end = raw.indexOf(quote, valueStart);
  if (end < 0) return null;

  return { end, start: valueStart, value: raw.slice(valueStart, end) };
};

const plainScalarEnd = (raw: string, start: number): number => {
  const commentStart = raw.indexOf("#", start);
  let endLimit = commentStart;
  if (commentStart < 0) endLimit = raw.length;
  let end = endLimit;
  while (end > start && /\s/.test(raw[end - 1] ?? "")) end--;
  return end;
};

export const readScalarRange = (raw: string): ScalarRange | null => {
  const start = raw.search(/\S/);
  if (start < 0) return null;

  const first = raw[start];
  const isQuoted = first === '"' || first === "'";
  if (isQuoted) return readQuotedScalarRange(raw, start);

  const end = plainScalarEnd(raw, start);
  const value = raw.slice(start, end);
  if (!value) return null;
  return { end, start, value };
};

export const readYamlScalar = (raw: string): string | null => {
  const range = readScalarRange(raw);
  if (!range) return null;
  return range.value;
};

export const readYamlFieldLine = (line: string): YamlFieldLine | null => {
  const match = line.match(/^(\s*)(-\s+)?([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
  if (!match) return null;

  return {
    indent: match[1].length,
    key: match[3],
    listItem: Boolean(match[2]),
    raw: match[4],
  };
};

export const parseTaggedImage = (value: string | null): ImageReference | null => {
  if (!value) return null;
  if (hasTemplate(value)) return null;
  if (value.includes("@sha256:")) return null;

  const lastSlash = value.lastIndexOf("/");
  const lastColon = value.lastIndexOf(":");
  if (lastColon <= lastSlash) return null;

  const name = value.slice(0, lastColon);
  const version = value.slice(lastColon + 1);
  const isSafe = isSafeImageName(name) && isSafeImageVersion(version);
  if (!isSafe) return null;

  return { name, version };
};

export const appendDependencyVersion = (
  manifest: DependencyManifest,
  name: string,
  version: string,
): void => {
  const dependencyVersions = manifest.dependencyVersions || {};
  const versions = dependencyVersions[name] || [];
  dependencyVersions[name] = versions.concat(version);
  manifest.dependencyVersions = dependencyVersions;
  manifest.dependencies[name] = version;
};

export const targetVersionFor = (
  name: string,
  currentVersion: string,
  dependencies: Record<string, string>,
  resolvedDependencyVersions?: ResolvedDependencyVersions,
): string | undefined => {
  const resolvedVersions = resolvedDependencyVersions?.[name];
  const resolvedVersion = resolvedVersions?.[currentVersion];
  return resolvedVersion || dependencies[name];
};

export const updateScalarRange = (raw: string, range: ScalarRange, value: string): string => {
  const prefix = raw.slice(0, range.start);
  const suffix = raw.slice(range.end);
  return `${prefix}${value}${suffix}`;
};

export const updateScalarLine = (line: string, value: string): string => {
  const match = line.match(/^(\s*(?:-\s+)?[A-Za-z0-9_.-]+\s*:\s*)(.*)$/);
  if (!match) return line;

  const range = readScalarRange(match[2]);
  if (!range) return line;

  return `${match[1]}${updateScalarRange(match[2], range, value)}`;
};

export const updateTaggedImageRaw = (
  raw: string,
  dependencies: Record<string, string>,
  resolvedDependencyVersions?: ResolvedDependencyVersions,
): string => {
  const range = readScalarRange(raw);
  if (!range) return raw;

  const image = parseTaggedImage(range.value);
  if (!image) return raw;

  const version = targetVersionFor(
    image.name,
    image.version,
    dependencies,
    resolvedDependencyVersions,
  );
  if (!version) return raw;

  return updateScalarRange(raw, range, `${image.name}:${version}`);
};

export const updateYamlImageLine = (
  line: string,
  dependencies: Record<string, string>,
  resolvedDependencyVersions?: ResolvedDependencyVersions,
): string => {
  const match = line.match(/^(\s*(?:-\s+)?image\s*:\s*)(.*)$/);
  if (!match) return line;

  const updatedImage = updateTaggedImageRaw(match[2], dependencies, resolvedDependencyVersions);
  return `${match[1]}${updatedImage}`;
};

export const readYamlImageLine = (line: string): ImageReference | null => {
  const match = line.match(/^\s*(?:-\s+)?image\s*:\s*(.*)$/);
  if (!match) return null;
  return parseTaggedImage(readYamlScalar(match[1]));
};
