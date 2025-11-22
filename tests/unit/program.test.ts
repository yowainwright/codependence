import {
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
  describe,
  mock,
} from "bun:test";
import {
  action,
  mergeConfigs,
  formatPerformanceMetrics,
  initAction,
  run,
} from "../../src/program";
import type { Options } from "../../src/types";
import * as fs from "fs";
import * as logger from "../../src/logger";
import * as scripts from "../../src/scripts";
import * as config from "../../src/utils/config";

describe("Action Function Tests (Fast)", () => {
  let scriptSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    scriptSpy = jest.spyOn(scripts, "script").mockResolvedValue(undefined);
  });

  afterEach(() => {
    scriptSpy.mockRestore();
  });

  test("returns options with isTestingAction flag", async () => {
    const options = {
      codependencies: ["lodash"],
      isTestingAction: true,
    };

    const result = await action(options);

    expect(result).toEqual({
      isCLI: true,
      codependencies: ["lodash"],
    });
  });

  test("handles isTestingCLI flag", async () => {
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash", "fs-extra"],
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith({
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash", "fs-extra"],
      },
    });

    consoleInfoSpy.mockRestore();
  });

  test("merges CLI options with config", async () => {
    const result = await action({
      codependencies: ["lodash"],
      update: true,
      debug: true,
      silent: true,
      isTestingAction: true,
    });

    expect(result).toEqual({
      isCLI: true,
      codependencies: ["lodash"],
      update: true,
      debug: true,
      silent: true,
    });
  });

  test("handles permissive mode", async () => {
    const result = await action({
      permissive: true,
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.permissive).toBe(true);
      expect(result.isCLI).toBe(true);
    }
  });

  test("processes multiple CLI flags", async () => {
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash"],
      update: true,
      debug: true,
      silent: true,
      yarnConfig: true,
      files: ["packages/*/package.json"],
      ignore: ["**/node_modules/**"],
      rootDir: "./test",
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith({
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash"],
        update: true,
        debug: true,
        silent: true,
        yarnConfig: true,
        files: ["packages/*/package.json"],
        ignore: ["**/node_modules/**"],
        rootDir: "./test",
      },
    });

    consoleInfoSpy.mockRestore();
  });

  test("processes config with searchPath", async () => {
    const result = await action({
      searchPath: "./custom/path",
      codependencies: ["test"], // Add codependencies to avoid undefined
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.isCLI).toBe(true);
      expect(result.codependencies).toEqual(["test"]);
    }
  });

  test("handles verbose mode", async () => {
    const result = await action({
      codependencies: ["lodash"],
      verbose: true,
      isTestingAction: true,
    });

    expect(result).toEqual({
      isCLI: true,
      codependencies: ["lodash"],
      verbose: true,
    });
  });

  test("handles quiet mode", async () => {
    const result = await action({
      codependencies: ["lodash"],
      quiet: true,
      isTestingAction: true,
    });

    expect(result).toEqual({
      isCLI: true,
      codependencies: ["lodash"],
      quiet: true,
    });
  });

  test("processes codependencies from config", async () => {
    const result = await action({
      config: "./tests/unit/fixtures/.codependencerc",
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.isCLI).toBe(true);
      expect(result.codependencies).toBeDefined();
    }
  });

  test("handles array of files", async () => {
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash"],
      files: ["package.json", "packages/*/package.json", "apps/*/package.json"],
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith({
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash"],
        files: [
          "package.json",
          "packages/*/package.json",
          "apps/*/package.json",
        ],
      },
    });

    consoleInfoSpy.mockRestore();
  });

  test("handles ignore patterns", async () => {
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => {});

    await action({
      isTestingCLI: true,
      codependencies: ["react"],
      ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith({
      updatedOptions: {
        isCLI: true,
        codependencies: ["react"],
        ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
      },
    });

    consoleInfoSpy.mockRestore();
  });

  test("handles complex codependencies", async () => {
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash", { "fs-extra": "10.0.1" }, "react@^18.0.0"],
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith({
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash", { "fs-extra": "10.0.1" }, "react@^18.0.0"],
      },
    });

    consoleInfoSpy.mockRestore();
  });

  test("combines all options", async () => {
    const result = await action({
      codependencies: ["lodash", "react"],
      files: ["**/package.json"],
      ignore: ["**/node_modules/**"],
      update: true,
      debug: true,
      silent: false,
      verbose: false,
      quiet: false,
      yarnConfig: true,
      rootDir: "./src",
      permissive: false,
      isTestingAction: true,
    });

    expect(result).toEqual({
      isCLI: true,
      codependencies: ["lodash", "react"],
      files: ["**/package.json"],
      ignore: ["**/node_modules/**"],
      update: true,
      debug: true,
      silent: false,
      verbose: false,
      quiet: false,
      yarnConfig: true,
      rootDir: "./src",
      permissive: false,
    });
  });

  test("should handle error when codependencies are missing", async () => {
    scriptSpy.mockRestore();
    const configSpy = jest
      .spyOn(config, "loadConfig")
      .mockReturnValue({ config: {}, configPath: null });
    const errorSpy = jest
      .spyOn(logger.logger, "error")
      .mockImplementation(() => {});

    await action({
      permissive: false,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("codependencies"),
      undefined,
      "cli:error",
    );
    errorSpy.mockRestore();
    configSpy.mockRestore();
    scriptSpy = jest.spyOn(scripts, "script").mockResolvedValue(undefined);
  });

  test("should handle error with permissive mode not set", async () => {
    scriptSpy.mockRestore();
    const configSpy = jest
      .spyOn(config, "loadConfig")
      .mockReturnValue({ config: {}, configPath: null });
    const errorSpy = jest
      .spyOn(logger.logger, "error")
      .mockImplementation(() => {});

    await action({});

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("codependencies"),
      undefined,
      "cli:error",
    );
    errorSpy.mockRestore();
    configSpy.mockRestore();
    scriptSpy = jest.spyOn(scripts, "script").mockResolvedValue(undefined);
  });

  test("should execute script with dry-run mode", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await action({
      codependencies: ["lodash"],
      dryRun: true,
    });

    expect(scriptSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
    consoleSpy.mockRestore();
  });

  test("should execute script with verbose mode", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await action({
      codependencies: ["lodash"],
      verbose: true,
    });

    expect(scriptSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test("should execute script in normal mode", async () => {
    await action({
      codependencies: ["lodash"],
    });

    expect(scriptSpy).toHaveBeenCalled();
  });

  test("should pass onProgress callback to script", async () => {
    await action({
      codependencies: ["lodash"],
    });

    expect(scriptSpy).toHaveBeenCalled();
    const callArgs = scriptSpy.mock.calls[0][0];
    expect(callArgs.onProgress).toBeDefined();
  });
});

