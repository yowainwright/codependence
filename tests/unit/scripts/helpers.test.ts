import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertRejects, assertThrows } from "../../helpers/assertions";
import {
  resolveObjectDep,
  validateStringDep,
  resolveFromCache,
  resolveFromRegistry,
  buildUpdateLists,
  filterSelectedDeps,
} from "../../../src/scripts";
import { versionCache } from "../../../src/utils/cache";

describe("resolveObjectDep", () => {
  test("returns object with exactly one key", () => {
    const dep = { react: "18.0.0" };
    assert.deepStrictEqual((resolveObjectDep(dep)), { react: "18.0.0" });
  });

  test("returns null for object with zero keys", () => {
    assert.strictEqual((resolveObjectDep({})), null);
  });

  test("returns null for object with multiple keys", () => {
    const dep = { react: "18.0.0", lodash: "4.0.0" };
    assert.strictEqual((resolveObjectDep(dep)), null);
  });
});

describe("validateStringDep", () => {
  const validValidator = mock.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));

  const invalidValidator = mock.fn(() => ({
    validForNewPackages: false,
    validForOldPackages: false,
    errors: ["bad name"],
  }));

  test("throws for single character dep", () => {
    assertThrows((() => validateStringDep("a", validValidator)), "invalid item type");
  });

  test("throws for dep with spaces", () => {
    assertThrows((() => validateStringDep("foo bar", validValidator)), "invalid item type");
  });

  test("throws for empty string", () => {
    assertThrows((() => validateStringDep("", validValidator)), "invalid item type");
  });

  test("does not throw for valid dep name", () => {
    assert.doesNotThrow((() => validateStringDep("lodash", validValidator)));
  });

  test("throws when validator rejects package name", () => {
    assertThrows((() => validateStringDep("lodash", invalidValidator)));
  });

  test("calls validate with the dep name", () => {
    validValidator.mock.resetCalls();
    validateStringDep("react", validValidator);
    assertCalledWith((validValidator), "react");
  });
});

describe("resolveFromCache", () => {
  beforeEach(() => {
    versionCache.clear();
  });

  test("returns null when noCache is true", () => {
    versionCache.set("npm:lodash", "4.17.21");
    assert.strictEqual((resolveFromCache("npm:lodash", true)), null);
  });

  test("returns null when key is not cached", () => {
    assert.strictEqual((resolveFromCache("npm:missing", false)), null);
  });

  test("returns cached version when available", () => {
    versionCache.set("npm:lodash", "4.17.21");
    assert.strictEqual((resolveFromCache("npm:lodash", false)), "4.17.21");
  });
});

describe("resolveFromRegistry", () => {
  test("resolves npm version from stdout", async () => {
    const mockExec = mock.fn(() => ({ stdout: "4.17.21\n", stderr: "" })) as any;
    const result = await resolveFromRegistry("lodash", false, mockExec);
    assert.strictEqual((result), "4.17.21");
    assertCalledWith((mockExec), "npm", ["view", "lodash", "version", "latest"]);
  });

  test("resolves yarn version from JSON stdout", async () => {
    const mockExec = mock.fn(() => ({
      stdout: '{"version":"4.17.21"}\n',
      stderr: "",
    })) as any;
    const result = await resolveFromRegistry("lodash", true, mockExec);
    assert.strictEqual((result), "4.17.21");
    assertCalledWith((mockExec), "yarn", [
      "npm",
      "info",
      "lodash",
      "--fields",
      "version",
      "--json",
    ]);
  });

  test("throws when no version found", async () => {
    const mockExec = mock.fn(() => ({ stdout: "", stderr: "" })) as any;
    await assertRejects(resolveFromRegistry("ghost-pkg", false, mockExec), "No version found for ghost-pkg");
  });
});

