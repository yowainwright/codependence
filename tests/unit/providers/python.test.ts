import { test, describe, beforeEach, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith } from "../../helpers/assertions";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { configureBinaryHost } from "../../../src/cli/utils";
import { PythonProvider } from "../../../src/providers/python";
import { exec } from "../../../src/utils/process";

const execMock = mock.fn<typeof exec>();
const runExecMock = async (command: string, args: string[]): Promise<string> =>
  JSON.stringify(await execMock(command, args));
const restoreBinaryHost = configureBinaryHost(
  runExecMock,
  () => "{}",
  async () => "",
);

after(restoreBinaryHost);

describe("PythonProvider", () => {
  afterEach(() => {
    execMock.mock.restore();
    execMock.mock.resetCalls();
  });

  describe("getLatestVersion - pip", () => {
    test("should get version using pip", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "Available versions: 2.31.0, 2.30.0, 2.29.0\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "pip");

      const version = await provider.getLatestVersion("requests");

      assert.strictEqual(version, "2.31.0");
      assertCalledWith(execMock, "pip", ["index", "versions", "requests"]);
    });

    test("should handle pip with no versions", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "No versions found\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "pip");

      const version = await provider.getLatestVersion("nonexistent");

      assert.strictEqual(version, "");
    });

    test("should handle pip with malformed output", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "Malformed output without versions pattern\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "pip");

      const version = await provider.getLatestVersion("bad-package");

      assert.strictEqual(version, "");
    });

    test("should extract first version from comma-separated list", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "Available versions: 1.5.0, 1.4.9, 1.4.8, 1.3.0\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "pip");

      const version = await provider.getLatestVersion("flask");

      assert.strictEqual(version, "1.5.0");
    });
  });

  describe("getLatestVersion - conda", () => {
    test("should get version using conda", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: JSON.stringify({
          numpy: [{ version: "1.24.0" }, { version: "1.24.1" }, { version: "1.25.0" }],
        }),
        stderr: "",
      }));

      const provider = new PythonProvider("environment.yml", "conda");

      const version = await provider.getLatestVersion("numpy");

      assert.strictEqual(version, "1.25.0");
      assertCalledWith(execMock, "conda", ["search", "numpy", "--json"]);
    });

    test("should handle conda with no packages", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "{}",
        stderr: "",
      }));

      const provider = new PythonProvider("environment.yml", "conda");

      const version = await provider.getLatestVersion("nonexistent");

      assert.strictEqual(version, "");
    });

    test("should handle conda with malformed JSON", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: '{"somepackage": []}',
        stderr: "",
      }));

      const provider = new PythonProvider("environment.yml", "conda");

      const version = await provider.getLatestVersion("pkg");

      assert.strictEqual(version, "");
    });
  });

  describe("getLatestVersion - uv", () => {
    test("should get version using uv", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "Available versions: 3.0.0, 2.9.0\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "uv");

      const version = await provider.getLatestVersion("django");

      assert.strictEqual(version, "3.0.0");
      assertCalledWith(execMock, "uv", ["pip", "index", "versions", "django"]);
    });

    test("should handle uv with malformed output", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "Error: package not found\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "uv");

      const version = await provider.getLatestVersion("pkg");

      assert.strictEqual(version, "");
    });
  });

  describe("getAllVersions", () => {
    test("should get all versions as array", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "Available versions: 2.31.0, 2.30.0, 2.29.0\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "pip");

      const versions = await provider.getAllVersions("requests");

      assert.deepStrictEqual(versions, ["2.31.0", "2.30.0", "2.29.0"]);
    });

    test("should return empty array if no versions", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "No versions\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "pip");

      const versions = await provider.getAllVersions("nonexistent");

      assert.deepStrictEqual(versions, []);
    });

    test("should get all versions using uv", async () => {
      execMock.mock.mockImplementation(() => ({
        stdout: "Available versions: 3.0.0, 2.9.0\n",
        stderr: "",
      }));

      const provider = new PythonProvider("requirements.txt", "uv");

      const versions = await provider.getAllVersions("django");

      assert.deepStrictEqual(versions, ["3.0.0", "2.9.0"]);
      assertCalledWith(execMock, "uv", ["pip", "index", "versions", "django"]);
    });
  });

  describe("readManifest - requirements.txt", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-python-test");

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

      assert.deepStrictEqual(manifest.dependencies, {
        requests: "==2.31.0",
        flask: ">=2.0.0",
        django: "~=4.2.0",
        numpy: ">1.24.0",
        pandas: "<2.0.0",
        pytest: "==7.4.0",
      });
      assert.strictEqual(manifest.filePath, reqPath);
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

      assert.deepStrictEqual(manifest.dependencies, {
        requests: "==2.31.0",
        pytest: "==7.4.0",
      });
    });

    test("should handle empty requirements.txt", async () => {
      const reqPath = join(tmpDir, "empty.txt");
      writeFileSync(reqPath, "");

      const provider = new PythonProvider(reqPath, "pip");
      const manifest = await provider.readManifest(reqPath);

      assert.deepStrictEqual(manifest.dependencies, {});
    });

    test("should ignore blank lines", async () => {
      const reqPath = join(tmpDir, "blanks.txt");
      const content = `requests==2.31.0

flask>=2.0.0

`;

      writeFileSync(reqPath, content);

      const provider = new PythonProvider(reqPath, "pip");
      const manifest = await provider.readManifest(reqPath);

      assert.deepStrictEqual(manifest.dependencies, {
        requests: "==2.31.0",
        flask: ">=2.0.0",
      });
    });
  });

  describe("readManifest - pyproject.toml", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-pyproject-test");

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

      assert.deepStrictEqual(manifest.dependencies, {
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

      assert.deepStrictEqual(manifest.dependencies, {});
    });

    test("should read PEP 621 and uv dependency groups", async () => {
      const pyprojectPath = join(tmpDir, "pyproject.toml");
      const content = `[project]
dependencies = [
  "requests>=2.31.0",
  "flask==3.0.0",
]

[project.optional-dependencies]
docs = [
  "mkdocs>=1.5.0",
]

[dependency-groups]
dev = [
  "pytest>=8.0.0",
]
bench = [
  "pytest-benchmark>=4.0.0",
]
`;

      writeFileSync(pyprojectPath, content);

      const provider = new PythonProvider(pyprojectPath, "uv");
      const manifest = await provider.readManifest(pyprojectPath);

      assert.deepStrictEqual(manifest.dependencies, {
        requests: ">=2.31.0",
        flask: "==3.0.0",
      });
      assert.deepStrictEqual(manifest.devDependencies, {
        pytest: ">=8.0.0",
      });
      assert.deepStrictEqual(manifest.optionalDependencies, {
        mkdocs: ">=1.5.0",
        "pytest-benchmark": ">=4.0.0",
      });
    });

    test("should keep reading PEP 621 dependencies after extras", async () => {
      const pyprojectPath = join(tmpDir, "pyproject.toml");
      const content = `[project]
dependencies = [
  "requests[security]>=2.31.0",
  "boto3>=1.26.0",
]
`;

      writeFileSync(pyprojectPath, content);

      const provider = new PythonProvider(pyprojectPath, "uv");
      const manifest = await provider.readManifest(pyprojectPath);

      assert.deepStrictEqual(manifest.dependencies, {
        requests: ">=2.31.0",
        boto3: ">=1.26.0",
      });
    });
  });

  describe("readManifest - Pipfile", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-pipfile-test");

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

      assert.deepStrictEqual(manifest.dependencies, {
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

      assert.deepStrictEqual(manifest.dependencies, {});
    });
  });

  describe("readManifest - environment.yml", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-conda-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    test("should read conda dependencies and skip Python runtime and nested pip", async () => {
      const envPath = join(tmpDir, "environment.yml");
      const content = `name: myenv
channels:
  - conda-forge
dependencies:
  - python=3.11
  - numpy=1.24.0
  - pandas>=2.0.0
  - pip:
      - requests==2.31.0
variables:
  EXAMPLE: true
`;

      writeFileSync(envPath, content);

      const provider = new PythonProvider(envPath, "conda");
      const manifest = await provider.readManifest(envPath);

      assert.deepStrictEqual(manifest.dependencies, {
        numpy: "=1.24.0",
        pandas: ">=2.0.0",
      });
    });
  });

  describe("writeManifest - requirements.txt", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-python-write-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    test("should update requirements.txt in place", async () => {
      const reqPath = join(tmpDir, "requirements.txt");
      const original = `# Generated by uv
requests==2.30.0 \\
    --hash=sha256:abc123
flask>=2.0.0 ; python_version >= "3.11"
-r shared-requirements.txt
`;
      writeFileSync(reqPath, original);

      const provider = new PythonProvider(reqPath, "pip");
      await provider.writeManifest(reqPath, {
        filePath: reqPath,
        dependencies: {
          requests: "==2.31.0",
          flask: ">=2.1.0",
        },
      });

      const content = readFileSync(reqPath, "utf8");

      assert.ok(content.includes("# Generated by uv"));
      assert.ok(content.includes("requests==2.31.0"));
      assert.ok(content.includes("--hash=sha256:abc123"));
      assert.ok(content.includes('flask>=2.1.0 ; python_version >= "3.11"'));
      assert.ok(content.includes("-r shared-requirements.txt"));
      assert.strictEqual(content.endsWith("\n"), true);
    });

    test("should preserve requirements without matching updates", async () => {
      const reqPath = join(tmpDir, "empty.txt");
      writeFileSync(reqPath, "old==1.0.0\n");

      const provider = new PythonProvider(reqPath, "pip");
      await provider.writeManifest(reqPath, {
        filePath: reqPath,
        dependencies: {},
      });

      const content = readFileSync(reqPath, "utf8");

      assert.strictEqual(content, "old==1.0.0\n");
    });
  });

  describe("writeManifest - pyproject.toml", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-pyproject-write-test");

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

      assert.ok(content.includes("[tool.poetry.dependencies]"));
      assert.ok(content.includes('python = "^3.8"'));
      assert.ok(content.includes('requests = "^2.31.0"'));
      assert.ok(content.includes('flask = "~2.0.0"'));
      assert.ok(!content.includes("old-package"));
      assert.ok(content.includes("[tool.poetry.dev-dependencies]"));
    });

    test("should update PEP 621 and uv dependency groups", async () => {
      const pyprojectPath = join(tmpDir, "pyproject.toml");
      const original = `[project]
dependencies = [
  "requests>=2.31.0",
  "flask==3.0.0",
]

[project.optional-dependencies]
docs = [
  "mkdocs>=1.5.0",
]

[dependency-groups]
dev = [
  "pytest>=8.0.0",
]
bench = [
  "pytest-benchmark>=4.0.0",
]
`;

      writeFileSync(pyprojectPath, original);

      const provider = new PythonProvider(pyprojectPath, "uv");
      await provider.writeManifest(pyprojectPath, {
        filePath: pyprojectPath,
        dependencies: {
          requests: ">=2.32.0",
          flask: "==3.0.0",
        },
        devDependencies: {
          pytest: ">=8.1.0",
        },
        optionalDependencies: {
          mkdocs: ">=1.6.0",
          "pytest-benchmark": ">=4.1.0",
        },
      });

      const content = readFileSync(pyprojectPath, "utf8");

      assert.ok(content.includes('"requests>=2.32.0"'));
      assert.ok(content.includes('"flask==3.0.0"'));
      assert.ok(content.includes('"mkdocs>=1.6.0"'));
      assert.ok(content.includes('"pytest>=8.1.0"'));
      assert.ok(content.includes('"pytest-benchmark>=4.1.0"'));
    });

    test("should keep updating PEP 621 dependencies after extras", async () => {
      const pyprojectPath = join(tmpDir, "pyproject.toml");
      const original = `[project]
dependencies = [
  "requests[security]>=2.31.0",
  "boto3>=1.26.0",
]
`;

      writeFileSync(pyprojectPath, original);

      const provider = new PythonProvider(pyprojectPath, "uv");
      await provider.writeManifest(pyprojectPath, {
        filePath: pyprojectPath,
        dependencies: {
          requests: ">=2.32.0",
          boto3: ">=1.34.0",
        },
      });

      const content = readFileSync(pyprojectPath, "utf8");

      assert.ok(content.includes('"requests[security]>=2.32.0"'));
      assert.ok(content.includes('"boto3>=1.34.0"'));
    });
  });

  describe("writeManifest - Pipfile", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-pipfile-write-test");

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

      assert.ok(content.includes("[packages]"));
      assert.ok(content.includes('requests = "==2.31.0"'));
      assert.ok(content.includes('flask = ">=2.0.0"'));
      assert.ok(!content.includes("old-package"));
      assert.ok(content.includes("[dev-packages]"));
    });
  });

  describe("writeManifest - environment.yml", () => {
    const tmpDir = join(import.meta.dirname, ".tmp-conda-write-test");

    beforeEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    test("should update conda dependencies without touching runtime or nested pip", async () => {
      const envPath = join(tmpDir, "environment.yml");
      const original = `name: myenv
dependencies:
  - python=3.11
  - numpy=1.24.0 # keep comment
  - pandas>=2.0.0
  - pip:
      - requests==2.31.0
`;

      writeFileSync(envPath, original);

      const provider = new PythonProvider(envPath, "conda");
      await provider.writeManifest(envPath, {
        filePath: envPath,
        dependencies: {
          numpy: "=1.25.0",
          pandas: ">=2.1.0",
        },
      });

      const content = readFileSync(envPath, "utf8");

      assert.ok(content.includes("  - python=3.11"));
      assert.ok(content.includes("  - numpy=1.25.0 # keep comment"));
      assert.ok(content.includes("  - pandas>=2.1.0"));
      assert.ok(content.includes("      - requests==2.31.0"));
    });
  });

  describe("validatePackageName", () => {
    const provider = new PythonProvider("requirements.txt", "pip");

    test("should validate correct Python package names", () => {
      assert.strictEqual(provider.validatePackageName("requests"), true);
      assert.strictEqual(provider.validatePackageName("Flask"), true);
      assert.strictEqual(provider.validatePackageName("django-rest-framework"), true);
      assert.strictEqual(provider.validatePackageName("beautifulsoup4"), true);
      assert.strictEqual(provider.validatePackageName("Pillow"), true);
      assert.strictEqual(provider.validatePackageName("some_package"), true);
      assert.strictEqual(provider.validatePackageName("zope.interface"), true);
      assert.strictEqual(provider.validatePackageName("sphinxcontrib.httpdomain"), true);
    });

    test("should reject invalid Python package names", () => {
      assert.strictEqual(provider.validatePackageName("@scope/package"), false);
      assert.strictEqual(provider.validatePackageName("github.com/user/repo"), false);
      assert.strictEqual(provider.validatePackageName(""), false);
      assert.strictEqual(provider.validatePackageName("has spaces"), false);
    });
  });

  describe("language property", () => {
    test("should have correct language identifier", () => {
      const provider = new PythonProvider("requirements.txt", "pip");
      assert.strictEqual(provider.language, "python");
    });
  });

  describe("manifest type detection", () => {
    test("should detect requirements.txt", () => {
      const provider = new PythonProvider("requirements.txt", "pip");
      assert.notStrictEqual(provider, undefined);
    });

    test("should detect pyproject.toml", () => {
      const provider = new PythonProvider("pyproject.toml", "poetry");
      assert.notStrictEqual(provider, undefined);
    });

    test("should detect Pipfile", () => {
      const provider = new PythonProvider("Pipfile", "pipenv");
      assert.notStrictEqual(provider, undefined);
    });

    test("should detect environment.yml for conda", () => {
      const provider = new PythonProvider("environment.yml", "conda");
      assert.notStrictEqual(provider, undefined);
    });

    test("should detect environment.yaml for conda", () => {
      const provider = new PythonProvider("environment.yaml", "conda");
      assert.notStrictEqual(provider, undefined);
    });

    test("should default to requirements for unknown types", () => {
      const provider = new PythonProvider("unknown.txt", "pip");
      assert.notStrictEqual(provider, undefined);
    });
  });

  describe("constructor options", () => {
    test("should accept default options", () => {
      const provider = new PythonProvider("requirements.txt");
      assert.notStrictEqual(provider, undefined);
    });

    test("should accept package manager option", () => {
      const provider = new PythonProvider("requirements.txt", "pip");
      assert.notStrictEqual(provider, undefined);
    });

    test("should accept debug option", () => {
      const provider = new PythonProvider("requirements.txt", "pip", {
        debug: true,
      });
      assert.notStrictEqual(provider, undefined);
    });
  });
});