describe("initAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should handle existing .codependencerc", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const warnSpy = jest
      .spyOn(logger.logger, "warn")
      .mockImplementation(() => {});

    await initAction("rc");

    expect(warnSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test("should handle missing package.json", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const errorSpy = jest
      .spyOn(logger.logger, "error")
      .mockImplementation(() => {});

    await initAction("rc");

    expect(errorSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("should handle invalid JSON in package.json", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue("invalid json{");
    const errorSpy = jest
      .spyOn(logger.logger, "error")
      .mockImplementation(() => {});

    await initAction("rc");

    expect(errorSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("should handle no dependencies in package.json", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(JSON.stringify({}));
    const errorSpy = jest
      .spyOn(logger.logger, "error")
      .mockImplementation(() => {});

    await initAction("rc");

    expect(errorSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("should create .codependencerc with non-interactive mode", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "4.17.21" },
      }),
    );
    const writeFileSyncSpy = jest
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {});

    await initAction("rc");

    expect(writeFileSyncSpy).toHaveBeenCalled();
    const callArgs = writeFileSyncSpy.mock.calls[0];
    expect(callArgs[0]).toBe(".codependencerc");

    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("should create package.json config with package type", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const packageJsonContent = JSON.stringify({
      name: "test",
      dependencies: { lodash: "4.17.21" },
    });
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(packageJsonContent);
    const writeFileSyncSpy = jest
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {});

    await initAction("package");

    expect(writeFileSyncSpy).toHaveBeenCalled();
    const callArgs = writeFileSyncSpy.mock.calls[0];
    expect(callArgs[0]).toBe("package.json");

    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("should handle default type", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "4.17.21" },
      }),
    );
    const writeFileSyncSpy = jest
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {});

    await initAction("default");

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });
});

describe("run", () => {
  let scriptSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    scriptSpy = jest.spyOn(scripts, "script").mockResolvedValue(undefined);
  });

  afterEach(() => {
    scriptSpy.mockRestore();
  });

  test("should show help when --help flag is provided", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await run(["node", "script.js", "--help"]);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test("should call initAction for init command", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      // Config already exists - should warn
      return true;
    });
    const warnSpy = jest
      .spyOn(logger.logger, "warn")
      .mockImplementation(() => {});

    await run(["node", "script.js", "init", "rc"]);

    expect(warnSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test("should call action for regular command", async () => {
    await run(["node", "script.js", "--codependencies", "lodash"]);

    expect(scriptSpy).toHaveBeenCalled();
  });

  test("should handle init command with package type", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(JSON.stringify({ dependencies: { lodash: "4.17.21" } }));
    const writeFileSyncSpy = jest
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {});

    await run(["node", "script.js", "init", "package"]);

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("should handle init command with default type", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(JSON.stringify({ dependencies: { lodash: "4.17.21" } }));
    const writeFileSyncSpy = jest
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {});

    await run(["node", "script.js", "init", "default"]);

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });
});

