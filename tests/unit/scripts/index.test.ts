import { expect, test, jest, beforeEach } from "bun:test";
import * as fs from "fs";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../../../src/logger";
import { NodeJSProvider } from "../../../src/providers/nodejs";
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

test("constructVersionMap => returns cached versions and reports progress", async () => {
  versionCache.set("npm:lodash", "4.17.21");

  const exec = jest.fn();
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const onProgress = jest.fn();

  const result = await constructVersionMap({
    codependencies: ["lodash"],
    exec,
    validate,
    onProgress,
  });

  expect(result).toEqual({ lodash: "4.17.21" });
  expect(exec).not.toHaveBeenCalled();
  expect(onProgress).toHaveBeenCalledWith(1, 1, "lodash");
});

test("constructVersionMap => logs resolver errors in debug mode", async () => {
  const debugSpy = jest.spyOn(logger, "debug").mockImplementation(() => {});
  const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));

  const result = await constructVersionMap({
    codependencies: ["lodash"],
    debug: true,
    isTesting: true,
    noCache: true,
    validate,
    resolveVersion: async () => {
      throw new Error("ENOTFOUND registry.npmjs.org");
    },
  });

  expect(result).toEqual({});
  expect(debugSpy).toHaveBeenCalledWith("ENOTFOUND registry.npmjs.org");
  expect(errorSpy).toHaveBeenCalled();

  debugSpy.mockRestore();
  errorSpy.mockRestore();
});

test("constructVersionMap => logs validation-style resolver errors directly", async () => {
  const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  const validate = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));

  const result = await constructVersionMap({
    codependencies: ["lodash"],
    isTesting: true,
    noCache: true,
    validate,
    resolveVersion: async () => {
      throw new Error("Invalid package metadata");
    },
  });

  expect(result).toEqual({});
  expect(errorSpy).toHaveBeenCalledWith("Invalid package metadata");

  errorSpy.mockRestore();
});

