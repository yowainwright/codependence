import { readFileSync, writeFileSync } from "fs";
import { validatePackageName } from "../utils/validate-package";
import { exec } from "../utils/exec";
import { glob } from "../utils/glob";
import { logger, writeConsoleMsgs } from "../logger";
import { versionCache, requestDeduplicator } from "../utils/cache";
import { formatEnhancedError } from "../utils/suggestions";
import { collectAllDiffs, displayVersionDiffs } from "../utils/version-diff";
import { Prompt } from "../utils/prompts";
import {
  CheckFiles,
  ConstructVersionMapOptions,
  CheckMatches,
  CheckDependenciesForVersionOptions,
  PackageJSON,
  DepToUpdateItem,
  DepsToUpdate,
  VersionDiff,
} from "../types";

/**
 * constructVersionMap
 * @description constructs a map of each item in a codependencies array
 * @param {codependencies} array
 * @param {exec} fn
 * @param {isDebugging} boolean
 * @returns {object}
 */
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
    codependencies.map(async (item) => {
      try {
        const isObjectType = typeof item === "object";
        const hasOneKey = isObjectType && Object.keys(item).length === 1;
        if (hasOneKey) {
          return item;
        }

        const isStringType = typeof item === "string";
        const hasLength = isStringType && item.length > 1;
        const hasNoSpace = isStringType && !item.includes(" ");
        const isValidString = hasLength && hasNoSpace;

        if (!isValidString) {
          throw "invalid item type";
        }

        const { validForNewPackages, validForOldPackages, errors } =
          validate(item);
        const isValid = validForNewPackages || validForOldPackages;
        if (!isValid) {
          const errorContext = {
            packageName: item,
            error: errors?.join(", ") || "Invalid package name",
            isValidationError: true,
          };
          throw new Error(formatEnhancedError(errorContext));
        }

        const cacheKey = `${yarnConfig ? "yarn" : "npm"}:${item}`;
        const shouldUseCache = !noCache;

        if (shouldUseCache) {
          const cachedVersion = versionCache.get(cacheKey);
          if (cachedVersion) {
            current++;
            if (onProgress) onProgress(current, total, item);
            return { [item]: cachedVersion };
          }
        }

        const version = await requestDeduplicator.dedupe(cacheKey, async () => {
          const runner = !yarnConfig ? "npm" : "yarn";
          const cmd = !yarnConfig
            ? ["view", item, "version", "latest"]
            : ["npm", "info", item, "--fields", "version", "--json"];

          const { stdout = "" } = await execFn(runner, cmd);

          const parsedVersion = !yarnConfig
            ? stdout.replace("\n", "")
            : JSON.parse(stdout.replace("\n", ""))?.version;

          if (!parsedVersion) {
            throw new Error(`No version found for ${item}`);
          }

          return parsedVersion;
        });

        if (shouldUseCache) {
          versionCache.set(cacheKey, version);
        }

        current++;
        if (onProgress) onProgress(current, total, item);

        return { [item]: version };
      } catch (err) {
        if (debug) {
          logger.debug(
            (err as Error).message || (err as string).toString(),
            undefined,
            "constructVersionMap",
          );
        }

        const isNetworkError =
          err instanceof Error &&
          (err.message.includes("ENOTFOUND") ||
            err.message.includes("ETIMEDOUT") ||
            err.message.includes("EAI_AGAIN"));

        const isValidationError =
          err instanceof Error && err.message.includes("Invalid package");

        const packageName = typeof item === "string" ? item : "unknown";

        if (!isValidationError) {
          const errorContext = {
            packageName,
            error: err as Error,
            isNetworkError,
            isValidationError: false,
          };
          console.error("\n" + formatEnhancedError(errorContext) + "\n");
        } else {
          console.error("\n" + (err as Error).message + "\n");
        }

        if (isTesting) return {};
        process.exit(1);
      }
    }),
  );

  const versionMap = updatedCodeDependencies.reduce(
    (acc: Record<string, string> = {}, item: Record<string, string>) => {
      const [name] = Object.keys(item);
      const version = item?.[name];
      return { ...acc, ...(name && version ? { [name]: version } : {}) };
    },
    {},
  );

  return versionMap;
};

/**
 * constructVersionTypes
 * @description constructs an object with a bumpVersion and exactVersion
 * @param {version} string
 * @returns {object}
 */
export const constructVersionTypes = (
  version: string,
): Record<string, string> => {
  // Check if the version starts with a special character
  const hasSpecialPrefix = version.startsWith("^") || version.startsWith("~");

  if (!hasSpecialPrefix) {
    return {
      bumpCharacter: "",
      bumpVersion: version,
      exactVersion: version,
    };
  }

  // Extract the first special character as the bump character
  const bumpCharacter = version[0];

  // Get the version number by removing all leading special characters
  const exactVersion = version.replace(/^[~^]+/, "");

  return {
    bumpCharacter,
    bumpVersion: version,
    exactVersion,
  };
};

