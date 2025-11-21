export type Language = "nodejs" | "go" | "python" | "rust" | "php";

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
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface DependencyProvider {
  readonly language: Language;

  getLatestVersion(packageName: string): Promise<string>;
  getAllVersions(packageName: string): Promise<string[]>;
  readManifest(filePath: string): Promise<DependencyManifest>;
  writeManifest(filePath: string, manifest: DependencyManifest): Promise<void>;
  validatePackageName(packageName: string): boolean;
}

export interface ProviderOptions {
  debug?: boolean;
  yarnConfig?: boolean;
  isTesting?: boolean;
}
