import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readWorkflow = (name: string): string =>
  readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");

const readScript = (name: string): string =>
  readFileSync(new URL(`../../scripts/${name}`, import.meta.url), "utf8");

describe("release workflows", () => {
  test("passes the stable release tag to Homebrew", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const publish = readWorkflow("publish.yml");
    assert.ok(homebrew.includes("Stable release tag to publish to Homebrew"));
    assert.ok(!homebrew.includes("environment: homebrew-publish"));
    assert.ok(publish.includes('uses: "./.github/workflows/homebrew.yml"'));
    assert.ok(publish.includes("version: ${{ github.ref_name }}"));
  });

  test("validates Homebrew tap access before npm publication", () => {
    const publish = readWorkflow("publish.yml");
    const token = publish.indexOf("- name: Validate Homebrew tap token");
    const npm = publish.indexOf("- name: Publish npm package");
    assert.ok(token > -1);
    assert.ok(npm > token);
    assert.ok(publish.includes("HOMEBREW_TAP_TOKEN is required for stable releases"));
    assert.ok(publish.includes("gh api repos/yowainwright/homebrew-tap"));
    assert.ok(publish.includes("must have write access to yowainwright/homebrew-tap"));
  });

  test("validates Homebrew tap access before Homebrew release work", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const verify = homebrew.indexOf("- name: Verify release tag");
    const token = homebrew.indexOf("- name: Validate Homebrew tap token");
    const build = homebrew.indexOf("- name: Build and test binary");
    const attach = homebrew.indexOf("- name: Attach Homebrew assets to GitHub release");
    assert.ok(token > verify);
    assert.ok(build > token);
    assert.ok(attach > token);
    assert.ok(homebrew.includes("HOMEBREW_TAP_TOKEN is required for Homebrew publishing"));
    assert.ok(homebrew.includes("gh api repos/yowainwright/homebrew-tap"));
  });

  test("keeps stable releases draft until Homebrew succeeds", () => {
    const publish = readWorkflow("publish.yml");
    const homebrew = readWorkflow("homebrew.yml");
    const tap = homebrew.indexOf("- name: Update Homebrew tap");
    const attach = homebrew.indexOf("- name: Attach Homebrew assets to GitHub release");
    const release = homebrew.indexOf("- name: Publish GitHub release");
    assert.ok(publish.includes("RELEASE_ARGS+=(--draft)"));
    assert.ok(tap > -1);
    assert.ok(attach > tap);
    assert.ok(release > attach);
  });

  test("skips stale and already published Homebrew releases", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const state = homebrew.indexOf("- name: Check Homebrew release state");
    const wait = homebrew.indexOf("- name: Wait for npm package availability");
    const build = homebrew.indexOf("- name: Build and test binary");
    assert.ok(state > -1);
    assert.ok(wait > state);
    assert.ok(build > state);
    assert.ok(homebrew.includes("nub release-tools/scripts/release/brew/index.ts check-state"));
    assert.ok(homebrew.includes("steps.homebrew-state.outputs.skip != 'true'"));
  });

  test("uses current release tooling when retrying old tags", () => {
    const homebrew = readWorkflow("homebrew.yml");
    assert.ok(homebrew.includes('ref: "${{ github.workflow_sha }}"'));
    assert.ok(homebrew.includes("scripts/upload-release-assets.sh"));
    assert.ok(homebrew.includes("scripts/release/brew/*"));
    assert.ok(homebrew.includes("src/observability/*"));
    assert.ok(homebrew.includes("src/dx/constants.ts"));
    assert.ok(homebrew.includes("src/dx/output/*"));
    assert.ok(homebrew.includes("src/dx/report/constants.ts"));
  });

  test("verifies a release tag before running repository code", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const verify = homebrew.indexOf("- name: Verify release tag");
    const setup = homebrew.indexOf("- name: Setup toolchain");
    assert.ok(homebrew.includes('ref: "refs/tags/${{ inputs.version }}"'));
    assert.ok(homebrew.includes('gh release view "$RELEASE_REF"'));
    assert.ok(verify > -1);
    assert.ok(setup > verify);
  });

  test("audits the npm-backed formula before and after npm publication", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const publish = readWorkflow("publish.yml");
    assert.ok(publish.includes("Generate formula from packed tarball"));
    assert.ok(publish.includes("brew audit --strict --formula"));
    assert.ok(homebrew.includes("Generate formula from published tarball"));
    assert.ok(homebrew.includes("brew audit --strict --online"));
  });

  test("tests the exact published release", () => {
    const releaseTest = readWorkflow("test-release.yml");
    assert.ok(releaseTest.includes("inputs.version || github.event.release.tag_name"));
  });

  test("publishes release assets immutably", () => {
    const files = [
      readWorkflow("homebrew.yml"),
      readWorkflow("publish.yml"),
      readScript("upload-release-assets.sh"),
    ];
    files.forEach((file) => assert.ok(!file.includes("--clobber")));
    assert.ok(files.at(-1).includes("Release asset digest mismatch"));
    assert.ok(files.at(-1).includes("Release attestation subject digest mismatch"));
  });

  test("updates the Homebrew tap through the REST API", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const brewScript = readScript("release/brew/utils.ts");
    assert.ok(homebrew.includes("nub release-tools/scripts/release/brew/index.ts update-tap"));
    assert.ok(homebrew.includes("TAP_BRANCH: codependence-release"));
    assert.ok(brewScript.includes("git/ref/heads/${branch}"));
    assert.ok(brewScript.includes("repos/${repository}/pulls"));
    assert.ok(!homebrew.includes("gh auth setup-git"));
    assert.ok(!homebrew.includes("gh repo clone"));
    assert.ok(!homebrew.includes("gh pr create"));
    assert.ok(!homebrew.includes("git push"));
  });

  test("keeps the Homebrew tap PR as a reviewed path", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const brewScript = readScript("release/brew/utils.ts");
    assert.ok(!homebrew.includes("gh pr merge --auto"));
    assert.ok(!brewScript.includes("allow_auto_merge"));
    assert.ok(brewScript.includes("Automated formula update."));
  });
});
