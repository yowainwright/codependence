import { test, describe, beforeEach, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith } from "../../helpers/assertions";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { configureBinaryHost } from "../../../src/bin/utils";
import { NodeJSProvider } from "../../../src/providers/nodejs";
import { exec } from "../../../src/utils/exec";

const execMock = mock.fn<typeof exec>();
const runExecMock = async (command: string, args: string[]): Promise<string> =>
  JSON.stringify(await execMock(command, args));
const restoreBinaryHost = configureBinaryHost(runExecMock, () => "{}", async () => "");

after(restoreBinaryHost);

describe("NodeJSProvider", () => {
  afterEach(() => {
    execMock.mock.restore();
    execMock.mock.resetCalls();
  });

  describe("getLatestVersion", () => {
    test("should get version using npm", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "4.17.21\n",
        stderr: "",
      }));

      const provider = new NodeJSProvider();

      const version = await provider.getLatestVersion("lodash");

      assert.strictEqual((version), "4.17.21");
      assertCalledWith((execMock), "npm", ["view", "lodash", "version", "latest"]);
    });

    test("should get version using yarn when yarnConfig is true", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: '{"version":"4.17.21"}\n',
        stderr: "",
      }));

      const provider = new NodeJSProvider({ yarnConfig: true });

      const version = await provider.getLatestVersion("lodash");

      assert.strictEqual((version), "4.17.21");
      assertCalledWith((execMock), "yarn", [
        "npm",
        "info",
        "lodash",
        "--fields",
        "version",
        "--json",
      ]);
    });

    test("should handle npm returning empty string", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "\n",
        stderr: "",
      }));

      const provider = new NodeJSProvider();

      const version = await provider.getLatestVersion("nonexistent-package");

      assert.strictEqual((version), "");
    });

    test("should handle yarn JSON without version field", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "{}\n",
        stderr: "",
      }));

      const provider = new NodeJSProvider({ yarnConfig: true });

      const version = await provider.getLatestVersion("lodash");

      assert.strictEqual((version), "");
    });
  });

  describe("getAllVersions", () => {
    test("should get all versions as array", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: '["4.0.0","4.17.0","4.17.21"]',
        stderr: "",
      }));

      const provider = new NodeJSProvider();

      const versions = await provider.getAllVersions("lodash");

      assert.deepStrictEqual((versions), ["4.0.0", "4.17.0", "4.17.21"]);
    });

    test("should handle empty versions array", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "[]",
        stderr: "",
      }));

      const provider = new NodeJSProvider();

      const versions = await provider.getAllVersions("nonexistent");

      assert.deepStrictEqual((versions), []);
    });
  });

  describe("readManifest", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-nodejs-test");

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

      assert.strictEqual((manifest.name), "test-package");
      assert.strictEqual((manifest.version), "1.0.0");
      assert.deepStrictEqual((manifest.dependencies), { lodash: "^4.17.21" });
      assert.deepStrictEqual((manifest.devDependencies), { typescript: "^5.0.0" });
      assert.deepStrictEqual((manifest.peerDependencies), { react: "^18.0.0" });
      assert.strictEqual((manifest.filePath), pkgPath);
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

      assert.strictEqual((manifest.name), "minimal-package");
      assert.strictEqual((manifest.version), "0.0.1");
      assert.deepStrictEqual((manifest.dependencies), {});
      assert.deepStrictEqual((manifest.devDependencies), {});
      assert.deepStrictEqual((manifest.peerDependencies), {});
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

      assert.deepStrictEqual((manifest.dependencies), {});
      assert.deepStrictEqual((manifest.devDependencies), {});
    });
  });

  describe("writeManifest", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-nodejs-write-test");

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

      assert.strictEqual((updated.name), "test-pkg");
      assert.strictEqual((updated.description), "Test package");
      assert.deepStrictEqual((updated.dependencies), {
        lodash: "^4.17.21",
        axios: "^1.0.0",
      });
      assert.deepStrictEqual((updated.devDependencies), { jest: "^29.0.0" });
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

      assert.strictEqual((content.endsWith("\n")), true);
      assert.strictEqual((content.includes("  ")), true); // 2-space indentation
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

      assert.deepStrictEqual((updated.peerDependencies), { react: "^18.0.0" });
    });
  });

  describe("validatePackageName", () => {
    const provider = new NodeJSProvider();

    test("should validate correct package names", () => {
      assert.strictEqual((provider.validatePackageName("lodash")), true);
      assert.strictEqual((provider.validatePackageName("@types/node")), true);
      assert.strictEqual((provider.validatePackageName("react-dom")), true);
      assert.strictEqual((provider.validatePackageName("some_package")), true);
    });

    test("should reject invalid package names", () => {
      assert.strictEqual((provider.validatePackageName("")), false);
      assert.strictEqual((provider.validatePackageName("has spaces")), false);
      assert.strictEqual((provider.validatePackageName(".starts-with-dot")), false);
      assert.strictEqual((provider.validatePackageName("_starts-with-underscore")), false);
      assert.strictEqual((provider.validatePackageName("node_modules")), false);
      assert.strictEqual((provider.validatePackageName("favicon.ico")), false);
    });

    test("should handle scoped packages", () => {
      assert.strictEqual((provider.validatePackageName("@scope/package")), true);
      assert.strictEqual((provider.validatePackageName("@babel/core")), true);
      assert.strictEqual((provider.validatePackageName("@typescript-eslint/parser")), true);
    });
  });

  describe("language property", () => {
    test("should have correct language identifier", () => {
      const provider = new NodeJSProvider();
      assert.strictEqual((provider.language), "nodejs");
    });
  });

  describe("constructor options", () => {
    test("should accept empty options", () => {
      const provider = new NodeJSProvider();
      assert.notStrictEqual((provider), undefined);
    });

    test("should accept yarnConfig option", () => {
      const provider = new NodeJSProvider({ yarnConfig: true });
      assert.notStrictEqual((provider), undefined);
    });

    test("should accept debug option", () => {
      const provider = new NodeJSProvider({ debug: true });
      assert.notStrictEqual((provider), undefined);
    });

    test("should accept packageManager option", () => {
      const provider = new NodeJSProvider({ packageManager: "pnpm" });
      assert.notStrictEqual((provider), undefined);
    });
  });
});
