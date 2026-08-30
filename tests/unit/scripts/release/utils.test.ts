import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  compareStableVersions,
  requiredEnv,
  resolveAvailableReleaseVersion,
  runRelease as runReleaseCommand,
  runTestPublishedReleaseCli,
  writeHomebrewReleaseState,
  writeHomebrewTapUpdate,
  type GitResult,
  type ReleaseOptions,
  type ReleaseRunner,
  type SchemaMetadataWriter,
} from "../../../../scripts/release/utils";
import {
  assertCalledWith,
  assertContainsEqual,
  assertRejects,
  assertThrows,
  match,
} from "../../../helpers/assertions";

const MERGE_COMMIT = "a".repeat(40);
const TEMP_ROOT = join(import.meta.dirname, ".tmp-utils");

const ok = (stdout = ""): GitResult => ({ status: 0, stdout, stderr: "" });
const absent = (): GitResult => ({ status: 1, stdout: "", stderr: "" });
const missing = (): GitResult => ({ status: 2, stdout: "", stderr: "" });
const noopSchemaMetadataWriter: SchemaMetadataWriter = () => {};

const runRelease = (options: ReleaseOptions) =>
  runReleaseCommand({ schemaMetadataWriter: noopSchemaMetadataWriter, ...options });

interface ReleaseFlowState {
  closedPullRequest?: boolean;
  dirtyPullRequest?: boolean;
  mergedPullRequestMissingCommit?: boolean;
  missingFallbackPullRequestUrl?: boolean;
  missingSchemaRevision?: boolean;
  missingSchemaUpdatedDate?: boolean;
  missingReleaseBranchVersion?: boolean;
  mismatchedSchemaDiff?: boolean;
  releasePullRequestMerged?: boolean;
  pullRequestCreateFails?: boolean;
  remoteBranchCheckFails?: boolean;
  remoteBranchInvalidCommit?: boolean;
  unknownAutoMergeSetting?: boolean;
}

interface ReleaseFlowRuntimeState {
  autoMergeQueued: boolean;
}

