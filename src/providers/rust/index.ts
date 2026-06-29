import { readFileSync, writeFileSync } from "fs";
import { exec } from "../../utils/exec";
import { LANGUAGES } from "../constants";
import type {
  DependencyManifest,
  DependencyProvider,
  ProviderOptions,
} from "../types";
import {
  CARGO_PACKAGE_MANAGER,
  CARGO_PATTERNS,
} from "./constants";

type CargoSectionTarget = "dependencies" | "devDependencies";

const emptyManifest = (filePath: string): DependencyManifest => {
  const manifest = {
    filePath,
    dependencies: {},
    devDependencies: {},
  };
  return manifest;
};

const parseCargoSection = (section: string): CargoSectionTarget | null => {
  if (section === "dependencies") {
    return "dependencies";
  }
  if (section === "dev-dependencies") {
    return "devDependencies";
  }
  if (section === "build-dependencies") {
    return "devDependencies";
  }
  if (section.endsWith(".dependencies")) {
    return "dependencies";
  }
  if (section.endsWith(".dev-dependencies")) {
    return "devDependencies";
  }
  if (section.endsWith(".build-dependencies")) {
    return "devDependencies";
  }
  return null;
};

const readCargoDependencyVersion = (value: string): string | null => {
  const isLocalDependency = CARGO_PATTERNS.INLINE_GIT_OR_PATH.test(value);
  if (isLocalDependency) return null;

  if (value.startsWith('"')) {
    const quotedVersion = value.slice(1, -1);
    return quotedVersion;
  }

  const versionMatch = value.match(CARGO_PATTERNS.INLINE_VERSION);
  if (!versionMatch) return null;

  const inlineVersion = versionMatch[1];
  return inlineVersion;
};

const readCargoPackageName = (name: string, value: string): string => {
  const packageMatch = value.match(CARGO_PATTERNS.INLINE_PACKAGE);
  return packageMatch?.[1] || name;
};

const parseCargoDependencyLine = (
  line: string,
): readonly [string, string] | null => {
  const match = line.match(CARGO_PATTERNS.SIMPLE_DEPENDENCY);
  if (!match) return null;

  const version = readCargoDependencyVersion(match[5]);
  if (!version) return null;

  const packageName = readCargoPackageName(match[3], match[5]);
  const parsed = [packageName, version] as const;
  return parsed;
};

const assignDependency = (
  manifest: DependencyManifest,
  target: CargoSectionTarget,
  name: string,
  version: string,
): void => {
  const targetDependencies = manifest[target] || {};
  targetDependencies[name] = version;
  manifest[target] = targetDependencies;
};

export const normalizeCargoPackageName = (packageName: string): string =>
  packageName.replace(/[-_]/g, "-");

const cargoPackageNamesMatch = (left: string, right: string): boolean =>
  normalizeCargoPackageName(left) === normalizeCargoPackageName(right);

const readLatestCargoVersion = (stdout: string, packageName: string): string => {
  for (const line of stdout.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/);
    if (!match) continue;
    if (!cargoPackageNamesMatch(match[1], packageName)) continue;

    const latestVersion = match[2];
    return latestVersion;
  }

  return "";
};

const updateCargoDependencyValue = (
  value: string,
  version: string,
): string | null => {
  const isLocalDependency = CARGO_PATTERNS.INLINE_GIT_OR_PATH.test(value);
  if (isLocalDependency) return null;

  if (value.startsWith('"')) {
    const quotedVersion = `"${version}"`;
    return quotedVersion;
  }

  const updatedValue = value.replace(
    CARGO_PATTERNS.INLINE_VERSION,
    `version = "${version}"`,
  );
  return updatedValue;
};

export const updateCargoDependencyLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const match = line.match(CARGO_PATTERNS.SIMPLE_DEPENDENCY);
  if (!match) return line;

  const aliasName = match[3];
  const packageName = readCargoPackageName(aliasName, match[5]);
  const version = dependencies[packageName] || dependencies[aliasName];
  if (!version) return line;

  const updatedValue = updateCargoDependencyValue(match[5], version);
  if (!updatedValue) return line;

  const key = `${match[2]}${aliasName}${match[2]}`;
  const prefix = `${match[1]}${key}${match[4]}`;
  const suffix = match[7] || "";
  const updatedLine = `${prefix}${updatedValue}${suffix}`;
  return updatedLine;
};

const updateCargoLine = (
  line: string,
  section: CargoSectionTarget | null,
  manifest: DependencyManifest,
): string => {
  if (!section) return line;

  const dependencies = manifest[section] || {};
  const updatedLine = updateCargoDependencyLine(line, dependencies);
  return updatedLine;
};

export class RustProvider implements DependencyProvider {
  readonly language = LANGUAGES.RUST;
  readonly capabilities = {
    supportsLatestResolution: true,
    supportsPreciseMode: true,
    versionStrategy: "semver",
  } as const;

  constructor(_options: ProviderOptions = {}) {}

  normalizePackageName(packageName: string): string {
    return normalizeCargoPackageName(packageName);
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const args = ["search", packageName, "--limit", "1"];
    const result = await exec(CARGO_PACKAGE_MANAGER, args);
    const latestVersion = readLatestCargoVersion(result.stdout, packageName);
    return latestVersion;
  }

  async getAllVersions(_packageName: string): Promise<string[]> {
    const versions: string[] = [];
    return versions;
  }

  readManifest(filePath: string): DependencyManifest {
    const manifest = emptyManifest(filePath);
    let currentSection: CargoSectionTarget | null = null;
    const content = readFileSync(filePath, "utf8");

    for (const line of content.split("\n")) {
      const sectionMatch = line.match(CARGO_PATTERNS.SECTION);
      if (sectionMatch) {
        currentSection = parseCargoSection(sectionMatch[1]);
        continue;
      }
      if (!currentSection) continue;

      const parsed = parseCargoDependencyLine(line);
      if (!parsed) continue;

      const [name, version] = parsed;
      assignDependency(manifest, currentSection, name, version);
    }

    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    let currentSection: CargoSectionTarget | null = null;
    const content = readFileSync(filePath, "utf8");
    const updatedLines: string[] = [];

    for (const line of content.split("\n")) {
      const sectionMatch = line.match(CARGO_PATTERNS.SECTION);
      if (sectionMatch) {
        currentSection = parseCargoSection(sectionMatch[1]);
        updatedLines.push(line);
        continue;
      }

      const updatedLine = updateCargoLine(line, currentSection, manifest);
      updatedLines.push(updatedLine);
    }

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = CARGO_PATTERNS.PACKAGE_NAME.test(packageName);
    return isValid;
  }
}
