import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import {
  DockerProvider,
  GoProvider,
  GitHubActionsProvider,
  LANGUAGES,
  MANIFEST_FILES,
  NODE_PACKAGE_MANAGERS,
  PYTHON_PACKAGE_MANAGERS,
  NodeJSProvider,
  PythonProvider,
  RustProvider,
  detectNodePackageManager,
  detectPrimaryLanguage,
  detectPythonPackageManagerForManifest,
} from "../providers";
import type {
  DependencyManifest,
  DependencyProvider,
  PythonPackageManager,
  VersionStrategy,
} from "../providers/types";
import { validatePackageName } from "../utils/validate-package";
import { exec } from "../utils/exec";
import { glob } from "../utils/glob";
import { logger } from "../logger";
import { defaultOutput, item } from "../dx";
import { versionCache, requestDeduplicator } from "../utils/cache";
import { formatEnhancedError } from "../utils/suggestions";
import { collectDiffsFromManifests, displayVersionDiffs } from "../utils/diff";
import { Prompt } from "../utils/prompts";
import { isWithinLevel, stripRepeatingVersionPrefixes } from "../utils/semver";
import {
  DEFAULT_FILE_MATCHERS,
  DEP_SECTIONS,
  NODE_MANAGER_NAMES,
  PYTHON_MANIFEST_NAMES,
  SUPPORTED_LANGUAGE_NAMES,
  VERSION_RESOLUTION_CONCURRENCY,
} from "./constants";
import type {
  CheckLoadedManifestsOptions,
  DependencySection,
  DependencySections,
  LoadedManifest,
  MatchedFileOptions,
  PackageNormalizer,
  PreciseModeOptions,
  ProviderResolution,
  VersionResolver,
} from "./types";
import { STRICT_INEQUALITY_VERSION_PREFIXES, VERSION_PREFIXES } from "../utils/constants";
import {
  CheckFiles,
  ConstructVersionMapOptions,
  CheckMatches,
  CheckDependenciesForVersionOptions,
  PackageJSON,
  DepToUpdateItem,
  DepsToUpdate,
  VersionDiff,
  Level,
  InteractiveResult,
  SupportedLanguage,
} from "../types";

const isSupportedLanguageName = (language: string | undefined): language is SupportedLanguage => {
  if (!language) return false;

  const isSupported = SUPPORTED_LANGUAGE_NAMES.has(language);
  return isSupported;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) return [];

  const results = Array.from({ length: items.length }, () => undefined as R);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
};

const resolveManifestPath = (rootDir: string, file: string): string => resolve(rootDir, file);

const inferLanguageFromFile = (file: string): SupportedLanguage | null => {
  const manifestName = basename(file);
  const normalizedFile = file.replaceAll("\\", "/");
  const normalizedDir = dirname(normalizedFile).replaceAll("\\", "/");
  const isGithubWorkflow =
    normalizedDir === ".github/workflows" || normalizedDir.endsWith("/.github/workflows");

  if (manifestName === MANIFEST_FILES.PACKAGE_JSON) return LANGUAGES.NODEJS;
  if (manifestName === MANIFEST_FILES.GO_MOD) return LANGUAGES.GO;
  if (manifestName === MANIFEST_FILES.CARGO_TOML) return LANGUAGES.RUST;
  if (manifestName === MANIFEST_FILES.DOCKERFILE) return LANGUAGES.DOCKER;
  if (isGithubWorkflow) {
    return LANGUAGES.GITHUB_ACTIONS;
  }
  if (PYTHON_MANIFEST_NAMES.has(manifestName)) return LANGUAGES.PYTHON;

  return null;
};

const resolveTargetLanguage = (
  rootDir: string,
  language?: SupportedLanguage,
): SupportedLanguage => {
  if (language) return language;

  const detected = detectPrimaryLanguage(rootDir)?.language;
  if (isSupportedLanguageName(detected)) {
    return detected;
  }

  return LANGUAGES.NODEJS;
};

const resolveMatchers = (
  rootDir: string,
  matchers: string[] | undefined,
  language?: SupportedLanguage,
): string[] => {
  if (matchers && matchers.length > 0) {
    return matchers;
  }

  return DEFAULT_FILE_MATCHERS[resolveTargetLanguage(rootDir, language)];
};

const resolveNodeManager = (
  filePath: string,
  options: Pick<CheckFiles, "yarnConfig" | "packageManager">,
): string => {
  if (options.yarnConfig) return NODE_PACKAGE_MANAGERS.YARN;

  const requestedManager = options.packageManager;
  if (requestedManager && NODE_MANAGER_NAMES.has(requestedManager)) {
    return requestedManager;
  }

  return detectNodePackageManager(dirname(filePath));
};

const resolvePythonManager = (
  filePath: string,
  requestedManager?: string,
): PythonPackageManager => {
  const pythonManagers = Object.values(PYTHON_PACKAGE_MANAGERS);
  const isPythonManager = pythonManagers.includes(requestedManager as PythonPackageManager);
  if (isPythonManager) return requestedManager as PythonPackageManager;

  return detectPythonPackageManagerForManifest(filePath) as PythonPackageManager;
};

