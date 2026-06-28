import { readFileSync, writeFileSync } from "fs";
import { logger } from "../../logger";
import { LANGUAGES } from "../constants";
import {
  CARGO_PACKAGE_MANAGER,
  CARGO_PATTERNS,
  CARGO_SECTION_TYPES,
  type CargoSectionType,
} from "./constants";
import type { DependencyManifest, DependencyProvider, ProviderOptions } from "../types";

type DependencySectionName = "dependencies" | "devDependencies" | "optionalDependencies";

type CratesIoVersion = {
  num: string;
  yanked?: boolean;
};

type CratesIoResponse = {
  crate?: {
    max_stable_version?: string;
    max_version?: string;
    newest_version?: string;
  };
  versions?: CratesIoVersion[];
};

const normalizeKey = (key: string): string => key.replace(/^"|"$/g, "");

const isDependencySection = (section: string): boolean => {
  const isRootSection = section === "dependencies";
  const isTargetSection = section.endsWith(".dependencies");
  return isRootSection || isTargetSection;
};

const isDevDependencySection = (section: string): boolean => {
  const isRootSection = section === "dev-dependencies";
  const isTargetSection = section.endsWith(".dev-dependencies");
  return isRootSection || isTargetSection;
};

const isBuildDependencySection = (section: string): boolean => {
  const isRootSection = section === "build-dependencies";
  const isTargetSection = section.endsWith(".build-dependencies");
  return isRootSection || isTargetSection;
};

const getSectionType = (section: string): CargoSectionType | null => {
  if (isDependencySection(section)) return CARGO_SECTION_TYPES.DEPENDENCY;
  if (isDevDependencySection(section)) return CARGO_SECTION_TYPES.DEV;
  if (isBuildDependencySection(section)) return CARGO_SECTION_TYPES.BUILD;
  return null;
};

const getManifestSection = (sectionType: CargoSectionType): DependencySectionName => {
  if (sectionType === CARGO_SECTION_TYPES.DEV) return "devDependencies";
  if (sectionType === CARGO_SECTION_TYPES.BUILD) return "optionalDependencies";
  return "dependencies";
};

const readInlineVersion = (value: string): string | null => {
  const isGitOrPath = CARGO_PATTERNS.INLINE_GIT_OR_PATH.test(value);
  if (isGitOrPath) return null;

  const match = value.match(CARGO_PATTERNS.INLINE_VERSION);
  if (!match) return null;
  return match[1];
};

const readStringVersion = (value: string): string | null => {
  const match = value.match(/^"([^"]+)"/);
  if (!match) return null;
  return match[1];
};

const readDependencyVersion = (value: string): string | null => {
  const trimmed = value.trim();
  const isInlineTable = trimmed.startsWith("{");
  if (isInlineTable) return readInlineVersion(trimmed);

  const isStringVersion = trimmed.startsWith('"');
  if (!isStringVersion) return null;
  return readStringVersion(trimmed);
};

const dependencyValueFromMatch = (match: RegExpMatchArray): string => {
  const stringValue = match[4] || "";
  const suffix = match[6] || "";
  return stringValue + suffix;
};

export const parseCargoDependencyLine = (
  line: string,
): { name: string; version: string } | null => {
  const match = line.match(CARGO_PATTERNS.SIMPLE_DEPENDENCY);
  if (!match) return null;

  const value = dependencyValueFromMatch(match);
  const version = readDependencyVersion(value);
  if (!version) return null;

  return {
    name: normalizeKey(match[2]),
    version,
  };
};

const updateInlineDependency = (value: string, newVersion: string): string => {
  const isGitOrPath = CARGO_PATTERNS.INLINE_GIT_OR_PATH.test(value);
  if (isGitOrPath) return value;

  const replacement = 'version = "' + newVersion + '"';
  return value.replace(CARGO_PATTERNS.INLINE_VERSION, replacement);
};

const updateStringDependency = (match: RegExpMatchArray, newVersion: string): string => {
  const suffix = match[6] || "";
  return match[1] + match[2] + match[3] + '"' + newVersion + '"' + suffix;
};

