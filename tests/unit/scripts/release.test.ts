import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  assertCalledWith,
  assertContainsEqual,
  assertNotContainsEqual,
  assertRejects,
  assertThrows,
  match,
} from "../../helpers/assertions";
import {
  buildCurrentVersionTagPlan,
  buildReleaseItArgs,
  buildReleasePlan,
  commandText,
  createRunner as createCommandRunner,
  formatReleasePlan,
  gitText,
  incrementPreReleaseVersion,
  incrementStableVersion,
  parseArgs,
  parseReleaseVersion,
  readPackageVersion,
  releaseTagExists,
  renderSchemaMetadata,
  resolveAvailableReleaseVersion,
  runOrThrow,
  runRelease as runReleaseCommand,
  updateSchemaMetadata,
  writeSchemaMetadata,
  type ReleaseOptions,
  type ReleaseRunner,
  type SchemaMetadataWriter,
} from "../../../scripts/release";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GitResult } from "../../../scripts/release";

const MERGE_COMMIT = "a".repeat(40);
const ok = (stdout = ""): GitResult => ({ status: 0, stdout, stderr: "" });
const absent = (): GitResult => ({ status: 1, stdout: "", stderr: "" });
const missing = (): GitResult => ({ status: 2, stdout: "", stderr: "" });
const noopSchemaMetadataWriter: SchemaMetadataWriter = () => {};
const TEMP_ROOT = join(import.meta.dirname, ".tmp-release");

const runRelease = (options: ReleaseOptions) =>
  runReleaseCommand({ schemaMetadataWriter: noopSchemaMetadataWriter, ...options });

interface ReleaseFlowState {
  autoMergeDisabled?: boolean;
  dirtyPullRequest?: boolean;
  extraMergedFile?: boolean;
  extraReleaseFile?: boolean;
  existingPullRequest?: boolean;
  localBranch?: boolean;
  mergedPullRequest?: boolean;
  mergedVersion?: boolean;
  missingReleaseSchema?: boolean;
  mismatchedMergedAncestry?: boolean;
  mismatchedMergedDiff?: boolean;
  mismatchedMergedRefs?: boolean;
  mismatchedPullRequest?: boolean;
  mismatchedReleaseDiff?: boolean;
  pendingRequirements?: boolean;
  remoteBranch?: boolean;
}

interface ReleaseFlowRuntimeState {
  autoMergeQueued: boolean;
  pendingReadCount: number;
  schemaMetadataCompleted: boolean;
}

function createRunner(overrides: Record<string, GitResult> = {}) {
  const calls: string[][] = [];
  const runner = mock.fn<ReleaseRunner>((command, args) => {
    const call = [command, ...Array.from(args)];
    calls[calls.length] = call;
    return overrides[call.join(" ")] ?? ok();
  });
  return { calls, runner };
}

function createLogger() {
  return { error: mock.fn(() => {}), log: mock.fn(() => {}), warn: mock.fn(() => {}) };
}

const readyMain = {
  "git branch --show-current": ok("main\n"),
  "git status --short": ok(),
  "git fetch origin main --tags": ok(),
  "git rev-parse HEAD": ok("abc\n"),
  "git rev-parse origin/main": ok("abc\n"),
};

function mergedVersionResult(
  key: string,
  prUrl: string,
  state: ReleaseFlowState,
): GitResult | undefined {
  if (!state.mergedVersion) return undefined;
  if (key === "git rev-parse -q --verify refs/tags/v1.2.3") return missing();
  if (key === "git ls-remote --tags origin refs/tags/v1.2.3") return ok();
  if (key === "git ls-remote --exit-code --tags origin refs/tags/v1.2.3") return missing();
  if (!key.startsWith("gh pr list --head release/v1.2.3")) return undefined;
  const pullRequest = {
    baseRefName: "main",
    headRefName: state.mismatchedMergedRefs ? "release/v9.9.9" : "release/v1.2.3",
    mergeCommit: { oid: MERGE_COMMIT },
    mergedAt: "now",
    state: "MERGED",
    url: prUrl,
  };
  return ok(JSON.stringify([pullRequest]));
}

