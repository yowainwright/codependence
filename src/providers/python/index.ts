import { readFileSync, writeFileSync } from "fs";
import { exec } from "../../utils/exec";
import { logger } from "../../logger";
import { LANGUAGES } from "../constants";
import {
  CONDA_MANIFEST_FILES,
  MANIFEST_FILES,
  PYTHON_MANIFEST_TYPES,
  PYTHON_PATTERNS,
  PYTHON_PACKAGE_MANAGERS,
  PYTHON_RUNTIME_DEPENDENCY_NAME,
  type PythonManifestType,
  type PythonPackageManager,
} from "./constants";
import type { DependencyProvider, DependencyManifest, ProviderOptions } from "../types";

export const parseRequirementLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();

  if (!trimmed || PYTHON_PATTERNS.COMMENT.test(trimmed)) {
    return null;
  }

  const match = trimmed.match(PYTHON_PATTERNS.REQUIREMENT_LINE);
  if (!match) return null;

  return [match[1], `${match[2]}${match[3]}`];
};

export const parsePoetryLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  const match = trimmed.match(PYTHON_PATTERNS.POETRY_LINE);

  if (!match || match[1] === PYTHON_RUNTIME_DEPENDENCY_NAME) return null;

  return [match[1], match[2]];
};

type ParsedCondaDependencyLine = {
  readonly name: string;
  readonly version: string;
  readonly suffix: string;
};

const parseCondaDependencySpec = (spec: string): ParsedCondaDependencyLine | null => {
  const trimmed = spec.trim();
  if (!trimmed || trimmed.endsWith(":")) return null;

  const match = trimmed.match(PYTHON_PATTERNS.CONDA_DEPENDENCY_LINE);
  if (!match || match[1] === PYTHON_RUNTIME_DEPENDENCY_NAME) return null;

  return {
    name: match[1],
    version: `${match[2]}${match[3]}`,
    suffix: match[4],
  };
};

export const parseCondaDependencyLine = (line: string): [string, string] | null => {
  const itemMatch = line.match(PYTHON_PATTERNS.CONDA_DEPENDENCY_ITEM);
  if (!itemMatch) return null;

  const parsed = parseCondaDependencySpec(itemMatch[2]);
  if (!parsed) return null;

  return [parsed.name, parsed.version];
};

type PyprojectDependencySection = "dependencies" | "devDependencies" | "optionalDependencies";

const parsePyprojectDependencySpec = (spec: string): [string, string] | null => {
  return parseRequirementLine(spec);
};

const readQuotedPyprojectDependencies = (line: string): Array<[string, string]> => {
  const dependencies: Array<[string, string]> = [];
  const matches = line.matchAll(PYTHON_PATTERNS.PYPROJECT_QUOTED_DEPENDENCY);

  for (const match of matches) {
    const parsed = parsePyprojectDependencySpec(match[1]);
    if (!parsed) continue;
    dependencies.push(parsed);
  }

  return dependencies;
};

const pyprojectTargetForKey = (section: string, key: string): PyprojectDependencySection | null => {
  if (section === "project" && key === "dependencies") return "dependencies";
  if (section === "project.optional-dependencies") return "optionalDependencies";
  if (section !== "dependency-groups") return null;
  if (key === "dev") return "devDependencies";
  return "optionalDependencies";
};

const startsPyprojectArray = (line: string): { key: string; isOpen: boolean } | null => {
  const match = line.match(PYTHON_PATTERNS.PYPROJECT_ARRAY_START);
  if (!match) return null;

  const hasClose = line.includes("]");
  return {
    key: match[1],
    isOpen: !hasClose,
  };
};

const updatePyprojectDependencySpec = (
  spec: string,
  dependencies: Record<string, string>,
): string => {
  const parsed = parsePyprojectDependencySpec(spec);
  if (!parsed) return spec;

  const [name] = parsed;
  const version = dependencies[name];
  if (!version) return spec;

  return name + version;
};

const updateQuotedPyprojectDependencies = (
  line: string,
  dependencies: Record<string, string>,
): string =>
  line.replace(PYTHON_PATTERNS.PYPROJECT_QUOTED_DEPENDENCY, (_match, spec) => {
    const updatedSpec = updatePyprojectDependencySpec(spec, dependencies);
    return `"${updatedSpec}"`;
  });

export class PythonProvider implements DependencyProvider {
  readonly language = LANGUAGES.PYTHON;
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

