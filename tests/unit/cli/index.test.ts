import { test, beforeEach, afterEach, describe, mock } from "node:test";
import assert from "node:assert/strict";
import {
  assertCalledWith,
  assertNthCalledWith,
  assertProperty,
  assertRejects,
  assertThrows,
  match,
} from "../../helpers/assertions";
import type { Options } from "../../../src/types";
import fs from "node:fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { logger } from "../../../src/observability";
import * as config from "../../../src/config";
import { Prompt } from "../../../src/dx";
import { GENERATED_ACTION_HEADER } from "../../../src/cli/constants";

import {
  action,
  mergeConfigs,
  formatPerformanceMetrics,
  initAction,
  initGitHubActions,
  onboardAction,
  programDependencies,
  run,
} from "../../../src/cli";

const checkFilesMock = mock.fn(programDependencies.checkFiles);
const loadConfigMock = mock.fn(programDependencies.loadConfig);
const execMock = mock.fn(programDependencies.exec);
programDependencies.checkFiles = checkFilesMock;
programDependencies.loadConfig = loadConfigMock;
programDependencies.exec = execMock;

describe("Action Function Tests (Fast)", () => {
  let scriptSpy = checkFilesMock;

  beforeEach(() => {
    checkFilesMock.mock.resetCalls();
    checkFilesMock.mock.mockImplementation(async () => undefined);
    scriptSpy = checkFilesMock;
  });

  afterEach(() => {
    scriptSpy.mock.restore();
  });

  test("returns options with isTestingAction flag", async () => {
    const options = {
      codependencies: ["lodash"],
      isTestingAction: true,
    };

    const result = await action(options);

    assert.deepStrictEqual(result, {
      isCLI: true,
      codependencies: ["lodash"],
    });
  });

  test("handles isTestingCLI flag", async () => {
    const consoleLogSpy = mock.method(console, "log", () => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash", "fs-extra"],
    });

    assertCalledWith(consoleLogSpy, {
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash", "fs-extra"],
      },
    });

    consoleLogSpy.mock.restore();
  });

  test("merges CLI options with config", async () => {
    const result = await action({
      codependencies: ["lodash"],
      update: true,
      debug: true,
      silent: true,
      isTestingAction: true,
    });

    assert.deepStrictEqual(result, {
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

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.permissive, true);
      assert.strictEqual(result.isCLI, true);
    }
  });

  test("processes multiple CLI flags", async () => {
    const consoleLogSpy = mock.method(console, "log", () => {});

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

    assertCalledWith(consoleLogSpy, {
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

    consoleLogSpy.mock.restore();
  });

  test("processes config with searchPath", async () => {
    const result = await action({
      searchPath: "./custom/path",
      codependencies: ["test"], // Add codependencies to avoid undefined
      isTestingAction: true,
    });

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.isCLI, true);
      assert.deepStrictEqual(result.codependencies, ["test"]);
    }
  });

  test("handles verbose mode", async () => {
    const result = await action({
      codependencies: ["lodash"],
      verbose: true,
      isTestingAction: true,
    });

    assert.deepStrictEqual(result, {
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

    assert.deepStrictEqual(result, {
      isCLI: true,
      codependencies: ["lodash"],
      quiet: true,
    });
  });

  test("suppresses action output in silent and quiet modes", async () => {
    const stdoutSpy = mock.method(process.stdout, "write", () => true);

    await action({ mode: "precise", silent: true });
    await action({ mode: "precise", quiet: true });

    assert.strictEqual(stdoutSpy.mock.callCount(), 0);
    stdoutSpy.mock.restore();
  });

  test("processes codependencies from config", async () => {
    const result = await action({
      config: "./tests/unit/fixtures/.codependencerc",
      isTestingAction: true,
    });

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.isCLI, true);
      assert.notStrictEqual(result.codependencies, undefined);
    }
  });

  test("runs each named manifest config independently", async () => {
    const workDir = fs.mkdtempSync(join(tmpdir(), "codependence-targets-"));
    const configPath = join(workDir, ".codependencerc");
    const manifestConfig = {
      package: {
        path: "package.json",
        manager: "bun",
        codependencies: ["typescript"],
      },
      workflows: {
        path: ".github/workflows/update.yml",
        manager: "github-actions",
        mode: "precise",
      },
    };
    fs.writeFileSync(configPath, JSON.stringify({ config: manifestConfig }));

    try {
      await action({ config: configPath, update: true, silent: true });

      assert.strictEqual(scriptSpy.mock.callCount(), 2);
      assertNthCalledWith(
        scriptSpy,
        1,
        match.objectContaining({
          language: "nodejs",
          packageManager: "bun",
          files: ["package.json"],
          codependencies: ["typescript"],
          update: true,
        }),
      );
      assertNthCalledWith(
        scriptSpy,
        2,
        match.objectContaining({
          language: "github-actions",
          packageManager: "github-actions",
          files: [".github/workflows/update.yml"],
          mode: "precise",
          update: true,
        }),
      );
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("reports deferred target failures without a success message", async () => {
    const stdoutSpy = mock.method(process.stdout, "write", () => true);
    scriptSpy.mock.mockImplementationOnce(async (options) => {
      options.onDeferredFailure?.();
      return [];
    });
    scriptSpy.mock.mockImplementationOnce(async () => [], 1);

    try {
      await action({
        targets: [
          { manager: "bun", mode: "precise" },
          { manager: "github-actions", mode: "precise" },
        ],
      });

      const output = stdoutSpy.mock.calls.flatMap((call) => call.arguments).join("");
      assert.ok(output.includes("found dependency issues"));
      assert.ok(!output.includes("pinned!"));
    } finally {
      stdoutSpy.mock.restore();
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

      assertCalledWith(
        scriptSpy,
        match.objectContaining({
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
    const errorSpy = mock.method(console, "error", () => {});
    const exitSpy = mock.method(process, "exit", (() => {}) as () => never);

    try {
      await action({ config: configPath });

      const errorCalls = errorSpy.mock.calls.flatMap((call) => call.arguments).join(" ");
      assert.ok(errorCalls.includes("exactly one key"));
      assertCalledWith(exitSpy, 2);
      assert.strictEqual(scriptSpy.mock.callCount(), 0);
    } finally {
      errorSpy.mock.restore();
      exitSpy.mock.restore();
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("handles array of files", async () => {
    const consoleLogSpy = mock.method(console, "log", () => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash"],
      files: ["package.json", "packages/*/package.json", "apps/*/package.json"],
    });

    assertCalledWith(consoleLogSpy, {
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash"],
        files: ["package.json", "packages/*/package.json", "apps/*/package.json"],
      },
    });

    consoleLogSpy.mock.restore();
  });

  test("handles ignore patterns", async () => {
    const consoleLogSpy = mock.method(console, "log", () => {});

    await action({
      isTestingCLI: true,
      codependencies: ["react"],
      ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    });

    assertCalledWith(consoleLogSpy, {
      updatedOptions: {
        isCLI: true,
        codependencies: ["react"],
        ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
      },
    });

    consoleLogSpy.mock.restore();
  });

  test("handles complex codependencies", async () => {
    const consoleLogSpy = mock.method(console, "log", () => {});

    await action({
      isTestingCLI: true,
      codependencies: ["lodash", { "fs-extra": "10.0.1" }, "react@^18.0.0"],
    });

    assertCalledWith(consoleLogSpy, {
      updatedOptions: {
        isCLI: true,
        codependencies: ["lodash", { "fs-extra": "10.0.1" }, "react@^18.0.0"],
      },
    });

    consoleLogSpy.mock.restore();
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

    assert.deepStrictEqual(result, {
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
    scriptSpy.mock.restore();
    loadConfigMock.mock.mockImplementation(() => null);
    const configSpy = loadConfigMock;
    const errorSpy = mock.method(console, "error", () => {});
    const exitSpy = mock.method(process, "exit", (() => {}) as () => never);

    try {
      await action({
        permissive: false,
      });

      const errorCalls = errorSpy.mock.calls.flatMap((call) => call.arguments).join(" ");
      assert.ok(errorCalls.includes("codependencies"));
      assertCalledWith(exitSpy, 2);
    } finally {
      errorSpy.mock.restore();
      exitSpy.mock.restore();
      configSpy.mock.restore();
      checkFilesMock.mock.mockImplementation(async () => undefined);
      scriptSpy = checkFilesMock;
    }
  });

  test("should run in permissive mode when no options provided", async () => {
    loadConfigMock.mock.mockImplementation(() => null);
    const configSpy = loadConfigMock;

    await action({});

    assert.ok(scriptSpy.mock.callCount() > 0);
    configSpy.mock.restore();
  });

  test("should default listed codependencies to 0.x compatible verbose mode", async () => {
    await action({
      codependencies: ["lodash"],
    });

    const callArgs = scriptSpy.mock.calls[0].arguments[0];
    assert.strictEqual(callArgs.mode, "verbose");
  });

  test("should use precise mode when permissive is explicit", async () => {
    await action({
      codependencies: ["lodash"],
      permissive: true,
    });

    const callArgs = scriptSpy.mock.calls[0].arguments[0];
    assert.strictEqual(callArgs.mode, "precise");
  });

  test("should execute script with dry-run mode", async () => {
    const consoleSpy = mock.method(console, "log", () => {});

    await action({
      codependencies: ["lodash"],
      dryRun: true,
    });

    assert.ok(scriptSpy.mock.callCount() > 0);
    assertCalledWith(consoleSpy, match.stringContaining("Dry run"));
    consoleSpy.mock.restore();
  });

  test("should execute script with verbose mode", async () => {
    const consoleSpy = mock.method(console, "log", () => {});

    await action({
      codependencies: ["lodash"],
      verbose: true,
    });

    assert.ok(scriptSpy.mock.callCount() > 0);
    assert.ok(consoleSpy.mock.callCount() > 0);
    consoleSpy.mock.restore();
  });

  test("should execute script in normal mode", async () => {
    await action({
      codependencies: ["lodash"],
    });

    assert.ok(scriptSpy.mock.callCount() > 0);
  });

  test("should pass and invoke onProgress callback", async () => {
    await action({ codependencies: ["lodash"] });

    const callArgs = scriptSpy.mock.calls[0].arguments[0];
    assert.notStrictEqual(callArgs.onProgress, undefined);
    callArgs.onProgress(1, 5, "lodash");
  });

  test("should run in watch mode", async () => {
    const setIntervalSpy = mock.method(globalThis, "setInterval", (() => 0) as typeof setInterval);
    const consoleSpy = mock.method(console, "log", () => {});

    await action({ codependencies: ["lodash"], watch: true });

    assert.ok(scriptSpy.mock.callCount() > 0);
    assertCalledWith(setIntervalSpy, match.any(Function), 30000);
    setIntervalSpy.mock.restore();
    consoleSpy.mock.restore();
  });

  test("should skip overlapping watch mode intervals", async () => {
    let intervalCallback: (() => Promise<void>) | undefined;
    const setIntervalSpy = mock.method(globalThis, "setInterval", ((callback: TimerHandler) => {
      intervalCallback = callback as () => Promise<void>;
      return 0;
    }) as unknown as typeof setInterval);
    const consoleSpy = mock.method(console, "log", () => {});

    let resolveSecondRun: (() => void) | undefined;
    const secondRun = new Promise<void>((resolve) => {
      resolveSecondRun = resolve;
    });

    scriptSpy.mock.mockImplementationOnce(async () => undefined);
    scriptSpy.mock.mockImplementationOnce(() => secondRun, 1);

    await action({ codependencies: ["lodash"], watch: true });

    const inFlightCheck = intervalCallback?.();
    await Promise.resolve();
    await intervalCallback?.();

    assert.strictEqual(scriptSpy.mock.callCount(), 2);
    assertCalledWith(consoleSpy, match.stringContaining("Previous check still running"));

    resolveSecondRun?.();
    await inFlightCheck;

    setIntervalSpy.mock.restore();
    consoleSpy.mock.restore();
  });

  test("should log watch mode failures", async () => {
    let intervalCallback: (() => Promise<void>) | undefined;
    const setIntervalSpy = mock.method(globalThis, "setInterval", ((callback: TimerHandler) => {
      intervalCallback = callback as () => Promise<void>;
      return 0;
    }) as unknown as typeof setInterval);
    const consoleLogSpy = mock.method(console, "log", () => {});
    const consoleErrorSpy = mock.method(console, "error", () => {});

    scriptSpy.mock.mockImplementationOnce(async () => undefined);
    scriptSpy.mock.mockImplementationOnce(async () => {
      throw new Error("watch mode failure");
    }, 1);

    await action({ codependencies: ["lodash"], watch: true });
    await intervalCallback?.();

    assertCalledWith(consoleErrorSpy, match.stringContaining("Check failed: watch mode failure"));

    setIntervalSpy.mock.restore();
    consoleLogSpy.mock.restore();
    consoleErrorSpy.mock.restore();
  });

  test("should log deferred dependency issues in watch mode", async () => {
    const setIntervalSpy = mock.method(globalThis, "setInterval", (() => 0) as typeof setInterval);
    const consoleLogSpy = mock.method(console, "log", () => {});
    const consoleErrorSpy = mock.method(console, "error", () => {});
    scriptSpy.mock.mockImplementationOnce(async (options) => {
      options.onDeferredFailure?.();
      return [];
    });

    await action({ codependencies: ["lodash"], watch: true });

    assertCalledWith(consoleErrorSpy, match.stringContaining("Dependency issues found"));

    setIntervalSpy.mock.restore();
    consoleLogSpy.mock.restore();
    consoleErrorSpy.mock.restore();
  });
});

describe("initAction", () => {
  test("should handle existing .codependencerc", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", () => true);
    const warnSpy = mock.method(logger, "warn", () => {});

    await initAction("rc");

    assert.ok(warnSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    warnSpy.mock.restore();
  });

  test("should handle missing package.json", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", () => false);
    const errorSpy = mock.method(logger, "error", () => {});

    await initAction("rc");

    assert.ok(errorSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    errorSpy.mock.restore();
  });

  test("should handle invalid JSON in package.json", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () => "invalid json{");
    const errorSpy = mock.method(logger, "error", () => {});

    await initAction("rc");

    assert.ok(errorSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    errorSpy.mock.restore();
  });

  test("should handle no dependencies in package.json", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () => JSON.stringify({}));
    const errorSpy = mock.method(logger, "error", () => {});

    await initAction("rc");

    assert.ok(errorSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    errorSpy.mock.restore();
  });

  test("should create .codependencerc with non-interactive mode", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({
        dependencies: { lodash: "4.17.21" },
      }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await initAction("rc");

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    const callArgs = writeFileSyncSpy.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0], ".codependencerc");

    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  test("should create .codependencerc with explicit dependency array", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({
        dependencies: { lodash: "4.17.21", react: "18.0.0" },
      }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await initAction(["lodash"]);

    const callArgs = writeFileSyncSpy.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0], ".codependencerc");
    assert.deepStrictEqual(JSON.parse(callArgs[1] as string), {
      codependencies: ["lodash"],
    });

    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  test("should reject explicit dependency array without matching package dependencies", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () => JSON.stringify({}));
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});
    const errorSpy = mock.method(logger, "error", () => {});

    await initAction(["lodash"]);

    assert.strictEqual(writeFileSyncSpy.mock.callCount(), 0);
    assertCalledWith(errorSpy, "Requested dependencies not found in package.json: lodash");

    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
    errorSpy.mock.restore();
  });

  test("should create package.json config with package type", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const packageJsonContent = JSON.stringify({
      name: "test",
      dependencies: { lodash: "4.17.21" },
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () => packageJsonContent);
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await initAction("package");

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    const callArgs = writeFileSyncSpy.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0], "package.json");

    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  test("should handle default type", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({
        dependencies: { lodash: "4.17.21" },
      }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await initAction("default");

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  const mockFsForInteractive = () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({ dependencies: { lodash: "4.17.21", react: "18.0.0" } }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});
    const consoleSpy = mock.method(console, "log", () => {});
    return { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy };
  };

  test("should handle interactive mode - permissive with selected deps", async () => {
    const { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy } = mockFsForInteractive();
    const radioSpy = mock.method(Prompt.prototype, "radio");
    radioSpy.mock.mockImplementationOnce(async () => "permissive");
    radioSpy.mock.mockImplementationOnce(async () => "rc", 1);
    const selectSpy = mock.method(Prompt.prototype, "select", async () => ["lodash"]);
    const closeSpy = mock.method(Prompt.prototype, "close");

    await initAction();

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
    consoleSpy.mock.restore();
    radioSpy.mock.restore();
    selectSpy.mock.restore();
    closeSpy.mock.restore();
  });

  test("should handle interactive mode - permissive with no deps selected", async () => {
    const { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy } = mockFsForInteractive();
    const radioSpy = mock.method(Prompt.prototype, "radio");
    radioSpy.mock.mockImplementationOnce(async () => "permissive");
    radioSpy.mock.mockImplementationOnce(async () => "rc", 1);
    const selectSpy = mock.method(Prompt.prototype, "select", async () => []);
    const closeSpy = mock.method(Prompt.prototype, "close");

    await initAction();

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
    consoleSpy.mock.restore();
    radioSpy.mock.restore();
    selectSpy.mock.restore();
    closeSpy.mock.restore();
  });

  test("should handle interactive mode - pin all deps", async () => {
    const { existsSyncSpy, readFileSyncSpy, writeFileSyncSpy, consoleSpy } = mockFsForInteractive();
    const radioSpy = mock.method(Prompt.prototype, "radio");
    radioSpy.mock.mockImplementationOnce(async () => "all");
    radioSpy.mock.mockImplementationOnce(async () => "rc", 1);
    const closeSpy = mock.method(Prompt.prototype, "close");

    await initAction();

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
    consoleSpy.mock.restore();
    radioSpy.mock.restore();
    closeSpy.mock.restore();
  });
});

describe("run", () => {
  let scriptSpy = checkFilesMock;

  beforeEach(() => {
    checkFilesMock.mock.resetCalls();
    checkFilesMock.mock.mockImplementation(async () => undefined);
    scriptSpy = checkFilesMock;
  });

  afterEach(() => {
    scriptSpy.mock.restore();
  });

  test("should show help when --help flag is provided", async () => {
    const consoleSpy = mock.method(console, "log", () => {});

    await run(["node", "script.js", "--help"]);

    assert.ok(consoleSpy.mock.callCount() > 0);
    consoleSpy.mock.restore();
  });

  test("should call initAction for init command", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", () => true);
    const warnSpy = mock.method(logger, "warn", () => {});

    await run(["node", "script.js", "init", "rc"]);

    assert.ok(warnSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    warnSpy.mock.restore();
  });

  test("should call action for regular command", async () => {
    await run(["node", "script.js", "--codependencies", "lodash"]);

    assert.ok(scriptSpy.mock.callCount() > 0);
  });

  test("rejects the removed onboard command", async () => {
    await assertRejects(run(["node", "script.js", "onboard"]), "Unknown command: onboard");
  });

  test("should handle init command with package type", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({ dependencies: { lodash: "4.17.21" } }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await run(["node", "script.js", "init", "package"]);

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  test("should handle init command with default type", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({ dependencies: { lodash: "4.17.21" } }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await run(["node", "script.js", "init", "default"]);

    assert.ok(writeFileSyncSpy.mock.callCount() > 0);
    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  test("should handle init command with explicit dependency names", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({
        dependencies: { lodash: "4.17.21", react: "18.0.0" },
      }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await run(["node", "script.js", "init", "rc", "lodash"]);

    const callArgs = writeFileSyncSpy.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0], ".codependencerc");
    assert.deepStrictEqual(JSON.parse(callArgs[1] as string), {
      codependencies: ["lodash"],
    });

    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  test("should handle init command with codependencies option", async () => {
    const existsSyncSpy = mock.method(fs, "existsSync", (path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });
    const readFileSyncSpy = mock.method(fs, "readFileSync", () =>
      JSON.stringify({
        dependencies: { lodash: "4.17.21", react: "18.0.0" },
      }),
    );
    const writeFileSyncSpy = mock.method(fs, "writeFileSync", () => {});

    await run(["node", "script.js", "init", "rc", "--codependencies", "lodash", "react"]);

    const callArgs = writeFileSyncSpy.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0], ".codependencerc");
    assert.deepStrictEqual(JSON.parse(callArgs[1] as string), {
      codependencies: ["lodash", "react"],
    });

    existsSyncSpy.mock.restore();
    readFileSyncSpy.mock.restore();
    writeFileSyncSpy.mock.restore();
  });

  test("routes positional action targets through the CLI", async () => {
    const rootDir = createActionsProject();
    const infoSpy = mock.method(logger, "info", () => {});

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
      assert.strictEqual(fs.existsSync(goWorkflow), true);
      assert.strictEqual(fs.existsSync(nodeWorkflow), false);
      assertCalledWith(infoSpy, `Created ${goWorkflow}`);
    } finally {
      infoSpy.mock.restore();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

const createOnboardingProject = (
  packageJson: Record<string, unknown>,
  files: Record<string, string> = {},
): string => {
  const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-onboarding-unit-"));
  fs.writeFileSync(join(rootDir, "package.json"), JSON.stringify(packageJson));
  Object.entries(files).forEach(([path, content]) => {
    const destination = join(rootDir, path);
    fs.mkdirSync(dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  });
  return rootDir;
};

describe("onboardAction", () => {
  test("routes init config to configuration-only setup", async () => {
    const rootDir = createOnboardingProject(
      { name: "web", packageManager: "pnpm@9.15.0" },
      { "pnpm-lock.yaml": "" },
    );

    try {
      await run([
        "node",
        "script.js",
        "init",
        "config",
        rootDir,
        "--mode",
        "precise",
        "--non-interactive",
      ]);

      const packageJson = JSON.parse(fs.readFileSync(join(rootDir, "package.json"), "utf8"));
      assert.strictEqual(packageJson.codependence.config.root.path, "package.json");
      assert.strictEqual(fs.existsSync(join(rootDir, ".github")), false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("configures a Go project without package.json", async () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-onboarding-unit-"));
    fs.writeFileSync(join(rootDir, "go.mod"), "module example.com/api\n\ngo 1.26\n");

    try {
      await run([
        "node",
        "script.js",
        "init",
        "config",
        rootDir,
        "--mode",
        "precise",
        "--non-interactive",
      ]);

      const result = config.loadConfig(join(rootDir, ".codependencerc"));
      assert.deepStrictEqual(result?.config, {
        config: { "go.mod": { path: "go.mod", manager: "go", mode: "precise" } },
      });
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("generates GitHub enforcement for a Go project", async () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-onboarding-unit-"));
    fs.writeFileSync(join(rootDir, "go.mod"), "module example.com/api\n\ngo 1.26.4\n");

    try {
      await run([
        "node",
        "script.js",
        "init",
        rootDir,
        "--mode",
        "precise",
        "--enforcement",
        "github",
        "--repository",
        "acme/api",
        "--non-interactive",
      ]);

      const workflowPath = join(rootDir, ".github/workflows/codependence-go.yml");
      assert.ok(fs.readFileSync(workflowPath, "utf8").includes("targets: go"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("preserves existing named config while updating detected manifests", async () => {
    const existing = {
      $schema: "https://unpkg.com/codependence/src/config/schema.json",
      update: true,
      config: {
        web: {
          name: "web",
          path: "package.json",
          manager: "npm",
          mode: "verbose",
          codependencies: ["react"],
        },
        api: { path: "services/api/go.mod", manager: "go", mode: "precise" },
      },
    };
    const rootDir = createOnboardingProject(
      { name: "web", packageManager: "pnpm@9.15.0" },
      { ".codependencerc.yml": JSON.stringify(existing) },
    );

    try {
      await run([
        "node",
        "script.js",
        "init",
        "config",
        rootDir,
        "--mode",
        "precise",
        "--non-interactive",
      ]);

      const result = config.loadConfig(join(rootDir, ".codependencerc.yml"));
      assert.deepStrictEqual(result?.config, {
        $schema: existing.$schema,
        update: true,
        config: {
          web: { name: "web", path: "package.json", manager: "pnpm", mode: "precise" },
          api: existing.config.api,
        },
      });
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("preserves supplemental options when creating named config", async () => {
    const existing = {
      $schema: "https://unpkg.com/codependence/src/config/schema.json",
      update: true,
    };
    const rootDir = createOnboardingProject(
      { name: "web", packageManager: "pnpm@9.15.0" },
      { ".codependencerc": JSON.stringify(existing) },
    );

    try {
      await onboardAction({
        rootDir,
        mode: "precise",
        enforcement: "local",
        nonInteractive: true,
        skipInstall: true,
      });

      const result = config.loadConfig(join(rootDir, ".codependencerc"));
      assert.strictEqual(result?.config.$schema, existing.$schema);
      assert.strictEqual(result?.config.update, true);
      assert.strictEqual(result?.config.config.root.path, "package.json");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("refuses to replace flat configuration", async () => {
    const rootDir = createOnboardingProject(
      { name: "web", packageManager: "pnpm@9.15.0" },
      { ".codependencerc": JSON.stringify({ mode: "precise" }) },
    );

    try {
      await assertRejects(
        onboardAction({
          rootDir,
          mode: "precise",
          enforcement: "local",
          nonInteractive: true,
          skipInstall: true,
        }),
        "Init cannot safely replace a flat or targets configuration",
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rolls back configuration when workflow generation fails", async () => {
    const packageJson = { name: "mixed", packageManager: "npm@10.9.2" };
    const rootDir = createOnboardingProject(packageJson, {
      "package-lock.json": "",
      "Cargo.toml": '[package]\nname = "mixed"\n',
    });

    try {
      await assertRejects(
        onboardAction({
          rootDir,
          mode: "precise",
          enforcement: "github",
          repository: "acme/mixed",
          nonInteractive: true,
        }),
        "Missing exact tool version for: rust",
      );

      const restoredPackage = JSON.parse(fs.readFileSync(join(rootDir, "package.json"), "utf8"));
      assert.deepStrictEqual(restoredPackage, packageJson);
      assert.strictEqual(fs.existsSync(join(rootDir, ".codependencerc")), false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("writes local and GitHub setup without installing when configured", async () => {
    const packageJson = {
      name: "workspace",
      packageManager: "pnpm@9.15.0",
      workspaces: ["packages/*"],
      dependencies: { react: "^19.0.0" },
    };
    const files = {
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/ui/package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }),
    };
    const rootDir = createOnboardingProject(packageJson, files);
    const printSpy = mock.method(logger, "print", () => {});
    const closeSpy = mock.method(Prompt.prototype, "close");

    try {
      await run([
        "node",
        "script.js",
        "init",
        "--rootDir",
        rootDir,
        "--mode",
        "precise",
        "--codependencies",
        "react",
        "--enforcement",
        "both",
        "--repository",
        "acme/workspace",
        "--non-interactive",
        "--skip-install",
      ]);

      assert.strictEqual(fs.existsSync(join(rootDir, ".codependencerc")), true);
      assert.strictEqual(
        fs.existsSync(join(rootDir, ".github/workflows/codependence-node.yml")),
        true,
      );
      assertCalledWith(printSpy, "Configured 2 manifest(s).");
      assert.ok(closeSpy.mock.callCount() > 0);

      await assertRejects(
        onboardAction({
          rootDir,
          mode: "precise",
          enforcement: "both",
          repository: "acme/workspace",
          nonInteractive: true,
          skipInstall: true,
        }),
        "Refusing to overwrite onboarding files",
      );

      await onboardAction({
        rootDir,
        mode: "precise",
        enforcement: "both",
        repository: "acme/workspace",
        nonInteractive: true,
        skipInstall: true,
        force: true,
      });
    } finally {
      printSpy.mock.restore();
      closeSpy.mock.restore();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("collects interactive local answers and installs the CLI", async () => {
    const packageJson = { dependencies: { react: "^19.0.0" } };
    const rootDir = createOnboardingProject(packageJson, { "package-lock.json": "" });
    const radioSpy = mock.method(Prompt.prototype, "radio");
    radioSpy.mock.mockImplementationOnce(async () => "verbose");
    radioSpy.mock.mockImplementationOnce(async () => "local", 1);
    const selectSpy = mock.method(Prompt.prototype, "select", async () => ["react"]);
    const closeSpy = mock.method(Prompt.prototype, "close");
    const printSpy = mock.method(logger, "print", () => {});
    execMock.mock.mockImplementation(async () => ({ stdout: "", stderr: "" }));
    const execSpy = execMock;

    try {
      await onboardAction({ rootDir });

      assertCalledWith(execSpy, "npm", ["install", "--save-dev", "codependence"], {
        cwd: rootDir,
      });
      const configuredPackage = JSON.parse(fs.readFileSync(join(rootDir, "package.json"), "utf8"));
      assert.notStrictEqual(configuredPackage.codependence, undefined);
      assert.strictEqual(fs.existsSync(join(rootDir, ".github")), false);
      assert.ok(closeSpy.mock.callCount() > 0);
    } finally {
      execSpy.mock.restore();
      printSpy.mock.restore();
      closeSpy.mock.restore();
      selectSpy.mock.restore();
      radioSpy.mock.restore();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("collects interactive GitHub repository and version answers", async () => {
    const packageJson = { dependencies: { react: "^19.0.0" } };
    const rootDir = createOnboardingProject(packageJson, { "package-lock.json": "" });
    const radioSpy = mock.method(Prompt.prototype, "radio");
    radioSpy.mock.mockImplementationOnce(async () => "precise");
    radioSpy.mock.mockImplementationOnce(async () => "github", 1);
    const selectSpy = mock.method(Prompt.prototype, "select", async () => []);
    const inputSpy = mock.method(Prompt.prototype, "input");
    inputSpy.mock.mockImplementationOnce(async () => "acme/web");
    inputSpy.mock.mockImplementationOnce(async () => "10.9.2", 1);
    const closeSpy = mock.method(Prompt.prototype, "close");
    const printSpy = mock.method(logger, "print", () => {});

    try {
      await onboardAction({ rootDir });

      const workflowPath = join(rootDir, ".github/workflows/codependence-node.yml");
      assert.ok(fs.readFileSync(workflowPath, "utf8").includes("version: 10.9.2"));
      assert.strictEqual(inputSpy.mock.callCount(), 2);
    } finally {
      printSpy.mock.restore();
      closeSpy.mock.restore();
      inputSpy.mock.restore();
      selectSpy.mock.restore();
      radioSpy.mock.restore();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("accepts an assigned manager version in non-interactive GitHub mode", async () => {
    const rootDir = createOnboardingProject({}, { "package-lock.json": "" });
    const closeSpy = mock.method(Prompt.prototype, "close");
    const printSpy = mock.method(logger, "print", () => {});

    try {
      await onboardAction({
        rootDir,
        mode: "precise",
        enforcement: "github",
        repository: "acme/web",
        version: ["npm=10.9.2"],
        nonInteractive: true,
      });

      const workflowPath = join(rootDir, ".github/workflows/codependence-node.yml");
      assert.ok(fs.readFileSync(workflowPath, "utf8").includes("version: 10.9.2"));
    } finally {
      printSpy.mock.restore();
      closeSpy.mock.restore();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("reports missing non-interactive answers", async () => {
    const versionedPackage = { packageManager: "npm@10.9.2" };
    const rootDir = createOnboardingProject(versionedPackage, { "package-lock.json": "" });
    const unversionedRoot = createOnboardingProject({}, { "package-lock.json": "" });
    const closeSpy = mock.method(Prompt.prototype, "close");

    try {
      await assertRejects(
        onboardAction({ rootDir, nonInteractive: true }),
        "Onboarding requires --mode",
      );
      await assertRejects(
        onboardAction({ rootDir, mode: "precise", nonInteractive: true }),
        "Onboarding requires --enforcement",
      );
      await assertRejects(
        onboardAction({
          rootDir,
          mode: "precise",
          enforcement: "github",
          nonInteractive: true,
        }),
        "GitHub onboarding requires --repository",
      );
      await assertRejects(
        onboardAction({
          rootDir: unversionedRoot,
          mode: "precise",
          enforcement: "github",
          repository: "acme/web",
          nonInteractive: true,
        }),
        "GitHub onboarding requires --version",
      );
    } finally {
      closeSpy.mock.restore();
      fs.rmSync(rootDir, { recursive: true, force: true });
      fs.rmSync(unversionedRoot, { recursive: true, force: true });
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

    assert.strictEqual(result.update, true);
    assert.strictEqual(result.verbose, true);
    assert.deepStrictEqual(result.codependencies, ["lodash"]);
    assert.strictEqual(result.permissive, false);
    assert.strictEqual(result.isCLI, true);
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

    assert.deepStrictEqual(result.codependencies, ["express"]);
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

    assert.deepStrictEqual(result.codependencies, ["react"]);
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

    assert.strictEqual(result.codependencies, undefined);
    assert.strictEqual(result.permissive, undefined);
    assert.strictEqual(result.update, true);
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

    assert.deepStrictEqual(result.codependencies, ["lodash"]);
    assert.strictEqual(result.permissive, true);
    assert.strictEqual((result as Record<string, unknown>).otherKey, undefined);
  });

  test("should handle empty configs", () => {
    const options: Options = {};
    const baseConfig = {};
    const pathConfig = {};

    const result = mergeConfigs(options, baseConfig, pathConfig);

    assert.strictEqual(result.isCLI, true);
  });

  test("should remove config and searchPath from result", () => {
    const options: Options = {
      config: "/path/to/config",
      searchPath: "/search/path",
    };
    const baseConfig = {};
    const pathConfig = {};

    const result = mergeConfigs(options, baseConfig, pathConfig);

    assert.strictEqual(result.config, undefined);
    assert.strictEqual(result.searchPath, undefined);
  });

  test("should remove isTestingCLI and isTestingAction", () => {
    const options: Options = {
      isTestingCLI: true,
      isTestingAction: true,
    };
    const baseConfig = {};
    const pathConfig = {};

    const result = mergeConfigs(options, baseConfig, pathConfig);

    assert.strictEqual(result.isTestingCLI, undefined);
    assert.strictEqual(result.isTestingAction, undefined);
  });

  test("should handle null codependence key", () => {
    const options: Options = {};
    const baseConfig = {};
    const pathConfig = {
      codependence: null,
      otherKey: "value",
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    assert.strictEqual((result as Record<string, unknown>).otherKey, "value");
  });

  test("should handle non-object codependence key", () => {
    const options: Options = {};
    const baseConfig = {};
    const pathConfig = {
      codependence: "string value",
      otherKey: "value",
    };

    const result = mergeConfigs(options, baseConfig, pathConfig);

    assert.strictEqual((result as Record<string, unknown>).otherKey, "value");
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

    assert.strictEqual(result.update, true);
    assert.strictEqual(result.verbose, true);
    assert.deepStrictEqual(result.files, ["packages/*/package.json"]);
    assert.deepStrictEqual(result.codependencies, ["react"]);
    assert.strictEqual(result.permissive, true);
    assert.strictEqual(result.rootDir, undefined);
  });
});

describe("formatPerformanceMetrics", () => {
  test("should format metrics with cache hits", () => {
    const duration = 1500;
    const stats = { hits: 10, misses: 2, size: 12 };
    const hitRate = 83.33;

    const result = formatPerformanceMetrics(duration, stats, hitRate);
    const joined = result.join("\n");

    assert.ok(joined.includes("Performance:"));
    assert.ok(joined.includes("Completed in 1500ms"));
    assert.ok(joined.includes("Cache: 10 hits, 2 misses (83.3% hit rate)"));
    assert.ok(joined.includes("12 packages cached"));
  });

  test("should format metrics with no cache", () => {
    const duration = 3000;
    const stats = { hits: 0, misses: 0, size: 0 };
    const hitRate = 0;

    const result = formatPerformanceMetrics(duration, stats, hitRate);
    const joined = result.join("\n");

    assert.ok(joined.includes("Performance:"));
    assert.ok(joined.includes("Completed in 3000ms"));
    assert.ok(joined.includes("No cache hits (first run)"));
    assert.ok(!joined.includes("% hit rate"));
  });

  test("should format hit rate with one decimal place", () => {
    const duration = 1000;
    const stats = { hits: 7, misses: 3, size: 10 };
    const hitRate = 70.0;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    const joinedResult = result.join("\n");
    assert.ok(joinedResult.includes("70.0% hit rate"));
  });

  test("should handle 100% hit rate", () => {
    const duration = 500;
    const stats = { hits: 15, misses: 0, size: 15 };
    const hitRate = 100;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    const joinedResult = result.join("\n");
    assert.ok(joinedResult.includes("100.0% hit rate"));
    assert.ok(joinedResult.includes("15 packages cached"));
  });

  test("should return array of strings", () => {
    const duration = 1000;
    const stats = { hits: 5, misses: 5, size: 10 };
    const hitRate = 50;

    const result = formatPerformanceMetrics(duration, stats, hitRate);

    assert.strictEqual(Array.isArray(result), true);
    assert.ok(result.length > 0);
    result.forEach((line) => {
      assert.strictEqual(typeof line, "string");
    });
  });
});

describe("Format and Output File Tests", () => {
  let writeFileSpy: ReturnType<typeof mock.method>;
  let consoleLogSpy: ReturnType<typeof mock.method>;

  beforeEach(() => {
    writeFileSpy = mock.method(fs, "writeFileSync", () => {});
    consoleLogSpy = mock.method(console, "log", () => {});
  });

  afterEach(() => {
    writeFileSpy.mock.restore();
    consoleLogSpy.mock.restore();
  });

  test("should accept format option in action", async () => {
    const result = await action({
      codependencies: ["react"],
      format: "json",
      isTestingAction: true,
    });

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.format, "json");
    }
  });

  test("should accept outputFile option in action", async () => {
    const result = await action({
      codependencies: ["react"],
      outputFile: "/tmp/output.json",
      isTestingAction: true,
    });

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.outputFile, "/tmp/output.json");
    }
  });

  test("should accept both format and outputFile options", async () => {
    const result = await action({
      codependencies: ["react"],
      format: "markdown",
      outputFile: "/tmp/output.md",
      isTestingAction: true,
    });

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.format, "markdown");
      assert.strictEqual(result.outputFile, "/tmp/output.md");
    }
  });

  test("should accept table format option", async () => {
    const result = await action({
      codependencies: ["react"],
      format: "table",
      isTestingAction: true,
    });

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.format, "table");
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

    assert.notStrictEqual(result, undefined);
    if (result && typeof result === "object") {
      assert.strictEqual(result.format, "json");
      assert.strictEqual(result.debug, true);
      assert.strictEqual(result.verbose, true);
    }
  });
});

describe("Format Integration Tests", () => {
  let scriptSpy = checkFilesMock;
  let writeFileSpy: ReturnType<typeof mock.method>;
  let consoleLogSpy: ReturnType<typeof mock.method>;

  beforeEach(() => {
    checkFilesMock.mock.restore();
    checkFilesMock.mock.resetCalls();
    checkFilesMock.mock.mockImplementation(async () => [
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
    scriptSpy = checkFilesMock;

    writeFileSpy = mock.method(fs, "writeFileSync", () => {});
    consoleLogSpy = mock.method(console, "log", () => {});
  });

  afterEach(() => {
    scriptSpy.mock.restore();
    writeFileSpy.mock.restore();
    consoleLogSpy.mock.restore();
  });

  test("should call script with onProgress callback when format is set", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "json",
    });

    assert.ok(scriptSpy.mock.callCount() > 0);
    const callArgs = scriptSpy.mock.calls[0].arguments[0];
    assertProperty(callArgs, "onProgress");
    assert.strictEqual(typeof callArgs.onProgress, "function");
  });

  test("should write JSON output to file when outputFile is specified", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "json",
      outputFile: "/tmp/test-output.json",
    });

    assertCalledWith(writeFileSpy, "/tmp/test-output.json", match.stringContaining('"status"'));
  });

  test("should write markdown output to console when no outputFile", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "markdown",
    });

    const jsonCalls = consoleLogSpy.mock.calls.filter((call) =>
      call.arguments[0]?.includes("# Dependency Status"),
    );
    assert.ok(jsonCalls.length > 0);
  });

  test("should write table output to console when format is table", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "table",
    });

    const tableCalls = consoleLogSpy.mock.calls.filter((call) =>
      call.arguments[0]?.includes("Outdated"),
    );
    assert.ok(tableCalls.length > 0);
  });

  test("should transform diffs to DependencyInfo format", async () => {
    await action({
      codependencies: ["react", "lodash"],
      format: "json",
    });

    const jsonOutput = consoleLogSpy.mock.calls.find((call) =>
      call.arguments[0]?.includes('"package"'),
    );
    assert.notStrictEqual(jsonOutput, undefined);

    if (jsonOutput && jsonOutput.arguments[0]) {
      const parsed = JSON.parse(jsonOutput.arguments[0]);
      assertProperty(parsed.dependencies[0], "package", "react");
      assertProperty(parsed.dependencies[0], "current", "17.0.0");
      assertProperty(parsed.dependencies[0], "latest", "18.0.0");
      assertProperty(parsed.dependencies[0], "isPinned", false);
    }
  });

  test("should not show spinner when format option is set", async () => {
    await action({
      codependencies: ["react"],
      format: "json",
    });

    const spinnerCalls = consoleLogSpy.mock.calls.filter((call) =>
      call.arguments[0]?.includes("wrestling"),
    );
    assert.strictEqual(spinnerCalls.length, 0);
  });

  test("should handle empty diffs with formatters", async () => {
    scriptSpy.mock.mockImplementation(async () => []);

    await action({
      codependencies: [],
      format: "json",
    });

    const output = consoleLogSpy.mock.calls.find((call) =>
      call.arguments[0]?.includes("up-to-date"),
    );
    assert.notStrictEqual(output, undefined);
  });
});

const createActionsProject = (): string => {
  const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
  const targets = [
    { manager: "bun" },
    { manager: "uv" },
    { manager: "go" },
    { manager: "rust" },
    { manager: "docker" },
    { manager: "github-actions" },
  ];
  fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));
  fs.writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify({ name: "fixture", packageManager: "bun@1.3.14" }),
  );
  fs.writeFileSync(join(rootDir, "go.mod"), "module example.com/fixture\n\ngo 1.26.4\n");
  fs.writeFileSync(
    join(rootDir, "rust-toolchain.toml"),
    '[toolchain]\nchannel = "1.88.0" # CI toolchain\n',
  );
  fs.writeFileSync(join(rootDir, "mise.toml"), '[tools]\nuv = "0.8.0"\n');
  return rootDir;
};

const createDockerActionsProject = (): string => {
  const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-docker-actions-unit-"));
  const targets = [{ manager: "docker" }];
  fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));
  return rootDir;
};

const legacyCombinedWorkflow = (schedule: string): string => `${GENERATED_ACTION_HEADER}
on:
  schedule:
    - cron: "${schedule}"
targets: |
  docker
  github-actions
`;

const readWorkflow = (rootDir: string, area: string): string =>
  fs.readFileSync(join(rootDir, ".github", "workflows", `codependence-${area}.yml`), "utf8");

const workflowAreas = ["node", "python", "go", "rust", "docker", "infrastructure"];

const expectedWorkflowFiles = workflowAreas.map((area) => `codependence-${area}.yml`);

const readGeneratedWorkflows = (rootDir: string): string[] =>
  workflowAreas.map((area) => readWorkflow(rootDir, area));

const expectWorkflowTargets = (workflows: string[]): void => {
  assert.ok(workflows[0].includes("targets: bun\n          version: 1.3.14"));
  assert.ok(workflows[1].includes("targets: uv\n          version: 0.8.0"));
  assert.ok(workflows[2].includes("targets: go\n          version: 1.26.4"));
  assert.ok(workflows[3].includes("targets: rust\n          version: 1.88.0"));
  assert.ok(workflows[4].includes("targets: docker"));
  assert.ok(workflows[5].includes("targets: github-actions"));
};

const expectWorkflowCommands = (workflows: string[]): void => {
  assert.ok(workflows[0].includes("post-update-command: 'bun install'"));
  assert.ok(workflows[1].includes("post-update-command: 'uv lock'"));
  assert.ok(workflows[2].includes("post-update-command: 'go mod tidy'"));
  assert.ok(workflows[3].includes("post-update-command: 'cargo generate-lockfile'"));
  assert.ok(workflows[4].includes("post-update-command: 'git diff --check'"));
  assert.ok(workflows[5].includes("post-update-command: 'git diff --check'"));
};

const expectWorkflowDefaults = (workflows: string[]): void => {
  const hasDefaultSchedule = workflows.every((workflow) => workflow.includes('cron: "0 9 * * 1"'));
  assert.strictEqual(hasDefaultSchedule, true);
  assert.ok(workflows[0].includes("uses: yowainwright/codependence@v1"));
  assert.ok(workflows[0].includes("secrets.CODEPENDENCE_TOKEN"));
  assert.ok(workflows[4].includes("pull-request: true"));
};

describe("GitHub Actions initializer", () => {
  test("splits a legacy generated combined infrastructure workflow for Docker", () => {
    const rootDir = createDockerActionsProject();
    const legacyPath = join(rootDir, ".github/workflows/codependence-infrastructure.yml");
    const schedule = "15 4 * * 2";
    const legacyWorkflow = legacyCombinedWorkflow(schedule);
    fs.mkdirSync(join(rootDir, ".github/workflows"), { recursive: true });
    fs.writeFileSync(legacyPath, legacyWorkflow);

    try {
      assertThrows(() => initGitHubActions({ rootDir }), "Refusing to overwrite");
      initGitHubActions({ force: true, rootDir });
      const infrastructureWorkflow = fs.readFileSync(legacyPath, "utf8");
      assert.ok(infrastructureWorkflow.includes("targets: |\n  github-actions"));
      assert.ok(!infrastructureWorkflow.includes("\n  docker\n"));
      assert.ok(infrastructureWorkflow.includes(`cron: "${schedule}"`));
      assert.ok(readWorkflow(rootDir, "docker").includes("targets: docker"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("retires a legacy generated Docker-only infrastructure workflow", () => {
    const rootDir = createDockerActionsProject();
    const legacyPath = join(rootDir, ".github/workflows/codependence-infrastructure.yml");
    fs.mkdirSync(join(rootDir, ".github/workflows"), { recursive: true });
    fs.writeFileSync(legacyPath, `${GENERATED_ACTION_HEADER}\ntargets: docker\n`);

    try {
      initGitHubActions({ force: true, rootDir });
      assert.strictEqual(fs.existsSync(legacyPath), false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("preserves a user-authored infrastructure workflow for Docker", () => {
    const rootDir = createDockerActionsProject();
    const legacyPath = join(rootDir, ".github/workflows/codependence-infrastructure.yml");
    const workflow = "name: Custom infrastructure workflow\n";
    fs.mkdirSync(join(rootDir, ".github/workflows"), { recursive: true });
    fs.writeFileSync(legacyPath, workflow);

    try {
      initGitHubActions({ force: true, rootDir });
      assert.strictEqual(fs.readFileSync(legacyPath, "utf8"), workflow);
      assert.ok(readWorkflow(rootDir, "docker").includes("targets: docker"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("preserves a generated infrastructure workflow that does not target Docker", () => {
    const rootDir = createDockerActionsProject();
    const legacyPath = join(rootDir, ".github/workflows/codependence-infrastructure.yml");
    const workflow = `${GENERATED_ACTION_HEADER}\ntargets: github-actions\n`;
    fs.mkdirSync(join(rootDir, ".github/workflows"), { recursive: true });
    fs.writeFileSync(legacyPath, workflow);

    try {
      initGitHubActions({ force: true, rootDir });
      assert.strictEqual(fs.readFileSync(legacyPath, "utf8"), workflow);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("generates split workflows with one shared default schedule", () => {
    const rootDir = createActionsProject();

    try {
      const paths = initGitHubActions({ rootDir });
      const workflows = readGeneratedWorkflows(rootDir);

      assert.deepStrictEqual(
        paths.map((path) => path.split("/").at(-1)),
        expectedWorkflowFiles,
      );
      expectWorkflowDefaults(workflows);
      expectWorkflowTargets(workflows);
      expectWorkflowCommands(workflows);
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
      assert.ok(workflow.includes('cron: "30 7 * * 5"'));
      assert.ok(workflow.includes("version: 1.25.3"));
      assert.ok(workflow.includes("post-update-command: 'task go:tidy'"));
      assert.ok(workflow.includes(`secrets.${credentialName}`));
      assert.strictEqual(
        fs.existsSync(join(rootDir, ".github/workflows/codependence-node.yml")),
        false,
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("detects versions from supported metadata files", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    const webDir = join(rootDir, "web");
    const pythonDir = join(rootDir, "python");
    const goDir = join(rootDir, "backend");
    const rustDir = join(rootDir, "cli");
    fs.mkdirSync(webDir);
    fs.mkdirSync(pythonDir);
    fs.mkdirSync(goDir);
    fs.mkdirSync(rustDir);
    const targets = [
      { manager: "pnpm", rootDir: "web" },
      { manager: "uv", rootDir: "python" },
      { manager: "go", rootDir: "backend" },
      { manager: "rust", rootDir: "cli" },
    ];
    fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));
    fs.writeFileSync(join(webDir, ".tool-versions"), "pnpm 10.12.1\n");
    fs.writeFileSync(join(pythonDir, "versions.env"), "UV_VERSION=0.8.2\n");
    fs.writeFileSync(
      join(goDir, "go.mod"),
      "module example.com/backend\n\ngo 1.24.0\ntoolchain go1.25.4\n",
    );
    fs.writeFileSync(join(rustDir, "rust-toolchain.toml"), '[toolchain]\nchannel = "1.88.0"\n');

    try {
      initGitHubActions({ rootDir });

      assert.ok(readWorkflow(rootDir, "node").includes("version: 10.12.1"));
      assert.ok(readWorkflow(rootDir, "python").includes("version: 0.8.2"));
      assert.ok(readWorkflow(rootDir, "go").includes("version: 1.25.4"));
      assert.ok(readWorkflow(rootDir, "rust").includes("version: 1.88.0"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("normalizes Rust versions from legacy toolchain files", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    fs.writeFileSync(
      join(rootDir, ".codependencerc"),
      JSON.stringify({ targets: [{ manager: "rust" }] }),
    );
    fs.writeFileSync(join(rootDir, "rust-toolchain"), "v1.87.0\n");

    try {
      initGitHubActions({ rootDir });

      assert.ok(readWorkflow(rootDir, "rust").includes("version: 1.87.0"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects non-exact Rust toolchain channels", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    fs.writeFileSync(
      join(rootDir, ".codependencerc"),
      JSON.stringify({ targets: [{ manager: "rust" }] }),
    );
    fs.writeFileSync(join(rootDir, "rust-toolchain.toml"), '[toolchain]\nchannel = "stable"\n');

    try {
      assertThrows(
        () => initGitHubActions({ rootDir }),
        "rust requires an exact tool version, received: stable",
      );
      assert.strictEqual(fs.existsSync(join(rootDir, ".github")), false);

      fs.writeFileSync(
        join(rootDir, "rust-toolchain.toml"),
        '[toolchain]\nchannel = "1.88.0-rc.1"\n',
      );
      assertThrows(
        () => initGitHubActions({ rootDir }),
        "rust requires an exact tool version, received: 1.88.0-rc.1",
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("normalizes Go directives and runs commands in the target root", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    const goDir = join(rootDir, "services", "api");
    fs.mkdirSync(goDir, { recursive: true });
    const targets = [{ manager: "go", rootDir: "services/api" }];
    fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({ targets }));
    fs.writeFileSync(join(goDir, "go.mod"), "module example.com/api\n\ngo 1.24\n");

    try {
      initGitHubActions({ rootDir });

      const workflow = readWorkflow(rootDir, "go");
      assert.ok(workflow.includes("version: 1.24.0"));
      assert.ok(
        workflow.includes("post-update-command: '(cd -- ''services/api'' && go mod tidy)'"),
      );

      initGitHubActions({
        force: true,
        postUpdateCommands: ["go=task go:tidy"],
        rootDir,
      });
      assert.ok(
        readWorkflow(rootDir, "go").includes(
          "post-update-command: '(cd -- ''services/api'' && task go:tidy)'",
        ),
      );
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
      assert.ok(workflow.includes("targets: |\n            bun\n            npm"));
      assert.ok(workflow.includes("version: |\n            bun=1.3.14\n            npm=11.4.2"));
      assert.ok(workflow.includes("post-update-command: 'bun install && npm install'"));
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
      assert.ok(workflow.includes("version: v1.25.3-rc.1"));
      assert.ok(workflow.includes("post-update-command: 'echo it''s ready'"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("requires a configuration with manager targets", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));

    try {
      assertThrows(() => initGitHubActions({ rootDir }), "configuration not found");
      fs.writeFileSync(join(rootDir, ".codependencerc"), JSON.stringify({}));
      assertThrows(() => initGitHubActions({ rootDir }), "must define manager targets");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects unconfigured and unsupported managers", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    const configPath = join(rootDir, ".codependencerc");
    fs.writeFileSync(configPath, JSON.stringify({ targets: [{ manager: "bun" }] }));

    try {
      assertThrows(
        () => initGitHubActions({ rootDir, targets: ["go"] }),
        "Unknown configured target manager(s): go",
      );
      fs.writeFileSync(configPath, JSON.stringify({ targets: [{ manager: "pip" }] }));
      assertThrows(() => initGitHubActions({ rootDir }), "does not support target manager(s): pip");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects malformed and unknown option assignments", () => {
    const rootDir = createActionsProject();

    try {
      assertThrows(
        () => initGitHubActions({ rootDir, targets: ["go"], versions: ["go"] }),
        "Versions must use name=value entries",
      );
      assertThrows(
        () => initGitHubActions({ rootDir, targets: ["go"], versions: ["uv=0.8.0"] }),
        "Unknown version manager(s): uv",
      );
      assertThrows(
        () =>
          initGitHubActions({ rootDir, targets: ["go"], postUpdateCommands: ["python=uv lock"] }),
        "Unknown post-update command target(s): python",
      );
      assertThrows(
        () => initGitHubActions({ rootDir, targets: ["go"], schedules: ["node=0 9 * * 1"] }),
        "Unknown schedule area(s): node",
      );
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid schedules and credential names", () => {
    const rootDir = createActionsProject();
    const invalidCredentialName = ["dependency", "updates"].join("-");

    try {
      assertThrows(
        () => initGitHubActions({ rootDir, targets: ["go"], schedules: ["go=weekly"] }),
        "Invalid cron schedule for: go",
      );
      assertThrows(
        () =>
          initGitHubActions({
            rootDir,
            targets: ["go"],
            tokenSecret: invalidCredentialName,
          }),
        "Invalid GitHub secret name",
      );
      assert.strictEqual(fs.existsSync(join(rootDir, ".github")), false);
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
      assertThrows(() => initGitHubActions({ rootDir }), "Pass --version uv=<version>");
      assertThrows(
        () => initGitHubActions({ rootDir, versions: ["uv=0.8"] }),
        "requires an exact tool version",
      );

      initGitHubActions({ rootDir, versions: ["uv=0.8.0"] });
      const workflowPath = join(rootDir, ".github/workflows/codependence-python.yml");
      fs.writeFileSync(workflowPath, "existing\n");

      assertThrows(
        () => initGitHubActions({ rootDir, versions: ["uv=0.8.1"] }),
        "Refusing to overwrite",
      );
      assert.strictEqual(fs.readFileSync(workflowPath, "utf8"), "existing\n");

      initGitHubActions({ rootDir, versions: ["uv=0.8.1"], force: true });
      assert.ok(fs.readFileSync(workflowPath, "utf8").includes("version: 0.8.1"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid package manager metadata before writing workflows", () => {
    const rootDir = fs.mkdtempSync(join(tmpdir(), "codependence-actions-unit-"));
    fs.writeFileSync(
      join(rootDir, ".codependencerc"),
      JSON.stringify({ targets: [{ manager: "bun" }] }),
    );
    fs.writeFileSync(join(rootDir, "package.json"), "{");

    try {
      assertThrows(() => initGitHubActions({ rootDir }), "Missing exact tool version for: bun");
      assert.strictEqual(fs.existsSync(join(rootDir, ".github")), false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
