#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { runCliEntrypoint } from "./cli-entrypoint.js";
import { resolveToolVersions, readToolVersionInputs } from "./tool-versions.js";

export function packageSpec(packageName, version) {
  return `${packageName}@${version}`;
}

export function buildDockerBuildArgs({
  dockerfile,
  image,
  nodeAlpineImage,
  version,
}) {
  return [
    "build",
    "--build-arg",
    `CODEPENDENCE_VERSION=${version}`,
    "--build-arg",
    `NODE_ALPINE_IMAGE=${nodeAlpineImage}`,
    "-f",
    dockerfile,
    "-t",
    image,
    ".",
  ];
}

export function buildDockerRunShellArgs(image, script) {
  return ["run", "--rm", image, "bash", "-lc", script];
}

export function releaseE2eScript() {
  return [
    "set -euo pipefail",
    'echo "Running Python and Go manifest tests..."',
    "cd /app/tests/e2e/fixtures",
    "./test-python-go.sh",
    'echo "Running Go update tests..."',
    "cd /app",
    "./tests/e2e/test-go-update.sh",
    'echo "All release e2e tests completed successfully"',
  ].join("\n");
}

export function compatibilityScript() {
  return [
    "set -euo pipefail",
    'echo "Testing command execution time..."',
    "time codependence --help >/dev/null",
    'echo "Testing debug output..."',
    "mkdir -p /tmp/codependence-debug",
    "cp /app/tests/release/fixtures/smoke-package.json /tmp/codependence-debug/package.json",
    "cp /app/tests/release/fixtures/smoke-codependencerc.json /tmp/codependence-debug/.codependencerc",
    "codependence --rootDir /tmp/codependence-debug --config /tmp/codependence-debug/.codependencerc --debug",
    'echo "Testing JSON output..."',
    "codependence --rootDir /tmp/codependence-debug --config /tmp/codependence-debug/.codependencerc --format json",
    'echo "Performance and compatibility checks passed"',
  ].join("\n");
}

export function formatSummary(version) {
  return [
    "Test Summary",
    "============",
    `Tested codependence version: ${version}`,
    "Full e2e test suite: PASSED",
    "NPM package smoke test: PASSED",
    "Python compatibility: PASSED",
    "Go compatibility: PASSED",
    "Performance checks: PASSED",
    "",
    "Published package is working correctly.",
    "Ready for production use",
  ].join("\n");
}

export function formatReport({ date, version }) {
  return [
    "# Codependence Release Test Report",
    "",
    `**Version Tested:** ${version}`,
    `**Test Date:** ${date}`,
    "**Status:** PASSED",
    "",
    "## Test Coverage",
    "- E2E Node tests",
    "- Python manifest tests",
    "- Go manifest tests",
    "- Go update preservation tests",
    "- NPM package smoke test",
    "- Performance validation",
    "- External test repository triggered",
    "",
    "## Summary",
    "All tests passed successfully. The published package is ready for use.",
    "External e2e tests have been triggered in the codependence-test repository.",
    "",
  ].join("\n");
}

export function createSpawnRunner() {
  return (command, args) => spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
}

export function commandSucceeded(result) {
  return result.status === 0;
}

export function runOrThrow(runner, command, args) {
  const result = runner(command, args);
  if (commandSucceeded(result)) return result;
  throw new Error(`${command} ${args.join(" ")} failed`);
}

export function requireVersion(version, command) {
  if (!version) throw new Error(`CODEPENDENCE_VERSION is required for ${command}`);
}

function writeOutput(outputPath, key, value) {
  if (outputPath) writeFileSync(outputPath, `${key}=${value}\n`, { flag: "a" });
}

function nodeAlpineImage(env) {
  return resolveToolVersions(readToolVersionInputs({ env })).nodeAlpineImage;
}

export function runTestPublishedReleaseCli({
  argv = process.argv.slice(2),
  env = process.env,
  runner = createSpawnRunner(),
} = {}) {
  const command = argv[0];
  const packageName = env.PACKAGE_NAME || "codependence";
  const fullImage = env.FULL_IMAGE || "codependence-release-test";
  const npmImage = env.NPM_IMAGE || "codependence-npm-test";
  const version = env.CODEPENDENCE_VERSION;

  if (command === "resolve-version") {
    const resolvedVersion =
      env.INPUT_VERSION ||
      runOrThrow(runner, "npm", ["view", packageName, "version"]).stdout?.trim();
    writeOutput(env.GITHUB_OUTPUT, "version", resolvedVersion);
    console.log(`Testing ${packageName} version: ${resolvedVersion}`);
    return 0;
  }

  if (command === "wait-for-npm") {
    requireVersion(version, command);
    console.log(`Waiting for ${packageSpec(packageName, version)} to be available on npm...`);
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      if (commandSucceeded(runner("npm", ["view", packageSpec(packageName, version), "version"]))) {
        console.log(`Package ${packageSpec(packageName, version)} is available on npm`);
        return 0;
      }
      if (attempt < 30) {
        console.log(`Attempt ${attempt}/30: package not yet available, waiting 30 seconds...`);
        runOrThrow(runner, "sleep", ["30"]);
      }
    }
    throw new Error(`Package ${packageSpec(packageName, version)} was not available after 30 attempts`);
  }

  if (command === "build-release-image") {
    requireVersion(version, command);
    runOrThrow(
      runner,
      "docker",
      buildDockerBuildArgs({
        dockerfile: "tests/release/Dockerfile.published",
        image: fullImage,
        nodeAlpineImage: nodeAlpineImage(env),
        version,
      }),
    );
    return 0;
  }

  if (command === "verify-installation") {
    runOrThrow(
      runner,
      "docker",
      buildDockerRunShellArgs(
        fullImage,
        ['set -euo pipefail', "codependence --help", "node /app/dist/cli.js --help", 'echo "Installation verified"'].join("\n"),
      ),
    );
    return 0;
  }

  if (command === "run-e2e") {
    runOrThrow(runner, "docker", buildDockerRunShellArgs(fullImage, releaseE2eScript()));
    return 0;
  }

  if (command === "run-npm-smoke") {
    requireVersion(version, command);
    runOrThrow(
      runner,
      "docker",
      buildDockerBuildArgs({
        dockerfile: "tests/release/Dockerfile.npm-smoke",
        image: npmImage,
        nodeAlpineImage: nodeAlpineImage(env),
        version,
      }),
    );
    runOrThrow(
      runner,
      "docker",
      buildDockerRunShellArgs(
        npmImage,
        ['set -euo pipefail', "codependence --debug", 'echo "NPM package smoke test passed"'].join("\n"),
      ),
    );
    return 0;
  }

  if (command === "compatibility-check") {
    runOrThrow(runner, "docker", buildDockerRunShellArgs(fullImage, compatibilityScript()));
    return 0;
  }

  if (command === "summary") {
    requireVersion(version, command);
    console.log(formatSummary(version));
    return 0;
  }

  if (command === "write-report") {
    const report = formatReport({
      date: new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC"),
      version: version || "unknown",
    });
    writeFileSync("test-report.md", report);
    console.log("Test report created:");
    console.log(report);
    return 0;
  }

  throw new Error(
    "Usage: published-release.js {resolve-version|wait-for-npm|build-release-image|verify-installation|run-e2e|run-npm-smoke|compatibility-check|summary|write-report}",
  );
}

if (import.meta.main) {
  runCliEntrypoint(runTestPublishedReleaseCli);
}