function releaseBranchResult(
  key: string,
  prUrl: string,
  state: ReleaseFlowState,
  runtime: ReleaseFlowRuntimeState,
): GitResult | undefined {
  if (key.startsWith("gh pr list --head release/v1.2.4")) {
    const headRefOid = state.mismatchedPullRequest ? "b".repeat(40) : MERGE_COMMIT;
    const pullRequest = {
      baseRefName: "main",
      headRefName: state.mismatchedMergedRefs ? "release/v9.9.9" : "release/v1.2.4",
      headRefOid,
      mergeCommit: state.mergedPullRequest ? { oid: MERGE_COMMIT } : undefined,
      mergedAt: state.mergedPullRequest ? "now" : undefined,
      state: "OPEN",
      url: prUrl,
    };
    const pullRequests = state.existingPullRequest || state.mergedPullRequest ? [pullRequest] : [];
    return ok(JSON.stringify(pullRequests));
  }
  if (key === "git show-ref --verify --quiet refs/heads/release/v1.2.4") {
    if (state.localBranch) return ok();
    return absent();
  }
  if (key === "git ls-remote --exit-code --heads origin refs/heads/release/v1.2.4") {
    if (state.remoteBranch) return ok(`${MERGE_COMMIT} refs/heads/release/v1.2.4\n`);
    return missing();
  }
  if (key === "git show release/v1.2.4:package.json") {
    return ok(JSON.stringify({ version: "1.2.4" }));
  }
  if (key === "git log -1 --format=%s release/v1.2.4") return ok("chore(release): 1.2.4\n");
  if (key === "git rev-parse release/v1.2.4^") return ok("abc\n");
  if (key === "git rev-parse refs/heads/release/v1.2.4") return ok(`${MERGE_COMMIT}\n`);
  if (key === "git diff-tree --no-commit-id --name-only -r release/v1.2.4") {
    const releaseFiles = "package.json\nsrc/config/schema.json\n";
    const missingSchema = state.missingReleaseSchema && !runtime.schemaMetadataCompleted;
    if (missingSchema) return ok("package.json\n");

    const changedFiles = state.extraReleaseFile ? `${releaseFiles}src/index.ts\n` : releaseFiles;
    return ok(changedFiles);
  }
  if (key === "git diff --unified=0 origin/main release/v1.2.4 -- package.json") {
    if (state.mismatchedReleaseDiff) {
      return ok('-  "version": "1.2.3",\n+  "version": "1.2.4",\n+  "private": false,\n');
    }
    return ok('-  "version": "1.2.3",\n+  "version": "1.2.4",\n');
  }
  if (key === "git diff --unified=0 origin/main release/v1.2.4 -- src/config/schema.json") {
    return ok(
      '-  "x-revision": "1.2.3",\n+  "x-revision": "1.2.4",\n-  "x-updated": "2026-08-25",\n+  "x-updated": "2026-08-26",\n',
    );
  }
  return undefined;
}

function mergedCommitResult(key: string, state: ReleaseFlowState): GitResult | undefined {
  const version = state.mergedVersion ? "1.2.3" : "1.2.4";
  if (key === "git rev-list --first-parent --parents origin/main") {
    if (state.mismatchedMergedAncestry) return ok("abc def\n");
    return ok(`${MERGE_COMMIT} abc\nabc def\n`);
  }
  if (key === `git show ${MERGE_COMMIT}:package.json`) {
    return ok(JSON.stringify({ version }));
  }
  if (key === `git diff-tree --no-commit-id --name-only -r ${MERGE_COMMIT}`) {
    const releaseFiles = "package.json\nsrc/config/schema.json\n";
    const files = state.extraMergedFile ? `${releaseFiles}src/index.ts\n` : releaseFiles;
    return ok(files);
  }
  if (key === `git diff --unified=0 abc ${MERGE_COMMIT} -- package.json`) {
    const extra = state.mismatchedMergedDiff ? '+  "private": false,\n' : "";
    return ok(`-  "version": "1.2.2",\n+  "version": "${version}",\n${extra}`);
  }
  if (key === `git diff --unified=0 abc ${MERGE_COMMIT} -- src/config/schema.json`) {
    return ok(
      `-  "x-revision": "1.2.2",\n+  "x-revision": "${version}",\n-  "x-updated": "2026-08-25",\n+  "x-updated": "2026-08-26",\n`,
    );
  }
  return undefined;
}

