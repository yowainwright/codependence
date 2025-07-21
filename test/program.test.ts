import { promisify } from "util";
import { exec } from "child_process";
import { expect, test, vi, beforeEach, describe } from "vitest";
import { stdoutToJSON } from "stdouttojson";
import { cosmiconfigSync } from "cosmiconfig";
import { action, initAction } from "../src/program";
import { Options } from "../src/types";

export const execPromise = promisify(exec);

// Create hoisted mocks
const { existsSync, readFileSync, writeFileSync, mockPrompt, mockLogger } =
  vi.hoisted(() => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mockPrompt: vi.fn(),
    mockLogger: vi.fn(),
  }));

// Mock fs module
vi.mock("fs", () => ({
  existsSync,
  readFileSync,
  writeFileSync,
}));

// Mock ora spinner
vi.mock("ora", () => ({
  default: () => ({
    start: () => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      stop: vi.fn(),
    }),
  }),
}));

// Mock gradient-string
vi.mock("gradient-string", () => ({
  default: {
    teen: (str: string) => str,
    passion: (str: string) => str,
  },
}));

// Mock inquirer
vi.mock("inquirer", () => ({
  default: {
    prompt: mockPrompt,
  },
}));

// Mock logger
vi.mock("../src/scripts/utils", () => ({
  logger: mockLogger,
}));

// Mock cosmiconfig
vi.mock("cosmiconfig", () => {
  let _cache: any;
  const cosmiconfigSync = () => {
    if (_cache) return _cache;
    _cache = {
      load: vi.fn(() => ({
        config: { codependencies: ["lodash", "fs-extra"] },
      })),
      search: vi.fn(() => ({
        filePath: "foo",
        config: { codependencies: ["lodash", "rambda"] },
        isEmpty: false,
      })),
    };
    return _cache;
  };
  return { cosmiconfigSync };
});

// Mock scripts/core
vi.mock("../src/scripts/core", () => ({
  script: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * @notes
 * all execution tests tests are based on running from root 👌
 * action tests are located after execution tests
 */

describe("CLI Integration Tests", () => {
  test("w/ no codependence reference", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --rootDir './test/' --isTestingCLI",
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    // The test finds the actual package.json with codependence config
    expect(result.updatedOptions).toHaveProperty("isCLI", "true");
    expect(result.updatedOptions).toHaveProperty("rootDir", "./test/");
    expect(result.updatedOptions).toHaveProperty("codependencies");
    expect(Array.isArray(result.updatedOptions.codependencies)).toBe(true);
  });

  test("w/ only options", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --codependencies lodash fs-extra --isTestingCLI",
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash", "fs-extra"],
    });
  });

  test("w/ advanced codependencies put in via cli", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --codependencies 'lodash' '{ \"fs-extra\": \"10.0.1\" }' --isTestingCLI",
    );
    expect(stdout).toContain("lodash");
  });

  test("action => with update flag", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --codependencies lodash --update --isTestingCLI",
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      update: "true",
    });
  });

  test("action => with debug flag", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --codependencies lodash --debug --isTestingCLI",
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      debug: "true",
    });
  });

  test("action => with silent flag", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --codependencies lodash --silent --isTestingCLI",
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      silent: "true",
    });
  });

  test("action => with yarn config", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --codependencies lodash --yarnConfig --isTestingCLI",
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      yarnConfig: "true",
    });
  });

  test("action => with file glob patterns", async () => {
    const { stdout = "{}" } = await execPromise(
      'tsx ./src/program.ts --codependencies lodash --files "packages/*/package.json" --isTestingCLI',
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      files: ["packages/*/package.json"],
    });
  });

  test("action => with ignore patterns", async () => {
    const { stdout = "{}" } = await execPromise(
      'tsx ./src/program.ts --codependencies lodash --ignore "**/node_modules/**" --isTestingCLI',
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      ignore: ["**/node_modules/**"],
    });
  });

  test("action => with root directory", async () => {
    const { stdout = "{}" } = await execPromise(
      'tsx ./src/program.ts --codependencies lodash --rootDir "./packages" --isTestingCLI',
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      rootDir: "./packages",
    });
  });

  test("action => with search path", async () => {
    const { stdout = "{}" } = await execPromise(
      'tsx ./src/program.ts --codependencies lodash --searchPath "./test" --isTestingCLI',
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      // searchPath is used during config search, not included in final options
    });
  });

  test("action => with config file", async () => {
    const { stdout = "{}" } = await execPromise(
      'tsx ./src/program.ts --codependencies lodash --config "./test/.codependencerc" --isTestingCLI',
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash"],
      // config is used during config loading, not included in final options
    });
  });

  test("action => with multiple flags combined", async () => {
    const { stdout = "{}" } = await execPromise(
      "tsx ./src/program.ts --codependencies lodash fs-extra --update --debug --silent --yarnConfig --isTestingCLI",
    );
    const result = stdoutToJSON(stdout) as unknown as {
      updatedOptions: Options;
    };
    expect(result.updatedOptions).toStrictEqual({
      isCLI: "true",
      codependencies: ["lodash", "fs-extra"],
      update: "true",
      debug: "true",
      silent: "true",
      yarnConfig: "true",
    });
  });
});

