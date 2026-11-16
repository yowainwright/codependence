import { readFileSync, writeFileSync } from "fs";
import { exec } from "../../utils/process";
import { logger } from "../../observability";
import { LANGUAGES } from "../constants";
import {
  CONDA_MANIFEST_FILES,
  MANIFEST_FILES,
  PYTHON_MANIFEST_TYPES,
  PYTHON_PATTERNS,
  PYTHON_PACKAGE_MANAGERS,
} from "./constants";
import type {
  CondaWriteState,
  DependencyProvider,
  DependencyManifest,
  ProviderOptions,
  PyprojectArrayContext,
  PythonManifestType,
  PythonPackageManager,
} from "../types";

import {
  updateCondaLine,
  updatePoetryDependencies,
  readPyprojectArrayContext,
  lineClosesPyprojectArray,
  updatePyprojectDependencySpec,
  updatePyprojectDependencyLine,
  parseManifest,
  capabilities,
} from "./utils";
export { parseRequirementLine, parsePoetryLine, parseCondaDependencyLine } from "./utils";

export class PythonProvider implements DependencyProvider {
  readonly language = LANGUAGES.PYTHON;
  readonly capabilities = capabilities;
  private options: ProviderOptions;
  private manifestType: PythonManifestType;
  private packageManager: PythonPackageManager;

  constructor(
    manifestPath: string,
    packageManager: PythonPackageManager = PYTHON_PACKAGE_MANAGERS.PIP,
    providerOptions: ProviderOptions = {},
  ) {
    this.options = providerOptions;
    this.manifestType = this.detectManifestType(manifestPath);
    this.packageManager = packageManager;
  }

  private detectManifestType(manifestPath: string): PythonManifestType {
    if (manifestPath.endsWith(MANIFEST_FILES.REQUIREMENTS)) {
      return PYTHON_MANIFEST_TYPES.REQUIREMENTS;
    }
    if (manifestPath.endsWith(MANIFEST_FILES.PYPROJECT)) {
      return PYTHON_MANIFEST_TYPES.PYPROJECT;
    }
    if (manifestPath.endsWith(MANIFEST_FILES.PIPFILE)) {
      return PYTHON_MANIFEST_TYPES.PIPFILE;
    }
    if (CONDA_MANIFEST_FILES.some((file) => manifestPath.endsWith(file))) {
      return PYTHON_MANIFEST_TYPES.CONDA;
    }
    return PYTHON_MANIFEST_TYPES.REQUIREMENTS;
  }

  getLatestVersion(packageName: string): Promise<string> {
    if (this.packageManager === PYTHON_PACKAGE_MANAGERS.CONDA) {
      return this.getCondaVersion(packageName);
    }

    if (this.packageManager === PYTHON_PACKAGE_MANAGERS.UV) {
      return this.getUvVersion(packageName);
    }

    return this.getPipVersion(packageName);
  }

