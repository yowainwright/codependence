import type { LANGUAGES } from "./constants";
import type { PYTHON_MANIFEST_TYPES, PYTHON_PACKAGE_MANAGERS } from "./python/constants";
import type { DockerProvider } from "./docker";
import type { GitHubActionsProvider } from "./github-actions";
import type { GoProvider } from "./go";
import type { NodeJSProvider } from "./nodejs";
import type { PythonProvider } from "./python";
import type { RustProvider } from "./rust";

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

export type LanguageProvider =
  | typeof NodeJSProvider
  | typeof GoProvider
  | typeof PythonProvider
  | typeof RustProvider
  | typeof DockerProvider
  | typeof GitHubActionsProvider;

export interface PackageManagerManifest {
  packageManager?: unknown;
}

export interface DockerImage {
  readonly name: string;
  readonly version: string;
}

export interface GoLineState {
  readonly inReplaceBlock: boolean;
  readonly inExcludeBlock: boolean;
}

export interface GoDependencyLineResult {
  line: string;
  updated: boolean;
  found: boolean;
}

export interface GoProcessedLine extends GoDependencyLineResult {
  state: GoLineState;
}

export interface GoProcessLinesResult {
  readonly lines: string[];
  readonly updatedCount: number;
  readonly foundCount: number;
}

export interface GoProcessLinesState extends GoProcessLinesResult {
  readonly state: GoLineState;
}

export interface GoUpdateResult {
  content: string;
  updatedCount: number;
  foundCount: number;
}

export interface GitHubActionRef {
  readonly name: string;
  readonly version: string;
}

export interface GitHubRelease {
  readonly tag_name?: unknown;
}

export interface GitHubTag {
  readonly name?: unknown;
}

export interface GitHubCommit {
  readonly sha?: unknown;
}

export type GitHubFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface GitHubActionsProviderOptions {
  readonly apiUrl?: string;
  readonly fetch?: GitHubFetch;
  readonly token?: string;
}

export interface ParsedVersionTag {
  readonly name: string;
  readonly parts: readonly number[];
  readonly specificity: number;
}

export type CargoSectionTarget = "dependencies" | "devDependencies";

export interface CargoAssignment {
  readonly aliasName: string;
  readonly prefix: string;
  readonly value: string;
  readonly suffix: string;
}

export interface CargoInlineField {
  readonly name: string;
  readonly value: string;
  readonly quoteStart: number;
  readonly quoteEnd: number;
}

export interface CargoValueRange {
  value: string;
  suffix: string;
}

export interface CargoManifestLineResult {
  line: string;
  currentSection: CargoSectionTarget | null;
}

export interface ParsedCondaDependencyLine {
  readonly name: string;
  readonly version: string;
  readonly suffix: string;
}

export type PyprojectDependencySection =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies";

export interface PyprojectArrayContext {
  readonly target: PyprojectDependencySection;
}

export type PythonManifestType = (typeof PYTHON_MANIFEST_TYPES)[keyof typeof PYTHON_MANIFEST_TYPES];

export type PythonPackageManager =
  (typeof PYTHON_PACKAGE_MANAGERS)[keyof typeof PYTHON_PACKAGE_MANAGERS];