describe("Action Function Unit Tests", () => {
  test("action => load config", async () => {
    const explorer = cosmiconfigSync("codependence");
    const result = await action({ config: "foo-bar", isTestingAction: true });
    expect(explorer.search).toHaveBeenCalled();
    expect(explorer.load).toHaveBeenCalled();
    expect(result).toStrictEqual({
      isCLI: true,
      codependencies: ["lodash", "fs-extra"],
    });
  });

  test("action => search config", async () => {
    const explorer = cosmiconfigSync("codependence");
    const result = await action({
      isTestingAction: true,
    });
    expect(explorer.search).toHaveBeenCalled();
    expect(explorer.load).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      isCLI: true,
      codependencies: ["lodash", "rambda"],
    });
  });

  test("action => with search path option", async () => {
    const explorer = cosmiconfigSync("codependence");
    const result = await action({
      searchPath: "/custom/path",
      isTestingAction: true,
    });
    expect(explorer.search).toHaveBeenCalledWith("/custom/path");
    expect(result).toStrictEqual({
      isCLI: true,
      codependencies: ["lodash", "rambda"],
    });
  });

  test("action => returns early for CLI testing", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await action({ isTestingCLI: true, codependencies: ["lodash"] });
    expect(consoleSpy).toHaveBeenCalledWith({
      updatedOptions: {
        codependencies: ["lodash"],
        isCLI: true,
      },
    });
    consoleSpy.mockRestore();
  });

  test("action => handles missing codependencies with logger", async () => {
    // Mock explorer to return no config
    const explorer = cosmiconfigSync("codependence");
    vi.mocked(explorer.search).mockReturnValue(null);
    vi.mocked(explorer.load).mockReturnValue({
      config: {},
      filepath: "empty-config.js",
    });

    await action({});
    expect(mockLogger).toHaveBeenCalledWith({
      type: "error",
      section: "cli:error",
      message: '"codependencies" is required (unless using permissive mode)',
    });
  });

  test("action => handles script execution error", async () => {
    const { script } = await import("../src/scripts/core");
    vi.mocked(script).mockRejectedValue(new Error("Script execution failed"));

    await action({ codependencies: ["lodash"] });

    expect(mockLogger).toHaveBeenCalledWith({
      type: "error",
      section: "cli:error",
      message: "Error: Script execution failed",
    });
  });

  test("action => processes all options correctly", async () => {
    const result = await action({
      codependencies: ["lodash"],
      files: ["package.json"],
      update: true,
      debug: true,
      silent: true,
      rootDir: "./test",
      ignore: ["node_modules"],
      yarnConfig: true,
      isTestingAction: true,
    });

    expect(result).toStrictEqual({
      isCLI: true,
      codependencies: ["lodash"],
      files: ["package.json"],
      update: true,
      debug: true,
      silent: true,
      rootDir: "./test",
      ignore: ["node_modules"],
      yarnConfig: true,
    });
  });

  test("action => merges config from path correctly when codependence key exists", async () => {
    const explorer = cosmiconfigSync("codependence");
    vi.mocked(explorer.load).mockReturnValue({
      config: {
        codependence: {
          codependencies: ["react", "vue"],
        },
      },
      filepath: "custom-config.js",
    });

    const result = await action({
      config: "custom-config.js",
      isTestingAction: true,
    });

    expect(result).toStrictEqual({
      isCLI: true,
      codependencies: ["react", "vue"],
    });
  });
});

