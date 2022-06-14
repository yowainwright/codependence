import { sync as glob } from "fast-glob";
import { readFileSync, writeFileSync } from "fs-extra";

import {
  CheckFiles,
  CheckMatches,
  CheckDependenciesForVersionOptions,
  PackageJSON,
  DepToUpdateItem,
  DepsToUpdate,
} from "./types";

const DEBUG_NAME = "codependence:debugging:";

/**
 * checkFiles
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.matchers} string
 * @param {options.cwd} string
 * @param {options.ignore} array
 * @param {options.updating} boolean
 */
const checkFiles = ({
  codependencies,
  files: matchers = [],
  rootDir = "./",
  ignore = ["node_modules/**/*", "**/node_modules/**/*"],
  update = false,
  debug = false,
  silent = false,
  addDeps = false,
  install = false,
}: CheckFiles): void => {
  const files = glob(matchers, { cwd: rootDir, ignore });
  checkMatches({
    rootDir,
    files,
    isSilent: silent,
    isUpdating: update,
    isDebugging: debug,
    codependencies,
    isAddingDeps: addDeps,
    isInstallingDeps: install,
  });
};

/**
 * checkVersion
 * @description checks a glob of json files for dependency discrepancies
 * @param {options.files} array
 * @param {options.cwd} string
 * @param {options.isUpdating} boolean
 */
const checkMatches = ({
  codependencies,
  rootDir,
  files,
  isUpdating = false,
  isDebugging = false,
  isAddingDeps = false,
  isInstallingDeps = false,
  isSilent = true,
}: CheckMatches): void => {
  const packagesNeedingUpdate: Array<boolean> = files
    .map((file) => {
      const path = `${rootDir}${file}`;
      const packageJson = readFileSync(path, "utf8");
      const json = JSON.parse(packageJson);
      return { ...json, path };
    })
    .filter((json) =>
      checkDependenciesForVersion(codependencies, json, {
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
    console.log("coDep: dependencies are not correct 😞");
    process.exit(1);
  } else if (isOutOfDate) {
    console.log(
      "coDep: dependencies were not correct but should be updated! Check your git status. 😃"
    );
  } else {
    console.log("coDep: no dependency issues found! 👌");
  }
};

/**
 * constructDepsToUpdateList
 * @description returns an array of deps to update
 * @param {dep} object
 * @param {codependencies} object
 * @returns {array} example [{ name: 'foo', action: '1.0.0', expected: '1.1.0' }]
 */
const constructDepsToUpdateList = (
  dep = {} as Record<string, string>,
  codependencies: Record<string, string>
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];
  const versionList = Object.keys(codependencies);
  return Object.entries(dep)
    .map(([name, version]) => ({ name, version }))
    .filter(
      ({ name, version }) =>
        versionList.includes(name) && codependencies[name] !== version
    )
    .map(({ name, version }) => ({
      name,
      actual: version,
      expected: codependencies[name],
    }));
};

/**
 * writeConsoleMsgs
 * @param {packageName} string
 * @param {depList} array
 * @returns void
 */
const writeConsoleMsgs = (
  packageName: string,
  depList: Array<Record<string, string>>
): void => {
  if (!depList.length) return;
  Array.from(depList, ({ name: depName, expected, actual }) =>
    console.log(
      `${packageName}: ${depName} version is not correct. Found ${actual}} and should be ${expected}`
    )
  );
};

const constructDeps = <T extends PackageJSON>(
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

const constructJson = <T extends PackageJSON>(
  json: T,
  depsToUpdate: DepsToUpdate,
  isDebugging = false
) => {
  const { depList, devDepList, peerDepList } = depsToUpdate;
  const dependencies = constructDeps(json, "dependencies", depList);
  const devDependencies = constructDeps(json, "devDependencies", devDepList);
  const peerDependencies = constructDeps(json, "peerDependencies", peerDepList);
  if (isDebugging) {
    console.log(`${DEBUG_NAME}`, {
      dependencies,
      devDependencies,
      peerDependencies,
    });
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
const checkDependenciesForVersion = <T extends PackageJSON>(
  codependencies: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions
): boolean => {
  const { name, dependencies, devDependencies, peerDependencies } = json;
  const { isAddingDeps, isInstallingDeps, isUpdating, isDebugging, isSilent } =
    options;
  if (!dependencies && !devDependencies && !peerDependencies) return false;
  const depList = constructDepsToUpdateList(dependencies, codependencies);
  const devDepList = constructDepsToUpdateList(devDependencies, codependencies);
  const peerDepList = constructDepsToUpdateList(
    peerDependencies,
    codependencies
  );
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

export default checkFiles;
