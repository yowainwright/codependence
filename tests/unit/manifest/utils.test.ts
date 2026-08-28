import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertMatchObject, match } from "../../helpers/assertions";
import {
  buildVersionDiff,
  collectAllDiffs,
  displayVersionDiffs,
  validatePackageName,
} from "../../../src/manifest";
import type { VersionDiff } from "../../../src/types";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("buildVersionDiff", () => {
  test("should build version diffs for dependencies", () => {
    const versionMap = {
      lodash: "4.17.21",
      express: "4.19.0",
    };

    const packageJson = {
      dependencies: {
        lodash: "4.17.0",
        express: "4.18.0",
      },
    };

    const codependencies = ["lodash"];
    const permissive = false;

    const diffs = buildVersionDiff(versionMap, packageJson, codependencies, permissive);

    assert.strictEqual(diffs.length, 2);
    assertMatchObject(diffs[0], {
      package: "lodash",
      current: "4.17.0",
      latest: "4.17.21",
      isPinned: true,
      willUpdate: true,
    });
    assertMatchObject(diffs[1], {
      package: "express",
      current: "4.18.0",
      latest: "4.19.0",
      isPinned: false,
      willUpdate: false,
    });
  });

  test("should handle permissive mode", () => {
    const versionMap = {
      lodash: "4.17.21",
      express: "4.19.0",
    };

    const packageJson = {
      dependencies: {
        lodash: "4.17.0",
        express: "4.18.0",
      },
    };

    const codependencies = ["lodash"];
    const permissive = true;

    const diffs = buildVersionDiff(versionMap, packageJson, codependencies, permissive);

    assert.strictEqual(diffs[0].willUpdate, false);
    assert.strictEqual(diffs[1].willUpdate, true);
  });

  test("marks satisfied ranges as non-actionable in permissive mode", () => {
    const diffs = buildVersionDiff(
      { "@types/node": "26.4.0", typescript: "7.0.2" },
      {
        devDependencies: {
          "@types/node": "^26.4.0",
          typescript: "^7.0.2",
        },
      },
      [],
      true,
    );

    assert.strictEqual(diffs[0].willUpdate, false);
    assert.strictEqual(diffs[1].willUpdate, false);
  });

  test("marks explicit prefix changes as actionable", () => {
    const diffs = buildVersionDiff(
      { lodash: "^1.0.0" },
      {
        dependencies: {
          lodash: "~1.0.0",
        },
      },
      ["lodash"],
      false,
    );

    assert.strictEqual(diffs[0].willUpdate, true);
    assert.strictEqual(diffs[0].installed, "^1.0.0");
  });

  test("marks leading-v changes as actionable", () => {
    const diffs = buildVersionDiff(
      { lodash: "1.2.3" },
      {
        dependencies: {
          lodash: "v1.2.3",
        },
      },
      ["lodash"],
      false,
    );

    assert.strictEqual(diffs[0].willUpdate, true);
    assert.strictEqual(diffs[0].installed, "1.2.3");
  });

  test("should handle devDependencies", () => {
    const versionMap = {
      jest: "29.0.0",
    };

    const packageJson = {
      devDependencies: {
        jest: "28.0.0",
      },
    };

    const codependencies = ["jest"];
    const permissive = false;

    const diffs = buildVersionDiff(versionMap, packageJson, codependencies, permissive);

    assert.strictEqual(diffs.length, 1);
    assert.strictEqual(diffs[0].package, "jest");
  });

  test("should handle peerDependencies", () => {
    const versionMap = {
      react: "18.3.0",
    };

    const packageJson = {
      peerDependencies: {
        react: "18.2.0",
      },
    };

    const codependencies = [];
    const permissive = false;

    const diffs = buildVersionDiff(versionMap, packageJson, codependencies, permissive);

    assert.strictEqual(diffs.length, 1);
    assert.strictEqual(diffs[0].package, "react");
  });

  test("should compare every repeated dependency version", () => {
    const latestVersion = "2.0.0";
    const diffs = buildVersionDiff(
      { action: latestVersion },
      {
        dependencies: { action: latestVersion },
        dependencyVersions: { action: ["1.0.0", latestVersion] },
        versionStrategy: "exact",
      },
      ["action"],
      false,
    );

    assert.strictEqual(diffs[0].current, "1.0.0");
    assert.strictEqual(diffs[0].latest, latestVersion);
  });

  test("should keep the latest non-matching repeated dependency version", () => {
    const diffs = buildVersionDiff(
      { action: "2.0.0" },
      {
        dependencies: { action: "1.0.0" },
        dependencyVersions: { action: ["1.0.0", "1.5.0", "2.0.0"] },
      },
      ["action"],
      false,
    );

    assert.strictEqual(diffs[0].current, "1.5.0");
  });

  test("should compare each resolved Docker tag family", () => {
    const diffs = buildVersionDiff(
      { node: "24-slim" },
      {
        dependencies: { node: "20-slim" },
        resolvedDependencyVersions: {
          node: {
            "20-slim": "24-slim",
            "20-alpine": "24-alpine",
          },
        },
        versionStrategy: "exact",
      },
      ["node"],
      false,
    );

    assert.deepStrictEqual(diffs, [
      {
        package: "node",
        current: "20-slim",
        latest: "24-slim",
        installed: "24-slim",
        isPinned: true,
        willUpdate: true,
      },
      {
        package: "node",
        current: "20-alpine",
        latest: "24-alpine",
        installed: "24-alpine",
        isPinned: true,
        willUpdate: true,
      },
    ]);
  });

  test("should skip packages not in versionMap", () => {
    const versionMap = {
      lodash: "4.17.21",
    };

    const packageJson = {
      dependencies: {
        lodash: "4.17.0",
        express: "4.18.0",
      },
    };

    const codependencies = [];
    const permissive = false;

    const diffs = buildVersionDiff(versionMap, packageJson, codependencies, permissive);

    assert.strictEqual(diffs.length, 1);
    assert.strictEqual(diffs[0].package, "lodash");
  });
});