describe("InitAction Function Unit Tests", () => {
  test("initAction => creates .codependencerc with permissive mode by default", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.17.21" },
        devDependencies: { typescript: "^4.9.5" },
      }),
    );

    mockPrompt
      .mockResolvedValueOnce({
        managementMode: "permissive",
      })
      .mockResolvedValueOnce({
        pinnedDeps: [],
      })
      .mockResolvedValueOnce({
        outputLocation: "rc",
      });

    await initAction();

    expect(writeFileSync).toHaveBeenCalledWith(
      ".codependencerc",
      expect.stringContaining('"permissive"'),
    );
  });

  test("initAction => skips creation when .codependencerc exists", async () => {
    existsSync.mockReturnValue(true);

    await initAction();

    expect(mockLogger).toHaveBeenCalledWith({
      type: "warn",
      section: "init",
      message:
        "Codependence configuration already exists. Skipping initialization.",
    });
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  test("initAction => handles package.json not found", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return false;
      return false;
    });

    await initAction();

    expect(mockLogger).toHaveBeenCalledWith({
      type: "error",
      section: "cli:error",
      message: "package.json not found in the current directory",
    });
  });

  test("initAction => handles no dependencies found", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        name: "test-package",
        version: "1.0.0",
      }),
    );

    await initAction();

    expect(mockLogger).toHaveBeenCalledWith({
      type: "error",
      section: "cli:error",
      message: "No dependencies found in package.json",
    });
  });

  test("initAction => creates .codependencerc with selected dependencies in permissive mode", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.17.21" },
        devDependencies: { typescript: "^4.9.5", jest: "^29.0.0" },
      }),
    );

    mockPrompt
      .mockResolvedValueOnce({
        managementMode: "permissive",
      })
      .mockResolvedValueOnce({
        pinnedDeps: ["lodash", "typescript"],
      })
      .mockResolvedValueOnce({
        outputLocation: "rc",
      });

    await initAction();

    expect(writeFileSync).toHaveBeenCalledWith(
      ".codependencerc",
      expect.stringContaining('"permissive"'),
    );
  });

  test("initAction => creates config in package.json in permissive mode", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    const packageJson = {
      name: "test-package",
      version: "1.0.0",
      dependencies: { lodash: "^4.17.21" },
      devDependencies: { typescript: "^4.9.5" },
    };

    readFileSync.mockReturnValue(JSON.stringify(packageJson));

    mockPrompt
      .mockResolvedValueOnce({
        managementMode: "permissive",
      })
      .mockResolvedValueOnce({
        pinnedDeps: ["lodash"],
      })
      .mockResolvedValueOnce({
        outputLocation: "package",
      });

    await initAction();

    expect(writeFileSync).toHaveBeenCalledWith(
      "package.json",
      expect.stringContaining('"codependence"'),
    );
  });

  test("initAction => handles no dependencies selected", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.17.21" },
      }),
    );

    mockPrompt
      .mockResolvedValueOnce({
        managementMode: "permissive",
      })
      .mockResolvedValueOnce({
        pinnedDeps: [],
      })
      .mockResolvedValueOnce({
        outputLocation: "rc",
      });

    await initAction();

    // In permissive mode with no dependencies selected, it should still create config
    expect(writeFileSync).toHaveBeenCalledWith(
      ".codependencerc",
      expect.stringContaining('"permissive"'),
    );
    expect(mockLogger).not.toHaveBeenCalledWith({
      type: "info",
      section: "init",
      message: "No dependencies selected. Skipping initialization.",
    });
  });

  test("initAction => non-interactive mode with rc type", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.17.21" },
        devDependencies: { typescript: "^4.9.5" },
      }),
    );

    await initAction("rc");

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith(
      ".codependencerc",
      expect.stringContaining('"codependencies"'),
    );
  });

  test("initAction => non-interactive mode with package type", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    const packageJson = {
      name: "test-package",
      version: "1.0.0",
      dependencies: { lodash: "^4.17.21" },
      devDependencies: { typescript: "^4.9.5" },
    };

    readFileSync.mockReturnValue(JSON.stringify(packageJson));

    await initAction("package");

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith(
      "package.json",
      expect.stringContaining('"codependence"'),
    );
  });

  test("initAction => non-interactive mode with default type", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.17.21" },
      }),
    );

    await initAction("default");

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith(
      ".codependencerc",
      expect.stringContaining('"codependencies"'),
    );
  });

  test("initAction => handles all dependency types", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.17.21" },
        devDependencies: { typescript: "^4.9.5" },
        peerDependencies: { react: "^18.0.0" },
      }),
    );

    await initAction("rc");

    expect(writeFileSync).toHaveBeenCalledWith(
      ".codependencerc",
      expect.stringContaining('"codependencies"'),
    );
  });

  test("initAction => handles JSON parsing error", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue("invalid json");

    await initAction();

    expect(mockLogger).toHaveBeenCalledWith({
      type: "error",
      section: "cli:error",
      message: expect.stringContaining("Unexpected token"),
    });
  });
});

describe("Edge Cases and Error Handling", () => {
  test("action => handles undefined config result", async () => {
    const explorer = cosmiconfigSync("codependence");
    vi.mocked(explorer.search).mockReturnValue(null);

    const result = await action({
      isTestingAction: true,
    });

    expect(result).toStrictEqual({
      isCLI: true,
    });
  });

  test("action => handles empty config object", async () => {
    const explorer = cosmiconfigSync("codependence");
    vi.mocked(explorer.load).mockReturnValue({
      config: {},
      filepath: "empty-config.js",
    });
    vi.mocked(explorer.search).mockReturnValue({
      filepath: "foo",
      config: { codependencies: ["lodash", "rambda"] },
      isEmpty: false,
    });

    const result = await action({
      config: "empty-config.js",
      isTestingAction: true,
    });

    expect(result).toStrictEqual({
      isCLI: true,
      codependencies: ["lodash", "rambda"], // from search fallback
    });
  });

  test("initAction => handles file write error", async () => {
    existsSync.mockImplementation((path) => {
      if (path === ".codependencerc") return false;
      if (path === "package.json") return true;
      return false;
    });

    readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.17.21" },
      }),
    );

    writeFileSync.mockImplementation(() => {
      throw new Error("File write failed");
    });

    await initAction("rc");

    expect(mockLogger).toHaveBeenCalledWith({
      type: "error",
      section: "cli:error",
      message: "File write failed",
    });
  });
});
