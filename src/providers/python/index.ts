import { readFileSync, writeFileSync } from "fs";
import { exec } from "../../utils/exec";
import {
  PYTHON_PATTERNS,
  type PythonManifestType,
  type PythonPackageManager,
} from "./constants";
import type {
  DependencyProvider,
  DependencyManifest,
  ProviderOptions,
} from "../types";

const parseRequirementLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();

  if (!trimmed || PYTHON_PATTERNS.COMMENT.test(trimmed)) {
    return null;
  }

  const match = trimmed.match(PYTHON_PATTERNS.REQUIREMENT_LINE);
  if (!match) return null;

  return [match[1], `${match[2]}${match[3]}`];
};

const parsePoetryLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  const match = trimmed.match(PYTHON_PATTERNS.POETRY_LINE);

  if (!match || match[1] === "python") return null;

  return [match[1], match[2]];
};

export class PythonProvider implements DependencyProvider {
  readonly language = "python" as const;
  private options: ProviderOptions;
  private manifestType: PythonManifestType;
  private packageManager: PythonPackageManager;

  constructor(
    manifestPath: string,
    packageManager: PythonPackageManager = "pip",
    providerOptions: ProviderOptions = {},
  ) {
    this.options = providerOptions;
    this.manifestType = this.detectManifestType(manifestPath);
    this.packageManager = packageManager;
  }

  private detectManifestType(manifestPath: string): PythonManifestType {
    if (manifestPath.endsWith("requirements.txt")) return "requirements";
    if (manifestPath.endsWith("pyproject.toml")) return "pyproject";
    if (manifestPath.endsWith("Pipfile")) return "pipfile";
    if (
      manifestPath.endsWith("environment.yml") ||
      manifestPath.endsWith("environment.yaml")
    ) {
      return "conda";
    }
    return "requirements";
  }

  async getLatestVersion(packageName: string): Promise<string> {
    if (this.packageManager === "conda") {
      return this.getCondaVersion(packageName);
    }

    if (this.packageManager === "uv") {
      return this.getUvVersion(packageName);
    }

    return this.getPipVersion(packageName);
  }

  private async getPipVersion(packageName: string): Promise<string> {
    try {
      const { stdout } = await exec("pip", ["index", "versions", packageName]);
      const match = stdout.match(PYTHON_PATTERNS.PIP_VERSIONS);
      if (!match) return "";

      const firstVersion = match[1].split(",")[0];
      return firstVersion ? firstVersion.trim() : "";
    } catch (error) {
      if (this.options.debug) {
        console.error(`Failed to get pip version for ${packageName}:`, error);
      }
      return "";
    }
  }

  private async getCondaVersion(packageName: string): Promise<string> {
    try {
      const { stdout } = await exec("conda", ["search", packageName, "--json"]);
      const results = JSON.parse(stdout);
      const packages = results[packageName];
      if (!packages || packages.length === 0) return "";

      const latestPackage = packages[packages.length - 1];
      return latestPackage?.version || "";
    } catch (error) {
      if (this.options.debug) {
        console.error(`Failed to get conda version for ${packageName}:`, error);
      }
      return "";
    }
  }

  private async getUvVersion(packageName: string): Promise<string> {
    try {
      const { stdout } = await exec("uv", [
        "pip",
        "index",
        "versions",
        packageName,
      ]);
      const match = stdout.match(PYTHON_PATTERNS.PIP_VERSIONS);
      if (!match) return "";

      const firstVersion = match[1].split(",")[0];
      return firstVersion ? firstVersion.trim() : "";
    } catch (error) {
      if (this.options.debug) {
        console.error(`Failed to get uv version for ${packageName}:`, error);
      }
      return "";
    }
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    const { stdout } = await exec("pip", ["index", "versions", packageName]);
    const match = stdout.match(PYTHON_PATTERNS.PIP_VERSIONS);
    if (!match) return [];

    return match[1].split(",").map((v) => v.trim());
  }

  async readManifest(filePath: string): Promise<DependencyManifest> {
    if (this.manifestType === "requirements") {
      return this.readRequirementsTxt(filePath);
    }

    if (this.manifestType === "pyproject") {
      return this.readPyprojectToml(filePath);
    }

    return this.readPipfile(filePath);
  }

  private readRequirementsTxt(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const dependencies: Record<string, string> = {};

    content.split("\n").forEach((line) => {
      const parsed = parseRequirementLine(line);
      if (!parsed) return;
      dependencies[parsed[0]] = parsed[1];
    });

    return { filePath, dependencies };
  }

  private readPyprojectToml(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const dependencies: Record<string, string> = {};

    const depSection = content.match(PYTHON_PATTERNS.POETRY_DEPS);
    if (!depSection) return { filePath, dependencies };

    const lines = depSection[1].split("\n");
    lines.forEach((line) => {
      const parsed = parsePoetryLine(line);
      if (!parsed) return;
      dependencies[parsed[0]] = parsed[1];
    });

    return { filePath, dependencies };
  }

  private readPipfile(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const dependencies: Record<string, string> = {};

    const packagesSection = content.match(PYTHON_PATTERNS.PIPFILE_PACKAGES);
    if (!packagesSection) return { filePath, dependencies };

    const lines = packagesSection[1].split("\n");
    lines.forEach((line) => {
      const match = line.trim().match(PYTHON_PATTERNS.PIPFILE_LINE);
      if (!match) return;
      dependencies[match[1]] = match[2];
    });

    return { filePath, dependencies };
  }

  async writeManifest(
    filePath: string,
    manifest: DependencyManifest,
  ): Promise<void> {
    if (this.manifestType === "requirements") {
      this.writeRequirementsTxt(filePath, manifest);
      return;
    }

    if (this.manifestType === "pyproject") {
      this.writePyprojectToml(filePath, manifest);
      return;
    }

    this.writePipfile(filePath, manifest);
  }

  private writeRequirementsTxt(
    filePath: string,
    manifest: DependencyManifest,
  ): void {
    const lines = Object.entries(manifest.dependencies)
      .map(([name, version]) => `${name}${version}`)
      .join("\n");
    writeFileSync(filePath, lines + "\n");
  }

  private writePyprojectToml(
    filePath: string,
    manifest: DependencyManifest,
  ): void {
    const content = readFileSync(filePath, "utf8");
    const depEntries = Object.entries(manifest.dependencies)
      .map(([name, version]) => `${name} = "${version}"`)
      .join("\n");

    const replacement = `[tool.poetry.dependencies]\npython = "^3.8"\n${depEntries}\n\n`;
    const updated = content.replace(PYTHON_PATTERNS.POETRY_DEPS, replacement);

    writeFileSync(filePath, updated);
  }

  private writePipfile(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const depEntries = Object.entries(manifest.dependencies)
      .map(([name, version]) => `${name} = "${version}"`)
      .join("\n");

    const replacement = `[packages]\n${depEntries}\n\n`;
    const updated = content.replace(
      PYTHON_PATTERNS.PIPFILE_PACKAGES,
      replacement,
    );

    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    return PYTHON_PATTERNS.PACKAGE_NAME.test(packageName);
  }
}