const createProvider = (
  language: SupportedLanguage,
  filePath: string,
  options: Pick<CheckFiles, "debug" | "yarnConfig" | "isTesting" | "packageManager">,
): ProviderResolution => {
  const providerOptions = {
    debug: options.debug,
    yarnConfig: options.yarnConfig,
    isTesting: options.isTesting,
  };

  switch (language) {
    case LANGUAGES.NODEJS: {
      const packageManager = resolveNodeManager(filePath, options);
      return {
        provider: new NodeJSProvider({
          ...providerOptions,
          packageManager,
        }),
        packageManager,
      };
    }
    case LANGUAGES.GO:
      return {
        provider: new GoProvider(providerOptions),
        packageManager: LANGUAGES.GO,
      };
    case LANGUAGES.RUST:
      return {
        provider: new RustProvider(providerOptions),
        packageManager: LANGUAGES.RUST,
      };
    case LANGUAGES.DOCKER:
      return {
        provider: new DockerProvider(),
        packageManager: LANGUAGES.DOCKER,
      };
    case LANGUAGES.GITHUB_ACTIONS:
      return {
        provider: new GitHubActionsProvider(),
        packageManager: LANGUAGES.GITHUB_ACTIONS,
      };
    case LANGUAGES.PYTHON: {
      const packageManager = resolvePythonManager(filePath, options.packageManager);
      return {
        provider: new PythonProvider(filePath, packageManager, providerOptions),
        packageManager,
      };
    }
  }
};

const loadManifests = (
  files: string[],
  rootDir: string,
  options: Pick<CheckFiles, "language" | "debug" | "yarnConfig" | "isTesting" | "packageManager">,
): LoadedManifest[] =>
  files.map((file) => {
    const path = resolveManifestPath(rootDir, file);
    const language =
      options.language || inferLanguageFromFile(file) || resolveTargetLanguage(dirname(path));
    const { provider, packageManager } = createProvider(language, path, options);
    const manifest = provider.readManifest(path);

    return {
      file,
      path,
      language,
      packageManager,
      provider,
      manifest,
    };
  });

const collectDepNamesFromManifest = (manifest: DependencyManifest): string[] => {
  const sections = DEP_SECTIONS.map((section) => manifest[section]);
  const dependencySections = sections.filter(
    (section): section is Record<string, string> => section !== undefined,
  );
  return dependencySections.flatMap((section) => Object.keys(section));
};

const collectAllDepNamesFromManifests = (manifests: LoadedManifest[]): string[] =>
  Array.from(new Set(manifests.flatMap(({ manifest }) => collectDepNamesFromManifest(manifest))));

const getPackageNormalizer = (provider: DependencyProvider): PackageNormalizer | null => {
  if (!provider.normalizePackageName) return null;
  return (packageName: string) => provider.normalizePackageName!(packageName);
};

const createNormalizedVersionLookup = (
  versionMap: Record<string, string>,
  normalize: PackageNormalizer,
): Map<string, string> => {
  const lookup = new Map<string, string>();
  Object.entries(versionMap).forEach(([name, version]) => {
    lookup.set(normalize(name), version);
  });
  return lookup;
};

const aliasVersionMapForManifest = (
  versionMap: Record<string, string>,
  loadedManifest: LoadedManifest,
): Record<string, string> => {
  const normalize = getPackageNormalizer(loadedManifest.provider);
  if (!normalize) return versionMap;

  const aliasedMap = { ...versionMap };
  const versionLookup = createNormalizedVersionLookup(versionMap, normalize);
  const depNames = collectDepNamesFromManifest(loadedManifest.manifest);

  depNames.forEach((name) => {
    if (aliasedMap[name]) return;

    const version = versionLookup.get(normalize(name));
    if (version) aliasedMap[name] = version;
  });

  return aliasedMap;
};

const aliasVersionMapForManifests = (
  versionMap: Record<string, string>,
  manifests: LoadedManifest[],
): Record<string, string> =>
  manifests.reduce(
    (aliasedMap, manifest) => aliasVersionMapForManifest(aliasedMap, manifest),
    versionMap,
  );

const createNormalizedNameSet = (names: string[], normalize: PackageNormalizer): Set<string> =>
  new Set(names.map((name) => normalize(name)));

const aliasCodependenciesForManifest = (
  codependencies: string[] = [],
  loadedManifest: LoadedManifest,
): string[] => {
  const normalize = getPackageNormalizer(loadedManifest.provider);
  if (!normalize || codependencies.length === 0) return codependencies;

  const aliases = new Set(codependencies);
  const normalizedCodependencies = createNormalizedNameSet(codependencies, normalize);
  const depNames = collectDepNamesFromManifest(loadedManifest.manifest);

  depNames.forEach((name) => {
    const normalizedName = normalize(name);
    if (normalizedCodependencies.has(normalizedName)) aliases.add(name);
  });

  return Array.from(aliases);
};

const aliasCodependenciesForManifests = (
  codependencies: string[],
  manifests: LoadedManifest[],
): string[] =>
  manifests.reduce(
    (aliases, manifest) => aliasCodependenciesForManifest(aliases, manifest),
    codependencies,
  );

const detectStaleCodependenciesFromManifests = (
  codependencies: import("../types").CodeDependencies,
  manifests: LoadedManifest[],
): string[] => {
  const pinnedNames = codependencies
    .map((dep) => (typeof dep === "string" ? dep : Object.keys(dep)[0]))
    .filter(Boolean);

  if (pinnedNames.length === 0) return [];

  const allDepNames = new Set(collectAllDepNamesFromManifests(manifests));
  return pinnedNames.filter((name) => !allDepNames.has(name));
};

const createVersionResolver = (
  manifests: LoadedManifest[],
  rootDir: string,
  options: Pick<CheckFiles, "language" | "debug" | "yarnConfig" | "isTesting" | "packageManager">,
): VersionResolver => {
  const singleManifestLanguage = manifests[0]?.language;
  const hasSingleManifestLanguage =
    singleManifestLanguage &&
    manifests.every((manifest) => manifest.language === singleManifestLanguage);
  const language =
    options.language ||
    (hasSingleManifestLanguage ? singleManifestLanguage : undefined) ||
    resolveTargetLanguage(rootDir);
  const existingManifest = manifests.find((manifest) => manifest.language === language);
  const { provider, packageManager } =
    existingManifest ||
    (() => {
      const defaultFile = DEFAULT_FILE_MATCHERS[language][0];
      const filePath = resolveManifestPath(rootDir, defaultFile);
      return createProvider(language, filePath, options);
    })();

  return {
    provider,
    resolveVersion: (packageName: string) => provider.getLatestVersion(packageName),
    cachePrefix: `${language}:${packageManager}`,
  };
};

