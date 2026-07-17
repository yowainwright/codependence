import { expect, test, describe, beforeEach } from "bun:test";
import { loadConfig, validateConfig } from "../../../src/config";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("Config Loading", () => {
  const tmpDir = join("/tmp", `codependence-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  describe("loadConfig", () => {
    test("should load config from .codependencerc file", () => {
      const rcPath = join(tmpDir, ".codependencerc");
      const config = {
        codependencies: ["lodash", "axios"],
        permissive: true,
      };

      writeFileSync(rcPath, JSON.stringify(config));

      const result = loadConfig(rcPath);

      expect(result).not.toBeNull();
      expect(result?.config).toEqual(config);
      expect(result?.filepath).toBe(rcPath);
    });

    test("should load config from package.json codependence field", () => {
      const pkgPath = join(tmpDir, "package.json");
      const pkg = {
        name: "test",
        codependence: {
          codependencies: ["react", "vue"],
        },
      };

      writeFileSync(pkgPath, JSON.stringify(pkg));

      const result = loadConfig(pkgPath);

      expect(result).not.toBeNull();
      expect(result?.config).toEqual(pkg.codependence);
      expect(result?.filepath).toBe(pkgPath);
    });

    test("should return null if file not found", () => {
      const result = loadConfig(join(tmpDir, "nonexistent.json"));

      expect(result).toBeNull();
    });

    test("should throw on JSON parse error for explicit config", () => {
      const badPath = join(tmpDir, "bad.json");
      writeFileSync(badPath, "{ invalid json");

      expect(() => loadConfig(badPath)).toThrow("Failed to load config");
    });

    test("should search for config if no path provided", () => {
      writeFileSync(join(tmpDir, ".codependencerc"), JSON.stringify({}));

      const result = loadConfig(undefined, tmpDir);

      expect(result).not.toBeNull();
      expect(result?.filepath).toBe(join(tmpDir, ".codependencerc"));
    });

    test("should return null for package.json without codependence field", () => {
      const pkgPath = join(tmpDir, "package.json");
      const pkg = {
        name: "minimal",
        version: "1.0.0",
      };

      writeFileSync(pkgPath, JSON.stringify(pkg));

      const result = loadConfig(pkgPath);

      expect(result).toBeNull();
    });

    test("should load empty codependence object", () => {
      const pkgPath = join(tmpDir, "package.json");
      const pkg = {
        name: "test",
        codependence: {},
      };

      writeFileSync(pkgPath, JSON.stringify(pkg));

      const result = loadConfig(pkgPath);

      expect(result).not.toBeNull();
      expect(result?.config).toEqual({});
      expect(result?.filepath).toBe(pkgPath);
    });

    test("should load from .codependencerc.json", () => {
      const rcPath = join(tmpDir, ".codependencerc.json");
      const config = { permissive: true };

      writeFileSync(rcPath, JSON.stringify(config));

      const result = loadConfig(rcPath);

      expect(result).not.toBeNull();
      expect(result?.config).toEqual(config);
    });

    test("should load from .codependencerc.yaml", () => {
      const rcPath = join(tmpDir, ".codependencerc.yaml");
      writeFileSync(
        rcPath,
        [
          "codependencies:",
          "  - lodash",
          "  - react: 18.2.0",
          "permissive: false",
          "mode: verbose",
        ].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result).not.toBeNull();
      expect(result?.config).toEqual({
        codependencies: ["lodash", { react: "18.2.0" }],
        permissive: false,
        mode: "verbose",
      });
    });

    test("should load unindented YAML block arrays", () => {
      const rcPath = join(tmpDir, ".codependencerc.yaml");
      writeFileSync(
        rcPath,
        [
          "codependencies:",
          "- lodash",
          "- react: 18.2.0",
          "permissive: false",
        ].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        codependencies: ["lodash", { react: "18.2.0" }],
        permissive: false,
      });
    });

    test("should load multiline YAML manager targets", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(
        rcPath,
        [
          "targets:",
          "  - manager: bun",
          "    files:",
          "      - package.json",
          "    codependencies:",
          "      - typescript",
          "  - manager: github-actions",
          "    files:",
          "      - .github/workflows/*.yml",
          "    mode: precise",
          "update: true",
        ].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        targets: [
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
        ],
        update: true,
      });
      expect(validateConfig(result?.config)).toEqual({
        valid: true,
        errors: [],
      });
    });

    test("should load YAML objects after bare array markers", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(
        rcPath,
        [
          "targets:",
          "  -",
          "    manager: bun",
          "    files:",
          "      - package.json",
          "update: true",
        ].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        targets: [{ manager: "bun", files: ["package.json"] }],
        update: true,
      });
    });

    test("should reject malformed YAML array object fields", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(
        rcPath,
        ["targets:", "  - manager: bun", "    invalid"].join("\n"),
      );

      expect(() => loadConfig(rcPath)).toThrow("Failed to load config");
    });

    test("should load bare YAML keys as null", () => {
      const rcPath = join(tmpDir, ".codependencerc.yaml");
      writeFileSync(
        rcPath,
        ["codependencies:", "permissive: true"].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        codependencies: null,
        permissive: true,
      });
    });

    test("should load inline YAML values for the config API", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(
        rcPath,
        [
          'codependencies: ["lodash", { react: "18.2.0" }]',
          'files: ["package.json", "packages/*/package.json"]',
          'ignore: ["**/node_modules/**"]',
          "level: minor",
        ].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        codependencies: ["lodash", { react: "18.2.0" }],
        files: ["package.json", "packages/*/package.json"],
        ignore: ["**/node_modules/**"],
        level: "minor",
      });
    });

    test("should load implicit mappings from inline YAML arrays", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(rcPath, "codependencies: [react: 18.2.0]");

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        codependencies: [{ react: "18.2.0" }],
      });
    });

    test("should preserve multi-key inline YAML objects for validation", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(
        rcPath,
        "codependencies: [{ lodash: 4.17.21, react: 18.2.0 }]",
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        codependencies: [{ lodash: "4.17.21", react: "18.2.0" }],
      });
    });

    test("should strip separated YAML comments and preserve inline hashes", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(
        rcPath,
        [
          "# full-line comment",
          "codependencies:",
          "  - lodash # pinned by policy",
          "  - left#right",
          "permissive: false # use explicit policies",
        ].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        codependencies: ["lodash", "left#right"],
        permissive: false,
      });
    });

    test("should preserve invalid JSON escapes in double quoted YAML scalars", () => {
      const rcPath = join(tmpDir, ".codependencerc.yml");
      writeFileSync(
        rcPath,
        ['rootDir: "bad \\q path"', "permissive: true"].join("\n"),
      );

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual({
        rootDir: "bad \\q path",
        permissive: true,
      });
    });
  });

  describe("searchForConfig behavior", () => {
    test("should find .codependencerc in current directory", () => {
      writeFileSync(join(tmpDir, ".codependencerc"), JSON.stringify({}));

      const result = loadConfig(undefined, tmpDir);

      expect(result).not.toBeNull();
      expect(result?.filepath).toBe(join(tmpDir, ".codependencerc"));
    });

    test("should find .codependencerc.json in current directory", () => {
      writeFileSync(
        join(tmpDir, ".codependencerc.json"),
        JSON.stringify({}),
      );

      const result = loadConfig(undefined, tmpDir);

      expect(result?.filepath).toBe(join(tmpDir, ".codependencerc.json"));
    });

    test("should find legacy yaml rc files in current directory", () => {
      writeFileSync(
        join(tmpDir, ".codependencerc.yml"),
        "codependencies:\n  - lodash\n",
      );

      const result = loadConfig(undefined, tmpDir);

      expect(result?.filepath).toBe(join(tmpDir, ".codependencerc.yml"));
      expect(result?.config).toEqual({ codependencies: ["lodash"] });
    });

    test("should find package.json with codependence field", () => {
      const pkg = {
        name: "test",
        codependence: { codependencies: [] },
      };
      writeFileSync(join(tmpDir, "package.json"), JSON.stringify(pkg));

      const result = loadConfig(undefined, tmpDir);

      expect(result?.filepath).toBe(join(tmpDir, "package.json"));
    });

    test("should return null if package.json has no codependence field", () => {
      const pkg = { name: "test" };
      writeFileSync(join(tmpDir, "package.json"), JSON.stringify(pkg));

      const result = loadConfig(undefined, tmpDir);

      expect(result).toBeNull();
    });

    test("should return null if no config files found", () => {
      const result = loadConfig(undefined, tmpDir);

      expect(result).toBeNull();
    });

    test("should prioritize .codependencerc over .codependencerc.json", () => {
      writeFileSync(join(tmpDir, ".codependencerc"), JSON.stringify({}));
      writeFileSync(
        join(tmpDir, ".codependencerc.json"),
        JSON.stringify({}),
      );

      const result = loadConfig(undefined, tmpDir);

      expect(result?.filepath).toBe(join(tmpDir, ".codependencerc"));
    });

    test("should prioritize .codependencerc over package.json", () => {
      writeFileSync(join(tmpDir, ".codependencerc"), JSON.stringify({}));
      const pkg = { name: "test", codependence: {} };
      writeFileSync(join(tmpDir, "package.json"), JSON.stringify(pkg));

      const result = loadConfig(undefined, tmpDir);

      expect(result?.filepath).toBe(join(tmpDir, ".codependencerc"));
    });

    test("should search parent directories", () => {
      const nestedDir = join(tmpDir, "nested", "deeper");
      mkdirSync(nestedDir, { recursive: true });

      writeFileSync(join(tmpDir, ".codependencerc"), JSON.stringify({}));

      const result = loadConfig(undefined, nestedDir);

      expect(result?.filepath).toBe(join(tmpDir, ".codependencerc"));
    });

    test("should throw for malformed package.json during config search", () => {
      writeFileSync(join(tmpDir, "package.json"), "{ invalid json");

      expect(() => loadConfig(undefined, tmpDir)).toThrow(
        "package.json is not valid JSON",
      );
    });

    test("should throw for malformed discovered rc files instead of falling back", () => {
      writeFileSync(join(tmpDir, ".codependencerc"), "{ invalid json");
      writeFileSync(
        join(tmpDir, "package.json"),
        JSON.stringify({
          codependence: { codependencies: ["lodash"] },
        }),
      );

      expect(() => loadConfig(undefined, tmpDir)).toThrow(
        "Failed to load config",
      );
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle config with large arrays", () => {
      const rcPath = join(tmpDir, ".codependencerc");
      const largeDeps = Array.from({ length: 1000 }, (_, i) => `package-${i}`);
      const config = { codependencies: largeDeps };

      writeFileSync(rcPath, JSON.stringify(config));

      const result = loadConfig(rcPath);

      expect(result?.config.codependencies).toHaveLength(1000);
    });

    test("should handle config with special characters", () => {
      const rcPath = join(tmpDir, ".codependencerc");
      const config = {
        codependencies: ["@scope/package", "lodash-es"],
        rootDir: "/path/with/spaces and (parens)",
      };

      writeFileSync(rcPath, JSON.stringify(config));

      const result = loadConfig(rcPath);

      expect(result?.config).toEqual(config);
    });

    test("should throw for empty file", () => {
      const rcPath = join(tmpDir, ".codependencerc");
      writeFileSync(rcPath, "");

      expect(() => loadConfig(rcPath)).toThrow("Failed to load config");
    });

    test("should throw for file with only whitespace", () => {
      const rcPath = join(tmpDir, ".codependencerc");
      writeFileSync(rcPath, "   \n  \t  ");

      expect(() => loadConfig(rcPath)).toThrow("Failed to load config");
    });
  });
});
