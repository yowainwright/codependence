import { describe, expect, test } from "bun:test";
import {
  buildGitHubReleaseCreateArgs,
  buildGitHubReleaseUploadArgs,
  buildNpmPublishArgs,
  isPrereleaseVersion,
  parseNpmPackFilename,
  readPrereleaseIdentifier,
  resolveDistTag,
  runPublishReleaseCli,
  stripTagPrefix,
  validateReleaseVersion,
} from "../../../../scripts/ci/publish-release.js";

describe("scripts/ci/publish-release", () => {
  test("resolveDistTag maps prerelease identifiers", () => {
    expect(resolveDistTag("v1.0.0-alpha.1")).toBe("alpha");
    expect(resolveDistTag("v1.0.0-beta.1")).toBe("beta");
    expect(resolveDistTag("v1.0.0-rc.1")).toBe("rc");
    expect(resolveDistTag("v1.0.0")).toBe("latest");
  });

  test("resolveDistTag rejects unsupported prerelease identifiers", () => {
    expect(() => resolveDistTag("v1.0.0-next.1")).toThrow(
      "Unsupported prerelease identifier: next",
    );
    expect(() => resolveDistTag("v1.0.0-beta-build.1")).toThrow(
      "Unsupported prerelease identifier: beta-build",
    );
  });

  test("resolveDistTag rejects malformed release versions", () => {
    expect(() => resolveDistTag("v1.0.0beta.1")).toThrow(
      "Invalid release version: v1.0.0beta.1",
    );
    expect(() => resolveDistTag("v1.0.0-")).toThrow(
      "Invalid release version: v1.0.0-",
    );
  });

  test("readPrereleaseIdentifier reads any semver prerelease identifier", () => {
    expect(readPrereleaseIdentifier("v1.0.0-rc.1")).toBe("rc");
    expect(readPrereleaseIdentifier("v1.0.0-next.1")).toBe("next");
    expect(readPrereleaseIdentifier("v1.0.0-beta-build.1")).toBe("beta-build");
    expect(readPrereleaseIdentifier("v1.0.0")).toBeUndefined();
  });

  test("validateReleaseVersion accepts stable and prerelease versions", () => {
    expect(() => validateReleaseVersion("v1.0.0")).not.toThrow();
    expect(() => validateReleaseVersion("1.0.0-rc.1")).not.toThrow();
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
    const args = buildGitHubReleaseCreateArgs({
      binary: "codependence-linux-x64",
      sigstoreBundle: "codependence.tgz.sigstore.json",
      tarball: "codependence.tgz",
      version: "v1.0.0-beta.1",
    });

    expect(args).toContain("codependence-linux-x64");
    expect(args).toContain("--prerelease");
  });

  test("buildGitHubReleaseUploadArgs replaces every release asset", () => {
    const args = buildGitHubReleaseUploadArgs({
      binary: "codependence-linux-x64",
      sigstoreBundle: "codependence.tgz.sigstore.json",
      tarball: "codependence.tgz",
      version: "v1.0.0",
    });

    expect(args).toEqual([
      "release",
      "upload",
      "v1.0.0",
      "codependence-linux-x64",
      "codependence.tgz",
      "codependence.tgz.sigstore.json",
      "--clobber",
    ]);
  });

  test("publish-github-release-assets uploads the tested binary", () => {
    const calls: string[] = [];
    const runner = (command: string, args: string[]) => {
      calls.push([command, ...args].join(" "));
      return { status: 0, stderr: "", stdout: "" };
    };

    runPublishReleaseCli({
      argv: ["publish-github-release-assets"],
      env: {
        BINARY: "codependence-linux-x64",
        SIGSTORE_BUNDLE: "codependence.tgz.sigstore.json",
        TARBALL: "codependence.tgz",
        VERSION: "v1.0.0",
      },
      runner,
    });

    expect(calls).toContain(
      "gh release upload v1.0.0 codependence-linux-x64 codependence.tgz codependence.tgz.sigstore.json --clobber",
    );
  });

  test("isPrereleaseVersion recognizes semver prerelease tags", () => {
    expect(isPrereleaseVersion("v1.0.0-beta.1")).toBe(true);
    expect(isPrereleaseVersion("v1.0.0-next.1")).toBe(true);
  });
});