describe("mergeConfigs", () => {
  test("should merge base config with options", () => {
    const options: Options = {
      update: true,
      verbose: true,
    };
    const baseConfig = {
      codependencies: ["lodash"],
      permissive: false,
    };
    const pathConfig = {};

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.update).toBe(true);
    expect(result.verbose).toBe(true);
    expect(result.codependencies).toEqual(["lodash"]);
    expect(result.permissive).toBe(false);
    expect(result.isCLI).toBe(true);
  });

  test("should prioritize path config over base config", () => {
    const options: Options = {};
    const baseConfig = {
      codependencies: ["lodash"],
    };
    const pathConfig = {
      codependencies: ["express"],
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.codependencies).toEqual(["express"]);
  });

  test("should prioritize options over all configs", () => {
    const options: Options = {
      codependencies: ["react"],
    };
    const baseConfig = {
      codependencies: ["lodash"],
    };
    const pathConfig = {
      codependencies: ["express"],
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.codependencies).toEqual(["react"]);
  });

  test("should ignore base config when path config exists", () => {
    const options: Options = {};
    const baseConfig = {
      codependencies: ["lodash"],
      permissive: true,
    };
    const pathConfig = {
      update: true,
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.codependencies).toBeUndefined();
    expect(result.permissive).toBeUndefined();
    expect(result.update).toBe(true);
  });

  test("should extract codependence key from path config", () => {
    const options: Options = {};
    const baseConfig = {};
    const pathConfig = {
      codependence: {
        codependencies: ["lodash"],
        permissive: true,
      },
      otherKey: "ignored",
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.codependencies).toEqual(["lodash"]);
    expect(result.permissive).toBe(true);
    expect((result as Record<string, unknown>).otherKey).toBeUndefined();
  });

  test("should handle empty configs", () => {
    const options: Options = {};
    const baseConfig = {};
    const pathConfig = {};

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.isCLI).toBe(true);
  });

  test("should remove config and searchPath from result", () => {
    const options: Options = {
      config: "/path/to/config",
      searchPath: "/search/path",
    };
    const baseConfig = {};
    const pathConfig = {};

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.config).toBeUndefined();
    expect(result.searchPath).toBeUndefined();
  });

  test("should remove isTestingCLI and isTestingAction", () => {
    const options: Options = {
      isTestingCLI: true,
      isTestingAction: true,
    };
    const baseConfig = {};
    const pathConfig = {};

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.isTestingCLI).toBeUndefined();
    expect(result.isTestingAction).toBeUndefined();
  });

  test("should handle null codependence key", () => {
    const options: Options = {};
    const baseConfig = {};
    const pathConfig = {
      codependence: null,
      otherKey: "value",
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect((result as Record<string, unknown>).otherKey).toBe("value");
  });

  test("should handle non-object codependence key", () => {
    const options: Options = {};
    const baseConfig = {};
    const pathConfig = {
      codependence: "string value",
      otherKey: "value",
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect((result as Record<string, unknown>).otherKey).toBe("value");
  });

  test("should merge complex config scenario", () => {
    const options: Options = {
      update: true,
      verbose: true,
      files: ["packages/*/package.json"],
    };
    const baseConfig = {
      codependencies: ["lodash", "express"],
      permissive: false,
      rootDir: "/base/path",
    };
    const pathConfig = {
      codependence: {
        codependencies: ["react"],
        permissive: true,
      },
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    expect(result.update).toBe(true);
    expect(result.verbose).toBe(true);
    expect(result.files).toEqual(["packages/*/package.json"]);
    expect(result.codependencies).toEqual(["react"]);
    expect(result.permissive).toBe(true);
    expect(result.rootDir).toBeUndefined();
  });
});

describe("formatPerformanceMetrics", () => {
  test("should format metrics with cache hits", () => {
    const duration = 1500;
    const stats = { hits: 10, misses: 2, size: 12 };
    const hitRate = 83.33;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    expect(result).toContain("\n⚡ Performance:");
    expect(result).toContain("  ⏱️  Completed in 1500ms");
    expect(result).toContain("  📦 Cache: 10 hits, 2 misses (83.3% hit rate)");
    expect(result).toContain("  💾 12 packages cached\n");
  });

  test("should format metrics with no cache", () => {
    const duration = 3000;
    const stats = { hits: 0, misses: 0, size: 0 };
    const hitRate = 0;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    expect(result).toContain("\n⚡ Performance:");
    expect(result).toContain("  ⏱️  Completed in 3000ms");
    expect(result).toContain("  📦 No cache hits (first run)\n");
    expect(result).not.toContain("% hit rate");
  });

  test("should format hit rate with one decimal place", () => {
    const duration = 1000;
    const stats = { hits: 7, misses: 3, size: 10 };
    const hitRate = 70.0;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    const joinedResult = result.join("\n");
    expect(joinedResult).toContain("70.0% hit rate");
  });

  test("should handle 100% hit rate", () => {
    const duration = 500;
    const stats = { hits: 15, misses: 0, size: 15 };
    const hitRate = 100;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    const joinedResult = result.join("\n");
    expect(joinedResult).toContain("100.0% hit rate");
    expect(joinedResult).toContain("15 packages cached");
  });

  test("should return array of strings", () => {
    const duration = 1000;
    const stats = { hits: 5, misses: 5, size: 10 };
    const hitRate = 50;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((line) => {
      expect(typeof line).toBe("string");
    });
  });
});
