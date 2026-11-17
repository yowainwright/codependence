import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { dirname } from "path";
import { runBinaryExecFileSync } from "../../cli/utils";
import { exec } from "../../utils/process";
import { logger } from "../../observability";
import { LANGUAGES } from "../constants";
import { GO_PATTERNS } from "./constants";
import type { DependencyProvider, DependencyManifest, ProviderOptions } from "../types";

import {
  preserveFinalNewline,
  updateExistingRequireLines,
  buildRequireBlock,
  parseManifest,
  capabilities,
} from "./utils";
export {
  isReplaceBlockStart,
  isExcludeBlockStart,
  isBlockClose,
  isReplaceLine,
  preserveFinalNewline,
  updateRequireLine,
  processLine,
  updateExistingRequireLines,
  parseRequireBlock,
  parseSingleRequires,
  buildRequireBlock,
} from "./utils";

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
  readonly capabilities = capabilities;

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
    return parseManifest(filePath, content);
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
