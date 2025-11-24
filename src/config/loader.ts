import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { CONFIG_FILES } from "./constants";
import { loadPackageJson, loadRcFile } from "./utils";
import type { ConfigResult } from "./types";

const searchForConfig = (searchFrom: string): ConfigResult | null => {
  let currentDir = resolve(searchFrom);
  const root = resolve("/");

  while (currentDir !== root) {
    for (const filename of CONFIG_FILES) {
      const filepath = resolve(currentDir, filename);

      if (!existsSync(filepath)) continue;

      let config: Record<string, unknown> | null = null;

      if (filename === "package.json") {
        config = loadPackageJson(filepath);
      } else {
        config = loadRcFile(filepath);
      }

      if (config) {
        return { config, filepath };
      }
    }

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

    if (filepath.endsWith("package.json")) {
      const config = loadPackageJson(resolvedPath);
      return config ? { config, filepath: resolvedPath } : null;
    }

    const config = loadRcFile(resolvedPath);
    return config ? { config, filepath: resolvedPath } : null;
  }

  return searchForConfig(searchFrom);
};