function releaseFlowResult(
  key: string,
  prUrl: string,
  state: ReleaseFlowState,
  runtime: ReleaseFlowRuntimeState,
): GitResult {
  const mergedResult = mergedVersionResult(key, prUrl, state);
  if (mergedResult) return mergedResult;
  const branchResult = releaseBranchResult(key, prUrl, state, runtime);
  if (branchResult) return branchResult;
  const mergedCommit = mergedCommitResult(key, state);
  if (mergedCommit) return mergedCommit;
  if (key === "gh api repos/yowainwright/codependence --jq .allow_auto_merge") {
    return ok(`${state.autoMergeDisabled ? "false" : "true"}\n`);
  }
  if (key.includes("release-it --release-version")) return ok("1.2.4\n");
  if (key.includes("rev-parse -q --verify refs/tags/v1.2.4")) return missing();
  if (key === "git ls-remote --tags origin refs/tags/v1.2.4") return ok();
  if (key.startsWith("gh pr create ")) return ok(`${prUrl}\n`);
  if (key.endsWith("state,mergedAt,mergeCommit,mergeStateStatus")) {
    return ok(JSON.stringify({ mergeStateStatus: "CLEAN", state: "OPEN" }));
  }
  if (key.endsWith("state,mergedAt,mergeCommit")) {
    const state = { mergeCommit: { oid: MERGE_COMMIT }, mergedAt: "now", state: "MERGED" };
    return ok(JSON.stringify(state));
  }
  if (key.includes("ls-remote --exit-code --tags")) return missing();
  return readyMain[key as keyof typeof readyMain] ?? ok();
}

function mergedPullRequestState(): GitResult {
  const state = { mergeCommit: { oid: MERGE_COMMIT }, mergedAt: "now", state: "MERGED" };
  return ok(JSON.stringify(state));
}

function dirtyPullRequestState(): GitResult {
  return ok(JSON.stringify({ mergeStateStatus: "DIRTY", state: "OPEN" }));
}

function pendingPullRequestState(runtime: ReleaseFlowRuntimeState): GitResult {
  runtime.pendingReadCount += 1;
  const pullRequestState = runtime.pendingReadCount === 1 ? "OPEN" : "CLOSED";
  return ok(JSON.stringify({ mergeStateStatus: "BLOCKED", state: pullRequestState }));
}

function releaseFlowStateOverride(
  key: string,
  state: ReleaseFlowState,
  runtime: ReleaseFlowRuntimeState,
): GitResult | undefined {
  const isMergeStateRead = key.endsWith("state,mergedAt,mergeCommit,mergeStateStatus");
  if (!isMergeStateRead) return undefined;
  if (runtime.autoMergeQueued) return mergedPullRequestState();
  if (state.dirtyPullRequest) return dirtyPullRequestState();
  if (!state.pendingRequirements) return undefined;
  return pendingPullRequestState(runtime);
}

function createReleaseFlowRunner(prUrl: string, state: ReleaseFlowState = {}) {
  const calls: string[][] = [];
  const runtime = { autoMergeQueued: false, pendingReadCount: 0, schemaMetadataCompleted: false };
  const runner = mock.fn<ReleaseRunner>((command, args) => {
    const call = [command, ...Array.from(args)];
    calls[calls.length] = call;
    const key = call.join(" ");
    if (key.startsWith("gh pr merge --auto ")) runtime.autoMergeQueued = true;
    if (key === "git commit --amend --no-edit --no-verify") runtime.schemaMetadataCompleted = true;
    const override = releaseFlowStateOverride(key, state, runtime);
    if (override) return override;
    return releaseFlowResult(key, prUrl, state, runtime);
  });
  return { calls, runner };
}

