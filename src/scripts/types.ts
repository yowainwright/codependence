import type {
  CheckFiles,
  ConstructVersionMapOptions,
  DependencyManager,
  Level,
  SupportedLanguage,
} from "../types";
import type {
  DependencyManifest,
  DependencyProvider,
  ResolvedDependencyVersions,
  VersionStrategy,
} from "../providers/types";
import type { DEP_SECTIONS } from "./constants";

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

export type PackageNormalizer = (packageName: string) => string;

export interface ProviderResolution {
  provider: DependencyProvider;
  packageManager: DependencyManager;
}

export interface VersionResolver {
  provider: DependencyProvider;
  resolveVersion: (packageName: string) => Promise<string>;
  cachePrefix: string;
  resolvedDependencyVersions: ResolvedDependencyVersions;
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
  isCLI?: boolean;
  isTesting?: boolean;
  permissive?: boolean;
  codependencies?: string[];
  level?: Level;
  deferFailure?: boolean;
}

export interface PreciseModeOptions {
  debug: boolean;
  yarnConfig: boolean;
  isTesting: boolean;
  noCache: boolean;
  onProgress?: CheckFiles["onProgress"];
  resolveVersion: (packageName: string) => Promise<string>;
  cachePrefix: string;
  validate: NonNullable<ConstructVersionMapOptions["validate"]>;
}