/**
 * constructPermissiveDepsToUpdateList
 * @description returns an array of deps to update for permissive mode (latest for all except codependencies)
 * @param {dep} object - dependencies from package.json
 * @param {codependencies} array - dependencies to exclude from updates
 * @returns {array} example [{ name: 'foo', action: '1.0.0', expected: 'latest' }]
 */
export const constructPermissiveDepsToUpdateList = (
  dep = {} as Record<string, string>,
  codependencies: Array<string> = [],
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];

  return Object.entries(dep)
    .filter(([name]) => !codependencies.includes(name))
    .map(([name, version]) => {
      return {
        name,
        actual: version,
        exact: "latest",
        expected: "latest",
      };
    });
};

/**
 * constructDepsToUpdateList
 * @description returns an array of deps to update
 * @param {dep} object
 * @param {versionMap} object
 * @returns {array} example [{ name: 'foo', action: '1.0.0', expected: '1.1.0' }]
 */
export const constructDepsToUpdateList = (
  dep = {} as Record<string, string>,
  versionMap: Record<string, string>,
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];
  const versionList = Object.keys(versionMap);
  return Object.entries(dep)
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter, bumpVersion } =
        constructVersionTypes(version);
      return { name, exactVersion, bumpCharacter, bumpVersion };
    })
    .filter(
      ({ name, exactVersion }) =>
        versionList.includes(name) && versionMap[name] !== exactVersion,
    )
    .map(({ name, bumpVersion, bumpCharacter }) => ({
      name,
      actual: bumpVersion,
      exact: versionMap[name],
      expected: `${bumpCharacter}${versionMap[name]}`,
    }));
};

/**
 * constructDeps
 * @description constructed deps with updates
 * @param {json} object
 * @param {depName} string
 * @param {depList} array
 * @returns {object}
 */
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
            | "peerDependencies"],
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

/**
 * constructJson
 * @description constructs json with updates
 * @param {json} object
 * @param {depsToUpdate} array
 * @param {isDebugging} boolean
 * @returns {object}}
 */
export const constructJson = <T extends PackageJSON>(
  json: T,
  depsToUpdate: DepsToUpdate,
  isDebugging = false,
) => {
  const { depList, devDepList, peerDepList } = depsToUpdate;
  const dependencies = constructDeps(json, "dependencies", depList);
  const devDependencies = constructDeps(json, "devDependencies", devDepList);
  const peerDependencies = constructDeps(json, "peerDependencies", peerDepList);
  if (isDebugging) {
    logger.debug(
      "constructJson debug info",
      {
        dependencies,
        devDependencies,
        peerDependencies,
      },
      "constructJson",
    );
  }
  return {
    ...json,
    ...(dependencies ? { dependencies } : {}),
    ...(devDependencies ? { devDependencies } : {}),
    ...(peerDependencies ? { peerDependencies } : {}),
  };
};

/**
 * checkDependenciesForVersion
 * @description checks dependencies for a mismatched version
 * @param {versionMap} object
 * @param {json} object
 * @param {isUpdating} boolean
 * @returns {boolean}
 */
export const checkDependenciesForVersion = <T extends PackageJSON>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions,
  codependencies?: Array<string>,
): boolean => {
  const { name, dependencies, devDependencies, peerDependencies } = json;
  const { isUpdating, isDebugging, isSilent, isTesting, permissive } = options;
  if (!dependencies && !devDependencies && !peerDependencies) return false;

  let depList, devDepList, peerDepList;

  if (permissive) {
    depList = constructPermissiveDepsToUpdateList(
      dependencies,
      codependencies || [],
    );
    devDepList = constructPermissiveDepsToUpdateList(
      devDependencies,
      codependencies || [],
    );
    peerDepList = constructPermissiveDepsToUpdateList(
      peerDependencies,
      codependencies || [],
    );
  } else {
    depList = constructDepsToUpdateList(dependencies, versionMap);
    devDepList = constructDepsToUpdateList(devDependencies, versionMap);
    peerDepList = constructDepsToUpdateList(peerDependencies, versionMap);
  }
  if (isDebugging) {
    logger.debug(
      "checkDependenciesForVersion debug info",
      {
        depList,
        devDepList,
        peerDepList,
      },
      "checkDependenciesForVersion",
    );
  }
  if (!depList.length && !devDepList.length && !peerDepList.length) {
    return false;
  }
  if (!isSilent)
    Array.from([depList, devDepList, peerDepList], (list) =>
      writeConsoleMsgs(name, list),
    );
  if (isUpdating) {
    const updatedJson = constructJson(
      json,
      { depList, devDepList, peerDepList },
      isDebugging,
    );
    const { path, ...newJson } = updatedJson;
    if (!isTesting) {
      writeFileSync(path, JSON.stringify(newJson, null, 2).concat("\n"));
    } else {
      logger.info(`test-writeFileSync: ${path}`, "checkDependenciesForVersion");
    }
  }
  return true;
};

