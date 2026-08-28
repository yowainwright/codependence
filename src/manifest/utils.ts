import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DependencyManifest, VersionStrategy } from "../providers/types";
import type { Level, VersionDiff, VersionDiffContext } from "../types";
import { logger } from "../observability";
import { DEP_SECTIONS } from "./constants";
import { SYMBOLS } from "../dx/report/constants";
import { formatVersionTable } from "../dx/output";
import {
  PACKAGE_NAME_EXCLUSIONS,
  REPEATING_VERSION_PREFIXES,
  SCOPED_PACKAGE_PATTERN,
  STRICT_INEQUALITY_VERSION_PREFIXES,
  VERSION_COMPARISON_PREFIXES,
  VERSION_PREFIXES,
} from "./constants";
import type { CacheEntry, CacheStats, ValidationResult } from "./types";

export const stripRepeatingVersionPrefixes = (version: string): string => {
  let index = 0;
  while (REPEATING_VERSION_PREFIXES.includes(version[index] as "^" | "~")) index++;
  return version.slice(index);
};

const stripVersionPrefix = (version: string): string => {
  const comparisonPrefix = VERSION_COMPARISON_PREFIXES.find((prefix) => version.startsWith(prefix));
  if (comparisonPrefix) return version.slice(comparisonPrefix.length);

  const withoutRepeatingPrefixes = stripRepeatingVersionPrefixes(version);
  if (withoutRepeatingPrefixes !== version) return withoutRepeatingPrefixes;
  return version.startsWith("v") ? version.slice(1) : version;
};

export const parseSemver = (version: string): [number, number, number] => {
  const cleaned = stripVersionPrefix(version);
  const parts = cleaned.split(".").map(Number);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;
  return [major, minor, patch];
};

export const constructVersionTypes = (version: string): Record<string, string> => {
  const prefix = VERSION_PREFIXES.find((candidate) => version.startsWith(candidate));

  if (!prefix) return { bumpCharacter: "", bumpVersion: version, exactVersion: version };

  const isStrictInequality = STRICT_INEQUALITY_VERSION_PREFIXES.some(
    (strictPrefix) => strictPrefix === prefix,
  );
  const isRepeatingPrefix = prefix === "^" || prefix === "~";
  const repeatedBumpCharacter = isRepeatingPrefix ? version[0] : prefix;
  const bumpCharacter = isStrictInequality ? "" : repeatedBumpCharacter;
  const exactVersion = isRepeatingPrefix
    ? stripRepeatingVersionPrefixes(version)
    : version.slice(prefix.length);

  return { bumpCharacter, bumpVersion: version, exactVersion };
};

export const isExplicitTargetSpec = (version: string): boolean => {
  const { bumpVersion, exactVersion } = constructVersionTypes(version);
  return bumpVersion !== exactVersion;
};

export const constructExpectedVersion = (
  currentBumpCharacter: string,
  targetVersion: string,
): string => {
  const target = constructVersionTypes(targetVersion);
  if (isExplicitTargetSpec(targetVersion)) return target.bumpVersion;
  return `${currentBumpCharacter}${target.exactVersion}`;
};

export const isWithinLevel = (
  current: string,
  latest: string,
  level: Level,
  versionStrategy: VersionStrategy = "semver",
): boolean => {
  if (versionStrategy === "exact") return true;
  if (level === "major") return true;

  const [currentMajor, currentMinor] = parseSemver(current);
  const [latestMajor, latestMinor] = parseSemver(latest);
  const sameMajor = currentMajor === latestMajor;
  const sameMinor = currentMinor === latestMinor;
  if (level === "minor") return sameMajor;
  return sameMajor && sameMinor;
};

const extractDepsFromSection = (
  packageJson: Pick<
    DependencyManifest,
    "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies"
  > & { versionStrategy?: VersionStrategy },
  section: keyof Pick<
    DependencyManifest,
    "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies"
  >,
): [string, string][] => {
  const deps = packageJson[section];
  if (!deps) return [];
  return Object.entries(deps);
};

const extractAllDeps = (
  packageJson: Pick<
    DependencyManifest,
    "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies"
  >,
): [string, string][] =>
  DEP_SECTIONS.flatMap((section) => extractDepsFromSection(packageJson, section));

const versionForComparison = (
  packageJson: Pick<DependencyManifest, "dependencyVersions">,
  packageName: string,
  currentVersion: string,
  latestVersion: string,
): string => {
  const versions = packageJson.dependencyVersions?.[packageName] || [];
  return versions.reduce((comparedVersion, version) => {
    if (comparedVersion !== currentVersion) return comparedVersion;
    const isDifferentVersion = version !== latestVersion;
    return isDifferentVersion ? version : currentVersion;
  }, currentVersion);
};

