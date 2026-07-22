#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { errorMessage, isDirectCliExecution } from "./cli-entrypoint.js";

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HOMEBREW_ARCHIVE = "codependence-darwin.tar.gz";
const FORMULA_HEADER = [
  "class Codependence < Formula",
  '  desc "Enforce dependency version policy across projects, workspaces, and CI"',
  '  homepage "https://jeffry.in/codependence/"',
].join("\n");
const FORMULA_BODY = [
  "  def install",
  '    binary = "codependence-darwin-x64"',
  '    binary = "codependence-darwin-arm64" if Hardware::CPU.arm?',
  '    bin.install binary => "codependence"',
  '    chmod 0755, bin/"codependence"',
  '    bin.install_symlink "codependence" => "cdp"',
  "  end",
  "",
  "  test do",
  '    assert_match "Codependence", shell_output("#{bin}/codependence --help")',
  '    assert_match "Codependence", shell_output("#{bin}/cdp --help")',
  "  end",
  "end",
].join("\n");

export function validateStableVersion(version) {
  const isStableVersion = STABLE_VERSION_PATTERN.test(version);
  if (isStableVersion) return;
  throw new Error(`Invalid stable version: ${version}`);
}

export function validatePackageVersion(version, manifestContent) {
  const manifest = JSON.parse(manifestContent);
  if (manifest.version === version) return;
  const packageVersion = manifest.version || "missing";
  throw new Error(`Package version ${packageVersion} does not match ${version}`);
}

export function githubArchiveUrl(version) {
  validateStableVersion(version);
  return `https://github.com/yowainwright/codependence/releases/download/v${version}/${HOMEBREW_ARCHIVE}`;
}

export const sha256 = (content) => createHash("sha256").update(content).digest("hex");

export function renderFormula({ digest, version }) {
  const url = githubArchiveUrl(version);
  return [
    FORMULA_HEADER,
    `  url "${url}"`,
    `  sha256 "${digest}"`,
    '  license "MIT"',
    "  depends_on :macos",
    "",
    FORMULA_BODY,
    "",
  ].join("\n");
}

export function createBinaryFormula({ archiveContent, version }) {
  validateStableVersion(version);
  const digest = sha256(archiveContent);
  const formula = renderFormula({ digest, version });
  return { digest, formula, version };
}

function requiredValue(value, name) {
  if (value) return value;
  throw new Error(`${name} is required`);
}

function readStableVersion(env) {
  const version = requiredValue(env.VERSION, "VERSION");
  validateStableVersion(version);
  return version;
}

function validateCommand(command) {
  const knownCommands = new Set(["generate", "validate-package-version", "validate-version"]);
  if (knownCommands.has(command)) return;
  throw new Error(`Unknown command: ${command}`);
}

function generateFormula(env, version) {
  const archivePath = requiredValue(env.BINARY_ARCHIVE, "BINARY_ARCHIVE");
  const outputPath = requiredValue(env.FORMULA_PATH, "FORMULA_PATH");
  const archiveContent = readFileSync(archivePath);
  const result = createBinaryFormula({ archiveContent, version });
  writeFileSync(outputPath, result.formula);
  return { ...result, outputPath };
}

function validateCheckedOutPackage(env, version) {
  const manifestPath = env.PACKAGE_JSON_PATH || "package.json";
  const manifestContent = readFileSync(manifestPath, "utf8");
  validatePackageVersion(version, manifestContent);
}

export async function runHomebrewReleaseCli({
  argv = process.argv.slice(2),
  env = process.env,
  logger = console,
} = {}) {
  const command = argv[0] || "generate";
  const version = readStableVersion(env);
  validateCommand(command);
  if (command === "validate-version") return logger.log(`Validated stable version: ${version}`);
  if (command === "validate-package-version") {
    validateCheckedOutPackage(env, version);
    return logger.log(`Validated package version: ${version}`);
  }

  const result = generateFormula(env, version);
  logger.log(`Generated ${result.outputPath} from the Perry binary archive`);
  logger.log(`SHA256: ${result.digest}`);
}

const isDirectExecution = isDirectCliExecution(import.meta.url);
if (isDirectExecution) {
  runHomebrewReleaseCli().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