const createPackageValidator =
  (provider: DependencyProvider): NonNullable<ConstructVersionMapOptions["validate"]> =>
  (packageName: string) => {
    const isValid = provider.validatePackageName(packageName);

    return {
      validForNewPackages: isValid,
      validForOldPackages: isValid,
      errors: isValid ? [] : [`Invalid ${provider.language} package name`],
    };
  };

const hasStringCodependencies = (
  codependencies: import("../types").CodeDependencies | undefined,
): boolean => codependencies?.some((dep) => typeof dep === "string") || false;

const collectResolutionProviders = (
  manifests: LoadedManifest[],
  fallback: DependencyProvider,
): DependencyProvider[] => {
  if (manifests.length === 0) return [fallback];

  const providers = new Map<string, DependencyProvider>();
  manifests.forEach(({ provider }) => {
    providers.set(provider.language, provider);
  });
  return Array.from(providers.values());
};

const unsupportedResolutionMessage = (language: string): string =>
  `${language} provider requires explicit version pins and does not support latest resolution or precise mode yet. Use mode "verbose" with object codependencies such as {"name":"version"}.`;

const unsupportedMixedResolutionMessage = (): string =>
  "Latest resolution currently supports one provider at a time. Use explicit object pins or run one provider language per invocation.";

const assertProviderResolutionSupport = (
  manifests: LoadedManifest[],
  fallbackProvider: DependencyProvider,
  codependencies: import("../types").CodeDependencies | undefined,
  isPreciseMode: boolean,
): void => {
  const providers = collectResolutionProviders(manifests, fallbackProvider);
  const needsLatestResolution = hasStringCodependencies(codependencies);

  if (isPreciseMode && providers.length > 1) {
    throw new Error(unsupportedMixedResolutionMessage());
  }

  if (needsLatestResolution && providers.length > 1) {
    throw new Error(unsupportedMixedResolutionMessage());
  }

  providers.forEach((provider) => {
    const { capabilities } = provider;
    if (isPreciseMode && !capabilities.supportsPreciseMode) {
      throw new Error(unsupportedResolutionMessage(provider.language));
    }

    if (needsLatestResolution && !capabilities.supportsLatestResolution) {
      throw new Error(unsupportedResolutionMessage(provider.language));
    }
  });
};

export const resolveObjectDep = (dep: Record<string, string>): Record<string, string> | null => {
  const hasOneKey = Object.keys(dep).length === 1;
  return hasOneKey ? dep : null;
};

export const validateStringDep = (
  dep: string,
  validate: ConstructVersionMapOptions["validate"],
): void => {
  const hasLength = dep.length > 1;
  const hasNoSpace = !dep.includes(" ");
  const isValidString = hasLength && hasNoSpace;

  if (!isValidString) {
    throw new Error("invalid item type");
  }

  const validateFn = validate || validatePackageName;
  const { validForNewPackages, validForOldPackages, errors } = validateFn(dep);
  const isValid = validForNewPackages || validForOldPackages;

  if (!isValid) {
    const errorContext = {
      packageName: dep,
      error: errors?.join(", ") || "Invalid package name",
      isValidationError: true,
    };
    throw new Error(formatEnhancedError(errorContext));
  }
};

export const resolveFromCache = (cacheKey: string, noCache: boolean): string | null => {
  const shouldUseCache = !noCache;
  if (!shouldUseCache) return null;

  const cachedVersion = versionCache.get(cacheKey);
  return cachedVersion || null;
};

export const resolveFromRegistry = async (
  dep: string,
  yarnConfig: boolean,
  execFn: ConstructVersionMapOptions["exec"],
): Promise<string> => {
  const runner = !yarnConfig ? NODE_PACKAGE_MANAGERS.NPM : NODE_PACKAGE_MANAGERS.YARN;
  const cmd = !yarnConfig
    ? ["view", dep, "version", "latest"]
    : [NODE_PACKAGE_MANAGERS.NPM, "info", dep, "--fields", "version", "--json"];

  const execRunner = execFn || exec;
  const { stdout = "" } = await execRunner(runner, cmd);

  const parsedVersion = !yarnConfig
    ? stdout.replace("\n", "")
    : JSON.parse(stdout.replace("\n", ""))?.version;

  if (!parsedVersion) {
    throw new Error(`No version found for ${dep}`);
  }

  return parsedVersion;
};

const handleVersionMapError = (
  err: unknown,
  dep: string | Record<string, string>,
  debug: boolean,
  isTesting: boolean,
): Record<string, string> => {
  if (debug) {
    logger.debug((err as Error).message || (err as string).toString());
  }

  const isNetworkError =
    err instanceof Error &&
    (err.message.includes("ENOTFOUND") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("EAI_AGAIN"));

  const isValidationError = err instanceof Error && err.message.includes("Invalid package");

  const packageName = typeof dep === "string" ? dep : "unknown";

  if (!isValidationError) {
    const errorContext = {
      packageName,
      error: err as Error,
      isNetworkError,
      isValidationError: false,
    };
    logger.error(formatEnhancedError(errorContext));
  } else {
    logger.error((err as Error).message);
  }

  if (isTesting) return {};
  throw err;
};

