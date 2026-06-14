#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { isDirectCliExecution, runCliEntrypoint } from "./cli-entrypoint.js";

const TOOL_OUTPUT_KEYS = {
  bunLinuxAarch64Sha256: "bun_linux_aarch64_sha256",
  bunLinuxX64Sha256: "bun_linux_x64_sha256",
  bunVersion: "bun_version",
  nodeAlpineImage: "node_alpine_image",
  nodeSlimImage: "node_slim_image",
  nodeVersion: "node_version",
};

function nodeMajor(nodeVersion) {
  const match = nodeVersion.match(/^\d+/);
  if (!match) throw new Error(`Unable to resolve Node major version from ${nodeVersion}`);
  return match[0];
}

function pinnedNodeImage({ flavor, image, nodeVersion }) {
  const expectedPrefix = `node:${nodeMajor(nodeVersion)}-${flavor}@sha256:`;
  if (!image?.startsWith(expectedPrefix)) {
    throw new Error(`Expected ${flavor} image to start with ${expectedPrefix}`);
  }
  return image;
}

function bunArchiveSha({ arch, bunVersion, dockerPins }) {
  const key = `linux-${arch}`;
  const sha = dockerPins?.bunArchives?.[bunVersion]?.[key];
  if (!sha) throw new Error(`Unable to resolve Bun ${key} SHA256 for ${bunVersion}`);
  return sha;
}

export function parseMiseTool(miseToml, toolName) {
  const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = miseToml.match(new RegExp(`^\\s*${escapedToolName}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] ?? "";
}

export function parsePackageManagerBunVersion(packageJson) {
  const packageManager = packageJson.packageManager;
  if (typeof packageManager !== "string") return "";
  return packageManager.startsWith("bun@") ? packageManager.slice("bun@".length) : "";
}

export function parseDockerfileArg(dockerfile, argName) {
  const escapedArgName = argName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = dockerfile.match(new RegExp(`^\\s*ARG\\s+${escapedArgName}=([^\\s#]+)`, "m"));
  return match?.[1] ?? "";
}

export function resolveToolVersions({
  dockerPins = {},
  env = {},
  miseToml,
  nodeAlpineImage,
  nodeSlimImage,
  packageJson,
}) {
  const nodeVersion = env.INPUT_NODE_VERSION || parseMiseTool(miseToml, "node");
  const bunVersion =
    env.INPUT_BUN_VERSION || parsePackageManagerBunVersion(packageJson) || parseMiseTool(miseToml, "bun");
  const rawNodeAlpineImage = env.NODE_ALPINE_IMAGE || nodeAlpineImage;
  const rawNodeSlimImage = env.NODE_SLIM_IMAGE || nodeSlimImage;

  const versions = {
    bunLinuxAarch64Sha256:
      env.BUN_LINUX_AARCH64_SHA256 || bunArchiveSha({ arch: "aarch64", bunVersion, dockerPins }),
    bunLinuxX64Sha256: env.BUN_LINUX_X64_SHA256 || bunArchiveSha({ arch: "x64", bunVersion, dockerPins }),
    bunVersion,
    nodeAlpineImage:
      pinnedNodeImage({ flavor: "alpine", image: rawNodeAlpineImage, nodeVersion }),
    nodeSlimImage:
      pinnedNodeImage({ flavor: "slim", image: rawNodeSlimImage, nodeVersion }),
    nodeVersion,
  };

  for (const [key, value] of Object.entries(versions)) {
    if (!value) throw new Error(`Unable to resolve ${key}`);
  }

  return versions;
}

export function formatGitHubOutput(versions) {
  return Object.entries(TOOL_OUTPUT_KEYS)
    .map(([versionKey, outputKey]) => `${outputKey}=${versions[versionKey]}`)
    .join("\n");
}

export function readToolVersionInputs({
  dockerPinsPath = "scripts/ci/docker-pins.json",
  nodeAlpineDockerfilePath = "tests/release/Dockerfile.npm-smoke",
  nodeSlimDockerfilePath = "tests/e2e/Dockerfile",
  env = process.env,
  misePath = ".mise.toml",
  packagePath = "package.json",
} = {}) {
  const nodeAlpineDockerfile = readFileSync(nodeAlpineDockerfilePath, "utf8");
  const nodeSlimDockerfile = readFileSync(nodeSlimDockerfilePath, "utf8");

  return {
    dockerPins: JSON.parse(readFileSync(dockerPinsPath, "utf8")),
    env,
    miseToml: readFileSync(misePath, "utf8"),
    nodeAlpineImage: parseDockerfileArg(nodeAlpineDockerfile, "NODE_ALPINE_IMAGE"),
    nodeSlimImage: parseDockerfileArg(nodeSlimDockerfile, "NODE_SLIM_IMAGE"),
    packageJson: JSON.parse(readFileSync(packagePath, "utf8")),
  };
}

export function resolveToolVersionValue(key, versions) {
  if (key === "bun-linux-aarch64-sha256") return versions.bunLinuxAarch64Sha256;
  if (key === "bun-linux-x64-sha256") return versions.bunLinuxX64Sha256;
  if (key === "node-version") return versions.nodeVersion;
  if (key === "bun-version") return versions.bunVersion;
  if (key === "node-slim-image") return versions.nodeSlimImage;
  if (key === "node-alpine-image") return versions.nodeAlpineImage;
  throw new Error(`Unknown tool version key: ${key}`);
}

export function runToolVersionsCli({
  argv = process.argv.slice(2),
  env = process.env,
  output = console.log,
  writeGitHubOutput = appendFileSync,
} = {}) {
  const mode = argv[0] ?? "github-output";
  const versions = resolveToolVersions(readToolVersionInputs({ env }));

  if (mode === "github-output") {
    const outputPath = env.GITHUB_OUTPUT;
    if (!outputPath) throw new Error("GITHUB_OUTPUT is required for github-output mode");
    writeGitHubOutput(outputPath, `${formatGitHubOutput(versions)}\n`);
    return 0;
  }

  output(resolveToolVersionValue(mode, versions));
  return 0;
}

if (isDirectCliExecution(import.meta.url)) {
  runCliEntrypoint(runToolVersionsCli);
}