/**
 * checkMatches
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.files} array
 * @param {options.cwd} string
 * @param {options.isUpdating} boolean
 * @param {options.versionMap} object
 * @param {options.rootDir} string
 * @param {options.isDebugging} boolean
 * @param {options.isSilent} boolean
 * @param {options.isCLI} boolean
 * @param {options.isTesting} boolean
 * @returns {void}
 */
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
}: CheckMatches & {
  permissive?: boolean;
  codependencies?: Array<string>;
}): void => {
  const packagesNeedingUpdate = files
    .map((file) => {
      const path = `${rootDir}${file}`;
      const packageJson = readFileSync(path, "utf8");
      const json = JSON.parse(packageJson);
      return { ...json, path };
    })
    .filter((json) =>
      checkDependenciesForVersion(
        versionMap,
        json,
        {
          isUpdating,
          isDebugging,
          isSilent,
          isVerbose,
          isQuiet,
          isTesting,
          permissive,
        },
        codependencies,
      ),
    );

  if (isDebugging) {
    logger.debug("see updates", { packagesNeedingUpdate }, "checkMatches");
  }

  const isOutOfDate = packagesNeedingUpdate.length > 0;
  if (isOutOfDate && !isUpdating) {
    logger.error("Dependencies are not correct. 😞");
    if (isCLI) process.exit(1);
  } else if (isOutOfDate) {
    logger.info(
      "Dependencies were not correct but should be updated! Check your git status. 😃",
    );
  } else {
    logger.info("No dependency issues found! 👌");
  }
};

/**
 * checkFiles
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.codependencies} array
 * @param {options.rootDir} string
 * @param {options.ignore} array
 * @param {options.update} boolean
 * @param {options.files} array
 * @param {options.rootDir} string
 * @param {options.debug} boolean
 * @param {options.silent} boolean
 * @param {options.isCLI} boolean
 * @param {options.isTesting} boolean
 * @returns {void}
 */
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
  permissive = false,
  dryRun = false,
  interactive = false,
  noCache = false,
  format,
  onProgress,
}: CheckFiles): Promise<VersionDiff[] | void> => {
  try {
    const files = await glob(matchers, { cwd: rootDir, ignore });

    const hasNoDepsAndNotPermissive = !codependencies && !permissive;
    if (hasNoDepsAndNotPermissive) {
      throw '"codependencies" are required (unless using permissive mode)';
    }

    let versionMap: Record<string, string> = {};
    let depNames: string[] = [];

    const hasDependencies = codependencies && codependencies.length > 0;
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
        .map((item) => (typeof item === "string" ? item : Object.keys(item)[0]))
        .filter(Boolean);
    }

    const shouldCollectDiffs = format !== undefined || ((update || dryRun) && !silent && !quiet);
    const allDiffs = shouldCollectDiffs
      ? collectAllDiffs(versionMap, files, rootDir, depNames, permissive)
      : [];

    const shouldShowDiffs = (update || dryRun) && !silent && !quiet && format === undefined;
    if (shouldShowDiffs && allDiffs.length > 0) {
      displayVersionDiffs(allDiffs, dryRun);
    }

    let shouldUpdate = update && !dryRun;

    if (interactive && update && !dryRun && !isTesting) {
      const diffsNeedingUpdate = allDiffs.filter((d) => d.current !== d.latest);

      if (diffsNeedingUpdate.length > 0) {
        const prompt = new Prompt();
        const selected = await prompt.checkbox(
          "Select packages to update:",
          diffsNeedingUpdate.map((diff) => ({
            name: `${diff.package} (${diff.current} → ${diff.latest})`,
            value: diff.package,
          })),
        );
        prompt.close();

        if (selected.length === 0) {
          console.log("\n❌ No packages selected. Skipping update.\n");
          shouldUpdate = false;
        } else {
          const selectedDeps = depNames.filter((dep) => selected.includes(dep));
          depNames = selectedDeps;

          const filteredVersionMap: Record<string, string> = {};
          for (const dep of selectedDeps) {
            if (versionMap[dep]) {
              filteredVersionMap[dep] = versionMap[dep];
            }
          }
          versionMap = filteredVersionMap;
        }
      }
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
        permissive,
        codependencies: depNames,
      });
    }

    return allDiffs;
  } catch (err) {
    if (debug) {
      logger.debug((err as string).toString(), undefined, "checkFiles");
    }
  }
};

export const script = checkFiles;
export const codependence = checkFiles;
export const core = codependence;
export default core;
