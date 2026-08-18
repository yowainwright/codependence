import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { FORMULA_BODY, FORMULA_HEADER, STABLE_VERSION_PATTERN } from "./constants";
import type {
  Fetch,
  FormulaInput,
  FormulaOptions,
  FormulaSource,
  LocalFormulaOptions,
  PublishedFormulaOptions,
} from "./types";

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

export const requiredEnv = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name];
  if (value) return value;
  throw new Error(`${name} is required`);
};

export const createLocalFormulaFromEnv = (
  env: Record<string, string | undefined>,
  version: string,
): void => {
  const outputPath = requiredEnv(env, "FORMULA_PATH");
  const tarballPath = requiredEnv(env, "TARBALL_PATH");
  createLocalFormula({ outputPath, tarballPath, version });
};
