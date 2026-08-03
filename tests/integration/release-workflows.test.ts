import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readWorkflow = (name: string): string =>
  readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");

const readScript = (name: string): string =>
  readFileSync(new URL(`../../scripts/${name}`, import.meta.url), "utf8");

describe("release workflows", () => {
  test("passes the stable release tag to Homebrew", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const publish = readWorkflow("publish.yml");
    expect(homebrew).toContain("Stable release tag to publish to Homebrew");
    expect(publish).toContain('uses: "./.github/workflows/homebrew.yml"');
    expect(publish).toContain("version: ${{ github.ref_name }}");
  });

  test("keeps stable releases draft until Homebrew succeeds", () => {
    const publish = readWorkflow("publish.yml");
    const homebrew = readWorkflow("homebrew.yml");
    const attach = homebrew.indexOf("- name: Attach formula to GitHub release");
    const tap = homebrew.indexOf("- name: Update Homebrew tap");
    const release = homebrew.indexOf("- name: Publish GitHub release");
    expect(publish).toContain("RELEASE_ARGS+=(--draft)");
    expect(attach).toBeGreaterThan(-1);
    expect(tap).toBeGreaterThan(attach);
    expect(release).toBeGreaterThan(tap);
  });

  test("uses current release tooling when retrying old tags", () => {
    const homebrew = readWorkflow("homebrew.yml");
    expect(homebrew).toContain('ref: "${{ github.workflow_sha }}"');
    expect(homebrew).toContain("sparse-checkout: scripts/upload-release-assets.sh");
  });

  test("verifies a release tag before running repository code", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const verify = homebrew.indexOf("- name: Verify release tag");
    const setup = homebrew.indexOf("- name: Setup toolchain");
    expect(homebrew).toContain('ref: "refs/tags/${{ inputs.version }}"');
    expect(homebrew).toContain('gh release view "$RELEASE_REF"');
    expect(verify).toBeGreaterThan(-1);
    expect(setup).toBeGreaterThan(verify);
  });

  test("audits the npm-backed formula before and after npm publication", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const publish = readWorkflow("publish.yml");
    expect(publish).toContain("Generate formula from packed tarball");
    expect(publish).toContain("brew audit --strict --formula");
    expect(homebrew).toContain("Generate formula from published tarball");
    expect(homebrew).toContain("brew audit --strict --online");
  });

  test("tests the exact published release", () => {
    const releaseTest = readWorkflow("test-release.yml");
    expect(releaseTest).toContain("inputs.version || github.event.release.tag_name");
  });

  test("publishes release assets immutably", () => {
    const files = [
      readWorkflow("homebrew.yml"),
      readWorkflow("publish.yml"),
      readScript("upload-release-assets.sh"),
    ];
    files.forEach((file) => expect(file).not.toContain("--clobber"));
    expect(files.at(-1)).toContain("Release asset digest mismatch");
  });

  test("configures tap push authentication before cloning", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const auth = homebrew.indexOf("gh auth setup-git --hostname github.com --force");
    const clone = homebrew.indexOf("gh repo clone yowainwright/homebrew-tap tap");
    expect(auth).toBeGreaterThan(-1);
    expect(clone).toBeGreaterThan(auth);
  });
});