describe("displayVersionDiffs", () => {
  test("should display diffs when changes exist", () => {
    const diffs: VersionDiff[] = [
      {
        package: "lodash",
        current: "4.17.0",
        latest: "4.17.21",
        isPinned: false,
        willUpdate: true,
      },
    ];

    const consoleSpy = mock.method(console, "log");
    displayVersionDiffs(diffs);

    assert.ok(consoleSpy.mock.callCount() > 0);
    consoleSpy.mock.restore();
  });

  test("should show check message when updates are available", () => {
    const diffs: VersionDiff[] = [
      {
        package: "lodash",
        current: "4.17.0",
        latest: "4.17.21",
        isPinned: false,
        willUpdate: true,
      },
    ];

    const consoleSpy = mock.method(console, "log");
    displayVersionDiffs(diffs);

    assertCalledWith(consoleSpy, match.stringContaining("Dependency Updates Available"));
    consoleSpy.mock.restore();
  });

  test("should show success message when no changes", () => {
    const diffs: VersionDiff[] = [];

    const consoleSpy = mock.method(console, "log");
    displayVersionDiffs(diffs);

    assertCalledWith(consoleSpy, match.stringContaining("up-to-date"));
    consoleSpy.mock.restore();
  });

  test("should filter out packages with same version", () => {
    const diffs: VersionDiff[] = [
      {
        package: "lodash",
        current: "4.17.21",
        latest: "4.17.21",
        isPinned: false,
        willUpdate: false,
      },
    ];

    const consoleSpy = mock.method(console, "log");
    displayVersionDiffs(diffs);

    assertCalledWith(consoleSpy, match.stringContaining("up-to-date"));
    consoleSpy.mock.restore();
  });

  test("filters out non-actionable range diffs", () => {
    const diffs: VersionDiff[] = [
      {
        package: "typescript",
        current: "^7.0.2",
        latest: "7.0.2",
        isPinned: false,
        willUpdate: false,
      },
      {
        package: "oxlint",
        current: "^1.72.0",
        latest: "^1.80.0",
        isPinned: false,
        willUpdate: true,
      },
    ];

    const consoleSpy = mock.method(console, "log");
    displayVersionDiffs(diffs);
    const output = consoleSpy.mock.calls.flatMap((call) => call.arguments).join("\n");

    assert.ok(!output.includes("typescript"));
    assert.ok(output.includes("oxlint"));
    consoleSpy.mock.restore();
  });
});

