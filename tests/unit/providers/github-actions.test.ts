import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { GitHubActionsProvider } from "../../../src/providers/github-actions";

describe("GitHubActionsProvider", () => {
  const tmpDir = join(__dirname, ".tmp-github-actions-test");
  const workflowPath = join(tmpDir, "ci.yml");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new GitHubActionsProvider();

    expect(provider.language).toBe("github-actions");
    expect(await provider.getLatestVersion("actions/checkout")).toBe("");
    expect(await provider.getAllVersions("actions/checkout")).toEqual([]);
    expect(provider.validatePackageName("actions/checkout")).toBe(true);
    expect(provider.validatePackageName("local-action")).toBe(false);
  });

  test("should read external action refs", () => {
    const content = `name: ci
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - uses: "actions/setup-node@v4"
      - uses: ./local-action
      - uses: docker://alpine:3.20
`;
    writeFileSync(workflowPath, content);

    const provider = new GitHubActionsProvider();
    const manifest = provider.readManifest(workflowPath);

    expect(manifest.dependencies).toEqual({
      "actions/checkout": "v4",
      "actions/setup-node": "v4",
    });
  });

  test("should update external action refs", () => {
    const content = `steps:
  - uses: actions/checkout@v3
  - uses: "actions/setup-node@v3"
  - uses: ./local-action
`;
    writeFileSync(workflowPath, content);

    const provider = new GitHubActionsProvider();
    provider.writeManifest(workflowPath, {
      filePath: workflowPath,
      dependencies: {
        "actions/checkout": "v4",
        "actions/setup-node": "v4",
      },
    });

    const updated = readFileSync(workflowPath, "utf8");

    expect(updated).toContain("uses: actions/checkout@v4");
    expect(updated).toContain('uses: "actions/setup-node@v4"');
    expect(updated).toContain("uses: ./local-action");
  });
});
