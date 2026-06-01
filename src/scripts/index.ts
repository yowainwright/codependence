import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import {
  DEFAULT_LANGUAGE_MANIFESTS,
  GoProvider,
  LANGUAGES,
  MANIFEST_FILES,
  NODE_PACKAGE_MANAGERS,
  NodeJSProvider,
  PYTHON_MANIFEST_FILES,
  PythonProvider,
  detectNodePackageManager,
  detectPrimaryLanguage,
  detectPythonPackageManagerForManifest,
} from "../providers";
import type { PythonPackageManager } from "../providers/python/constants";
import type { DependencyManifest, DependencyProvider } from "../providers/types";
import { validatePackageName } from "../utils/validate-package";
import { exec } from "../utils/exec";
import { glob } from "../utils/glob";
import { logger } from "../logger";
import { defaultOutput, item } from "../dx";
import { versionCache, requestDeduplicator } from "../utils/cache";
import { formatEnhancedError } from "../utils/suggestions";
import { collectDiffsFromManifests, displayVersionDiffs } from "../utils/diff";
import { Prompt } from "../utils/prompts";
import { isWithinLevel } from "../utils/semver";
import { DEP_SECTIONS } from "./constants";
import {
  STRICT_INEQUALITY_VERSION_PREFIXES,
  VERSION_PREFIXES,
} from "../utils/constants";
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

const DEFAULT_FILE_MATCHERS: Record<SupportedLanguage, string[]> = {
  [LANGUAGES.NODEJS]: [...DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.NODEJS]],
  [LANGUAGES.GO]: [...DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.GO]],
  [LANGUAGES.PYTHON]: [...DEFAULT_LANGUAGE_MANIFESTS[LANGUAGES.PYTHON]],
};

const PYTHON_MANIFEST_NAMES = new Set<string>(PYTHON_MANIFEST_FILES);
const VERSION_RESOLUTION_CONCURRENCY = 8;

type LoadedManifest = {
  file: string;
  path: string;
  language: SupportedLanguage;
  packageManager: string;
  provider: DependencyProvider;
  manifest: DependencyManifest;
};

type DependencySections = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
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
  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  return results;
};

const resolveManifestPath = (rootDir: string, file: string): string =>
  resolve(rootDir, file);

const inferLanguageFromFile = (file: string): SupportedLanguage | null => {
  const manifestName = basename(file);

  if (manifestName === MANIFEST_FILES.PACKAGE_JSON) return LANGUAGES.NODEJS;
  if (manifestName === MANIFEST_FILES.GO_MOD) return LANGUAGES.GO;
  if (PYTHON_MANIFEST_NAMES.has(manifestName)) return LANGUAGES.PYTHON;

  return null;
};

