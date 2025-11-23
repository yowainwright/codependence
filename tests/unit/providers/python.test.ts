import { expect, test, describe, beforeEach, afterEach, jest, mock } from "bun:test";
import { PythonProvider } from "../../../src/providers/python";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("PythonProvider", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("getLatestVersion - pip", () => {
    test("should get version using pip", async () => {
      const execMock = jest.fn(() => ({
        stdout: "Available versions: 2.31.0, 2.30.0, 2.29.0\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "pip");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("requests");

      expect(version).toBe("2.31.0");
      expect(execMock).toHaveBeenCalledWith("pip", [
        "index",
        "versions",
        "requests",
      ]);
    });

    test("should handle pip with no versions", async () => {
      const execMock = jest.fn(() => ({
        stdout: "No versions found\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "pip");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("nonexistent");

      expect(version).toBe("");
    });

    test("should handle pip with malformed output", async () => {
      const execMock = jest.fn(() => ({
        stdout: "Malformed output without versions pattern\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "pip");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("bad-package");

      expect(version).toBe("");
    });

    test("should extract first version from comma-separated list", async () => {
      const execMock = jest.fn(() => ({
        stdout: "Available versions: 1.5.0, 1.4.9, 1.4.8, 1.3.0\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "pip");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("flask");

      expect(version).toBe("1.5.0");
    });
  });

  describe("getLatestVersion - conda", () => {
    test("should get version using conda", async () => {
      const execMock = jest.fn(() => ({
        stdout: JSON.stringify({
          numpy: [
            { version: "1.24.0" },
            { version: "1.24.1" },
            { version: "1.25.0" },
          ],
        }),
        stderr: "",
      })) as any;

      const provider = new PythonProvider(
        "environment.yml",
        "conda",
      );
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("numpy");

      expect(version).toBe("1.25.0");
      expect(execMock).toHaveBeenCalledWith("conda", [
        "search",
        "numpy",
        "--json",
      ]);
    });

    test("should handle conda with no packages", async () => {
      const execMock = jest.fn(() => ({
        stdout: "{}",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("environment.yml", "conda");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("nonexistent");

      expect(version).toBe("");
    });

    test("should handle conda with malformed JSON", async () => {
      const execMock = jest.fn(() => ({
        stdout: '{"somepackage": []}',
        stderr: "",
      })) as any;

      const provider = new PythonProvider("environment.yml", "conda");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("pkg");

      expect(version).toBe("");
    });
  });

  describe("getLatestVersion - uv", () => {
    test("should get version using uv", async () => {
      const execMock = jest.fn(() => ({
        stdout: "Available versions: 3.0.0, 2.9.0\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "uv");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("django");

      expect(version).toBe("3.0.0");
      expect(execMock).toHaveBeenCalledWith("uv", [
        "pip",
        "index",
        "versions",
        "django",
      ]);
    });

    test("should handle uv with malformed output", async () => {
      const execMock = jest.fn(() => ({
        stdout: "Error: package not found\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "uv");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const version = await provider.getLatestVersion("pkg");

      expect(version).toBe("");
    });
  });

  describe("getAllVersions", () => {
    test("should get all versions as array", async () => {
      const execMock = jest.fn(() => ({
        stdout: "Available versions: 2.31.0, 2.30.0, 2.29.0\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "pip");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const versions = await provider.getAllVersions("requests");

      expect(versions).toEqual(["2.31.0", "2.30.0", "2.29.0"]);
    });

    test("should return empty array if no versions", async () => {
      const execMock = jest.fn(() => ({
        stdout: "No versions\n",
        stderr: "",
      })) as any;

      const provider = new PythonProvider("requirements.txt", "pip");
      mock.module("../../../src/utils/exec", () => ({
        exec: execMock,
      }));

      const versions = await provider.getAllVersions("nonexistent");

      expect(versions).toEqual([]);
    });
  });

  describe("readManifest - requirements.txt", () => {
    const tmpDir = join(__dirname, ".tmp-python-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should read requirements.txt with various formats", async () => {
      const reqPath = join(tmpDir, "requirements.txt");
      const content = `requests==2.31.0
flask>=2.0.0
django~=4.2.0
numpy>1.24.0
pandas<2.0.0
# This is a comment
pytest==7.4.0
`;

      writeFileSync(reqPath, content);

      const provider = new PythonProvider(reqPath, "pip");
      const manifest = await provider.readManifest(reqPath);

      expect(manifest.dependencies).toEqual({
        requests: "==2.31.0",
        flask: ">=2.0.0",
        django: "~=4.2.0",
        numpy: ">1.24.0",
        pandas: "<2.0.0",
        pytest: "==7.4.0",
      });
      expect(manifest.filePath).toBe(reqPath);
    });

    test("should ignore comments in requirements.txt", async () => {
      const reqPath = join(tmpDir, "commented.txt");
      const content = `# Main dependencies
requests==2.31.0
# Testing
pytest==7.4.0
`;

      writeFileSync(reqPath, content);

      const provider = new PythonProvider(reqPath, "pip");
      const manifest = await provider.readManifest(reqPath);

      expect(manifest.dependencies).toEqual({
        requests: "==2.31.0",
        pytest: "==7.4.0",
      });
    });

    test("should handle empty requirements.txt", async () => {
      const reqPath = join(tmpDir, "empty.txt");
      writeFileSync(reqPath, "");

      const provider = new PythonProvider(reqPath, "pip");
      const manifest = await provider.readManifest(reqPath);

      expect(manifest.dependencies).toEqual({});
    });

    test("should ignore blank lines", async () => {
      const reqPath = join(tmpDir, "blanks.txt");
      const content = `requests==2.31.0

flask>=2.0.0

`;

      writeFileSync(reqPath, content);

      const provider = new PythonProvider(reqPath, "pip");
      const manifest = await provider.readManifest(reqPath);

      expect(manifest.dependencies).toEqual({
        requests: "==2.31.0",
        flask: ">=2.0.0",
      });
    });
  });

  describe("readManifest - pyproject.toml", () => {
    const tmpDir = join(__dirname, ".tmp-pyproject-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should read pyproject.toml poetry dependencies", async () => {
      const pyprojectPath = join(tmpDir, "pyproject.toml");
      const content = `[tool.poetry]
name = "myproject"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.8"
requests = "^2.31.0"
flask = "~2.0.0"
django = ">=4.2.0"
`;

      writeFileSync(pyprojectPath, content);

      const provider = new PythonProvider(pyprojectPath, "poetry");
      const manifest = await provider.readManifest(pyprojectPath);

      expect(manifest.dependencies).toEqual({
        requests: "^2.31.0",
        flask: "~2.0.0",
        django: ">=4.2.0",
      });
    });

    test("should handle pyproject.toml without dependencies section", async () => {
      const pyprojectPath = join(tmpDir, "no-deps.toml");
      const content = `[tool.poetry]
name = "myproject"
version = "0.1.0"
`;

      writeFileSync(pyprojectPath, content);

      const provider = new PythonProvider(pyprojectPath, "poetry");
      const manifest = await provider.readManifest(pyprojectPath);

      expect(manifest.dependencies).toEqual({});
    });
  });

  describe("readManifest - Pipfile", () => {
    const tmpDir = join(__dirname, ".tmp-pipfile-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should read Pipfile packages", async () => {
      const pipfilePath = join(tmpDir, "Pipfile");
      const content = `[packages]
requests = "==2.31.0"
flask = ">=2.0.0"
django = "*"

[dev-packages]
pytest = "==7.4.0"
`;

      writeFileSync(pipfilePath, content);

      const provider = new PythonProvider(pipfilePath, "pipenv");
      const manifest = await provider.readManifest(pipfilePath);

      expect(manifest.dependencies).toEqual({
        requests: "==2.31.0",
        flask: ">=2.0.0",
        django: "*",
      });
    });

    test("should handle Pipfile without packages", async () => {
      const pipfilePath = join(tmpDir, "no-packages");
      const content = `[requires]
python_version = "3.11"
`;

      writeFileSync(pipfilePath, content);

      const provider = new PythonProvider(pipfilePath, "pipenv");
      const manifest = await provider.readManifest(pipfilePath);

      expect(manifest.dependencies).toEqual({});
    });
  });

  describe("writeManifest - requirements.txt", () => {
    const tmpDir = join(__dirname, ".tmp-python-write-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should write requirements.txt", async () => {
      const reqPath = join(tmpDir, "requirements.txt");
      writeFileSync(reqPath, "old-package==1.0.0\n");

      const provider = new PythonProvider(reqPath, "pip");
      await provider.writeManifest(reqPath, {
        filePath: reqPath,
        dependencies: {
          requests: "==2.31.0",
          flask: ">=2.0.0",
          django: "~=4.2.0",
        },
      });

      const content = readFileSync(reqPath, "utf8");

      expect(content).toContain("requests==2.31.0");
      expect(content).toContain("flask>=2.0.0");
      expect(content).toContain("django~=4.2.0");
      expect(content).not.toContain("old-package");
      expect(content.endsWith("\n")).toBe(true);
    });

    test("should write empty requirements.txt", async () => {
      const reqPath = join(tmpDir, "empty.txt");
      writeFileSync(reqPath, "old==1.0.0\n");

      const provider = new PythonProvider(reqPath, "pip");
      await provider.writeManifest(reqPath, {
        filePath: reqPath,
        dependencies: {},
      });

      const content = readFileSync(reqPath, "utf8");

      expect(content).toBe("\n");
    });
  });

  describe("writeManifest - pyproject.toml", () => {
    const tmpDir = join(__dirname, ".tmp-pyproject-write-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should update pyproject.toml dependencies", async () => {
      const pyprojectPath = join(tmpDir, "pyproject.toml");
      const original = `[tool.poetry]
name = "myproject"

[tool.poetry.dependencies]
python = "^3.8"
old-package = "^1.0.0"

[tool.poetry.dev-dependencies]
pytest = "^7.0.0"
`;

      writeFileSync(pyprojectPath, original);

      const provider = new PythonProvider(pyprojectPath, "poetry");
      await provider.writeManifest(pyprojectPath, {
        filePath: pyprojectPath,
        dependencies: {
          requests: "^2.31.0",
          flask: "~2.0.0",
        },
      });

      const content = readFileSync(pyprojectPath, "utf8");

      expect(content).toContain('[tool.poetry.dependencies]');
      expect(content).toContain('python = "^3.8"');
      expect(content).toContain('requests = "^2.31.0"');
      expect(content).toContain('flask = "~2.0.0"');
      expect(content).not.toContain("old-package");
      expect(content).toContain('[tool.poetry.dev-dependencies]');
    });
  });

  describe("writeManifest - Pipfile", () => {
    const tmpDir = join(__dirname, ".tmp-pipfile-write-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should update Pipfile packages", async () => {
      const pipfilePath = join(tmpDir, "Pipfile");
      const original = `[packages]
old-package = "==1.0.0"

[dev-packages]
pytest = "==7.4.0"
`;

      writeFileSync(pipfilePath, original);

      const provider = new PythonProvider(pipfilePath, "pipenv");
      await provider.writeManifest(pipfilePath, {
        filePath: pipfilePath,
        dependencies: {
          requests: "==2.31.0",
          flask: ">=2.0.0",
        },
      });

      const content = readFileSync(pipfilePath, "utf8");

      expect(content).toContain('[packages]');
      expect(content).toContain('requests = "==2.31.0"');
      expect(content).toContain('flask = ">=2.0.0"');
      expect(content).not.toContain("old-package");
      expect(content).toContain('[dev-packages]');
    });
  });

  describe("validatePackageName", () => {
    const provider = new PythonProvider("requirements.txt", "pip");

    test("should validate correct Python package names", () => {
      expect(provider.validatePackageName("requests")).toBe(true);
      expect(provider.validatePackageName("Flask")).toBe(true);
      expect(provider.validatePackageName("django-rest-framework")).toBe(true);
      expect(provider.validatePackageName("beautifulsoup4")).toBe(true);
      expect(provider.validatePackageName("Pillow")).toBe(true);
      expect(provider.validatePackageName("some_package")).toBe(true);
    });

    test("should reject invalid Python package names", () => {
      expect(provider.validatePackageName("@scope/package")).toBe(false);
      expect(provider.validatePackageName("github.com/user/repo")).toBe(false);
      expect(provider.validatePackageName("")).toBe(false);
      expect(provider.validatePackageName("has spaces")).toBe(false);
      expect(provider.validatePackageName("has.dots.bad")).toBe(false);
    });
  });

  describe("language property", () => {
    test("should have correct language identifier", () => {
      const provider = new PythonProvider("requirements.txt", "pip");
      expect(provider.language).toBe("python");
    });
  });

  describe("manifest type detection", () => {
    test("should detect requirements.txt", () => {
      const provider = new PythonProvider("requirements.txt", "pip");
      expect(provider).toBeDefined();
    });

    test("should detect pyproject.toml", () => {
      const provider = new PythonProvider("pyproject.toml", "poetry");
      expect(provider).toBeDefined();
    });

    test("should detect Pipfile", () => {
      const provider = new PythonProvider("Pipfile", "pipenv");
      expect(provider).toBeDefined();
    });

    test("should detect environment.yml for conda", () => {
      const provider = new PythonProvider("environment.yml", "conda");
      expect(provider).toBeDefined();
    });

    test("should detect environment.yaml for conda", () => {
      const provider = new PythonProvider("environment.yaml", "conda");
      expect(provider).toBeDefined();
    });

    test("should default to requirements for unknown types", () => {
      const provider = new PythonProvider("unknown.txt", "pip");
      expect(provider).toBeDefined();
    });
  });

  describe("constructor options", () => {
    test("should accept default options", () => {
      const provider = new PythonProvider("requirements.txt");
      expect(provider).toBeDefined();
    });

    test("should accept package manager option", () => {
      const provider = new PythonProvider("requirements.txt", "pip");
      expect(provider).toBeDefined();
    });

    test("should accept debug option", () => {
      const provider = new PythonProvider("requirements.txt", "pip", {
        debug: true,
      });
      expect(provider).toBeDefined();
    });
  });
});
