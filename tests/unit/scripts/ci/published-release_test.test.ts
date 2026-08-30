import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { assertThrows } from "../../../helpers/assertions";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
} from "../../../../scripts/release";
import { NODE_ALPINE_IMAGE as nodeAlpineImage } from "./constants";

const TEMP_ROOT = join(import.meta.dirname, ".tmp-published-release");

const createCommandRecorder = () => {
  let calls: string[] = [];
  const runner = (command: string, args: readonly string[]) => {
    const call = [command].concat(Array.from(args)).join(" ");
    calls = calls.concat(call);
    return { status: 0, stdout: "1.0.0\n", stderr: "" };
  };
  return {
    calls: () => calls,
    runner,
  };
};

describe("scripts/release test-published", () => {
  test("packageSpec formats npm package specs", () => {
    assert.strictEqual((packageSpec("codependence", "1.0.0")), "codependence@1.0.0");
  });

  test("buildDockerBuildArgs includes image and build args", () => {
    assert.deepStrictEqual(buildDockerBuildArgs({
        dockerfile: "tests/release/Dockerfile.published",
        image: "codependence-release-test",
        nodeAlpineImage,
        version: "1.0.0",
      }), [
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
    assert.deepStrictEqual((buildDockerRunShellArgs("codependence-release-test", "codependence --help")), [
      "run",
      "--rm",
      "codependence-release-test",
      "bash",
      "-lc",
      "codependence --help",
    ]);
  });

  test("releaseE2eScript runs Python and Go checks", () => {
    assert.ok((releaseE2eScript()).includes("./test-python-go.sh"));
    assert.ok((releaseE2eScript()).includes("./tests/e2e/test-go-update.sh"));
  });

  test("compatibilityScript checks debug and JSON output", () => {
    assert.ok((compatibilityScript()).includes("--debug"));
    assert.ok((compatibilityScript()).includes("--format json"));
  });

  test("legacyCompatibilityScript checks the 0.3.1 contract", () => {
    const script = legacyCompatibilityScript();

    assert.ok((script).includes("tests/fixtures/0.3.1/package.json"));
    assert.ok((script).includes("codependence -s"));
    assert.ok((script).includes("cdp --help"));
    assert.ok((script).includes("require('codependence')"));
  });

  test("formatSummary includes the version", () => {
    assert.ok((formatSummary("1.0.0")).includes("Tested codependence version: 1.0.0"));
  });

  test("formatReport includes release test coverage", () => {
    const report = formatReport({ date: "2026-05-25 00:00:00 UTC", version: "1.0.0" });

    assert.ok((report).includes("- Go update preservation tests"));
    assert.ok((report).includes("- 0.3.1 compatibility contract"));
  });

  test("formatReport only claims tests run by this repository", () => {
    const report = formatReport({ date: "2026-05-25 00:00:00 UTC", version: "1.0.0" });
    assert.ok(!(report).includes("External"));
  });

  test("requireVersion rejects missing versions", () => {
    assertThrows((() => requireVersion("", "build-release-image")), "CODEPENDENCE_VERSION");
  });

  test("resolve-version normalizes a release tag input", () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "version-"));
    const outputPath = join(directory, "github-output");
    const logSpy = mock.method(console, "log", () => {});

    try {
      const code = runTestPublishedReleaseCli({
        argv: ["resolve-version"],
        env: { GITHUB_OUTPUT: outputPath, INPUT_VERSION: "v1.2.4" },
      });
      assert.strictEqual((code), 0);
      assert.strictEqual((readFileSync(outputPath, "utf8")), "version=1.2.4\n");
    } finally {
      logSpy.mock.restore();
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("resolve-version rejects an invalid release input", () => {
    const logSpy = mock.method(console, "log", () => {});

    try {
      assertThrows(() =>
        runTestPublishedReleaseCli({
          argv: ["resolve-version"],
          env: { INPUT_VERSION: "../../latest" },
        }), "Invalid release version");
    } finally {
      logSpy.mock.restore();
    }
  });

  test("resolve-version rejects an explicit version that normalizes to empty", () => {
    const logSpy = mock.method(console, "log", () => {});
    const runner = () => ({ status: 0, stdout: "9.9.9\n", stderr: "" });

    try {
      assertThrows(() =>
        runTestPublishedReleaseCli({
          argv: ["resolve-version"],
          env: { INPUT_VERSION: "v" },
          runner,
        }), "Invalid release version");
    } finally {
      logSpy.mock.restore();
    }
  });

  test("wait-for-npm skips sleeping after the last failed attempt", () => {
    let calls: string[] = [];
    const logSpy = mock.method(console, "log", () => {});
    const runner = (command: string, args: string[]) => {
      const call = [command, ...args].join(" ");
      calls = calls.concat(call);
      const status = command === "sleep" ? 0 : 1;
      return { status, stdout: "", stderr: "" };
    };

    try {
      assertThrows(() =>
        runTestPublishedReleaseCli({
          argv: ["wait-for-npm"],
          env: { CODEPENDENCE_VERSION: "1.0.0" },
          runner,
        }), "was not available after 30 attempts");
    } finally {
      logSpy.mock.restore();
    }

    assert.strictEqual((calls.filter((call) => call === "sleep 30")).length, 29);
  });

  test("wait-for-npm exits when npm has the package", () => {
    const logSpy = mock.method(console, "log", () => {});
    const { calls, runner } = createCommandRecorder();

    try {
      const code = runTestPublishedReleaseCli({
        argv: ["wait-for-npm"],
        env: { CODEPENDENCE_VERSION: "1.0.0" },
        runner,
      });
      assert.strictEqual((code), 0);
    } finally {
      logSpy.mock.restore();
    }

    assert.deepStrictEqual(calls(), ["npm view codependence@1.0.0 version"]);
  });

  test("build-release-image builds the published image", () => {
    const { calls, runner } = createCommandRecorder();
    const code = runTestPublishedReleaseCli({
      argv: ["build-release-image"],
      env: {
        CODEPENDENCE_VERSION: "1.0.0",
        NODE_ALPINE_IMAGE: nodeAlpineImage,
      },
      runner,
    });

    assert.strictEqual((code), 0);
    assert.ok(calls().some((call) => call.includes("tests/release/Dockerfile.published")));
    assert.ok(calls().some((call) => call.includes("CODEPENDENCE_VERSION=1.0.0")));
  });

  test("verify-installation runs the installed CLI checks", () => {
    const { calls, runner } = createCommandRecorder();
    const code = runTestPublishedReleaseCli({ argv: ["verify-installation"], env: {}, runner });

    assert.strictEqual((code), 0);
    assert.ok(calls().some((call) => call.includes("codependence --help")));
    assert.ok(calls().some((call) => call.includes("node /app/dist/cli.js --help")));
  });

  test("run-e2e routes through the release e2e script", () => {
    const { calls, runner } = createCommandRecorder();
    const code = runTestPublishedReleaseCli({ argv: ["run-e2e"], env: {}, runner });

    assert.strictEqual((code), 0);
    assert.ok(calls().some((call) => call.includes("test-python-go.sh")));
  });

  test("run-npm-smoke builds and runs the smoke image", () => {
    const { calls, runner } = createCommandRecorder();
    const code = runTestPublishedReleaseCli({
      argv: ["run-npm-smoke"],
      env: {
        CODEPENDENCE_VERSION: "1.0.0",
        NODE_ALPINE_IMAGE: nodeAlpineImage,
      },
      runner,
    });

    assert.strictEqual((code), 0);
    assert.ok(calls().some((call) => call.includes("tests/release/Dockerfile.npm-smoke")));
    assert.ok(calls().some((call) => call.includes("codependence --debug")));
  });

  test("compatibility-check routes through the compatibility script", () => {
    const { calls, runner } = createCommandRecorder();
    const code = runTestPublishedReleaseCli({ argv: ["compatibility-check"], env: {}, runner });

    assert.strictEqual((code), 0);
    assert.ok(calls().some((call) => call.includes("--format json")));
  });

  test("summary prints release test summary", () => {
    let output = "";
    const logSpy = mock.method(console, "log", (value) => {
      output = `${output}${String(value)}`;
    });

    try {
      const code = runTestPublishedReleaseCli({
        argv: ["summary"],
        env: { CODEPENDENCE_VERSION: "1.0.0" },
      });
      assert.strictEqual((code), 0);
    } finally {
      logSpy.mock.restore();
    }

    assert.ok(output.includes("Test Summary"));
  });

  test("write-report creates the release test report", () => {
    mkdirSync(TEMP_ROOT, { recursive: true });
    const directory = mkdtempSync(join(TEMP_ROOT, "report-"));
    const cwd = process.cwd();
    const logSpy = mock.method(console, "log", () => {});

    try {
      process.chdir(directory);
      const code = runTestPublishedReleaseCli({
        argv: ["write-report"],
        env: { CODEPENDENCE_VERSION: "1.0.0" },
      });
      assert.strictEqual((code), 0);
      assert.ok(readFileSync("test-report.md", "utf8").includes("1.0.0"));
    } finally {
      process.chdir(cwd);
      logSpy.mock.restore();
      rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  test("rejects unknown published release commands", () => {
    assertThrows(() =>
      runTestPublishedReleaseCli({
        argv: ["wat"],
        env: {},
      }), "Usage: test-published");
  });
});