export const constructVersionMap = async ({
  codependencies,
  exec: execFn = exec,
  debug = false,
  yarnConfig = false,
  isTesting = false,
  validate = validatePackageName,
  noCache = false,
  onProgress,
  resolveVersion,
  cachePrefix,
}: ConstructVersionMapOptions) => {
  const total = codependencies.length;
  let current = 0;
  const resolveLatestVersion =
    resolveVersion ||
    ((packageName: string) => resolveFromRegistry(packageName, yarnConfig, execFn));
  const cacheNamespace =
    cachePrefix || `${yarnConfig ? NODE_PACKAGE_MANAGERS.YARN : NODE_PACKAGE_MANAGERS.NPM}`;

  const updatedCodeDependencies = await mapWithConcurrency(
    codependencies,
    VERSION_RESOLUTION_CONCURRENCY,
    async (dep) => {
      try {
        const isObjectType = typeof dep === "object";
        if (isObjectType) {
          const resolved = resolveObjectDep(dep as Record<string, string>);
          if (resolved) return resolved;
        }

        const stringDep = dep as string;
        validateStringDep(stringDep, validate);

        const cacheKey = `${cacheNamespace}:${stringDep}`;
        const cached = resolveFromCache(cacheKey, noCache);

        if (cached) {
          current++;
          if (onProgress) onProgress(current, total, stringDep);
          return { [stringDep]: cached };
        }

        const version = await requestDeduplicator.dedupe(cacheKey, async () =>
          resolveLatestVersion(stringDep),
        );

        if (!noCache) {
          versionCache.set(cacheKey, version);
        }

        current++;
        if (onProgress) onProgress(current, total, stringDep);

        return { [stringDep]: version };
      } catch (err) {
        return handleVersionMapError(err, dep, debug, isTesting);
      }
    },
  );

  const versionMap: Record<string, string> = {};
  updatedCodeDependencies.forEach((entry) => {
    const [name] = Object.keys(entry);
    const version = entry?.[name];
    if (name && version) {
      versionMap[name] = version;
    }
  });

  return versionMap;
};

export const constructVersionTypes = (version: string): Record<string, string> => {
  const prefix = VERSION_PREFIXES.find((candidate) => version.startsWith(candidate));

  if (!prefix) {
    return { bumpCharacter: "", bumpVersion: version, exactVersion: version };
  }

  const isStrictInequality = STRICT_INEQUALITY_VERSION_PREFIXES.some(
    (strictPrefix) => strictPrefix === prefix,
  );
  const bumpCharacter = isStrictInequality
    ? ""
    : prefix === "^" || prefix === "~"
      ? version[0]
      : prefix;
  const exactVersion =
    prefix === "^" || prefix === "~"
      ? stripRepeatingVersionPrefixes(version)
      : version.slice(prefix.length);

  return { bumpCharacter, bumpVersion: version, exactVersion };
};

const isExplicitTargetSpec = (version: string): boolean => {
  const { bumpVersion, exactVersion } = constructVersionTypes(version);
  return bumpVersion !== exactVersion;
};

const constructExpectedVersion = (currentBumpCharacter: string, targetVersion: string): string => {
  const target = constructVersionTypes(targetVersion);
  if (isExplicitTargetSpec(targetVersion)) return target.bumpVersion;
  return `${currentBumpCharacter}${target.exactVersion}`;
};

const isUpdatablePermissiveDep = (
  name: string,
  currentVersion: string,
  exactVersion: string,
  versionMap: Record<string, string>,
  level: Level,
  versionStrategy: VersionStrategy,
): boolean => {
  const latestVersion = versionMap[name];
  if (!latestVersion) return false;
  const normalizedLatestVersion = constructVersionTypes(latestVersion).exactVersion;
  const isDifferent = isExplicitTargetSpec(latestVersion)
    ? currentVersion !== latestVersion
    : exactVersion !== normalizedLatestVersion;
  const isAllowed = isWithinLevel(exactVersion, normalizedLatestVersion, level, versionStrategy);
  return isDifferent && isAllowed;
};

export const constructPermissiveDepsToUpdateList = (
  dep = {} as Record<string, string>,
  codependencies: Array<string> = [],
  versionMap: Record<string, string> = {},
  level: Level = "major",
  versionStrategy: VersionStrategy = "semver",
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];

  return Object.entries(dep)
    .filter(([name]) => !codependencies.includes(name))
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter } = constructVersionTypes(version);
      return { name, version, exactVersion, bumpCharacter };
    })
    .filter(({ name, version, exactVersion }) =>
      isUpdatablePermissiveDep(name, version, exactVersion, versionMap, level, versionStrategy),
    )
    .map(({ name, version, bumpCharacter }) => ({
      name,
      actual: version,
      exact: constructVersionTypes(versionMap[name]).exactVersion,
      expected: constructExpectedVersion(bumpCharacter, versionMap[name]),
    }));
};

const isUpdatableDep = (
  name: string,
  currentVersion: string,
  exactVersion: string,
  versionMap: Record<string, string>,
  level: Level,
  versionStrategy: VersionStrategy,
): boolean => {
  const latestVersion = versionMap[name];
  if (!latestVersion) return false;
  const normalizedLatestVersion = constructVersionTypes(latestVersion).exactVersion;
  const isDifferent = isExplicitTargetSpec(latestVersion)
    ? latestVersion !== currentVersion
    : normalizedLatestVersion !== exactVersion;
  const isAllowed = isWithinLevel(exactVersion, normalizedLatestVersion, level, versionStrategy);
  return isDifferent && isAllowed;
};

