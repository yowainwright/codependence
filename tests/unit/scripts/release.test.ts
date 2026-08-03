import { describe, expect, mock, test } from "bun:test";
import {
  buildCurrentVersionTagPlan,
  buildReleaseItArgs,
  buildReleasePlan,
  formatReleasePlan,
  incrementPreReleaseVersion,
  incrementStableVersion,
  parseArgs,
  parseReleaseVersion,
  releaseTagExists,
  resolveAvailableReleaseVersion,
  runRelease,
  type ReleaseRunner,
} from "../../../scripts/release";
import type { GitResult } from "../../../scripts/tag-release";

const MERGE_COMMIT = "a".repeat(40);
const ok = (stdout = ""): GitResult => ({ status: 0, stdout, stderr: "" });
const absent = (): GitResult => ({ status: 1, stdout: "", stderr: "" });
const missing = (): GitResult => ({ status: 2, stdout: "", stderr: "" });

interface ReleaseFlowState {
  extraReleaseFile?: boolean;
  existingPullRequest?: boolean;
  localBranch?: boolean;
  mergedVersion?: boolean;
  mismatchedPullRequest?: boolean;
  mismatchedReleaseDiff?: boolean;
  remoteBranch?: boolean;
}

function createRunner(overrides: Record<string, GitResult> = {}) {
  const calls: string[][] = [];
  const runner = mock<ReleaseRunner>((command, args) => {
    const call = [command, ...Array.from(args)];
    calls.push(call);
    return overrides[call.join(" ")] ?? ok();
  });
  return { calls, runner };
}

function createLogger() {
  return { error: mock(() => {}), log: mock(() => {}), warn: mock(() => {}) };
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
): GitResult | undefined {
  if (key.startsWith("gh pr list --head release/v1.2.4")) {
    const headRefOid = state.mismatchedPullRequest ? "b".repeat(40) : MERGE_COMMIT;
    const pullRequest = {
      baseRefName: "main",
      headRefName: "release/v1.2.4",
      headRefOid,
      state: "OPEN",
      url: prUrl,
    };
    const pullRequests = state.existingPullRequest ? [pullRequest] : [];
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
    const changedFiles = state.extraReleaseFile ? "package.json\nsrc/index.ts\n" : "package.json\n";
    return ok(changedFiles);
  }
  if (key === "git diff --unified=0 origin/main release/v1.2.4 -- package.json") {
    if (state.mismatchedReleaseDiff) {
      return ok('-  "version": "1.2.3",\n+  "version": "1.2.4",\n+  "private": false,\n');
    }
    return ok('-  "version": "1.2.3",\n+  "version": "1.2.4",\n');
  }
  return undefined;
}

