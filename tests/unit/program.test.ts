import { expect, test, jest, beforeEach, afterEach, describe, mock } from "bun:test";
import {
  action,
  mergeConfigs,
  formatPerformanceMetrics,
  initAction,
  initGitHubActions,
  run,
} from "../../src/program";
import type { Options } from "../../src/types";
import * as fs from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { logger } from "../../src/logger";
import * as scripts from "../../src/scripts";
import * as config from "../../src/config";
import { Prompt } from "../../src/utils/prompts";

describe("Action Function Tests (Fast)", () => {
  let scriptSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    scriptSpy = jest.spyOn(scripts, "checkFiles").mockResolvedValue(undefined);
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
    const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

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
    const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

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

  test("runs each configured manager target independently", async () => {
    const workDir = fs.mkdtempSync(join(tmpdir(), "codependence-targets-"));
    const configPath = join(workDir, ".codependencerc");
    const targets = [
      {
        manager: "bun",
        files: ["package.json"],
        codependencies: ["typescript"],
      },
      {
        manager: "github-actions",
        files: [".github/workflows/*.yml"],
        mode: "precise",
      },
    ];
    fs.writeFileSync(configPath, JSON.stringify({ targets }));

    try {
      await action({ config: configPath, update: true, silent: true });

      expect(scriptSpy).toHaveBeenCalledTimes(2);
      expect(scriptSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          language: "nodejs",
          packageManager: "bun",
          files: ["package.json"],
          codependencies: ["typescript"],
          update: true,
        }),
      );
      expect(scriptSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          language: "github-actions",
          packageManager: "github-actions",
          files: [".github/workflows/*.yml"],
          mode: "precise",
          update: true,
        }),
      );
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("reports deferred target failures without a success message", async () => {
    const stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    scriptSpy
      .mockImplementationOnce(async (options) => {
        options.onDeferredFailure?.();
        return [];
      })
      .mockResolvedValueOnce([]);

    try {
      await action({
        targets: [
          { manager: "bun", mode: "precise" },
          { manager: "github-actions", mode: "precise" },
        ],
      });

      const output = stdoutSpy.mock.calls.flat().join("");
      expect(output).toContain("found dependency issues");
      expect(output).not.toContain("pinned!");
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  test("allows supplemental explicit config when CLI supplies policy", async () => {
    const workDir = fs.mkdtempSync(join(tmpdir(), "codependence-partial-config-"));
    const configPath = join(workDir, ".codependencerc");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        files: ["package.json"],
        rootDir: workDir,
      }),
    );

    try {
      await action({
        config: configPath,
        codependencies: ["react"],
      });

      expect(scriptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          codependencies: ["react"],
          files: ["package.json"],
          rootDir: workDir,
        }),
      );
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("rejects multi-key inline YAML codependency objects", async () => {
    const workDir = fs.mkdtempSync(join(tmpdir(), "codependence-yaml-config-"));
    const configPath = join(workDir, ".codependencerc.yml");
    fs.writeFileSync(configPath, "codependencies: [{ lodash: 4.17.21, react: 18.2.0 }]");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    try {
      await action({ config: configPath });

      const errorCalls = errorSpy.mock.calls.flat().join(" ");
      expect(errorCalls).toContain("exactly one key");
      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(scriptSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("handles array of files", async () => {
    const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash"],
      files: ["package.json", "packages/*/package.json", "apps/*/package.json"],
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith({
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash"],
        files: ["package.json", "packages/*/package.json", "apps/*/package.json"],
      },
    });

    consoleInfoSpy.mockRestore();
  });

  test("handles ignore patterns", async () => {
    const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

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
    const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

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
    const configSpy = jest.spyOn(config, "loadConfig").mockReturnValue(null);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as () => never);

    try {
      await action({
        permissive: false,
      });

      const errorCalls = errorSpy.mock.calls.flat().join(" ");
      expect(errorCalls).toContain("codependencies");
      expect(exitSpy).toHaveBeenCalledWith(2);
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
      configSpy.mockRestore();
      scriptSpy = jest.spyOn(scripts, "checkFiles").mockResolvedValue(undefined);
    }
  });

  test("should run in permissive mode when no options provided", async () => {
    const configSpy = jest.spyOn(config, "loadConfig").mockReturnValue(null);

    await action({});

    expect(scriptSpy).toHaveBeenCalled();
    configSpy.mockRestore();
  });

  test("should default listed codependencies to 0.x compatible verbose mode", async () => {
    await action({
      codependencies: ["lodash"],
    });

    const callArgs = scriptSpy.mock.calls[0][0];
    expect(callArgs.mode).toBe("verbose");
  });

  test("should use precise mode when permissive is explicit", async () => {
    await action({
      codependencies: ["lodash"],
      permissive: true,
    });

    const callArgs = scriptSpy.mock.calls[0][0];
    expect(callArgs.mode).toBe("precise");
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

  test("should pass and invoke onProgress callback", async () => {
    await action({ codependencies: ["lodash"] });

    const callArgs = scriptSpy.mock.calls[0][0];
    expect(callArgs.onProgress).toBeDefined();
    callArgs.onProgress(1, 5, "lodash");
  });

  test("should run in watch mode", async () => {
    const setIntervalSpy = jest
      .spyOn(globalThis, "setInterval")
      .mockImplementation((() => 0) as typeof setInterval);
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await action({ codependencies: ["lodash"], watch: true });

    expect(scriptSpy).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    setIntervalSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("should skip overlapping watch mode intervals", async () => {
    let intervalCallback: (() => Promise<void>) | undefined;
    const setIntervalSpy = jest.spyOn(globalThis, "setInterval").mockImplementation(((
      callback: TimerHandler,
    ) => {
      intervalCallback = callback as () => Promise<void>;
      return 0;
    }) as unknown as typeof setInterval);
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    let resolveSecondRun: (() => void) | undefined;
    const secondRun = new Promise<void>((resolve) => {
      resolveSecondRun = resolve;
    });

    scriptSpy
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => secondRun as Promise<void>);

    await action({ codependencies: ["lodash"], watch: true });

    const inFlightCheck = intervalCallback?.();
    await Promise.resolve();
    await intervalCallback?.();

    expect(scriptSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Previous check still running"),
    );

    resolveSecondRun?.();
    await inFlightCheck;

    setIntervalSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("should log watch mode failures", async () => {
    let intervalCallback: (() => Promise<void>) | undefined;
    const setIntervalSpy = jest.spyOn(globalThis, "setInterval").mockImplementation(((
      callback: TimerHandler,
    ) => {
      intervalCallback = callback as () => Promise<void>;
      return 0;
    }) as unknown as typeof setInterval);
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    scriptSpy
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("watch mode failure"));

    await action({ codependencies: ["lodash"], watch: true });
    await intervalCallback?.();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Check failed: watch mode failure"),
    );

    setIntervalSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("should log deferred dependency issues in watch mode", async () => {
    const setIntervalSpy = jest
      .spyOn(globalThis, "setInterval")
      .mockImplementation((() => 0) as typeof setInterval);
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    scriptSpy.mockImplementationOnce(async (options) => {
      options.onDeferredFailure?.();
      return [];
    });

    await action({ codependencies: ["lodash"], watch: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Dependency issues found"),
    );

    setIntervalSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe("initAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should handle existing .codependencerc", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

    await initAction("rc");

    expect(warnSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test("should handle missing package.json", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

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
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue("invalid json{");
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

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
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({}));
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

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
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    await initAction("rc");

    expect(writeFileSyncSpy).toHaveBeenCalled();
    const callArgs = writeFileSyncSpy.mock.calls[0];
    expect(callArgs[0]).toBe(".codependencerc");

    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("should create .codependencerc with explicit dependency array", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "4.17.21", react: "18.0.0" },
      }),
    );
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    await initAction(["lodash"]);

    const callArgs = writeFileSyncSpy.mock.calls[0];
    expect(callArgs[0]).toBe(".codependencerc");
    expect(JSON.parse(callArgs[1] as string)).toEqual({
      codependencies: ["lodash"],
    });

    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("should reject explicit dependency array without matching package dependencies", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({}));
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

    await initAction(["lodash"]);

    expect(writeFileSyncSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "Requested dependencies not found in package.json: lodash",
    );

    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
    errorSpy.mockRestore();
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
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(packageJsonContent);
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

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
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    await initAction("default");

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  const mockFsForInteractive = () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(JSON.stringify({ dependencies: { lodash: "4.17.21", react: "18.0.0" } }));
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    return { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy };
  };

  test("should handle interactive mode - permissive with selected deps", async () => {
    const { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy } = mockFsForInteractive();
    const listSpy = jest
      .spyOn(Prompt.prototype, "list")
      .mockResolvedValueOnce("permissive")
      .mockResolvedValueOnce("rc");
    const checkboxSpy = jest.spyOn(Prompt.prototype, "checkbox").mockResolvedValue(["lodash"]);
    const closeSpy = jest.spyOn(Prompt.prototype, "close").mockImplementation(() => {});

    await initAction();

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
    consoleSpy.mockRestore();
    listSpy.mockRestore();
    checkboxSpy.mockRestore();
    closeSpy.mockRestore();
  });

  test("should handle interactive mode - permissive with no deps selected", async () => {
    const { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy } = mockFsForInteractive();
    const listSpy = jest
      .spyOn(Prompt.prototype, "list")
      .mockResolvedValueOnce("permissive")
      .mockResolvedValueOnce("rc");
    const checkboxSpy = jest.spyOn(Prompt.prototype, "checkbox").mockResolvedValue([]);
    const closeSpy = jest.spyOn(Prompt.prototype, "close").mockImplementation(() => {});

    await initAction();

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
    consoleSpy.mockRestore();
    listSpy.mockRestore();
    checkboxSpy.mockRestore();
    closeSpy.mockRestore();
  });

  test("should handle interactive mode - pin all deps", async () => {
    const { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy } = mockFsForInteractive();
    const listSpy = jest
      .spyOn(Prompt.prototype, "list")
      .mockResolvedValueOnce("all")
      .mockResolvedValueOnce("rc");
    const closeSpy = jest.spyOn(Prompt.prototype, "close").mockImplementation(() => {});

    await initAction();

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
    consoleSpy.mockRestore();
    listSpy.mockRestore();
    closeSpy.mockRestore();
  });
});

describe("run", () => {
  let scriptSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    scriptSpy = jest.spyOn(scripts, "checkFiles").mockResolvedValue(undefined);
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
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

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
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

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
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    await run(["node", "script.js", "init", "default"]);

    expect(writeFileSyncSpy).toHaveBeenCalled();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("should handle init command with explicit dependency names", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "4.17.21", react: "18.0.0" },
      }),
    );
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    await run(["node", "script.js", "init", "rc", "lodash"]);

    const callArgs = writeFileSyncSpy.mock.calls[0];
    expect(callArgs[0]).toBe(".codependencerc");
    expect(JSON.parse(callArgs[1] as string)).toEqual({
      codependencies: ["lodash"],
    });

    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("should handle init command with codependencies option", async () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "4.17.21", react: "18.0.0" },
      }),
    );
    const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    await run(["node", "script.js", "init", "rc", "--codependencies", "lodash", "react"]);

    const callArgs = writeFileSyncSpy.mock.calls[0];
    expect(callArgs[0]).toBe(".codependencerc");
    expect(JSON.parse(callArgs[1] as string)).toEqual({
      codependencies: ["lodash", "react"],
    });

    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test("routes positional action targets through the CLI", async () => {
    const rootDir = createActionsProject();
    const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => {});

    try {
      await run([
        "node",
        "script.js",
        "init",
        "actions",
        "go",
        "--rootDir",
        rootDir,
        "--version",
        "go=1.25.3",
      ]);

      const goWorkflow = join(rootDir, ".github/workflows/codependence-go.yml");
      const nodeWorkflow = join(rootDir, ".github/workflows/codependence-node.yml");
      expect(fs.existsSync(goWorkflow)).toBe(true);
      expect(fs.existsSync(nodeWorkflow)).toBe(false);
      expect(infoSpy).toHaveBeenCalledWith(`Created ${goWorkflow}`);
    } finally {
      infoSpy.mockRestore();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
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
    const joined = result.join("\n");

    expect(joined).toContain("Performance:");
    expect(joined).toContain("Completed in 1500ms");
    expect(joined).toContain("Cache: 10 hits, 2 misses (83.3% hit rate)");
    expect(joined).toContain("12 packages cached");
  });

  test("should format metrics with no cache", () => {
    const duration = 3000;
    const stats = { hits: 0, misses: 0, size: 0 };
    const hitRate = 0;

    const result = formatPerformanceMetrics(duration, stats, hitRate);
    const joined = result.join("\n");

    expect(joined).toContain("Performance:");
    expect(joined).toContain("Completed in 3000ms");
    expect(joined).toContain("No cache hits (first run)");
    expect(joined).not.toContain("% hit rate");
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

describe("Format and Output File Tests", () => {
  let writeFileSpy: ReturnType<typeof jest.spyOn>;
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    writeFileSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    writeFileSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("should accept format option in action", async () => {
    const result = await action({
      codependencies: ["react"],
      format: "json",
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.format).toBe("json");
    }
  });

  test("should accept outputFile option in action", async () => {
    const result = await action({
      codependencies: ["react"],
      outputFile: "/tmp/output.json",
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.outputFile).toBe("/tmp/output.json");
    }
  });

  test("should accept both format and outputFile options", async () => {
    const result = await action({
      codependencies: ["react"],
      format: "markdown",
      outputFile: "/tmp/output.md",
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.format).toBe("markdown");
      expect(result.outputFile).toBe("/tmp/output.md");
    }
  });

  test("should accept table format option", async () => {
    const result = await action({
      codependencies: ["react"],
      format: "table",
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.format).toBe("table");
    }
  });

  test("should merge format option with other options", async () => {
    const result = await action({
      codependencies: ["react", "lodash"],
      format: "json",
      debug: true,
      verbose: true,
      isTestingAction: true,
    });

    expect(result).toBeDefined();
    if (result && typeof result === "object") {
      expect(result.format).toBe("json");
      expect(result.debug).toBe(true);
      expect(result.verbose).toBe(true);
    }
  });
});

describe("Format Integration Tests", () => {
  let scriptSpy: ReturnType<typeof jest.spyOn>;
  let writeFileSpy: ReturnType<typeof jest.spyOn>;
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();

    scriptSpy = jest.spyOn(scripts, "checkFiles").mockResolvedValue([
      {
        package: "react",
        current: "17.0.0",
        latest: "18.0.0",
        isPinned: false,
        willUpdate: true,
      },
      {
        package: "lodash",
        current: "4.17.21",
        latest: "4.17.21",
        isPinned: false,
        willUpdate: false,
      },
    ]);

    writeFileSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    scriptSpy.mockRestore();
    writeFileSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("should call script with onProgress callback when format is set", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "json",
    });

    expect(scriptSpy).toHaveBeenCalled();
    const callArgs = scriptSpy.mock.calls[0][0];
    expect(callArgs).toHaveProperty("onProgress");
    expect(typeof callArgs.onProgress).toBe("function");
  });

  test("should write JSON output to file when outputFile is specified", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "json",
      outputFile: "/tmp/test-output.json",
    });

    expect(writeFileSpy).toHaveBeenCalledWith(
      "/tmp/test-output.json",
      expect.stringContaining('"status"'),
    );
  });

  test("should write markdown output to console when no outputFile", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "markdown",
    });

    const jsonCalls = consoleLogSpy.mock.calls.filter((call) =>
      call[0]?.includes("# Dependency Status"),
    );
    expect(jsonCalls.length).toBeGreaterThan(0);
  });

  test("should write table output to console when format is table", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "table",
    });

    const tableCalls = consoleLogSpy.mock.calls.filter((call) => call[0]?.includes("Outdated"));
    expect(tableCalls.length).toBeGreaterThan(0);
  });

  test("should transform diffs to DependencyInfo format", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "json",
    });

    const jsonOutput = consoleLogSpy.mock.calls.find((call) => call[0]?.includes('"package"'));
    expect(jsonOutput).toBeDefined();

    if (jsonOutput && jsonOutput[0]) {
      const parsed = JSON.parse(jsonOutput[0]);
      expect(parsed.dependencies[0]).toHaveProperty("package", "react");
      expect(parsed.dependencies[0]).toHaveProperty("current", "17.0.0");
      expect(parsed.dependencies[0]).toHaveProperty("latest", "18.0.0");
      expect(parsed.dependencies[0]).toHaveProperty("isPinned", false);
    }
  });

  test("should not show spinner when format option is set", async () => {
    await action({
      codependencies: ["react"],
      format: "json",
    });

    const spinnerCalls = consoleLogSpy.mock.calls.filter((call) => call[0]?.includes("wrestling"));
    expect(spinnerCalls.length).toBe(0);
  });

  test("should handle empty diffs with formatters", async () => {
    scriptSpy.mockResolvedValue([]);

    await action({
      codependencies: [],
      format: "json",
    });

    const output = consoleLogSpy.mock.calls.find((call) => call[0]?.includes("up-to-date"));
    expect(output).toBeDefined();
  });
});

