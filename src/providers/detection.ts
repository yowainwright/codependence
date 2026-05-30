import { existsSync, readFileSync } from "fs";
import { basename, dirname, join } from "path";
import {
  CONDA_MANIFEST_FILES,
  LANGUAGES,
  MANIFEST_FILES,
  NODE_PACKAGE_MANAGER_LOCKFILES,
  NODE_PACKAGE_MANAGER_NAMES,
  NODE_PACKAGE_MANAGERS,
  PYTHON_MANIFEST_FILES,
  PYTHON_PACKAGE_MANAGERS,
} from "./constants";
import type { Language, LanguageDetectionResult } from "./types";

const hasAnyFile = (rootDir: string, files: readonly string[]): boolean =>
  files.some((file) => existsSync(join(rootDir, file)));

const isKnownNodePackageManager = (managerName: string): boolean =>
  NODE_PACKAGE_MANAGER_NAMES.some((name) => name === managerName);

const isCondaManifestFile = (manifestName: string): boolean =>
  CONDA_MANIFEST_FILES.some((name) => name === manifestName);

const readNodePackageManagerField = (rootDir: string): string | null => {
  const packageJsonPath = join(rootDir, MANIFEST_FILES.PACKAGE_JSON);
  if (!existsSync(packageJsonPath)) return null;

  try {
    const content = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      packageManager?: unknown;
    };
    const packageManager = content.packageManager;
    if (typeof packageManager !== "string" || packageManager.length === 0) {
      return null;
    }

    const managerName = packageManager.split("@")[0];
    if (isKnownNodePackageManager(managerName)) {
      return managerName;
    }
  } catch {
    return null;
  }

  return null;
};

export const detectNodePackageManager = (rootDir: string): string => {
  const packageManagerField = readNodePackageManagerField(rootDir);
  if (packageManagerField) return packageManagerField;

  const hasYarnLock = hasAnyFile(
    rootDir,
    NODE_PACKAGE_MANAGER_LOCKFILES[NODE_PACKAGE_MANAGERS.YARN],
  );
  const hasPnpmLock = hasAnyFile(
    rootDir,
    NODE_PACKAGE_MANAGER_LOCKFILES[NODE_PACKAGE_MANAGERS.PNPM],
  );
  const hasBunLock = hasAnyFile(
    rootDir,
    NODE_PACKAGE_MANAGER_LOCKFILES[NODE_PACKAGE_MANAGERS.BUN],
  );
  const hasNpmLock = hasAnyFile(
    rootDir,
    NODE_PACKAGE_MANAGER_LOCKFILES[NODE_PACKAGE_MANAGERS.NPM],
  );

  if (hasBunLock) return NODE_PACKAGE_MANAGERS.BUN;
  if (hasPnpmLock) return NODE_PACKAGE_MANAGERS.PNPM;
  if (hasYarnLock) return NODE_PACKAGE_MANAGERS.YARN;
  if (hasNpmLock) return NODE_PACKAGE_MANAGERS.NPM;
  return NODE_PACKAGE_MANAGERS.NPM;
};

export const isPoetryPyproject = (filePath: string): boolean => {
  if (!existsSync(filePath)) return false;

  try {
    return readFileSync(filePath, "utf8").includes("[tool.poetry");
  } catch {
    return false;
  }
};

export const detectPythonPackageManagerForManifest = (
  manifestPath: string,
): string => {
  const manifestName = basename(manifestPath);

  if (manifestName === MANIFEST_FILES.PIPFILE) {
    return PYTHON_PACKAGE_MANAGERS.PIPENV;
  }
  if (isCondaManifestFile(manifestName)) {
    return PYTHON_PACKAGE_MANAGERS.CONDA;
  }
  if (existsSync(join(dirname(manifestPath), MANIFEST_FILES.UV_LOCK))) {
    return PYTHON_PACKAGE_MANAGERS.UV;
  }
  if (
    manifestName === MANIFEST_FILES.PYPROJECT &&
    isPoetryPyproject(manifestPath)
  ) {
    return PYTHON_PACKAGE_MANAGERS.POETRY;
  }

  return PYTHON_PACKAGE_MANAGERS.PIP;
};

export const detectPythonPackageManager = (rootDir: string): string => {
  const hasEnvironmentYml = hasAnyFile(rootDir, CONDA_MANIFEST_FILES);
  const hasPipfile = existsSync(join(rootDir, MANIFEST_FILES.PIPFILE));
  const pyprojectPath = join(rootDir, MANIFEST_FILES.PYPROJECT);
  const hasPyprojectToml = existsSync(pyprojectPath);
  const hasUvLock = existsSync(join(rootDir, MANIFEST_FILES.UV_LOCK));

  if (hasEnvironmentYml) return PYTHON_PACKAGE_MANAGERS.CONDA;
  if (hasUvLock) return PYTHON_PACKAGE_MANAGERS.UV;
  if (hasPipfile) return PYTHON_PACKAGE_MANAGERS.PIPENV;
  if (hasPyprojectToml && isPoetryPyproject(pyprojectPath)) {
    return PYTHON_PACKAGE_MANAGERS.POETRY;
  }
  return PYTHON_PACKAGE_MANAGERS.PIP;
};

export const detectLanguage = (rootDir: string): LanguageDetectionResult[] => {
  const detections: LanguageDetectionResult[] = [];

  const hasPackageJson = existsSync(join(rootDir, MANIFEST_FILES.PACKAGE_JSON));
  if (hasPackageJson) {
    detections.push({
      language: LANGUAGES.NODEJS,
      manifestFiles: [MANIFEST_FILES.PACKAGE_JSON],
      packageManager: detectNodePackageManager(rootDir),
    });
  }

  const hasGoMod = existsSync(join(rootDir, MANIFEST_FILES.GO_MOD));
  if (hasGoMod) {
    const manifestFiles: string[] = [MANIFEST_FILES.GO_MOD];
    const hasGoSum = existsSync(join(rootDir, MANIFEST_FILES.GO_SUM));
    if (hasGoSum) {
      manifestFiles.push(MANIFEST_FILES.GO_SUM);
    }
    detections.push({
      language: LANGUAGES.GO,
      manifestFiles,
      packageManager: LANGUAGES.GO,
    });
  }

  const foundPythonManifests = PYTHON_MANIFEST_FILES.filter((f) =>
    existsSync(join(rootDir, f)),
  );
  const hasPythonManifests = foundPythonManifests.length > 0;
  if (hasPythonManifests) {
    detections.push({
      language: LANGUAGES.PYTHON,
      manifestFiles: foundPythonManifests,
      packageManager: detectPythonPackageManager(rootDir),
    });
  }

  return detections;
};

export const detectPrimaryLanguage = (
  rootDir: string,
): LanguageDetectionResult | null => {
  const detections = detectLanguage(rootDir);
  return detections.length > 0 ? detections[0] : null;
};

export const getLanguageProvider = async (
  language: Language,
): Promise<
  | typeof import("./nodejs").NodeJSProvider
  | typeof import("./go").GoProvider
  | typeof import("./python").PythonProvider
> => {
  switch (language) {
    case LANGUAGES.NODEJS:
      return (await import("./nodejs")).NodeJSProvider;
    case LANGUAGES.GO:
      return (await import("./go")).GoProvider;
    case LANGUAGES.PYTHON:
      return (await import("./python")).PythonProvider;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
};
