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
  PYTHON_RUNTIME_DEPENDENCY_NAME,
} from "./constants";
import type {
  DependencyProvider,
  DependencyManifest,
  ParsedCondaDependencyLine,
  ProviderOptions,
  PyprojectArrayContext,
  PyprojectDependencySection,
  PythonManifestType,
  PythonPackageManager,
} from "../types";

export const parseRequirementLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();

  const isBlankOrComment = !trimmed || PYTHON_PATTERNS.COMMENT.test(trimmed);
  if (isBlankOrComment) {
    return null;
  }

  const match = trimmed.match(PYTHON_PATTERNS.REQUIREMENT_LINE);
  if (!match) return null;

  return [match[1], `${match[2]}${match[3]}`];
};

export const parsePoetryLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  const match = trimmed.match(PYTHON_PATTERNS.POETRY_LINE);

  if (!match) return null;
  const isRuntimeDependency = match[1] === PYTHON_RUNTIME_DEPENDENCY_NAME;
  if (isRuntimeDependency) return null;

  return [match[1], match[2]];
};

const parseCondaDependencySpec = (spec: string): ParsedCondaDependencyLine | null => {
  const trimmed = spec.trim();
  const isSectionHeader = trimmed.endsWith(":");
  const isBlankOrSectionHeader = !trimmed || isSectionHeader;
  if (isBlankOrSectionHeader) return null;

  const match = trimmed.match(PYTHON_PATTERNS.CONDA_DEPENDENCY_LINE);
  if (!match) return null;
  const isRuntimeDependency = match[1] === PYTHON_RUNTIME_DEPENDENCY_NAME;
  if (isRuntimeDependency) return null;

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

const pyprojectTargetForKey = (
  section: string | null,
  key: string,
): PyprojectDependencySection | null => {
  const isProjectDependencies = section === "project" && key === "dependencies";
  if (isProjectDependencies) {
    return "dependencies";
  }
  if (section === "project.optional-dependencies") {
    return "optionalDependencies";
  }
  const isDevDependencyGroup = section === "dependency-groups" && key === "dev";
  if (isDevDependencyGroup) {
    return "devDependencies";
  }
  if (section === "dependency-groups") {
    return "optionalDependencies";
  }

  return null;
};

const readPyprojectArrayContext = (
  section: string | null,
  line: string,
): PyprojectArrayContext | null => {
  const match = line.match(PYTHON_PATTERNS.PYPROJECT_ARRAY_START);
  if (!match) return null;

  const target = pyprojectTargetForKey(section, match[1]);
  if (!target) return null;

  const context = { target };
  return context;
};

const stripQuotedPyprojectText = (line: string): string =>
  line.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, "");

const lineClosesPyprojectArray = (line: string): boolean =>
  stripQuotedPyprojectText(line).includes("]");

const assignPyprojectDependency = (
  manifest: DependencyManifest,
  target: PyprojectDependencySection,
  name: string,
  version: string,
): void => {
  const dependencies = manifest[target] || {};
  dependencies[name] = version;
  manifest[target] = dependencies;
};

const assignPyprojectDependencies = (
  manifest: DependencyManifest,
  target: PyprojectDependencySection,
  dependencies: Array<readonly [string, string]>,
): void => {
  dependencies.forEach(([name, version]) => {
    assignPyprojectDependency(manifest, target, name, version);
  });
};

const readQuotedPyprojectDependencies = (line: string): Array<readonly [string, string]> => {
  const matches = line.matchAll(PYTHON_PATTERNS.PYPROJECT_QUOTED_DEPENDENCY);
  return Array.from(matches).flatMap((match) => {
    const parsed = parseRequirementLine(match[1]);
    return parsed ? [parsed] : [];
  });
};

const updatePyprojectDependencySpec = (
  spec: string,
  dependencies: Record<string, string>,
): string => {
  const parsed = parseRequirementLine(spec);
  if (!parsed) return spec;

  const [name, currentVersion] = parsed;
  const nextVersion = dependencies[name];
  if (!nextVersion) return spec;

  const versionIndex = spec.indexOf(currentVersion, name.length);
  if (versionIndex < 0) return spec;

  const prefix = spec.slice(0, versionIndex);
  const suffix = spec.slice(versionIndex + currentVersion.length);
  const updatedSpec = `${prefix}${nextVersion}${suffix}`;
  return updatedSpec;
};

const updatePyprojectDependencyLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const updatedLine = line.replace(
    PYTHON_PATTERNS.PYPROJECT_QUOTED_DEPENDENCY,
    (_quoted, spec: string) => {
      const updatedSpec = updatePyprojectDependencySpec(spec, dependencies);
      const quotedSpec = `"${updatedSpec}"`;
      return quotedSpec;
    },
  );
  return updatedLine;
};

export class PythonProvider implements DependencyProvider {
  readonly language = LANGUAGES.PYTHON;
  readonly capabilities = {
    supportsLatestResolution: true,
    supportsPreciseMode: true,
    versionStrategy: "semver",
  } as const;
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
    if (!depSection) {
      return this.readPep621PyprojectToml(filePath, content);
    }

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
    let currentSection: string | null = null;
    let currentArray: PyprojectArrayContext | null = null;

    for (const line of content.split("\n")) {
      const sectionMatch = line.match(PYTHON_PATTERNS.PYPROJECT_SECTION);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        currentArray = null;
        continue;
      }

      const nextArray = readPyprojectArrayContext(currentSection, line);
      if (nextArray) {
        currentArray = nextArray;
      }
      if (!currentArray) continue;

      const dependencies = readQuotedPyprojectDependencies(line);
      assignPyprojectDependencies(manifest, currentArray.target, dependencies);
      if (lineClosesPyprojectArray(line)) {
        currentArray = null;
      }
    }

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
    const initialState = {
      lines: [] as string[],
      inDependencies: false,
      dependencyItemIndent: null as number | null,
    };
    const state = content.split("\n").reduce((current, line) => {
      if (!current.inDependencies) {
        const inDependencies = PYTHON_PATTERNS.CONDA_DEPENDENCIES_SECTION.test(line);
        return Object.assign({}, current, {
          lines: current.lines.concat(line),
          inDependencies,
        });
      }

      const isTopLevelSection = PYTHON_PATTERNS.CONDA_TOP_LEVEL_SECTION.test(line);
      if (isTopLevelSection) {
        return Object.assign({}, current, {
          lines: current.lines.concat(line),
          inDependencies: false,
        });
      }

      const itemMatch = line.match(PYTHON_PATTERNS.CONDA_DEPENDENCY_ITEM);
      if (!itemMatch) return Object.assign({}, current, { lines: current.lines.concat(line) });

      const itemIndent = itemMatch[1].length;
      const dependencyItemIndent = current.dependencyItemIndent ?? itemIndent;
      if (itemIndent !== dependencyItemIndent) {
        return Object.assign({}, current, { lines: current.lines.concat(line) });
      }

      const parsed = parseCondaDependencySpec(itemMatch[2]);
      if (!parsed) {
        return Object.assign({}, current, {
          lines: current.lines.concat(line),
          dependencyItemIndent,
        });
      }

      const version = manifest.dependencies[parsed.name];
      const updatedLine = version
        ? `${itemMatch[1]}- ${parsed.name}${version}${parsed.suffix}`
        : line;
      return Object.assign({}, current, {
        lines: current.lines.concat(updatedLine),
        dependencyItemIndent,
      });
    }, initialState);
    const updated = state.lines.join("\n");

    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    return PYTHON_PATTERNS.PACKAGE_NAME.exec(packageName) !== null;
  }
}
