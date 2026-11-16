import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const actionPath = new URL("../../action.yml", import.meta.url);
const actionLines = readFileSync(actionPath, "utf8").split("\n");

const actionScript = (name: string): string => {
  const stepIndex = actionLines.findIndex((line) => line.trim() === `- name: ${name}`);
  const nextStepIndex = actionLines.findIndex(
    (line, index) => index > stepIndex && line.startsWith("    - name:"),
  );
  const stepEnd = nextStepIndex === -1 ? actionLines.length : nextStepIndex;
  const stepLines = actionLines.slice(stepIndex, stepEnd);
  const runIndex = stepLines.findIndex((line) => line.trim() === "run: |");
  const scriptLines = stepLines.slice(runIndex + 1);
  const script = scriptLines.map((line) => line.replace(/^ {8}/, "")).join("\n");
  const hasScript = stepIndex !== -1 && runIndex !== -1;
  if (hasScript) return script;

  throw new Error(`Action step not found: ${name}`);
};

const runActionScript = (name: string, environment: Record<string, string>): string => {
  const workDir = mkdtempSync(join(tmpdir(), "codependence-action-test-"));
  const outputPath = join(workDir, "output");
  const env = {
    ...process.env,
    ...environment,
    GITHUB_OUTPUT: outputPath,
    GITHUB_PATH: outputPath,
  };
  const result = spawnSync("bash", ["-c", actionScript(name)], { encoding: "utf8", env });
  const output = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  rmSync(workDir, { recursive: true, force: true });
  if (result.status === 0) return output;

  throw new Error(result.stderr || result.stdout);
};

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("composite action", () => {
  test("infers a Node package manager version from package.json", () => {
    const workDir = mkdtempSync(join(tmpdir(), "codependence-action-pnpm-"));
    writeFileSync(
      join(workDir, "package.json"),
      JSON.stringify({ packageManager: "pnpm@9.15.0+sha512.example" }),
    );

    try {
      const targetOutput = runActionScript("Prepare targets", {
        GITHUB_WORKSPACE: workDir,
        INPUT_TARGETS: "pnpm",
        INPUT_VERSION: "",
      });
      assert.match(targetOutput, /pnpm-version=9\.15\.0/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("prepares a stable Docker-only pull-request branch", () => {
    const targetOutput = runActionScript("Prepare targets", {
      INPUT_TARGETS: "docker",
      INPUT_VERSION: "",
    });
    assert.match(targetOutput, /list=docker/);
    assert.match(targetOutput, /branch-suffix=docker/);

    const pullRequestOutput = runActionScript("Prepare pull request", {
      BRANCH_PREFIX: "update-dependencies",
      BRANCH_SUFFIX: "docker",
      TARGETS: "docker",
    });
    assert.match(pullRequestOutput, /branch=update-dependencies\/docker/);
    assert.match(pullRequestOutput, /title=chore: update docker dependencies/);
  });

  test("accepts infrastructure manifest-only targets", () => {
    const targetOutput = runActionScript("Prepare targets", {
      INPUT_TARGETS: "helm kubernetes kustomize terraform circleci",
      INPUT_VERSION: "",
    });

    assert.match(targetOutput, /list=helm kubernetes kustomize terraform circleci/);
    assert.match(targetOutput, /branch-suffix=circleci-helm-kubernetes-kustomize-terraform/);
  });

  test("prepares exact versions for every Python manager", () => {
    const targetOutput = runActionScript("Prepare targets", {
      INPUT_TARGETS: "pip pipenv poetry conda uv",
      INPUT_VERSION: "pip=25.1.1 pipenv=2025.0.4 poetry=2.1.3 conda=25.3.1 uv=0.8.0",
    });
    assert.match(targetOutput, /list=pip pipenv poetry conda uv/);
    assert.match(targetOutput, /pip-version=25\.1\.1/);
    assert.match(targetOutput, /pipenv-version=2025\.0\.4/);
    assert.match(targetOutput, /poetry-version=2\.1\.3/);
    assert.match(targetOutput, /conda-version=25\.3\.1/);
  });

  test("installs pinned Python tools outside the checkout and exposes their executables", () => {
    const workDir = mkdtempSync(join(tmpdir(), "codependence-action-python-"));
    const installer = join(workDir, "installer");
    const installLog = join(workDir, "install-log");
    const python = '#!/bin/bash\nprintf "%s\\n" "$@" > "$INSTALL_LOG"\n';
    const bootstrap = '#!/bin/bash\nmkdir -p "$3/bin"\ncp "$MOCK_INSTALLER" "$3/bin/python"\n';
    writeFileSync(installer, python, { mode: 0o755 });
    writeFileSync(join(workDir, "python3"), bootstrap, { mode: 0o755 });
    try {
      const output = runActionScript("Setup Python package managers", {
        PATH: `${workDir}:${process.env.PATH}`,
        RUNNER_TEMP: workDir,
        MOCK_INSTALLER: installer,
        INSTALL_LOG: installLog,
        PIP_VERSION: "25.1.1",
        PIPENV_VERSION: "2025.0.4",
        POETRY_VERSION: "2.1.3",
      });
      assert.match(output, /codependence-python\/bin/);
      const args = readFileSync(installLog, "utf8");
      assert.match(args, /pip==25\.1\.1/);
      assert.match(args, /pipenv==2025\.0\.4/);
      assert.match(args, /poetry==2\.1\.3/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
