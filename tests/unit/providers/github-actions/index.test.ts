import { afterEach, beforeEach, describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertRejects, assertTextIncludes } from "../../../helpers/assertions";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { checkFiles, requestDeduplicator, versionCache } from "../../../../src/manifest";
import type { CheckFiles } from "../../../../src/types";
import {
  GitHubActionsProvider,
  updateGitHubActionsUsesLine,
} from "../../../../src/providers/github-actions";

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  mock.restoreAll();
  requestDeduplicator.clear();
  versionCache.clear();
});

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("GitHubActionsProvider", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-github-actions-test");
  const workflowPath = join(tmpDir, "ci.yml");
  const shaSegment = "0123456789abcdef";
  const sha1Ref = `${shaSegment}${shaSegment}01234567`;
  const sha256Ref = shaSegment.repeat(4);
  const latestSha = "a".repeat(40);
  const policy: CheckFiles = {
    rootDir: tmpDir,
    files: ["ci.yml"],
    language: "github-actions",
    mode: "precise",
    update: true,
    silent: true,
  };

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", () => {
    const provider = new GitHubActionsProvider();

    assert.strictEqual(provider.language, "github-actions");
    assert.deepStrictEqual(provider.capabilities, {
      supportsLatestResolution: true,
      supportsPreciseMode: true,
      versionStrategy: "exact",
    });
    assert.strictEqual(provider.validatePackageName("actions/checkout"), true);
    assert.strictEqual(provider.validatePackageName("local-action"), false);
  });

  test("should resolve the latest GitHub release", async () => {
    const fetch = mock.fn((url: string) => {
      const isCommitRequest = url.endsWith("/commits/v5.0.0");
      if (isCommitRequest) return Promise.resolve(jsonResponse({ sha: latestSha }));

      return Promise.resolve(jsonResponse({ tag_name: "v5.0.0" }));
    });
    const token = crypto.randomUUID();
    const authorization = `Bearer ${token}`;
    const provider = new GitHubActionsProvider({
      apiUrl: "https://github.example/api/v3/",
      fetch,
      token,
    });

    const version = await provider.getLatestVersion("actions/checkout/sub-action");

    assert.strictEqual(version, latestSha);
    assert.strictEqual(fetch.mock.callCount(), 2);
    assert.strictEqual(
      fetch.mock.calls[0].arguments[0],
      "https://github.example/api/v3/repos/actions/checkout/releases/latest",
    );
    assert.deepStrictEqual(fetch.mock.calls[0].arguments[1].headers, {
      Accept: "application/vnd.github+json",
      Authorization: authorization,
      "User-Agent": "codependence",
    });
    assert.strictEqual(
      fetch.mock.calls[1].arguments[0],
      "https://github.example/api/v3/repos/actions/checkout/commits/v5.0.0",
    );
  });

  test("should fall back to the newest stable repository tag", async () => {
    let requestCount = 0;
    const fetch = mock.fn(() => {
      requestCount += 1;
      const isReleaseRequest = requestCount === 1;
      if (isReleaseRequest) return Promise.resolve(jsonResponse({}, 404));

      const isTagsRequest = requestCount === 2;
      if (isTagsRequest) {
        return Promise.resolve(
          jsonResponse([
            { name: "nightly" },
            { name: "v5" },
            { name: "v5.0.0-beta.1" },
            { name: "v5.0.0" },
            { name: "v4.2.2" },
          ]),
        );
      }

      return Promise.resolve(jsonResponse({ sha: latestSha }));
    });
    const provider = new GitHubActionsProvider({ fetch });

    const version = await provider.getLatestVersion("actions/checkout");

    assert.strictEqual(version, latestSha);
    assert.strictEqual(fetch.mock.callCount(), 3);
  });

  test("should reject a release without a stable fallback tag", async () => {
    let requestCount = 0;
    const fetch = mock.fn(() => {
      requestCount += 1;
      if (requestCount === 1) return Promise.resolve(jsonResponse({}, 200));
      return Promise.resolve(jsonResponse([{ name: "nightly" }]));
    });
    const provider = new GitHubActionsProvider({ fetch });

    await assertRejects(
      provider.getLatestVersion("actions/checkout"),
      "No stable GitHub Action tag found",
    );
  });

  test("should list repository tags", async () => {
    const fetch = mock.fn(() =>
      Promise.resolve(jsonResponse([{ name: "v5" }, { name: "v4" }, { invalid: true }])),
    );
    const provider = new GitHubActionsProvider({ fetch });

    const versions = await provider.getAllVersions("actions/checkout");

    assert.deepStrictEqual(versions, ["v5", "v4"]);
  });

  test("should report GitHub API failures", async () => {
    const fetch = mock.fn(() =>
      Promise.resolve(new Response(null, { status: 403, statusText: "Forbidden" })),
    );
    const provider = new GitHubActionsProvider({ fetch });

    await assertRejects(
      provider.getLatestVersion("actions/checkout"),
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

    assert.deepStrictEqual(manifest.dependencies, {
      "actions/checkout": "v4",
      "actions/setup-node": "v4",
      "actions/cache": sha1Ref,
      "actions/upload-artifact": sha256Ref,
    });
  });

  test("should preserve every version for repeated action refs", () => {
    const content = `jobs:
  lint:
    steps:
      - uses: actions/checkout@v3
  test:
    steps:
      - uses: actions/checkout@${latestSha}
`;
    writeFileSync(workflowPath, content);

    const provider = new GitHubActionsProvider();
    const manifest = provider.readManifest(workflowPath);

    assert.strictEqual(manifest.dependencies["actions/checkout"], latestSha);
    assert.deepStrictEqual(manifest.dependencyVersions?.["actions/checkout"], ["v3", latestSha]);
  });

  test("should update SHA pins with their release labels", async () => {
    const content = `steps:
  - uses: actions/checkout@${sha1Ref} # v4.0.0
`;
    writeFileSync(workflowPath, content);
    const fetch = mock.fn((url: string) => {
      const isCommitRequest = url.endsWith("/commits/v5.0.0");
      if (isCommitRequest) return Promise.resolve(jsonResponse({ sha: latestSha }));

      return Promise.resolve(jsonResponse({ tag_name: "v5.0.0" }));
    });
    const provider = new GitHubActionsProvider({ fetch });
    const version = await provider.getLatestVersion("actions/checkout");

    provider.writeManifest(workflowPath, {
      filePath: workflowPath,
      dependencies: { "actions/checkout": version },
    });

    const updated = readFileSync(workflowPath, "utf8");
    assertTextIncludes(updated, `uses: actions/checkout@${latestSha} # v5.0.0`);
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

    assert.match(updated, /uses: actions\/checkout@v4/);
    assert.match(updated, /uses: "actions\/setup-node@v4"/);
    assertTextIncludes(updated, `uses: actions/cache@${sha1Ref}`);
    assertTextIncludes(updated, `uses: actions/upload-artifact@${sha256Ref}`);
    assert.match(updated, /uses: \.\/local-action/);
  });

  test("should refresh safe release labels in action refs", () => {
    const unlabeled = updateGitHubActionsUsesLine(
      "      - uses: actions/checkout@v4",
      { "actions/checkout": "v5" },
      { "actions/checkout": "v5.0.0" },
    );
    const invalidComment = updateGitHubActionsUsesLine(
      "      - uses: actions/checkout@v4 # pinned",
      { "actions/checkout": "v5" },
      { "actions/checkout": "v5.0.0" },
    );

    assert.strictEqual(unlabeled, "      - uses: actions/checkout@v5 # v5.0.0");
    assert.strictEqual(invalidComment, "      - uses: actions/checkout@v5 # pinned");
  });

  test("should pin a named ref and preserve its tracking label", async () => {
    const fetch = (url: string): Promise<Response> => {
      assert.ok(url.endsWith("/commits/release%2Fnext"));
      return Promise.resolve(jsonResponse({ sha: latestSha }));
    };
    const provider = new GitHubActionsProvider({ fetch });
    const version = await provider.getLatestVersion("owner/action", "release/next");
    writeFileSync(workflowPath, "steps:\n  - uses: owner/action@release/next # keep this note\n");

    provider.writeManifest(workflowPath, {
      filePath: workflowPath,
      dependencies: { "owner/action": version },
    });

    const expected = `steps:\n  - uses: owner/action@${latestSha} # release/next # keep this note\n`;
    assert.strictEqual(readFileSync(workflowPath, "utf8"), expected);
  });

  test("should refresh a branch pin through the manifest policy", async () => {
    const fetch = (url: string): Promise<Response> => {
      assert.ok(url.endsWith("/commits/main"));
      return Promise.resolve(jsonResponse({ sha: latestSha }));
    };
    const provider = new GitHubActionsProvider({ fetch });
    const resolve = provider.getLatestVersion.bind(provider);
    mock.method(GitHubActionsProvider.prototype, "getLatestVersion", resolve);
    writeFileSync(workflowPath, `steps:\n  - uses: owner/action@${sha1Ref} # main\n`);

    await checkFiles(policy);

    const expected = `steps:\n  - uses: owner/action@${latestSha} # main\n`;
    assert.strictEqual(readFileSync(workflowPath, "utf8"), expected);
  });

  test("should preserve independent branches when one action is repeated", async () => {
    const developSha = "b".repeat(40);
    const fetch = (url: string): Promise<Response> => {
      if (url.endsWith("/commits/main")) return Promise.resolve(jsonResponse({ sha: latestSha }));
      assert.ok(url.endsWith("/commits/develop"));
      return Promise.resolve(jsonResponse({ sha: developSha }));
    };
    const provider = new GitHubActionsProvider({ fetch });
    const resolve = provider.getLatestVersion.bind(provider);
    mock.method(GitHubActionsProvider.prototype, "getLatestVersion", resolve);
    const content = `steps:\n  - uses: owner/action@${sha1Ref} # main\n  - uses: owner/action@develop\n`;
    writeFileSync(workflowPath, content);

    await checkFiles(policy);

    const expected = `steps:\n  - uses: owner/action@${latestSha} # main\n  - uses: owner/action@${developSha} # develop\n`;
    assert.strictEqual(readFileSync(workflowPath, "utf8"), expected);
  });

  test("should reject conflicting tracking refs for the same pinned SHA", () => {
    const content = `steps:\n  - uses: owner/action@${sha1Ref} # main\n  - uses: owner/action@${sha1Ref} # develop\n`;
    writeFileSync(workflowPath, content);
    const provider = new GitHubActionsProvider();

    assert.throws(() => provider.readManifest(workflowPath), /Conflicting tracking refs/);
    assert.strictEqual(readFileSync(workflowPath, "utf8"), content);
  });

  test("should reject invalid commit responses before pinning a named ref", async () => {
    const fetch = (): Promise<Response> => Promise.resolve(jsonResponse({ sha: "not-a-sha" }));
    const provider = new GitHubActionsProvider({ fetch });

    await assertRejects(provider.getLatestVersion("owner/action", "main"), "SHA");
  });

  test("should not guess a branch when a bare SHA has no stable release", async () => {
    const fetch = (url: string): Promise<Response> => {
      if (url.endsWith("/releases/latest")) return Promise.resolve(jsonResponse({}, 404));
      assert.ok(url.endsWith("/tags?per_page=100"));
      return Promise.resolve(jsonResponse([]));
    };
    const provider = new GitHubActionsProvider({ fetch });

    await assertRejects(
      provider.getLatestVersion("owner/action", sha1Ref),
      "No stable GitHub Action tag",
    );
  });

  test("should recheck a tracking ref when its label changes on the same SHA", async () => {
    const developSha = "b".repeat(40);
    const fetch = (url: string): Promise<Response> => {
      if (url.endsWith("/commits/main")) return Promise.resolve(jsonResponse({ sha: latestSha }));
      assert.ok(url.endsWith("/commits/develop"));
      return Promise.resolve(jsonResponse({ sha: developSha }));
    };
    const provider = new GitHubActionsProvider({ fetch });
    const resolve = provider.getLatestVersion.bind(provider);
    mock.method(GitHubActionsProvider.prototype, "getLatestVersion", resolve);
    writeFileSync(workflowPath, `steps:\n  - uses: owner/action@${sha1Ref} # main\n`);
    await checkFiles({ ...policy, dryRun: true, format: "json" });
    writeFileSync(workflowPath, `steps:\n  - uses: owner/action@${sha1Ref} # develop\n`);

    await checkFiles(policy);

    const expected = `steps:\n  - uses: owner/action@${developSha} # develop\n`;
    assert.strictEqual(readFileSync(workflowPath, "utf8"), expected);
  });

  test("should retain every branch resolution from preview through update", async () => {
    const developSha = "b".repeat(40);
    const fetch = (url: string): Promise<Response> => {
      if (url.endsWith("/commits/main")) return Promise.resolve(jsonResponse({ sha: latestSha }));
      assert.ok(url.endsWith("/commits/develop"));
      return Promise.resolve(jsonResponse({ sha: developSha }));
    };
    const provider = new GitHubActionsProvider({ fetch });
    const resolve = provider.getLatestVersion.bind(provider);
    mock.method(GitHubActionsProvider.prototype, "getLatestVersion", resolve);
    const content = `steps:\n  - uses: owner/action@${sha1Ref} # main\n  - uses: owner/action@develop\n`;
    writeFileSync(workflowPath, content);
    const preview = await checkFiles({ ...policy, dryRun: true, format: "json" });

    const result = await checkFiles({ ...policy, format: "json" });

    assert.deepStrictEqual(result, preview);
    const expected = `steps:\n  - uses: owner/action@${latestSha} # main\n  - uses: owner/action@${developSha} # develop\n`;
    assert.strictEqual(readFileSync(workflowPath, "utf8"), expected);
  });

  test("should keep release labels separate from branch tracking labels", async () => {
    const releaseSha = "b".repeat(40);
    const fetch = (url: string): Promise<Response> => {
      if (url.endsWith("/commits/main")) return Promise.resolve(jsonResponse({ sha: latestSha }));
      if (url.endsWith("/releases/latest"))
        return Promise.resolve(jsonResponse({ tag_name: "v2.0.0" }));
      assert.ok(url.endsWith("/commits/v2.0.0"));
      return Promise.resolve(jsonResponse({ sha: releaseSha }));
    };
    const provider = new GitHubActionsProvider({ fetch });
    const resolve = provider.getLatestVersion.bind(provider);
    mock.method(GitHubActionsProvider.prototype, "getLatestVersion", resolve);
    writeFileSync(workflowPath, "steps:\n  - uses: owner/action@v1\n  - uses: owner/action@main\n");

    await checkFiles(policy);

    const expected = `steps:\n  - uses: owner/action@${releaseSha} # v2.0.0\n  - uses: owner/action@${latestSha} # main\n`;
    assert.strictEqual(readFileSync(workflowPath, "utf8"), expected);
  });

  test("should update only workflows containing a changed branch", async () => {
    const developPath = join(tmpDir, "develop.yml");
    const developSha = "b".repeat(40);
    const fetch = (url: string): Promise<Response> => {
      if (url.endsWith("/commits/main")) return Promise.resolve(jsonResponse({ sha: latestSha }));
      assert.ok(url.endsWith("/commits/develop"));
      return Promise.resolve(jsonResponse({ sha: developSha }));
    };
    const provider = new GitHubActionsProvider({ fetch });
    const resolve = provider.getLatestVersion.bind(provider);
    mock.method(GitHubActionsProvider.prototype, "getLatestVersion", resolve);
    const main = `steps:\n  - uses: owner/action@${latestSha} # main\n`;
    writeFileSync(workflowPath, main);
    writeFileSync(developPath, `steps:\n  - uses: owner/action@${sha1Ref} # develop\n`);
    const write = mock.method(GitHubActionsProvider.prototype, "writeManifest");

    await checkFiles({ ...policy, files: ["ci.yml", "develop.yml"] });

    const writtenPaths = write.mock.calls.map((call) => call.arguments[0]);
    assert.deepStrictEqual(writtenPaths, [developPath]);
    assert.strictEqual(readFileSync(workflowPath, "utf8"), main);
    const expected = `steps:\n  - uses: owner/action@${developSha} # develop\n`;
    assert.strictEqual(readFileSync(developPath, "utf8"), expected);
  });
});
