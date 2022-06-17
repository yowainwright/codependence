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
