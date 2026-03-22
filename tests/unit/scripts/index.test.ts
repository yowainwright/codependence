import { expect, test, jest, beforeEach } from "bun:test";
import { versionCache, requestDeduplicator } from "../../../src/utils/cache";
import * as scripts from "../../../src/scripts";
import { Prompt } from "../../../src/utils/prompts";

beforeEach(() => {
  versionCache.clear();
  requestDeduplicator.clear();
});

const {
  constructVersionMap,
  constructVersionTypes,
  constructDepsToUpdateList,
  constructDeps,
  constructJson,
  checkDependenciesForVersion,
  checkMatches,
  checkFiles,
  detectStaleCodependencies,
  filterSelectedDeps,
} = scripts;

test("constructVersionMap => pass", async () => {
  const exec = jest.fn(() => ({
    stdout: "4.0.0",
    stderr: "",
  })) as any;
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const result = await constructVersionMap({
    codependencies: ["lodash"],
    exec,
    validate,
  });
  expect(result).toEqual({ lodash: "4.0.0" });
});

test("constructVersionMap => with object in codependencies", async () => {
  const exec = jest.fn(() => ({
    stdout: "4.0.0",
    stderr: "",
  })) as any;
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const result = await constructVersionMap({
    codependencies: [{ lodash: "4.0.0" }],
    exec,
    validate,
  });
  expect(result).toEqual({ lodash: "4.0.0" });
});

test("constructVersionMap => with yarnConfig", async () => {
  const exec = jest.fn(() => ({
    stdout: '{"version":"4.0.0"}',
    stderr: "",
  })) as any;
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const result = await constructVersionMap({
    codependencies: ["lodash"],
    exec,
    yarnConfig: true,
    validate,
  });
  expect(result).toEqual({ lodash: "4.0.0" });
});

test("constructVersionMap => fail", async () => {
  const exec = jest.fn(() => ({
    stdout: "",
    stderr: "",
  })) as any;
  const validate = jest.fn(() => ({
    validForNewPackages: false,
    validForOldPackages: true,
    errors: ["foo-bop", "foo-beep"],
  }));
  const result = await constructVersionMap({
    codependencies: ["lodash"],
    exec,
    isTesting: true,
    validate,
    noCache: true,
  });
  expect(result).toEqual({});
});

test("constructVersionMap => with invalid item type", async () => {
  const exec = jest.fn(() => ({
    stdout: "4.0.0",
    stderr: "",
  })) as any;
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const result = await constructVersionMap({
    codependencies: ["lodash with space"],
    exec,
    isTesting: true,
    validate,
  });
  expect(result).toEqual({});
});

