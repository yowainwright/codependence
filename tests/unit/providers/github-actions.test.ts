import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  GitHubActionsProvider,
  parseGithubActionLine,
  updateGithubActionLine,
} from "../../../src/providers/github-actions";

describe("GitHubActionsProvider", () => {
  const tmpDir = join(__dirname, ".tmp-github-actions-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("reads workflow action refs", () => {
    const workflowPath = join(tmpDir, "ci.yml");
    writeFileSync(
      workflowPath,
      `jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - uses: "github/codeql-action/init@v4"
      - uses: ./local-action
      - uses: docker://node:20
`,
    );

    const provider = new GitHubActionsProvider({ isTesting: true });
    const manifest = provider.readManifest(workflowPath);

    expect(manifest.dependencies).toEqual({
      "actions/checkout": "v4",
      "github/codeql-action/init": "v4",
    });
  });

  test("updates workflow action refs", () => {
    const workflowPath = join(tmpDir, "ci.yml");
    writeFileSync(workflowPath, '      - uses: "actions/checkout@v4"\n');

    const provider = new GitHubActionsProvider({ isTesting: true });
    provider.writeManifest(workflowPath, {
      filePath: workflowPath,
      dependencies: { "actions/checkout": "v5" },
    });

    const updated = readFileSync(workflowPath, "utf8");
    expect(updated).toBe('      - uses: "actions/checkout@v5"\n');
  });

  test("parses and updates uses lines", () => {
    expect(parseGithubActionLine("      uses: actions/checkout@v4")).toEqual({
      name: "actions/checkout",
      prefix: "      uses: actions/checkout@",
      suffix: "",
      version: "v4",
    });

    const updated = updateGithubActionLine("uses: actions/checkout@v4", {
      "actions/checkout": "v5",
    });
    expect(updated).toBe("uses: actions/checkout@v5");
  });
});
