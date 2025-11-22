import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import type { ConfigResult } from "./types";

const CONFIG_FILES = [
  ".codependencerc",
  ".codependencerc.json",
  "package.json",
];

const parseJSON = (content: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const loadPackageJson = (filepath: string): Record<string, unknown> | null => {
  const content = readFileSync(filepath, "utf8");
  const json = parseJSON(content);
  if (!json) return null;

  const codependenceConfig = json.codependence;
  if (!codependenceConfig || typeof codependenceConfig !== "object") {
    return null;
  }

  return codependenceConfig as Record<string, unknown>;
};

const loadRcFile = (filepath: string): Record<string, unknown> | null => {
  const content = readFileSync(filepath, "utf8");
  return parseJSON(content);
};

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
