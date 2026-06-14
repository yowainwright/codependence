import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { dirname } from "path";
import { exec } from "../../utils/exec";
import { logger } from "../../logger";
import { LANGUAGES } from "../constants";
import { GO_PATTERNS } from "./constants";
import type {
  DependencyProvider,
  DependencyManifest,
  ProviderOptions,
} from "../types";

type LineState = {
  readonly inReplaceBlock: boolean;
  readonly inExcludeBlock: boolean;
};

export const isReplaceBlockStart = (line: string): boolean =>
  GO_PATTERNS.REPLACE_BLOCK_START.test(line);

export const isExcludeBlockStart = (line: string): boolean =>
  GO_PATTERNS.EXCLUDE_BLOCK_START.test(line);

export const isBlockClose = (line: string): boolean =>
  GO_PATTERNS.BLOCK_CLOSE.test(line);

export const isReplaceLine = (line: string): boolean =>
  GO_PATTERNS.REPLACE_LINE.test(line);

export const preserveFinalNewline = (content: string): string =>
  content.endsWith("\n") ? content : content + "\n";

export const updateRequireLine = (
  line: string,
  dependencies: Record<string, string>,
): { line: string; updated: boolean; found: boolean } => {
  if (isReplaceLine(line)) return { line, updated: false, found: false };

  const match = line.match(GO_PATTERNS.DEP_UPDATE_LINE);
  if (!match) return { line, updated: false, found: false };

  const [, prefix, pkgName, space, currentVersion, rest] = match;
  const newVersion = dependencies[pkgName];
  if (!newVersion) return { line, updated: false, found: false };

  const isSameVersion = newVersion === currentVersion;
  if (isSameVersion) return { line, updated: false, found: true };

  return { line: `${prefix}${pkgName}${space}${newVersion}${rest}`, updated: true, found: true };
};

export const processLine = (
  line: string,
  state: LineState,
  dependencies: Record<string, string>,
): { line: string; state: LineState; updated: boolean; found: boolean } => {
  if (state.inReplaceBlock) {
    if (isBlockClose(line)) {
      return { line, state: { ...state, inReplaceBlock: false }, updated: false, found: false };
    }
    return { line, state, updated: false, found: false };
  }

  if (state.inExcludeBlock) {
    if (isBlockClose(line)) {
      return { line, state: { ...state, inExcludeBlock: false }, updated: false, found: false };
    }
    return { line, state, updated: false, found: false };
  }

  if (isReplaceBlockStart(line)) {
    return { line, state: { ...state, inReplaceBlock: true }, updated: false, found: false };
  }

  if (isExcludeBlockStart(line)) {
    return { line, state: { ...state, inExcludeBlock: true }, updated: false, found: false };
  }

  if (isReplaceLine(line)) {
    return { line, state, updated: false, found: false };
  }

  const { line: updatedLine, updated, found } = updateRequireLine(line, dependencies);
  return { line: updatedLine, state, updated, found };
};

type ProcessLinesResult = {
  readonly lines: string[];
  readonly updatedCount: number;
  readonly foundCount: number;
};

const processLines = (
  lines: string[],
  dependencies: Record<string, string>,
): ProcessLinesResult => {
  const initial: { lines: string[]; state: LineState; updatedCount: number; foundCount: number } = {
    lines: [],
    state: { inReplaceBlock: false, inExcludeBlock: false },
    updatedCount: 0,
    foundCount: 0,
  };

  return lines.reduce((acc, line) => {
    const result = processLine(line, acc.state, dependencies);
    return {
      lines: [...acc.lines, result.line],
      state: result.state,
      updatedCount: acc.updatedCount + (result.updated ? 1 : 0),
      foundCount: acc.foundCount + (result.found ? 1 : 0),
    };
  }, initial);
};

export const updateExistingRequireLines = (
  content: string,
  dependencies: Record<string, string>,
): { content: string; updatedCount: number; foundCount: number } => {
  const { lines, updatedCount, foundCount } = processLines(content.split("\n"), dependencies);
  return { content: lines.join("\n"), updatedCount, foundCount };
};