const resolveTargetLanguage = (
  rootDir: string,
  language?: SupportedLanguage,
): SupportedLanguage => {
  if (language) return language;

  const detected = detectPrimaryLanguage(rootDir)?.language;
  if (
    detected === LANGUAGES.NODEJS ||
    detected === LANGUAGES.GO ||
    detected === LANGUAGES.PYTHON
  ) {
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

const createProvider = (
  language: SupportedLanguage,
  filePath: string,
  options: Pick<CheckFiles, "debug" | "yarnConfig" | "isTesting">,
): { provider: DependencyProvider; packageManager: string } => {
  const providerOptions = {
    debug: options.debug,
    yarnConfig: options.yarnConfig,
    isTesting: options.isTesting,
  };

  switch (language) {
    case LANGUAGES.NODEJS: {
      const packageManager = options.yarnConfig
        ? NODE_PACKAGE_MANAGERS.YARN
        : detectNodePackageManager(dirname(filePath));
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
    case LANGUAGES.PYTHON: {
      const packageManager = detectPythonPackageManagerForManifest(
        filePath,
      ) as PythonPackageManager;
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
  options: Pick<CheckFiles, "language" | "debug" | "yarnConfig" | "isTesting">,
): LoadedManifest[] =>
  files.map((file) => {
    const path = resolveManifestPath(rootDir, file);
    const language =
      options.language ||
      inferLanguageFromFile(file) ||
      resolveTargetLanguage(dirname(path));
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

const collectDepNamesFromManifest = (manifest: DependencyManifest): string[] =>
  DEP_SECTIONS.map((section) => manifest[section])
    .filter(
      (section): section is Record<string, string> => section !== undefined,
    )
    .flatMap((section) => Object.keys(section));

const collectAllDepNamesFromManifests = (
  manifests: LoadedManifest[],
): string[] =>
  Array.from(
    new Set(manifests.flatMap(({ manifest }) => collectDepNamesFromManifest(manifest))),
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
  options: Pick<CheckFiles, "language" | "debug" | "yarnConfig" | "isTesting">,
): {
  provider: DependencyProvider;
  resolveVersion: (packageName: string) => Promise<string>;
  cachePrefix: string;
} => {
  const language = resolveTargetLanguage(rootDir, options.language);
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

const createPackageValidator = (
  provider: DependencyProvider,
): NonNullable<ConstructVersionMapOptions["validate"]> => (
  packageName: string,
) => {
  const isValid = provider.validatePackageName(packageName);

  return {
    validForNewPackages: isValid,
    validForOldPackages: isValid,
    errors: isValid ? [] : [`Invalid ${provider.language} package name`],
  };
};

export const resolveObjectDep = (
  dep: Record<string, string>,
): Record<string, string> | null => {
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

export const resolveFromCache = (
  cacheKey: string,
  noCache: boolean,
): string | null => {
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
  const runner = !yarnConfig
    ? NODE_PACKAGE_MANAGERS.NPM
    : NODE_PACKAGE_MANAGERS.YARN;
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

  const isValidationError =
    err instanceof Error && err.message.includes("Invalid package");

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
    cachePrefix ||
    `${yarnConfig ? NODE_PACKAGE_MANAGERS.YARN : NODE_PACKAGE_MANAGERS.NPM}`;

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

export const constructVersionTypes = (
  version: string,
): Record<string, string> => {
  const prefix = VERSION_PREFIXES.find((candidate) =>
    version.startsWith(candidate),
  );

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
      ? version.replace(/^[~^]+/, "")
      : version.slice(prefix.length);

  return { bumpCharacter, bumpVersion: version, exactVersion };
};

const isExplicitTargetSpec = (version: string): boolean => {
  const { bumpVersion, exactVersion } = constructVersionTypes(version);
  return bumpVersion !== exactVersion;
};

const constructExpectedVersion = (
  currentBumpCharacter: string,
  targetVersion: string,
): string => {
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
): boolean => {
  const latestVersion = versionMap[name];
  if (!latestVersion) return false;
  const normalizedLatestVersion = constructVersionTypes(latestVersion).exactVersion;
  const isDifferent = isExplicitTargetSpec(latestVersion)
    ? currentVersion !== latestVersion
    : exactVersion !== normalizedLatestVersion;
  const isAllowed = isWithinLevel(exactVersion, normalizedLatestVersion, level);
  return isDifferent && isAllowed;
};

export const constructPermissiveDepsToUpdateList = (
  dep = {} as Record<string, string>,
  codependencies: Array<string> = [],
  versionMap: Record<string, string> = {},
  level: Level = "major",
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];

  return Object.entries(dep)
    .filter(([name]) => !codependencies.includes(name))
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter } = constructVersionTypes(version);
      return { name, version, exactVersion, bumpCharacter };
    })
    .filter(({ name, version, exactVersion }) =>
      isUpdatablePermissiveDep(name, version, exactVersion, versionMap, level),
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
): boolean => {
  const latestVersion = versionMap[name];
  if (!latestVersion) return false;
  const normalizedLatestVersion = constructVersionTypes(latestVersion).exactVersion;
  const isDifferent = isExplicitTargetSpec(latestVersion)
    ? latestVersion !== currentVersion
    : normalizedLatestVersion !== exactVersion;
  const isAllowed = isWithinLevel(exactVersion, normalizedLatestVersion, level);
  return isDifferent && isAllowed;
};

export const constructDepsToUpdateList = (
  dep = {} as Record<string, string>,
  versionMap: Record<string, string>,
  level: Level = "major",
): Array<DepToUpdateItem> => {
  if (!Object.keys(dep).length) return [];

  return Object.entries(dep)
    .map(([name, version]) => {
      const { exactVersion, bumpCharacter, bumpVersion } =
        constructVersionTypes(version);
      return { name, exactVersion, bumpCharacter, bumpVersion };
    })
    .filter(({ name, bumpVersion, exactVersion }) =>
      isUpdatableDep(name, bumpVersion, exactVersion, versionMap, level),
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
  depName: keyof DependencySections,
  depList: Array<DepToUpdateItem>,
) =>
  depList?.length
    ? depList.reduce(
        (
          newJson: Record<string, string>,
          { name, expected: version }: DepToUpdateItem,
        ) => {
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
    logger.debug("constructJson debug info", { dependencies, devDependencies, peerDependencies, optionalDependencies });
  }
  return {
    ...json,
    ...(dependencies ? { dependencies } : {}),
    ...(devDependencies ? { devDependencies } : {}),
    ...(peerDependencies ? { peerDependencies } : {}),
    ...(optionalDependencies ? { optionalDependencies } : {}),
  };
};

export const buildUpdateLists = <T extends DependencySections>(
  versionMap: Record<string, string>,
  json: T,
  options: CheckDependenciesForVersionOptions,
  codependencies?: Array<string>,
): DepsToUpdate => {
  const { dependencies, devDependencies, peerDependencies, optionalDependencies } = json;
  const { permissive, level = "major" } = options;

  if (permissive) {
    const coDeps = codependencies || [];
    return {
      depList: constructPermissiveDepsToUpdateList(dependencies, coDeps, versionMap, level),
      devDepList: constructPermissiveDepsToUpdateList(devDependencies, coDeps, versionMap, level),
      peerDepList: constructPermissiveDepsToUpdateList(peerDependencies, coDeps, versionMap, level),
      optionalDepList: constructPermissiveDepsToUpdateList(optionalDependencies, coDeps, versionMap, level),
    };
  }

  return {
    depList: constructDepsToUpdateList(dependencies, versionMap, level),
    devDepList: constructDepsToUpdateList(devDependencies, versionMap, level),
    peerDepList: constructDepsToUpdateList(peerDependencies, versionMap, level),
    optionalDepList: constructDepsToUpdateList(optionalDependencies, versionMap, level),
  };
};

const logDependencyIssues = (
  depsToUpdate: DepsToUpdate,
): void => {
  const allLists = [depsToUpdate.depList, depsToUpdate.devDepList, depsToUpdate.peerDepList, depsToUpdate.optionalDepList];
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
): DependencyManifest =>
  constructJson(manifest, depsToUpdate, isDebugging);

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

  const hasNoDeps =
    !dependencies &&
    !devDependencies &&
    !peerDependencies &&
    !optionalDependencies;
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
  options: {
    isUpdating: boolean;
    isDebugging: boolean;
    isSilent: boolean;
    isVerbose: boolean;
    isQuiet: boolean;
    isTesting: boolean;
    permissive: boolean;
    level: Level;
  },
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
  const options = { isUpdating, isDebugging, isSilent, isVerbose, isQuiet, isTesting, permissive, level };

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
}: {
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
  codependencies?: Array<string>;
  level?: Level;
  deferFailure?: boolean;
}): Promise<boolean> => {
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
    const needsUpdate = await checkManifestDependenciesForVersion(
      versionMap,
      manifest,
      options,
      codependencies,
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
      logger.info(
        "Dependencies were not correct but should be updated! Check your git status.",
      );
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
    return DEP_SECTIONS
      .map((section) => json[section])
      .filter(Boolean)
      .flatMap((section: Record<string, string>) => Object.keys(section));
  } catch {
    return [];
  }
};

const collectAllDepNames = (
  files: string[],
  rootDir: string,
): string[] => {
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

const promptForSelection = async (
  allDiffs: VersionDiff[],
): Promise<string[]> => {
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
  const filteredVersionMap = filteredDepNames.reduce(
    (acc: Record<string, string>, dep) => {
      const version = versionMap[dep];
      if (version) acc[dep] = version;
      return acc;
    },
    {},
  );

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
  options: {
    debug: boolean;
    yarnConfig: boolean;
    isTesting: boolean;
    noCache: boolean;
    onProgress?: CheckFiles["onProgress"];
    resolveVersion: (packageName: string) => Promise<string>;
    cachePrefix: string;
    validate: NonNullable<ConstructVersionMapOptions["validate"]>;
  },
): Promise<Record<string, string>> => {
  const allDepNames = collectAllDepNamesFromManifests(manifests);
  const unresolvedDeps = allDepNames.filter((name) => !versionMap[name]);

  if (unresolvedDeps.length === 0) return versionMap;

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

  return { ...versionMap, ...additionalMap };
};

const resolveEffectiveMode = ({
  codependencies,
  mode,
  permissive,
}: Pick<CheckFiles, "codependencies" | "mode" | "permissive">): "verbose" | "precise" => {
  if (mode) return mode;
  if (permissive === true) return "precise";
  if (permissive === false) return "verbose";

  return Array.isArray(codependencies) && codependencies.length > 0
    ? "verbose"
    : "precise";
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
    });
    const versionResolver = createVersionResolver(manifests, resolvedRootDir, {
      language,
      debug,
      yarnConfig,
      isTesting,
    });
    const validate = createPackageValidator(versionResolver.provider);
    const effectiveMode = resolveEffectiveMode({
      codependencies,
      mode,
      permissive,
    });
    const isPreciseMode = effectiveMode === "precise";

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

    const hasOutputChanges = (update || dryRun) && !silent && !quiet;
    const shouldCollectDiffs = format !== undefined || hasOutputChanges;
    const allDiffs = shouldCollectDiffs
      ? collectDiffsFromManifests(
          versionMap,
          manifests.map(({ manifest }) => manifest),
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

    const isInteractiveUpdate = interactive && update && !dryRun && !isTesting;
    if (isInteractiveUpdate) {
      const result = await applyInteractiveSelection(allDiffs, depNames, versionMap);
      shouldUpdate = result.shouldUpdate;
      depNames = result.depNames;
      versionMap = result.versionMap;
    }

    const shouldDeferFailure = format !== undefined;
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
