import { describe, expect, test } from "bun:test";
import {
  buildGitHubReleaseCreateArgs,
  buildNpmPublishArgs,
  isPrereleaseVersion,
  parseNpmPackFilename,
  resolveDistTag,
  stripTagPrefix,
} from "../../../../scripts/ci/publish-release.js";

describe("scripts/ci/publish-release", () => {
  test("resolveDistTag maps prerelease identifiers", () => {
    expect(resolveDistTag("v1.0.0-alpha.1")).toBe("alpha");
    expect(resolveDistTag("v1.0.0-beta.1")).toBe("beta");
    expect(resolveDistTag("v1.0.0-rc.1")).toBe("rc");
    expect(resolveDistTag("v1.0.0")).toBe("latest");
  });

  test("parseNpmPackFilename reads npm JSON output", () => {
    expect(parseNpmPackFilename('noise\n[{"filename":"codependence-1.0.0.tgz"}]')).toBe(
      "codependence-1.0.0.tgz",
    );
  });

  test("stripTagPrefix removes a leading v only", () => {
    expect(stripTagPrefix("v1.0.0")).toBe("1.0.0");
    expect(stripTagPrefix("1.0.0")).toBe("1.0.0");
  });

  test("buildNpmPublishArgs creates provenance publish args", () => {
    expect(buildNpmPublishArgs({ distTag: "latest", tarball: "codependence.tgz" })).toEqual([
      "publish",
      "codependence.tgz",
      "--provenance",
      "--access",
      "public",
      "--tag",
      "latest",
    ]);
  });

  test("buildGitHubReleaseCreateArgs marks prereleases", () => {
    expect(
      buildGitHubReleaseCreateArgs({
        sigstoreBundle: "codependence.tgz.sigstore.json",
        tarball: "codependence.tgz",
        version: "v1.0.0-beta.1",
      }),
    ).toContain("--prerelease");
  });

  test("isPrereleaseVersion recognizes supported prerelease names", () => {
    expect(isPrereleaseVersion("v1.0.0-beta.1")).toBe(true);
    expect(isPrereleaseVersion("v1.0.0-next.1")).toBe(false);
  });
});
