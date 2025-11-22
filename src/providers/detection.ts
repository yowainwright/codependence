import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Language, LanguageDetectionResult } from "./types";

const detectNodePackageManager = (rootDir: string): string => {
  const hasYarnLock = existsSync(join(rootDir, "yarn.lock"));
  const hasPnpmLock = existsSync(join(rootDir, "pnpm-lock.yaml"));
  const hasBunLock = existsSync(join(rootDir, "bun.lockb"));

  if (hasBunLock) return "bun";
  if (hasPnpmLock) return "pnpm";
  if (hasYarnLock) return "yarn";
  return "npm";
};

const detectPythonPackageManager = (rootDir: string): string => {
  const hasEnvironmentYml =
    existsSync(join(rootDir, "environment.yml")) ||
    existsSync(join(rootDir, "environment.yaml"));
  const hasPipfile = existsSync(join(rootDir, "Pipfile"));
  const hasPyprojectToml = existsSync(join(rootDir, "pyproject.toml"));
  const hasUvLock = existsSync(join(rootDir, "uv.lock"));

  if (hasEnvironmentYml) return "conda";
  if (hasUvLock) return "uv";
  if (hasPipfile) return "pipenv";
  if (hasPyprojectToml) {
    const content = readFileSync(join(rootDir, "pyproject.toml"), "utf8");
    const hasPoetry = content.includes("[tool.poetry");
    if (hasPoetry) return "poetry";
  }
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