export const constructDepsToUpdateList = (
  dep = {} as Record<string, string>,
  versionMap: Record<string, string>,
  level: Level = "major",
  versionStrategy: VersionStrategy = "semver",
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];

  return Object.entries(dep)
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter, bumpVersion } = constructVersionTypes(version);
      return { name, exactVersion, bumpCharacter, bumpVersion };
    })
    .filter(({ name, bumpVersion, exactVersion }) =>
      isUpdatableDep(name, bumpVersion, exactVersion, versionMap, level, versionStrategy),
    )
    .map(({ name, bumpVersion, bumpCharacter }) => ({
      name,
      actual: bumpVersion,
      exact: constructVersionTypes(versionMap[name]).exactVersion,
      expected: constructExpectedVersion(bumpCharacter, versionMap[name]),
    }));
};

export const constructDeps = <T extends DependencySections>(
  json: T,
  depName: DependencySection,
  depList: Array<DepToUpdateItem>,
) =>
  depList?.length
    ? depList.reduce(
        (newJson: Record<string, string>, { name, expected: version }: DepToUpdateItem) => {
          return {
            ...json[depName],
            ...newJson,
            [name]: version,
          };
        },
        {},
      )
    : json[depName];

export const constructJson = <T extends DependencySections>(
  json: T,
  depsToUpdate: DepsToUpdate,
  isDebugging = false,
) => {
  const { depList, devDepList, peerDepList, optionalDepList } = depsToUpdate;
  const dependencies = constructDeps(json, "dependencies", depList);
  const devDependencies = constructDeps(json, "devDependencies", devDepList);
  const peerDependencies = constructDeps(json, "peerDependencies", peerDepList);
  const optionalDependencies = constructDeps(json, "optionalDependencies", optionalDepList);
  if (isDebugging) {
    logger.debug("constructJson debug info", {
      dependencies,
      devDependencies,
      peerDependencies,
      optionalDependencies,
    });
  }
  return {
    ...json,
    ...(dependencies ? { dependencies } : {}),
    ...(devDependencies ? { devDependencies } : {}),
    ...(peerDependencies ? { peerDependencies } : {}),
    ...(optionalDependencies ? { optionalDependencies } : {}),
  };
};

const firstDifferentVersion = (
  versions: readonly string[],
  targetVersion: string | undefined,
): string | undefined =>
  versions.reduce<string | undefined>((differentVersion, version) => {
    if (differentVersion) return differentVersion;
    return version !== targetVersion ? version : undefined;
  }, undefined);

const staleVersionMap = (
  dependencyVersions: Record<string, readonly string[]>,
  versionMap: Record<string, string>,
): Map<string, string> => {
  const entries = Object.entries(dependencyVersions).flatMap(([name, versions]) => {
    const staleVersion = firstDifferentVersion(versions, versionMap[name]);
    return staleVersion ? [[name, staleVersion] as const] : [];
  });
  return new Map(entries);
};

const dependenciesForComparison = (
  dependencies: Record<string, string> | undefined,
  dependencyVersions: Record<string, readonly string[]> | undefined,
  versionMap: Record<string, string>,
): Record<string, string> | undefined => {
  if (!dependencies || !dependencyVersions) return dependencies;

  const staleVersions = staleVersionMap(dependencyVersions, versionMap);
  const entries = Object.entries(dependencies).map(([name, currentVersion]) => {
    const comparedVersion = staleVersions.get(name) ?? currentVersion;
    return [name, comparedVersion];
  });
  return Object.fromEntries(entries);
};

export const buildUpdateLists = <T extends DependencySections>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions,
  codependencies?: Array<string>,
): DepsToUpdate => {
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } = json;
  const { permissive, level = "major", versionStrategy = "semver" } = options;
  const dependencyVersions = json.dependencyVersions;
  const comparedDependencies = dependenciesForComparison(
    dependencies,
    dependencyVersions,
    versionMap,
  );
  const comparedDevDependencies = dependenciesForComparison(
    devDependencies,
    dependencyVersions,
    versionMap,
  );
  const comparedPeerDependencies = dependenciesForComparison(
    peerDependencies,
    dependencyVersions,
    versionMap,
  );
  const comparedOptionalDependencies = dependenciesForComparison(
    optionalDependencies,
    dependencyVersions,
    versionMap,
  );

  if (permissive) {
    const coDeps = codependencies || [];
    return {
      depList: constructPermissiveDepsToUpdateList(
        comparedDependencies,
        coDeps,
        versionMap,
        level,
        versionStrategy,
      ),
      devDepList: constructPermissiveDepsToUpdateList(
        comparedDevDependencies,
        coDeps,
        versionMap,
        level,
        versionStrategy,
      ),
      peerDepList: constructPermissiveDepsToUpdateList(
        comparedPeerDependencies,
        coDeps,
        versionMap,
        level,
        versionStrategy,
      ),
      optionalDepList: constructPermissiveDepsToUpdateList(
        comparedOptionalDependencies,
        coDeps,
        versionMap,
        level,
        versionStrategy,
      ),
    };
  }

  return {
    depList: constructDepsToUpdateList(comparedDependencies, versionMap, level, versionStrategy),
    devDepList: constructDepsToUpdateList(
      comparedDevDependencies,
      versionMap,
      level,
      versionStrategy,
    ),
    peerDepList: constructDepsToUpdateList(
      comparedPeerDependencies,
      versionMap,
      level,
      versionStrategy,
    ),
    optionalDepList: constructDepsToUpdateList(
      comparedOptionalDependencies,
      versionMap,
      level,
      versionStrategy,
    ),
  };
};

const logDependencyIssues = (depsToUpdate: DepsToUpdate): void => {
  const allLists = [
    depsToUpdate.depList,
    depsToUpdate.devDepList,
    depsToUpdate.peerDepList,
    depsToUpdate.optionalDepList,
  ];
  allLists.forEach((list) => {
    if (!list.length) return;

    const issueCount = list.length;
    const pluralizedIssues = issueCount > 1 ? "s" : "";
    logger.info(`Found ${issueCount} dependency issue${pluralizedIssues}`);

    list.forEach(({ name: depName, expected, actual }, index) => {
      const versionMessage = `${depName}: found ${actual}, expected ${expected}`;
      defaultOutput.writeLine(item(index + 1, versionMessage, 4));
    });

    logger.space();
  });
};

