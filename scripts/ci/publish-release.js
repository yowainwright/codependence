#!/usr/bin/env node

import { copyFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isDirectCliExecution, runCliEntrypoint } from "./cli-entrypoint.js";
import { RELEASE_VERSION_PATTERN, SUPPORTED_PRERELEASES } from "./constants.js";

export function validateReleaseVersion(version) {
  if (RELEASE_VERSION_PATTERN.test(version)) return;
  throw new Error(`Invalid release version: ${version}`);
}

export function readPrereleaseIdentifier(version) {
  const match = version.match(RELEASE_VERSION_PATTERN);
  return match?.[1];
}

export function resolveDistTag(version) {
  validateReleaseVersion(version);
  const prerelease = readPrereleaseIdentifier(version);
  if (!prerelease) return "latest";
  if (SUPPORTED_PRERELEASES.has(prerelease)) return prerelease;
  throw new Error(`Unsupported prerelease identifier: ${prerelease}`);
}

export function parseNpmPackFilename(output) {
  const start = output.indexOf("[");
  if (start < 0) throw new Error("npm pack JSON output not found");
  const [pkg] = JSON.parse(output.slice(start));
  if (!pkg?.filename) throw new Error("npm pack filename not found");
  return pkg.filename;
}

export function stripTagPrefix(version) {
  return version.startsWith("v") ? version.slice(1) : version;
}

export function isPrereleaseVersion(version) {
  return readPrereleaseIdentifier(version) !== undefined;
}

export function buildNpmPublishArgs({ distTag, tarball }) {
  return ["publish", tarball, "--provenance", "--access", "public", "--tag", distTag];
}

export function buildGitHubReleaseCreateArgs({ sigstoreBundle, tarball, version }) {
  const args = [
    "release",
    "create",
    version,
    tarball,
    sigstoreBundle,
    "--title",
    version,
    "--generate-notes",
  ];

  if (isPrereleaseVersion(version)) args.push("--prerelease");
  return args;
}

export function createSpawnRunner() {
  return (command, args) => spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
}

export function requireValues(values) {
  for (const [name, value] of Object.entries(values)) {
    if (!value) throw new Error(`${name} is required`);
  }
}

export function writeOutput(outputPath, key, value) {
  if (!outputPath) throw new Error("GITHUB_OUTPUT is required");
  writeFileSync(outputPath, `${key}=${value}\n`, { flag: "a" });
}

export function commandSucceeded(result) {
  return result.status === 0;
}

function runOrThrow(runner, command, args) {
  const result = runner(command, args);
  if (commandSucceeded(result)) return result;
  throw new Error(result.stderr?.trim() || result.stdout?.trim() || `${command} failed`);
}

export function runPublishReleaseCli({
  argv = process.argv.slice(2),
  env = process.env,
  runner = createSpawnRunner(),
} = {}) {
  const command = argv[0];

  if (command === "resolve-dist-tag") {
    requireValues({ VERSION: env.VERSION });
    writeOutput(env.GITHUB_OUTPUT, "tag", resolveDistTag(env.VERSION));
    return 0;
  }

  if (command === "pack") {
    const result = runOrThrow(runner, "npm", ["pack", "--ignore-scripts", "--json"]);
    writeFileSync("npm-pack.json", result.stdout);
    writeOutput(env.GITHUB_OUTPUT, "tarball", parseNpmPackFilename(result.stdout));
    return 0;
  }

  if (command === "prepare-attestation") {
    requireValues({
      ATTESTATION_BUNDLE_PATH: env.ATTESTATION_BUNDLE_PATH,
      TARBALL: env.TARBALL,
    });
    const sigstoreBundle = `${env.TARBALL}.sigstore.json`;
    copyFileSync(env.ATTESTATION_BUNDLE_PATH, sigstoreBundle);
    writeOutput(env.GITHUB_OUTPUT, "sigstore_bundle", sigstoreBundle);
    return 0;
  }

  if (command === "publish-npm") {
    requireValues({
      DIST_TAG: env.DIST_TAG,
      PACKAGE_VERSION: env.PACKAGE_VERSION,
      TARBALL: env.TARBALL,
    });

    const version = stripTagPrefix(env.PACKAGE_VERSION);
    if (commandSucceeded(runner("npm", ["view", `codependence@${version}`, "version"]))) {
      console.log(`codependence@${version} is already published`);
      return 0;
    }

    runOrThrow(runner, "npm", buildNpmPublishArgs({ distTag: env.DIST_TAG, tarball: env.TARBALL }));
    return 0;
  }

  if (command === "publish-github-release-assets") {
    requireValues({
      SIGSTORE_BUNDLE: env.SIGSTORE_BUNDLE,
      TARBALL: env.TARBALL,
      VERSION: env.VERSION,
    });

    if (commandSucceeded(runner("gh", ["release", "view", env.VERSION]))) {
      runOrThrow(runner, "gh", [
        "release",
        "upload",
        env.VERSION,
        env.TARBALL,
        env.SIGSTORE_BUNDLE,
        "--clobber",
      ]);
      return 0;
    }

    runOrThrow(
      runner,
      "gh",
      buildGitHubReleaseCreateArgs({
        sigstoreBundle: env.SIGSTORE_BUNDLE,
        tarball: env.TARBALL,
        version: env.VERSION,
      }),
    );
    return 0;
  }

  throw new Error(
    "Usage: publish-release.js {resolve-dist-tag|pack|prepare-attestation|publish-npm|publish-github-release-assets}",
  );
}

if (isDirectCliExecution(import.meta.url)) {
  runCliEntrypoint(runPublishReleaseCli);
}
