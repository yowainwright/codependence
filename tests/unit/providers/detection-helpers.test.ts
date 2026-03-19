import { describe, test, expect, beforeEach } from "bun:test";
import {
  detectNodePackageManager,
  detectPythonPackageManager,
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

  test("returns conda when environment.yml exists", () => {
    writeFileSync(join(tmpDir, "environment.yml"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("conda");
  });

  test("returns conda when environment.yaml exists", () => {
    writeFileSync(join(tmpDir, "environment.yaml"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("conda");
  });

  test("returns uv when uv.lock exists", () => {
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

  test("prioritizes conda over uv", () => {
    writeFileSync(join(tmpDir, "environment.yml"), "");
    writeFileSync(join(tmpDir, "uv.lock"), "");

    expect(detectPythonPackageManager(tmpDir)).toBe("conda");
  });

  test("prioritizes uv over pipenv", () => {
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
