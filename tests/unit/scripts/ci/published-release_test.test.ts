import { describe, expect, jest, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDockerBuildArgs,
  buildDockerRunShellArgs,
  compatibilityScript,
  formatReport,
  formatSummary,
  legacyCompatibilityScript,
  packageSpec,
  releaseE2eScript,
  requireVersion,
  runTestPublishedReleaseCli,
} from "../../../../scripts/ci/published-release.js";
import { NODE_ALPINE_IMAGE as nodeAlpineImage } from "./constants";

describe("scripts/ci/published-release_test", () => {
  test("packageSpec formats npm package specs", () => {
    expect(packageSpec("codependence", "1.0.0")).toBe("codependence@1.0.0");
  });

  test("buildDockerBuildArgs includes image and build args", () => {
    expect(
      buildDockerBuildArgs({
        dockerfile: "tests/release/Dockerfile.published",
        image: "codependence-release-test",
        nodeAlpineImage,
        version: "1.0.0",
      }),
    ).toEqual([
      "build",
      "--build-arg",
      "CODEPENDENCE_VERSION=1.0.0",
      "--build-arg",
      `NODE_ALPINE_IMAGE=${nodeAlpineImage}`,
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

  test("legacyCompatibilityScript checks the 0.3.1 contract", () => {
    const script = legacyCompatibilityScript();

    expect(script).toContain("tests/integration/fixtures/0.3.1/package.json");
    expect(script).toContain("codependence -s");
    expect(script).toContain("cdp --help");
    expect(script).toContain("require('codependence')");
  });

  test("formatSummary includes the version", () => {
    expect(formatSummary("1.0.0")).toContain("Tested codependence version: 1.0.0");
  });

  test("formatReport includes release test coverage", () => {
    const report = formatReport({ date: "2026-05-25 00:00:00 UTC", version: "1.0.0" });

    expect(report).toContain("- Go update preservation tests");
    expect(report).toContain("- 0.3.1 compatibility contract");
  });

  test("formatReport only claims tests run by this repository", () => {
    const report = formatReport({ date: "2026-05-25 00:00:00 UTC", version: "1.0.0" });
    expect(report).not.toContain("External");
  });

  test("requireVersion rejects missing versions", () => {
    expect(() => requireVersion("", "build-release-image")).toThrow("CODEPENDENCE_VERSION");
  });

  test("resolve-version normalizes a release tag input", () => {
    const directory = mkdtempSync(join(tmpdir(), "codependence-release-version-"));
    const outputPath = join(directory, "github-output");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      const code = runTestPublishedReleaseCli({
        argv: ["resolve-version"],
        env: { GITHUB_OUTPUT: outputPath, INPUT_VERSION: "v1.2.4" },
      });
      expect(code).toBe(0);
      expect(readFileSync(outputPath, "utf8")).toBe("version=1.2.4\n");
    } finally {
      logSpy.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("resolve-version rejects an invalid release input", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      expect(() =>
        runTestPublishedReleaseCli({
          argv: ["resolve-version"],
          env: { INPUT_VERSION: "../../latest" },
        }),
      ).toThrow("Invalid release version");
    } finally {
      logSpy.mockRestore();
    }
  });

  test("resolve-version rejects an explicit version that normalizes to empty", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const runner = () => ({ status: 0, stdout: "9.9.9\n", stderr: "" });

    try {
      expect(() =>
        runTestPublishedReleaseCli({
          argv: ["resolve-version"],
          env: { INPUT_VERSION: "v" },
          runner,
        }),
      ).toThrow("Invalid release version");
    } finally {
      logSpy.mockRestore();
    }
  });

  test("wait-for-npm skips sleeping after the last failed attempt", () => {
    const calls: string[] = [];
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const runner = (command: string, args: string[]) => {
      calls.push([command, ...args].join(" "));
      return { status: command === "sleep" ? 0 : 1, stdout: "", stderr: "" };
    };

    try {
      expect(() =>
        runTestPublishedReleaseCli({
          argv: ["wait-for-npm"],
          env: { CODEPENDENCE_VERSION: "1.0.0" },
          runner,
        }),
      ).toThrow("was not available after 30 attempts");
    } finally {
      logSpy.mockRestore();
    }

    expect(calls.filter((call) => call === "sleep 30")).toHaveLength(29);
  });
});
