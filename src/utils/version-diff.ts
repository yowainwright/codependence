import { readFileSync } from "fs";
import type { VersionDiff } from "../types";
import { formatVersionTable } from "./table";

export const buildVersionDiff = (
  versionMap: Record<string, string>,
  packageJson: Record<string, unknown> & { path?: string },
  codependencies: string[],
  permissive: boolean,
): VersionDiff[] => {
  const diffs: VersionDiff[] = [];

  const allDeps = {
    ...((packageJson.dependencies as Record<string, string>) || {}),
    ...((packageJson.devDependencies as Record<string, string>) || {}),
    ...((packageJson.peerDependencies as Record<string, string>) || {}),
  };

  for (const [pkgName, currentVersion] of Object.entries(allDeps)) {
    const latestVersion = versionMap[pkgName];
    const hasLatestVersion = latestVersion !== undefined;

    if (!hasLatestVersion) continue;

    const isPinned = codependencies.includes(pkgName);
    const willUpdate = permissive ? !isPinned : isPinned;

    diffs.push({
      package: pkgName,
      current: currentVersion,
      latest: latestVersion,
      isPinned,
      willUpdate,
    });
  }

  return diffs;
};

export const displayVersionDiffs = (
  diffs: VersionDiff[],
  isDryRun: boolean,
): void => {
  const diffsToShow = diffs.filter((d) => d.current !== d.latest);

  if (diffsToShow.length === 0) {
    console.log("\n✅ All dependencies are up-to-date!\n");
    return;
  }

  const header = isDryRun
    ? "\n📊 Dependencies that would be updated:"
    : "\n📦 Dependency Updates Available:";

  console.log(header);
  console.log(formatVersionTable(diffsToShow));
  console.log("");
};

export const collectAllDiffs = (
  versionMap: Record<string, string>,
  files: string[],
  rootDir: string,
  codependencies: string[],
  permissive: boolean,
): VersionDiff[] => {
  const allDiffs: VersionDiff[] = [];

  for (const file of files) {
    const path = `${rootDir}${file}`;
    const packageJson = JSON.parse(readFileSync(path, "utf8"));
    const diffs = buildVersionDiff(
      versionMap,
      packageJson,
      codependencies,
      permissive,
    );
    allDiffs.push(...diffs);
  }

  const uniqueDiffs = allDiffs.reduce((acc, diff) => {
    const existing = acc.find((d) => d.package === diff.package);
    if (!existing) {
      acc.push(diff);
    }
    return acc;
  }, [] as VersionDiff[]);

  return uniqueDiffs;
};
