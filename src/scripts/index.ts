import { readFileSync, writeFileSync } from "fs";
import { validatePackageName } from "../utils/validate-package";
import { exec } from "../utils/exec";
import { glob } from "../utils/glob";
import { logger } from "../logger";
import { defaultOutput, item } from "../dx";
import { versionCache, requestDeduplicator } from "../utils/cache";
import { formatEnhancedError } from "../utils/suggestions";
import { collectAllDiffs, displayVersionDiffs } from "../utils/diff";
import { Prompt } from "../utils/prompts";
import { isWithinLevel } from "../utils/semver";
import { DEP_SECTIONS } from "./constants";
import {
  CheckFiles,
  ConstructVersionMapOptions,
  CheckMatches,
  CheckDependenciesForVersionOptions,
  PackageJSON,
  DepToUpdateItem,
  DepsToUpdate,
  VersionDiff,
  Level,
  InteractiveResult,
} from "../types";

export const resolveObjectDep = (
  dep: Record<string, string>,
): Record<string, string> | null => {
  const hasOneKey = Object.keys(dep).length === 1;
  return hasOneKey ? dep : null;
};

export const validateStringDep = (
  dep: string,
  validate: ConstructVersionMapOptions["validate"],
): void => {
  const hasLength = dep.length > 1;
  const hasNoSpace = !dep.includes(" ");
  const isValidString = hasLength && hasNoSpace;

  if (!isValidString) {
    throw new Error("invalid item type");
  }

  const validateFn = validate || validatePackageName;
  const { validForNewPackages, validForOldPackages, errors } = validateFn(dep);
  const isValid = validForNewPackages || validForOldPackages;

  if (!isValid) {
    const errorContext = {
      packageName: dep,
      error: errors?.join(", ") || "Invalid package name",
      isValidationError: true,
    };
    throw new Error(formatEnhancedError(errorContext));
  }
};

export const resolveFromCache = (
  cacheKey: string,
  noCache: boolean,
): string | null => {
  const shouldUseCache = !noCache;
  if (!shouldUseCache) return null;

  const cachedVersion = versionCache.get(cacheKey);
  return cachedVersion || null;
};

export const resolveFromRegistry = async (
  dep: string,
  yarnConfig: boolean,
  execFn: ConstructVersionMapOptions["exec"],
): Promise<string> => {
  const runner = !yarnConfig ? "npm" : "yarn";
  const cmd = !yarnConfig
    ? ["view", dep, "version", "latest"]
    : ["npm", "info", dep, "--fields", "version", "--json"];

  const execRunner = execFn || exec;
  const { stdout = "" } = await execRunner(runner, cmd);

  const parsedVersion = !yarnConfig
    ? stdout.replace("\n", "")
    : JSON.parse(stdout.replace("\n", ""))?.version;

  if (!parsedVersion) {
    throw new Error(`No version found for ${dep}`);
  }

  return parsedVersion;
};

const handleVersionMapError = (
  err: unknown,
  dep: string | Record<string, string>,
  debug: boolean,
  isTesting: boolean,
): Record<string, string> => {
  if (debug) {
    logger.debug((err as Error).message || (err as string).toString());
  }

  const isNetworkError =
    err instanceof Error &&
    (err.message.includes("ENOTFOUND") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("EAI_AGAIN"));

  const isValidationError =
    err instanceof Error && err.message.includes("Invalid package");

  const packageName = typeof dep === "string" ? dep : "unknown";

  if (!isValidationError) {
    const errorContext = {
      packageName,
      error: err as Error,
      isNetworkError,
      isValidationError: false,
    };
    logger.error(formatEnhancedError(errorContext));
  } else {
    logger.error((err as Error).message);
  }

  if (isTesting) return {};
  throw err;
};

