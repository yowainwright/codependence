import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  detectNodePackageManager,
  detectPythonPackageManager,
  detectPythonPackageManagerForManifest,
  isPoetryPyproject,
} from "../../../src/providers/detection";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("detectNodePackageManager", () => {
  const tmpDir = join(__dirname, ".tmp-node-pm-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("returns npm when no lock files exist", () => {
    expect(detectNodePackageManager(tmpDir)).toBe("npm");
  });

  test("returns yarn when yarn.lock exists", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("yarn");
  });

  test("returns pnpm when pnpm-lock.yaml exists", () => {
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("pnpm");
  });

  test("returns bun when bun.lockb exists", () => {
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("bun");
  });

  test("returns bun when bun.lock exists", () => {
    writeFileSync(join(tmpDir, "bun.lock"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("bun");
  });

  test("uses package.json packageManager field when no lock files exist", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ packageManager: "pnpm@9.0.0" }),
    );

    expect(detectNodePackageManager(tmpDir)).toBe("pnpm");
  });

  test("prefers packageManager field over stale npm lock files", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ packageManager: "pnpm@9.0.0" }),
    );
    writeFileSync(join(tmpDir, "package-lock.json"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("pnpm");
  });

  test("ignores unsupported packageManager field values", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ packageManager: "corepack@1.0.0" }),
    );

    expect(detectNodePackageManager(tmpDir)).toBe("npm");
  });

  test("falls back to lock files when package.json is invalid", () => {
    writeFileSync(join(tmpDir, "package.json"), "{ invalid json");
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("pnpm");
  });

  test("prioritizes bun over yarn", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("bun");
  });

  test("prioritizes bun over pnpm", () => {
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("bun");
  });

  test("prioritizes pnpm over yarn", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("pnpm");
  });

  test("prioritizes bun over all others", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    expect(detectNodePackageManager(tmpDir)).toBe("bun");
  });
});

describe("detectPythonPackageManager", () => {
  const tmpDir = join(__dirname, ".tmp-python-pm-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("returns pip as default", () => {
    expect(detectPythonPackageManager(tmpDir)).toBe("pip");
  });

  test("returns pip when only environment.yml exists", () => {
    writeFileSync(join(tmpDir, "environment.yml"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("pip");
  });

  test("returns pip when only environment.yaml exists", () => {
    writeFileSync(join(tmpDir, "environment.yaml"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("pip");
  });

  test("returns uv when uv.lock exists with requirements.txt", () => {
    writeFileSync(join(tmpDir, "requirements.txt"), "");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("uv");
  });

  test("returns uv when uv.lock exists with non-poetry pyproject.toml", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "[project]\nname = 'test'\n");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("uv");
  });

  test("returns pipenv when Pipfile exists", () => {
    writeFileSync(join(tmpDir, "Pipfile"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("pipenv");
  });

  test("returns poetry when pyproject.toml has poetry config", () => {
    writeFileSync(
      join(tmpDir, "pyproject.toml"),
      "[tool.poetry]\nname = 'test'\n[tool.poetry.dependencies]\npython = '^3.8'\n",
    );

    expect(detectPythonPackageManager(tmpDir)).toBe("poetry");
  });

  test("returns pip when pyproject.toml lacks poetry config", () => {
    writeFileSync(
      join(tmpDir, "pyproject.toml"),
      "[build-system]\nrequires = ['setuptools']\n",
    );

    expect(detectPythonPackageManager(tmpDir)).toBe("pip");
  });

  test("ignores environment.yml when uv-managed requirements are present", () => {
    writeFileSync(join(tmpDir, "environment.yml"), "");
    writeFileSync(join(tmpDir, "requirements.txt"), "");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("uv");
  });

  test("prioritizes uv over pipenv", () => {
    writeFileSync(join(tmpDir, "requirements.txt"), "");
    writeFileSync(join(tmpDir, "uv.lock"), "");
    writeFileSync(join(tmpDir, "Pipfile"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("uv");
  });

  test("prioritizes pipenv over poetry", () => {
    writeFileSync(join(tmpDir, "Pipfile"), "");
    writeFileSync(
      join(tmpDir, "pyproject.toml"),
      "[tool.poetry]\nname = 'test'\n",
    );

    expect(detectPythonPackageManager(tmpDir)).toBe("pipenv");
  });
});

describe("isPoetryPyproject", () => {
  const tmpDir = join(__dirname, ".tmp-poetry-pyproject-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns false when file does not exist", () => {
    expect(isPoetryPyproject(join(tmpDir, "pyproject.toml"))).toBe(false);
  });

  test("returns true when file contains [tool.poetry]", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "[tool.poetry]\nname = 'test'\n");
    expect(isPoetryPyproject(join(tmpDir, "pyproject.toml"))).toBe(true);
  });

  test("returns true when file contains [tool.poetry.dependencies]", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "[tool.poetry.dependencies]\npython = '^3.8'\n");
    expect(isPoetryPyproject(join(tmpDir, "pyproject.toml"))).toBe(true);
  });

  test("returns false for PEP-517 pyproject.toml without poetry", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "[project]\nname = 'test'\n[build-system]\nrequires = ['setuptools']\n");
    expect(isPoetryPyproject(join(tmpDir, "pyproject.toml"))).toBe(false);
  });

  test("returns false for empty file", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "");
    expect(isPoetryPyproject(join(tmpDir, "pyproject.toml"))).toBe(false);
  });
});

describe("detectPythonPackageManagerForManifest", () => {
  const tmpDir = join(__dirname, ".tmp-manifest-pm-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns pipenv for Pipfile", () => {
    writeFileSync(join(tmpDir, "Pipfile"), "[packages]\n");
    expect(detectPythonPackageManagerForManifest(join(tmpDir, "Pipfile"))).toBe("pipenv");
  });

  test("returns poetry for poetry pyproject.toml", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "[tool.poetry]\nname = 'test'\n");
    expect(detectPythonPackageManagerForManifest(join(tmpDir, "pyproject.toml"))).toBe("poetry");
  });

  test("returns uv for non-poetry pyproject.toml when uv.lock exists", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "[project]\nname = 'test'\n");
    writeFileSync(join(tmpDir, "uv.lock"), "");
    expect(detectPythonPackageManagerForManifest(join(tmpDir, "pyproject.toml"))).toBe("uv");
  });

  test("returns uv for requirements.txt when uv.lock exists", () => {
    writeFileSync(join(tmpDir, "requirements.txt"), "requests\n");
    writeFileSync(join(tmpDir, "uv.lock"), "");
    expect(detectPythonPackageManagerForManifest(join(tmpDir, "requirements.txt"))).toBe("uv");
  });

  test("returns pip for requirements.txt without uv.lock", () => {
    writeFileSync(join(tmpDir, "requirements.txt"), "requests\n");
    expect(detectPythonPackageManagerForManifest(join(tmpDir, "requirements.txt"))).toBe("pip");
  });
});