test("constructVersionTypes => with ^", () => {
  const result = constructVersionTypes("^1.2.3");
  expect(result).toEqual({
    bumpCharacter: "^",
    bumpVersion: "^1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes with no specifier", () => {
  const { bumpVersion, exactVersion } = constructVersionTypes("1.2.3");
  expect(bumpVersion).toEqual(exactVersion);
});

test("constructDepsToUpdateList => returns dep to update list with exact characters", () => {
  const result = constructDepsToUpdateList({ foo: "1.0.0" }, { foo: "2.0.0" });
  expect(result).toEqual([
    {
      name: "foo",
      exact: "2.0.0",
      expected: "2.0.0",
      actual: "1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => returns dep to update list with special characters", () => {
  const result = constructDepsToUpdateList({ foo: "~1.0.0" }, { foo: "2.0.0" });
  expect(result).toEqual([
    {
      name: "foo",
      exact: "2.0.0",
      expected: "~2.0.0",
      actual: "~1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => preserves caret prefix", () => {
  const result = constructDepsToUpdateList({ foo: "^1.0.0" }, { foo: "2.0.0" });
  expect(result).toEqual([
    {
      name: "foo",
      exact: "2.0.0",
      expected: "^2.0.0",
      actual: "^1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => handles multiple caret prefixes correctly", () => {
  const result = constructDepsToUpdateList(
    { foo: "^^1.0.0" },
    { foo: "2.0.0" },
  );
  expect(result).toEqual([
    {
      name: "foo",
      exact: "2.0.0",
      expected: "^2.0.0", // Should only have one ^ character
      actual: "^^1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => handles multiple tilde prefixes correctly", () => {
  const result = constructDepsToUpdateList(
    { foo: "~~~1.0.0" },
    { foo: "2.0.0" },
  );
  expect(result).toEqual([
    {
      name: "foo",
      exact: "2.0.0",
      expected: "~2.0.0", // Should only have one ~ character
      actual: "~~~1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => handles mixed special characters correctly", () => {
  const result = constructDepsToUpdateList(
    { foo: "^~^1.0.0" },
    { foo: "2.0.0" },
  );
  expect(result).toEqual([
    {
      name: "foo",
      exact: "2.0.0",
      expected: "^2.0.0", // Should use the first character (^)
      actual: "^~^1.0.0",
    },
  ]);
});

test("constructPermissiveDepsToUpdateList => updates all deps except codependencies with resolved versions", () => {
  const deps = { lodash: "^4.0.0", express: "~4.18.0", react: "18.0.0" };
  const codependencies = ["react"];
  const versionMap = { lodash: "4.17.21", express: "4.19.0", react: "18.3.0" };
  const result = scripts.constructPermissiveDepsToUpdateList(
    deps,
    codependencies,
    versionMap,
  );

  expect(result).toEqual([
    {
      name: "lodash",
      actual: "^4.0.0",
      exact: "4.17.21",
      expected: "^4.17.21",
    },
    {
      name: "express",
      actual: "~4.18.0",
      exact: "4.19.0",
      expected: "~4.19.0",
    },
  ]);
});

test("constructPermissiveDepsToUpdateList => handles empty dependencies", () => {
  const result = scripts.constructPermissiveDepsToUpdateList({}, ["react"], {});
  expect(result).toEqual([]);
});

test("constructPermissiveDepsToUpdateList => handles no codependencies", () => {
  const deps = { lodash: "^4.0.0", express: "4.18.0" };
  const versionMap = { lodash: "4.17.21", express: "4.19.0" };
  const result = scripts.constructPermissiveDepsToUpdateList(deps, [], versionMap);

  expect(result).toEqual([
    {
      name: "lodash",
      actual: "^4.0.0",
      exact: "4.17.21",
      expected: "^4.17.21",
    },
    {
      name: "express",
      actual: "4.18.0",
      exact: "4.19.0",
      expected: "4.19.0",
    },
  ]);
});

test("constructDepsToUpdateList => preserves tilde prefix", () => {
  const result = constructDepsToUpdateList({ foo: "~1.0.0" }, { foo: "2.0.0" });
  expect(result).toEqual([
    {
      name: "foo",
      exact: "2.0.0",
      expected: "~2.0.0",
      actual: "~1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => with empty dependency object", () => {
  const result = constructDepsToUpdateList({}, { foo: "2.0.0" });
  expect(result).toEqual([]);
});

test("constructDepsToUpdateList => with dependency not in versionMap", () => {
  const result = constructDepsToUpdateList({ bar: "1.0.0" }, { foo: "2.0.0" });
  expect(result).toEqual([]);
});

test("constructDepsToUpdateList => with same version in versionMap", () => {
  const result = constructDepsToUpdateList({ foo: "2.0.0" }, { foo: "2.0.0" });
  expect(result).toEqual([]);
});

test("constructVersionTypes => normalizes multiple special characters to a single one", () => {
  const result = constructVersionTypes("^^1.2.3");
  // Should only extract the first ^ as the bumpCharacter and remove all special characters from exactVersion
  expect(result).toEqual({
    bumpCharacter: "^",
    bumpVersion: "^^1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => normalizes multiple tilde characters to a single one", () => {
  const result = constructVersionTypes("~~~1.2.3");
  expect(result).toEqual({
    bumpCharacter: "~",
    bumpVersion: "~~~1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => handles mixed special characters correctly", () => {
  const result = constructVersionTypes("^~^1.2.3");
  // Should use the first character as the bumpCharacter
  expect(result).toEqual({
    bumpCharacter: "^",
    bumpVersion: "^~^1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => handles empty string", () => {
  const result = constructVersionTypes("");
  expect(result).toEqual({
    bumpCharacter: "",
    bumpVersion: "",
    exactVersion: "",
  });
});

test("constructVersionTypes => handles version with only special characters", () => {
  const result = constructVersionTypes("^^^");
  expect(result).toEqual({
    bumpCharacter: "^",
    bumpVersion: "^^^",
    exactVersion: "",
  });
});

test("constructDeps => with update", () => {
  const json = {
    name: "foo",
    version: "1.0.0",
    dependencies: { bar: "1.0.0" },
    path: "./test",
  };
  const depName = "bar";
  const depList = [
    { name: "bar", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
  ];
  const result = constructDeps(json, depName, depList);
  expect(result).toEqual({ bar: "2.0.0" });
});

test("constructDeps => with no deplist", () => {
  const json = {
    name: "foo",
    version: "1.0.0",
    dependencies: { bar: "1.0.0" },
    path: "./test",
  };
  const depName = "bar";
  const depList: Array<{
    name: string;
    expected: string;
    actual: string;
    exact: string;
  }> = [];
  const result = constructDeps(json, depName, depList);
  expect(result).not.toBeDefined();
});

test("constructDeps => with more deps", () => {
  const json = {
    name: "foo",
    version: "1.0.0",
    dependencies: { bar: "1.0.0", biz: "1.0.0" },
    path: "./test",
  };
  const depName = "bar";
  const depList = [
    { name: "bar", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
    { name: "biz", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
  ];
  const result = constructDeps(json, depName, depList);
  expect(result).toEqual({ bar: "2.0.0", biz: "2.0.0" });
});

test("constructJson => with updates", () => {
  const json = {
    name: "foo",
    version: "1.0.0",
    dependencies: { bar: "1.0.0", biz: "1.0.0" },
    path: "./test",
  };
  const depsToUpdate = {
    depList: [
      { name: "bar", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
      { name: "biz", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
    ],
    peerDepList: [],
    devDepList: [],
  };
  const result = constructJson(json, depsToUpdate);
  expect(result).toStrictEqual({
    name: "foo",
    path: "./test",
    version: "1.0.0",
    dependencies: {
      bar: "2.0.0",
      biz: "2.0.0",
    },
  });
});

test("constructJson => with devDependencies", () => {
  const json = {
    name: "foo",
    version: "1.0.0",
    devDependencies: { bar: "1.0.0", biz: "1.0.0" },
    path: "./test",
  };
  const depsToUpdate = {
    depList: [],
    peerDepList: [],
    devDepList: [
      { name: "bar", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
      { name: "biz", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
    ],
  };
  const result = constructJson(json, depsToUpdate);
  expect(result).toStrictEqual({
    name: "foo",
    path: "./test",
    version: "1.0.0",
    devDependencies: {
      bar: "2.0.0",
      biz: "2.0.0",
    },
  });
});

test("constructJson => with peerDependencies", () => {
  const json = {
    name: "foo",
    version: "1.0.0",
    peerDependencies: { bar: "1.0.0", biz: "1.0.0" },
    path: "./test",
  };
  const depsToUpdate = {
    depList: [],
    devDepList: [],
    peerDepList: [
      { name: "bar", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
      { name: "biz", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
    ],
  };
  const result = constructJson(json, depsToUpdate);
  expect(result).toStrictEqual({
    name: "foo",
    path: "./test",
    version: "1.0.0",
    peerDependencies: {
      bar: "2.0.0",
      biz: "2.0.0",
    },
  });
});

test("constructJson => with all dependency types", () => {
  const json = {
    name: "foo",
    version: "1.0.0",
    dependencies: { dep1: "1.0.0", dep2: "1.0.0" },
    devDependencies: { dev1: "1.0.0", dev2: "1.0.0" },
    peerDependencies: { peer1: "1.0.0", peer2: "1.0.0" },
    path: "./test",
  };
  const depsToUpdate = {
    depList: [
      { name: "dep1", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
      { name: "dep2", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
    ],
    devDepList: [
      { name: "dev1", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
      { name: "dev2", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
    ],
    peerDepList: [
      { name: "peer1", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
      { name: "peer2", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" },
    ],
  };
  const result = constructJson(json, depsToUpdate);
  expect(result).toStrictEqual({
    name: "foo",
    path: "./test",
    version: "1.0.0",
    dependencies: {
      dep1: "2.0.0",
      dep2: "2.0.0",
    },
    devDependencies: {
      dev1: "2.0.0",
      dev2: "2.0.0",
    },
    peerDependencies: {
      peer1: "2.0.0",
      peer2: "2.0.0",
    },
  });
});

test("checkDependenciesForVersion => has updates", () => {
  const versionMap = {
    foo: "2.0.0",
    bar: "2.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    dependencies: { bar: "1.0.0", foo: "1.0.0" },
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  });
  expect(result).toEqual(true);
});

test("checkDependenciesForVersion => has updates + special characters", () => {
  const versionMap = {
    foo: "2.0.0",
    bar: "2.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    dependencies: { bar: "1.0.0", foo: "1.0.0" },
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  });
  expect(result).toEqual(true);
});

test("checkDependenciesForVersion => no updates", () => {
  const versionMap = {
    foo: "1.0.0",
    bar: "1.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    dependencies: { bar: "1.0.0", foo: "1.0.0" },
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  });
  expect(result).toEqual(false);
});

test("checkDependenciesForVersion => no updates", () => {
  const versionMap = {
    foo: "1.0.0",
    bar: "1.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    dependencies: { bar: "1.0.0", foo: "1.0.0" },
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  });
  expect(result).toEqual(false);
});

test("checkDependenciesForVersion => with isUpdating=true", () => {
  const versionMap = {
    foo: "2.0.0",
    bar: "2.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    dependencies: { bar: "1.0.0", foo: "1.0.0" },
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
    isUpdating: true,
  });
  expect(result).toEqual(true);
});

test("checkDependenciesForVersion => with no dependencies", () => {
  const versionMap = {
    foo: "2.0.0",
    bar: "2.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  });
  expect(result).toEqual(false);
});

test("checkDependenciesForVersion => with devDependencies and peerDependencies", () => {
  const versionMap = {
    foo: "2.0.0",
    bar: "2.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    devDependencies: { foo: "1.0.0" },
    peerDependencies: { bar: "1.0.0" },
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  });
  expect(result).toEqual(true);
});

test("detectStaleCodependencies => no stale entries", () => {
  const codependencies = ["lodash", "fs-extra"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  const result = detectStaleCodependencies(codependencies, files, rootDir);
  expect(result).toEqual([]);
});

test("detectStaleCodependencies => stale entries found", () => {
  const codependencies = ["lodash", "fs-extra", "removed-package", "also-gone"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  const result = detectStaleCodependencies(codependencies, files, rootDir);
  expect(result).toEqual(["removed-package", "also-gone"]);
});

test("detectStaleCodependencies => handles object-style codependencies", () => {
  const codependencies = [{ lodash: "4.17.21" }, "stale-pkg"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  const result = detectStaleCodependencies(codependencies, files, rootDir);
  expect(result).toEqual(["stale-pkg"]);
});

test("detectStaleCodependencies => empty codependencies returns empty", () => {
  const result = detectStaleCodependencies([], ["test-pass-package.json"], "./tests/unit/fixtures/");
  expect(result).toEqual([]);
});

test("detectStaleCodependencies => unreadable file treated as no deps", () => {
  const result = detectStaleCodependencies(
    ["some-package"],
    ["nonexistent-file.json"],
    "./tests/unit/fixtures/",
  );
  expect(result).toEqual(["some-package"]);
});

test("checkMatches => no updates", () => {
  const logCheckMatchesNoUpdates = jest.spyOn(console, "log");
  const versionMap = {
    foo: "1.0.0",
    bar: "1.0.0",
  };
  const rootDir = "./tests/unit/fixtures/";
  const isTesting = true;
  const files = ["test-pass-package.json"];
  checkMatches({ versionMap, files, isTesting, rootDir });
  expect(logCheckMatchesNoUpdates).toHaveBeenCalled();
  logCheckMatchesNoUpdates.mockRestore();
});

test("checkMatches => with error", () => {
  const logCheckMatchesWithError = jest.spyOn(console, "error");
  const versionMap = {
    lodash: "4.18.0",
    "fs-extra": "5.0.0",
  };
  const rootDir = "./tests/unit/fixtures/";
  const isTesting = true;
  const files = ["test-fail-package.json"];
  expect(() => checkMatches({ versionMap, files, isTesting, rootDir })).toThrow("Dependencies are not correct.");
  expect(logCheckMatchesWithError).toHaveBeenCalled();
  logCheckMatchesWithError.mockRestore();
});

test("checkMatches => with updates applied", () => {
  const logSpy = jest.spyOn(console, "log");
  const versionMap = {
    lodash: "4.18.0",
    "fs-extra": "5.0.0",
  };
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  checkMatches({ versionMap, files, rootDir, isUpdating: true, isTesting: true });
  expect(logSpy).toHaveBeenCalled();
  logSpy.mockRestore();
});

test("checkFiles => with no updates", async () => {
  const logCheckFilesNoUpdates = jest.spyOn(console, "log");
  const codependencies = ["lodash", "fs-extra"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files });
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  expect(logCheckFilesNoUpdates).toHaveBeenCalled();
  logCheckFilesNoUpdates.mockRestore();
});

test("checkFiles => with updates (verbose mode)", async () => {
  const logCheckFilesWithUpdates = jest.spyOn(console, "error");
  const codependencies = ["lodash", "fs-extra"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: false });
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  expect(logCheckFilesWithUpdates).toHaveBeenCalled();
  logCheckFilesWithUpdates.mockRestore();
});

test("checkFiles => with permissive mode only", async () => {
  const logCheckFilesPermissive = jest.spyOn(console, "error");
  const codependencies = null;
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: true } as any);
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  expect(logCheckFilesPermissive).toHaveBeenCalled();
  logCheckFilesPermissive.mockRestore();
});

test("checkFiles => with permissive mode and codependencies", async () => {
  const logCheckFilesPermissiveWithCodependencies = jest.spyOn(
    console,
    "error",
  );
  const codependencies = ["lodash"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: true });
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  expect(logCheckFilesPermissiveWithCodependencies).toHaveBeenCalled();
  logCheckFilesPermissiveWithCodependencies.mockRestore();
});

test("checkFiles => warns on stale codependencies", async () => {
  const warnSpy = jest.spyOn(console, "warn");
  const codependencies = ["lodash", "stale-nonexistent-package"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, isTesting: true });
  } catch {
    // may throw for out-of-date deps
  }
  expect(warnSpy).toHaveBeenCalled();
  warnSpy.mockRestore();
});

test("checkFiles => with dryRun shows diffs", async () => {
  const logSpy = jest.spyOn(console, "log");
  const codependencies = ["lodash", "fs-extra"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, dryRun: true, isTesting: true });
  } catch {
    // may throw for out-of-date deps
  }
  expect(logSpy).toHaveBeenCalled();
  logSpy.mockRestore();
});

test("checkDependenciesForVersion => with permissive mode", () => {
  const versionMap = { lodash: "4.17.21", express: "4.19.0" };
  const json = {
    name: "test-package",
    version: "1.0.0",
    dependencies: { lodash: "^4.0.0", express: "~4.18.0" },
    path: "./test",
  };
  const result = checkDependenciesForVersion(versionMap, json, {
    permissive: true,
    isTesting: true,
  });
  expect(result).toEqual(true);
});

test("checkDependenciesForVersion => with permissive mode and codependencies", () => {
  const versionMap = { lodash: "4.17.21", express: "4.19.0", react: "18.3.0" };
  const json = {
    name: "test-package",
    version: "1.0.0",
    dependencies: { lodash: "^4.0.0", express: "~4.18.0", react: "^18.0.0" },
    path: "./test",
  };
  const codependencies = ["react"];
  const result = checkDependenciesForVersion(
    versionMap,
    json,
    {
      permissive: true,
      isTesting: true,
    },
    codependencies,
  );
  expect(result).toEqual(true);
});

test("constructDepsToUpdateList => respects level=minor constraint", () => {
  const dep = { foo: "^1.0.0", bar: "^1.0.0" };
  const versionMap = { foo: "1.5.0", bar: "2.0.0" };
  const result = constructDepsToUpdateList(dep, versionMap, "minor");
  expect(result).toEqual([
    {
      name: "foo",
      actual: "^1.0.0",
      exact: "1.5.0",
      expected: "^1.5.0",
    },
  ]);
});

test("constructDepsToUpdateList => respects level=patch constraint", () => {
  const dep = { foo: "^1.0.0", bar: "^1.0.0" };
  const versionMap = { foo: "1.0.5", bar: "1.1.0" };
  const result = constructDepsToUpdateList(dep, versionMap, "patch");
  expect(result).toEqual([
    {
      name: "foo",
      actual: "^1.0.0",
      exact: "1.0.5",
      expected: "^1.0.5",
    },
  ]);
});

test("constructPermissiveDepsToUpdateList => respects level=minor constraint", () => {
  const deps = { lodash: "^4.0.0", express: "^3.0.0" };
  const codependencies: string[] = [];
  const versionMap = { lodash: "4.17.21", express: "5.0.0" };
  const result = scripts.constructPermissiveDepsToUpdateList(
    deps,
    codependencies,
    versionMap,
    "minor",
  );
  expect(result).toEqual([
    {
      name: "lodash",
      actual: "^4.0.0",
      exact: "4.17.21",
      expected: "^4.17.21",
    },
  ]);
});

test("constructPermissiveDepsToUpdateList => skips deps not in versionMap", () => {
  const deps = { lodash: "^4.0.0", unknown: "^1.0.0" };
  const versionMap = { lodash: "4.17.21" };
  const result = scripts.constructPermissiveDepsToUpdateList(
    deps,
    [],
    versionMap,
  );
  expect(result).toEqual([
    {
      name: "lodash",
      actual: "^4.0.0",
      exact: "4.17.21",
      expected: "^4.17.21",
    },
  ]);
});

test("constructPermissiveDepsToUpdateList => with mixed dependency types", () => {
  const deps = {
    "@types/node": "^18.0.0",
    typescript: "~4.9.0",
    lodash: "4.17.21",
    react: "^18.2.0",
  };
  const codependencies = ["react", "typescript"];
  const versionMap = {
    "@types/node": "20.10.0",
    typescript: "5.3.0",
    lodash: "4.17.22",
    react: "18.3.0",
  };
  const result = scripts.constructPermissiveDepsToUpdateList(
    deps,
    codependencies,
    versionMap,
  );

  expect(result).toEqual([
    {
      name: "@types/node",
      actual: "^18.0.0",
      exact: "20.10.0",
      expected: "^20.10.0",
    },
    {
      name: "lodash",
      actual: "4.17.21",
      exact: "4.17.22",
      expected: "4.17.22",
    },
  ]);
});

test("filterSelectedDeps => no packages selected", () => {
  const result = filterSelectedDeps([], ["lodash", "react"], { lodash: "4.18.0", react: "18.0.0" });
  expect(result.shouldUpdate).toBe(false);
  expect(result.depNames).toEqual(["lodash", "react"]);
});

test("filterSelectedDeps => packages selected", () => {
  const result = filterSelectedDeps(
    ["lodash"],
    ["lodash", "react"],
    { lodash: "4.18.0", react: "18.0.0" },
  );
  expect(result.shouldUpdate).toBe(true);
  expect(result.depNames).toEqual(["lodash"]);
  expect(result.versionMap).toEqual({ lodash: "4.18.0" });
});

test("checkFiles => throws when no codependencies and not precise mode", async () => {
  await expect(
    checkFiles({ codependencies: undefined, permissive: false, rootDir: "./tests/unit/fixtures/", files: ["test-pass-package.json"] } as never),
  ).rejects.toMatch(/codependencies/);
});

test("checkFiles => interactive mode invokes prompt selection", async () => {
  const checkboxSpy = jest.spyOn(Prompt.prototype, "checkbox").mockResolvedValue([]);
  const closeSpy = jest.spyOn(Prompt.prototype, "close").mockImplementation(() => {});
  const codependencies = ["lodash", "fs-extra"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, interactive: true, update: true, isTesting: false });
  } catch {
    // throws because deps are out of date in non-CLI mode
  }
  expect(checkboxSpy).toHaveBeenCalled();
  checkboxSpy.mockRestore();
  closeSpy.mockRestore();
});
