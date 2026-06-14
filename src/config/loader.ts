import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { CONFIG_FILES } from "./constants";
import { MANIFEST_FILES } from "../providers/constants";
import { loadPackageJson, loadRcFile } from "./utils";
import type { ConfigResult } from "./types";

const searchForConfig = (searchFrom: string): ConfigResult | null => {
  let currentDir = resolve(searchFrom);
  const root = resolve("/");

  while (currentDir !== root) {
    for (const filename of CONFIG_FILES) {
      const filepath = resolve(currentDir, filename);

      if (!existsSync(filepath)) continue;

      if (filename === MANIFEST_FILES.PACKAGE_JSON) {
        const config = loadPackageJson(filepath);
        if (config) return { config, filepath };
        continue;
      }

      return { config: loadRcFile(filepath), filepath };
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

    if (filepath.endsWith(MANIFEST_FILES.PACKAGE_JSON)) {
      const config = loadPackageJson(resolvedPath);
      return config ? { config, filepath: resolvedPath } : null;
    }

    return { config: loadRcFile(resolvedPath), filepath: resolvedPath };
  }

  return searchForConfig(searchFrom);
};