const toVersionDiff = (
  pkgName: string,
  currentVersion: string,
  latestVersion: string,
  context: VersionDiffContext,
): VersionDiff => {
  const { codependencies, permissive, level, versionStrategy } = context;
  const currentVersionTypes = constructVersionTypes(currentVersion);
  const latestVersionTypes = constructVersionTypes(latestVersion);
  const withinLevel = isWithinLevel(currentVersion, latestVersion, level, versionStrategy);
  let isDifferent = currentVersionTypes.exactVersion !== latestVersionTypes.exactVersion;
  if (isExplicitTargetSpec(latestVersion)) {
    isDifferent = latestVersion !== currentVersion;
  }
  const isPinned = codependencies.includes(pkgName);
  const installed = constructExpectedVersion(currentVersionTypes.bumpCharacter, latestVersion);
  const isPermissiveUpdate = !isPinned && isDifferent && withinLevel;
  const isStandardUpdate = isPinned && isDifferent && withinLevel;
  const willUpdate = permissive ? isPermissiveUpdate : isStandardUpdate;

  return {
    package: pkgName,
    current: currentVersion,
    latest: latestVersion,
    installed,
    isPinned,
    willUpdate,
  };
};

const resolvedVersionDiffs = (
  packageJson: Pick<DependencyManifest, "resolvedDependencyVersions">,
  packageName: string,
  context: VersionDiffContext,
): VersionDiff[] => {
  const resolvedVersions = packageJson.resolvedDependencyVersions?.[packageName];
  if (!resolvedVersions) return [];

  return Object.entries(resolvedVersions).map(([currentVersion, latestVersion]) =>
    toVersionDiff(packageName, currentVersion, latestVersion, context),
  );
};

const versionDiffsForDependency = (
  packageJson: Pick<DependencyManifest, "dependencyVersions" | "resolvedDependencyVersions">,
  packageName: string,
  currentVersion: string,
  latestVersion: string,
  context: VersionDiffContext,
): VersionDiff[] => {
  const resolvedDiffs = resolvedVersionDiffs(packageJson, packageName, context);
  if (resolvedDiffs.length > 0) return resolvedDiffs;

  const comparedVersion = versionForComparison(
    packageJson,
    packageName,
    currentVersion,
    latestVersion,
  );
  return [toVersionDiff(packageName, comparedVersion, latestVersion, context)];
};

export const buildVersionDiff = (
  versionMap: Record<string, string>,
  packageJson: Pick<
    DependencyManifest,
    | "dependencies"
    | "dependencyVersions"
    | "resolvedDependencyVersions"
    | "devDependencies"
    | "peerDependencies"
    | "optionalDependencies"
  > & { path?: string; versionStrategy?: VersionStrategy },
  codependencies: string[],
  permissive: boolean,
  level: Level = "major",
  versionStrategy: VersionStrategy = packageJson.versionStrategy || "semver",
): VersionDiff[] =>
  extractAllDeps(packageJson)
    .filter(([pkgName]) => versionMap[pkgName] !== undefined)
    .flatMap(([pkgName, currentVersion]) =>
      versionDiffsForDependency(packageJson, pkgName, currentVersion, versionMap[pkgName], {
        codependencies,
        permissive,
        level,
        versionStrategy,
      }),
    );

export const displayVersionDiffs = (diffs: VersionDiff[]): void => {
  const diffsToShow = diffs.filter((d) => d.willUpdate);

  if (diffsToShow.length === 0) {
    logger.print(`\n${SYMBOLS.success} All dependencies are up-to-date!\n`);
    return;
  }

  logger.print(`\n${SYMBOLS.info} Dependency Updates Available:`);
  logger.print(formatVersionTable(diffsToShow, "check"));
  logger.print("");
};