  async getLatestVersion(packageName: string): Promise<string> {
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
      if (!packages || packages.length === 0) return "";

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
        if (!packages || packages.length === 0) return [];
        return [...new Set<string>(packages.map((p: { version: string }) => p.version))];
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
    if (this.manifestType === PYTHON_MANIFEST_TYPES.REQUIREMENTS) {
      return this.readRequirementsTxt(filePath);
    }

    if (this.manifestType === PYTHON_MANIFEST_TYPES.PYPROJECT) {
      return this.readPyprojectToml(filePath);
    }

    if (this.manifestType === PYTHON_MANIFEST_TYPES.CONDA) {
      return this.readCondaEnvironment(filePath);
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
    if (!depSection) return this.readPep621PyprojectToml(filePath, content);

    const lines = depSection[1].split("\n");
    lines.forEach((line) => {
      const parsed = parsePoetryLine(line);
      if (!parsed) return;
      dependencies[parsed[0]] = parsed[1];
    });

    return { filePath, dependencies };
  }

  private readPep621PyprojectToml(filePath: string, content: string): DependencyManifest {
    const manifest: DependencyManifest = {
      filePath,
      dependencies: {},
      devDependencies: {},
      optionalDependencies: {},
    };
    let section = "";
    let activeTarget: PyprojectDependencySection | null = null;

    content.split("\n").forEach((line) => {
      const sectionMatch = line.match(PYTHON_PATTERNS.PYPROJECT_SECTION);
      if (sectionMatch) {
        section = sectionMatch[1];
        activeTarget = null;
        return;
      }

      const arrayStart = startsPyprojectArray(line);
      if (arrayStart) {
        activeTarget = pyprojectTargetForKey(section, arrayStart.key);
      }

      if (!activeTarget) return;

      const deps = readQuotedPyprojectDependencies(line);
      const target = activeTarget;
      deps.forEach(([name, version]) => {
        manifest[target]![name] = version;
      });

      if (line.includes("]")) {
        activeTarget = null;
      }
    });

    return manifest;
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

  private readCondaEnvironment(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    const dependencies: Record<string, string> = {};
    let inDependencies = false;
    let dependencyItemIndent: number | null = null;

    for (const line of content.split("\n")) {
      if (!inDependencies) {
        inDependencies = PYTHON_PATTERNS.CONDA_DEPENDENCIES_SECTION.test(line);
        continue;
      }

      if (PYTHON_PATTERNS.CONDA_TOP_LEVEL_SECTION.test(line)) break;

      const itemMatch = line.match(PYTHON_PATTERNS.CONDA_DEPENDENCY_ITEM);
      if (!itemMatch) continue;

      const itemIndent = itemMatch[1].length;
      if (dependencyItemIndent === null) {
        dependencyItemIndent = itemIndent;
      }
      if (itemIndent !== dependencyItemIndent) continue;

      const parsed = parseCondaDependencySpec(itemMatch[2]);
      if (!parsed) continue;

      dependencies[parsed.name] = parsed.version;
    }

    return { filePath, dependencies };
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
    const lines = Object.entries(manifest.dependencies)
      .map(([name, version]) => `${name}${version}`)
      .join("\n");
    writeFileSync(filePath, lines + "\n");
  }

  private writePyprojectToml(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const hasPoetryDeps = PYTHON_PATTERNS.POETRY_DEPS.test(content);
    if (!hasPoetryDeps) {
      this.writePep621PyprojectToml(filePath, content, manifest);
      return;
    }

    const depEntries = Object.entries(manifest.dependencies)
      .map(([name, version]) => `${name} = "${version}"`)
      .join("\n");

    const replacement = `[tool.poetry.dependencies]\npython = "^3.8"\n${depEntries}\n\n`;
    const updated = content.replace(PYTHON_PATTERNS.POETRY_DEPS, replacement);

    writeFileSync(filePath, updated);
  }

  private writePep621PyprojectToml(
    filePath: string,
    content: string,
    manifest: DependencyManifest,
  ): void {
    let section = "";
    let activeTarget: PyprojectDependencySection | null = null;

    const updated = content
      .split("\n")
      .map((line) => {
        const sectionMatch = line.match(PYTHON_PATTERNS.PYPROJECT_SECTION);
        if (sectionMatch) {
          section = sectionMatch[1];
          activeTarget = null;
          return line;
        }

        const arrayStart = startsPyprojectArray(line);
        if (arrayStart) {
          activeTarget = pyprojectTargetForKey(section, arrayStart.key);
        }

        if (!activeTarget) return line;

        const dependencies = manifest[activeTarget] || {};
        const updatedLine = updateQuotedPyprojectDependencies(line, dependencies);

        if (line.includes("]")) {
          activeTarget = null;
        }

        return updatedLine;
      })
      .join("\n");

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
    let inDependencies = false;
    let dependencyItemIndent: number | null = null;

    const updated = content
      .split("\n")
      .map((line) => {
        if (!inDependencies) {
          inDependencies = PYTHON_PATTERNS.CONDA_DEPENDENCIES_SECTION.test(line);
          return line;
        }

        if (PYTHON_PATTERNS.CONDA_TOP_LEVEL_SECTION.test(line)) {
          inDependencies = false;
          return line;
        }

        const itemMatch = line.match(PYTHON_PATTERNS.CONDA_DEPENDENCY_ITEM);
        if (!itemMatch) return line;

        const itemIndent = itemMatch[1].length;
        if (dependencyItemIndent === null) {
          dependencyItemIndent = itemIndent;
        }
        if (itemIndent !== dependencyItemIndent) return line;

        const parsed = parseCondaDependencySpec(itemMatch[2]);
        if (!parsed) return line;

        const version = manifest.dependencies[parsed.name];
        if (!version) return line;

        return `${itemMatch[1]}- ${parsed.name}${version}${parsed.suffix}`;
      })
      .join("\n");

    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    return PYTHON_PATTERNS.PACKAGE_NAME.test(packageName);
  }
}
