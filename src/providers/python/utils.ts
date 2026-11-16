import {
  CONDA_MANIFEST_FILES,
  MANIFEST_FILES,
  PYTHON_PATTERNS,
  PYTHON_RUNTIME_DEPENDENCY_NAME,
} from "./constants";
import type {
  CondaWriteState,
  DependencyManifest,
  ParsedCondaDependencyLine,
  PyprojectArrayContext,
  PyprojectDependencySection,
} from "../types";

export const capabilities = {
  supportsLatestResolution: true,
  supportsPreciseMode: true,
  versionStrategy: "semver",
} as const;

export const updateCondaLine = (
  line: string,
  state: CondaWriteState,
  dependencies: Record<string, string>,
): string => {
  if (!state.inDependencies) {
    state.inDependencies = PYTHON_PATTERNS.CONDA_DEPENDENCIES_SECTION.test(line);
    return line;
  }
  const isTopLevelSection = PYTHON_PATTERNS.CONDA_TOP_LEVEL_SECTION.test(line);
  if (isTopLevelSection) {
    state.inDependencies = false;
    return line;
  }
  const itemMatch = line.match(PYTHON_PATTERNS.CONDA_DEPENDENCY_ITEM);
  if (!itemMatch) return line;
  const itemIndent = itemMatch[1].length;
  state.dependencyItemIndent ??= itemIndent;
  if (itemIndent !== state.dependencyItemIndent) return line;
  const parsed = parseCondaDependencySpec(itemMatch[2]);
  if (!parsed) return line;
  const version = dependencies[parsed.name];
  return version ? `${itemMatch[1]}- ${parsed.name}${version}${parsed.suffix}` : line;
};

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

const updatePoetryDependencyLine = (line: string, dependencies: Record<string, string>): string => {
  const parsed = parsePoetryLine(line);
  if (!parsed) return line;

  const [name, currentVersion] = parsed;
  const version = dependencies[name];
  if (!version) return line;

  const start = line.indexOf('"') + 1;
  const end = start + currentVersion.length;
  return `${line.slice(0, start)}${version}${line.slice(end)}`;
};

export const updatePoetryDependencies = (
  section: string,
  dependencies: Record<string, string>,
): string => {
  const lines = section.split("\n");
  const updatedLines = lines.map((line) => updatePoetryDependencyLine(line, dependencies));
  return updatedLines.join("\n");
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

export const readPyprojectArrayContext = (
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

export const lineClosesPyprojectArray = (line: string): boolean =>
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

export const updatePyprojectDependencySpec = (
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

export const updatePyprojectDependencyLine = (
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

const readRequirementsTxt = (filePath: string, content: string): DependencyManifest => {
  const dependencies: Record<string, string> = {};

  content.split("\n").forEach((line) => {
    const parsed = parseRequirementLine(line);
    if (!parsed) return;
    dependencies[parsed[0]] = parsed[1];
  });

  return { filePath, dependencies };
};

const readPyprojectToml = (filePath: string, content: string): DependencyManifest => {
  const dependencies: Record<string, string> = {};

  const depSection = content.match(PYTHON_PATTERNS.POETRY_DEPS);
  if (!depSection) {
    return readPep621PyprojectToml(filePath, content);
  }

  const lines = depSection[1].split("\n");
  lines.forEach((line) => {
    const parsed = parsePoetryLine(line);
    if (!parsed) return;
    dependencies[parsed[0]] = parsed[1];
  });

  return { filePath, dependencies };
};

const readPep621PyprojectToml = (filePath: string, content: string): DependencyManifest => {
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
};

const readPipfile = (filePath: string, content: string): DependencyManifest => {
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
};

const readCondaEnvironment = (filePath: string, content: string): DependencyManifest => {
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
};

export const parseManifest = (filePath: string, content: string): DependencyManifest => {
  if (filePath.endsWith(MANIFEST_FILES.REQUIREMENTS)) return readRequirementsTxt(filePath, content);
  if (filePath.endsWith(MANIFEST_FILES.PYPROJECT)) return readPyprojectToml(filePath, content);
  const isConda = CONDA_MANIFEST_FILES.some((file) => filePath.endsWith(file));
  if (isConda) return readCondaEnvironment(filePath, content);
  if (filePath.endsWith(MANIFEST_FILES.PIPFILE)) return readPipfile(filePath, content);
  return readRequirementsTxt(filePath, content);
};