test("constructVersionTypes => with ^", () => {
  const result = constructVersionTypes("^1.2.3");
  expect(result).toEqual({
    bumpCharacter: "^",
    bumpVersion: "^1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => preserves equality prefix", () => {
  const result = constructVersionTypes("==2.28.0");
  expect(result).toEqual({
    bumpCharacter: "==",
    bumpVersion: "==2.28.0",
    exactVersion: "2.28.0",
  });
});

test("constructVersionTypes => does not reuse strict inequality prefix", () => {
  const result = constructVersionTypes("<2.0.0");
  expect(result).toEqual({
    bumpCharacter: "",
    bumpVersion: "<2.0.0",
    exactVersion: "2.0.0",
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

test("constructDepsToUpdateList => preserves equality prefix once", () => {
  const result = constructDepsToUpdateList(
    { requests: "==2.28.0" },
    { requests: "==2.31.0" },
  );
  expect(result).toEqual([
    {
      name: "requests",
      exact: "2.31.0",
      expected: "==2.31.0",
      actual: "==2.28.0",
    },
  ]);
});

test("constructDepsToUpdateList => enforces explicit object target prefix", () => {
  const result = constructDepsToUpdateList(
    { foo: "1.0.0" },
    { foo: "^1.0.0" },
  );
  expect(result).toEqual([
    {
      name: "foo",
      exact: "1.0.0",
      expected: "^1.0.0",
      actual: "1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => updates mismatched prefixes to explicit object target", () => {
  const result = constructDepsToUpdateList(
    { foo: "~1.0.0" },
    { foo: "^1.0.0" },
  );
  expect(result).toEqual([
    {
      name: "foo",
      exact: "1.0.0",
      expected: "^1.0.0",
      actual: "~1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => skips matching explicit object target", () => {
  const result = constructDepsToUpdateList(
    { foo: "^1.0.0" },
    { foo: "^1.0.0" },
  );
  expect(result).toEqual([]);
});

test("constructDepsToUpdateList => does not preserve strict less-than prefix", () => {
  const result = constructDepsToUpdateList(
    { foo: "<2.0.0" },
    { foo: "3.0.0" },
  );
  expect(result).toEqual([
    {
      name: "foo",
      exact: "3.0.0",
      expected: "3.0.0",
      actual: "<2.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => does not preserve strict greater-than prefix", () => {
  const result = constructDepsToUpdateList(
    { foo: ">2.0.0" },
    { foo: "3.0.0" },
  );
  expect(result).toEqual([
    {
      name: "foo",
      exact: "3.0.0",
      expected: "3.0.0",
      actual: ">2.0.0",
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

test("checkDependenciesForVersion => writes updates and logs debug info", () => {
  const debugSpy = jest.spyOn(logger, "debug").mockImplementation(() => {});
  const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
  const versionMap = {
    foo: "2.0.0",
    optional: "2.0.0",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    dependencies: { foo: "1.0.0" },
    optionalDependencies: { optional: "1.0.0" },
    path: "./debug-test.json",
  };

  const result = checkDependenciesForVersion(versionMap, json, {
    isDebugging: true,
    isUpdating: true,
    isTesting: false,
  });

  expect(result).toEqual(true);
  expect(debugSpy).toHaveBeenCalledWith(
    "checkDependenciesForVersion debug info",
    expect.any(Object),
  );
  expect(debugSpy).toHaveBeenCalledWith(
    "constructJson debug info",
    expect.any(Object),
  );
  expect(writeSpy).toHaveBeenCalledWith(
    "./debug-test.json",
    expect.stringContaining(`"foo": "2.0.0"`),
  );
  expect(writeSpy).toHaveBeenCalledWith(
    "./debug-test.json",
    expect.stringContaining(`"optional": "2.0.0"`),
  );

  debugSpy.mockRestore();
  writeSpy.mockRestore();
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

test("checkMatches => logs debug output", () => {
  const debugSpy = jest.spyOn(logger, "debug").mockImplementation(() => {});
  const versionMap = {
    foo: "1.0.0",
    bar: "1.0.0",
  };

  checkMatches({
    versionMap,
    files: ["test-pass-package.json"],
    isDebugging: true,
    isTesting: true,
    rootDir: "./tests/unit/fixtures/",
  });

  expect(debugSpy).toHaveBeenCalledWith("see updates", {
    packagesNeedingUpdate: [],
  });

  debugSpy.mockRestore();
});

test("checkFiles => with no updates", async () => {
  const logCheckFilesNoUpdates = jest.spyOn(console, "log");
  const codependencies = [{ lodash: "4.17.21" }, { "fs-extra": "10.1.0" }];
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
  const codependencies = [{ lodash: "4.18.0" }, { "fs-extra": "5.0.0" }];
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

test("checkFiles => defaults codependencies to 0.x compatible verbose mode", async () => {
  const codependencies = [{ lodash: "4.18.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  const diffs = await checkFiles({ codependencies, rootDir, files, format: "json" });

  expect(diffs?.map((diff) => diff.package)).toEqual(["lodash"]);
});

test("checkFiles => sets exit code for formatted CLI failures", async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    const codependencies = [{ lodash: "4.18.0" }];
    const rootDir = "./tests/unit/fixtures/";
    const files = ["test-fail-package.json"];
    const diffs = await checkFiles({
      codependencies,
      rootDir,
      files,
      format: "json",
      isCLI: true,
    });

    expect(diffs?.map((diff) => diff.package)).toEqual(["lodash"]);
    expect(process.exitCode).toBe(1);
  } finally {
    process.exitCode = previousExitCode ?? 0;
  }
});

test("checkFiles => with permissive mode only", async () => {
  const logCheckFilesPermissive = jest.spyOn(console, "error");
  const codependencies = null;
  const getLatestVersionSpy = jest
    .spyOn(NodeJSProvider.prototype, "getLatestVersion")
    .mockImplementation(async (packageName: string) =>
      packageName === "lodash" ? "4.18.0" : "10.1.0",
    );
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: true } as any);
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  expect(logCheckFilesPermissive).toHaveBeenCalled();
  getLatestVersionSpy.mockRestore();
  logCheckFilesPermissive.mockRestore();
});

test("checkFiles => with permissive mode and codependencies", async () => {
  const logCheckFilesPermissiveWithCodependencies = jest.spyOn(
    console,
    "error",
  );
  const codependencies = [{ lodash: "4.17.21" }];
  const getLatestVersionSpy = jest
    .spyOn(NodeJSProvider.prototype, "getLatestVersion")
    .mockImplementation(async (packageName: string) =>
      packageName === "fs-extra" ? "10.1.0" : "4.17.21",
    );
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: true });
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  expect(logCheckFilesPermissiveWithCodependencies).toHaveBeenCalled();
  getLatestVersionSpy.mockRestore();
  logCheckFilesPermissiveWithCodependencies.mockRestore();
});

test("checkFiles => warns on stale codependencies", async () => {
  const warnSpy = jest.spyOn(console, "warn");
  const codependencies = [
    { lodash: "4.17.21" },
    { "stale-nonexistent-package": "1.0.0" },
  ];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  try {
    await checkFiles({
      codependencies,
      rootDir,
      files,
      isTesting: true,
      permissive: false,
    });
  } catch {
    // may throw for out-of-date deps
  }
  expect(warnSpy).toHaveBeenCalled();
  warnSpy.mockRestore();
});

test("checkFiles => with dryRun shows diffs", async () => {
  const logSpy = jest.spyOn(console, "log");
  const codependencies = [{ lodash: "4.18.0" }, { "fs-extra": "5.0.0" }];
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

test("constructDepsToUpdateList => exact strategy ignores semver level", () => {
  const dep = { "actions/checkout": "v4" };
  const versionMap = { "actions/checkout": "v5" };
  const result = constructDepsToUpdateList(dep, versionMap, "patch", "exact");
  expect(result).toEqual([
    {
      name: "actions/checkout",
      actual: "v4",
      exact: "v5",
      expected: "v5",
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
  const codependencies = [{ lodash: "4.18.0" }, { "fs-extra": "5.0.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({
      codependencies,
      rootDir,
      files,
      interactive: true,
      update: true,
      isTesting: false,
      permissive: false,
    });
  } catch {
    // throws because deps are out of date in non-CLI mode
  }
  expect(checkboxSpy).toHaveBeenCalled();
  checkboxSpy.mockRestore();
  closeSpy.mockRestore();
});

test("checkFiles => skips interactive prompt when nothing needs updating", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-interactive-no-diffs");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "interactive-no-diffs",
        version: "1.0.0",
        dependencies: {
          lodash: "1.0.0",
        },
      },
      null,
      2,
    ),
  );

  const checkboxSpy = jest
    .spyOn(Prompt.prototype, "checkbox")
    .mockResolvedValue(["lodash"]);
  const closeSpy = jest.spyOn(Prompt.prototype, "close").mockImplementation(() => {});

  try {
    await expect(
      checkFiles({
        codependencies: [{ lodash: "2.0.0" }],
        rootDir: tempDir,
        files: ["package.json"],
        interactive: true,
        update: true,
        permissive: false,
        isTesting: false,
        level: "patch",
      }),
    ).resolves.toEqual([
      {
        current: "1.0.0",
        isPinned: true,
        latest: "2.0.0",
        package: "lodash",
        willUpdate: false,
      },
    ]);
    expect(checkboxSpy).not.toHaveBeenCalled();
  } finally {
    checkboxSpy.mockRestore();
    closeSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => falls back to explicit language provider when no manifests match", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-provider-fallback");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "provider-fallback",
        version: "1.0.0",
        dependencies: {
          lodash: "4.17.21",
        },
      },
      null,
      2,
    ),
  );

  try {
    await expect(
      checkFiles({
        codependencies: [{ lodash: "4.17.21" }],
        rootDir: tempDir,
        files: ["missing-package.json"],
        language: "nodejs",
        permissive: false,
        isTesting: true,
      }),
    ).resolves.toEqual([]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => handles rootDir without trailing slash", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-root-dir-no-slash");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "root-dir-test",
        version: "1.0.0",
        dependencies: {
          lodash: "4.17.21",
        },
      },
      null,
      2,
    ),
  );

  const logSpy = jest.spyOn(console, "log");
  try {
    await checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      rootDir: tempDir,
      permissive: false,
      isTesting: true,
    });
  } finally {
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => applies provider-backed manifest updates", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-provider-update");
  const packageJsonPath = join(tempDir, "package.json");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: "provider-update",
        version: "1.0.0",
        dependencies: {
          lodash: "4.17.0",
        },
      },
      null,
      2,
    ),
  );

  const debugSpy = jest.spyOn(logger, "debug").mockImplementation(() => {});

  try {
    await checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      rootDir: tempDir,
      files: ["package.json"],
      update: true,
      debug: true,
      permissive: false,
      isTesting: false,
    });

    const updatedPackageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf8"),
    ) as {
      dependencies: Record<string, string>;
    };

    expect(updatedPackageJson.dependencies.lodash).toBe("4.17.21");
    expect(debugSpy).toHaveBeenCalledWith(
      "checkManifestDependenciesForVersion debug info",
      expect.any(Object),
    );
    expect(debugSpy).toHaveBeenCalledWith("see updates", {
      packagesNeedingUpdate: ["package.json"],
    });
  } finally {
    debugSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => logs manifest writes in testing update mode", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-provider-update-testing");
  const packageJsonPath = join(tempDir, "package.json");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: "provider-update-testing",
        version: "1.0.0",
        dependencies: {
          lodash: "4.17.0",
        },
      },
      null,
      2,
    ),
  );

  const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => {});

  try {
    await checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      rootDir: tempDir,
      files: ["package.json"],
      update: true,
      permissive: false,
      isTesting: true,
    });

    expect(infoSpy).toHaveBeenCalledWith(
      `test-writeFileSync: ${packageJsonPath}`,
    );
    expect(JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))).toEqual({
      name: "provider-update-testing",
      version: "1.0.0",
      dependencies: {
        lodash: "4.17.0",
      },
    });
  } finally {
    infoSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects python manifests", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-python-detect");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    join(tempDir, "requirements.txt"),
    "requests==2.28.0\nflask==2.0.0\n",
  );

  const logSpy = jest.spyOn(console, "log");
  try {
    await checkFiles({
      codependencies: [{ requests: "==2.28.0" }],
      rootDir: tempDir,
      permissive: false,
      isTesting: true,
    });
  } finally {
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => respects explicit go language", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-go-language");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    join(tempDir, "go.mod"),
    `module github.com/example/test

go 1.21

require (
\tgithub.com/gin-gonic/gin v1.9.0
)
`,
  );

  const logSpy = jest.spyOn(console, "log");
  try {
    await checkFiles({
      codependencies: [{ "github.com/gin-gonic/gin": "v1.9.0" }],
      rootDir: tempDir,
      language: "go",
      permissive: false,
      isTesting: true,
    });
  } finally {
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects rust manifests", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-rust-detect");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    join(tempDir, "Cargo.toml"),
    '[package]\nname = "rust-detect"\n\n[dependencies]\nserde = "1.0.190"\n',
  );

  try {
    await expect(
      checkFiles({
        codependencies: [{ serde: "1.0.190" }],
        rootDir: tempDir,
        files: ["Cargo.toml"],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
    ).resolves.toEqual([]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates rust manifests with normalized package names", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-rust-normalized");
  const cargoPath = join(tempDir, "Cargo.toml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    cargoPath,
    '[package]\nname = "rust-normalized"\n\n[dependencies]\nserde_json = "1.0.100"\n',
  );

  try {
    await checkFiles({
      codependencies: [{ "serde-json": "1.0.145" }],
      rootDir: tempDir,
      files: ["Cargo.toml"],
      update: true,
      silent: true,
    });

    const updated = fs.readFileSync(cargoPath, "utf8");
    expect(updated).toContain('serde_json = "1.0.145"');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects Docker manifests", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-docker-detect");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "Dockerfile"), "FROM node:20.11.1\n");

  try {
    await expect(
      checkFiles({
        codependencies: [{ node: "20.11.1" }],
        rootDir: tempDir,
        files: ["Dockerfile"],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
    ).resolves.toEqual([]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects Docker precise mode", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-docker-precise");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "Dockerfile"), "FROM node:20.11.1\n");

  try {
    await expect(
      checkFiles({
        rootDir: tempDir,
        files: ["Dockerfile"],
        mode: "precise",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("docker provider requires explicit version pins");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects Docker string codependencies", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-docker-string-deps");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "Dockerfile"), "FROM node:20.11.1\n");

  try {
    await expect(
      checkFiles({
        codependencies: ["node"],
        rootDir: tempDir,
        files: ["Dockerfile"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("docker provider requires explicit version pins");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects Docker string codependencies in Node roots", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-docker-node-root");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(join(tempDir, "Dockerfile"), "FROM node:20.11.1\n");

  try {
    await expect(
      checkFiles({
        codependencies: ["node"],
        rootDir: tempDir,
        files: ["Dockerfile"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("docker provider requires explicit version pins");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects GitHub Actions manifests", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-github-actions-detect");
  const workflowDir = join(tempDir, ".github", "workflows");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    join(workflowDir, "ci.yml"),
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await expect(
      checkFiles({
        codependencies: [{ "actions/checkout": "v4" }],
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
    ).resolves.toEqual([]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects GitHub Actions precise mode", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-github-actions-precise");
  const workflowDir = join(tempDir, ".github", "workflows");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    join(workflowDir, "ci.yml"),
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await expect(
      checkFiles({
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        mode: "precise",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("github-actions provider requires explicit version pins");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects GitHub Actions string codependencies", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-github-actions-string-deps");
  const workflowDir = join(tempDir, ".github", "workflows");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    join(workflowDir, "ci.yml"),
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await expect(
      checkFiles({
        codependencies: ["actions/checkout"],
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("github-actions provider requires explicit version pins");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects GitHub Actions string codependencies in Node roots", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-github-actions-node-root");
  const workflowDir = join(tempDir, ".github", "workflows");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(
    join(workflowDir, "ci.yml"),
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await expect(
      checkFiles({
        codependencies: ["actions/checkout"],
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("github-actions provider requires explicit version pins");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects absolute GitHub Actions manifest paths", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-github-actions-absolute");
  const workflowDir = join(tempDir, ".github", "workflows");
  const workflowPath = join(workflowDir, "ci.yml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    workflowPath,
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await expect(
      checkFiles({
        codependencies: [{ "actions/checkout": "v4" }],
        rootDir: process.cwd(),
        files: [workflowPath],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
    ).resolves.toEqual([]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects mixed-provider precise mode", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-mixed-provider-precise");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(
    join(tempDir, "Cargo.toml"),
    '[package]\nname = "mixed-provider"\n\n[dependencies]\nserde = "1.0.0"\n',
  );

  try {
    await expect(
      checkFiles({
        rootDir: tempDir,
        files: ["package.json", "Cargo.toml"],
        mode: "precise",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("Latest resolution currently supports one provider");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects mixed-provider string codependencies", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-mixed-provider-latest");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(
    join(tempDir, "Cargo.toml"),
    '[package]\nname = "mixed-provider"\n\n[dependencies]\nserde = "1.0.0"\n',
  );

  try {
    await expect(
      checkFiles({
        codependencies: ["lodash"],
        rootDir: tempDir,
        files: ["package.json", "Cargo.toml"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
    ).rejects.toThrow("Latest resolution currently supports one provider");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => allows mixed-provider explicit pins", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-mixed-provider-explicit");
  const workflowDir = join(tempDir, ".github", "workflows");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(join(tempDir, "Dockerfile"), "FROM alpine:3.20\n");
  writeFileSync(
    join(workflowDir, "ci.yml"),
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await expect(
      checkFiles({
        codependencies: [
          { lodash: "4.17.21" },
          { alpine: "3.20" },
          { "actions/checkout": "v4" },
        ],
        rootDir: tempDir,
        files: ["package.json", "Dockerfile", ".github/workflows/ci.yml"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
    ).resolves.toEqual([]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => logs thrown errors in debug mode", async () => {
  const tempDir = join(process.cwd(), "tests/unit/.tmp-debug-error");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), "{ invalid json");

  const debugSpy = jest.spyOn(logger, "debug").mockImplementation(() => {});
  try {
    await expect(
      checkFiles({
        codependencies: [{ lodash: "4.17.21" }],
        rootDir: tempDir,
        files: ["package.json"],
        debug: true,
        permissive: false,
        isTesting: true,
      }),
    ).rejects.toThrow();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining("SyntaxError"),
    );
  } finally {
    debugSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
