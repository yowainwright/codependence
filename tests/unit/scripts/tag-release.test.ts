import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith, assertContainsEqual, assertNotContainsEqual, assertThrows } from "../../helpers/assertions";
import {
  assertMissingTag,
  assertReleaseReady,
  formatTagName,
  parseTagArgs,
  runReleaseTag,
  type GitResult,
} from "../../../scripts/release";
import { READY_GIT_OVERRIDES } from "./constants";

const ok = (stdout = ""): GitResult => ({ status: 0, stdout, stderr: "" });
const missing = (): GitResult => ({ status: 2, stdout: "", stderr: "" });
const fail = (stderr: string): GitResult => ({ status: 1, stdout: "", stderr });

function createGit(overrides: Record<string, GitResult> = {}) {
  let calls: string[][] = [];
  const git = mock.fn((args: readonly string[]) => {
    const key = args.join(" ");
    calls = calls.concat([Array.from(args)]);
    return overrides[key] ?? ok("");
  });
  return { calls: () => calls, git };
}

describe("scripts/release tag", () => {
  test("parseArgs detects dry run", () => {
    assert.deepStrictEqual((parseTagArgs(["--dry-run"])), { dryRun: true });
    assert.deepStrictEqual((parseTagArgs([])), { dryRun: false });
  });

  test("formatTagName formats semver release tags", () => {
    assert.strictEqual((formatTagName("1.2.3")), "v1.2.3");
    assert.strictEqual((formatTagName("1.2.3-beta.6")), "v1.2.3-beta.6");
  });

  test("formatTagName rejects invalid versions", () => {
    assertThrows((() => formatTagName("beta")), "Invalid package version");
  });

  test("assertMissingTag rejects existing local tags", () => {
    const { git } = createGit({
      "rev-parse -q --verify refs/tags/v1.2.3": ok("v1.2.3\n"),
    });

    assertThrows((() => assertMissingTag(git, "v1.2.3")), "Local tag already exists");
  });

  test("assertReleaseReady requires main", () => {
    const { git } = createGit({ "branch --show-current": ok("feature\n") });

    assertThrows((() => assertReleaseReady(git, "v1.2.3")), "Release tags must be created from main");
  });

  test("assertReleaseReady can skip the upstream comparison", () => {
    const { calls, git } = createGit({
      "branch --show-current": ok("main\n"),
      "status --short": ok(""),
      "fetch origin main --tags": ok(""),
      "rev-parse -q --verify refs/tags/v1.2.3": fail("missing"),
      "ls-remote --exit-code --tags origin refs/tags/v1.2.3": missing(),
    });

    assert.doesNotThrow((() => assertReleaseReady(git, "v1.2.3", { requireUpstream: false })));
    assertNotContainsEqual((calls()), ["rev-parse", "HEAD"]);
  });

  test("runReleaseTag dry run validates without creating a tag", () => {
    const logger = { log: mock.fn(() => {}), error: mock.fn(() => {}) };
    const { calls, git } = createGit(READY_GIT_OVERRIDES);

    const code = runReleaseTag({ dryRun: true, git, logger, version: "1.2.3-beta.6" });

    assert.strictEqual((code), 0);
    assertCalledWith((logger.log), "Dry run: would create and push v1.2.3-beta.6");
    assert.strictEqual((calls().some((call) => call[0] === "tag" && call[1] === "--annotate")), false);
  });

  test("runReleaseTag creates and pushes the version tag", () => {
    const logger = { log: mock.fn(() => {}), error: mock.fn(() => {}) };
    const { calls, git } = createGit(READY_GIT_OVERRIDES);

    const code = runReleaseTag({ git, logger, version: "1.2.3-beta.6" });

    assert.strictEqual((code), 0);
    assertContainsEqual((calls()), [
      "tag",
      "--annotate",
      "v1.2.3-beta.6",
      "--message",
      "Release 1.2.3-beta.6",
    ]);
    assertContainsEqual((calls()), ["push", "origin", "refs/tags/v1.2.3-beta.6"]);
  });

  test("runReleaseTag tags the verified merge commit", () => {
    const targetCommit = "a".repeat(40);
    const logger = { log: mock.fn(() => {}), error: mock.fn(() => {}) };
    const overrides = Object.assign({}, READY_GIT_OVERRIDES, {
      [`merge-base --is-ancestor ${targetCommit} origin/main`]: ok(),
      "rev-parse -q --verify refs/tags/v1.2.3": fail("missing"),
      "ls-remote --exit-code --tags origin refs/tags/v1.2.3": missing(),
    });
    const { calls, git } = createGit(overrides);
    const options = { git, logger, targetCommit, version: "1.2.3" };
    assert.strictEqual((runReleaseTag(options)), 0);
    assertContainsEqual((calls()), [
      "tag",
      "--annotate",
      "v1.2.3",
      "--message",
      "Release 1.2.3",
      targetCommit,
    ]);
  });

  test("runReleaseTag deletes the local tag when push fails", () => {
    const { calls, git } = createGit(
      Object.assign({}, READY_GIT_OVERRIDES, {
        "push origin refs/tags/v1.2.3-beta.6": fail("push rejected"),
      }),
    );

    assertThrows((() => runReleaseTag({ git, version: "1.2.3-beta.6" })), "push rejected");
    assertContainsEqual((calls()), ["tag", "--delete", "v1.2.3-beta.6"]);
  });
});
