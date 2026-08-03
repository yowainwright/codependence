import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { logger } from "../src/logger";

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FORMULA_HEADER = [
  "class Codependence < Formula",
  '  desc "Enforce dependency version policy across projects, workspaces, and CI"',
  '  homepage "https://jeffry.in/codependence/"',
];
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
];

type Fetch = typeof fetch;
type FormulaSource = { digest: string; url: string };
type FormulaInput = FormulaSource & { version: string };
type FormulaOptions = { outputPath: string; version: string };
type PublishedFormulaOptions = FormulaOptions & { fetchImpl?: Fetch };
type LocalFormulaOptions = FormulaOptions & { tarballPath: string };
type CliOptions = { argv?: string[]; env?: Record<string, string | undefined> };

export const validateStableVersion = (version: string): void => {
  if (STABLE_VERSION_PATTERN.test(version)) return;
  throw new Error(`Invalid stable version: ${version}`);
};

export const npmTarballUrl = (version: string): string =>
  `https://registry.npmjs.org/codependence/-/codependence-${version}.tgz`;

export const sha256 = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

export const renderFormula = ({ digest, url }: FormulaSource): string => {
  const source = [`  url "${url}"`, `  sha256 "${digest}"`];
  return FORMULA_HEADER.concat(source, FORMULA_BODY, "").join("\n");
};

export const fetchPublishedTarball = async (
  url: string,
  fetchImpl: Fetch = fetch,
): Promise<Buffer> => {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Unable to download published tarball: ${response.status}`);
  const content = await response.arrayBuffer();
  return Buffer.from(content);
};

const createFormula = (content: Buffer, { outputPath, version }: FormulaOptions): FormulaInput => {
  validateStableVersion(version);
  const url = npmTarballUrl(version);
  const digest = sha256(content);
  writeFileSync(outputPath, renderFormula({ digest, url }));
  return { digest, url, version };
};

export const createPublishedFormula = async ({
  fetchImpl = fetch,
  outputPath,
  version,
}: PublishedFormulaOptions): Promise<FormulaInput> => {
  const url = npmTarballUrl(version);
  const content = await fetchPublishedTarball(url, fetchImpl);
  return createFormula(content, { outputPath, version });
};

export const createLocalFormula = ({
  outputPath,
  tarballPath,
  version,
}: LocalFormulaOptions): FormulaInput => {
  const content = readFileSync(tarballPath);
  return createFormula(content, { outputPath, version });
};

const requiredEnv = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name];
  if (value) return value;
  throw new Error(`${name} is required`);
};

const createLocalFormulaFromEnv = (env: Record<string, string | undefined>, version: string) => {
  const outputPath = requiredEnv(env, "FORMULA_PATH");
  const tarballPath = requiredEnv(env, "TARBALL_PATH");
  createLocalFormula({ outputPath, tarballPath, version });
};

export const runBrewCli = async ({
  argv = process.argv.slice(2),
  env = process.env,
}: CliOptions = {}): Promise<void> => {
  const command = argv[0] ?? "generate";
  const version = requiredEnv(env, "VERSION");
  validateStableVersion(version);
  if (command === "validate-version") return;
  if (command === "generate-local") return createLocalFormulaFromEnv(env, version);
  if (command !== "generate") throw new Error(`Unknown command: ${command}`);
  const outputPath = requiredEnv(env, "FORMULA_PATH");
  await createPublishedFormula({ outputPath, version });
};

if (import.meta.main) {
  runBrewCli().catch((error) => {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