describe("buildUpdateLists", () => {
  test("returns update lists for standard mode", () => {
    const versionMap = { react: "18.3.0", lodash: "4.17.21" };
    const json = {
      name: "test",
      version: "1.0.0",
      path: "./test",
      dependencies: { react: "18.0.0" },
      devDependencies: { lodash: "4.0.0" },
    };
    const options = { level: "major" as const };

    const result = buildUpdateLists(versionMap, json, options);

    assert.strictEqual((result.depList).length, 1);
    assert.strictEqual((result.depList[0].name), "react");
    assert.strictEqual((result.devDepList).length, 1);
    assert.strictEqual((result.devDepList[0].name), "lodash");
    assert.strictEqual((result.peerDepList).length, 0);
  });

  test("returns update lists for permissive mode", () => {
    const versionMap = { react: "18.3.0", lodash: "4.17.21" };
    const json = {
      name: "test",
      version: "1.0.0",
      path: "./test",
      dependencies: { react: "^18.0.0", lodash: "^4.0.0" },
    };
    const codependencies = ["react"];
    const options = { permissive: true, level: "major" as const };

    const result = buildUpdateLists(versionMap, json, options, codependencies);

    assert.strictEqual((result.depList).length, 1);
    assert.strictEqual((result.depList[0].name), "lodash");
  });

  test("respects level constraint", () => {
    const versionMap = { react: "19.0.0", lodash: "4.17.21" };
    const json = {
      name: "test",
      version: "1.0.0",
      path: "./test",
      dependencies: { react: "^18.0.0", lodash: "^4.0.0" },
    };
    const options = { level: "minor" as const };

    const result = buildUpdateLists(versionMap, json, options);

    assert.strictEqual((result.depList).length, 1);
    assert.strictEqual((result.depList[0].name), "lodash");
  });

  test("returns empty lists when no updates needed", () => {
    const versionMap = { react: "18.0.0" };
    const json = {
      name: "test",
      version: "1.0.0",
      path: "./test",
      dependencies: { react: "18.0.0" },
    };
    const options = {};

    const result = buildUpdateLists(versionMap, json, options);

    assert.strictEqual((result.depList).length, 0);
    assert.strictEqual((result.devDepList).length, 0);
    assert.strictEqual((result.peerDepList).length, 0);
  });

  test("handles missing dependency sections", () => {
    const versionMap = { react: "18.3.0" };
    const json = {
      name: "test",
      version: "1.0.0",
      path: "./test",
    };
    const options = {};

    const result = buildUpdateLists(versionMap, json, options);

    assert.strictEqual((result.depList).length, 0);
    assert.strictEqual((result.devDepList).length, 0);
    assert.strictEqual((result.peerDepList).length, 0);
  });

  test("handles peerDependencies", () => {
    const versionMap = { react: "18.3.0" };
    const json = {
      name: "test",
      version: "1.0.0",
      path: "./test",
      peerDependencies: { react: "18.0.0" },
    };
    const options = {};

    const result = buildUpdateLists(versionMap, json, options);

    assert.strictEqual((result.peerDepList).length, 1);
    assert.strictEqual((result.peerDepList[0].name), "react");
  });
});

describe("filterSelectedDeps", () => {
  test("returns shouldUpdate false when nothing selected", () => {
    const result = filterSelectedDeps([], ["react", "lodash"], {
      react: "18.0.0",
      lodash: "4.0.0",
    });

    assert.strictEqual((result.shouldUpdate), false);
    assert.deepStrictEqual((result.depNames), ["react", "lodash"]);
  });

  test("filters to only selected deps", () => {
    const result = filterSelectedDeps(["react"], ["react", "lodash"], {
      react: "18.0.0",
      lodash: "4.0.0",
    });

    assert.strictEqual((result.shouldUpdate), true);
    assert.deepStrictEqual((result.depNames), ["react"]);
    assert.deepStrictEqual((result.versionMap), { react: "18.0.0" });
  });

  test("filters out deps not in depNames", () => {
    const result = filterSelectedDeps(["react", "vue"], ["react", "lodash"], {
      react: "18.0.0",
      lodash: "4.0.0",
    });

    assert.deepStrictEqual((result.depNames), ["react"]);
    assert.deepStrictEqual((result.versionMap), { react: "18.0.0" });
  });

  test("handles all deps selected", () => {
    const result = filterSelectedDeps(["react", "lodash"], ["react", "lodash"], {
      react: "18.0.0",
      lodash: "4.0.0",
    });

    assert.strictEqual((result.shouldUpdate), true);
    assert.deepStrictEqual((result.depNames), ["react", "lodash"]);
    assert.deepStrictEqual((result.versionMap), { react: "18.0.0", lodash: "4.0.0" });
  });
});
