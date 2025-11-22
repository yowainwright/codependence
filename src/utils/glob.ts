import { glob as fsGlob } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { GlobOptions } from "./types";

export const glob = async (
  patterns: string | string[],
  options: GlobOptions = {},
): Promise<string[]> => {
  const { cwd = process.cwd(), ignore = [], absolute = false } = options;
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  const allResults = new Set<string>();

  for (const pattern of patternArray) {
    const iterator = fsGlob(pattern, {
      cwd,
      exclude: ignore,
    });

    for await (const result of iterator) {
      const fullPath = resolve(cwd, result);
      const finalPath = absolute ? fullPath : relative(cwd, fullPath);
      allResults.add(finalPath);
    }
  }

  return Array.from(allResults).sort();
};