const applyUpdates = <T extends PackageJSON>(
  json: T,
  depsToUpdate: DepsToUpdate,
  isDebugging: boolean,
  isTesting: boolean,
): void => {
  const updatedJson = constructJson(json, depsToUpdate, isDebugging);
  const { path, ...newJson } = updatedJson;
  if (!isTesting) {
    writeFileSync(path, JSON.stringify(newJson, null, 2).concat("\n"));
  } else {
    logger.info(`test-writeFileSync: ${path}`);
  }
};

const constructUpdatedManifest = (
  manifest: DependencyManifest,
  depsToUpdate: DepsToUpdate,
  isDebugging: boolean,
): DependencyManifest => constructJson(manifest, depsToUpdate, isDebugging);

const applyManifestUpdates = async (
  loadedManifest: LoadedManifest,
  depsToUpdate: DepsToUpdate,
  isDebugging: boolean,
  isTesting: boolean,
): Promise<void> => {
  if (isTesting) {
    logger.info(`test-writeFileSync: ${loadedManifest.path}`);
    return;
  }

  const updatedManifest = constructUpdatedManifest(
    loadedManifest.manifest,
    depsToUpdate,
    isDebugging,
  );
  await loadedManifest.provider.writeManifest(loadedManifest.path, updatedManifest);
};

export const checkDependenciesForVersion = <T extends PackageJSON>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions,
  codependencies?: Array<string>,
): boolean => {
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } = json;
  const { isUpdating, isDebugging, isSilent, isTesting } = options;

  const hasNoDeps = !dependencies && !devDependencies && !peerDependencies && !optionalDependencies;
  if (hasNoDeps) return false;

  const depsToUpdate = buildUpdateLists(versionMap, json, options, codependencies);

  if (isDebugging) {
    logger.debug("checkDependenciesForVersion debug info", depsToUpdate);
  }

  const hasNoDependencyIssues =
    !depsToUpdate.depList.length &&
    !depsToUpdate.devDepList.length &&
    !depsToUpdate.peerDepList.length &&
    !depsToUpdate.optionalDepList.length;
  if (hasNoDependencyIssues) return false;

  if (!isSilent) {
    logDependencyIssues(depsToUpdate);
  }

  if (isUpdating) {
    applyUpdates(json, depsToUpdate, isDebugging || false, isTesting || false);
  }

  return true;
};

const checkManifestDependenciesForVersion = async (
  versionMap: Record<string, string>,
  loadedManifest: LoadedManifest,
  options: CheckDependenciesForVersionOptions,
  codependencies?: Array<string>,
): Promise<boolean> => {
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } =
    loadedManifest.manifest;
  const { isUpdating, isDebugging, isSilent, isTesting } = options;

  const hasNoDeps = !dependencies && !devDependencies && !peerDependencies && !optionalDependencies;
  if (hasNoDeps) return false;

  const depsToUpdate = buildUpdateLists(
    versionMap,
    loadedManifest.manifest,
    options,
    codependencies,
  );

  if (isDebugging) {
    logger.debug("checkManifestDependenciesForVersion debug info", depsToUpdate);
  }

  const hasNoDependencyIssues =
    !depsToUpdate.depList.length &&
    !depsToUpdate.devDepList.length &&
    !depsToUpdate.peerDepList.length &&
    !depsToUpdate.optionalDepList.length;
  if (hasNoDependencyIssues) return false;

  if (!isSilent) {
    logDependencyIssues(depsToUpdate);
  }

  if (isUpdating) {
    await applyManifestUpdates(
      loadedManifest,
      depsToUpdate,
      isDebugging || false,
      isTesting || false,
    );
  }

  return true;
};

const processMatchedFile = (
  file: string,
  rootDir: string,
  versionMap: Record<string, string>,
  options: MatchedFileOptions,
  codependencies?: Array<string>,
): boolean => {
  const path = resolveManifestPath(rootDir, file);
  const packageJson = readFileSync(path, "utf8");
  const json = JSON.parse(packageJson);
  const jsonWithPath = { ...json, path };

  return checkDependenciesForVersion(versionMap, jsonWithPath, options, codependencies);
};

export const checkMatches = ({
  versionMap,
  rootDir,
  files,
  isUpdating = false,
  isDebugging = false,
  isSilent = true,
  isVerbose = false,
  isQuiet = false,
  isCLI = false,
  isTesting = false,
  permissive = false,
  codependencies,
  level = "major",
}: CheckMatches & {
  permissive?: boolean;
  codependencies?: Array<string>;
  level?: Level;
}): void => {
  const options = {
    isUpdating,
    isDebugging,
    isSilent,
    isVerbose,
    isQuiet,
    isTesting,
    permissive,
    level,
  };

  const packagesNeedingUpdate = files.filter((file) =>
    processMatchedFile(file, rootDir, versionMap, options, codependencies),
  );

  if (isDebugging) {
    logger.debug("see updates", { packagesNeedingUpdate });
  }

  const isOutOfDate = packagesNeedingUpdate.length > 0;
  if (isOutOfDate && !isUpdating) {
    logger.error("Dependencies are not correct.");
    if (isCLI) process.exit(1);
    else throw new Error("Dependencies are not correct.");
  } else if (isOutOfDate) {
    logger.info("Dependencies were not correct but should be updated! Check your git status.");
  } else {
    logger.info("No dependency issues found!");
  }
};