  private async getPipVersion(packageName: string): Promise<string> {
    try {
      const { stdout } = await exec(PYTHON_PACKAGE_MANAGERS.PIP, [
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
        logger.error(`Failed to get pip version for ${packageName}`, error as Error);
      }
      return "";
    }
  }

  private async getCondaVersion(packageName: string): Promise<string> {
    try {
      const { stdout } = await exec(PYTHON_PACKAGE_MANAGERS.CONDA, [
        "search",
        packageName,
        "--json",
      ]);
      const results = JSON.parse(stdout);
      const packages = results[packageName];
      const hasPackages = Boolean(packages?.length);
      if (!hasPackages) return "";

      const latestPackage = packages[packages.length - 1];
      return latestPackage?.version || "";
    } catch (error) {
      if (this.options.debug) {
        logger.error(`Failed to get conda version for ${packageName}`, error as Error);
      }
      return "";
    }
  }

  private async getUvVersion(packageName: string): Promise<string> {
    try {
      const { stdout } = await exec(PYTHON_PACKAGE_MANAGERS.UV, [
        PYTHON_PACKAGE_MANAGERS.PIP,
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
        logger.error(`Failed to get uv version for ${packageName}`, error as Error);
      }
      return "";
    }
  }

  async getAllVersions(packageName: string): Promise<string[]> {
    try {
      if (this.packageManager === PYTHON_PACKAGE_MANAGERS.CONDA) {
        const { stdout } = await exec(PYTHON_PACKAGE_MANAGERS.CONDA, [
          "search",
          packageName,
          "--json",
        ]);
        const results = JSON.parse(stdout);
        const packages = results[packageName];
        const hasPackages = Boolean(packages?.length);
        if (!hasPackages) return [];
        return Array.from(new Set<string>(packages.map((p: { version: string }) => p.version)));
      }
      const command =
        this.packageManager === PYTHON_PACKAGE_MANAGERS.UV
          ? PYTHON_PACKAGE_MANAGERS.UV
          : PYTHON_PACKAGE_MANAGERS.PIP;
      const args =
        this.packageManager === PYTHON_PACKAGE_MANAGERS.UV
          ? [PYTHON_PACKAGE_MANAGERS.PIP, "index", "versions", packageName]
          : ["index", "versions", packageName];
      const { stdout } = await exec(command, args);
      const match = stdout.match(PYTHON_PATTERNS.PIP_VERSIONS);
      if (!match) return [];

      return match[1].split(",").map((v) => v.trim());
    } catch (error) {
      if (this.options.debug) {
        logger.error(`Failed to get all versions for ${packageName}`, error as Error);
      }
      return [];
    }
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return parseManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    if (this.manifestType === PYTHON_MANIFEST_TYPES.REQUIREMENTS) {
      this.writeRequirementsTxt(filePath, manifest);
      return;
    }

    if (this.manifestType === PYTHON_MANIFEST_TYPES.PYPROJECT) {
      this.writePyprojectToml(filePath, manifest);
      return;
    }

    if (this.manifestType === PYTHON_MANIFEST_TYPES.CONDA) {
      this.writeCondaEnvironment(filePath, manifest);
      return;
    }

    this.writePipfile(filePath, manifest);
  }

  private writeRequirementsTxt(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updated = content
      .split("\n")
      .map((line) => updatePyprojectDependencySpec(line, manifest.dependencies))
      .join("\n");
    writeFileSync(filePath, updated);
  }

  private writePyprojectToml(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const hasPoetryDependencies = PYTHON_PATTERNS.POETRY_DEPS.test(content);
    if (!hasPoetryDependencies) {
      this.writePep621PyprojectToml(filePath, content, manifest);
      return;
    }

    const updated = content.replace(PYTHON_PATTERNS.POETRY_DEPS, (section) =>
      updatePoetryDependencies(section, manifest.dependencies),
    );

    writeFileSync(filePath, updated);
  }

  private writePep621PyprojectToml(
    filePath: string,
    content: string,
    manifest: DependencyManifest,
  ): void {
    let currentSection: string | null = null;
    let currentArray: PyprojectArrayContext | null = null;
    let updatedLines: string[] = [];

    for (const line of content.split("\n")) {
      const sectionMatch = line.match(PYTHON_PATTERNS.PYPROJECT_SECTION);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        currentArray = null;
        updatedLines = updatedLines.concat(line);
        continue;
      }

      const nextArray = readPyprojectArrayContext(currentSection, line);
      if (nextArray) {
        currentArray = nextArray;
      }
      if (!currentArray) {
        updatedLines = updatedLines.concat(line);
        continue;
      }

      const dependencies = manifest[currentArray.target] || {};
      const updatedLine = updatePyprojectDependencyLine(line, dependencies);
      updatedLines = updatedLines.concat(updatedLine);

      if (lineClosesPyprojectArray(line)) {
        currentArray = null;
      }
    }

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  private writePipfile(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const depEntries = Object.entries(manifest.dependencies)
      .map(([name, version]) => `${name} = "${version}"`)
      .join("\n");

    const replacement = `[packages]\n${depEntries}\n\n`;
    const updated = content.replace(PYTHON_PATTERNS.PIPFILE_PACKAGES, replacement);

    writeFileSync(filePath, updated);
  }

  private writeCondaEnvironment(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const state: CondaWriteState = {
      inDependencies: false,
      dependencyItemIndent: null,
    };
    const updated = content
      .split("\n")
      .map((line) => updateCondaLine(line, state, manifest.dependencies))
      .join("\n");

    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    return PYTHON_PATTERNS.PACKAGE_NAME.exec(packageName) !== null;
  }
}
