import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertMatchObject, match } from "../../helpers/assertions";
import { buildVersionDiff, displayVersionDiffs, collectAllDiffs } from "../../../src/utils/diff";
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

    assert.strictEqual((diffs).length, 2);
    assertMatchObject((diffs[0]), {
      package: "lodash",
      current: "4.17.0",
      latest: "4.17.21",
      isPinned: true,
      willUpdate: true,
    });
    assertMatchObject((diffs[1]), {
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

    assert.strictEqual((diffs[0].willUpdate), false);
    assert.strictEqual((diffs[1].willUpdate), true);
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

    assert.strictEqual((diffs).length, 1);
    assert.strictEqual((diffs[0].package), "jest");
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

    assert.strictEqual((diffs).length, 1);
    assert.strictEqual((diffs[0].package), "react");
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

    assert.strictEqual((diffs[0].current), "1.0.0");
    assert.strictEqual((diffs[0].latest), latestVersion);
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

    assert.deepStrictEqual((diffs), [
      {
        package: "node",
        current: "20-slim",
        latest: "24-slim",
        isPinned: true,
        willUpdate: true,
      },
      {
        package: "node",
        current: "20-alpine",
        latest: "24-alpine",
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

    assert.strictEqual((diffs).length, 1);
    assert.strictEqual((diffs[0].package), "lodash");
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
    displayVersionDiffs(diffs, false);

    assert.ok((consoleSpy).mock.callCount() > 0);
    consoleSpy.mock.restore();
  });

  test("should show dry-run message when in dry-run mode", () => {
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
    displayVersionDiffs(diffs, true);

    assertCalledWith((consoleSpy), match.stringContaining("would be updated"));
    consoleSpy.mock.restore();
  });

  test("should show success message when no changes", () => {
    const diffs: VersionDiff[] = [];

    const consoleSpy = mock.method(console, "log");
    displayVersionDiffs(diffs, false);

    assertCalledWith((consoleSpy), match.stringContaining("up-to-date"));
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
    displayVersionDiffs(diffs, false);

    assertCalledWith((consoleSpy), match.stringContaining("up-to-date"));
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

    assert.strictEqual((diffs).length, 2);
    assert.notStrictEqual((diffs.find((d) => d.package === "lodash")), undefined);
    assert.notStrictEqual((diffs.find((d) => d.package === "express")), undefined);
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

    assert.strictEqual((diffs).length, 1);
    assert.strictEqual((diffs[0].package), "lodash");
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

    assert.deepStrictEqual((diffs.map(({ current }) => current)), ["20-slim", "22-slim"]);
  });
});
