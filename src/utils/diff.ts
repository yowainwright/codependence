import { readFileSync } from "fs";
import { resolve } from "path";
import type { DependencyManifest } from "../providers/types";
import type { VersionStrategy } from "../providers/types";
import type { Level, VersionDiff, VersionDiffContext } from "../types";
import { DEP_SECTIONS } from "../scripts/constants";
import { formatVersionTable } from "./table";
import { isWithinLevel } from "./semver";
import { SYMBOLS } from "./constants";
import { logger } from "../logger";

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
    return version !== latestVersion ? version : currentVersion;
  }, currentVersion);
};

const toVersionDiff = (
  pkgName: string,
  currentVersion: string,
  latestVersion: string,
  context: VersionDiffContext,
): VersionDiff => {
  const { codependencies, permissive, level, versionStrategy } = context;
  const withinLevel = isWithinLevel(currentVersion, latestVersion, level, versionStrategy);
  const isPinned = codependencies.includes(pkgName);
  const isPermissiveUpdate = !isPinned && withinLevel;
  const isStandardUpdate = isPinned && withinLevel;
  const willUpdate = permissive ? isPermissiveUpdate : isStandardUpdate;

  return {
    package: pkgName,
    current: currentVersion,
    latest: latestVersion,
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

export const displayVersionDiffs = (diffs: VersionDiff[], isDryRun: boolean): void => {
  const diffsToShow = diffs.filter((d) => d.current !== d.latest);

  if (diffsToShow.length === 0) {
    logger.print(`\n${SYMBOLS.success} All dependencies are up-to-date!\n`);
    return;
  }

  const header = isDryRun
    ? `\n${SYMBOLS.info} Dependencies that would be updated:`
    : `\n${SYMBOLS.info} Dependency Updates Available:`;

  logger.print(header);
  logger.print(formatVersionTable(diffsToShow));
  logger.print("");
};

const readDependencyManifest = (
  file: string,
  rootDir: string,
): DependencyManifest | null => {
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

const versionDiffKey = (
  diff: VersionDiff,
  resolvedPackages: ReadonlySet<string>,
): string => {
  const current = resolvedPackages.has(diff.package) ? diff.current : "";
  return `${diff.package}\0${current}\0${diff.latest}`;
};

export const deduplicateVersionDiffs = (
  diffs: VersionDiff[],
  resolvedPackages: ReadonlySet<string> = new Set(),
): VersionDiff[] => {
  const seen = new Set<string>();
  return diffs.filter((diff) => {
    const key = versionDiffKey(diff, resolvedPackages);
    const isDuplicate = seen.has(key);
    seen.add(key);
    return !isDuplicate;
  });
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
  return collectDiffsFromManifests(
    versionMap,
    manifests,
    codependencies,
    permissive,
    level,
  );
};