const createActionsProject = (): string => {
  const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
  const targets = [
    { manager: "bun" },
    { manager: "uv" },
    { manager: "go" },
    { manager: "docker" },
    { manager: "github-actions" },
  ];
  fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));
  fs.writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify({ name: "fixture", packageManager: "bun@1.3.14" }),
  );
  fs.writeFileSync(join(rootDir, "go.mod"), "module example.com/fixture\n\ngo 1.26.4\n");
  fs.writeFileSync(join(rootDir, "mise.toml"), '[tools]\nuv = "0.8.0"\n');
  return rootDir;
};

const readWorkflow = (rootDir: string, area: string): string =>
  fs.readFileSync(join(rootDir, ".github", "workflows", `codependence-${area}.yml`), "utf8");

describe("GitHub Actions initializer", () => {
  test("generates split workflows with one shared default schedule", () => {
    const rootDir = createActionsProject();

    try {
      const paths = initGitHubActions({ rootDir });
      const workflows = ["node", "python", "go", "infrastructure"].map((area) =>
        readWorkflow(rootDir, area),
      );

      expect(paths.map((path) => path.split("/").at(-1))).toEqual([
        "codependence-node.yml",
        "codependence-python.yml",
        "codependence-go.yml",
        "codependence-infrastructure.yml",
      ]);
      expect(workflows.every((workflow) => workflow.includes('cron: "0 9 * * 1"'))).toBe(true);
      expect(workflows[0]).toContain("targets: bun\n          version: 1.3.14");
      expect(workflows[1]).toContain("targets: uv\n          version: 0.8.0");
      expect(workflows[2]).toContain("targets: go\n          version: 1.26.4");
      expect(workflows[3]).toContain("docker\n            github-actions");
      expect(workflows[0]).toContain("uses: yowainwright/codependence@v1");
      expect(workflows[0]).toContain("secrets.CODEPENDENCE_TOKEN");
      expect(workflows[0]).toContain("post-update-command: 'bun install'");
      expect(workflows[1]).toContain("post-update-command: 'uv lock'");
      expect(workflows[2]).toContain("post-update-command: 'go mod tidy'");
      expect(workflows[3]).toContain("post-update-command: 'git diff --check'");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("honors target-specific workflow options", () => {
    const rootDir = createActionsProject();
    const credentialName = ["AUTOMATION", "CREDENTIAL"].join("_");

    try {
      initGitHubActions({
        rootDir,
        targets: ["go"],
        versions: ["go=1.25.3"],
        schedules: ["go=30 7 * * 5"],
        postUpdateCommands: ["go=task go:tidy"],
        tokenSecret: credentialName,
      });

      const workflow = readWorkflow(rootDir, "go");
      expect(workflow).toContain('cron: "30 7 * * 5"');
      expect(workflow).toContain("version: 1.25.3");
      expect(workflow).toContain("post-update-command: 'task go:tidy'");
      expect(workflow).toContain(`secrets.${credentialName}`);
      expect(fs.existsSync(join(rootDir, ".github/workflows/codependence-node.yml"))).toBe(false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("detects versions from supported metadata files", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    const webDir = join(rootDir, "web");
    const pythonDir = join(rootDir, "python");
    const goDir = join(rootDir, "backend");
    fs.mkdirSync(webDir);
    fs.mkdirSync(pythonDir);
    fs.mkdirSync(goDir);
    const targets = [
      { manager: "pnpm", rootDir: "web" },
      { manager: "uv", rootDir: "python" },
      { manager: "go", rootDir: "backend" },
    ];
    fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));
    fs.writeFileSync(join(webDir, ".tool-versions"), "pnpm 10.12.1\n");
    fs.writeFileSync(join(pythonDir, "versions.env"), "UV_VERSION=0.8.2\n");
    fs.writeFileSync(
      join(goDir, "go.mod"),
      "module example.com/backend\n\ngo 1.24.0\ntoolchain go1.25.4\n",
    );

    try {
      initGitHubActions({ rootDir });

      expect(readWorkflow(rootDir, "node")).toContain("version: 10.12.1");
      expect(readWorkflow(rootDir, "python")).toContain("version: 0.8.2");
      expect(readWorkflow(rootDir, "go")).toContain("version: 1.25.4");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("groups multiple Node managers into one workflow", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    const targets = [{ manager: "bun" }, { manager: "npm" }];
    fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));

    try {
      initGitHubActions({
        rootDir,
        versions: ["bun=1.3.14", "npm=11.4.2"],
      });

      const workflow = readWorkflow(rootDir, "node");
      expect(workflow).toContain("targets: |\n            bun\n            npm");
      expect(workflow).toContain("version: |\n            bun=1.3.14\n            npm=11.4.2");
      expect(workflow).toContain("post-update-command: 'bun install && npm install'");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("supports prerelease versions and escapes workflow commands", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    const targets = [{ manager: "go" }];
    fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));

    try {
      initGitHubActions({
        rootDir,
        versions: ["go=v1.25.3-rc.1"],
        postUpdateCommands: ["go=echo it's ready"],
      });

      const workflow = readWorkflow(rootDir, "go");
      expect(workflow).toContain("version: v1.25.3-rc.1");
      expect(workflow).toContain("post-update-command: 'echo it''s ready'");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("requires a configuration with manager targets", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));

    try {
      expect(() => initGitHubActions({ rootDir })).toThrow("configuration not found");
      fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({}));
      expect(() => initGitHubActions({ rootDir })).toThrow("must define manager targets");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects unconfigured and unsupported managers", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    const configPath = join(rootDir, ".codependencerc");
    fs.writeFileSync(configPath, JSON.stringify({ targets: [{ manager: "bun" }] }));

    try {
      expect(() => initGitHubActions({ rootDir, targets: ["go"] })).toThrow(
        "Unknown configured target manager(s): go",
      );
      fs.writeFileSync(configPath, JSON.stringify({ targets: [{ manager: "rust" }] }));
      expect(() => initGitHubActions({ rootDir })).toThrow(
        "does not support target manager(s): rust",
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects malformed and unknown option assignments", () => {
    const rootDir = createActionsProject();

    try {
      expect(() => initGitHubActions({ rootDir, targets: ["go"], versions: ["go"] })).toThrow(
        "Versions must use name=value entries",
      );
      expect(() => initGitHubActions({ rootDir, targets: ["go"], versions: ["uv=0.8.0"] })).toThrow(
        "Unknown version manager(s): uv",
      );
      expect(() =>
        initGitHubActions({ rootDir, targets: ["go"], postUpdateCommands: ["python=uv lock"] }),
      ).toThrow("Unknown post-update command target(s): python");
      expect(() =>
        initGitHubActions({ rootDir, targets: ["go"], schedules: ["node=0 9 * * 1"] }),
      ).toThrow("Unknown schedule area(s): node");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid schedules and credential names", () => {
    const rootDir = createActionsProject();
    const invalidCredentialName = ["dependency", "updates"].join("-");

    try {
      expect(() =>
        initGitHubActions({ rootDir, targets: ["go"], schedules: ["go=weekly"] }),
      ).toThrow("Invalid cron schedule for: go");
      expect(() =>
        initGitHubActions({
          rootDir,
          targets: ["go"],
          tokenSecret: invalidCredentialName,
        }),
      ).toThrow("Invalid GitHub secret name");
      expect(fs.existsSync(join(rootDir, ".github"))).toBe(false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("fails before writing unsafe workflows", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    fs.writeFileSync(
      join(rootDir, ".codependencerc"),
      JSON.stringify({ targets: [{ manager: "uv" }] }),
    );

    try {
      expect(() => initGitHubActions({ rootDir })).toThrow("Pass --version uv=<version>");
      expect(() => initGitHubActions({ rootDir, versions: ["uv=0.8"] })).toThrow(
        "requires an exact tool version",
      );

      initGitHubActions({ rootDir, versions: ["uv=0.8.0"] });
      const workflowPath = join(rootDir, ".github/workflows/codependence-python.yml");
      fs.writeFileSync(workflowPath, "existing\n");

      expect(() => initGitHubActions({ rootDir, versions: ["uv=0.8.1"] })).toThrow(
        "Refusing to overwrite",
      );
      expect(fs.readFileSync(workflowPath, "utf8")).toBe("existing\n");

      initGitHubActions({ rootDir, versions: ["uv=0.8.1"], force: true });
      expect(fs.readFileSync(workflowPath, "utf8")).toContain("version: 0.8.1");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
