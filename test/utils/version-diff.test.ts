import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import {
  buildVersionDiff,
  displayVersionDiffs,
  collectAllDiffs,
} from "../../src/utils/version-diff";
import type { VersionDiff } from "../../src/types";
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

    const diffs = buildVersionDiff(
      versionMap,
      packageJson,
      codependencies,
      permissive,
    );

    expect(diffs).toHaveLength(2);
    expect(diffs[0]).toMatchObject({
      package: "lodash",
      current: "4.17.0",
      latest: "4.17.21",
      isPinned: true,
      willUpdate: true,
    });
    expect(diffs[1]).toMatchObject({
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

    const diffs = buildVersionDiff(
      versionMap,
      packageJson,
      codependencies,
      permissive,
    );

    expect(diffs[0].willUpdate).toBe(false);
    expect(diffs[1].willUpdate).toBe(true);
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

    const diffs = buildVersionDiff(
      versionMap,
      packageJson,
      codependencies,
      permissive,
    );

    expect(diffs).toHaveLength(1);
    expect(diffs[0].package).toBe("jest");
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

    const diffs = buildVersionDiff(
      versionMap,
      packageJson,
      codependencies,
      permissive,
    );

    expect(diffs).toHaveLength(1);
    expect(diffs[0].package).toBe("react");
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

    const diffs = buildVersionDiff(
      versionMap,
      packageJson,
      codependencies,
      permissive,
    );

    expect(diffs).toHaveLength(1);
    expect(diffs[0].package).toBe("lodash");
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

    const consoleSpy = spyOn(console, "log");
    displayVersionDiffs(diffs, false);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
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

    const consoleSpy = spyOn(console, "log");
    displayVersionDiffs(diffs, true);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("would be updated"),
    );
    consoleSpy.mockRestore();
  });

  test("should show success message when no changes", () => {
    const diffs: VersionDiff[] = [];

    const consoleSpy = spyOn(console, "log");
    displayVersionDiffs(diffs, false);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("up-to-date"),
    );
    consoleSpy.mockRestore();
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

    const consoleSpy = spyOn(console, "log");
    displayVersionDiffs(diffs, false);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("up-to-date"),
    );
    consoleSpy.mockRestore();
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

    const diffs = collectAllDiffs(
      versionMap,
      files,
      testDir + "/",
      codependencies,
      permissive,
    );

    expect(diffs).toHaveLength(2);
    expect(diffs.find((d) => d.package === "lodash")).toBeDefined();
    expect(diffs.find((d) => d.package === "express")).toBeDefined();
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

    const diffs = collectAllDiffs(
      versionMap,
      files,
      testDir + "/",
      codependencies,
      permissive,
    );

    expect(diffs).toHaveLength(1);
    expect(diffs[0].package).toBe("lodash");
  });
});
