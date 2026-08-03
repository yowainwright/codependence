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
const missing = (): GitResult => ({ status: 2, stdout: "", stderr: "" });

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

function releaseFlowResult(key: string, prUrl: string): GitResult {
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

function createReleaseFlowRunner(prUrl: string) {
  const calls: string[][] = [];
  const runner = mock<ReleaseRunner>((command, args) => {
    const call = [command, ...Array.from(args)];
    calls.push(call);
    return releaseFlowResult(call.join(" "), prUrl);
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
    const mergeCall = ["gh", "pr", "merge", "--squash", "--delete-branch", prUrl];
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
});
