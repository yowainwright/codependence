import { expect, test, describe, beforeEach, afterEach, jest, mock } from "bun:test";
import { NodeJSProvider } from "../../../src/providers/nodejs";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("NodeJSProvider", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("getLatestVersion", () => {
    test("should get version using npm", async () => {
      const execMock = jest.fn(() => ({
        stdout: "4.17.21\n",
        stderr: "",
      })) as any;

      const provider = new NodeJSProvider();
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("lodash");

      expect(version).toBe("4.17.21");
      expect(execMock).toHaveBeenCalledWith("npm", [
        "view",
        "lodash",
        "version",
        "latest",
      ]);
    });

    test("should get version using yarn when yarnConfig is true", async () => {
      const execMock = jest.fn(() => ({
        stdout: '{"version":"4.17.21"}\n',
        stderr: "",
      })) as any;

      const provider = new NodeJSProvider({ yarnConfig: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("lodash");

      expect(version).toBe("4.17.21");
      expect(execMock).toHaveBeenCalledWith("yarn", [
        "npm",
        "info",
        "lodash",
        "--fields",
        "version",
        "--json",
      ]);
    });

    test("should handle npm returning empty string", async () => {
      const execMock = jest.fn(() => ({
        stdout: "\n",
        stderr: "",
      })) as any;

      const provider = new NodeJSProvider();
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("nonexistent-package");

      expect(version).toBe("");
    });

    test("should handle yarn JSON without version field", async () => {
      const execMock = jest.fn(() => ({
        stdout: "{}\n",
        stderr: "",
      })) as any;

      const provider = new NodeJSProvider({ yarnConfig: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("lodash");

      expect(version).toBe("");
    });
  });

  describe("getAllVersions", () => {
    test("should get all versions as array", async () => {
      const execMock = jest.fn(() => ({
        stdout: '["4.0.0","4.17.0","4.17.21"]',
        stderr: "",
      })) as any;

      const provider = new NodeJSProvider();
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const versions = await provider.getAllVersions("lodash");

      expect(versions).toEqual(["4.0.0", "4.17.0", "4.17.21"]);
    });

    test("should handle empty versions array", async () => {
      const execMock = jest.fn(() => ({
        stdout: "[]",
        stderr: "",
      })) as any;

      const provider = new NodeJSProvider();
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const versions = await provider.getAllVersions("nonexistent");

      expect(versions).toEqual([]);
    });
  });

  describe("readManifest", () => {
    const tmpDir = join(__dirname, ".tmp-nodejs-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should read package.json with all dependency types", async () => {
      const pkgPath = join(tmpDir, "package.json");
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: { lodash: "^4.17.21" },
        devDependencies: { typescript: "^5.0.0" },
        peerDependencies: { react: "^18.0.0" },
      };

      writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2));

      const provider = new NodeJSProvider();
      const manifest = await provider.readManifest(pkgPath);

      expect(manifest.name).toBe("test-package");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.dependencies).toEqual({ lodash: "^4.17.21" });
      expect(manifest.devDependencies).toEqual({ typescript: "^5.0.0" });
      expect(manifest.peerDependencies).toEqual({ react: "^18.0.0" });
      expect(manifest.filePath).toBe(pkgPath);
    });

    test("should handle package.json without optional fields", async () => {
      const pkgPath = join(tmpDir, "minimal-package.json");
      const packageJson = {
        name: "minimal-package",
        version: "0.0.1",
      };

      writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2));

      const provider = new NodeJSProvider();
      const manifest = await provider.readManifest(pkgPath);

      expect(manifest.name).toBe("minimal-package");
      expect(manifest.version).toBe("0.0.1");
      expect(manifest.dependencies).toEqual({});
      expect(manifest.devDependencies).toEqual({});
      expect(manifest.peerDependencies).toEqual({});
    });

    test("should handle empty dependencies", async () => {
      const pkgPath = join(tmpDir, "empty-deps.json");
      const packageJson = {
        name: "empty",
        version: "1.0.0",
        dependencies: {},
        devDependencies: {},
      };

      writeFileSync(pkgPath, JSON.stringify(packageJson));

      const provider = new NodeJSProvider();
      const manifest = await provider.readManifest(pkgPath);

      expect(manifest.dependencies).toEqual({});
      expect(manifest.devDependencies).toEqual({});
    });
  });

  describe("writeManifest", () => {
    const tmpDir = join(__dirname, ".tmp-nodejs-write-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should write updated dependencies to package.json", async () => {
      const pkgPath = join(tmpDir, "package.json");
      const originalPkg = {
        name: "test-pkg",
        version: "1.0.0",
        description: "Test package",
        dependencies: { lodash: "^4.0.0" },
        devDependencies: { jest: "^27.0.0" },
      };

      writeFileSync(pkgPath, JSON.stringify(originalPkg, null, 2));

      const provider = new NodeJSProvider();
      await provider.writeManifest(pkgPath, {
        filePath: pkgPath,
        dependencies: { lodash: "^4.17.21", axios: "^1.0.0" },
        devDependencies: { jest: "^29.0.0" },
        peerDependencies: {},
      });

      const updated = JSON.parse(readFileSync(pkgPath, "utf8"));

      expect(updated.name).toBe("test-pkg");
      expect(updated.description).toBe("Test package");
      expect(updated.dependencies).toEqual({
        lodash: "^4.17.21",
        axios: "^1.0.0",
      });
      expect(updated.devDependencies).toEqual({ jest: "^29.0.0" });
    });

    test("should preserve formatting with trailing newline", async () => {
      const pkgPath = join(tmpDir, "formatted.json");
      const pkg = {
        name: "formatted",
        version: "1.0.0",
        dependencies: {},
      };

      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

      const provider = new NodeJSProvider();
      await provider.writeManifest(pkgPath, {
        filePath: pkgPath,
        dependencies: { lodash: "^4.17.21" },
        devDependencies: {},
        peerDependencies: {},
      });

      const content = readFileSync(pkgPath, "utf8");

      expect(content.endsWith("\n")).toBe(true);
      expect(content.includes("  ")).toBe(true); // 2-space indentation
    });

    test("should handle adding peerDependencies", async () => {
      const pkgPath = join(tmpDir, "peer-deps.json");
      const pkg = {
        name: "lib",
        version: "1.0.0",
        dependencies: {},
      };

      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

      const provider = new NodeJSProvider();
      await provider.writeManifest(pkgPath, {
        filePath: pkgPath,
        dependencies: {},
        devDependencies: {},
        peerDependencies: { react: "^18.0.0" },
      });

      const updated = JSON.parse(readFileSync(pkgPath, "utf8"));

      expect(updated.peerDependencies).toEqual({ react: "^18.0.0" });
    });
  });

  describe("validatePackageName", () => {
    const provider = new NodeJSProvider();

    test("should validate correct package names", () => {
      expect(provider.validatePackageName("lodash")).toBe(true);
      expect(provider.validatePackageName("@types/node")).toBe(true);
      expect(provider.validatePackageName("react-dom")).toBe(true);
      expect(provider.validatePackageName("some_package")).toBe(true);
    });

    test("should reject invalid package names", () => {
      expect(provider.validatePackageName("")).toBe(false);
      expect(provider.validatePackageName("has spaces")).toBe(false);
      expect(provider.validatePackageName(".starts-with-dot")).toBe(false);
      expect(provider.validatePackageName("_starts-with-underscore")).toBe(
        false,
      );
      expect(provider.validatePackageName("node_modules")).toBe(false);
      expect(provider.validatePackageName("favicon.ico")).toBe(false);
    });

    test("should handle scoped packages", () => {
      expect(provider.validatePackageName("@scope/package")).toBe(true);
      expect(provider.validatePackageName("@babel/core")).toBe(true);
      expect(provider.validatePackageName("@typescript-eslint/parser")).toBe(
        true,
      );
    });
  });

  describe("language property", () => {
    test("should have correct language identifier", () => {
      const provider = new NodeJSProvider();
      expect(provider.language).toBe("nodejs");
    });
  });

  describe("constructor options", () => {
    test("should accept empty options", () => {
      const provider = new NodeJSProvider();
      expect(provider).toBeDefined();
    });

    test("should accept yarnConfig option", () => {
      const provider = new NodeJSProvider({ yarnConfig: true });
      expect(provider).toBeDefined();
    });

    test("should accept debug option", () => {
      const provider = new NodeJSProvider({ debug: true });
      expect(provider).toBeDefined();
    });
  });
});
