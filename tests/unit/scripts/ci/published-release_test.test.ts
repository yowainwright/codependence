import { describe, expect, test } from "bun:test";
import {
  buildDockerBuildArgs,
  buildDockerRunShellArgs,
  compatibilityScript,
  formatReport,
  formatSummary,
  packageSpec,
  releaseE2eScript,
  requireVersion,
} from "../../../../scripts/ci/published-release.js";

describe("scripts/ci/published-release_test", () => {
  test("packageSpec formats npm package specs", () => {
    expect(packageSpec("codependence", "1.0.0")).toBe("codependence@1.0.0");
  });

  test("buildDockerBuildArgs includes image and build args", () => {
    expect(
      buildDockerBuildArgs({
        dockerfile: "tests/release/Dockerfile.published",
        image: "codependence-release-test",
        nodeAlpineImage: "node:24-alpine",
        version: "1.0.0",
      }),
    ).toEqual([
      "build",
      "--build-arg",
      "CODEPENDENCE_VERSION=1.0.0",
      "--build-arg",
      "NODE_ALPINE_IMAGE=node:24-alpine",
      "-f",
      "tests/release/Dockerfile.published",
      "-t",
      "codependence-release-test",
      ".",
    ]);
  });

  test("buildDockerRunShellArgs builds bash runner args", () => {
    expect(buildDockerRunShellArgs("codependence-release-test", "codependence --help")).toEqual([
      "run",
      "--rm",
      "codependence-release-test",
      "bash",
      "-lc",
      "codependence --help",
    ]);
  });

  test("releaseE2eScript runs Python and Go checks", () => {
    expect(releaseE2eScript()).toContain("./test-python-go.sh");
    expect(releaseE2eScript()).toContain("./tests/e2e/test-go-update.sh");
  });

  test("compatibilityScript checks debug and JSON output", () => {
    expect(compatibilityScript()).toContain("--debug");
    expect(compatibilityScript()).toContain("--format json");
  });

  test("formatSummary includes the version", () => {
    expect(formatSummary("1.0.0")).toContain("Tested codependence version: 1.0.0");
  });

  test("formatReport includes release test coverage", () => {
    expect(formatReport({ date: "2026-05-25 00:00:00 UTC", version: "1.0.0" })).toContain(
      "- Go update preservation tests",
    );
  });

  test("requireVersion rejects missing versions", () => {
    expect(() => requireVersion("", "build-release-image")).toThrow("CODEPENDENCE_VERSION");
  });
});
