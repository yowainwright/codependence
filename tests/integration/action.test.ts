import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type ActionStep = { name?: string; run?: string };

const actionPath = new URL("../../action.yml", import.meta.url);
const action = Bun.YAML.parse(readFileSync(actionPath, "utf8")) as {
  runs: { steps: ActionStep[] };
};

const actionScript = (name: string): string => {
  const script = action.runs.steps.find((step) => step.name === name)?.run;
  if (script) return script;

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
  test("prepares a stable Docker-only pull-request branch", () => {
    const targetOutput = runActionScript("Prepare targets", {
      INPUT_TARGETS: "docker",
      INPUT_VERSION: "",
    });
    expect(targetOutput).toContain("list=docker");
    expect(targetOutput).toContain("branch-suffix=docker");

    const pullRequestOutput = runActionScript("Prepare pull request", {
      BRANCH_PREFIX: "update-dependencies",
      BRANCH_SUFFIX: "docker",
      TARGETS: "docker",
    });
    expect(pullRequestOutput).toContain("branch=update-dependencies/docker");
    expect(pullRequestOutput).toContain("title=chore: update docker dependencies");
  });
});