describe("collectAllDiffs", () => {
  const testDir = join(process.cwd(), "test-version-diff-temp");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("should collect diffs from multiple files", () => {
    const pkg1 = {
      name: "pkg1",
      dependencies: { lodash: "4.17.0" },
    };

    const pkg2 = {
      name: "pkg2",
      dependencies: { express: "4.18.0" },
    };

    writeFileSync(join(testDir, "pkg1.json"), JSON.stringify(pkg1));
    writeFileSync(join(testDir, "pkg2.json"), JSON.stringify(pkg2));

    const versionMap = {
      lodash: "4.17.21",
      express: "4.19.0",
    };

    const files = ["pkg1.json", "pkg2.json"];
    const codependencies = ["lodash"];
    const permissive = false;

    const diffs = collectAllDiffs(versionMap, files, testDir + "/", codependencies, permissive);

    assert.strictEqual(diffs.length, 2);
    assert.notStrictEqual(
      diffs.find((d) => d.package === "lodash"),
      undefined,
    );
    assert.notStrictEqual(
      diffs.find((d) => d.package === "express"),
      undefined,
    );
  });

  test("should deduplicate packages across files", () => {
    const pkg1 = {
      name: "pkg1",
      dependencies: { lodash: "4.17.0" },
    };

    const pkg2 = {
      name: "pkg2",
      dependencies: { lodash: "4.17.0" },
    };

    writeFileSync(join(testDir, "pkg1.json"), JSON.stringify(pkg1));
    writeFileSync(join(testDir, "pkg2.json"), JSON.stringify(pkg2));

    const versionMap = {
      lodash: "4.17.21",
    };

    const files = ["pkg1.json", "pkg2.json"];
    const codependencies = [];
    const permissive = false;

    const diffs = collectAllDiffs(versionMap, files, testDir + "/", codependencies, permissive);

    assert.strictEqual(diffs.length, 1);
    assert.strictEqual(diffs[0].package, "lodash");
  });

  test("should preserve distinct current versions with the same target", () => {
    const manifest = {
      dependencies: { node: "20-slim" },
      resolvedDependencyVersions: {
        node: {
          "20-slim": "24-slim",
          "22-slim": "24-slim",
        },
      },
    };

    writeFileSync(join(testDir, "Dockerfile.json"), JSON.stringify(manifest));

    const diffs = collectAllDiffs(
      { node: "24-slim" },
      ["Dockerfile.json"],
      testDir + "/",
      ["node"],
      false,
    );

    assert.deepStrictEqual(
      diffs.map(({ current }) => current),
      ["20-slim", "22-slim"],
    );
  });
});

describe("validatePackageName", () => {
  test("rejects missing and non-string package names", () => {
    assertMatchObject(validatePackageName(null), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot be null"],
    });
    assertMatchObject(validatePackageName(undefined), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot be undefined"],
    });
    assertMatchObject(validatePackageName(42), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name must be a string"],
    });
  });

  test("rejects package names with leading or trailing spaces", () => {
    const result = validatePackageName(" lodash");
    assert.strictEqual(result.validForNewPackages, false);
    assert.strictEqual(result.validForOldPackages, false);
    assert.ok(result.errors?.includes("name cannot contain leading or trailing spaces"));
  });

  test("rejects empty names and reserved leading characters", () => {
    assertMatchObject(validatePackageName(""), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name length must be greater than zero"],
    });
    assertMatchObject(validatePackageName(".package"), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with a period"],
    });
    assertMatchObject(validatePackageName("_package"), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with an underscore"],
    });
  });

  test("rejects names reserved by npm package paths", () => {
    assertMatchObject(validatePackageName("node_modules"), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["node_modules is not a valid package name"],
    });
  });

  test("warns for names npm no longer accepts for new packages", () => {
    const result = validatePackageName(`${"A".repeat(215)}!`);
    assert.strictEqual(result.validForNewPackages, false);
    assert.strictEqual(result.validForOldPackages, true);
    assert.deepStrictEqual(result.warnings, [
      "name can no longer contain more than 214 characters",
      "name can no longer contain capital letters",
      'name can no longer contain special characters ("~\'!()*")',
    ]);
  });

  test("rejects scoped package segments that start with a period", () => {
    assertMatchObject(validatePackageName("@scope/.package"), {
      validForNewPackages: false,
      validForOldPackages: false,
      errors: ["name cannot start with a period"],
    });
  });
});
