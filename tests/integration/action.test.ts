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
  const env = { ...process.env, ...environment, GITHUB_OUTPUT: outputPath };
  const result = spawnSync("bash", ["-c", actionScript(name)], { encoding: "utf8", env });
  const output = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  rmSync(workDir, { recursive: true, force: true });
  if (result.status === 0) return output;

  throw new Error(result.stderr);
};

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
    assert.ok((targetOutput).includes("list=docker"));
    assert.ok((targetOutput).includes("branch-suffix=docker"));

    const pullRequestOutput = runActionScript("Prepare pull request", {
      BRANCH_PREFIX: "update-dependencies",
      BRANCH_SUFFIX: "docker",
      TARGETS: "docker",
    });
    assert.ok((pullRequestOutput).includes("branch=update-dependencies/docker"));
    assert.ok((pullRequestOutput).includes("title=chore: update docker dependencies"));
  });

  test("accepts infrastructure manifest-only targets", () => {
    const targetOutput = runActionScript("Prepare targets", {
      INPUT_TARGETS: "helm kubernetes kustomize terraform circleci",
      INPUT_VERSION: "",
    });

    assert.ok((targetOutput).includes("list=helm kubernetes kustomize terraform circleci"));
    assert.ok((targetOutput).includes("branch-suffix=circleci-helm-kubernetes-kustomize-terraform"));
  });
});
