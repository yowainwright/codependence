import { exec } from "child_process";
import gradient from "gradient-string";
import { sync as glob } from "fast-glob";
import { readFileSync, writeFileSync } from "fs-extra";
import { DEBUG_NAME } from "./constants";
import {
  CheckFiles,
  CodeDependencies,
  CheckMatches,
  CheckDependenciesForVersionOptions,
  PackageJSON,
  DepToUpdateItem,
  DepsToUpdate,
} from "./types";

export const constructVersionMap = async (
  codependencies: CodeDependencies,
  isDebugging = false
) => {
  const updatedCodeDependencies = await Promise.all(
    codependencies.map(async (item) => {
      try {
        if (typeof item === "object" && Object.keys(item).length === 1)
          return item;
        else if (typeof item === "string" && item.length > 1) {
          const version = (await exec(`npm version ${item}`, (_, stdout) =>
            stdout.toString()
          )) as unknown as string;
          console.log("test", { item, version });
          if (version) return { [item]: version };
          throw `${version}`;
        } else {
          throw "invalid item";
        }
      } catch (err) {
        if (isDebugging)
          console.error(
            gradient.passion(`${DEBUG_NAME}:constructVersionMap:${err}`)
          );
        return {};
      }
    })
  );
  const versionMap = updatedCodeDependencies.reduce(
    (acc: Record<string, string> = {}, item: Record<string, string>) => {
      const [name] = Object.keys(item);
      const version = item?.[name];
      return { ...acc, ...(name && version ? { [name]: version } : {}) };
    },
    {}
  );
  return versionMap;
};

/**
 * checkVersion
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.files} array
 * @param {options.cwd} string
 * @param {options.isUpdating} boolean
 */
export const checkMatches = async ({
  versionMap,
  rootDir,
  files,
  isUpdating = false,
  isDebugging = false,
  isAddingDeps = false,
  isInstallingDeps = false,
  isSilent = true,
}: CheckMatches): Promise<void> => {
  const packagesNeedingUpdate: Array<boolean> = files
    .map((file) => {
      const path = `${rootDir}${file}`;
      const packageJson = readFileSync(path, "utf8");
      const json = JSON.parse(packageJson);
      return { ...json, path };
    })
    .filter((json) =>
      checkDependenciesForVersion(versionMap, json, {
        isAddingDeps,
        isInstallingDeps,
        isUpdating,
        isDebugging,
        isSilent,
      })
    );

  if (isDebugging) console.log(`${DEBUG_NAME}`, { packagesNeedingUpdate });

  const isOutOfDate = packagesNeedingUpdate.length > 0;
  if (isOutOfDate && !isUpdating) {
    console.log(gradient.teen("codependence: dependencies are not correct 😞"));
    process.exit(1);
  } else if (isOutOfDate) {
    console.log(
      gradient.teen(
        "codependence: dependencies were not correct but should be updated! Check your git status. 😃"
      )
    );
  } else {
    console.log(gradient.teen("codependence: no dependency issues found! 👌"));
  }
};

/**
 * checkFiles
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.matchers} string
 * @param {options.cwd} string
 * @param {options.ignore} array
 * @param {options.updating} boolean
 */
export const checkFiles = async ({
  codependencies,
  files: matchers = [],
  rootDir = "./",
  ignore = ["node_modules/**/*", "**/node_modules/**/*"],
  update = false,
  debug = false,
  silent = false,
  addDeps = false,
  install = false,
}: CheckFiles): Promise<void> => {
  try {
    const files = glob(matchers, { cwd: rootDir, ignore });
    const versionMap = await constructVersionMap(codependencies, debug);
    checkMatches({
      versionMap,
      rootDir,
      files,
      isSilent: silent,
      isUpdating: update,
      isDebugging: debug,
      isAddingDeps: addDeps,
      isInstallingDeps: install,
    });
  } catch (err) {
    if (debug) console.log(gradient.passion(`${DEBUG_NAME}:checkFiles:${err}`));
  }
};