export const parseRequireBlock = (content: string): Record<string, string> => {
  const dependencies: Record<string, string> = {};
  const requireBlock = content.match(GO_PATTERNS.REQUIRE_BLOCK);

  if (!requireBlock) return dependencies;

  const lines = requireBlock[1].split("\n");
  lines.forEach((line) => {
    const match = line.trim().match(GO_PATTERNS.DEPENDENCY_LINE);
    if (!match) return;
    dependencies[match[1]] = match[2];
  });

  return dependencies;
};

export const parseSingleRequires = (content: string): Record<string, string> => {
  const dependencies: Record<string, string> = {};
  const singleRequireMatches = content.matchAll(GO_PATTERNS.REQUIRE_LINE);

  for (const match of singleRequireMatches) {
    dependencies[match[1]] = match[2];
  }

  return dependencies;
};

export const buildRequireBlock = (dependencies: Record<string, string>): string => {
  const requireEntries = Object.entries(dependencies)
    .map(([name, version]) => `\t${name} ${version}`)
    .join("\n");

  return `require (\n${requireEntries}\n)`;
};

export class GoProvider implements DependencyProvider {
  readonly language = LANGUAGES.GO;
  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const { stdout } = await exec(LANGUAGES.GO, [
      "list",
      "-m",
      "-versions",
      packageName,
    ]);
    const versions = stdout
      .split(" ")
      .filter((v) => GO_PATTERNS.VERSION_PREFIX.test(v));
    return versions[versions.length - 1] || "";
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const { stdout } = await exec(LANGUAGES.GO, [
      "list",
      "-m",
      "-versions",
      packageName,
    ]);
    return stdout.split(" ").filter((v) => GO_PATTERNS.VERSION_PREFIX.test(v));
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");

    const moduleMatch = content.match(GO_PATTERNS.MODULE);
    const moduleName = moduleMatch ? moduleMatch[1].trim() : undefined;

    const goVersionMatch = content.match(GO_PATTERNS.GO_VERSION);
    const goVersion = goVersionMatch ? goVersionMatch[1].trim() : undefined;

    const blockDeps = parseRequireBlock(content);
    const singleDeps = parseSingleRequires(content);
    const dependencies = { ...blockDeps, ...singleDeps };

    return {
      filePath,
      name: moduleName,
      version: goVersion,
      dependencies,
    };
  }

  writeManifest(
    filePath: string,
    manifest: DependencyManifest,
  ): void {
    const content = readFileSync(filePath, "utf8");

    const { content: inPlaceContent, updatedCount, foundCount } = updateExistingRequireLines(
      content,
      manifest.dependencies,
    );

    if (updatedCount > 0 || foundCount > 0) {
      writeFileSync(filePath, preserveFinalNewline(inPlaceContent));
      this.runGoModTidy(filePath);
      return;
    }

    const requireBlock = buildRequireBlock(manifest.dependencies);

    const hasMultiLineRequire = GO_PATTERNS.REQUIRE_BLOCK.test(content);
    if (hasMultiLineRequire) {
      const updated = content.replace(GO_PATTERNS.REQUIRE_BLOCK, requireBlock);
      writeFileSync(filePath, preserveFinalNewline(updated));
      this.runGoModTidy(filePath);
      return;
    }

    const hasSingleRequires = GO_PATTERNS.REQUIRE_LINE.test(content);
    if (hasSingleRequires) {
      const updated = content.replace(GO_PATTERNS.REQUIRE_LINE, "").trim();
      writeFileSync(filePath, `${updated}\n\n${requireBlock}\n`);
      this.runGoModTidy(filePath);
      return;
    }

    writeFileSync(filePath, `${content.trim()}\n\n${requireBlock}\n`);
    this.runGoModTidy(filePath);
  }

  private runGoModTidy(filePath: string): void {
    if (this.options.isTesting) return;

    try {
      execFileSync(LANGUAGES.GO, ["mod", "tidy"], {
        cwd: dirname(filePath),
        stdio: "ignore",
      });
    } catch (error) {
      if (this.options.debug) {
        logger.error("Failed to run go mod tidy", error as Error);
      }
    }
  }

  validatePackageName(packageName: string): boolean {
    return GO_PATTERNS.PACKAGE_NAME.test(packageName);
  }
}
