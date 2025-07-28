import { expect, test, jest, beforeEach, describe } from "bun:test";
// Types imported by the actual module

// Mock implementations are not used in these fast tests

// Import and test the actual functions with test flags
import { action } from "../src/program";

describe("Action Function Tests (Fast)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      config: "./test/.codependencerc",
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
});
