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
});