const checkLoadedManifests = async ({
  manifests,
  versionMap,
  isUpdating = false,
  isDebugging = false,
  isSilent = true,
  isVerbose = false,
  isQuiet = false,
  isCLI = false,
  isTesting = false,
  permissive = false,
  codependencies,
  level = "major",
  deferFailure = false,
}: CheckLoadedManifestsOptions): Promise<boolean> => {
  const options = {
    isUpdating,
    isDebugging,
    isSilent,
    isVerbose,
    isQuiet,
    isTesting,
    permissive,
    level,
  };

  const packagesNeedingUpdate: string[] = [];
  for (const manifest of manifests) {
    const manifestOptions = {
      ...options,
      versionStrategy: manifest.provider.capabilities.versionStrategy,
    };
    const effectiveVersionMap = aliasVersionMapForManifest(versionMap, manifest);
    const effectiveCodependencies = aliasCodependenciesForManifest(codependencies, manifest);
    const needsUpdate = await checkManifestDependenciesForVersion(
      effectiveVersionMap,
      manifest,
      manifestOptions,
      effectiveCodependencies,
    );
    if (needsUpdate) {
      packagesNeedingUpdate.push(manifest.file);
    }
  }

  if (isDebugging) {
    logger.debug("see updates", { packagesNeedingUpdate });
  }

  const isOutOfDate = packagesNeedingUpdate.length > 0;
  if (isOutOfDate && !isUpdating) {
    if (!isSilent && !isQuiet) {
      logger.error("Dependencies are not correct.");
    }
    if (!deferFailure) {
      if (isCLI) process.exit(1);
      else throw new Error("Dependencies are not correct.");
    }
  } else if (isOutOfDate) {
    if (!isSilent && !isQuiet) {
      logger.info("Dependencies were not correct but should be updated! Check your git status.");
    }
  } else if (!isSilent && !isQuiet) {
    logger.info("No dependency issues found!");
  }

  return isOutOfDate;
};

const extractDepNamesFromFile = (rootDir: string, file: string): string[] => {
  const path = resolveManifestPath(rootDir, file);
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    return DEP_SECTIONS.map((section) => json[section])
      .filter(Boolean)
      .flatMap((section: Record<string, string>) => Object.keys(section));
  } catch {
    return [];
  }
};

const collectAllDepNames = (files: string[], rootDir: string): string[] => {
  const allNames = files.flatMap((file) => extractDepNamesFromFile(rootDir, file));
  return Array.from(new Set(allNames));
};

export const detectStaleCodependencies = (
  codependencies: import("../types").CodeDependencies,
  files: string[],
  rootDir: string,
): string[] => {
  const pinnedNames = codependencies
    .map((dep) => (typeof dep === "string" ? dep : Object.keys(dep)[0]))
    .filter(Boolean);

  if (pinnedNames.length === 0) return [];

  const allDepNames = new Set(collectAllDepNames(files, rootDir));
  return pinnedNames.filter((name) => !allDepNames.has(name));
};

const promptForSelection = async (allDiffs: VersionDiff[]): Promise<string[]> => {
  const diffsNeedingUpdate = allDiffs.filter((d) => d.willUpdate);

  if (diffsNeedingUpdate.length === 0) return [];

  const prompt = new Prompt();
  const choices = diffsNeedingUpdate.map((diff) => ({
    name: `${diff.package} (${diff.current} -> ${diff.latest})`,
    value: diff.package,
  }));
  const selected = await prompt.checkbox("Select packages to update:", choices);
  prompt.close();

  return selected;
};

export const filterSelectedDeps = (
  selected: string[],
  depNames: string[],
  versionMap: Record<string, string>,
): InteractiveResult => {
  if (selected.length === 0) {
    logger.info("No packages selected. Skipping update.");
    return { shouldUpdate: false, depNames, versionMap };
  }

  const filteredDepNames = depNames.filter((dep) => selected.includes(dep));
  const filteredVersionMap = filteredDepNames.reduce((acc: Record<string, string>, dep) => {
    const version = versionMap[dep];
    if (version) acc[dep] = version;
    return acc;
  }, {});

  return { shouldUpdate: true, depNames: filteredDepNames, versionMap: filteredVersionMap };
};

const applyInteractiveSelection = async (
  allDiffs: VersionDiff[],
  depNames: string[],
  versionMap: Record<string, string>,
): Promise<InteractiveResult> => {
  const diffsNeedingUpdate = allDiffs.filter((d) => d.willUpdate);
  const candidateDepNames = diffsNeedingUpdate.map((diff) => diff.package);

  if (diffsNeedingUpdate.length === 0) {
    return {
      shouldUpdate: true,
      depNames: depNames.length > 0 ? depNames : candidateDepNames,
      versionMap,
    };
  }

  const selected = await promptForSelection(allDiffs);
  return filterSelectedDeps(
    selected,
    depNames.length > 0 ? depNames : candidateDepNames,
    versionMap,
  );
};

const resolvePreciseModeDeps = async (
  manifests: LoadedManifest[],
  versionMap: Record<string, string>,
  options: PreciseModeOptions,
): Promise<Record<string, string>> => {
  const allDepNames = collectAllDepNamesFromManifests(manifests);
  const aliasedVersionMap = aliasVersionMapForManifests(versionMap, manifests);
  const unresolvedDeps = allDepNames.filter((name) => !aliasedVersionMap[name]);

  if (unresolvedDeps.length === 0) return aliasedVersionMap;

  const additionalMap = await constructVersionMap({
    codependencies: unresolvedDeps,
    debug: options.debug,
    yarnConfig: options.yarnConfig,
    isTesting: options.isTesting,
    noCache: options.noCache,
    onProgress: options.onProgress,
    resolveVersion: options.resolveVersion,
    cachePrefix: options.cachePrefix,
    validate: options.validate,
  });

  return { ...aliasedVersionMap, ...additionalMap };
};

