import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { CONFIG_FILES } from "./constants";
import { MANIFEST_FILES } from "../providers/constants";
import { loadPackageJson, loadRcFile } from "./utils";
import type { ConfigResult } from "./types";

const loadConfigFromDirectory = (directory: string): ConfigResult | null => {
  const filename = CONFIG_FILES.find((candidate) => existsSync(resolve(directory, candidate)));
  if (!filename) return null;

  const filepath = resolve(directory, filename);
  if (filename !== MANIFEST_FILES.PACKAGE_JSON) {
    return { config: loadRcFile(filepath), filepath };
  }

  const config = loadPackageJson(filepath);
  return config ? { config, filepath } : null;
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
      const config = loadPackageJson(resolvedPath);
      return config ? { config, filepath: resolvedPath } : null;
    }

    return { config: loadRcFile(resolvedPath), filepath: resolvedPath };
  }

  return searchForConfig(searchFrom);
};
