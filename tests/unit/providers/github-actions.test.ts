import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { GitHubActionsProvider } from "../../../src/providers/github-actions";

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("GitHubActionsProvider", () => {
  const tmpDir = join(__dirname, ".tmp-github-actions-test");
  const workflowPath = join(tmpDir, "ci.yml");
  const shaSegment = "0123456789abcdef";
  const sha1Ref = `${shaSegment}${shaSegment}01234567`;
  const sha256Ref = shaSegment.repeat(4);
  const latestSha = "a".repeat(40);

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", () => {
    const provider = new GitHubActionsProvider();

    expect(provider.language).toBe("github-actions");
    expect(provider.capabilities).toEqual({
      supportsLatestResolution: true,
      supportsPreciseMode: true,
      versionStrategy: "exact",
    });
    expect(provider.validatePackageName("actions/checkout")).toBe(true);
    expect(provider.validatePackageName("local-action")).toBe(false);
  });

  test("should resolve the latest GitHub release", async () => {
    const fetch = mock(async (url: string) => {
      const isCommitRequest = url.endsWith("/commits/v5.0.0");
      if (isCommitRequest) return jsonResponse({ sha: latestSha });

      return jsonResponse({ tag_name: "v5.0.0" });
    });
    const token = crypto.randomUUID();
    const authorization = `Bearer ${token}`;
    const provider = new GitHubActionsProvider({
      apiUrl: "https://github.example/api/v3/",
      fetch,
      token,
    });

    const version = await provider.getLatestVersion("actions/checkout/sub-action");

    expect(version).toBe(latestSha);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe(
      "https://github.example/api/v3/repos/actions/checkout/releases/latest",
    );
    expect(fetch.mock.calls[0][1].headers).toEqual({
      Accept: "application/vnd.github+json",
      Authorization: authorization,
      "User-Agent": "codependence",
    });
    expect(fetch.mock.calls[1][0]).toBe(
      "https://github.example/api/v3/repos/actions/checkout/commits/v5.0.0",
    );
  });

  test("should fall back to the newest stable repository tag", async () => {
    let requestCount = 0;
    const fetch = mock(async () => {
      requestCount += 1;
      const isReleaseRequest = requestCount === 1;
      if (isReleaseRequest) return jsonResponse({}, 404);

      const isTagsRequest = requestCount === 2;
      if (isTagsRequest) {
        return jsonResponse([
          { name: "nightly" },
          { name: "v5" },
          { name: "v5.0.0-beta.1" },
          { name: "v5.0.0" },
          { name: "v4.2.2" },
        ]);
      }

      return jsonResponse({ sha: latestSha });
    });
    const provider = new GitHubActionsProvider({ fetch });

    const version = await provider.getLatestVersion("actions/checkout");

    expect(version).toBe(latestSha);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("should list repository tags", async () => {
    const fetch = mock(async () =>
      jsonResponse([{ name: "v5" }, { name: "v4" }, { invalid: true }]),
    );
    const provider = new GitHubActionsProvider({ fetch });

    const versions = await provider.getAllVersions("actions/checkout");

    expect(versions).toEqual(["v5", "v4"]);
  });

  test("should report GitHub API failures", async () => {
    const fetch = mock(async () => new Response(null, { status: 403, statusText: "Forbidden" }));
    const provider = new GitHubActionsProvider({ fetch });

    await expect(provider.getLatestVersion("actions/checkout")).rejects.toThrow(
      "GitHub API request failed for actions/checkout: 403 Forbidden",
    );
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
      "actions/cache": sha1Ref,
      "actions/upload-artifact": sha256Ref,
    });
  });

  test("should update SHA pins with their release labels", async () => {
    const content = `steps:
  - uses: actions/checkout@${sha1Ref} # v4.0.0
`;
    writeFileSync(workflowPath, content);
    const fetch = mock(async (url: string) => {
      const isCommitRequest = url.endsWith("/commits/v5.0.0");
      if (isCommitRequest) return jsonResponse({ sha: latestSha });

      return jsonResponse({ tag_name: "v5.0.0" });
    });
    const provider = new GitHubActionsProvider({ fetch });
    const version = await provider.getLatestVersion("actions/checkout");

    provider.writeManifest(workflowPath, {
      filePath: workflowPath,
      dependencies: { "actions/checkout": version },
    });

    const updated = readFileSync(workflowPath, "utf8");
    expect(updated).toContain(`uses: actions/checkout@${latestSha} # v5.0.0`);
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
