import type { LANGUAGES } from "./constants";

export type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES] | "php";

export interface LanguageDetectionResult {
  language: Language;
  manifestFiles: string[];
  packageManager: string;
}

export interface DependencyManifest {
  filePath: string;
  name?: string;
  version?: string;
  dependencies: Record<string, string>;
  dependencyVersions?: Record<string, readonly string[]>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export type VersionStrategy = "semver" | "exact";

export interface ProviderCapabilities {
  readonly supportsLatestResolution: boolean;
  readonly supportsPreciseMode: boolean;
  readonly versionStrategy: VersionStrategy;
}

export interface DependencyProvider {
  readonly language: Language;
  readonly capabilities: ProviderCapabilities;

  getLatestVersion(packageName: string): Promise<string>;
  getAllVersions(packageName: string): Promise<string[]>;
  readManifest(filePath: string): DependencyManifest;
  writeManifest(filePath: string, manifest: DependencyManifest): void | Promise<void>;
  validatePackageName(packageName: string): boolean;
  normalizePackageName?(packageName: string): string;
}

export interface ProviderOptions {
  debug?: boolean;
  yarnConfig?: boolean;
  packageManager?: string;
  isTesting?: boolean;
}
