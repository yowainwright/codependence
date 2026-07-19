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
  if (STABLE_VERSION_PATTERN.test(version)) return;
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
  if (!response.ok) throw new Error(`Unable to download published tarball: ${response.status}`);
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

export async function runHomebrewReleaseCli({ env = process.env, logger = console } = {}) {
  const version = env.VERSION?.replace(/^v/, "");
  const outputPath = env.FORMULA_PATH;
  if (!version) throw new Error("VERSION is required");
  if (!outputPath) throw new Error("FORMULA_PATH is required");

  const result = await createPublishedFormula({ outputPath, version });
  logger.log(`Generated ${result.outputPath} from ${result.url}`);
  logger.log(`SHA256: ${result.digest}`);
}

if (isDirectCliExecution(import.meta.url)) {
  runHomebrewReleaseCli().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
