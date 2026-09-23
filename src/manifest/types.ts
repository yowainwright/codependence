import type {
  CheckFiles,
  ConstructVersionMapOptions,
  DependencyManager,
  Level,
  SupportedLanguage,
  VersionResolution,
  VersionDiff,
} from "../types";
import type {
  DependencyManifest,
  DependencyProvider,
  ResolvedDependencyVersions,
  VersionStrategy,
} from "../providers/types";
import type { DEP_SECTIONS } from "./constants";

export interface ValidationResult {
  validForNewPackages: boolean;
  validForOldPackages: boolean;
  warnings?: string[];
  errors?: string[];
}

export interface CacheEntry {
  value: VersionResolution;
  timestamp: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export type DependencySection = (typeof DEP_SECTIONS)[number];

export interface LoadedManifest {
  file: string;
  path: string;
  language: SupportedLanguage;
  packageManager: DependencyManager;
  provider: DependencyProvider;
  manifest: DependencyManifest;
}

export interface DependencySections {
  dependencies?: Record<string, string>;
  dependencyVersions?: Record<string, readonly string[]>;
  resolvedDependencyVersions?: ResolvedDependencyVersions;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface DependencyUpdateContext {
  codependencies: string[];
  permissive: boolean;
  level: Level;
  versionStrategy: VersionStrategy;
}

export interface VersionDiffOptions {
  permissive: boolean;
  level?: Level;
  versionStrategy?: VersionStrategy;
}

export interface UpdateVersionOptions {
  level?: Level;
  versionStrategy?: VersionStrategy;
}

export type PackageNormalizer = (packageName: string) => string;

export interface ProviderResolution {
  provider: DependencyProvider;
  packageManager: DependencyManager;
}

export interface VersionResolver {
  provider: DependencyProvider;
  resolveVersion: NonNullable<ConstructVersionMapOptions["resolveVersion"]>;
  cachePrefix: string;
  resolvedDependencyVersions: ResolvedDependencyVersions;
}

export interface VersionMapResolverOptions extends ConstructVersionMapOptions {
  resolveVersion: NonNullable<ConstructVersionMapOptions["resolveVersion"]>;
  cachePrefix: string;
}

export interface MatchedFileOptions {
  isUpdating: boolean;
  isDebugging: boolean;
  isSilent: boolean;
  isVerbose: boolean;
  isQuiet: boolean;
  isTesting: boolean;
  permissive: boolean;
  level: Level;
}

export interface CheckLoadedManifestsOptions {
  manifests: LoadedManifest[];
  versionMap: Record<string, string>;
  isUpdating?: boolean;
  isDebugging?: boolean;
  isSilent?: boolean;
  isVerbose?: boolean;
  isQuiet?: boolean;
  isTesting?: boolean;
  permissive?: boolean;
  codependencies?: string[];
  level?: Level;
  deferFailure?: boolean;
  onBeforeOutput?: CheckFiles["onBeforeOutput"];
}

export interface PreciseModeOptions {
  debug: boolean;
  yarnConfig: boolean;
  isTesting: boolean;
  noCache: boolean;
  onProgress?: CheckFiles["onProgress"];
  resolveVersion: NonNullable<ConstructVersionMapOptions["resolveVersion"]>;
  cachePrefix: string;
  resolvedDependencyVersions: ResolvedDependencyVersions;
  validate: NonNullable<ConstructVersionMapOptions["validate"]>;
}

export type NormalizedCheckFiles = CheckFiles &
  Required<
    Pick<
      CheckFiles,
      | "rootDir"
      | "ignore"
      | "update"
      | "debug"
      | "silent"
      | "verbose"
      | "quiet"
      | "isCLI"
      | "yarnConfig"
      | "isTesting"
      | "dryRun"
      | "interactive"
      | "noCache"
      | "level"
      | "deferFailure"
    >
  >;

export interface FileCheckContext {
  options: NormalizedCheckFiles;
  manifests: LoadedManifest[];
  versionResolver: VersionResolver;
  isPreciseMode: boolean;
}

export interface FileCheckVersions {
  versionMap: Record<string, string>;
  depNames: string[];
}

export interface FileCheckPreview {
  allDiffs: VersionDiff[];
  shouldDisplayDiffs: boolean;
  isInteractiveUpdate: boolean;
}
