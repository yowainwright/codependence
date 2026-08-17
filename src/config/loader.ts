import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { CONFIG_FILES } from "./constants";
import { MANIFEST_FILES } from "../providers/constants";
import { ConfigLoadError, loadPackageJson, loadRcFile } from "./utils";
import type { ConfigResult } from "./types";

const packageConfigResult = (
  filepath: string,
  config: Record<string, unknown> | string | null,
): ConfigResult | null => {
  if (!config) return null;
  if (typeof config !== "string") return { config, filepath };

  const configPath = resolve(dirname(filepath), config);
  if (!existsSync(configPath)) {
    throw new ConfigLoadError(filepath, `referenced config does not exist: ${config}`);
  }

  return { config: loadRcFile(configPath), filepath: configPath };
};

const loadPackageConfig = (filepath: string): ConfigResult | null =>
  packageConfigResult(filepath, loadPackageJson(filepath));

const loadCandidate = (directory: string, filename: string): ConfigResult | null => {
  const filepath = resolve(directory, filename);
  if (!existsSync(filepath)) return null;
  if (filename === MANIFEST_FILES.PACKAGE_JSON) return loadPackageConfig(filepath);
  return { config: loadRcFile(filepath), filepath };
};

const preferredPackageConfig = (
  directory: string,
): { config: ConfigResult | null; cause?: unknown } => {
  const filepath = resolve(directory, MANIFEST_FILES.PACKAGE_JSON);
  if (!existsSync(filepath)) return { config: null };

  let packageConfig: ReturnType<typeof loadPackageJson>;
  try {
    packageConfig = loadPackageJson(filepath);
  } catch (cause) {
    return { config: null, cause };
  }
  return { config: packageConfigResult(filepath, packageConfig) };
};

const loadConfigFromDirectory = (directory: string): ConfigResult | null => {
  const preferred = preferredPackageConfig(directory);
  if (preferred.config) return preferred.config;
  const rcConfig = CONFIG_FILES.slice(1).reduce<ConfigResult | null>(
    (result, filename) => result || loadCandidate(directory, filename),
    null,
  );
  if (rcConfig) return rcConfig;
  if (preferred.cause) throw preferred.cause;
  return null;
};

const searchForConfig = (searchFrom: string): ConfigResult | null => {
  let currentDir = resolve(searchFrom);
  const root = resolve("/");

  while (currentDir !== root) {
    const result = loadConfigFromDirectory(currentDir);
    if (result) return result;

    currentDir = dirname(currentDir);
  }

  return null;
};

export const loadConfig = (
  filepath?: string,
  searchFrom = process.cwd(),
): ConfigResult | null => {
  if (filepath) {
    const resolvedPath = resolve(filepath);

    if (!existsSync(resolvedPath)) {
      return null;
    }

    if (filepath.endsWith(MANIFEST_FILES.PACKAGE_JSON)) {
      return loadPackageConfig(resolvedPath);
    }

    return { config: loadRcFile(resolvedPath), filepath: resolvedPath };
  }

  return searchForConfig(searchFrom);
};
