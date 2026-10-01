import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readWorkflow = (name: string): string =>
  readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");

const readScript = (name: string): string =>
  readFileSync(new URL(`../../scripts/${name}`, import.meta.url), "utf8");

const positions = (workflow: string): Map<string, number> => {
  const lines = workflow.split("\n");
  const entries = lines.map((line, index): [string, number] => [line.trim(), index]);
  return new Map(entries);
};

const homebrew = readWorkflow("homebrew.yml");
const publish = readWorkflow("publish.yml");
const homebrewSteps = positions(homebrew);
const publishSteps = positions(publish);

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("release workflows", () => {
  test("passes the stable release tag to Homebrew", () => {
    assert.match(homebrew, /Stable release tag to publish to Homebrew/);
    assert.match(publish, /uses: "\.\/\.github\/workflows\/homebrew\.yml"/);
    assert.match(publish, /version: \$\{\{ github\.ref_name \}\}/);
  });

  test("checks tap access before npm publication and binary builds", () => {
    const token = publishSteps.get("- name: Validate Homebrew tap token") ?? -1;
    const npm = publishSteps.get("- name: Publish npm package") ?? -1;
    assert.ok(token > -1 && npm > token);
    assert.match(publish, /must have write access to yowainwright\/homebrew-tap/);
    assert.match(homebrew, /preflight_only: true/);
    assert.match(homebrew, /binary:\n    needs: preflight/);
  });

  test("builds the complete standard tap matrix on native runners", () => {
    const matches = Array.from(homebrew.matchAll(/target: (\S+)/g));
    const targets = matches.map((match) => match[1]).toSorted();
    assert.deepStrictEqual(targets, ["darwin-amd64", "darwin-arm64", "linux-amd64", "linux-arm64"]);
    assert.match(homebrew, /runner: macos-14\s+target: darwin-arm64/);
    assert.match(homebrew, /runner: macos-15-intel\s+target: darwin-amd64/);
    assert.match(homebrew, /runner: ubuntu-22.04-arm\s+target: linux-arm64/);
    assert.match(homebrew, /runner: ubuntu-22.04\s+target: linux-amd64/);
    assert.match(homebrew, /nub run test:e2e:binary/);
  });

  test("verifies the release tag before running repository code", () => {
    const verify = homebrewSteps.get("- name: Verify release tag") ?? -1;
    const setup = homebrewSteps.get("- name: Setup toolchain") ?? -1;
    assert.ok(verify > -1 && setup > verify);
    assert.match(homebrew, /ref: "refs\/tags\/\$\{\{ inputs\.version \}\}"/);
    assert.match(homebrew, /gh release view "\$RELEASE_REF"/);
    assert.match(homebrew, /test "\$\{RELEASE_REF#v\}" = "\$PACKAGE_VERSION"/);
  });

  test("checks startup without runtimes and rejects external shared libraries", () => {
    assert.match(homebrew, /env -i PATH=\/nonexistent "\$PWD\/\$BINARY" --version/);
    assert.match(homebrew, /env -i PATH=\/nonexistent "\$PWD\/\$BINARY" --help/);
    assert.match(homebrew, /otool -L "\$BINARY"/);
    assert.match(homebrew, /readelf -d "\$BINARY"/);
    assert.match(homebrew, /END \{ exit bad \}/);
  });

  test("publishes all attested binaries before updating the tap", () => {
    assert.match(publish, /RELEASE_ARGS\+=\(--draft\)/);
    assert.match(homebrew, /release:\n    needs: binary/);
    const verify = homebrewSteps.get("- name: Verify complete binary matrix") ?? -1;
    const release = homebrewSteps.get("- name: Publish GitHub release") ?? -1;
    const tap = homebrewSteps.get("homebrew:") ?? -1;
    assert.ok(verify > -1 && release > verify);
    assert.ok(tap > release);
    assert.match(homebrew, /homebrew:\n    needs: release/);
    assert.match(homebrew, /grep -Fx "codependence-\$target.sigstore.json"/);
  });

  test("delegates formula generation and reviewed updates to the pinned tap workflow", () => {
    const sharedWorkflow =
      /uses: yowainwright\/homebrew-tap\/\.github\/workflows\/publish-formula.yml@[a-f0-9]{40}/g;
    const calls = Array.from(homebrew.matchAll(sharedWorkflow));
    assert.strictEqual(calls.length, 2);
    assert.doesNotMatch(
      homebrew + publish,
      /brew generate|brew update-tap|npm-backed|packed tarball/,
    );
    const release = readScript("release/utils.ts");
    assert.doesNotMatch(release, /depends_on "node"|std_npm_args|resetTapBranch/);
  });

  test("tests the exact published release", () => {
    const releaseTest = readWorkflow("test-release.yml");
    assert.match(releaseTest, /inputs\.version \|\| github\.event\.release\.tag_name/);
    assert.match(releaseTest, /nub scripts\/release\/index\.ts test-published/);
  });

  test("publishes release assets immutably", () => {
    const release = readScript("release/utils.ts");
    [homebrew, publish, release].forEach((file) => assert.doesNotMatch(file, /--clobber/));
    assert.match(release, /Release asset digest mismatch/);
    assert.match(release, /Release attestation subject digest mismatch/);
    assert.match(homebrew, /nub scripts\/release\/index.ts assets/);
  });
});