const resolveEffectiveMode = ({
  codependencies,
  mode,
  permissive,
}: Pick<CheckFiles, "codependencies" | "mode" | "permissive">): "verbose" | "precise" => {
  if (mode) return mode;
  if (permissive === true) return "precise";
  if (permissive === false) return "verbose";

  return Array.isArray(codependencies) && codependencies.length > 0 ? "verbose" : "precise";
};

export const checkFiles = async ({
  codependencies,
  files: matchers,
  rootDir = "./",
  ignore = ["**/node_modules/**"],
  update = false,
  debug = false,
  silent = false,
  verbose = false,
  quiet = false,
  isCLI = false,
  yarnConfig = false,
  isTesting = false,
  permissive,
  language,
  dryRun = false,
  interactive = false,
  noCache = false,
  format,
  onProgress,
  level = "major",
  mode,
  packageManager,
  deferFailure = false,
  onDeferredFailure,
}: CheckFiles): Promise<VersionDiff[] | void> => {
  try {
    const resolvedRootDir = resolve(rootDir);
    const effectiveMatchers = resolveMatchers(resolvedRootDir, matchers, language);
    const files = glob(effectiveMatchers, {
      cwd: resolvedRootDir,
      ignore,
    });
    const manifests = loadManifests(files, resolvedRootDir, {
      language,
      debug,
      yarnConfig,
      isTesting,
      packageManager,
    });
    const versionResolver = createVersionResolver(manifests, resolvedRootDir, {
      language,
      debug,
      yarnConfig,
      isTesting,
      packageManager,
    });
    const validate = createPackageValidator(versionResolver.provider);
    const effectiveMode = resolveEffectiveMode({
      codependencies,
      mode,
      permissive,
    });
    const isPreciseMode = effectiveMode === "precise";
    assertProviderResolutionSupport(
      manifests,
      versionResolver.provider,
      codependencies,
      isPreciseMode,
    );

    const hasNoDepsAndNotPrecise = !codependencies && !isPreciseMode;
    if (hasNoDepsAndNotPrecise) {
      throw '"codependencies" are required (unless using precise mode)';
    }

    let versionMap: Record<string, string> = {};
    let depNames: string[] = [];

    const hasDependencies = codependencies && codependencies.length > 0;

    if (hasDependencies && !silent && !quiet) {
      const stale = detectStaleCodependenciesFromManifests(codependencies, manifests);
      if (stale.length > 0) {
        const label = stale.length === 1 ? "codependency" : "codependencies";
        logger.warn(`${stale.length} stale ${label} not found in any manifest:`);
        stale.forEach((name) => logger.warn(`  - ${name}`));
      }
    }

    if (hasDependencies) {
      versionMap = await constructVersionMap({
        codependencies,
        debug,
        yarnConfig,
        isTesting,
        noCache,
        onProgress,
        resolveVersion: versionResolver.resolveVersion,
        cachePrefix: versionResolver.cachePrefix,
        validate,
      });
      depNames = codependencies
        .map((dep) => (typeof dep === "string" ? dep : Object.keys(dep)[0]))
        .filter(Boolean);
    }

    if (isPreciseMode) {
      versionMap = await resolvePreciseModeDeps(manifests, versionMap, {
        debug,
        yarnConfig,
        isTesting,
        noCache,
        onProgress,
        resolveVersion: versionResolver.resolveVersion,
        cachePrefix: versionResolver.cachePrefix,
        validate,
      });
    }

    versionMap = aliasVersionMapForManifests(versionMap, manifests);
    depNames = aliasCodependenciesForManifests(depNames, manifests);

    const isOutputEnabled = !silent && !quiet;
    const hasUpdateOutput = update || dryRun;
    const hasOutputChanges = hasUpdateOutput && isOutputEnabled;
    const shouldCollectDiffs = format !== undefined || hasOutputChanges;
    const allDiffs = shouldCollectDiffs
      ? collectDiffsFromManifests(
          versionMap,
          manifests.map(({ manifest, provider }) => ({
            ...manifest,
            versionStrategy: provider.capabilities.versionStrategy,
          })),
          depNames,
          isPreciseMode,
          level,
        )
      : [];

    const shouldShowDiffs = hasOutputChanges && format === undefined;
    if (shouldShowDiffs && allDiffs.length > 0) {
      displayVersionDiffs(allDiffs, dryRun);
    }

    let shouldUpdate = update && !dryRun;

    const canPromptInteractively = !dryRun && !isTesting;
    const isInteractiveUpdate = interactive && update && canPromptInteractively;
    if (isInteractiveUpdate) {
      const result = await applyInteractiveSelection(allDiffs, depNames, versionMap);
      shouldUpdate = result.shouldUpdate;
      depNames = result.depNames;
      versionMap = result.versionMap;
    }

    const shouldDeferFailure = format !== undefined || deferFailure;
    const isOutOfDate = await checkLoadedManifests({
      manifests,
      versionMap,
      isCLI,
      isSilent: silent || format !== undefined,
      isVerbose: verbose,
      isQuiet: quiet,
      isUpdating: shouldUpdate,
      isDebugging: debug,
      isTesting,
      permissive: isPreciseMode,
      codependencies: depNames,
      level,
      deferFailure: shouldDeferFailure,
    });

    if (shouldDeferFailure && isCLI && isOutOfDate && !shouldUpdate) {
      onDeferredFailure?.();
      process.exitCode = 1;
    }

    return allDiffs;
  } catch (err) {
    if (debug) {
      logger.debug((err as string).toString());
    }
    throw err;
  }
};

export const codependence = checkFiles;
export const script = checkFiles;
export default checkFiles;
