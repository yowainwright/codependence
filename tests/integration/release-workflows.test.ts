import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readWorkflow = (name: string): string =>
  readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");

const workflowStepPositions = (workflow: string): Map<string, number> =>
  new Map(workflow.split("\n").map((line, index) => [line.trim(), index]));

const readScript = (name: string): string =>
  readFileSync(new URL(`../../scripts/${name}`, import.meta.url), "utf8");

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("release workflows", () => {
  test("passes the stable release tag to Homebrew", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const publish = readWorkflow("publish.yml");
    assert.match(homebrew, /Stable release tag to publish to Homebrew/);
    assert.doesNotMatch(homebrew, /environment: homebrew-publish/);
    assert.match(publish, /uses: "\.\/\.github\/workflows\/homebrew\.yml"/);
    assert.match(publish, /version: \$\{\{ github\.ref_name \}\}/);
  });

  test("validates Homebrew tap access before npm publication", () => {
    const publish = readWorkflow("publish.yml");
    const steps = workflowStepPositions(publish);
    const token = steps.get("- name: Validate Homebrew tap token") ?? -1;
    const npm = steps.get("- name: Publish npm package") ?? -1;
    assert.ok(token > -1);
    assert.ok(npm > token);
    assert.match(publish, /HOMEBREW_TAP_TOKEN is required for stable releases/);
    assert.match(publish, /gh api repos\/yowainwright\/homebrew-tap/);
    assert.match(publish, /must have write access to yowainwright\/homebrew-tap/);
  });

  test("validates Homebrew tap access before Homebrew release work", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const steps = workflowStepPositions(homebrew);
    const verify = steps.get("- name: Verify release tag") ?? -1;
    const token = steps.get("- name: Validate Homebrew tap token") ?? -1;
    const build = steps.get("- name: Build and test binary") ?? -1;
    const attach = steps.get("- name: Attach Homebrew assets to GitHub release") ?? -1;
    assert.ok(token > verify);
    assert.ok(build > token);
    assert.ok(attach > token);
    assert.match(homebrew, /HOMEBREW_TAP_TOKEN is required for Homebrew publishing/);
    assert.match(homebrew, /gh api repos\/yowainwright\/homebrew-tap/);
  });

  test("keeps stable releases draft until Homebrew succeeds", () => {
    const publish = readWorkflow("publish.yml");
    const homebrew = readWorkflow("homebrew.yml");
    const steps = workflowStepPositions(homebrew);
    const tap = steps.get("- name: Update Homebrew tap") ?? -1;
    const attach = steps.get("- name: Attach Homebrew assets to GitHub release") ?? -1;
    const release = steps.get("- name: Publish GitHub release") ?? -1;
    assert.match(publish, /RELEASE_ARGS\+=\(--draft\)/);
    assert.ok(tap > -1);
    assert.ok(attach > tap);
    assert.ok(release > attach);
  });

  test("skips stale and already published Homebrew releases", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const steps = workflowStepPositions(homebrew);
    const state = steps.get("- name: Check Homebrew release state") ?? -1;
    const wait = steps.get("- name: Wait for npm package availability") ?? -1;
    const build = steps.get("- name: Build and test binary") ?? -1;
    assert.ok(state > -1);
    assert.ok(wait > state);
    assert.ok(build > state);
    assert.match(homebrew, /nub release-tools\/scripts\/release\/index\.ts brew check-state/);
    assert.match(homebrew, /steps\.homebrew-state\.outputs\.skip != 'true'/);
  });

  test("uses current release tooling when retrying old tags", () => {
    const homebrew = readWorkflow("homebrew.yml");
    assert.match(homebrew, /ref: "\$\{\{ github\.workflow_sha \}\}"/);
    assert.match(homebrew, /scripts\/release\/\*/);
    assert.match(homebrew, /scripts\/ci\/tool-versions\.js/);
    assert.match(homebrew, /src\/observability\/\*/);
    assert.match(homebrew, /src\/dx\/constants\.ts/);
    assert.match(homebrew, /src\/dx\/output\/\*/);
    assert.match(homebrew, /src\/dx\/report\/constants\.ts/);
  });

  test("verifies a release tag before running repository code", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const steps = workflowStepPositions(homebrew);
    const verify = steps.get("- name: Verify release tag") ?? -1;
    const setup = steps.get("- name: Setup toolchain") ?? -1;
    assert.match(homebrew, /ref: "refs\/tags\/\$\{\{ inputs\.version \}\}"/);
    assert.match(homebrew, /gh release view "\$RELEASE_REF"/);
    assert.ok(verify > -1);
    assert.ok(setup > verify);
  });

  test("audits the npm-backed formula before and after npm publication", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const publish = readWorkflow("publish.yml");
    assert.match(publish, /Generate formula from packed tarball/);
    assert.match(publish, /brew audit --strict --formula/);
    assert.match(homebrew, /Generate formula from published tarball/);
    assert.match(homebrew, /brew audit --strict --online/);
  });

  test("tests the exact published release", () => {
    const releaseTest = readWorkflow("test-release.yml");
    assert.match(releaseTest, /inputs\.version \|\| github\.event\.release\.tag_name/);
    assert.match(releaseTest, /nub scripts\/release\/index\.ts test-published/);
  });

  test("publishes release assets immutably", () => {
    const files = [
      readWorkflow("homebrew.yml"),
      readWorkflow("publish.yml"),
      readScript("release/utils.ts"),
    ];
    files.forEach((file) => assert.doesNotMatch(file, /--clobber/));
    assert.match(files.at(-1), /Release asset digest mismatch/);
    assert.match(files.at(-1), /Release attestation subject digest mismatch/);
  });

  test("updates the Homebrew tap through the REST API", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const brewScript = readScript("release/utils.ts");
    assert.match(homebrew, /nub release-tools\/scripts\/release\/index\.ts brew update-tap/);
    assert.match(homebrew, /TAP_BRANCH: codependence-release/);
    assert.match(brewScript, /git\/ref\/heads\/\$\{branch\}/);
    assert.match(brewScript, /repos\/\$\{repository\}\/pulls/);
    assert.doesNotMatch(homebrew, /gh auth setup-git/);
    assert.doesNotMatch(homebrew, /gh repo clone/);
    assert.doesNotMatch(homebrew, /gh pr create/);
    assert.doesNotMatch(homebrew, /git push/);
  });

  test("keeps the Homebrew tap PR as a reviewed path", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const brewScript = readScript("release/utils.ts");
    assert.doesNotMatch(homebrew, /gh pr merge --auto/);
    assert.match(brewScript, /Automated formula update\./);
  });
});
