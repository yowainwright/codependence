import { existsSync, readFileSync } from "fs";
import { basename, dirname, join } from "path";
import type { Language, LanguageDetectionResult } from "./types";

const readNodePackageManagerField = (rootDir: string): string | null => {
  const packageJsonPath = join(rootDir, "package.json");
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
    if (["npm", "yarn", "pnpm", "bun"].includes(managerName)) {
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

  const hasYarnLock =
    existsSync(join(rootDir, "yarn.lock")) ||
    existsSync(join(rootDir, ".yarnrc")) ||
    existsSync(join(rootDir, ".yarnrc.yml"));
  const hasPnpmLock =
    existsSync(join(rootDir, "pnpm-lock.yaml")) ||
    existsSync(join(rootDir, "pnpm-workspace.yaml"));
  const hasBunLock =
    existsSync(join(rootDir, "bun.lock")) ||
    existsSync(join(rootDir, "bun.lockb")) ||
    existsSync(join(rootDir, "bunfig.toml"));
  const hasNpmLock =
    existsSync(join(rootDir, "package-lock.json")) ||
    existsSync(join(rootDir, "npm-shrinkwrap.json"));

  if (hasBunLock) return "bun";
  if (hasPnpmLock) return "pnpm";
  if (hasYarnLock) return "yarn";
  if (hasNpmLock) return "npm";
  return "npm";
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

  if (manifestName === "Pipfile") return "pipenv";
  if (
    manifestName === "environment.yml" ||
    manifestName === "environment.yaml"
  ) {
    return "conda";
  }
  if (manifestName === "pyproject.toml" && isPoetryPyproject(manifestPath)) {
    return "poetry";
  }
  if (existsSync(join(dirname(manifestPath), "uv.lock"))) return "uv";

  return "pip";
};

export const detectPythonPackageManager = (rootDir: string): string => {
  const hasEnvironmentYml =
    existsSync(join(rootDir, "environment.yml")) ||
    existsSync(join(rootDir, "environment.yaml"));
  const hasPipfile = existsSync(join(rootDir, "Pipfile"));
  const pyprojectPath = join(rootDir, "pyproject.toml");
  const hasPyprojectToml = existsSync(pyprojectPath);
  const hasUvLock = existsSync(join(rootDir, "uv.lock"));

  if (hasEnvironmentYml) return "conda";
  if (hasUvLock) return "uv";
  if (hasPipfile) return "pipenv";
  if (hasPyprojectToml && isPoetryPyproject(pyprojectPath)) return "poetry";
  return "pip";
};

export const detectLanguage = (rootDir: string): LanguageDetectionResult[] => {
  const detections: LanguageDetectionResult[] = [];

  const hasPackageJson = existsSync(join(rootDir, "package.json"));
  if (hasPackageJson) {
    detections.push({
      language: "nodejs",
      manifestFiles: ["package.json"],
      packageManager: detectNodePackageManager(rootDir),
    });
  }

  const hasGoMod = existsSync(join(rootDir, "go.mod"));
  if (hasGoMod) {
    const manifestFiles = ["go.mod"];
    const hasGoSum = existsSync(join(rootDir, "go.sum"));
    if (hasGoSum) {
      manifestFiles.push("go.sum");
    }
    detections.push({
      language: "go",
      manifestFiles,
      packageManager: "go",
    });
  }

  const pythonManifests = [
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "environment.yml",
    "environment.yaml",
  ];
  const foundPythonManifests = pythonManifests.filter((f) =>
    existsSync(join(rootDir, f)),
  );
  const hasPythonManifests = foundPythonManifests.length > 0;
  if (hasPythonManifests) {
    detections.push({
      language: "python",
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
    case "nodejs":
      return (await import("./nodejs")).NodeJSProvider;
    case "go":
      return (await import("./go")).GoProvider;
    case "python":
      return (await import("./python")).PythonProvider;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
};
