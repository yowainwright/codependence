import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const releaseAssets = {
  sigstoreBundle: "codependence.tgz.sigstore.json",
  tarball: "codependence.tgz",
  version: "v1.0.0",
};

function createRecordingRunner(calls: string[]) {
  return (command: string, args: string[]) => {
    calls.push([command, ...args].join(" "));
    return { status: 0, stderr: "", stdout: "" };
  };
}

describe("scripts/ci/publish-release", () => {
  test("resolveDistTag maps prerelease identifiers", () => {
    expect(resolveDistTag("v1.0.0-alpha.1")).toBe("alpha");
    expect(resolveDistTag("v1.0.0-beta.1")).toBe("beta");
    expect(resolveDistTag("v1.0.0-rc.1")).toBe("rc");
    expect(resolveDistTag("v1.0.0")).toBe("latest");
  });

  test("resolve-dist-tag emits the normalized release version", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "codependence-release-"));
    const outputPath = join(outputDir, "output");

    try {
      runPublishReleaseCli({
        argv: ["resolve-dist-tag"],
        env: { GITHUB_OUTPUT: outputPath, VERSION: "v1.0.0" },
      });

      expect(readFileSync(outputPath, "utf8")).toBe("tag=latest\nversion=1.0.0\n");
    } finally {
      rmSync(outputDir, { force: true, recursive: true });
    }
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
    expect(() => resolveDistTag("v1.0.0beta.1")).toThrow("Invalid release version: v1.0.0beta.1");
    expect(() => resolveDistTag("v1.0.0-")).toThrow("Invalid release version: v1.0.0-");
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
      sigstoreBundle: "codependence.tgz.sigstore.json",
      tarball: "codependence.tgz",
      version: "v1.0.0-beta.1",
    });

    expect(args).toContain("codependence.tgz");
    expect(args).toContain("--prerelease");
  });

  test("buildGitHubReleaseUploadArgs preserves immutable release assets", () => {
    const args = buildGitHubReleaseUploadArgs({
      sigstoreBundle: "codependence.tgz.sigstore.json",
      tarball: "codependence.tgz",
      version: "v1.0.0",
    });

    expect(args).toEqual([
      "release",
      "upload",
      "v1.0.0",
      "codependence.tgz",
      "codependence.tgz.sigstore.json",
    ]);
  });

  test("publish-github-release-assets uploads npm artifacts only", () => {
    const calls: string[] = [];
    const runner = createRecordingRunner(calls);

    runPublishReleaseCli({
      argv: ["publish-github-release-assets"],
      env: {
        SIGSTORE_BUNDLE: releaseAssets.sigstoreBundle,
        TARBALL: releaseAssets.tarball,
        VERSION: releaseAssets.version,
      },
      runner,
    });

    expect(calls).toContain(
      "gh release upload v1.0.0 codependence.tgz codependence.tgz.sigstore.json",
    );
  });

  test("isPrereleaseVersion recognizes semver prerelease tags", () => {
    expect(isPrereleaseVersion("v1.0.0-beta.1")).toBe(true);
    expect(isPrereleaseVersion("v1.0.0-next.1")).toBe(true);
  });
});