describe("scripts/release arguments", () => {
  test("reads explicit stable release options", () => {
    assert.deepStrictEqual(parseArgs(["--increment=minor", "--dry-run", "--timeout-minutes=15"]), {
      dryRun: true,
      increment: "minor",
      timeoutMinutes: 15,
    });
  });

  test("rejects unsafe and invalid options", () => {
    assertThrows(() => parseArgs(["--no-wait"]), "cannot safely tag");
    assertThrows(() => parseArgs(["--increment=nightly"]), "Invalid release increment");
    assertThrows(() => parseArgs(["--preRelease=nightly"]), "Invalid prerelease identifier");
    assertThrows(() => parseArgs(["--timeout-minutes=0"]), "Invalid timeout");
  });

  test("builds non-publishing release-it arguments", () => {
    assert.deepStrictEqual(buildReleaseItArgs({ increment: "patch" }), [
      "--increment=patch",
      "--git.tag=false",
      "--git.push=false",
      "--git.requireUpstream=false",
      "--git.getLatestTagFromAllRefs=true",
      "--ci",
    ]);
  });

  test("builds default release-it arguments", () => {
    assert.deepStrictEqual(buildReleaseItArgs({}), [
      "--git.tag=false",
      "--git.push=false",
      "--git.requireUpstream=false",
      "--git.getLatestTagFromAllRefs=true",
      "--ci",
    ]);
  });

  test("reads release-it version output", () => {
    assert.strictEqual(parseReleaseVersion("codependence 1.2.3 to 1.2.4-beta.6"), "1.2.4-beta.6");
  });
});

describe("scripts/release plans", () => {
  test("describes the release PR gate", () => {
    const plan = buildReleasePlan("1.2.4");
    const output = formatReleasePlan(plan);
    assert.strictEqual(plan.branch, "release/v1.2.4");
    assert.strictEqual(plan.pullRequestTitle, "chore(release): v1.2.4");
    assert.ok(output.includes("verify repository auto-merge"));
    assert.ok(output.includes("stamp schema metadata"));
    assert.ok(output.includes("queue auto-merge for the release PR"));
  });

  test("describes tagging an existing prerelease package version", () => {
    const plan = buildCurrentVersionTagPlan("1.2.4-beta.2");
    assert.ok(plan.commands.includes("git push origin refs/tags/v1.2.4-beta.2"));
  });
});

