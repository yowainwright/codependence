import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(TEST_DIR, "../../../..");
const WORK_DIR = join(ROOT_DIR, "tests", "e2e", ".tmp", "scripts-install");
const PROJECT_DIR = join(WORK_DIR, "project");
const HOME_DIR = join(WORK_DIR, "home");
const CODEX_DIR = join(WORK_DIR, "codex-home");

const readPackageJson = (): { scripts: Record<string, string> } =>
  JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8"));

const packageScript = (scriptName: string): string => {
  const script = readPackageJson().scripts[scriptName];
  assert.ok(script, `missing package script: ${scriptName}`);
  return script;
};

const prepareProject = (): void => {
  mkdirSync(join(PROJECT_DIR, "node_modules"), { recursive: true });
  mkdirSync(HOME_DIR, { recursive: true });
  mkdirSync(CODEX_DIR, { recursive: true });

  const legibilitySource = join(ROOT_DIR, "node_modules", "eslint-plugin-legibility");
  const legibilityTarget = join(PROJECT_DIR, "node_modules", "eslint-plugin-legibility");
  if (!existsSync(legibilityTarget))
    cpSync(legibilitySource, legibilityTarget, {
      dereference: true,
      recursive: true,
    });

  mkdirSync(join(PROJECT_DIR, "scripts", "install"), { recursive: true });
  cpSync(
    join(ROOT_DIR, "scripts", "install", "index.js"),
    join(PROJECT_DIR, "scripts", "install", "index.js"),
  );
};

const runPackageScript = (scriptName: string, useCodexHome = false): void => {
  prepareProject();

  const env = {
    ...process.env,
    HOME: HOME_DIR,
    PATH: `${join(ROOT_DIR, "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
  };

  if (useCodexHome) env.CODEX_HOME = CODEX_DIR;
  if (!useCodexHome) delete env.CODEX_HOME;

  const result = spawnSync("sh", ["-c", packageScript(scriptName)], {
    cwd: PROJECT_DIR,
    encoding: "utf8",
    env,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
};

const assertFileExists = (path: string): void => {
  assert.equal(existsSync(path), true, `expected file: ${path}`);
};

before(() => {
  rmSync(WORK_DIR, { force: true, recursive: true });
});

after(() => {
  rmSync(WORK_DIR, { force: true, recursive: true });
});

describe("scripts/install e2e", () => {
  test("installs global legibility skills", () => {
    runPackageScript("skills:install");
    assertFileExists(join(HOME_DIR, ".agents", "skills", "eslint-plugin-legibility", "SKILL.md"));

    runPackageScript("skills:install:codex", true);
    assertFileExists(join(CODEX_DIR, "skills", "eslint-plugin-legibility", "SKILL.md"));

    runPackageScript("skills:install:claude");
    assertFileExists(join(HOME_DIR, ".claude", "rules", "eslint-plugin-legibility.md"));
  });

  test("installs local legibility skills", () => {
    runPackageScript("skills:install:local");
    assertFileExists(
      join(PROJECT_DIR, ".agents", "skills", "eslint-plugin-legibility", "SKILL.md"),
    );

    runPackageScript("skills:install:codex:local");
    assertFileExists(join(PROJECT_DIR, ".codex", "skills", "eslint-plugin-legibility", "SKILL.md"));

    runPackageScript("skills:install:claude:local");
    assertFileExists(join(PROJECT_DIR, ".claude", "rules", "eslint-plugin-legibility.md"));
  });
});
