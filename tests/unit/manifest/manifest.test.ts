import { after, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertRejects, assertThrows, match } from "../../helpers/assertions";
import fs from "node:fs";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "node:os";
import { join } from "path";
import { logger } from "../../../src/observability";
import { DockerProvider } from "../../../src/providers/docker";
import { GitHubActionsProvider } from "../../../src/providers/github-actions";
import { NodeJSProvider } from "../../../src/providers/nodejs";
import { versionCache, requestDeduplicator } from "../../../src/manifest";
import * as manifest from "../../../src/manifest";
import { Prompt } from "../../../src/dx";

const tempDirectories = new Set<string>();

const createTestDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "codependence-"));
  tempDirectories.add(directory);
  return directory;
};

after(() => {
  tempDirectories.forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

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
  buildUpdateLists,
  checkDependenciesForVersion,
  checkMatches,
  checkFiles,
  detectStaleCodependencies,
  filterSelectedDeps,
} = manifest;

test("buildUpdateLists => compares repeated versions in every dependency section", () => {
  const versionMap = {
    runtime: "2.0.0",
    development: "2.0.0",
    peer: "2.0.0",
    optional: "2.0.0",
  };
  const result = buildUpdateLists(
    versionMap,
    {
      dependencies: { runtime: "2.0.0" },
      devDependencies: { development: "2.0.0" },
      peerDependencies: { peer: "2.0.0" },
      optionalDependencies: { optional: "2.0.0" },
      dependencyVersions: {
        runtime: ["1.0.0", "2.0.0"],
        development: ["1.0.0", "2.0.0"],
        peer: ["1.0.0", "2.0.0"],
        optional: ["1.0.0", "2.0.0"],
      },
    },
    {},
  );

  assert.deepStrictEqual(
    result.depList.map(({ name }) => name),
    ["runtime"],
  );
  assert.deepStrictEqual(
    result.devDepList.map(({ name }) => name),
    ["development"],
  );
  assert.deepStrictEqual(
    result.peerDepList.map(({ name }) => name),
    ["peer"],
  );
  assert.deepStrictEqual(
    result.optionalDepList.map(({ name }) => name),
    ["optional"],
  );
});

test("buildUpdateLists => compares each resolved Docker tag family", () => {
  const result = buildUpdateLists(
    { node: "24-slim" },
    {
      dependencies: { node: "20-slim" },
      dependencyVersions: { node: ["20-slim", "20-alpine"] },
      resolvedDependencyVersions: {
        node: {
          "20-slim": "24-slim",
          "20-alpine": "24-alpine",
        },
      },
    },
    { versionStrategy: "exact" },
    ["node"],
  );

  assert.deepStrictEqual(result.depList, [
    { name: "node", actual: "20-slim", exact: "24-slim", expected: "24-slim" },
    { name: "node", actual: "20-alpine", exact: "24-alpine", expected: "24-alpine" },
  ]);
});

test("constructVersionMap => pass", async () => {
  const exec = mock.fn(() => ({
    stdout: "4.0.0",
    stderr: "",
  })) as any;
  const validate = mock.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const result = await constructVersionMap({
    codependencies: ["lodash"],
    exec,
    validate,
  });
  assert.deepStrictEqual(result, { lodash: "4.0.0" });
});

test("constructVersionMap => with object in codependencies", async () => {
  const exec = mock.fn(() => ({
    stdout: "4.0.0",
    stderr: "",
  })) as any;
  const validate = mock.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const result = await constructVersionMap({
    codependencies: [{ lodash: "4.0.0" }],
    exec,
    validate,
  });
  assert.deepStrictEqual(result, { lodash: "4.0.0" });
});

test("constructVersionMap => with yarnConfig", async () => {
  const exec = mock.fn(() => ({
    stdout: '{"version":"4.0.0"}',
    stderr: "",
  })) as any;
  const validate = mock.fn(() => ({
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
  assert.deepStrictEqual(result, { lodash: "4.0.0" });
});

test("constructVersionMap => fail", async () => {
  const exec = mock.fn(() => ({
    stdout: "",
    stderr: "",
  })) as any;
  const validate = mock.fn(() => ({
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
  assert.deepStrictEqual(result, {});
});

test("constructVersionMap => with invalid item type", async () => {
  const exec = mock.fn(() => ({
    stdout: "4.0.0",
    stderr: "",
  })) as any;
  const validate = mock.fn(() => ({
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
  assert.deepStrictEqual(result, {});
});

test("constructVersionMap => returns cached versions and reports progress", async () => {
  versionCache.set("npm:lodash", "4.17.21");

  const exec = mock.fn();
  const validate = mock.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));
  const onProgress = mock.fn();

  const result = await constructVersionMap({
    codependencies: ["lodash"],
    exec,
    validate,
    onProgress,
  });

  assert.deepStrictEqual(result, { lodash: "4.17.21" });
  assert.strictEqual(exec.mock.callCount(), 0);
  assertCalledWith(onProgress, 1, 1, "lodash");
});

test("constructVersionMap => logs resolver errors in debug mode", async () => {
  const debugSpy = mock.method(logger, "debug", () => {});
  const errorSpy = mock.method(logger, "error", () => {});
  const validate = mock.fn(() => ({
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

  assert.deepStrictEqual(result, {});
  assertCalledWith(debugSpy, "ENOTFOUND registry.npmjs.org");
  assert.ok(errorSpy.mock.callCount() > 0);

  debugSpy.mock.restore();
  errorSpy.mock.restore();
});

test("constructVersionMap => logs validation-style resolver errors directly", async () => {
  const errorSpy = mock.method(logger, "error", () => {});
  const validate = mock.fn(() => ({
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

  assert.deepStrictEqual(result, {});
  assertCalledWith(errorSpy, "Invalid package metadata");

  errorSpy.mock.restore();
});

test("constructVersionTypes => with ^", () => {
  const result = constructVersionTypes("^1.2.3");
  assert.deepStrictEqual(result, {
    bumpCharacter: "^",
    bumpVersion: "^1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => preserves equality prefix", () => {
  const result = constructVersionTypes("==2.28.0");
  assert.deepStrictEqual(result, {
    bumpCharacter: "==",
    bumpVersion: "==2.28.0",
    exactVersion: "2.28.0",
  });
});

test("constructVersionTypes => does not reuse strict inequality prefix", () => {
  const result = constructVersionTypes("<2.0.0");
  assert.deepStrictEqual(result, {
    bumpCharacter: "",
    bumpVersion: "<2.0.0",
    exactVersion: "2.0.0",
  });
});

test("constructVersionTypes with no specifier", () => {
  const { bumpVersion, exactVersion } = constructVersionTypes("1.2.3");
  assert.deepStrictEqual(bumpVersion, exactVersion);
});

test("constructDepsToUpdateList => returns dep to update list with exact characters", () => {
  const result = constructDepsToUpdateList({ foo: "1.0.0" }, { foo: "2.0.0" });
  assert.deepStrictEqual(result, [
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
  assert.deepStrictEqual(result, [
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
  assert.deepStrictEqual(result, [
    {
      name: "foo",
      exact: "2.0.0",
      expected: "^2.0.0",
      actual: "^1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => preserves equality prefix once", () => {
  const result = constructDepsToUpdateList({ requests: "==2.28.0" }, { requests: "==2.31.0" });
  assert.deepStrictEqual(result, [
    {
      name: "requests",
      exact: "2.31.0",
      expected: "==2.31.0",
      actual: "==2.28.0",
    },
  ]);
});

test("constructDepsToUpdateList => enforces explicit object target prefix", () => {
  const result = constructDepsToUpdateList({ foo: "1.0.0" }, { foo: "^1.0.0" });
  assert.deepStrictEqual(result, [
    {
      name: "foo",
      exact: "1.0.0",
      expected: "^1.0.0",
      actual: "1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => updates mismatched prefixes to explicit object target", () => {
  const result = constructDepsToUpdateList({ foo: "~1.0.0" }, { foo: "^1.0.0" });
  assert.deepStrictEqual(result, [
    {
      name: "foo",
      exact: "1.0.0",
      expected: "^1.0.0",
      actual: "~1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => skips matching explicit object target", () => {
  const result = constructDepsToUpdateList({ foo: "^1.0.0" }, { foo: "^1.0.0" });
  assert.deepStrictEqual(result, []);
});

test("constructDepsToUpdateList => does not preserve strict less-than prefix", () => {
  const result = constructDepsToUpdateList({ foo: "<2.0.0" }, { foo: "3.0.0" });
  assert.deepStrictEqual(result, [
    {
      name: "foo",
      exact: "3.0.0",
      expected: "3.0.0",
      actual: "<2.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => does not preserve strict greater-than prefix", () => {
  const result = constructDepsToUpdateList({ foo: ">2.0.0" }, { foo: "3.0.0" });
  assert.deepStrictEqual(result, [
    {
      name: "foo",
      exact: "3.0.0",
      expected: "3.0.0",
      actual: ">2.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => handles multiple caret prefixes correctly", () => {
  const result = constructDepsToUpdateList({ foo: "^^1.0.0" }, { foo: "2.0.0" });
  assert.deepStrictEqual(result, [
    {
      name: "foo",
      exact: "2.0.0",
      expected: "^2.0.0", // Should only have one ^ character
      actual: "^^1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => handles multiple tilde prefixes correctly", () => {
  const result = constructDepsToUpdateList({ foo: "~~~1.0.0" }, { foo: "2.0.0" });
  assert.deepStrictEqual(result, [
    {
      name: "foo",
      exact: "2.0.0",
      expected: "~2.0.0", // Should only have one ~ character
      actual: "~~~1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => handles mixed special characters correctly", () => {
  const result = constructDepsToUpdateList({ foo: "^~^1.0.0" }, { foo: "2.0.0" });
  assert.deepStrictEqual(result, [
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
  const result = manifest.constructPermissiveDepsToUpdateList(deps, codependencies, versionMap);

  assert.deepStrictEqual(result, [
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
  const result = manifest.constructPermissiveDepsToUpdateList({}, ["react"], {});
  assert.deepStrictEqual(result, []);
});

test("constructPermissiveDepsToUpdateList => handles no codependencies", () => {
  const deps = { lodash: "^4.0.0", express: "4.18.0" };
  const versionMap = { lodash: "4.17.21", express: "4.19.0" };
  const result = manifest.constructPermissiveDepsToUpdateList(deps, [], versionMap);

  assert.deepStrictEqual(result, [
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
  assert.deepStrictEqual(result, [
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
  assert.deepStrictEqual(result, []);
});

test("constructDepsToUpdateList => with dependency not in versionMap", () => {
  const result = constructDepsToUpdateList({ bar: "1.0.0" }, { foo: "2.0.0" });
  assert.deepStrictEqual(result, []);
});

test("constructDepsToUpdateList => with same version in versionMap", () => {
  const result = constructDepsToUpdateList({ foo: "2.0.0" }, { foo: "2.0.0" });
  assert.deepStrictEqual(result, []);
});

test("constructVersionTypes => normalizes multiple special characters to a single one", () => {
  const result = constructVersionTypes("^^1.2.3");
  // Should only extract the first ^ as the bumpCharacter and remove all special characters from exactVersion
  assert.deepStrictEqual(result, {
    bumpCharacter: "^",
    bumpVersion: "^^1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => normalizes multiple tilde characters to a single one", () => {
  const result = constructVersionTypes("~~~1.2.3");
  assert.deepStrictEqual(result, {
    bumpCharacter: "~",
    bumpVersion: "~~~1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => handles mixed special characters correctly", () => {
  const result = constructVersionTypes("^~^1.2.3");
  // Should use the first character as the bumpCharacter
  assert.deepStrictEqual(result, {
    bumpCharacter: "^",
    bumpVersion: "^~^1.2.3",
    exactVersion: "1.2.3",
  });
});

test("constructVersionTypes => handles empty string", () => {
  const result = constructVersionTypes("");
  assert.deepStrictEqual(result, {
    bumpCharacter: "",
    bumpVersion: "",
    exactVersion: "",
  });
});

test("constructVersionTypes => handles version with only special characters", () => {
  const result = constructVersionTypes("^^^");
  assert.deepStrictEqual(result, {
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
  const depList = [{ name: "bar", expected: "2.0.0", actual: "1.0.0", exact: "2.0.0" }];
  const result = constructDeps(json, depName, depList);
  assert.deepStrictEqual(result, { bar: "2.0.0" });
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
  assert.strictEqual(result, undefined);
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
  assert.deepStrictEqual(result, { bar: "2.0.0", biz: "2.0.0" });
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
  assert.deepStrictEqual(result, {
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
  assert.deepStrictEqual(result, {
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
  assert.deepStrictEqual(result, {
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
  assert.deepStrictEqual(result, {
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
  assert.deepStrictEqual(result, true);
});

test("checkDependenciesForVersion => logs dependency issues as a table", () => {
  const logSpy = mock.method(console, "log", () => {});
  const versionMap = {
    "eslint-plugin-legibility": "0.3.5",
  };
  const json = {
    name: "biz",
    version: "1.0.0",
    devDependencies: { "eslint-plugin-legibility": "0.3.3" },
    path: "./test",
  };

  const result = checkDependenciesForVersion(versionMap, json, {
    isTesting: true,
  });
  const output = logSpy.mock.calls.flatMap((call) => call.arguments).join("\n");

  assert.deepStrictEqual(result, true);
  assert.ok(output.includes("┌"));
  assert.ok(output.includes("eslint-plugin-legibility"));
  assert.ok(!output.includes("1. eslint-plugin-legibility: found"));
  logSpy.mock.restore();
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
  assert.deepStrictEqual(result, true);
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
  assert.deepStrictEqual(result, false);
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
  assert.deepStrictEqual(result, false);
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
  assert.deepStrictEqual(result, true);
});

test("checkDependenciesForVersion => writes updates and logs debug info", () => {
  const debugSpy = mock.method(logger, "debug", () => {});
  const writeSpy = mock.method(fs, "writeFileSync", () => {});
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

  assert.deepStrictEqual(result, true);
  assertCalledWith(debugSpy, "checkDependenciesForVersion debug info", match.any(Object));
  assertCalledWith(debugSpy, "constructJson debug info", match.any(Object));
  assertCalledWith(writeSpy, "./debug-test.json", match.stringContaining(`"foo": "2.0.0"`));
  assertCalledWith(writeSpy, "./debug-test.json", match.stringContaining(`"optional": "2.0.0"`));

  debugSpy.mock.restore();
  writeSpy.mock.restore();
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
  assert.deepStrictEqual(result, false);
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
  assert.deepStrictEqual(result, true);
});

test("detectStaleCodependencies => no stale entries", () => {
  const codependencies = ["lodash", "fs-extra"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  const result = detectStaleCodependencies(codependencies, files, rootDir);
  assert.deepStrictEqual(result, []);
});

test("detectStaleCodependencies => stale entries found", () => {
  const codependencies = ["lodash", "fs-extra", "removed-package", "also-gone"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  const result = detectStaleCodependencies(codependencies, files, rootDir);
  assert.deepStrictEqual(result, ["removed-package", "also-gone"]);
});

test("detectStaleCodependencies => handles object-style codependencies", () => {
  const codependencies = [{ lodash: "4.17.21" }, "stale-pkg"];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  const result = detectStaleCodependencies(codependencies, files, rootDir);
  assert.deepStrictEqual(result, ["stale-pkg"]);
});

test("detectStaleCodependencies => empty codependencies returns empty", () => {
  const result = detectStaleCodependencies(
    [],
    ["test-pass-package.json"],
    "./tests/unit/fixtures/",
  );
  assert.deepStrictEqual(result, []);
});

test("detectStaleCodependencies => unreadable file treated as no deps", () => {
  const result = detectStaleCodependencies(
    ["some-package"],
    ["nonexistent-file.json"],
    "./tests/unit/fixtures/",
  );
  assert.deepStrictEqual(result, ["some-package"]);
});

test("checkMatches => no updates", () => {
  const logCheckMatchesNoUpdates = mock.method(console, "log");
  const versionMap = {
    foo: "1.0.0",
    bar: "1.0.0",
  };
  const rootDir = "./tests/unit/fixtures/";
  const isTesting = true;
  const files = ["test-pass-package.json"];
  checkMatches({ versionMap, files, isTesting, rootDir });
  assert.ok(logCheckMatchesNoUpdates.mock.callCount() > 0);
  logCheckMatchesNoUpdates.mock.restore();
});

test("checkMatches => with error", () => {
  const logCheckMatchesWithError = mock.method(console, "error");
  const versionMap = {
    lodash: "4.18.0",
    "fs-extra": "5.0.0",
  };
  const rootDir = "./tests/unit/fixtures/";
  const isTesting = true;
  const files = ["test-fail-package.json"];
  assertThrows(
    () => checkMatches({ versionMap, files, isTesting, rootDir }),
    "Dependencies are not correct.",
  );
  assert.ok(logCheckMatchesWithError.mock.callCount() > 0);
  logCheckMatchesWithError.mock.restore();
});

test("checkMatches => with updates applied", () => {
  const logSpy = mock.method(console, "log");
  const versionMap = {
    lodash: "4.18.0",
    "fs-extra": "5.0.0",
  };
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  checkMatches({ versionMap, files, rootDir, isUpdating: true, isTesting: true });
  assert.ok(logSpy.mock.callCount() > 0);
  logSpy.mock.restore();
});

test("checkMatches => logs debug output", () => {
  const debugSpy = mock.method(logger, "debug", () => {});
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

  assertCalledWith(debugSpy, "see updates", {
    packagesNeedingUpdate: [],
  });

  debugSpy.mock.restore();
});

test("checkFiles => with no updates", async () => {
  const logCheckFilesNoUpdates = mock.method(console, "log");
  const codependencies = [{ lodash: "4.17.21" }, { "fs-extra": "10.1.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files });
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  assert.ok(logCheckFilesNoUpdates.mock.callCount() > 0);
  logCheckFilesNoUpdates.mock.restore();
});

test("checkFiles => respects an explicit Node package manager", async () => {
  const result = await checkFiles({
    codependencies: [{ lodash: "^4.17.21" }, { "fs-extra": "^10.1.0" }],
    rootDir: "./tests/unit/fixtures/",
    files: ["test-pass-package.json"],
    packageManager: "bun",
    isTesting: true,
    silent: true,
  });

  assert.deepStrictEqual(result, []);
});

test("checkFiles => with updates (verbose mode)", async () => {
  const logCheckFilesWithUpdates = mock.method(console, "log");
  const codependencies = [{ lodash: "4.18.0" }, { "fs-extra": "5.0.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: false });
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  const output = logCheckFilesWithUpdates.mock.calls.flatMap((call) => call.arguments).join("\n");
  assert.ok(output.includes("Dependency Updates Available"));
  assert.ok(!output.includes("Found 2 dependency issues"));
  logCheckFilesWithUpdates.mock.restore();
});

test("checkFiles => defaults codependencies to 0.x compatible verbose mode", async () => {
  const codependencies = [{ lodash: "4.18.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  const diffs = await checkFiles({ codependencies, rootDir, files, format: "json" });

  assert.deepStrictEqual(
    diffs?.map((diff) => diff.package),
    ["lodash"],
  );
});

test("checkFiles => sets exit code for formatted CLI failures", async () => {
  const previousExitCode = process.exitCode;
  const onDeferredFailure = mock.fn();
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
      onDeferredFailure,
    });

    assert.deepStrictEqual(
      diffs?.map((diff) => diff.package),
      ["lodash"],
    );
    assert.strictEqual(onDeferredFailure.mock.callCount(), 1);
    assert.strictEqual(process.exitCode, 1);
  } finally {
    process.exitCode = previousExitCode ?? 0;
  }
});

test("checkFiles => with permissive mode only", async () => {
  const logCheckFilesPermissive = mock.method(console, "log");
  const codependencies = null;
  const getLatestVersionSpy = mock.method(
    NodeJSProvider.prototype,
    "getLatestVersion",
    async (packageName: string) => (packageName === "lodash" ? "4.18.0" : "10.1.0"),
  );
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: true } as any);
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  const output = logCheckFilesPermissive.mock.calls.flatMap((call) => call.arguments).join("\n");
  assert.ok(output.includes("Dependency Updates Available"));
  assert.ok(!output.includes("Found 2 dependency issues"));
  getLatestVersionSpy.mock.restore();
  logCheckFilesPermissive.mock.restore();
});

test("checkFiles => with permissive mode and codependencies", async () => {
  const logCheckFilesPermissiveWithCodependencies = mock.method(console, "log");
  const codependencies = [{ lodash: "4.17.21" }];
  const getLatestVersionSpy = mock.method(
    NodeJSProvider.prototype,
    "getLatestVersion",
    async (packageName: string) => (packageName === "fs-extra" ? "10.1.0" : "4.17.21"),
  );
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, permissive: true });
  } catch {
    // out-of-date deps throw in non-CLI mode
  }
  const output = logCheckFilesPermissiveWithCodependencies.mock.calls
    .flatMap((call) => call.arguments)
    .join("\n");
  assert.ok(output.includes("Dependency Updates Available"));
  assert.ok(!output.includes("Found 1 dependency issue"));
  getLatestVersionSpy.mock.restore();
  logCheckFilesPermissiveWithCodependencies.mock.restore();
});

test("checkFiles => warns on stale codependencies", async () => {
  const warnSpy = mock.method(console, "warn");
  const codependencies = [{ lodash: "4.17.21" }, { "stale-nonexistent-package": "1.0.0" }];
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
  assert.ok(warnSpy.mock.callCount() > 0);
  warnSpy.mock.restore();
});

test("checkFiles => with dryRun shows diffs", async () => {
  const logSpy = mock.method(console, "log");
  const codependencies = [{ lodash: "4.18.0" }, { "fs-extra": "5.0.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];
  try {
    await checkFiles({ codependencies, rootDir, files, dryRun: true, isTesting: true });
  } catch {
    // may throw for out-of-date deps
  }
  const output = logSpy.mock.calls.flatMap((call) => call.arguments).join("\n");
  assert.ok(output.includes("Dependency Updates Available"));
  assert.ok(output.includes("Current"));
  assert.ok(output.includes("Available"));
  assert.ok(!output.includes("Updated Dependencies"));
  assert.ok(!output.includes("Found 2 dependency issues"));
  logSpy.mock.restore();
});

test("checkFiles => with update shows dependency issue table only", async () => {
  const logSpy = mock.method(console, "log");
  const codependencies = [{ lodash: "4.18.0" }, { "fs-extra": "5.0.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-fail-package.json"];

  await checkFiles({ codependencies, rootDir, files, update: true, isTesting: true });

  const output = logSpy.mock.calls.flatMap((call) => call.arguments).join("\n");
  assert.ok(output.includes("Found 2 dependency issues"));
  assert.ok(output.includes("Updated Dependencies"));
  assert.ok(output.includes("Previous"));
  assert.ok(output.includes("Updated"));
  assert.ok(!output.includes("Dependency Updates Available"));
  logSpy.mock.restore();
});

test("checkFiles => update with no issues leaves final success to CLI", async () => {
  const logSpy = mock.method(console, "log");
  const codependencies = [{ lodash: "4.17.21" }, { "fs-extra": "10.1.0" }];
  const rootDir = "./tests/unit/fixtures/";
  const files = ["test-pass-package.json"];

  await checkFiles({ codependencies, rootDir, files, update: true, isTesting: true });

  const output = logSpy.mock.calls.flatMap((call) => call.arguments).join("\n");
  assert.ok(!output.includes("No dependency issues found"));
  logSpy.mock.restore();
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
  assert.deepStrictEqual(result, true);
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
  assert.deepStrictEqual(result, true);
});

test("constructDepsToUpdateList => respects level=minor constraint", () => {
  const dep = { foo: "^1.0.0", bar: "^1.0.0" };
  const versionMap = { foo: "1.5.0", bar: "2.0.0" };
  const result = constructDepsToUpdateList(dep, versionMap, "minor");
  assert.deepStrictEqual(result, [
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
  assert.deepStrictEqual(result, [
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
  assert.deepStrictEqual(result, [
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
  const result = manifest.constructPermissiveDepsToUpdateList(
    deps,
    codependencies,
    versionMap,
    "minor",
  );
  assert.deepStrictEqual(result, [
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
  const result = manifest.constructPermissiveDepsToUpdateList(deps, [], versionMap);
  assert.deepStrictEqual(result, [
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
  const result = manifest.constructPermissiveDepsToUpdateList(deps, codependencies, versionMap);

  assert.deepStrictEqual(result, [
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

test("constructPermissiveDepsToUpdateList => compares explicit latest specs", () => {
  const result = manifest.constructPermissiveDepsToUpdateList({ lodash: "4.17.0" }, [], {
    lodash: "=4.17.21",
  });

  assert.deepStrictEqual(result, [
    {
      name: "lodash",
      actual: "4.17.0",
      exact: "4.17.21",
      expected: "=4.17.21",
    },
  ]);
});

test("filterSelectedDeps => no packages selected", () => {
  const result = filterSelectedDeps([], ["lodash", "react"], { lodash: "4.18.0", react: "18.0.0" });
  assert.strictEqual(result.shouldUpdate, false);
  assert.deepStrictEqual(result.depNames, ["lodash", "react"]);
});

test("filterSelectedDeps => packages selected", () => {
  const result = filterSelectedDeps(["lodash"], ["lodash", "react"], {
    lodash: "4.18.0",
    react: "18.0.0",
  });
  assert.strictEqual(result.shouldUpdate, true);
  assert.deepStrictEqual(result.depNames, ["lodash"]);
  assert.deepStrictEqual(result.versionMap, { lodash: "4.18.0" });
});

test("checkFiles => throws when no codependencies and not precise mode", async () => {
  await assert.rejects(
    checkFiles({
      codependencies: undefined,
      permissive: false,
      rootDir: "./tests/unit/fixtures/",
      files: ["test-pass-package.json"],
    } as never),
    (error) => {
      assert.match(String(error), /codependencies/);
      return true;
    },
  );
});

test("checkFiles => defaults to precise mode without codependencies", async () => {
  const latestVersionSpy = mock.method(
    NodeJSProvider.prototype,
    "getLatestVersion",
    async (name) => (name === "lodash" ? "4.17.21" : "10.1.0"),
  );

  try {
    const result = await checkFiles({
      rootDir: "./tests/unit/fixtures/",
      files: ["test-pass-package.json"],
      silent: true,
    });

    assert.deepStrictEqual(result, []);
  } finally {
    latestVersionSpy.mock.restore();
  }
});

test("checkFiles => interactive mode invokes prompt selection", async () => {
  const selectSpy = mock.method(Prompt.prototype, "select", async () => []);
  const closeSpy = mock.method(Prompt.prototype, "close");
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
  assert.ok(selectSpy.mock.callCount() > 0);
  selectSpy.mock.restore();
  closeSpy.mock.restore();
});

test("checkFiles => skips interactive prompt when nothing needs updating", async () => {
  const tempDir = createTestDirectory();
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

  const selectSpy = mock.method(Prompt.prototype, "select", async () => ["lodash"]);
  const closeSpy = mock.method(Prompt.prototype, "close");

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ lodash: "2.0.0" }],
        rootDir: tempDir,
        files: ["package.json"],
        interactive: true,
        update: true,
        permissive: false,
        isTesting: false,
        level: "patch",
      }),
      [
        {
          current: "1.0.0",
          installed: "2.0.0",
          isPinned: true,
          latest: "2.0.0",
          package: "lodash",
          willUpdate: false,
        },
      ],
    );
    assert.strictEqual(selectSpy.mock.callCount(), 0);
  } finally {
    selectSpy.mock.restore();
    closeSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => falls back to explicit language provider when no manifests match", async () => {
  const tempDir = createTestDirectory();
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
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ lodash: "4.17.21" }],
        rootDir: tempDir,
        files: ["missing-package.json"],
        language: "nodejs",
        permissive: false,
        isTesting: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => handles rootDir without trailing slash", async () => {
  const tempDir = createTestDirectory();
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

  const logSpy = mock.method(console, "log");
  try {
    await checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      rootDir: tempDir,
      permissive: false,
      isTesting: true,
    });
  } finally {
    assert.ok(logSpy.mock.callCount() > 0);
    logSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => applies provider-backed manifest updates", async () => {
  const tempDir = createTestDirectory();
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

  const debugSpy = mock.method(logger, "debug", () => {});

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

    const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      dependencies: Record<string, string>;
    };

    assert.strictEqual(updatedPackageJson.dependencies.lodash, "4.17.21");
    assertCalledWith(debugSpy, "checkManifestDependenciesForVersion debug info", match.any(Object));
    assertCalledWith(debugSpy, "see updates", {
      packagesNeedingUpdate: ["package.json"],
    });
  } finally {
    debugSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => logs manifest writes in testing update mode", async () => {
  const tempDir = createTestDirectory();
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

  const infoSpy = mock.method(logger, "info", () => {});

  try {
    await checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      rootDir: tempDir,
      files: ["package.json"],
      update: true,
      permissive: false,
      isTesting: true,
    });

    assertCalledWith(infoSpy, `test-writeFileSync: ${packageJsonPath}`);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(packageJsonPath, "utf8")), {
      name: "provider-update-testing",
      version: "1.0.0",
      dependencies: {
        lodash: "4.17.0",
      },
    });
  } finally {
    infoSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects python manifests", async () => {
  const tempDir = createTestDirectory();
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "requirements.txt"), "requests==2.28.0\nflask==2.0.0\n");

  const logSpy = mock.method(console, "log");
  try {
    await checkFiles({
      codependencies: [{ requests: "==2.28.0" }],
      rootDir: tempDir,
      permissive: false,
      isTesting: true,
    });
  } finally {
    assert.ok(logSpy.mock.callCount() > 0);
    logSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => respects explicit go language", async () => {
  const tempDir = createTestDirectory();
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

  const logSpy = mock.method(console, "log");
  try {
    await checkFiles({
      codependencies: [{ "github.com/gin-gonic/gin": "v1.9.0" }],
      rootDir: tempDir,
      language: "go",
      permissive: false,
      isTesting: true,
    });
  } finally {
    assert.ok(logSpy.mock.callCount() > 0);
    logSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects rust manifests", async () => {
  const tempDir = createTestDirectory();
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    join(tempDir, "Cargo.toml"),
    '[package]\nname = "rust-detect"\n\n[dependencies]\nserde = "1.0.190"\n',
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ serde: "1.0.190" }],
        rootDir: tempDir,
        files: ["Cargo.toml"],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates rust manifests with normalized package names", async () => {
  const tempDir = createTestDirectory();
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
    assert.ok(updated.includes('serde_json = "1.0.145"'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects Docker manifests", async () => {
  const tempDir = createTestDirectory();
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "Dockerfile"), "FROM node:20.11.1\n");

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ node: "20.11.1" }],
        rootDir: tempDir,
        files: ["Dockerfile"],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => discovers suffixed Dockerfiles by default", async () => {
  const tempDir = createTestDirectory();
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "Dockerfile.gcp"), "FROM node:20.11.1\n");

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ node: "20.11.1" }],
        rootDir: tempDir,
        language: "docker",
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => ignores generated manifests by default", async () => {
  const tempDir = createTestDirectory();
  const nextDir = join(tempDir, ".next", "build");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(nextDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(join(nextDir, "package.json"), '{"dependencies":{"lodash":"4.17.0"}}\n');

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ lodash: "4.17.21" }],
        rootDir: tempDir,
        files: ["**/package.json"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => explicit ignore patterns replace compatibility defaults", async () => {
  const tempDir = createTestDirectory();
  const nextDir = join(tempDir, ".next", "build");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(nextDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(join(nextDir, "package.json"), '{"dependencies":{"lodash":"4.17.0"}}\n');

  try {
    const diffs = await checkFiles({
      codependencies: [{ lodash: "4.17.21" }],
      rootDir: tempDir,
      files: ["**/package.json"],
      ignore: ["**/dist/**"],
      mode: "verbose",
      format: "json",
      isTesting: true,
      silent: true,
    });

    assert.deepStrictEqual(
      diffs?.map((diff) => diff.package),
      ["lodash"],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => supports Docker precise mode", async () => {
  const tempDir = createTestDirectory();
  const dockerfilePath = join(tempDir, "Dockerfile");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(dockerfilePath, "FROM node:20.11.1\n");
  const latestVersionSpy = mock.method(
    DockerProvider.prototype,
    "getLatestVersion",
    async () => "24.0.0",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        rootDir: tempDir,
        files: ["Dockerfile"],
        mode: "precise",
        update: true,
        silent: true,
      }),
      [],
    );
    assertCalledWith(latestVersionSpy, "node", "20.11.1");
    assert.strictEqual(readFileSync(dockerfilePath, "utf8"), "FROM node:24.0.0\n");
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => supports Docker string codependencies", async () => {
  const tempDir = createTestDirectory();
  const dockerfilePath = join(tempDir, "Dockerfile");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(dockerfilePath, "FROM node:20.11.1\n");
  const latestVersionSpy = mock.method(
    DockerProvider.prototype,
    "getLatestVersion",
    async () => "24.0.0",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: ["node"],
        rootDir: tempDir,
        files: ["Dockerfile"],
        mode: "verbose",
        update: true,
        silent: true,
      }),
      [],
    );
    assert.strictEqual(readFileSync(dockerfilePath, "utf8"), "FROM node:24.0.0\n");
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => resolves Docker string codependencies in Node roots", async () => {
  const tempDir = createTestDirectory();
  const dockerfilePath = join(tempDir, "Dockerfile");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(dockerfilePath, "FROM node:20.11.1\n");
  const latestVersionSpy = mock.method(
    DockerProvider.prototype,
    "getLatestVersion",
    async () => "24.0.0",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: ["node"],
        rootDir: tempDir,
        files: ["Dockerfile"],
        mode: "verbose",
        update: true,
        silent: true,
      }),
      [],
    );
    assert.strictEqual(readFileSync(dockerfilePath, "utf8"), "FROM node:24.0.0\n");
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => resolves multiple current Docker tags independently", async () => {
  const tempDir = createTestDirectory();
  const dockerfilePath = join(tempDir, "Dockerfile");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(dockerfilePath, "FROM node:20-slim\nFROM node:20-alpine\n");
  const latestVersionSpy = mock.method(
    DockerProvider.prototype,
    "getLatestVersion",
    async (_name, currentVersion) => {
      if (currentVersion === "20-slim") return "24-slim";
      return "24-alpine";
    },
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: ["node"],
        rootDir: tempDir,
        files: ["Dockerfile"],
        mode: "verbose",
        update: true,
        silent: true,
      }),
      [],
    );
    assertCalledWith(latestVersionSpy, "node", "20-slim");
    assertCalledWith(latestVersionSpy, "node", "20-alpine");
    assert.strictEqual(
      readFileSync(dockerfilePath, "utf8"),
      "FROM node:24-slim\nFROM node:24-alpine\n",
    );
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates Helm chart dependency pins", async () => {
  const tempDir = createTestDirectory();
  const chartPath = join(tempDir, "Chart.yaml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    chartPath,
    `apiVersion: v2
name: web
version: 1.0.0
dependencies:
  - name: redis
    version: 20.6.3
    repository: https://charts.bitnami.com/bitnami
`,
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ redis: "20.7.0" }],
        rootDir: tempDir,
        files: ["Chart.yaml"],
        mode: "verbose",
        update: true,
        silent: true,
      }),
      [],
    );
    assert.strictEqual(
      readFileSync(chartPath, "utf8"),
      `apiVersion: v2
name: web
version: 1.0.0
dependencies:
  - name: redis
    version: 20.7.0
    repository: https://charts.bitnami.com/bitnami
`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates Helm values image pins", async () => {
  const tempDir = createTestDirectory();
  const valuesPath = join(tempDir, "values.yaml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    valuesPath,
    `image:
  repository: nginx
  tag: 1.27.0
`,
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ nginx: "1.27.1" }],
        files: ["values.yaml"],
        mode: "verbose",
        rootDir: tempDir,
        silent: true,
        update: true,
      }),
      [],
    );
    assert.strictEqual(
      readFileSync(valuesPath, "utf8"),
      "image:\n  repository: nginx\n  tag: 1.27.1\n",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates CircleCI orb and image pins", async () => {
  const tempDir = createTestDirectory();
  const configDir = join(tempDir, ".circleci");
  const configPath = join(configDir, "config.yml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    configPath,
    "orbs:\n  node: circleci/node@7.1.0\njobs:\n  test:\n    docker:\n      - image: cimg/node:22.11\n",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ "circleci/node": "7.2.0" }, { "cimg/node": "22.12" }],
        files: [".circleci/config.yml"],
        language: "circleci",
        mode: "verbose",
        rootDir: tempDir,
        silent: true,
        update: true,
      }),
      [],
    );
    assert.ok(readFileSync(configPath, "utf8").includes("circleci/node@7.2.0"));
    assert.ok(readFileSync(configPath, "utf8").includes("cimg/node:22.12"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects CircleCI config paths", async () => {
  const tempDir = createTestDirectory();
  const configDir = join(tempDir, ".circleci");
  const configPath = join(configDir, "config.yml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, "orbs:\n  node: circleci/node@7.1.0\n");

  try {
    await checkFiles({
      codependencies: [{ "circleci/node": "7.2.0" }],
      files: [".circleci/config.yml"],
      rootDir: tempDir,
      silent: true,
      update: true,
    });

    assert.ok(readFileSync(configPath, "utf8").includes("circleci/node@7.2.0"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates Kubernetes image pins", async () => {
  const tempDir = createTestDirectory();
  const manifestPath = join(tempDir, "deployment.yaml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(manifestPath, "containers:\n  - name: app\n    image: ghcr.io/acme/web:2.4.0\n");

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ "ghcr.io/acme/web": "2.5.0" }],
        files: ["deployment.yaml"],
        language: "kubernetes",
        mode: "verbose",
        rootDir: tempDir,
        silent: true,
        update: true,
      }),
      [],
    );
    assert.ok(readFileSync(manifestPath, "utf8").includes("ghcr.io/acme/web:2.5.0"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates Kustomize image pins", async () => {
  const tempDir = createTestDirectory();
  const manifestPath = join(tempDir, "kustomization.yaml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(manifestPath, "images:\n  - name: nginx\n    newTag: 1.27.0\n");

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ nginx: "1.27.1" }],
        files: ["kustomization.yaml"],
        language: "kustomize",
        mode: "verbose",
        rootDir: tempDir,
        silent: true,
        update: true,
      }),
      [],
    );
    assert.ok(readFileSync(manifestPath, "utf8").includes("newTag: 1.27.1"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates Terraform provider and module pins", async () => {
  const tempDir = createTestDirectory();
  const manifestPath = join(tempDir, "main.tf");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    manifestPath,
    `terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "5.30.0"
    }
  }
}

module "app" {
  source = "git::https://github.com/acme/app.git?ref=v1.2.3"
}
`,
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ "hashicorp/aws": "5.31.0" }, { "github.com/acme/app": "v1.2.4" }],
        files: ["main.tf"],
        language: "terraform",
        mode: "verbose",
        rootDir: tempDir,
        silent: true,
        update: true,
      }),
      [],
    );
    const content = readFileSync(manifestPath, "utf8");
    assert.ok(content.includes('version = "5.31.0"'));
    assert.ok(content.includes("github.com/acme/app.git?ref=v1.2.4"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => scopes Docker version cache by current tag", async () => {
  const tempDir = createTestDirectory();
  const slimDir = join(tempDir, "slim");
  const alpineDir = join(tempDir, "alpine");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(slimDir, { recursive: true });
  mkdirSync(alpineDir, { recursive: true });
  writeFileSync(join(slimDir, "Dockerfile"), "FROM node:20-slim\n");
  writeFileSync(join(alpineDir, "Dockerfile"), "FROM node:20-alpine\n");
  const latestVersionSpy = mock.method(
    DockerProvider.prototype,
    "getLatestVersion",
    async (_name, currentVersion) => {
      if (currentVersion === "20-slim") return "24-slim";
      return "24-alpine";
    },
  );

  try {
    const options = {
      codependencies: ["node"],
      files: ["Dockerfile"],
      silent: true,
      update: true,
    };
    await checkFiles({ ...options, rootDir: slimDir });
    await checkFiles({ ...options, rootDir: alpineDir });
    assert.strictEqual(latestVersionSpy.mock.callCount(), 2);
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects GitHub Actions manifests", async () => {
  const tempDir = createTestDirectory();
  const workflowDir = join(tempDir, ".github", "workflows");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    join(workflowDir, "ci.yml"),
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ "actions/checkout": "v4" }],
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => supports GitHub Actions precise mode", async () => {
  const tempDir = createTestDirectory();
  const workflowDir = join(tempDir, ".github", "workflows");
  const workflowPath = join(workflowDir, "ci.yml");
  const currentSha = "1".repeat(40);
  const latestSha = "2".repeat(40);
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    workflowPath,
    `name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@${currentSha}\n`,
  );
  const latestVersionSpy = mock.method(
    GitHubActionsProvider.prototype,
    "getLatestVersion",
    async () => latestSha,
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        mode: "precise",
        update: true,
        silent: true,
      }),
      [],
    );
    assert.ok(readFileSync(workflowPath, "utf8").includes(`uses: actions/checkout@${latestSha}`));
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => updates every repeated GitHub Action ref", async () => {
  const tempDir = createTestDirectory();
  const workflowDir = join(tempDir, ".github", "workflows");
  const workflowPath = join(workflowDir, "ci.yml");
  const staleSha = "1".repeat(40);
  const latestSha = "2".repeat(40);
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    workflowPath,
    `jobs:
  lint:
    steps:
      - uses: actions/checkout@${staleSha}
  test:
    steps:
      - uses: actions/checkout@${latestSha}
`,
  );
  const latestVersionSpy = mock.method(
    GitHubActionsProvider.prototype,
    "getLatestVersion",
    async () => latestSha,
  );

  try {
    await checkFiles({
      rootDir: tempDir,
      files: [".github/workflows/ci.yml"],
      mode: "precise",
      update: true,
      silent: true,
    });

    const updated = readFileSync(workflowPath, "utf8");
    assert.ok(!updated.includes(staleSha));
    assert.strictEqual(updated.match(new RegExp(latestSha, "g")).length, 2);
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => supports GitHub Actions string codependencies", async () => {
  const tempDir = createTestDirectory();
  const workflowDir = join(tempDir, ".github", "workflows");
  const workflowPath = join(workflowDir, "ci.yml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    workflowPath,
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );
  const latestVersionSpy = mock.method(
    GitHubActionsProvider.prototype,
    "getLatestVersion",
    async () => "v5",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: ["actions/checkout"],
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        mode: "verbose",
        update: true,
        silent: true,
      }),
      [],
    );
    assert.ok(readFileSync(workflowPath, "utf8").includes("uses: actions/checkout@v5"));
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => resolves GitHub Actions dependencies in Node roots", async () => {
  const tempDir = createTestDirectory();
  const workflowDir = join(tempDir, ".github", "workflows");
  const workflowPath = join(workflowDir, "ci.yml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(
    workflowPath,
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );
  const latestVersionSpy = mock.method(
    GitHubActionsProvider.prototype,
    "getLatestVersion",
    async () => "v5",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: ["actions/checkout"],
        rootDir: tempDir,
        files: [".github/workflows/ci.yml"],
        mode: "verbose",
        update: true,
        silent: true,
      }),
      [],
    );
    assert.ok(readFileSync(workflowPath, "utf8").includes("uses: actions/checkout@v5"));
  } finally {
    latestVersionSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => auto-detects absolute GitHub Actions manifest paths", async () => {
  const tempDir = createTestDirectory();
  const workflowDir = join(tempDir, ".github", "workflows");
  const workflowPath = join(workflowDir, "ci.yml");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    workflowPath,
    "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
  );

  try {
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ "actions/checkout": "v4" }],
        rootDir: process.cwd(),
        files: [workflowPath],
        permissive: false,
        isTesting: true,
        silent: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects mixed-provider precise mode", async () => {
  const tempDir = createTestDirectory();
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(
    join(tempDir, "Cargo.toml"),
    '[package]\nname = "mixed-provider"\n\n[dependencies]\nserde = "1.0.0"\n',
  );

  try {
    await assertRejects(
      checkFiles({
        rootDir: tempDir,
        files: ["package.json", "Cargo.toml"],
        mode: "precise",
        isTesting: true,
        silent: true,
      }),
      "Latest resolution currently supports one provider",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => rejects mixed-provider string codependencies", async () => {
  const tempDir = createTestDirectory();
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), '{"dependencies":{"lodash":"4.17.21"}}\n');
  writeFileSync(
    join(tempDir, "Cargo.toml"),
    '[package]\nname = "mixed-provider"\n\n[dependencies]\nserde = "1.0.0"\n',
  );

  try {
    await assertRejects(
      checkFiles({
        codependencies: ["lodash"],
        rootDir: tempDir,
        files: ["package.json", "Cargo.toml"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
      "Latest resolution currently supports one provider",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => allows mixed-provider explicit pins", async () => {
  const tempDir = createTestDirectory();
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
    await assert.deepStrictEqual(
      await checkFiles({
        codependencies: [{ lodash: "4.17.21" }, { alpine: "3.20" }, { "actions/checkout": "v4" }],
        rootDir: tempDir,
        files: ["package.json", "Dockerfile", ".github/workflows/ci.yml"],
        mode: "verbose",
        isTesting: true,
        silent: true,
      }),
      [],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkFiles => logs thrown errors in debug mode", async () => {
  const tempDir = createTestDirectory();
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "package.json"), "{ invalid json");

  const debugSpy = mock.method(logger, "debug", () => {});
  try {
    await assertRejects(
      checkFiles({
        codependencies: [{ lodash: "4.17.21" }],
        rootDir: tempDir,
        files: ["package.json"],
        debug: true,
        permissive: false,
        isTesting: true,
      }),
    );
    assertCalledWith(debugSpy, match.stringContaining("SyntaxError"));
  } finally {
    debugSpy.mock.restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
