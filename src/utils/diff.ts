import { readFileSync } from "fs";
import { resolve } from "path";
import type { DependencyManifest } from "../providers/types";
import type { VersionStrategy } from "../providers/types";
import type { Level, VersionDiff } from "../types";
import { DEP_SECTIONS } from "../scripts/constants";
import { formatVersionTable } from "./table";
import { isWithinLevel } from "./semver";
import { SYMBOLS } from "./constants";

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
  codependencies: string[],
  permissive: boolean,
  level: Level,
  versionStrategy: VersionStrategy,
): VersionDiff => {
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

export const buildVersionDiff = (
  versionMap: Record<string, string>,
  packageJson: Pick<
    DependencyManifest,
    | "dependencies"
    | "dependencyVersions"
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
    .map(([pkgName, currentVersion]) =>
      toVersionDiff(
        pkgName,
        versionForComparison(packageJson, pkgName, currentVersion, versionMap[pkgName]),
        versionMap[pkgName],
        codependencies,
        permissive,
        level,
        versionStrategy,
      ),
    );

export const displayVersionDiffs = (diffs: VersionDiff[], isDryRun: boolean): void => {
  const diffsToShow = diffs.filter((d) => d.current !== d.latest);

  if (diffsToShow.length === 0) {
    console.log(`\n${SYMBOLS.success} All dependencies are up-to-date!\n`);
    return;
  }

  const header = isDryRun
    ? `\n${SYMBOLS.info} Dependencies that would be updated:`
    : `\n${SYMBOLS.info} Dependency Updates Available:`;

  console.log(header);
  console.log(formatVersionTable(diffsToShow));
  console.log("");
};

const readPackageDiffs = (
  versionMap: Record<string, string>,
  file: string,
  rootDir: string,
  codependencies: string[],
  permissive: boolean,
  level: Level,
): VersionDiff[] => {
  const path = resolve(rootDir, file);
  try {
    const packageJson = JSON.parse(readFileSync(path, "utf8"));
    return buildVersionDiff(versionMap, packageJson, codependencies, permissive, level);
  } catch {
    return [];
  }
};

export const deduplicateVersionDiffs = (diffs: VersionDiff[]): VersionDiff[] => {
  const seen = new Set<string>();
  return diffs.filter((diff) => {
    const isDuplicate = seen.has(diff.package);
    seen.add(diff.package);
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
  return deduplicateVersionDiffs(allDiffs);
};

export const collectAllDiffs = (
  versionMap: Record<string, string>,
  files: string[],
  rootDir: string,
  codependencies: string[],
  permissive: boolean,
  level: Level = "major",
): VersionDiff[] => {
  const allDiffs = files.flatMap((file) =>
    readPackageDiffs(versionMap, file, rootDir, codependencies, permissive, level),
  );
  return deduplicateVersionDiffs(allDiffs);
};