export const constructVersionMap = async ({
  codependencies,
  exec: execFn = exec,
  debug = false,
  yarnConfig = false,
  isTesting = false,
  validate = validatePackageName,
  noCache = false,
  onProgress,
}: ConstructVersionMapOptions) => {
  const total = codependencies.length;
  let current = 0;

  const updatedCodeDependencies = await Promise.all(
    codependencies.map(async (dep) => {
      try {
        const isObjectType = typeof dep === "object";
        if (isObjectType) {
          const resolved = resolveObjectDep(dep as Record<string, string>);
          if (resolved) return resolved;
        }

        const stringDep = dep as string;
        validateStringDep(stringDep, validate);

        const cacheKey = `${yarnConfig ? "yarn" : "npm"}:${stringDep}`;
        const cached = resolveFromCache(cacheKey, noCache);

        if (cached) {
          current++;
          if (onProgress) onProgress(current, total, stringDep);
          return { [stringDep]: cached };
        }

        const version = await requestDeduplicator.dedupe(cacheKey, async () =>
          resolveFromRegistry(stringDep, yarnConfig, execFn),
        );

        if (!noCache) {
          versionCache.set(cacheKey, version);
        }

        current++;
        if (onProgress) onProgress(current, total, stringDep);

        return { [stringDep]: version };
      } catch (err) {
        return handleVersionMapError(err, dep, debug, isTesting);
      }
    }),
  );

  const versionMap = updatedCodeDependencies.reduce(
    (acc: Record<string, string> = {}, entry: Record<string, string>) => {
      const [name] = Object.keys(entry);
      const version = entry?.[name];
      return { ...acc, ...(name && version ? { [name]: version } : {}) };
    },
    {},
  );

  return versionMap;
};

export const constructVersionTypes = (
  version: string,
): Record<string, string> => {
  const hasSpecialPrefix = version.startsWith("^") || version.startsWith("~");

  if (!hasSpecialPrefix) {
    return { bumpCharacter: "", bumpVersion: version, exactVersion: version };
  }

  const bumpCharacter = version[0];
  const exactVersion = version.replace(/^[~^]+/, "");

  return { bumpCharacter, bumpVersion: version, exactVersion };
};

const isUpdatablePermissiveDep = (
  name: string,
  exactVersion: string,
  versionMap: Record<string, string>,
  level: Level,
): boolean => {
  const latestVersion = versionMap[name];
  if (!latestVersion) return false;
  const isDifferent = exactVersion !== latestVersion;
  const isAllowed = isWithinLevel(exactVersion, latestVersion, level);
  return isDifferent && isAllowed;
};

export const constructPermissiveDepsToUpdateList = (
  dep = {} as Record<string, string>,
  codependencies: Array<string> = [],
  versionMap: Record<string, string> = {},
  level: Level = "major",
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];

  return Object.entries(dep)
    .filter(([name]) => !codependencies.includes(name))
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter } = constructVersionTypes(version);
      return { name, version, exactVersion, bumpCharacter };
    })
    .filter(({ name, exactVersion }) =>
      isUpdatablePermissiveDep(name, exactVersion, versionMap, level),
    )
    .map(({ name, version, bumpCharacter }) => ({
      name,
      actual: version,
      exact: versionMap[name],
      expected: `${bumpCharacter}${versionMap[name]}`,
    }));
};

const isUpdatableDep = (
  name: string,
  exactVersion: string,
  versionMap: Record<string, string>,
  level: Level,
): boolean => {
  const latestVersion = versionMap[name];
  if (!latestVersion) return false;
  const isDifferent = latestVersion !== exactVersion;
  const isAllowed = isWithinLevel(exactVersion, latestVersion, level);
  return isDifferent && isAllowed;
};

export const constructDepsToUpdateList = (
  dep = {} as Record<string, string>,
  versionMap: Record<string, string>,
  level: Level = "major",
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];

  return Object.entries(dep)
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter, bumpVersion } =
        constructVersionTypes(version);
      return { name, exactVersion, bumpCharacter, bumpVersion };
    })
    .filter(({ name, exactVersion }) =>
      isUpdatableDep(name, exactVersion, versionMap, level),
    )
    .map(({ name, bumpVersion, bumpCharacter }) => ({
      name,
      actual: bumpVersion,
      exact: versionMap[name],
      expected: `${bumpCharacter}${versionMap[name]}`,
    }));
};

export const constructDeps = <T extends PackageJSON>(
  json: T,
  depName: string,
  depList: Array<DepToUpdateItem>,
) =>
  depList?.length
    ? depList.reduce(
        (
          newJson: PackageJSON[
            | "dependencies"
            | "devDependencies"
            | "peerDependencies"
            | "optionalDependencies"],
          { name, expected: version }: DepToUpdateItem,
        ) => {
          return {
            ...json[depName as keyof T],
            ...newJson,
            [name]: version,
          };
        },
        {},
      )
    : json[depName as keyof PackageJSON];

