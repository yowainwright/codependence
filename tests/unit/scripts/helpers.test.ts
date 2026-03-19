import { describe, test, expect, jest, beforeEach } from "bun:test";
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
    expect(resolveObjectDep(dep)).toEqual({ react: "18.0.0" });
  });

  test("returns null for object with zero keys", () => {
    expect(resolveObjectDep({})).toBeNull();
  });

  test("returns null for object with multiple keys", () => {
    const dep = { react: "18.0.0", lodash: "4.0.0" };
    expect(resolveObjectDep(dep)).toBeNull();
  });
});

describe("validateStringDep", () => {
  const validValidator = jest.fn(() => ({
    validForNewPackages: true,
    validForOldPackages: true,
    errors: [],
  }));

  const invalidValidator = jest.fn(() => ({
    validForNewPackages: false,
    validForOldPackages: false,
    errors: ["bad name"],
  }));

  test("throws for single character dep", () => {
    expect(() => validateStringDep("a", validValidator)).toThrow("invalid item type");
  });

  test("throws for dep with spaces", () => {
    expect(() => validateStringDep("foo bar", validValidator)).toThrow("invalid item type");
  });

  test("throws for empty string", () => {
    expect(() => validateStringDep("", validValidator)).toThrow("invalid item type");
  });

  test("does not throw for valid dep name", () => {
    expect(() => validateStringDep("lodash", validValidator)).not.toThrow();
  });

  test("throws when validator rejects package name", () => {
    expect(() => validateStringDep("lodash", invalidValidator)).toThrow();
  });

  test("calls validate with the dep name", () => {
    validValidator.mockClear();
    validateStringDep("react", validValidator);
    expect(validValidator).toHaveBeenCalledWith("react");
  });
});

describe("resolveFromCache", () => {
  beforeEach(() => {
    versionCache.clear();
  });

  test("returns null when noCache is true", () => {
    versionCache.set("npm:lodash", "4.17.21");
    expect(resolveFromCache("npm:lodash", true)).toBeNull();
  });

  test("returns null when key is not cached", () => {
    expect(resolveFromCache("npm:missing", false)).toBeNull();
  });

  test("returns cached version when available", () => {
    versionCache.set("npm:lodash", "4.17.21");
    expect(resolveFromCache("npm:lodash", false)).toBe("4.17.21");
  });
});

describe("resolveFromRegistry", () => {
  test("resolves npm version from stdout", async () => {
    const mockExec = jest.fn(() => ({ stdout: "4.17.21\n", stderr: "" })) as any;
    const result = await resolveFromRegistry("lodash", false, mockExec);
    expect(result).toBe("4.17.21");
    expect(mockExec).toHaveBeenCalledWith("npm", ["view", "lodash", "version", "latest"]);
  });

  test("resolves yarn version from JSON stdout", async () => {
    const mockExec = jest.fn(() => ({
      stdout: '{"version":"4.17.21"}\n',
      stderr: "",
    })) as any;
    const result = await resolveFromRegistry("lodash", true, mockExec);
    expect(result).toBe("4.17.21");
    expect(mockExec).toHaveBeenCalledWith("yarn", [
      "npm", "info", "lodash", "--fields", "version", "--json",
    ]);
  });

  test("throws when no version found", async () => {
    const mockExec = jest.fn(() => ({ stdout: "", stderr: "" })) as any;
    await expect(resolveFromRegistry("ghost-pkg", false, mockExec)).rejects.toThrow(
      "No version found for ghost-pkg",
    );
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

    expect(result.depList).toHaveLength(1);
    expect(result.depList[0].name).toBe("react");
    expect(result.devDepList).toHaveLength(1);
    expect(result.devDepList[0].name).toBe("lodash");
    expect(result.peerDepList).toHaveLength(0);
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

    expect(result.depList).toHaveLength(1);
    expect(result.depList[0].name).toBe("lodash");
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

    expect(result.depList).toHaveLength(1);
    expect(result.depList[0].name).toBe("lodash");
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

    expect(result.depList).toHaveLength(0);
    expect(result.devDepList).toHaveLength(0);
    expect(result.peerDepList).toHaveLength(0);
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

    expect(result.depList).toHaveLength(0);
    expect(result.devDepList).toHaveLength(0);
    expect(result.peerDepList).toHaveLength(0);
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

    expect(result.peerDepList).toHaveLength(1);
    expect(result.peerDepList[0].name).toBe("react");
  });
});

describe("filterSelectedDeps", () => {
  test("returns shouldUpdate false when nothing selected", () => {
    const result = filterSelectedDeps(
      [],
      ["react", "lodash"],
      { react: "18.0.0", lodash: "4.0.0" },
    );

    expect(result.shouldUpdate).toBe(false);
    expect(result.depNames).toEqual(["react", "lodash"]);
  });

  test("filters to only selected deps", () => {
    const result = filterSelectedDeps(
      ["react"],
      ["react", "lodash"],
      { react: "18.0.0", lodash: "4.0.0" },
    );

    expect(result.shouldUpdate).toBe(true);
    expect(result.depNames).toEqual(["react"]);
    expect(result.versionMap).toEqual({ react: "18.0.0" });
  });

  test("filters out deps not in depNames", () => {
    const result = filterSelectedDeps(
      ["react", "vue"],
      ["react", "lodash"],
      { react: "18.0.0", lodash: "4.0.0" },
    );

    expect(result.depNames).toEqual(["react"]);
    expect(result.versionMap).toEqual({ react: "18.0.0" });
  });

  test("handles all deps selected", () => {
    const result = filterSelectedDeps(
      ["react", "lodash"],
      ["react", "lodash"],
      { react: "18.0.0", lodash: "4.0.0" },
    );

    expect(result.shouldUpdate).toBe(true);
    expect(result.depNames).toEqual(["react", "lodash"]);
    expect(result.versionMap).toEqual({ react: "18.0.0", lodash: "4.0.0" });
  });
});
