import { readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { exec } from "../../utils/exec";
import { GO_PATTERNS } from "./constants";
import type {
  DependencyProvider,
  DependencyManifest,
  ProviderOptions,
} from "../types";

const parseRequireBlock = (content: string): Record<string, string> => {
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

const parseSingleRequires = (content: string): Record<string, string> => {
  const dependencies: Record<string, string> = {};
  const singleRequireMatches = content.matchAll(GO_PATTERNS.REQUIRE_LINE);

  for (const match of singleRequireMatches) {
    dependencies[match[1]] = match[2];
  }

  return dependencies;
};

const buildRequireBlock = (dependencies: Record<string, string>): string => {
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
    const requireBlock = buildRequireBlock(manifest.dependencies);

    const hasMultiLineRequire = GO_PATTERNS.REQUIRE_BLOCK.test(content);
    if (hasMultiLineRequire) {
      const updated = content.replace(GO_PATTERNS.REQUIRE_BLOCK, requireBlock);
      writeFileSync(filePath, updated + "\n");
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
        console.error("Failed to run go mod tidy:", error);
      }
    }
  }

  validatePackageName(packageName: string): boolean {
    return GO_PATTERNS.PACKAGE_NAME.test(packageName);
  }
}
