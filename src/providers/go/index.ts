import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { dirname } from "path";
import { runBinaryExecFileSync } from "../../cli/utils";
import { exec } from "../../utils/process";
import { logger } from "../../observability";
import { LANGUAGES } from "../constants";
import { GO_PATTERNS } from "./constants";
import type {
  DependencyProvider,
  DependencyManifest,
  GoDependencyLineResult,
  GoLineState,
  GoProcessedLine,
  GoProcessLinesResult,
  GoProcessLinesState,
  GoUpdateResult,
  ProviderOptions,
} from "../types";

export const isReplaceBlockStart = (line: string): boolean =>
  GO_PATTERNS.REPLACE_BLOCK_START.exec(line) !== null;

export const isExcludeBlockStart = (line: string): boolean =>
  GO_PATTERNS.EXCLUDE_BLOCK_START.exec(line) !== null;

export const isBlockClose = (line: string): boolean => GO_PATTERNS.BLOCK_CLOSE.exec(line) !== null;

export const isReplaceLine = (line: string): boolean => GO_PATTERNS.REPLACE_LINE.exec(line) !== null;

export const preserveFinalNewline = (content: string): string =>
  content.endsWith("\n") ? content : content + "\n";

export const updateRequireLine = (
  line: string,
  dependencies: Record<string, string>,
): GoDependencyLineResult => {
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
  state: GoLineState,
  dependencies: Record<string, string>,
): GoProcessedLine => {
  if (state.inReplaceBlock) {
    if (isBlockClose(line)) {
      return {
        line,
        state: Object.assign({}, state, { inReplaceBlock: false }),
        updated: false,
        found: false,
      };
    }
    return { line, state, updated: false, found: false };
  }

  if (state.inExcludeBlock) {
    if (isBlockClose(line)) {
      return {
        line,
        state: Object.assign({}, state, { inExcludeBlock: false }),
        updated: false,
        found: false,
      };
    }
    return { line, state, updated: false, found: false };
  }

  if (isReplaceBlockStart(line)) {
    return {
      line,
      state: Object.assign({}, state, { inReplaceBlock: true }),
      updated: false,
      found: false,
    };
  }

  if (isExcludeBlockStart(line)) {
    return {
      line,
      state: Object.assign({}, state, { inExcludeBlock: true }),
      updated: false,
      found: false,
    };
  }

  if (isReplaceLine(line)) {
    return { line, state, updated: false, found: false };
  }

  const { line: updatedLine, updated, found } = updateRequireLine(line, dependencies);
  return { line: updatedLine, state, updated, found };
};

const processLines = (
  lines: string[],
  dependencies: Record<string, string>,
): GoProcessLinesResult => {
  const initial: GoProcessLinesState = {
    lines: [],
    state: { inReplaceBlock: false, inExcludeBlock: false },
    updatedCount: 0,
    foundCount: 0,
  };

  return lines.reduce((acc, line) => {
    const result = processLine(line, acc.state, dependencies);
    const updatedCount = acc.updatedCount + (result.updated ? 1 : 0);
    const foundCount = acc.foundCount + (result.found ? 1 : 0);
    return {
      lines: acc.lines.concat(result.line),
      state: result.state,
      updatedCount,
      foundCount,
    };
  }, initial);
};

export const updateExistingRequireLines = (
  content: string,
  dependencies: Record<string, string>,
): GoUpdateResult => {
  const { lines, updatedCount, foundCount } = processLines(content.split("\n"), dependencies);
  return { content: lines.join("\n"), updatedCount, foundCount };
};

const parseDependencyLine = (line: string): [string, string] | null => {
  const match = line.trim().match(GO_PATTERNS.DEPENDENCY_LINE);
  return match ? [match[1], match[2]] : null;
};

const parseRequireBlockEntries = (block: string): Array<[string, string]> =>
  block
    .split("\n")
    .map(parseDependencyLine)
    .filter((entry): entry is [string, string] => entry !== null);

export const parseRequireBlock = (content: string): Record<string, string> => {
  const requireBlocks = content.matchAll(GO_PATTERNS.REQUIRE_BLOCKS);
  const entries = Array.from(requireBlocks).flatMap((match) => parseRequireBlockEntries(match[1]));

  return Object.fromEntries(entries);
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

export const runGoModTidy = (
  filePath: string,
  options: ProviderOptions,
  execute: typeof execFileSync = execFileSync,
): void => {
  const shouldRegenerateLockfile = options.regenerateLockfile ?? true;
  const shouldSkip = options.isTesting || !shouldRegenerateLockfile;
  if (shouldSkip) return;

  try {
    const ranWithBinaryHost = runBinaryExecFileSync(
      LANGUAGES.GO,
      ["mod", "tidy"],
      dirname(filePath),
    );
    if (ranWithBinaryHost) return;

    execute(LANGUAGES.GO, ["mod", "tidy"], {
      cwd: dirname(filePath),
      stdio: "ignore",
    });
  } catch (error) {
    if (options.debug) logger.error("Failed to run go mod tidy", error as Error);
    throw error;
  }
};

const writeGoMod = (filePath: string, content: string, options: ProviderOptions): void => {
  writeFileSync(filePath, content);
  runGoModTidy(filePath, options);
};

export class GoProvider implements DependencyProvider {
  readonly language = LANGUAGES.GO;
  readonly capabilities = {
    supportsLatestResolution: true,
    supportsPreciseMode: true,
    versionStrategy: "semver",
  } as const;

  private options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const { stdout } = await exec(LANGUAGES.GO, ["list", "-m", "-versions", packageName]);
    const versions = stdout.split(" ").filter((v) => GO_PATTERNS.VERSION_PREFIX.test(v));
    return versions.at(-1) ?? "";
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const { stdout } = await exec(LANGUAGES.GO, ["list", "-m", "-versions", packageName]);
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
    const dependencies = Object.assign({}, blockDeps, singleDeps);

    return {
      filePath,
      name: moduleName,
      version: goVersion,
      dependencies,
    };
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");

    const {
      content: inPlaceContent,
      updatedCount,
      foundCount,
    } = updateExistingRequireLines(content, manifest.dependencies);

    const hasExistingDependencies = updatedCount > 0 || foundCount > 0;
    if (hasExistingDependencies) {
      writeGoMod(filePath, preserveFinalNewline(inPlaceContent), this.options);
      return;
    }

    const requireBlock = buildRequireBlock(manifest.dependencies);

    const hasMultiLineRequire = GO_PATTERNS.REQUIRE_BLOCK.test(content);
    if (hasMultiLineRequire) {
      const updated = content.replace(GO_PATTERNS.REQUIRE_BLOCK, requireBlock);
      writeGoMod(filePath, preserveFinalNewline(updated), this.options);
      return;
    }

    const hasSingleRequires = GO_PATTERNS.REQUIRE_LINE.test(content);
    if (hasSingleRequires) {
      const updated = content.replace(GO_PATTERNS.REQUIRE_LINE, "").trim();
      writeGoMod(filePath, `${updated}\n\n${requireBlock}\n`, this.options);
      return;
    }

    writeGoMod(filePath, `${content.trim()}\n\n${requireBlock}\n`, this.options);
  }

  validatePackageName(packageName: string): boolean {
    return GO_PATTERNS.PACKAGE_NAME.exec(packageName) !== null;
  }
}