export const constructJson = <T extends PackageJSON>(
  json: T,
  depsToUpdate: DepsToUpdate,
  isDebugging = false,
) => {
  const { depList, devDepList, peerDepList, optionalDepList } = depsToUpdate;
  const dependencies = constructDeps(json, "dependencies", depList);
  const devDependencies = constructDeps(json, "devDependencies", devDepList);
  const peerDependencies = constructDeps(json, "peerDependencies", peerDepList);
  const optionalDependencies = constructDeps(json, "optionalDependencies", optionalDepList);
  if (isDebugging) {
    logger.debug("constructJson debug info", { dependencies, devDependencies, peerDependencies, optionalDependencies });
  }
  return {
    ...json,
    ...(dependencies ? { dependencies } : {}),
    ...(devDependencies ? { devDependencies } : {}),
    ...(peerDependencies ? { peerDependencies } : {}),
    ...(optionalDependencies ? { optionalDependencies } : {}),
  };
};

export const buildUpdateLists = <T extends PackageJSON>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions,
  codependencies?: Array<string>,
): DepsToUpdate => {
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } = json;
  const { permissive, level = "major" } = options;

  if (permissive) {
    const coDeps = codependencies || [];
    return {
      depList: constructPermissiveDepsToUpdateList(dependencies, coDeps, versionMap, level),
      devDepList: constructPermissiveDepsToUpdateList(devDependencies, coDeps, versionMap, level),
      peerDepList: constructPermissiveDepsToUpdateList(peerDependencies, coDeps, versionMap, level),
      optionalDepList: constructPermissiveDepsToUpdateList(optionalDependencies, coDeps, versionMap, level),
    };
  }

  return {
    depList: constructDepsToUpdateList(dependencies, versionMap, level),
    devDepList: constructDepsToUpdateList(devDependencies, versionMap, level),
    peerDepList: constructDepsToUpdateList(peerDependencies, versionMap, level),
    optionalDepList: constructDepsToUpdateList(optionalDependencies, versionMap, level),
  };
};

const logDependencyIssues = (
  depsToUpdate: DepsToUpdate,
): void => {
  const allLists = [depsToUpdate.depList, depsToUpdate.devDepList, depsToUpdate.peerDepList, depsToUpdate.optionalDepList];
  allLists.forEach((list) => {
    if (!list.length) return;

    const issueCount = list.length;
    const pluralizedIssues = issueCount > 1 ? "s" : "";
    logger.info(`Found ${issueCount} dependency issue${pluralizedIssues}`);

    list.forEach(({ name: depName, expected, actual }, index) => {
      const versionMessage = `${depName}: found ${actual}, expected ${expected}`;
      defaultOutput.writeLine(item(index + 1, versionMessage, 4));
    });

    logger.space();
  });
};

const applyUpdates = <T extends PackageJSON>(
  json: T,
  depsToUpdate: DepsToUpdate,
  isDebugging: boolean,
  isTesting: boolean,
): void => {
  const updatedJson = constructJson(json, depsToUpdate, isDebugging);
  const { path, ...newJson } = updatedJson;
  if (!isTesting) {
    writeFileSync(path, JSON.stringify(newJson, null, 2).concat("\n"));
  } else {
    logger.info(`test-writeFileSync: ${path}`);
  }
};

export const checkDependenciesForVersion = <T extends PackageJSON>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions,
  codependencies?: Array<string>,
): boolean => {
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } = json;
  const { isUpdating, isDebugging, isSilent, isTesting } = options;

  const hasNoDeps = !dependencies && !devDependencies && !peerDependencies && !optionalDependencies;
  if (hasNoDeps) return false;

  const depsToUpdate = buildUpdateLists(versionMap, json, options, codependencies);

  if (isDebugging) {
    logger.debug("checkDependenciesForVersion debug info", depsToUpdate);
  }

  const hasNoDependencyIssues =
    !depsToUpdate.depList.length &&
    !depsToUpdate.devDepList.length &&
    !depsToUpdate.peerDepList.length &&
    !depsToUpdate.optionalDepList.length;
  if (hasNoDependencyIssues) return false;

  if (!isSilent) {
    logDependencyIssues(depsToUpdate);
  }

  if (isUpdating) {
    applyUpdates(json, depsToUpdate, isDebugging || false, isTesting || false);
  }

  return true;
};

