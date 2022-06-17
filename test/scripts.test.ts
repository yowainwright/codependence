import { expect, test, vi } from "vitest";

import {
  execPromise,
  constructVersionMap,
  constructVersionTypes,
  constructDepsToUpdateList,
  writeConsoleMsgs,
  constructDeps,
  constructJson,
  checkDependenciesForVersion,
  checkMatches,
  checkFiles,
} from "../src/scripts";

vi.mock("../src/script", () => {
  const scripts = {
    execPromise: vi.fn(),
  };
  return scripts;
});

const log = vi.spyOn(console, "log");

test("execPromise", async () => {
  const { stdout = "" } = (await execPromise(
    "npm view lodash version latest"
  )) as unknown as Record<string, string>;
  expect(stdout.split(".").length).toEqual(3);
});

test("constructVersionMap => pass", async () => {
  const exec = vi.fn(() => ({
    stdout: "4.0.0",
    stderr: "",
  })) as any;
  const result = await constructVersionMap(["lodash"], exec);
  expect(result).toEqual({ lodash: "4.0.0" });
});

test("constructVersionMap => fail", async () => {
  const exec = vi.fn(() => ({
    stdout: "",
    stderr: "",
  })) as any;
  const result = await constructVersionMap(["lodash"], exec);
  expect(result).toEqual({});
});

test("constructVersionMap => fail", async () => {
  const exec = vi.fn(() => ({
    stdout: "",
    stderr: "",
  })) as any;
  const result = await constructVersionMap(["lodash"], exec);
  expect(result).toEqual({});
});

test("constructVersionTypes => with ^", () => {
  const result = constructVersionTypes("^1.2.3");
  expect(result).toEqual({ bumpVersion: "^1.2.3", exactVersion: "1.2.3" });
});

test("constructVersionTypes with no specifier", () => {
  const { bumpVersion, exactVersion } = constructVersionTypes("1.2.3");
  expect(bumpVersion).toEqual(exactVersion);
});

test("constructDepsToUpdateList => returns dep to update list", () => {
  const result = constructDepsToUpdateList({ foo: "1.0.0" }, { foo: "2.0.0" });
  expect(result).toEqual([
    {
      name: "foo",
      exact: "1.0.0",
      expected: "2.0.0",
      actual: "1.0.0",
    },
  ]);
});

test("constructDepsToUpdateList => returns empty b/c no updates required", () => {
  const result = constructDepsToUpdateList({ foo: "1.0.0" }, { foo: "1.0.0" });
  expect(result).toEqual([]);
});

test("writeConsoleMsgs => should call log", () => {
  writeConsoleMsgs("foo", [
    { name: "foo", expected: "1.0.0", actual: "2.0.0" },
  ]);
  expect(log).toHaveBeenCalledTimes(1);
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
  const depList = [];
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
  vi.clearAllMocks();
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
