import { readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { exec } from "../../utils/exec";
import { logger } from "../../logger";
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
): { line: string; updated: boolean } => {
  if (isReplaceLine(line)) return { line, updated: false };

  const match = line.match(GO_PATTERNS.DEP_UPDATE_LINE);
  if (!match) return { line, updated: false };

  const [, prefix, pkgName, space, currentVersion, rest] = match;
  const newVersion = dependencies[pkgName];
  const isSameVersion = newVersion === currentVersion;
  if (!newVersion || isSameVersion) return { line, updated: false };

  return { line: `${prefix}${pkgName}${space}${newVersion}${rest}`, updated: true };
};

export const processLine = (
  line: string,
  state: LineState,
  dependencies: Record<string, string>,
): { line: string; state: LineState; updated: boolean } => {
  if (state.inReplaceBlock) {
    if (isBlockClose(line)) {
      return { line, state: { ...state, inReplaceBlock: false }, updated: false };
    }
    return { line, state, updated: false };
  }

  if (state.inExcludeBlock) {
    if (isBlockClose(line)) {
      return { line, state: { ...state, inExcludeBlock: false }, updated: false };
    }
    return { line, state, updated: false };
  }

  if (isReplaceBlockStart(line)) {
    return { line, state: { ...state, inReplaceBlock: true }, updated: false };
  }

  if (isExcludeBlockStart(line)) {
    return { line, state: { ...state, inExcludeBlock: true }, updated: false };
  }

  if (isReplaceLine(line)) {
    return { line, state, updated: false };
  }

  const { line: updatedLine, updated } = updateRequireLine(line, dependencies);
  return { line: updatedLine, state, updated };
};

export const updateExistingRequireLines = (
  content: string,
  dependencies: Record<string, string>,
): { content: string; updatedCount: number } => {
  const lines = content.split("\n");
  const initialState: LineState = { inReplaceBlock: false, inExcludeBlock: false };

  const { lines: resultLines, updatedCount } = lines.reduce<{
    lines: string[];
    state: LineState;
    updatedCount: number;
  }>(
    (acc, line) => {
      const result = processLine(line, acc.state, dependencies);
      return {
        lines: [...acc.lines, result.line],
        state: result.state,
        updatedCount: acc.updatedCount + (result.updated ? 1 : 0),
      };
    },
    { lines: [], state: initialState, updatedCount: 0 },
  );

  return { content: resultLines.join("\n"), updatedCount };
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
  readonly language = "go" as const;
  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const { stdout } = await exec("go", [
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
    const { stdout } = await exec("go", [
      "list",
      "-m",
      "-versions",
      packageName,
    ]);
    return stdout.split(" ").filter((v) => GO_PATTERNS.VERSION_PREFIX.test(v));
  }

  async readManifest(filePath: string): Promise<DependencyManifest> {
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

  async writeManifest(
    filePath: string,
    manifest: DependencyManifest,
  ): Promise<void> {
    const content = readFileSync(filePath, "utf8");

    const { content: inPlaceContent, updatedCount } = updateExistingRequireLines(
      content,
      manifest.dependencies,
    );

    if (updatedCount > 0) {
      writeFileSync(filePath, preserveFinalNewline(inPlaceContent));
      await this.runGoModTidy(filePath);
      return;
    }

    const requireBlock = buildRequireBlock(manifest.dependencies);

    const hasMultiLineRequire = GO_PATTERNS.REQUIRE_BLOCK.test(content);
    if (hasMultiLineRequire) {
      const updated = content.replace(GO_PATTERNS.REQUIRE_BLOCK, requireBlock);
      writeFileSync(filePath, preserveFinalNewline(updated));
      await this.runGoModTidy(filePath);
      return;
    }

    const hasSingleRequires = GO_PATTERNS.REQUIRE_LINE.test(content);
    if (hasSingleRequires) {
      const updated = content.replace(GO_PATTERNS.REQUIRE_LINE, "").trim();
      writeFileSync(filePath, `${updated}\n\n${requireBlock}\n`);
      await this.runGoModTidy(filePath);
      return;
    }

    writeFileSync(filePath, `${content.trim()}\n\n${requireBlock}\n`);
    await this.runGoModTidy(filePath);
  }

  private async runGoModTidy(filePath: string): Promise<void> {
    if (this.options.isTesting) return;

    try {
      await exec("go", ["mod", "tidy"], { cwd: dirname(filePath) });
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
