import { readFileSync } from "fs";
import type { Level, VersionDiff } from "../types";
import { DEP_SECTIONS } from "../scripts/constants";
import { formatVersionTable } from "./table";
import { isWithinLevel } from "./semver";
import { SYMBOLS } from "./symbols";

const extractDepsFromSection = (
  packageJson: Record<string, unknown>,
  section: string,
): [string, string][] => {
  const deps = packageJson[section] as Record<string, string> | undefined;
  if (!deps) return [];
  return Object.entries(deps);
};

const extractAllDeps = (
  packageJson: Record<string, unknown>,
): [string, string][] =>
  DEP_SECTIONS.flatMap((section) =>
    extractDepsFromSection(packageJson, section),
  );

const toVersionDiff = (
  pkgName: string,
  currentVersion: string,
  latestVersion: string,
  codependencies: string[],
  permissive: boolean,
  level: Level,
): VersionDiff => {
  const withinLevel = isWithinLevel(currentVersion, latestVersion, level);
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
  packageJson: Record<string, unknown> & { path?: string },
  codependencies: string[],
  permissive: boolean,
  level: Level = "major",
): VersionDiff[] =>
  extractAllDeps(packageJson)
    .filter(([pkgName]) => versionMap[pkgName] !== undefined)
    .map(([pkgName, currentVersion]) =>
      toVersionDiff(
        pkgName,
        currentVersion,
        versionMap[pkgName],
        codependencies,
        permissive,
        level,
      ),
    );

export const displayVersionDiffs = (
  diffs: VersionDiff[],
  isDryRun: boolean,
): void => {
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
  const path = `${rootDir}${file}`;
  const packageJson = JSON.parse(readFileSync(path, "utf8"));
  return buildVersionDiff(
    versionMap,
    packageJson,
    codependencies,
    permissive,
    level,
  );
};

const deduplicateByPackage = (diffs: VersionDiff[]): VersionDiff[] => {
  const seen = new Set<string>();
  return diffs.filter((diff) => {
    const isDuplicate = seen.has(diff.package);
    seen.add(diff.package);
    return !isDuplicate;
  });
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
  return deduplicateByPackage(allDiffs);
};
