import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  detectNodePackageManager,
  detectPythonPackageManager,
  detectPythonPackageManagerForManifest,
  isPoetryPyproject,
} from "../../../src/providers/utils";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("detectNodePackageManager", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-node-pm-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("returns npm when no lock files exist", () => {
    assert.strictEqual(detectNodePackageManager(tmpDir), "npm");
  });

  test("returns yarn when yarn.lock exists", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "yarn");
  });

  test("returns pnpm when pnpm-lock.yaml exists", () => {
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "pnpm");
  });

  test("returns bun when bun.lockb exists", () => {
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "bun");
  });

  test("returns bun when bun.lock exists", () => {
    writeFileSync(join(tmpDir, "bun.lock"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "bun");
  });

  test("uses package.json packageManager field when no lock files exist", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ packageManager: "pnpm@9.0.0" }));

    assert.strictEqual(detectNodePackageManager(tmpDir), "pnpm");
  });

  test("prefers packageManager field over stale npm lock files", () => {
    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ packageManager: "pnpm@9.0.0" }));
    writeFileSync(join(tmpDir, "package-lock.json"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "pnpm");
  });

  test("ignores unsupported packageManager field values", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ packageManager: "corepack@1.0.0" }),
    );

    assert.strictEqual(detectNodePackageManager(tmpDir), "npm");
  });

  test("falls back to lock files when package.json is invalid", () => {
    writeFileSync(join(tmpDir, "package.json"), "{ invalid json");
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "pnpm");
  });

  test("prioritizes bun over yarn", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "bun");
  });

  test("prioritizes bun over pnpm", () => {
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "bun");
  });

  test("prioritizes pnpm over yarn", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "pnpm");
  });

  test("prioritizes bun over all others", () => {
    writeFileSync(join(tmpDir, "yarn.lock"), "");
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");
    writeFileSync(join(tmpDir, "bun.lockb"), "");

    assert.strictEqual(detectNodePackageManager(tmpDir), "bun");
  });
});

describe("detectPythonPackageManager", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-python-pm-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("returns pip as default", () => {
    assert.strictEqual(detectPythonPackageManager(tmpDir), "pip");
  });

  test("returns conda when environment.yml exists", () => {
    writeFileSync(join(tmpDir, "environment.yml"), "");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "conda");
  });

  test("returns conda when environment.yaml exists", () => {
    writeFileSync(join(tmpDir, "environment.yaml"), "");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "conda");
  });

  test("returns uv when uv.lock exists", () => {
    writeFileSync(join(tmpDir, "uv.lock"), "");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "uv");
  });

  test("returns pipenv when Pipfile exists", () => {
    writeFileSync(join(tmpDir, "Pipfile"), "");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "pipenv");
  });

  test("returns poetry when pyproject.toml has poetry config", () => {
    writeFileSync(
      join(tmpDir, "pyproject.toml"),
      "[tool.poetry]\nname = 'test'\n[tool.poetry.dependencies]\npython = '^3.8'\n",
    );

    assert.strictEqual(detectPythonPackageManager(tmpDir), "poetry");
  });

  test("returns pip when pyproject.toml lacks poetry config", () => {
    writeFileSync(join(tmpDir, "pyproject.toml"), "[build-system]\nrequires = ['setuptools']\n");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "pip");
  });

  test("prioritizes conda over uv", () => {
    writeFileSync(join(tmpDir, "environment.yml"), "");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "conda");
  });

  test("prioritizes uv over pipenv", () => {
    writeFileSync(join(tmpDir, "uv.lock"), "");
    writeFileSync(join(tmpDir, "Pipfile"), "");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "uv");
  });

  test("prioritizes pipenv over poetry", () => {
    writeFileSync(join(tmpDir, "Pipfile"), "");
    writeFileSync(join(tmpDir, "pyproject.toml"), "[tool.poetry]\nname = 'test'\n");

    assert.strictEqual(detectPythonPackageManager(tmpDir), "pipenv");
  });
});

describe("detectPythonPackageManagerForManifest", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-python-manifest-pm-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns pip for requirements.txt by default", () => {
    const manifestPath = join(tmpDir, "requirements.txt");
    writeFileSync(manifestPath, "");

    assert.strictEqual(detectPythonPackageManagerForManifest(manifestPath), "pip");
  });

  test("returns conda for environment.yml", () => {
    const manifestPath = join(tmpDir, "environment.yml");
    writeFileSync(manifestPath, "");

    assert.strictEqual(detectPythonPackageManagerForManifest(manifestPath), "conda");
  });

  test("returns uv for requirements.txt when uv.lock exists", () => {
    const manifestPath = join(tmpDir, "requirements.txt");
    writeFileSync(manifestPath, "");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    assert.strictEqual(detectPythonPackageManagerForManifest(manifestPath), "uv");
  });

  test("returns pipenv for Pipfile even when uv.lock exists", () => {
    const manifestPath = join(tmpDir, "Pipfile");
    writeFileSync(manifestPath, "");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    assert.strictEqual(detectPythonPackageManagerForManifest(manifestPath), "pipenv");
  });

  test("returns poetry for Poetry pyproject.toml", () => {
    const manifestPath = join(tmpDir, "pyproject.toml");
    writeFileSync(manifestPath, "[tool.poetry]\nname = 'test'\n");

    assert.strictEqual(isPoetryPyproject(manifestPath), true);
    assert.strictEqual(detectPythonPackageManagerForManifest(manifestPath), "poetry");
  });

  test("returns false for unreadable pyproject.toml", () => {
    const manifestPath = join(tmpDir, "pyproject.toml");
    mkdirSync(manifestPath);

    assert.strictEqual(isPoetryPyproject(manifestPath), false);
  });

  test("returns uv for non-Poetry pyproject.toml when uv.lock exists", () => {
    const manifestPath = join(tmpDir, "pyproject.toml");
    writeFileSync(manifestPath, "[project]\nname = 'test'\n");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    assert.strictEqual(isPoetryPyproject(manifestPath), false);
    assert.strictEqual(detectPythonPackageManagerForManifest(manifestPath), "uv");
  });
});