const processMatchedFile = (
  file: string,
  rootDir: string,
  versionMap: Record<string, string>,
  options: {
    isUpdating: boolean;
    isDebugging: boolean;
    isSilent: boolean;
    isVerbose: boolean;
    isQuiet: boolean;
    isTesting: boolean;
    permissive: boolean;
    level: Level;
  },
  codependencies?: Array<string>,
): boolean => {
  const path = `${rootDir}${file}`;
  const packageJson = readFileSync(path, "utf8");
  const json = JSON.parse(packageJson);
  const jsonWithPath = { ...json, path };

  return checkDependenciesForVersion(versionMap, jsonWithPath, options, codependencies);
};

export const checkMatches = ({
  versionMap,
  rootDir,
  files,
  isUpdating = false,
  isDebugging = false,
  isSilent = true,
  isVerbose = false,
  isQuiet = false,
  isCLI = false,
  isTesting = false,
  permissive = false,
  codependencies,
  level = "major",
}: CheckMatches & {
  permissive?: boolean;
  codependencies?: Array<string>;
  level?: Level;
}): void => {
  const options = { isUpdating, isDebugging, isSilent, isVerbose, isQuiet, isTesting, permissive, level };

  const packagesNeedingUpdate = files.filter((file) =>
    processMatchedFile(file, rootDir, versionMap, options, codependencies),
  );

  if (isDebugging) {
    logger.debug("see updates", { packagesNeedingUpdate });
  }

  const isOutOfDate = packagesNeedingUpdate.length > 0;
  if (isOutOfDate && !isUpdating) {
    logger.error("Dependencies are not correct.");
    if (isCLI) process.exit(1);
    else throw new Error("Dependencies are not correct.");
  } else if (isOutOfDate) {
    logger.info("Dependencies were not correct but should be updated! Check your git status.");
  } else {
    logger.info("No dependency issues found!");
  }
};

const extractDepNamesFromFile = (rootDir: string, file: string): string[] => {
  const path = `${rootDir}${file}`;
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    return DEP_SECTIONS
      .map((section) => json[section])
      .filter(Boolean)
      .flatMap((section: Record<string, string>) => Object.keys(section));
  } catch {
    return [];
  }
};

const collectAllDepNames = (
  files: string[],
  rootDir: string,
): string[] => {
  const allNames = files.flatMap((file) => extractDepNamesFromFile(rootDir, file));
  return Array.from(new Set(allNames));
};

export const detectStaleCodependencies = (
  codependencies: import("../types").CodeDependencies,
  files: string[],
  rootDir: string,
): string[] => {
  const pinnedNames = codependencies
    .map((dep) => (typeof dep === "string" ? dep : Object.keys(dep)[0]))
    .filter(Boolean);

  if (pinnedNames.length === 0) return [];

  const allDepNames = new Set(collectAllDepNames(files, rootDir));
  return pinnedNames.filter((name) => !allDepNames.has(name));
};

const promptForSelection = async (
  allDiffs: VersionDiff[],
): Promise<string[]> => {
  const diffsNeedingUpdate = allDiffs.filter((d) => d.current !== d.latest);

  if (diffsNeedingUpdate.length === 0) return [];

  const prompt = new Prompt();
  const choices = diffsNeedingUpdate.map((diff) => ({
    name: `${diff.package} (${diff.current} -> ${diff.latest})`,
    value: diff.package,
  }));
  const selected = await prompt.checkbox("Select packages to update:", choices);
  prompt.close();

  return selected;
};

export const filterSelectedDeps = (
  selected: string[],
  depNames: string[],
  versionMap: Record<string, string>,
): InteractiveResult => {
  if (selected.length === 0) {
    logger.info("No packages selected. Skipping update.");
    return { shouldUpdate: false, depNames, versionMap };
  }

  const filteredDepNames = depNames.filter((dep) => selected.includes(dep));
  const filteredVersionMap = filteredDepNames.reduce(
    (acc: Record<string, string>, dep) => {
      const version = versionMap[dep];
      if (version) acc[dep] = version;
      return acc;
    },
    {},
  );

  return { shouldUpdate: true, depNames: filteredDepNames, versionMap: filteredVersionMap };
};

const applyInteractiveSelection = async (
  allDiffs: VersionDiff[],
  depNames: string[],
  versionMap: Record<string, string>,
): Promise<InteractiveResult> => {
  const diffsNeedingUpdate = allDiffs.filter((d) => d.current !== d.latest);

  if (diffsNeedingUpdate.length === 0) {
    return { shouldUpdate: true, depNames, versionMap };
  }

  const selected = await promptForSelection(allDiffs);
  return filterSelectedDeps(selected, depNames, versionMap);
};

