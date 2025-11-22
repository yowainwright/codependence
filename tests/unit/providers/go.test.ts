import { expect, test, describe, beforeEach, afterEach, jest, mock } from "bun:test";
import { GoProvider } from "../../../src/providers/go";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("GoProvider", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("getLatestVersion", () => {
    test("should get latest version from go list output", async () => {
      const execMock = jest.fn(() => ({
        stdout:
          "github.com/example/pkg v1.0.0 v1.1.0 v1.2.0 v1.2.1 v2.0.0",
        stderr: "",
      })) as any;

      const provider = new GoProvider({ isTesting: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("github.com/example/pkg");

      expect(version).toBe("v2.0.0");
      expect(execMock).toHaveBeenCalledWith("go", [
        "list",
        "-m",
        "-versions",
        "github.com/example/pkg",
      ]);
    });

    test("should filter out non-version entries", async () => {
      const execMock = jest.fn(() => ({
        stdout: "github.com/example/pkg v1.0.0 latest v2.0.0",
        stderr: "",
      })) as any;

      const provider = new GoProvider({ isTesting: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("github.com/example/pkg");

      expect(version).toBe("v2.0.0");
    });

    test("should return empty string if no versions found", async () => {
      const execMock = jest.fn(() => ({
        stdout: "github.com/example/pkg",
        stderr: "",
      })) as any;

      const provider = new GoProvider({ isTesting: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("github.com/example/pkg");

      expect(version).toBe("");
    });

    test("should handle single version", async () => {
      const execMock = jest.fn(() => ({
        stdout: "github.com/example/pkg v1.0.0",
        stderr: "",
      })) as any;

      const provider = new GoProvider({ isTesting: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("github.com/example/pkg");

      expect(version).toBe("v1.0.0");
    });
  });

  describe("getAllVersions", () => {
    test("should get all versions as array", async () => {
      const execMock = jest.fn(() => ({
        stdout: "github.com/example/pkg v1.0.0 v1.1.0 v2.0.0",
        stderr: "",
      })) as any;

      const provider = new GoProvider({ isTesting: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const versions =
        await provider.getAllVersions("github.com/example/pkg");

      expect(versions).toEqual(["v1.0.0", "v1.1.0", "v2.0.0"]);
    });

    test("should filter non-version strings", async () => {
      const execMock = jest.fn(() => ({
        stdout: "pkg latest v1.0.0 main v2.0.0",
        stderr: "",
      })) as any;

      const provider = new GoProvider({ isTesting: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const versions = await provider.getAllVersions("github.com/example/pkg");

      expect(versions).toEqual(["v1.0.0", "v2.0.0"]);
    });

    test("should return empty array if no versions", async () => {
      const execMock = jest.fn(() => ({
        stdout: "github.com/example/pkg",
        stderr: "",
      })) as any;

      const provider = new GoProvider({ isTesting: true });
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const versions = await provider.getAllVersions("github.com/example/pkg");

      expect(versions).toEqual([]);
    });
  });

  describe("readManifest", () => {
    const tmpDir = join(__dirname, ".tmp-go-test");

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

      expect(manifest.name).toBe("github.com/example/myapp");
      expect(manifest.version).toBe("1.21");
      expect(manifest.dependencies).toEqual({
        "github.com/gin-gonic/gin": "v1.9.1",
        "github.com/lib/pq": "v1.10.9",
        "golang.org/x/crypto": "v0.14.0",
      });
      expect(manifest.filePath).toBe(goModPath);
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

      expect(manifest.dependencies).toEqual({
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

      expect(manifest.dependencies).toEqual({
        "github.com/pkg1": "v1.0.0",
        "github.com/pkg2": "v2.0.0",
        "github.com/pkg3": "v3.0.0",
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

      expect(manifest.name).toBe("github.com/example/simple");
      expect(manifest.version).toBe("1.21");
      expect(manifest.dependencies).toEqual({});
    });

    test("should handle go.mod without go version", async () => {
      const goModPath = join(tmpDir, "no-version.mod");
      const goModContent = `module github.com/example/app

require github.com/pkg v1.0.0
`;

      writeFileSync(goModPath, goModContent);

      const provider = new GoProvider({ isTesting: true });
      const manifest = await provider.readManifest(goModPath);

      expect(manifest.name).toBe("github.com/example/app");
      expect(manifest.version).toBeUndefined();
    });
  });

  describe("writeManifest", () => {
    const tmpDir = join(__dirname, ".tmp-go-write-test");

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

      expect(updated).toContain("require (");
      expect(updated).toContain("github.com/new/pkg v2.0.0");
      expect(updated).toContain("github.com/another/pkg v1.5.0");
      expect(updated).not.toContain("github.com/old/pkg");
      expect(updated).toContain("module github.com/example/app");
      expect(updated).toContain("go 1.21");
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

      expect(updated).toContain("require (");
      expect(updated).toContain("github.com/pkg1 v1.0.0");
      expect(updated).toContain("github.com/pkg2 v2.0.0");
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

      expect(updated).toContain("require (");
      expect(updated).toContain("github.com/new/pkg v1.0.0");
      expect(updated).toContain("module github.com/example/app");
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

      expect(updated).toContain("\tgithub.com/pkg v1.0.0");
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
      expect(content.endsWith("\n")).toBe(true);
    });
  });

  describe("validatePackageName", () => {
    const provider = new GoProvider({ isTesting: true });

    test("should validate correct Go package names", () => {
      expect(provider.validatePackageName("github.com/user/repo")).toBe(true);
      expect(provider.validatePackageName("golang.org/x/crypto")).toBe(true);
      expect(provider.validatePackageName("gopkg.in/yaml")).toBe(true);
      expect(
        provider.validatePackageName("github.com/aws/aws-sdk-go"),
      ).toBe(true);
      expect(provider.validatePackageName("example.com/my/package")).toBe(true);
    });

    test("should reject invalid Go package names", () => {
      expect(provider.validatePackageName("lodash")).toBe(false);
      expect(provider.validatePackageName("@scope/package")).toBe(false);
      expect(provider.validatePackageName("")).toBe(false);
      expect(provider.validatePackageName("github.com")).toBe(false);
      expect(provider.validatePackageName("not-a-domain/package")).toBe(false);
    });

    test("should handle different domain TLDs", () => {
      expect(provider.validatePackageName("example.com/org/pkg")).toBe(true);
      expect(provider.validatePackageName("example.io/pkg")).toBe(true);
      expect(provider.validatePackageName("example.dev/pkg")).toBe(true);
    });
  });

  describe("language property", () => {
    test("should have correct language identifier", () => {
      const provider = new GoProvider({ isTesting: true });
      expect(provider.language).toBe("go");
    });
  });

  describe("constructor options", () => {
    test("should accept empty options", () => {
      const provider = new GoProvider();
      expect(provider).toBeDefined();
    });

    test("should accept isTesting option", () => {
      const provider = new GoProvider({ isTesting: true });
      expect(provider).toBeDefined();
    });

    test("should accept debug option", () => {
      const provider = new GoProvider({ debug: true, isTesting: true });
      expect(provider).toBeDefined();
    });
  });

  describe("runGoModTidy", () => {
    test("should skip go mod tidy when isTesting is true", async () => {
      const goModPath = join(__dirname, ".tmp-tidy", "go.mod");
      mkdirSync(join(__dirname, ".tmp-tidy"), { recursive: true });
      writeFileSync(
        goModPath,
        "module test\n\ngo 1.21\n\nrequire (\n\tpkg v1.0.0\n)\n",
      );

      const provider = new GoProvider({ isTesting: true });

      await provider.writeManifest(goModPath, {
        filePath: goModPath,
        dependencies: { "github.com/new/pkg": "v2.0.0" },
      });

      rmSync(join(__dirname, ".tmp-tidy"), { recursive: true, force: true });
    });
  });
});