const readDependencyManifest = (file: string, rootDir: string): DependencyManifest | null => {
  const path = resolve(rootDir, file);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const resolvedPackageNames = (
  manifests: ReadonlyArray<DependencyManifest>,
): ReadonlySet<string> => {
  const packageNames = manifests.flatMap((manifest) =>
    Object.keys(manifest.resolvedDependencyVersions || {}),
  );
  return new Set(packageNames);
};

const versionDiffKey = (diff: VersionDiff, resolvedPackages: ReadonlySet<string>): string => {
  const current = resolvedPackages.has(diff.package) ? diff.current : "";
  return `${diff.package}\0${current}\0${diff.latest}`;
};

export const deduplicateVersionDiffs = (
  diffs: VersionDiff[],
  resolvedPackages: ReadonlySet<string> = new Set(),
): VersionDiff[] => {
  const seen = new Set<string>();
  return diffs.reduce<VersionDiff[]>((uniqueDiffs, diff) => {
    const key = versionDiffKey(diff, resolvedPackages);
    if (seen.has(key)) return uniqueDiffs;
    seen.add(key);
    return uniqueDiffs.concat(diff);
  }, []);
};

export const collectDiffsFromManifests = (
  versionMap: Record<string, string>,
  manifests: Array<DependencyManifest & { versionStrategy?: VersionStrategy }>,
  codependencies: string[],
  permissive: boolean,
  level: Level = "major",
): VersionDiff[] => {
  const allDiffs = manifests.flatMap((manifest) =>
    buildVersionDiff(versionMap, manifest, codependencies, permissive, level),
  );
  return deduplicateVersionDiffs(allDiffs, resolvedPackageNames(manifests));
};

export const collectAllDiffs = (
  versionMap: Record<string, string>,
  files: string[],
  rootDir: string,
  codependencies: string[],
  permissive: boolean,
  level: Level = "major",
): VersionDiff[] => {
  const manifests = files
    .map((file) => readDependencyManifest(file, rootDir))
    .filter((manifest): manifest is DependencyManifest => manifest !== null);
  return collectDiffsFromManifests(versionMap, manifests, codependencies, permissive, level);
};

const buildValidationResult = (warnings: string[], errors: string[]): ValidationResult => {
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const validForNewPackages = !hasErrors && !hasWarnings;
  const result: ValidationResult = {
    validForNewPackages,
    validForOldPackages: !hasErrors,
  };
  if (warnings.length > 0) result.warnings = warnings;
  if (errors.length > 0) result.errors = errors;
  return result;
};

const packageNameWarnings = (name: string): string[] => {
  const maxLengthWarning =
    name.length > 214 ? ["name can no longer contain more than 214 characters"] : [];
  const caseWarning =
    name.toLowerCase() !== name ? ["name can no longer contain capital letters"] : [];
  const lastSegment = name.split("/").slice(-1)[0];
  const characterWarning = /[~'!()*]/.test(lastSegment)
    ? ['name can no longer contain special characters ("~\'!()*")']
    : [];
  return maxLengthWarning.concat(caseWarning, characterWarning);
};

const scopedPackageErrors = (name: string): string[] => {
  if (encodeURIComponent(name) === name) return [];
  const nameMatch = name.match(SCOPED_PACKAGE_PATTERN);
  if (!nameMatch) return ["name can only contain URL-friendly characters"];

  const user = nameMatch[1];
  const packageName = nameMatch[2];
  if (packageName?.startsWith(".")) return ["name cannot start with a period"];
  const segmentsAreValid =
    encodeURIComponent(user) === user && encodeURIComponent(packageName) === packageName;
  return segmentsAreValid ? [] : ["name can only contain URL-friendly characters"];
};

const packageNameErrors = (name: string): string[] => {
  const emptyError = name.length === 0 ? ["name length must be greater than zero"] : [];
  const periodError = name.startsWith(".") ? ["name cannot start with a period"] : [];
  const underscoreError = name.startsWith("_") ? ["name cannot start with an underscore"] : [];
  const whitespaceError =
    name.trim() !== name ? ["name cannot contain leading or trailing spaces"] : [];
  const isExcluded = PACKAGE_NAME_EXCLUSIONS.some((excluded) => name.toLowerCase() === excluded);
  const exclusionError = isExcluded ? [`${name.toLowerCase()} is not a valid package name`] : [];
  return emptyError.concat(
    periodError,
    underscoreError,
    whitespaceError,
    exclusionError,
    scopedPackageErrors(name),
  );
};

export const validatePackageName = (name: unknown): ValidationResult => {
  if (name === null) return buildValidationResult([], ["name cannot be null"]);
  if (name === undefined) return buildValidationResult([], ["name cannot be undefined"]);
  if (typeof name !== "string") return buildValidationResult([], ["name must be a string"]);
  return buildValidationResult(packageNameWarnings(name), packageNameErrors(name));
};

export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;
  private hits = 0;
  private misses = 0;

  constructor(ttlMinutes = 5) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return this.recordMiss();
    const isExpired = Date.now() - entry.timestamp > this.ttl;
    if (!isExpired) {
      this.hits++;
      return entry.value;
    }
    this.cache.delete(key);
    return this.recordMiss();
  }

  private recordMiss(): null {
    this.misses++;
    return null;
  }

  set(key: string, value: string): void {
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    return { hits: this.hits, misses: this.misses, size: this.cache.size };
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    const hitRate = (this.hits / total) * 100;
    return hitRate;
  }
}

export const versionCache = new ResponseCache(5);

export class RequestDeduplicator {
  private pending = new Map<string, Promise<unknown>>();

  async dedupe<T>(key: string, request: () => Promise<T>): Promise<T> {
    const pendingRequest = this.pending.get(key);
    if (pendingRequest) return pendingRequest as Promise<T>;
    const promise = request();
    this.pending.set(key, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(key);
    }
  }

  clear(): void {
    this.pending.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();