const resolvePreciseModeDeps = async (
  files: string[],
  rootDir: string,
  versionMap: Record<string, string>,
  options: { debug: boolean; yarnConfig: boolean; isTesting: boolean; noCache: boolean; onProgress?: CheckFiles["onProgress"] },
): Promise<Record<string, string>> => {
  const allDepNames = collectAllDepNames(files, rootDir);
  const unresolvedDeps = allDepNames.filter((name) => !versionMap[name]);

  if (unresolvedDeps.length === 0) return versionMap;

  const additionalMap = await constructVersionMap({
    codependencies: unresolvedDeps,
    debug: options.debug,
    yarnConfig: options.yarnConfig,
    isTesting: options.isTesting,
    noCache: options.noCache,
    onProgress: options.onProgress,
  });

  return { ...versionMap, ...additionalMap };
};

export const checkFiles = async ({
  codependencies,
  files: matchers = ["package.json"],
  rootDir = "./",
  ignore = ["**/node_modules/**"],
  update = false,
  debug = false,
  silent = false,
  verbose = false,
  quiet = false,
  isCLI = false,
  yarnConfig = false,
  isTesting = false,
  permissive = true,
  dryRun = false,
  interactive = false,
  noCache = false,
  format,
  onProgress,
  level = "major",
  mode,
}: CheckFiles): Promise<VersionDiff[] | void> => {
  try {
    const files = await glob(matchers, { cwd: rootDir, ignore });
    const isPreciseMode = mode === "precise" || (permissive && mode !== "verbose");

    const hasNoDepsAndNotPrecise = !codependencies && !isPreciseMode;
    if (hasNoDepsAndNotPrecise) {
      throw '"codependencies" are required (unless using precise mode)';
    }

    let versionMap: Record<string, string> = {};
    let depNames: string[] = [];

    const hasDependencies = codependencies && codependencies.length > 0;

    if (hasDependencies && !silent && !quiet) {
      const stale = detectStaleCodependencies(codependencies, files, rootDir);
      if (stale.length > 0) {
        const label = stale.length === 1 ? "codependency" : "codependencies";
        logger.warn(`${stale.length} stale ${label} not found in any package.json:`);
        stale.forEach((name) => logger.warn(`  - ${name}`));
      }
    }

    if (hasDependencies) {
      versionMap = await constructVersionMap({
        codependencies,
        debug,
        yarnConfig,
        isTesting,
        noCache,
        onProgress,
      });
      depNames = codependencies
        .map((dep) => (typeof dep === "string" ? dep : Object.keys(dep)[0]))
        .filter(Boolean);
    }

    if (isPreciseMode) {
      versionMap = await resolvePreciseModeDeps(files, rootDir, versionMap, { debug, yarnConfig, isTesting, noCache, onProgress });
    }

    const hasOutputChanges = (update || dryRun) && !silent && !quiet;
    const shouldCollectDiffs = format !== undefined || hasOutputChanges;
    const allDiffs = shouldCollectDiffs
      ? collectAllDiffs(versionMap, files, rootDir, depNames, isPreciseMode, level)
      : [];

    const shouldShowDiffs = hasOutputChanges && format === undefined;
    if (shouldShowDiffs && allDiffs.length > 0) {
      displayVersionDiffs(allDiffs, dryRun);
    }

    let shouldUpdate = update && !dryRun;

    const isInteractiveUpdate = interactive && update && !dryRun && !isTesting;
    if (isInteractiveUpdate) {
      const result = await applyInteractiveSelection(allDiffs, depNames, versionMap);
      shouldUpdate = result.shouldUpdate;
      depNames = result.depNames;
      versionMap = result.versionMap;
    }

    const shouldCheckMatches = format === undefined;
    if (shouldCheckMatches) {
      checkMatches({
        versionMap,
        rootDir,
        files,
        isCLI,
        isSilent: silent,
        isVerbose: verbose,
        isQuiet: quiet,
        isUpdating: shouldUpdate,
        isDebugging: debug,
        isTesting,
        permissive: isPreciseMode,
        codependencies: depNames,
        level,
      });
    }

    return allDiffs;
  } catch (err) {
    if (debug) {
      logger.debug((err as string).toString());
    }
    throw err;
  }
};

export const codependence = checkFiles;
export default checkFiles;