const createLogger = () => ({
  error: mock.fn(() => {}),
  log: mock.fn(() => {}),
  warn: mock.fn(() => {}),
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const createCommandRecorder = () => {
  let calls: string[] = [];
  const runner = (command: string, args: readonly string[]) => {
    const call = [command].concat(Array.from(args)).join(" ");
    calls = calls.concat(call);
    return ok("1.0.0\n");
  };
  return {
    calls: () => calls,
    runner,
  };
};

const brewTapResponse = (url: string, method: string): Response => {
  const isFormulaRead =
    method === "GET" && url.includes("contents/Formula/codependence.rb") && !url.includes("ref=");
  if (isFormulaRead) return new Response("old formula");
  if (url.includes("git/ref/heads/main")) return jsonResponse({ object: { sha: "main-sha" } });
  if (url.includes("git/ref/heads/codependence-release")) {
    return jsonResponse({ object: { sha: "branch-sha" } });
  }
  const isFormulaRefRead = url.includes("contents/Formula/codependence.rb") && url.includes("ref=");
  if (isFormulaRefRead) return jsonResponse({ sha: "formula-sha" });
  if (url.includes("pulls?")) {
    return jsonResponse([
      { html_url: "https://github.com/yowainwright/homebrew-tap/pull/10", number: 10 },
    ]);
  }
  const isWriteMethod = new Set(["PATCH", "POST", "PUT"]).has(method);
  if (isWriteMethod) return jsonResponse({});
  return jsonResponse({});
};

const releaseBranchResult = (key: string, state: ReleaseFlowState): GitResult | undefined => {
  if (key.startsWith("gh pr list --head release/v1.2.4")) return ok("[]");
  if (key === "git show-ref --verify --quiet refs/heads/release/v1.2.4") {
    const shouldUseLocalBranch = state.mismatchedSchemaDiff || state.missingReleaseBranchVersion;
    if (shouldUseLocalBranch) return ok();
    return absent();
  }
  if (key === "git ls-remote --exit-code --heads origin refs/heads/release/v1.2.4") {
    if (state.remoteBranchCheckFails)
      return { status: 1, stdout: "", stderr: "remote unavailable\n" };
    if (state.remoteBranchInvalidCommit) return ok("not-a-sha refs/heads/release/v1.2.4\n");
    return missing();
  }
  if (key === "git show release/v1.2.4:package.json") {
    if (state.missingReleaseBranchVersion) return ok(JSON.stringify({ name: "codependence" }));
    return ok(JSON.stringify({ version: "1.2.4" }));
  }
  if (key === "git log -1 --format=%s release/v1.2.4") return ok("chore(release): 1.2.4\n");
  if (key === "git rev-parse release/v1.2.4^") return ok("abc\n");
  if (key === "git rev-parse refs/heads/release/v1.2.4") return ok(`${MERGE_COMMIT}\n`);
  if (key === "git diff-tree --no-commit-id --name-only -r release/v1.2.4") {
    return ok("package.json\nsrc/config/schema.json\n");
  }
  if (key === "git diff --unified=0 origin/main release/v1.2.4 -- package.json") {
    return ok('-  "version": "1.2.3",\n+  "version": "1.2.4",\n');
  }
  if (key === "git diff --unified=0 origin/main release/v1.2.4 -- src/config/schema.json") {
    if (state.mismatchedSchemaDiff) return ok('+  "private": false,\n');
    if (state.missingSchemaRevision)
      return ok('-  "x-updated": "2026-08-25",\n+  "x-updated": "2026-08-26",\n');
    if (state.missingSchemaUpdatedDate)
      return ok(
        '-  "x-revision": "1.2.3",\n+  "x-revision": "1.2.4",\n+  "x-updated": "2026-08-26",\n',
      );
    return ok(
      '-  "x-revision": "1.2.3",\n+  "x-revision": "1.2.4",\n-  "x-updated": "2026-08-25",\n+  "x-updated": "2026-08-26",\n',
    );
  }
  return undefined;
};

const releaseFlowResult = (
  key: string,
  prUrl: string,
  state: ReleaseFlowState,
  runtime: ReleaseFlowRuntimeState,
): GitResult => {
  const branchResult = releaseBranchResult(key, state);
  if (branchResult) return branchResult;
  if (key === "gh api repos/yowainwright/codependence --jq .allow_auto_merge") {
    if (state.unknownAutoMergeSetting) return ok("null\n");
    return ok("true\n");
  }
  if (key.includes("release-it --release-version")) return ok("1.2.4\n");
  if (key.includes("rev-parse -q --verify refs/tags/v1.2.4")) return missing();
  if (key.includes("rev-parse -q --verify refs/tags/v1.2.4-rc.0")) return missing();
  if (key.includes("rev-parse -q --verify refs/tags/v1.2.3-rc.0")) return missing();
  if (key.includes("ls-remote --exit-code --tags")) return missing();
  if (key === "git ls-remote --tags origin refs/tags/v1.2.4") return ok();
  if (key === "git ls-remote --tags origin refs/tags/v1.2.4-rc.0") return ok();
  if (key.startsWith("gh pr create ")) {
    if (state.pullRequestCreateFails) return { status: 1, stdout: "", stderr: "already exists\n" };
    return ok(`${prUrl}\n`);
  }
  if (key === "gh pr view release/v1.2.4 --json url") {
    const result = state.missingFallbackPullRequestUrl ? {} : { url: prUrl };
    return ok(JSON.stringify(result));
  }
  if (key.endsWith("state,mergedAt,mergeCommit,mergeStateStatus")) {
    if (state.closedPullRequest) return ok(JSON.stringify({ state: "CLOSED" }));
    if (state.dirtyPullRequest) {
      return ok(JSON.stringify({ mergeStateStatus: "DIRTY", state: "OPEN" }));
    }
    if (state.mergedPullRequestMissingCommit) {
      return ok(JSON.stringify({ mergeCommit: null, mergedAt: "now", state: "MERGED" }));
    }
    if (runtime.autoMergeQueued) {
      const merged = { mergeCommit: { oid: MERGE_COMMIT }, mergedAt: "now", state: "MERGED" };
      return ok(JSON.stringify(merged));
    }
    return ok(JSON.stringify({ mergeStateStatus: "CLEAN", state: "OPEN" }));
  }
  if (key.endsWith("state,mergedAt,mergeCommit")) {
    if (state.mergedPullRequestMissingCommit) {
      return ok(JSON.stringify({ mergeCommit: null, mergedAt: "now", state: "MERGED" }));
    }
    const merged = { mergeCommit: { oid: MERGE_COMMIT }, mergedAt: "now", state: "MERGED" };
    return ok(JSON.stringify(merged));
  }
  if (key === "git rev-list --first-parent --parents origin/main") {
    return ok(`${MERGE_COMMIT} abc\nabc def\n`);
  }
  if (key === `git show ${MERGE_COMMIT}:package.json`) {
    if (state.releasePullRequestMerged) return ok(JSON.stringify({ version: "1.2.3-rc.0" }));
    return ok(JSON.stringify({ version: "1.2.4" }));
  }
  if (key === `git diff-tree --no-commit-id --name-only -r ${MERGE_COMMIT}`) {
    return ok("package.json\nsrc/config/schema.json\n");
  }
  if (key === `git diff --unified=0 abc ${MERGE_COMMIT} -- package.json`) {
    if (state.releasePullRequestMerged) {
      return ok('-  "version": "1.2.3-beta.1",\n+  "version": "1.2.3-rc.0",\n');
    }
    return ok('-  "version": "1.2.3",\n+  "version": "1.2.4",\n');
  }
  if (key === `git diff --unified=0 abc ${MERGE_COMMIT} -- src/config/schema.json`) {
    if (state.releasePullRequestMerged) {
      return ok(
        '-  "x-revision": "1.2.3-beta.1",\n+  "x-revision": "1.2.3-rc.0",\n-  "x-updated": "2026-08-25",\n+  "x-updated": "2026-08-26",\n',
      );
    }
    return ok(
      '-  "x-revision": "1.2.3",\n+  "x-revision": "1.2.4",\n-  "x-updated": "2026-08-25",\n+  "x-updated": "2026-08-26",\n',
    );
  }
  if (key === "git branch --show-current") return ok("main\n");
  if (key === "git status --short") return ok();
  if (key === "git fetch origin main --tags") return ok();
  if (key === "git rev-parse HEAD") return ok("abc\n");
  if (key === "git rev-parse origin/main") return ok("abc\n");
  if (key === "git rev-parse origin/main^") return ok("def\n");
  if (key === "git ls-remote --tags origin refs/tags/v1.2.4") return ok();
  if (
    key ===
    "gh pr list --head release/v1.2.3-rc.0 --state all --json url,headRefName,baseRefName,headRefOid,mergedAt,mergeCommit"
  ) {
    if (!state.releasePullRequestMerged) return ok("[]");
    const pullRequest = {
      baseRefName: "main",
      headRefName: "release/v1.2.3-rc.0",
      headRefOid: MERGE_COMMIT,
      mergeCommit: state.mergedPullRequestMissingCommit ? null : { oid: MERGE_COMMIT },
      mergedAt: "now",
      url: prUrl,
    };
    return ok(JSON.stringify([pullRequest]));
  }
  if (key === "git show release/v1.2.3-rc.0:package.json")
    return ok(JSON.stringify({ version: "1.2.3-rc.0" }));
  if (key === "git log -1 --format=%s release/v1.2.3-rc.0")
    return ok("chore(release): 1.2.3-rc.0\n");
  if (key === "git rev-parse release/v1.2.3-rc.0^") return ok("abc\n");
  if (key === "git rev-parse refs/heads/release/v1.2.3-rc.0") return ok(`${MERGE_COMMIT}\n`);
  return ok();
};

const createReleaseFlowRunner = (prUrl: string, state: ReleaseFlowState = {}) => {
  const calls: string[][] = [];
  const runtime = { autoMergeQueued: false };
  const runner = mock.fn<ReleaseRunner>((command, args) => {
    const call = [command, ...Array.from(args)];
    calls[calls.length] = call;
    if (call.join(" ").startsWith("gh pr merge --auto ")) runtime.autoMergeQueued = true;
    return releaseFlowResult(call.join(" "), prUrl, state, runtime);
  });
  return { calls, runner };
};

describe("scripts/release/utils", () => {
  test("compares equal Homebrew versions", () => {
    assert.strictEqual(compareStableVersions("1.0.11", "1.0.11"), 0);
  });

  test("writes Homebrew release state to stdout without an output path", async () => {
    const formula = 'url "https://registry.npmjs.org/codependence/-/codependence-1.0.12.tgz"';
    const fetchImpl = async () => new Response(formula);
    let output = "";
    const writeSpy = mock.method(process.stdout, "write", (value: string) => {
      output += value;
      return true;
    });

    try {
      const env = {
        FORMULA_PATH: "codependence.rb",
        GITHUB_REPOSITORY: "yowainwright/codependence",
        GITHUB_TOKEN: "repo-token",
        TAP_TOKEN: "tap-token",
        VERSION: "1.0.11",
      };
      await writeHomebrewReleaseState({ arch: "arm64", env, fetchImpl });
      assert.ok(output.includes("skip=true\n"));
    } finally {
      writeSpy.mock.restore();
    }
  });

  test("writes unchanged Homebrew tap updates as notices", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "tap-current-output-"));
    const formulaPath = join(directory, "codependence.rb");
    let output = "";
    const writeSpy = mock.method(process.stdout, "write", (value: string) => {
      output += value;
      return true;
    });

    try {
      writeFileSync(formulaPath, "same formula");
      const env = {
        FORMULA_PATH: formulaPath,
        GITHUB_REPOSITORY: "yowainwright/codependence",
        GITHUB_TOKEN: "repo-token",
        TAP_TOKEN: "tap-token",
        VERSION: "1.0.11",
      };
      const fetchImpl = async () => new Response("same formula");
      await writeHomebrewTapUpdate({ env, fetchImpl });
      assert.strictEqual(output, "::notice::Homebrew tap formula already current\n");
    } finally {
      writeSpy.mock.restore();
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("rejects malformed GitHub SHA responses", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "tap-malformed-"));
    const formulaPath = join(directory, "codependence.rb");

    try {
      writeFileSync(formulaPath, "new formula");
      const env = {
        FORMULA_PATH: formulaPath,
        GITHUB_REPOSITORY: "yowainwright/codependence",
        GITHUB_TOKEN: "repo-token",
        TAP_TOKEN: "tap-token",
        VERSION: "1.0.11",
      };
      const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
        const method = init?.method || "GET";
        const isFormulaRead =
          String(url).includes("contents/Formula/codependence.rb") && method === "GET";
        if (isFormulaRead) return new Response("old formula");
        return jsonResponse({});
      };

      await assertRejects(
        writeHomebrewTapUpdate({ env, fetchImpl }),
        "GitHub response did not include a SHA",
      );
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("resolve-version reads npm when no version is provided", () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "version-latest-"));
    const outputPath = join(directory, "github-output");
    const logSpy = mock.method(console, "log", () => {});
    const { calls, runner } = createCommandRecorder();

    try {
      const code = runTestPublishedReleaseCli({
        argv: ["resolve-version"],
        env: { GITHUB_OUTPUT: outputPath },
        runner,
      });
      assert.strictEqual(code, 0);
      assert.strictEqual(readFileSync(outputPath, "utf8"), "version=1.0.0\n");
    } finally {
      logSpy.mock.restore();
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }

    assert.deepStrictEqual(calls(), ["npm view codependence version"]);
  });

  test("rejects stable release candidates without stable inputs", () => {
    const runner = mock.fn<ReleaseRunner>((command, args) => ok([command, ...args].join(" ")));
    const args = { dryRun: true, timeoutMinutes: 90 };
    assertThrows(
      () => resolveAvailableReleaseVersion(runner, args, "1.2.4"),
      "Stable release resolution requires an explicit increment",
    );
    assertThrows(
      () =>
        resolveAvailableReleaseVersion(
          runner,
          { ...args, increment: "patch" as const },
          "1.2.4-rc.0",
        ),
      "release-it resolved a prerelease version",
    );
  });

  test("requires named release environment values", () => {
    assert.strictEqual(requiredEnv({ VERSION: "1.2.3" }, "VERSION"), "1.2.3");
    assertThrows(() => requiredEnv({}, "VERSION"), "VERSION is required");
  });

  test("rejects unreadable repository auto-merge settings", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { unknownAutoMergeSetting: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unable to read repository auto-merge setting");
  });

  test("rejects unrelated schema changes in an existing release commit", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { mismatchedSchemaDiff: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unverified release diff");
  });

  test("rejects release commits without a schema revision change", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { missingSchemaRevision: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unverified release schema revision");
  });

  test("rejects malformed schema updated date changes", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { missingSchemaUpdatedDate: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unverified release schema date");
  });

  test("rejects release branch commits without a package version", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { missingReleaseBranchVersion: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "package.json version is missing");
  });

  test("rejects malformed remote release branch commits", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { remoteBranchInvalidCommit: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Invalid remote branch commit");
  });

  test("surfaces remote release branch lookup failures", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { remoteBranchCheckFails: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "remote unavailable");
  });

  test("falls back to reading a release PR after create reports an existing PR", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl, { pullRequestCreateFails: true });
    const code = await runRelease({ increment: "patch", logger, runner });

    assert.strictEqual(code, 0);
    assertCalledWith(logger.warn, "gh pr create failed: already exists");
    assertContainsEqual(calls, ["gh", "pr", "view", "release/v1.2.4", "--json", "url"]);
  });

  test("rejects release PR create fallback without a URL", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { missingFallbackPullRequestUrl: true, pullRequestCreateFails: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unable to find release PR");
  });

  test("writes dry-run plans for requested version changes", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl);
    const code = await runRelease({ dryRun: true, increment: "patch", logger, runner });

    assert.strictEqual(code, 0);
    assertCalledWith(logger.log, match.stringContaining("Dry run release commands"));
  });

  test("tags the current package version", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl);
    const code = await runRelease({ logger, packageVersion: "1.2.4-rc.0", runner });

    assert.strictEqual(code, 0);
    assertCalledWith(logger.log, "Tagged current package version 1.2.4-rc.0.");
    assertContainsEqual(calls, [
      "git",
      "tag",
      "--annotate",
      "v1.2.4-rc.0",
      "--message",
      "Release 1.2.4-rc.0",
    ]);
  });

  test("writes a dry-run tag plan for merged current-version releases", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { releasePullRequestMerged: true });
    const code = await runRelease({ dryRun: true, logger, packageVersion: "1.2.3-rc.0", runner });

    assert.strictEqual(code, 0);
    assertCalledWith(logger.log, match.stringContaining("Dry run release commands"));
  });

  test("rejects closed release pull requests", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { closedPullRequest: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Release PR closed without merging");
  });

  test("rejects release pull requests with merge conflicts", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { dirtyPullRequest: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Release PR has merge conflicts");
  });

  test("updates the existing stable Homebrew tap PR", async () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "tap-"));
    const formulaPath = join(directory, "codependence.rb");
    const writeSpy = mock.method(process.stdout, "write", () => true);
    const env = {
      FORMULA_PATH: formulaPath,
      GITHUB_REPOSITORY: "yowainwright/codependence",
      GITHUB_TOKEN: "repo-token",
      TAP_BRANCH: "codependence-release",
      TAP_TOKEN: "tap-token",
      VERSION: "1.0.13",
    };

    try {
      writeFileSync(formulaPath, "new formula");
      const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) =>
        brewTapResponse(String(url), init?.method || "GET");

      await writeHomebrewTapUpdate({ env, fetchImpl });
    } finally {
      writeSpy.mock.restore();
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });
});
