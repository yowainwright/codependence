#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { isDirectCliExecution, runCliEntrypoint } from "./cli-entrypoint.js";
import { TOOL_OUTPUT_KEYS } from "./constants.js";

const DOCKERFILE_ARG_PATTERN = /^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)=([^\s#]+)\s*$/gm;
const DOCKERFILE_ARG_REFERENCE_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

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

export function parseMiseTool(miseToml, toolName) {
  const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = miseToml.match(new RegExp(`^\\s*${escapedToolName}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] ?? "";
}

export function parseDockerfileArg(dockerfile, argName) {
  const entries = Array.from(dockerfile.matchAll(DOCKERFILE_ARG_PATTERN), (match) => [
    match[1],
    match[2],
  ]);
  const args = new Map(entries);
  const value = args.get(argName) ?? "";
  return value.replace(DOCKERFILE_ARG_REFERENCE_PATTERN, (_, name) => args.get(name) ?? "");
}

export function resolveToolVersions({ env = {}, miseToml, nodeAlpineImage, nodeSlimImage }) {
  const projectNodeVersion = parseMiseTool(miseToml, "node");
  const nodeVersion = env.INPUT_NODE_VERSION || projectNodeVersion;
  const dockerNodeVersion =
    env.NODE_DOCKER_VERSION ||
    (env.NODE_ALPINE_IMAGE || env.NODE_SLIM_IMAGE ? nodeVersion : projectNodeVersion);
  const nubVersion = parseMiseTool(miseToml, "nub");
  const rawNodeAlpineImage = env.NODE_ALPINE_IMAGE || nodeAlpineImage;
  const rawNodeSlimImage = env.NODE_SLIM_IMAGE || nodeSlimImage;

  const versions = {
    nodeAlpineImage: pinnedNodeImage({
      flavor: "alpine",
      image: rawNodeAlpineImage,
      nodeVersion: dockerNodeVersion,
    }),
    nodeSlimImage: pinnedNodeImage({
      flavor: "slim",
      image: rawNodeSlimImage,
      nodeVersion: dockerNodeVersion,
    }),
    nodeVersion,
    nubVersion,
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
  nodeAlpineDockerfilePath = "tests/release/Dockerfile.npm-smoke",
  nodeSlimDockerfilePath = "tests/e2e/Dockerfile",
  env = process.env,
  misePath = ".mise.toml",
} = {}) {
  const nodeAlpineDockerfile = readFileSync(nodeAlpineDockerfilePath, "utf8");
  const nodeSlimDockerfile = readFileSync(nodeSlimDockerfilePath, "utf8");

  return {
    env,
    miseToml: readFileSync(misePath, "utf8"),
    nodeAlpineImage: parseDockerfileArg(nodeAlpineDockerfile, "NODE_ALPINE_IMAGE"),
    nodeSlimImage: parseDockerfileArg(nodeSlimDockerfile, "NODE_SLIM_IMAGE"),
  };
}

export function resolveToolVersionValue(key, versions) {
  if (key === "node-version") return versions.nodeVersion;
  if (key === "node-slim-image") return versions.nodeSlimImage;
  if (key === "node-alpine-image") return versions.nodeAlpineImage;
  if (key === "nub-version") return versions.nubVersion;
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