/**
 * constructDepsToUpdateList
 * @description returns an array of deps to update
 * @param {dep} object
 * @param {versionMap} object
 * @returns {array} example [{ name: 'foo', action: '1.0.0', expected: '1.1.0' }]
 */
const constructDepsToUpdateList = (
  dep = {} as Record<string, string>,
  versionMap: Record<string, string>
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];
  const versionList = Object.keys(versionMap);
  return Object.entries(dep)
    .map(([name, version]) => ({ name, version }))
    .filter(
      ({ name, version }) =>
        versionList.includes(name) && versionMap[name] !== version
    )
    .map(({ name, version }) => ({
      name,
      actual: version,
      expected: versionMap[name],
    }));
};

/**
 * writeConsoleMsgs
 * @param {packageName} string
 * @param {depList} array
 * @returns void
 */
export const writeConsoleMsgs = (
  packageName: string,
  depList: Array<Record<string, string>>
): void => {
  if (!depList.length) return;
  Array.from(depList, ({ name: depName, expected, actual }) =>
    console.log(
      gradient.teen(
        `${packageName}: ${depName} version is not correct. Found ${actual}} and should be ${expected}`
      )
    )
  );
};

export const constructDeps = <T extends PackageJSON>(
  json: T,
  depName: string,
  depList: Array<DepToUpdateItem>
) =>
  depList.length
    ? depList.reduce(
        (
          newJson: PackageJSON[
            | "dependencies"
            | "devDependencies"
            | "peerDependencies"],
          { name, expected }: DepToUpdateItem
        ) => ({
          ...json[depName as keyof T],
          ...newJson,
          [name]: expected,
        }),
        {}
      )
    : json[depName as keyof PackageJSON];

export const constructJson = <T extends PackageJSON>(
  json: T,
  depsToUpdate: DepsToUpdate,
  isDebugging = false
) => {
  const { depList, devDepList, peerDepList } = depsToUpdate;
  const dependencies = constructDeps(json, "dependencies", depList);
  const devDependencies = constructDeps(json, "devDependencies", devDepList);
  const peerDependencies = constructDeps(json, "peerDependencies", peerDepList);
  if (isDebugging) {
    console.log(
      gradient.passion(`${DEBUG_NAME}`, {
        dependencies,
        devDependencies,
        peerDependencies,
      })
    );
  }
  return {
    ...json,
    dependencies,
    devDependencies,
    peerDependencies,
  };
};

/**
 * checkDependenciesForVersion
 * @description checks dependencies for a mismatched version
 * @param {versionMap} object
 * @param {json} object
 * @param {isUpdating} boolean
 */
export const checkDependenciesForVersion = async <T extends PackageJSON>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions
): Promise<boolean> => {
  const { name, dependencies, devDependencies, peerDependencies } = json;
  const { isUpdating, isDebugging, isSilent } = options;
  if (!dependencies && !devDependencies && !peerDependencies) return false;
  const depList = constructDepsToUpdateList(dependencies, versionMap);
  const devDepList = constructDepsToUpdateList(devDependencies, versionMap);
  const peerDepList = constructDepsToUpdateList(peerDependencies, versionMap);
  if (isDebugging)
    console.log(`${DEBUG_NAME}`, { depList, devDepList, peerDepList });
  if (!depList.length && !devDepList.length && !peerDepList.length)
    return false;
  if (!isSilent)
    Array.from([depList, devDepList, peerDepList], (list) =>
      writeConsoleMsgs(name, list)
    );
  if (isUpdating) {
    const updatedJson = constructJson(
      json,
      { depList, devDepList, peerDepList },
      isDebugging
    );
    const { path, ...newJson } = updatedJson;
    writeFileSync(path, JSON.stringify(newJson, null, 2).concat("\n"));
  }
  return true;
};

export const script = checkFiles;
export const codependence = checkFiles;
export default codependence;