describe("scripts/release versions", () => {
  test("advances stable and prerelease versions", () => {
    assert.strictEqual(incrementStableVersion("1.2.3", "patch"), "1.2.4");
    assert.strictEqual(incrementStableVersion("1.2.3", "minor"), "1.3.0");
    assert.strictEqual(incrementStableVersion("1.2.3", "major"), "2.0.0");
    assert.strictEqual(incrementPreReleaseVersion("1.2.4-beta.7", "beta"), "1.2.4-beta.8");
    assertThrows(
      () => incrementPreReleaseVersion("1.2.4-alpha.7", "beta"),
      "Unable to advance beta",
    );
    assertThrows(() => incrementStableVersion("1.2.3-beta.7", "patch"), "Unable to advance stable");
  });

  test("updates schema metadata from the release version", () => {
    const schema = {
      "x-created": "2025-11-23",
      "x-revision": "1.2.3",
      "x-updated": "2026-08-25",
    };
    const date = new Date("2026-08-26T23:59:59.000Z");
    const updated = updateSchemaMetadata(schema, "1.2.4", date);

    assert.deepStrictEqual(updated, {
      "x-created": "2025-11-23",
      "x-revision": "1.2.4",
      "x-updated": "2026-08-26",
    });
  });

  test("renders schema metadata without reformatting other schema lines", () => {
    const schema = [
      "{",
      '  "x-revision": 2,',
      '  "x-created": "2025-11-23",',
      '  "x-updated": "2026-08-25",',
      '  "enum": ["circleci", "helm"]',
      "}",
      "",
    ].join("\n");
    const date = new Date("2026-08-26T23:59:59.000Z");
    const rendered = renderSchemaMetadata(schema, "1.2.4", date);

    assert.strictEqual(
      rendered,
      [
        "{",
        '  "x-revision": "1.2.4",',
        '  "x-created": "2025-11-23",',
        '  "x-updated": "2026-08-26",',
        '  "enum": ["circleci", "helm"]',
        "}",
        "",
      ].join("\n"),
    );
  });

  test("rejects schemas missing release metadata fields", () => {
    assertThrows(() => renderSchemaMetadata("{}", "1.2.4"), "schema x-revision is missing");
  });

  test("writes schema metadata to disk", () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "schema-"));
    const schemaPath = join(directory, "src/config/schema.json");
    try {
      mkdirSync(join(directory, "src/config"), { recursive: true });
      writeFileSync(schemaPath, '{\n  "x-revision": "1.2.3",\n  "x-updated": "2026-08-25"\n}\n');
      writeSchemaMetadata(directory, "1.2.4", new Date("2026-08-26T00:00:00.000Z"));
      assert.ok(readFileSync(schemaPath, "utf8").includes('"x-revision": "1.2.4"'));
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("reads package versions from disk", () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "package-"));
    try {
      writeFileSync(join(directory, "package.json"), JSON.stringify({ version: "1.2.3" }));
      assert.strictEqual(readPackageVersion(directory), "1.2.3");
    } finally {
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("checks local and remote tags", () => {
    const { runner } = createRunner({
      "git rev-parse -q --verify refs/tags/v1.2.4": missing(),
      "git ls-remote --tags origin refs/tags/v1.2.4": ok("abc refs/tags/v1.2.4\n"),
    });
    assert.strictEqual(releaseTagExists(runner, "v1.2.4"), true);
  });

  test("rejects tag lookup failures", () => {
    const { runner } = createRunner({
      "git rev-parse -q --verify refs/tags/v1.2.4": absent(),
      "git ls-remote --tags origin refs/tags/v1.2.4": { status: 1, stdout: "", stderr: "" },
    });
    assertThrows(() => releaseTagExists(runner, "v1.2.4"), "Unable to check remote tag");
  });

  test("skips occupied stable release tags", () => {
    const { runner } = createRunner({
      "git rev-parse -q --verify refs/tags/v1.2.4": ok("abc\n"),
      "git rev-parse -q --verify refs/tags/v1.2.5": missing(),
      "git ls-remote --tags origin refs/tags/v1.2.5": ok(),
    });
    const args = { dryRun: true, increment: "patch" as const, timeoutMinutes: 90 };
    assert.strictEqual(resolveAvailableReleaseVersion(runner, args, "1.2.4"), "1.2.5");
  });

  test("skips occupied prerelease tags", () => {
    const { runner } = createRunner({
      "git rev-parse -q --verify refs/tags/v1.2.4-beta.7": ok("abc\n"),
      "git rev-parse -q --verify refs/tags/v1.2.4-beta.8": missing(),
      "git ls-remote --tags origin refs/tags/v1.2.4-beta.8": ok(),
    });
    const args = { dryRun: true, preRelease: "beta" as const, timeoutMinutes: 90 };
    assert.strictEqual(
      resolveAvailableReleaseVersion(runner, args, "1.2.4-beta.7"),
      "1.2.4-beta.8",
    );
  });

  test("wraps release command helpers", () => {
    const runner: ReleaseRunner = () => ok(" output \n");
    assert.strictEqual(commandText(runner, "gh", ["status"]), "output");
    assert.deepStrictEqual(runOrThrow(runner, "gh", ["status"]), ok(" output \n"));
  });

  test("surfaces release command failures", () => {
    const runner: ReleaseRunner = () => ({ status: 1, stdout: "", stderr: "boom\n" });
    assertThrows(() => commandText(runner, "gh", ["status"]), "boom");
    assertThrows(() => runOrThrow(runner, "gh", ["status"]), "gh status failed");
  });

  test("runs commands from a working directory", () => {
    const runner = createCommandRunner(process.cwd());
    const result = runner(process.execPath, ["--version"]);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.startsWith("v"));
  });

  test("surfaces git helper failures", () => {
    const git = () => ({ status: 1, stdout: "", stderr: "nope\n" });
    assertThrows(() => gitText(git, ["status"], "fallback"), "nope");
  });
});

