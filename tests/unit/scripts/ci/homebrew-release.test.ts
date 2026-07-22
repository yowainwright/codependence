import { describe, expect, test } from "bun:test";
import {
  githubArchiveUrl,
  renderFormula,
  validatePackageVersion,
  validateStableVersion,
} from "../../../../scripts/ci/homebrew-release.js";

describe("scripts/ci/homebrew-release", () => {
  test("builds an immutable GitHub release archive URL", () => {
    const archiveUrl = githubArchiveUrl("1.1.0");

    expect(archiveUrl).toEndWith("/v1.1.0/codependence-darwin.tar.gz");
  });

  test("accepts only stable versions", () => {
    const stableVersion = () => validateStableVersion("1.1.0");
    const prereleaseVersion = () => validateStableVersion("1.1.0-rc.0");

    expect(stableVersion).not.toThrow();
    expect(prereleaseVersion).toThrow("Invalid stable version");
  });

  test("requires the checked-out package to match the release", () => {
    const matchingVersion = () => validatePackageVersion("1.1.0", '{"version":"1.1.0"}');
    const mismatchedVersion = () => validatePackageVersion("1.1.0", '{"version":"1.0.0"}');

    expect(matchingVersion).not.toThrow();
    expect(mismatchedVersion).toThrow("Package version 1.0.0 does not match 1.1.0");
  });

  test("renders a Perry binary-backed formula", () => {
    const digest = "archive-digest";
    const version = "1.1.0";
    const options = { digest, version };
    const formula = renderFormula(options);

    expect(formula).toContain("codependence-darwin.tar.gz");
    expect(formula).toContain("codependence-darwin-arm64");
    expect(formula).toContain("codependence-darwin-x64");
    expect(formula).toContain('bin.install binary => "codependence"');
    expect(formula).not.toContain('depends_on "node"');
    expect(formula).not.toContain("registry.npmjs.org");
  });
});
