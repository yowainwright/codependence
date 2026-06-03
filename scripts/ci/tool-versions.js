#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { isDirectCliExecution, runCliEntrypoint } from "./cli-entrypoint.js";

const TOOL_OUTPUT_KEYS = {
  bunVersion: "bun_version",
  nodeAlpineImage: "node_alpine_image",
  nodeSlimImage: "node_slim_image",
  nodeVersion: "node_version",
};

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

export function resolveToolVersions({
  env = {},
  miseToml,
  packageJson,
}) {
  const nodeVersion = env.INPUT_NODE_VERSION || parseMiseTool(miseToml, "node");
  const bunVersion =
    env.INPUT_BUN_VERSION || parsePackageManagerBunVersion(packageJson) || parseMiseTool(miseToml, "bun");

  const versions = {
    bunVersion,
    nodeAlpineImage: env.NODE_ALPINE_IMAGE || `node:${nodeVersion}-alpine`,
    nodeSlimImage: env.NODE_SLIM_IMAGE || `node:${nodeVersion}-slim`,
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
  env = process.env,
  misePath = ".mise.toml",
  packagePath = "package.json",
} = {}) {
  return {
    env,
    miseToml: readFileSync(misePath, "utf8"),
    packageJson: JSON.parse(readFileSync(packagePath, "utf8")),
  };
}

export function resolveToolVersionValue(key, versions) {
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
