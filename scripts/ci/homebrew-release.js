#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { errorMessage, isDirectCliExecution } from "./cli-entrypoint.js";

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FORMULA_HEADER = [
  "class Codependence < Formula",
  '  desc "Enforce dependency version policy across projects, workspaces, and CI"',
  '  homepage "https://jeffry.in/codependence/"',
].join("\n");
const FORMULA_BODY = [
  '  license "MIT"',
  "",
  '  depends_on "node"',
  "",
  "  def install",
  '    system "npm", "install", *std_npm_args, "--ignore-scripts"',
  '    bin.install_symlink libexec.glob("bin/*")',
  "  end",
  "",
  "  test do",
  '    system bin/"codependence", "--help"',
  '    system bin/"cdp", "--help"',
  "  end",
  "end",
].join("\n");

export function validateStableVersion(version) {
  const isStableVersion = STABLE_VERSION_PATTERN.test(version);
  if (isStableVersion) return;
  throw new Error(`Invalid stable version: ${version}`);
}

export const npmTarballUrl = (version) =>
  `https://registry.npmjs.org/codependence/-/codependence-${version}.tgz`;

export const sha256 = (content) => createHash("sha256").update(content).digest("hex");

export function renderFormula({ digest, url }) {
  const source = [`  url "${url}"`, `  sha256 "${digest}"`].join("\n");
  return [FORMULA_HEADER, source, FORMULA_BODY, ""].join("\n");
}

export async function fetchPublishedTarball(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  const downloadFailed = !response.ok;
  if (downloadFailed) throw new Error(`Unable to download published tarball: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function createPublishedFormula({ fetchImpl = fetch, outputPath, version }) {
  validateStableVersion(version);
  const url = npmTarballUrl(version);
  const tarball = await fetchPublishedTarball(url, fetchImpl);
  const digest = sha256(tarball);
  const formula = renderFormula({ digest, url });
  writeFileSync(outputPath, formula);
  return { digest, outputPath, url, version };
}

function readStableVersion(env) {
  const version = env.VERSION;
  const isMissing = !version;
  if (isMissing) throw new Error("VERSION is required");
  validateStableVersion(version);
  return version;
}

function validateCommand(command) {
  const isKnownCommand = command === "generate" || command === "validate-version";
  if (isKnownCommand) return;
  throw new Error(`Unknown command: ${command}`);
}

async function generateFormula(env, logger, version) {
  const outputPath = env.FORMULA_PATH;
  const isOutputPathMissing = !outputPath;
  if (isOutputPathMissing) throw new Error("FORMULA_PATH is required");

  const result = await createPublishedFormula({ outputPath, version });
  logger.log(`Generated ${result.outputPath} from ${result.url}`);
  logger.log(`SHA256: ${result.digest}`);
}

export async function runHomebrewReleaseCli({
  argv = process.argv.slice(2),
  env = process.env,
  logger = console,
} = {}) {
  const command = argv[0] || "generate";
  const version = readStableVersion(env);
  validateCommand(command);
  const isValidation = command === "validate-version";
  if (isValidation) {
    logger.log(`Validated stable version: ${version}`);
    return;
  }

  await generateFormula(env, logger, version);
}

const isDirectExecution = isDirectCliExecution(import.meta.url);
if (isDirectExecution) {
  runHomebrewReleaseCli().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