export const updateCargoDependencyLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const match = line.match(CARGO_PATTERNS.SIMPLE_DEPENDENCY);
  if (!match) return line;

  const packageName = normalizeKey(match[2]);
  const newVersion = dependencies[packageName];
  if (!newVersion) return line;

  const value = dependencyValueFromMatch(match);
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    const updatedValue = updateInlineDependency(value, newVersion);
    return match[1] + match[2] + match[3] + updatedValue;
  }

  if (!trimmed.startsWith('"')) return line;
  return updateStringDependency(match, newVersion);
};

const withFinalNewline = (content: string): string => {
  if (content.endsWith("\n")) return content;
  return content + "\n";
};

const createCargoManifest = (filePath: string): DependencyManifest => {
  return {
    filePath,
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
  };
};

const cratesIoUrl = (packageName: string): string => {
  const encodedPackageName = encodeURIComponent(packageName);
  return "https://crates.io/api/v1/crates/" + encodedPackageName;
};

const firstAvailableVersion = (versions: CratesIoVersion[] | undefined): string => {
  if (!versions) return "";

  const firstVersion = versions.find((version) => !version.yanked);
  if (!firstVersion) return "";
  return firstVersion.num;
};

const selectLatestVersion = (payload: CratesIoResponse): string => {
  const crate = payload.crate;
  if (crate?.max_stable_version) return crate.max_stable_version;
  if (crate?.newest_version) return crate.newest_version;
  if (crate?.max_version) return crate.max_version;
  return firstAvailableVersion(payload.versions);
};

const nonYankedVersions = (versions: CratesIoVersion[] | undefined): string[] => {
  if (!versions) return [];

  return versions.reduce((acc: string[], version) => {
    if (version.yanked) return acc;
    return acc.concat(version.num);
  }, []);
};

const CRATES_IO_REQUEST_OPTIONS: RequestInit = {
  headers: {
    "User-Agent": "codependence (https://github.com/yowainwright/codependence)",
  },
};

export class RustProvider implements DependencyProvider {
  readonly language = LANGUAGES.RUST;
  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const payload = await this.getCrate(packageName);
    if (!payload) return "";
    return selectLatestVersion(payload);
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const payload = await this.getCrate(packageName);
    if (!payload) return [];
    return nonYankedVersions(payload.versions);
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const manifest = createCargoManifest(filePath);
    let activeSection: DependencySectionName | null = null;

    content.split("\n").forEach((line) => {
      const section = this.readSection(line);
      if (section !== undefined) {
        activeSection = section;
        return;
      }

      if (!activeSection) return;

      const dependency = parseCargoDependencyLine(line);
      if (!dependency) return;

      manifest[activeSection]![dependency.name] = dependency.version;
    });

    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    let activeSection: DependencySectionName | null = null;

    const updated = content
      .split("\n")
      .map((line) => {
        const section = this.readSection(line);
        if (section !== undefined) {
          activeSection = section;
          return line;
        }

        if (!activeSection) return line;

        const dependencies = manifest[activeSection] || {};
        return updateCargoDependencyLine(line, dependencies);
      })
      .join("\n");

    writeFileSync(filePath, withFinalNewline(updated));
  }

  validatePackageName(packageName: string): boolean {
    return CARGO_PATTERNS.PACKAGE_NAME.test(packageName);
  }

  private readSection(line: string): DependencySectionName | null | undefined {
    const match = line.match(CARGO_PATTERNS.SECTION);
    if (!match) return undefined;

    const sectionType = getSectionType(match[1]);
    if (!sectionType) return null;

    return getManifestSection(sectionType);
  }

  private async getCrate(packageName: string): Promise<CratesIoResponse | null> {
    try {
      const url = cratesIoUrl(packageName);
      const response = await fetch(url, CRATES_IO_REQUEST_OPTIONS);
      if (!response.ok) return null;

      const json = await response.json();
      return json as CratesIoResponse;
    } catch (error) {
      if (this.options.debug) {
        logger.error("Failed to get cargo version for " + packageName, error as Error);
      }
      return null;
    }
  }
}

export { CARGO_PACKAGE_MANAGER };