describe("scripts/release flow", () => {
  test("requires an explicit stable increment", async () => {
    const { runner } = createRunner(readyMain);
    const options = { packageVersion: "1.2.3", runner };
    const release = runRelease(options);
    await assertRejects(release, "explicit increment");
  });

  test("dry-runs an existing prerelease version as a tag-only release", async () => {
    const logger = createLogger();
    const overrides = {
      ...readyMain,
      "git rev-parse -q --verify refs/tags/v1.2.4-beta.2": missing(),
      "git ls-remote --tags origin refs/tags/v1.2.4-beta.2": ok(),
    };
    const { runner } = createRunner(overrides);
    const options = { dryRun: true, logger, packageVersion: "1.2.4-beta.2", runner };
    const code = await runRelease(options);
    const expected = match.stringContaining("git push origin refs/tags/v1.2.4-beta.2");
    assert.strictEqual(code, 0);
    assertCalledWith(logger.log, expected);
  });

  test("queues release PR auto-merge before tagging its merge commit", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl);
    const code = await runRelease({ increment: "patch", logger, runner });
    const mergeCall = [
      "gh",
      "pr",
      "merge",
      "--auto",
      "--squash",
      "--delete-branch",
      "--match-head-commit",
      MERGE_COMMIT,
      prUrl,
    ];
    const tagCall = [
      "git",
      "tag",
      "--annotate",
      "v1.2.4",
      "--message",
      "Release 1.2.4",
      MERGE_COMMIT,
    ];
    assert.strictEqual(code, 0);
    assertContainsEqual(calls, mergeCall);
    assertContainsEqual(calls, tagCall);
  });

  test("stamps schema metadata before pushing the release branch", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl);
    const schemaMetadataWriter: SchemaMetadataWriter = (cwd, version) => {
      calls[calls.length] = ["schemaMetadataWriter", cwd, version];
    };
    const options = {
      cwd: "/repo",
      increment: "patch" as const,
      logger,
      packageVersion: "1.2.3",
      runner,
    };
    const code = await runRelease({ ...options, schemaMetadataWriter });
    const stamp = "schemaMetadataWriter /repo 1.2.4";
    const add = "git add src/config/schema.json";
    const amend = "git commit --amend --no-edit --no-verify";
    const push = "git push --set-upstream origin release/v1.2.4";
    const releaseItIndex = calls.findIndex((call) => call[0] === "./node_modules/.bin/release-it");
    const stampIndex = calls.findIndex((call) => call.join(" ") === stamp);
    const addIndex = calls.findIndex((call) => call.join(" ") === add);
    const amendIndex = calls.findIndex((call) => call.join(" ") === amend);
    const pushIndex = calls.findIndex((call) => call.join(" ") === push);

    assert.strictEqual(code, 0);
    assert.ok(stampIndex > releaseItIndex);
    assert.ok(addIndex > stampIndex);
    assert.ok(amendIndex > addIndex);
    assert.ok(pushIndex > amendIndex);
  });

  test("completes an interrupted local release commit before pushing", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { localBranch: true, missingReleaseSchema: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const schemaMetadataWriter: SchemaMetadataWriter = (cwd, version) => {
      calls[calls.length] = ["schemaMetadataWriter", cwd, version];
    };
    const options = {
      cwd: "/repo",
      increment: "patch" as const,
      logger,
      packageVersion: "1.2.3",
      runner,
      schemaMetadataWriter,
    };
    const code = await runRelease(options);
    const ranReleaseItCommit = calls.some(
      (call) => call[0] === "./node_modules/.bin/release-it" && call[1] === "1.2.4",
    );

    assert.strictEqual(code, 0);
    assertContainsEqual(calls, ["schemaMetadataWriter", "/repo", "1.2.4"]);
    assertContainsEqual(calls, ["git", "add", "src/config/schema.json"]);
    assertContainsEqual(calls, ["git", "commit", "--amend", "--no-edit", "--no-verify"]);
    assert.strictEqual(ranReleaseItCommit, false);
  });

  test("fails before version files change when repository auto-merge is disabled", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl, { autoMergeDisabled: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, 'enable "Allow auto-merge" on yowainwright/codependence');
    const releaseItCall = calls.find((call) => call[0] === "./node_modules/.bin/release-it");
    assert.strictEqual(releaseItCall, undefined);
  });

  test("checks repository auto-merge before resolving the release version", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl);
    const code = await runRelease({ increment: "patch", logger, runner });
    const preflight = "gh api repos/yowainwright/codependence --jq .allow_auto_merge";
    const releaseVersion = "./node_modules/.bin/release-it --release-version";
    const preflightIndex = calls.findIndex((call) => call.join(" ") === preflight);
    const releaseVersionIndex = calls.findIndex((call) =>
      call.join(" ").startsWith(releaseVersion),
    );
    assert.strictEqual(code, 0);
    assert.ok(preflightIndex > -1);
    assert.ok(releaseVersionIndex > preflightIndex);
  });

  test("queues auto-merge while release requirements are pending", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { pendingRequirements: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const code = await runRelease({ increment: "patch", logger, pollIntervalMs: 0, runner });
    const mergeCall = [
      "gh",
      "pr",
      "merge",
      "--auto",
      "--squash",
      "--delete-branch",
      "--match-head-commit",
      MERGE_COMMIT,
      prUrl,
    ];
    assert.strictEqual(code, 0);
    assertContainsEqual(calls, mergeCall);
  });

  test("rejects conflicted release PRs before queueing auto-merge", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { dirtyPullRequest: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Release PR has merge conflicts");
    const mergeCall = calls.find((call) => call[0] === "gh" && call.includes("merge"));
    assert.strictEqual(mergeCall, undefined);
  });

  test("resumes an existing release PR", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, localBranch: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const code = await runRelease({ increment: "patch", logger, runner });
    const createBranch = ["git", "switch", "--create", "release/v1.2.4"];
    assert.strictEqual(code, 0);
    assertCalledWith(logger.log, `Resuming ${prUrl}`);
    assertNotContainsEqual(calls, createBranch);
  });

  test("fetches a missing local branch before resuming an existing PR", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl, { existingPullRequest: true });
    const code = await runRelease({ increment: "patch", logger, runner });
    const source = "refs/heads/release/v1.2.4";
    assert.strictEqual(code, 0);
    assertContainsEqual(calls, ["git", "fetch", "origin", `${source}:${source}`]);
  });

  test("rejects an existing PR whose head changed", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, localBranch: true, mismatchedPullRequest: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Release PR head does not match");
  });

  test("rejects an existing release commit with unrelated files", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, extraReleaseFile: true, localBranch: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unverified release files");
  });

  test("rejects unrelated package changes in an existing release commit", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, localBranch: true, mismatchedReleaseDiff: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unverified release diff");
  });

  test("opens a PR for an already-pushed release branch", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { remoteBranch: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const code = await runRelease({ increment: "patch", logger, runner });
    const createBranch = ["git", "switch", "--create", "release/v1.2.4"];
    const createdPullRequest = calls.some((call) => call[0] === "gh" && call[1] === "pr");
    assert.strictEqual(code, 0);
    assertNotContainsEqual(calls, createBranch);
    assert.strictEqual(createdPullRequest, true);
  });

  test("rejects unrelated files in an already-merged release", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { extraMergedFile: true, mergedVersion: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const options = { increment: "patch" as const, logger, packageVersion: "1.2.3", runner };
    const release = runRelease(options);
    await assertRejects(release, "Unverified release files");
  });

  test("rejects unrelated package changes in a merged release PR", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { mergedPullRequest: true, mismatchedMergedDiff: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unverified release diff");
  });

  test("rejects a merged release outside the first-parent history", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { mergedVersion: true, mismatchedMergedAncestry: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const options = { increment: "patch" as const, logger, packageVersion: "1.2.3", runner };
    const release = runRelease(options);
    await assertRejects(release, "Unverified release ancestry");
  });

  test("rejects unexpected refs on a merged release PR", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { mergedPullRequest: true, mismatchedMergedRefs: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await assertRejects(release, "Unverified release PR");
  });

  test("retries an unpushed local release branch", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { localBranch: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const code = await runRelease({ increment: "patch", logger, runner });
    const push = ["git", "push", "--set-upstream", "origin", "release/v1.2.4"];
    assert.strictEqual(code, 0);
    assertContainsEqual(calls, ["git", "switch", "release/v1.2.4"]);
    assertContainsEqual(calls, push);
  });

  test("retries a merged release whose tag push failed", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl, { mergedVersion: true });
    const options = { increment: "patch" as const, logger, packageVersion: "1.2.3", runner };
    const code = await runRelease(options);
    const tag = ["git", "tag", "--annotate", "v1.2.3", "--message", "Release 1.2.3", MERGE_COMMIT];
    const ranReleaseIt = calls.some((call) => call[0] === "./node_modules/.bin/release-it");
    assert.strictEqual(code, 0);
    assertContainsEqual(calls, tag);
    assert.strictEqual(ranReleaseIt, false);
  });
});