function releaseFlowResult(key: string, prUrl: string, state: ReleaseFlowState): GitResult {
  const mergedResult = mergedVersionResult(key, prUrl, state);
  if (mergedResult) return mergedResult;
  const branchResult = releaseBranchResult(key, prUrl, state);
  if (branchResult) return branchResult;
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

function createReleaseFlowRunner(prUrl: string, state: ReleaseFlowState = {}) {
  const calls: string[][] = [];
  const runner = mock<ReleaseRunner>((command, args) => {
    const call = [command, ...Array.from(args)];
    calls.push(call);
    return releaseFlowResult(call.join(" "), prUrl, state);
  });
  return { calls, runner };
}

describe("scripts/release arguments", () => {
  test("reads explicit stable release options", () => {
    expect(parseArgs(["--increment=minor", "--dry-run", "--timeout-minutes=15"])).toEqual({
      dryRun: true,
      increment: "minor",
      timeoutMinutes: 15,
    });
  });

  test("rejects unsafe and invalid options", () => {
    expect(() => parseArgs(["--no-wait"])).toThrow("cannot safely tag");
    expect(() => parseArgs(["--increment=nightly"])).toThrow("Invalid release increment");
    expect(() => parseArgs(["--timeout-minutes=0"])).toThrow("Invalid timeout");
  });

  test("builds non-publishing release-it arguments", () => {
    expect(buildReleaseItArgs({ increment: "patch" })).toEqual([
      "--increment=patch",
      "--git.tag=false",
      "--git.push=false",
      "--git.requireUpstream=false",
      "--git.getLatestTagFromAllRefs=true",
      "--ci",
    ]);
  });

  test("reads release-it version output", () => {
    expect(parseReleaseVersion("codependence 1.2.3 to 1.2.4-beta.6")).toBe("1.2.4-beta.6");
  });
});

describe("scripts/release plans", () => {
  test("describes the release PR gate", () => {
    const plan = buildReleasePlan("1.2.4");
    const output = formatReleasePlan(plan);
    expect(plan.branch).toBe("release/v1.2.4");
    expect(plan.pullRequestTitle).toBe("chore(release): v1.2.4");
    expect(output).toContain("wait for required checks");
    expect(output).toContain("squash-merge the release PR");
  });

  test("describes tagging an existing prerelease package version", () => {
    const plan = buildCurrentVersionTagPlan("1.2.4-beta.2");
    expect(plan.commands).toContain("git push origin refs/tags/v1.2.4-beta.2");
  });
});

describe("scripts/release versions", () => {
  test("advances stable and prerelease versions", () => {
    expect(incrementStableVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(incrementStableVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(incrementStableVersion("1.2.3", "major")).toBe("2.0.0");
    expect(incrementPreReleaseVersion("1.2.4-beta.7", "beta")).toBe("1.2.4-beta.8");
  });

  test("checks local and remote tags", () => {
    const { runner } = createRunner({
      "git rev-parse -q --verify refs/tags/v1.2.4": missing(),
      "git ls-remote --tags origin refs/tags/v1.2.4": ok("abc refs/tags/v1.2.4\n"),
    });
    expect(releaseTagExists(runner, "v1.2.4")).toBe(true);
  });

  test("skips occupied stable release tags", () => {
    const { runner } = createRunner({
      "git rev-parse -q --verify refs/tags/v1.2.4": ok("abc\n"),
      "git rev-parse -q --verify refs/tags/v1.2.5": missing(),
      "git ls-remote --tags origin refs/tags/v1.2.5": ok(),
    });
    const args = { dryRun: true, increment: "patch" as const, timeoutMinutes: 90 };
    expect(resolveAvailableReleaseVersion(runner, args, "1.2.4")).toBe("1.2.5");
  });
});

describe("scripts/release flow", () => {
  test("requires an explicit stable increment", async () => {
    const { runner } = createRunner(readyMain);
    const options = { packageVersion: "1.2.3", runner };
    const release = runRelease(options);
    await expect(release).rejects.toThrow("explicit increment");
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
    const expected = expect.stringContaining("git push origin refs/tags/v1.2.4-beta.2");
    expect(code).toBe(0);
    expect(logger.log).toHaveBeenCalledWith(expected);
  });

  test("merges the release PR before tagging its merge commit", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl);
    const code = await runRelease({ increment: "patch", logger, runner });
    const mergeCall = [
      "gh",
      "pr",
      "merge",
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
    expect(code).toBe(0);
    expect(calls).toContainEqual(mergeCall);
    expect(calls).toContainEqual(tagCall);
  });

  test("resumes an existing release PR", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, localBranch: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const code = await runRelease({ increment: "patch", logger, runner });
    const createBranch = ["git", "switch", "--create", "release/v1.2.4"];
    expect(code).toBe(0);
    expect(logger.log).toHaveBeenCalledWith(`Resuming ${prUrl}`);
    expect(calls).not.toContainEqual(createBranch);
  });

  test("rejects an existing PR without its generated local branch", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { runner } = createReleaseFlowRunner(prUrl, { existingPullRequest: true });
    const release = runRelease({ increment: "patch", logger, runner });
    await expect(release).rejects.toThrow("Cannot verify release/v1.2.4");
  });

  test("rejects an existing PR whose head changed", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, localBranch: true, mismatchedPullRequest: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await expect(release).rejects.toThrow("Release PR head does not match");
  });

  test("rejects an existing release commit with unrelated files", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, extraReleaseFile: true, localBranch: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await expect(release).rejects.toThrow("Unverified release files");
  });

  test("rejects unrelated package changes in an existing release commit", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { existingPullRequest: true, localBranch: true, mismatchedReleaseDiff: true };
    const { runner } = createReleaseFlowRunner(prUrl, state);
    const release = runRelease({ increment: "patch", logger, runner });
    await expect(release).rejects.toThrow("Unverified release diff");
  });

  test("opens a PR for an already-pushed release branch", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { localBranch: true, remoteBranch: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const code = await runRelease({ increment: "patch", logger, runner });
    const createBranch = ["git", "switch", "--create", "release/v1.2.4"];
    const createdPullRequest = calls.some((call) => call[0] === "gh" && call[1] === "pr");
    expect(code).toBe(0);
    expect(calls).not.toContainEqual(createBranch);
    expect(createdPullRequest).toBe(true);
  });

  test("retries an unpushed local release branch", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const state = { localBranch: true };
    const { calls, runner } = createReleaseFlowRunner(prUrl, state);
    const code = await runRelease({ increment: "patch", logger, runner });
    const push = ["git", "push", "--set-upstream", "origin", "release/v1.2.4"];
    expect(code).toBe(0);
    expect(calls).toContainEqual(["git", "switch", "release/v1.2.4"]);
    expect(calls).toContainEqual(push);
  });

  test("retries a merged release whose tag push failed", async () => {
    const prUrl = "https://github.com/yowainwright/codependence/pull/300";
    const logger = createLogger();
    const { calls, runner } = createReleaseFlowRunner(prUrl, { mergedVersion: true });
    const options = { increment: "patch" as const, logger, packageVersion: "1.2.3", runner };
    const code = await runRelease(options);
    const tag = ["git", "tag", "--annotate", "v1.2.3", "--message", "Release 1.2.3", MERGE_COMMIT];
    const ranReleaseIt = calls.some((call) => call[0] === "./node_modules/.bin/release-it");
    expect(code).toBe(0);
    expect(calls).toContainEqual(tag);
    expect(ranReleaseIt).toBe(false);
  });
});
