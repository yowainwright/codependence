import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertThrows } from "../../helpers/assertions";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { logger } from "../../../src/observability";
import { configureBinaryHost } from "../../../src/cli/utils";
import { exec } from "../../../src/utils/process";
import {
  GoProvider,
  runGoModTidy,
  updateRequireLine,
  updateExistingRequireLines,
} from "../../../src/providers/go";

const execMock = mock.fn<typeof exec>();
const runExecMock = async (command: string, args: string[]): Promise<string> =>
  JSON.stringify(await execMock(command, args));
let restoreBinaryHost: (() => void) | undefined;

const configureExecMock = (): void => {
  restoreBinaryHost = configureBinaryHost(
    runExecMock,
    () => "{}",
    async () => "",
  );
};

describe("GoProvider", () => {
  afterEach(() => {
    restoreBinaryHost?.();
    restoreBinaryHost = undefined;
    execMock.mock.restore();
    execMock.mock.resetCalls();
  });

  describe("getLatestVersion", () => {
    beforeEach(configureExecMock);

    test("should get latest version from go list output", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "github.com/example/pkg v1.0.0 v1.1.0 v1.2.0 v1.2.1 v2.0.0",
        stderr: "",
      }));

      const provider = new GoProvider({ isTesting: true });

      const version = await provider.getLatestVersion("github.com/example/pkg");

      assert.strictEqual(version, "v2.0.0");
      assertCalledWith(execMock, "go", ["list", "-m", "-versions", "github.com/example/pkg"]);
    });

    test("should filter out non-version entries", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "github.com/example/pkg v1.0.0 latest v2.0.0",
        stderr: "",
      }));

      const provider = new GoProvider({ isTesting: true });

      const version = await provider.getLatestVersion("github.com/example/pkg");

      assert.strictEqual(version, "v2.0.0");
    });

    test("should return empty string if no versions found", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "github.com/example/pkg",
        stderr: "",
      }));

      const provider = new GoProvider({ isTesting: true });

      const version = await provider.getLatestVersion("github.com/example/pkg");

      assert.strictEqual(version, "");
    });

    test("should handle single version", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "github.com/example/pkg v1.0.0",
        stderr: "",
      }));

      const provider = new GoProvider({ isTesting: true });

      const version = await provider.getLatestVersion("github.com/example/pkg");

      assert.strictEqual(version, "v1.0.0");
    });
  });

  describe("getAllVersions", () => {
    beforeEach(configureExecMock);

    test("should get all versions as array", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "github.com/example/pkg v1.0.0 v1.1.0 v2.0.0",
        stderr: "",
      }));

      const provider = new GoProvider({ isTesting: true });

      const versions = await provider.getAllVersions("github.com/example/pkg");

      assert.deepStrictEqual(versions, ["v1.0.0", "v1.1.0", "v2.0.0"]);
    });

    test("should filter non-version strings", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "pkg latest v1.0.0 main v2.0.0",
        stderr: "",
      }));

      const provider = new GoProvider({ isTesting: true });

      const versions = await provider.getAllVersions("github.com/example/pkg");

      assert.deepStrictEqual(versions, ["v1.0.0", "v2.0.0"]);
    });

    test("should return empty array if no versions", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "github.com/example/pkg",
        stderr: "",
      }));

      const provider = new GoProvider({ isTesting: true });

      const versions = await provider.getAllVersions("github.com/example/pkg");

      assert.deepStrictEqual(versions, []);
    });
  });

  describe("readManifest", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-go-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should read go.mod with require block", async () => {
      const goModPath = join(tmpDir, "go.mod");
      const goModContent =
        "module github.com/example/myapp\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.9.1\n" +
        "\tgithub.com/lib/pq v1.10.9\n" +
        "\tgolang.org/x/crypto v0.14.0\n" +
        ")\n";

      writeFileSync(goModPath, goModContent);

      const provider = new GoProvider({ isTesting: true });
      const manifest = await provider.readManifest(goModPath);

      assert.strictEqual(manifest.name, "github.com/example/myapp");
      assert.strictEqual(manifest.version, "1.21");
      assert.deepStrictEqual(manifest.dependencies, {
        "github.com/gin-gonic/gin": "v1.9.1",
        "github.com/lib/pq": "v1.10.9",
        "golang.org/x/crypto": "v0.14.0",
      });
      assert.strictEqual(manifest.filePath, goModPath);
    });

    test("should read go.mod with single require statements", async () => {
      const goModPath = join(tmpDir, "single-require.mod");
      const goModContent = `module github.com/example/app

go 1.20

require github.com/stretchr/testify v1.8.4
require github.com/joho/godotenv v1.5.1
`;

      writeFileSync(goModPath, goModContent);

      const provider = new GoProvider({ isTesting: true });
      const manifest = await provider.readManifest(goModPath);

      assert.deepStrictEqual(manifest.dependencies, {
        "github.com/stretchr/testify": "v1.8.4",
        "github.com/joho/godotenv": "v1.5.1",
      });
    });

    test("should read go.mod with both block and single requires", async () => {
      const goModPath = join(tmpDir, "mixed.mod");
      const goModContent =
        "module example.com/myapp\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/pkg1 v1.0.0\n" +
        "\tgithub.com/pkg2 v2.0.0\n" +
        ")\n\n" +
        "require github.com/pkg3 v3.0.0\n";

      writeFileSync(goModPath, goModContent);

      const provider = new GoProvider({ isTesting: true });
      const manifest = await provider.readManifest(goModPath);

      assert.deepStrictEqual(manifest.dependencies, {
        "github.com/pkg1": "v1.0.0",
        "github.com/pkg2": "v2.0.0",
        "github.com/pkg3": "v3.0.0",
      });
    });

    test("should read every require block", async () => {
      const goModPath = join(tmpDir, "multiple-blocks.mod");
      const goModContent = `module example.com/myapp

go 1.21

require (
	github.com/direct/pkg v1.0.0
)

require (
	github.com/indirect/pkg v2.0.0 // indirect
)
`;

      writeFileSync(goModPath, goModContent);

      const provider = new GoProvider({ isTesting: true });
      const manifest = await provider.readManifest(goModPath);

      assert.deepStrictEqual(manifest.dependencies, {
        "github.com/direct/pkg": "v1.0.0",
        "github.com/indirect/pkg": "v2.0.0",
      });
    });

    test("should handle go.mod without requires", async () => {
      const goModPath = join(tmpDir, "no-deps.mod");
      const goModContent = `module github.com/example/simple

go 1.21
`;

      writeFileSync(goModPath, goModContent);

      const provider = new GoProvider({ isTesting: true });
      const manifest = await provider.readManifest(goModPath);

      assert.strictEqual(manifest.name, "github.com/example/simple");
      assert.strictEqual(manifest.version, "1.21");
      assert.deepStrictEqual(manifest.dependencies, {});
    });

    test("should handle go.mod without go version", async () => {
      const goModPath = join(tmpDir, "no-version.mod");
      const goModContent = `module github.com/example/app

require github.com/pkg v1.0.0
`;

      writeFileSync(goModPath, goModContent);

      const provider = new GoProvider({ isTesting: true });
      const manifest = await provider.readManifest(goModPath);

      assert.strictEqual(manifest.name, "github.com/example/app");
      assert.strictEqual(manifest.version, undefined);
    });
  });

  describe("writeManifest", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-go-write-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should update require block in go.mod", async () => {
      const goModPath = join(tmpDir, "go.mod");
      const originalContent = `module github.com/example/app

go 1.21

require (
\tgithub.com/old/pkg v1.0.0
)
`;

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: {
          "github.com/new/pkg": "v2.0.0",
          "github.com/another/pkg": "v1.5.0",
        },
      });

      const updated = readFileSync(goModPath, "utf8");

      assert.ok(updated.includes("require ("));
      assert.ok(updated.includes("github.com/new/pkg v2.0.0"));
      assert.ok(updated.includes("github.com/another/pkg v1.5.0"));
      assert.ok(!updated.includes("github.com/old/pkg"));
      assert.ok(updated.includes("module github.com/example/app"));
      assert.ok(updated.includes("go 1.21"));
    });

    test("should replace single requires with block", async () => {
      const goModPath = join(tmpDir, "single.mod");
      const originalContent = `module github.com/example/app

go 1.21

require github.com/old/pkg v1.0.0
`;

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: {
          "github.com/pkg1": "v1.0.0",
          "github.com/pkg2": "v2.0.0",
        },
      });

      const updated = readFileSync(goModPath, "utf8");

      assert.ok(updated.includes("require ("));
      assert.ok(updated.includes("github.com/pkg1 v1.0.0"));
      assert.ok(updated.includes("github.com/pkg2 v2.0.0"));
    });

    test("should add require block if none exists", async () => {
      const goModPath = join(tmpDir, "no-require.mod");
      const originalContent = `module github.com/example/app

go 1.21
`;

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: {
          "github.com/new/pkg": "v1.0.0",
        },
      });

      const updated = readFileSync(goModPath, "utf8");

      assert.ok(updated.includes("require ("));
      assert.ok(updated.includes("github.com/new/pkg v1.0.0"));
      assert.ok(updated.includes("module github.com/example/app"));
    });

    test("should format require block with proper indentation", async () => {
      const goModPath = join(tmpDir, "format.mod");
      const originalContent = `module test

go 1.21

require (
\told v1.0.0
)
`;

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: {
          "github.com/pkg": "v1.0.0",
        },
      });

      const updated = readFileSync(goModPath, "utf8");

      assert.ok(updated.includes("\tgithub.com/pkg v1.0.0"));
    });

    test("should end file with newline", async () => {
      const goModPath = join(tmpDir, "newline.mod");
      writeFileSync(goModPath, "module test\n\ngo 1.21\n");

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: { "github.com/pkg": "v1.0.0" },
      });

      const content = readFileSync(goModPath, "utf8");
      assert.strictEqual(content.endsWith("\n"), true);
    });

    test("should update existing require lines in place", async () => {
      const goModPath = join(tmpDir, "indirect.mod");
      const originalContent =
        "module github.com/example/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/pkg v1.0.0 // indirect\n" +
        ")\n";

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: { "github.com/pkg": "v1.2.0" },
      });

      const updated = readFileSync(goModPath, "utf8");
      assert.ok(updated.includes("\tgithub.com/pkg v1.2.0 // indirect"));
      assert.ok(updated.includes("module github.com/example/app"));
      assert.ok(updated.includes("go 1.21"));
    });

    test("should not modify replace directive source versions", async () => {
      const goModPath = join(tmpDir, "replace.mod");
      const originalContent =
        "module github.com/example/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.0.0\n" +
        ")\n\n" +
        "replace github.com/old/module v1.0.0 => github.com/fork/module v2.0.0\n";

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: { "github.com/gin-gonic/gin": "v1.9.1" },
      });

      const updated = readFileSync(goModPath, "utf8");
      assert.ok(updated.includes("github.com/gin-gonic/gin v1.9.1"));
      assert.ok(
        updated.includes("replace github.com/old/module v1.0.0 => github.com/fork/module v2.0.0"),
      );
    });

    test("should preserve // indirect when dep is already at correct version", async () => {
      const goModPath = join(tmpDir, "no-change.mod");
      const originalContent =
        "module github.com/example/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/pkg v1.0.0 // indirect\n" +
        ")\n";

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: { "github.com/pkg": "v1.0.0" },
      });

      const updated = readFileSync(goModPath, "utf8");
      assert.ok(updated.includes("\tgithub.com/pkg v1.0.0 // indirect"));
    });

    test("should preserve exclude block contents", async () => {
      const goModPath = join(tmpDir, "exclude.mod");
      const originalContent =
        "module github.com/example/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.0.0\n" +
        ")\n\n" +
        "exclude (\n" +
        "\tgithub.com/bad/module v0.1.0\n" +
        ")\n";

      writeFileSync(goModPath, originalContent);

      const provider = new GoProvider({ isTesting: true });
      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: { "github.com/gin-gonic/gin": "v1.9.1" },
      });

      const updated = readFileSync(goModPath, "utf8");
      assert.ok(updated.includes("github.com/gin-gonic/gin v1.9.1"));
      assert.ok(updated.includes("exclude ("));
      assert.ok(updated.includes("github.com/bad/module v0.1.0"));
    });
  });

  describe("validatePackageName", () => {
    const provider = new GoProvider({ isTesting: true });

    test("should validate correct Go package names", () => {
      assert.strictEqual(provider.validatePackageName("github.com/user/repo"), true);
      assert.strictEqual(provider.validatePackageName("golang.org/x/crypto"), true);
      assert.strictEqual(provider.validatePackageName("gopkg.in/yaml"), true);
      assert.strictEqual(provider.validatePackageName("github.com/aws/aws-sdk-go"), true);
      assert.strictEqual(provider.validatePackageName("example.com/my/package"), true);
    });

    test("should reject invalid Go package names", () => {
      assert.strictEqual(provider.validatePackageName("lodash"), false);
      assert.strictEqual(provider.validatePackageName("@scope/package"), false);
      assert.strictEqual(provider.validatePackageName(""), false);
      assert.strictEqual(provider.validatePackageName("github.com"), false);
      assert.strictEqual(provider.validatePackageName("not-a-domain/package"), false);
    });

    test("should handle different domain TLDs", () => {
      assert.strictEqual(provider.validatePackageName("example.com/org/pkg"), true);
      assert.strictEqual(provider.validatePackageName("example.io/pkg"), true);
      assert.strictEqual(provider.validatePackageName("example.dev/pkg"), true);
    });
  });

  describe("updateRequireLine", () => {
    test("should update version when dep is found", () => {
      const deps = { "github.com/pkg": "v1.2.0" };
      const result = updateRequireLine("\tgithub.com/pkg v1.0.0", deps);
      assert.strictEqual(result.updated, true);
      assert.strictEqual(result.line, "\tgithub.com/pkg v1.2.0");
    });

    test("should preserve // indirect comment", () => {
      const deps = { "github.com/pkg": "v1.2.0" };
      const result = updateRequireLine("\tgithub.com/pkg v1.0.0 // indirect", deps);
      assert.strictEqual(result.updated, true);
      assert.strictEqual(result.line, "\tgithub.com/pkg v1.2.0 // indirect");
    });

    test("should skip replace lines", () => {
      const deps = { "github.com/old/module": "v2.0.0" };
      const result = updateRequireLine(
        "\treplace github.com/old/module v1.0.0 => github.com/fork/module v2.0.0",
        deps,
      );
      assert.strictEqual(result.updated, false);
      assert.ok(result.line.includes("replace github.com/old/module"));
    });

    test("should skip unknown deps", () => {
      const deps = { "github.com/other": "v2.0.0" };
      const result = updateRequireLine("\tgithub.com/pkg v1.0.0", deps);
      assert.strictEqual(result.updated, false);
      assert.strictEqual(result.line, "\tgithub.com/pkg v1.0.0");
    });
  });

  describe("updateExistingRequireLines", () => {
    test("should preserve replace block contents", () => {
      const content =
        "module example.com/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.0.0\n" +
        ")\n\n" +
        "replace github.com/old/module v1.0.0 => github.com/fork/module v2.0.0\n";
      const deps = { "github.com/gin-gonic/gin": "v1.9.1" };
      const { content: result } = updateExistingRequireLines(content, deps);
      assert.ok(
        result.includes("replace github.com/old/module v1.0.0 => github.com/fork/module v2.0.0"),
      );
      assert.ok(result.includes("github.com/gin-gonic/gin v1.9.1"));
    });

    test("should preserve replace block lines", () => {
      const content =
        "module example.com/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.0.0\n" +
        ")\n\n" +
        "replace (\n" +
        "\tgithub.com/old/module v1.0.0 => github.com/fork/module v2.0.0\n" +
        ")\n";
      const deps = { "github.com/gin-gonic/gin": "v1.9.1" };
      const { content: result } = updateExistingRequireLines(content, deps);
      assert.ok(result.includes("github.com/old/module v1.0.0 => github.com/fork/module v2.0.0"));
      assert.ok(result.includes("github.com/gin-gonic/gin v1.9.1"));
    });

    test("should preserve exclude block contents", () => {
      const content =
        "module example.com/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.0.0\n" +
        ")\n\n" +
        "exclude (\n" +
        "\tgithub.com/bad/module v0.1.0\n" +
        ")\n";
      const deps = { "github.com/gin-gonic/gin": "v1.9.1" };
      const { content: result, updatedCount } = updateExistingRequireLines(content, deps);
      assert.ok(result.includes("exclude ("));
      assert.ok(result.includes("github.com/bad/module v0.1.0"));
      assert.strictEqual(updatedCount, 1);
    });

    test("should update multiple deps", () => {
      const content =
        "module example.com/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.0.0\n" +
        "\tgithub.com/lib/pq v1.0.0\n" +
        ")\n";
      const deps = { "github.com/gin-gonic/gin": "v1.9.1", "github.com/lib/pq": "v1.10.9" };
      const { content: result, updatedCount } = updateExistingRequireLines(content, deps);
      assert.ok(result.includes("github.com/gin-gonic/gin v1.9.1"));
      assert.ok(result.includes("github.com/lib/pq v1.10.9"));
      assert.strictEqual(updatedCount, 2);
    });

    test("should be a no-op when deps unchanged", () => {
      const content =
        "module example.com/app\n\n" +
        "go 1.21\n\n" +
        "require (\n" +
        "\tgithub.com/gin-gonic/gin v1.9.1\n" +
        ")\n";
      const deps = { "github.com/gin-gonic/gin": "v1.9.1" };
      const { content: result, updatedCount } = updateExistingRequireLines(content, deps);
      assert.strictEqual(updatedCount, 0);
      assert.strictEqual(result, content);
    });
  });

  describe("language property", () => {
    test("should have correct language identifier", () => {
      const provider = new GoProvider({ isTesting: true });
      assert.strictEqual(provider.language, "go");
    });
  });

  describe("constructor options", () => {
    test("should accept empty options", () => {
      const provider = new GoProvider();
      assert.notStrictEqual(provider, undefined);
    });

    test("should accept isTesting option", () => {
      const provider = new GoProvider({ isTesting: true });
      assert.notStrictEqual(provider, undefined);
    });

    test("should accept debug option", () => {
      const provider = new GoProvider({ debug: true, isTesting: true });
      assert.notStrictEqual(provider, undefined);
    });
  });

  test("writeManifest skips lockfile regeneration while testing", () => {
    const goModPath = join(import.meta.dirname, ".tmp-write", "go.mod");
    mkdirSync(join(import.meta.dirname, ".tmp-write"), { recursive: true });
    writeFileSync(goModPath, "module test\n\ngo 1.21\n\nrequire github.com/example/pkg v1.0.0\n");

    const provider = new GoProvider({ isTesting: true });
    provider.writeManifest(goModPath, {
      filePath: goModPath,
      dependencies: { "github.com/example/pkg": "v2.0.0" },
    });

    assert.ok(readFileSync(goModPath, "utf8").includes("github.com/example/pkg v2.0.0"));
    rmSync(join(import.meta.dirname, ".tmp-write"), { recursive: true, force: true });
  });

  test("runGoModTidy regenerates the lockfile beside go.mod", () => {
    const execute = mock.fn();
    const goModPath = join(import.meta.dirname, "fixture", "go.mod");

    runGoModTidy(goModPath, {}, execute as typeof import("child_process").execFileSync);

    assertCalledWith(execute, "go", ["mod", "tidy"], {
      cwd: join(import.meta.dirname, "fixture"),
      stdio: "ignore",
    });
  });

  test("runGoModTidy honors manifest-only updates", () => {
    const execute = mock.fn();

    runGoModTidy(
      "go.mod",
      { regenerateLockfile: false },
      execute as typeof import("child_process").execFileSync,
    );

    assert.strictEqual(execute.mock.callCount(), 0);
  });

  test("runGoModTidy reports and propagates failures in debug mode", () => {
    const failure = new Error("tidy failed");
    const execute = mock.fn(() => {
      throw failure;
    });
    const error = mock.method(logger, "error", () => {});

    const run = () =>
      runGoModTidy(
        "go.mod",
        { debug: true },
        execute as unknown as typeof import("child_process").execFileSync,
      );

    assertThrows(run, failure);
    assertCalledWith(error, "Failed to run go mod tidy", failure);
  });
});
