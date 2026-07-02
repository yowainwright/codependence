import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { GitHubActionsProvider } from "../../../src/providers/github-actions";

describe("GitHubActionsProvider", () => {
  const tmpDir = join(__dirname, ".tmp-github-actions-test");
  const workflowPath = join(tmpDir, "ci.yml");
  const shaSegment = "0123456789abcdef";
  const sha1Ref = `${shaSegment}${shaSegment}01234567`;
  const sha256Ref = shaSegment.repeat(4);

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new GitHubActionsProvider();

    expect(provider.language).toBe("github-actions");
    expect(provider.capabilities).toEqual({
      supportsLatestResolution: false,
      supportsPreciseMode: false,
      versionStrategy: "exact",
    });
    await expect(provider.getLatestVersion("actions/checkout")).rejects.toThrow(
      "GitHub Actions provider requires explicit version pins",
    );
    await expect(provider.getAllVersions("actions/checkout")).rejects.toThrow(
      "GitHub Actions provider requires explicit version pins",
    );
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
      - uses: actions/cache@${sha1Ref}
      - uses: actions/upload-artifact@${sha256Ref}
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
  - uses: actions/cache@${sha1Ref}
  - uses: actions/upload-artifact@${sha256Ref}
  - uses: ./local-action
`;
    writeFileSync(workflowPath, content);

    const provider = new GitHubActionsProvider();
    provider.writeManifest(workflowPath, {
      filePath: workflowPath,
      dependencies: {
        "actions/checkout": "v4",
        "actions/setup-node": "v4",
        "actions/cache": "v5",
        "actions/upload-artifact": "v5",
      },
    });

    const updated = readFileSync(workflowPath, "utf8");

    expect(updated).toContain("uses: actions/checkout@v4");
    expect(updated).toContain('uses: "actions/setup-node@v4"');
    expect(updated).toContain(`uses: actions/cache@${sha1Ref}`);
    expect(updated).toContain(`uses: actions/upload-artifact@${sha256Ref}`);
    expect(updated).toContain("uses: ./local-action");
  });
});
