import { expect, test, describe, beforeEach } from "bun:test";
import { loadConfig } from "../../../src/utils/config";
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

    test("should return null on JSON parse error", () => {
      const badPath = join(tmpDir, "bad.json");
      writeFileSync(badPath, "{ invalid json");

      const result = loadConfig(badPath);

      expect(result).toBeNull();
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

    test("should handle malformed package.json gracefully", () => {
      writeFileSync(join(tmpDir, "package.json"), "{ invalid json");

      const result = loadConfig(undefined, tmpDir);

      expect(result).toBeNull();
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

    test("should return null for empty file", () => {
      const rcPath = join(tmpDir, ".codependencerc");
      writeFileSync(rcPath, "");

      const result = loadConfig(rcPath);

      expect(result).toBeNull();
    });

    test("should return null for file with only whitespace", () => {
      const rcPath = join(tmpDir, ".codependencerc");
      writeFileSync(rcPath, "   \n  \t  ");

      const result = loadConfig(rcPath);

      expect(result).toBeNull();
    });
  });
});
