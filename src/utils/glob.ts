import { readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import type { GlobOptions } from "./types";

const normalizePath = (path: string): string => path.replace(/\\/g, "/");

const escapeRegexChar = (char: string): string =>
  /[|\\{}()[\]^$+?.]/.test(char) ? `\\${char}` : char;

const findClosingBrace = (pattern: string, openIndex: number): number => {
  let depth = 0;

  for (let index = openIndex; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return index;
  }

  return -1;
};

const splitBraceParts = (content: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of content) {
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") depth--;
    current += char;
  }

  parts.push(current);
  return parts;
};

const expandBraces = (pattern: string): string[] => {
  const openIndex = pattern.indexOf("{");
  if (openIndex === -1) return [pattern];

  const closeIndex = findClosingBrace(pattern, openIndex);
  if (closeIndex === -1) return [pattern];

  const prefix = pattern.slice(0, openIndex);
  const suffix = pattern.slice(closeIndex + 1);
  const content = pattern.slice(openIndex + 1, closeIndex);

  return splitBraceParts(content).flatMap((part) =>
    expandBraces(`${prefix}${part}${suffix}`),
  );
};

const globToRegex = (pattern: string): RegExp => {
  const normalizedPattern = normalizePath(pattern);
  let source = "";

  for (let index = 0; index < normalizedPattern.length; index++) {
    const char = normalizedPattern[index];
    const nextChar = normalizedPattern[index + 1];
    const isGlobStar = char === "*" && nextChar === "*";

    if (isGlobStar) {
      const afterGlobStar = normalizedPattern[index + 2];
      const isDirectoryGlobStar = afterGlobStar === "/";
      if (isDirectoryGlobStar) {
        source += "(?:.*/)?";
        index += 2;
        continue;
      }

      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegexChar(char);
  }

  return new RegExp(`^${source}$`);
};

const createMatcher = (patterns: string[]): ((path: string) => boolean) => {
  const regexes = patterns.flatMap(expandBraces).map(globToRegex);
  return (path: string): boolean => {
    const normalizedPath = normalizePath(path);
    return regexes.some((regex) => regex.test(normalizedPath));
  };
};

const walkFiles = async (
  cwd: string,
  shouldIgnore?: (path: string) => boolean,
): Promise<string[]> => {
  const results: string[] = [];

  const walkDirectory = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const relativePath = normalizePath(relative(cwd, absolutePath));

      if (entry.isDirectory()) {
        if (shouldIgnore?.(relativePath) || shouldIgnore?.(`${relativePath}/__ignored__`)) continue;
        await walkDirectory(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  };

  await walkDirectory(cwd);
  return results;
};

export const glob = async (
  patterns: string | string[],
  options: GlobOptions = {},
): Promise<string[]> => {
  const { cwd = process.cwd(), ignore = [], absolute = false } = options;
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  const resolvedCwd = resolve(cwd);
  const matchesPattern = createMatcher(patternArray);
  const matchesIgnore = ignore.length > 0 ? createMatcher(ignore) : null;

  const allResults = new Set<string>();
  const files = await walkFiles(resolvedCwd, matchesIgnore || undefined);

  for (const file of files) {
    if (!matchesPattern(file)) continue;
    if (matchesIgnore?.(file)) continue;

    const fullPath = resolve(resolvedCwd, file);
    const finalPath = absolute ? fullPath : file;
    allResults.add(normalizePath(finalPath));
  }

  return Array.from(allResults).sort();
};
