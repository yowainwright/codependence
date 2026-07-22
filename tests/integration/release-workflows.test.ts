import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readWorkflow = (name: string): string =>
  readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");

describe("release workflows", () => {
  test("publishes stable releases to Homebrew", () => {
    const homebrew = readWorkflow("homebrew.yml");
    const publish = readWorkflow("publish.yml");

    expect(homebrew).toContain("workflow_call:");
    expect(publish).toContain('uses: "./.github/workflows/homebrew.yml"');
    expect(publish).toContain("version: ${{ needs.publish.outputs.release-version }}");
  });

  test("publishes the verified formula through the protected environment", () => {
    const homebrew = readWorkflow("homebrew.yml");

    expect(homebrew).toContain("environment: homebrew-publish");
    expect(homebrew).toContain("secrets.HOMEBREW_TAP_TOKEN");
    expect(homebrew).toContain("gh pr create");
  });

  test("does not overwrite release assets", () => {
    const releaseFiles = [
      readWorkflow("homebrew.yml"),
      readWorkflow("publish.yml"),
      readFileSync(new URL("../../scripts/ci/publish-release.js", import.meta.url), "utf8"),
    ];

    releaseFiles.forEach((file) => expect(file).not.toContain("--clobber"));
  });
});
