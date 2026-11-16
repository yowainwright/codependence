import {
  ONBOARDING_CONFIG_PATH,
  ONBOARDING_MANAGERS,
  ONBOARDING_PACKAGE_FILE,
  ONBOARDING_PAT_URL,
  ONBOARDING_PROVIDERS,
  ONBOARDING_SCHEDULE,
  ONBOARDING_SECRET_NAME,
  ONBOARDING_TOKEN_PERMISSIONS,
  ONBOARDING_VERIFY_COMMANDS,
  ONBOARDING_VERSION_PATTERN,
} from "./constants";
import { ACTION_MANAGERS, VERSIONED_MANAGERS, RUST_TOOLCHAIN_VERSION_PATTERN } from "../constants";
import type { DependencyManager } from "../../types";
import { OnboardingError } from "./types";
import type {
  OnboardingAnswers,
  OnboardingArtifact,
  OnboardingCommandSet,
  OnboardingDependency,
  OnboardingFetcher,
  OnboardingManager,
  OnboardingManagerDetection,
  OnboardingPackageJson,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSetup,
  OnboardingSetupOptions,
  OnboardingSourceFile,
  OnboardingTokenSetup,
  ParsedOnboardingManifest,
  DependencyUsageEntry,
} from "./types";
import {
  createDependency,
  dependencyEntryGroups,
  groupDependencyEntriesBy,
  isOnboardingWorkspace,
  managerFromFiles,
  manifestDependencyEntries,
  manifestManager,
  normalizeOnboardingPath,
  onboardingInstallArgs,
  onboardingDependencyEntries,
  packageManagerValue,
  parseOnboardingManifest,
  repositorySecretUrl,
  repositorySourceFiles,
  selectedCodependencies,
  selectOnboardingManifests,
  selectOnboardingSourceFiles,
  commandForRoot,
  defaultManagerCommand,
  onboardingDirectory,
  renderWorkflow,
  areaForManager,
} from "./utils";

export { isOnboardingSourcePath, onboardingSourceFileNeedsContent } from "./utils";

export const onboardingError = (cause: unknown): OnboardingError => {
  if (cause instanceof OnboardingError) return cause;
  const message = cause instanceof Error ? cause.message : "Onboarding failed";
  return new OnboardingError({ message, cause });
};

export const collectOnboardingDependencies = (
  manifests: ParsedOnboardingManifest[],
): OnboardingDependency[] => {
  const entries = manifests.flatMap(manifestDependencyEntries);
  const groups = dependencyEntryGroups(entries);
  const dependencies = Array.from(groups, ([name, group]) => createDependency(name, group));
  return dependencies.toSorted((left, right) => left.name.localeCompare(right.name));
};

export const detectOnboardingManager = (
  root: OnboardingPackageJson,
  files: OnboardingSourceFile[],
): OnboardingManagerDetection => {
  const [candidate, managerVersion] = packageManagerValue(root);
  const isKnownManager = ONBOARDING_MANAGERS.has(candidate as OnboardingManager);
  const manager = isKnownManager ? (candidate as OnboardingManager) : managerFromFiles(files);
  if (!managerVersion) return { manager };
  return { manager, managerVersion };
};

export const onboardingCommands = (project: OnboardingProject): OnboardingCommandSet => {
  const manager = project.manager;
  if (!manager) return { verifyCommand: "codependence" };

  const args = onboardingInstallArgs(manager, project.workspace);
  const install = { command: manager, args };
  const commandParts: string[] = [manager];
  const installCommand = commandParts.concat(args).join(" ");
  const verifyCommand = ONBOARDING_VERIFY_COMMANDS[manager];
  return { installCommand, install, verifyCommand };
};

export const githubOnboardingEnabled = (answers: OnboardingAnswers): boolean => {
  const usesGithub = answers.enforcement === "github";
  const usesBoth = answers.enforcement === "both";
  return usesGithub || usesBoth;
};

export const parseOnboardingRepository = (value: string): OnboardingRepository => {
  const withoutProtocol = value.trim().replace(/^https?:\/\/github\.com\//, "");
  const withoutSsh = withoutProtocol.replace(/^git@github\.com:/, "");
  const withoutGit = withoutSsh.replace(/\.git\/?$/, "");
  const normalized = withoutGit.replace(/\/$/, "");
  const segments = normalized.split("/");
  const [owner, name] = segments;
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner || "");
  const validName = /^[A-Za-z0-9._-]+$/.test(name || "");
  const hasValidName = validOwner && validName;
  const hasValidSegments = segments.length === 2;
  const isValidRepository = hasValidName && hasValidSegments;
  if (!isValidRepository) throw new Error("Enter a GitHub repository as owner/name");
  return { owner, name };
};

export const createOnboardingTokenSetup = (
  answers: OnboardingAnswers,
  secretName = ONBOARDING_SECRET_NAME,
): OnboardingTokenSetup => {
  if (!answers.repository) throw new Error("GitHub enforcement requires a repository");
  const { owner, name } = answers.repository;
  return {
    secretName,
    personalAccessTokenUrl: ONBOARDING_PAT_URL,
    repositorySecretUrl: repositorySecretUrl(owner, name),
    permissions: ONBOARDING_TOKEN_PERMISSIONS,
  };
};

const manifestId = (path: string): string => {
  if (path === ONBOARDING_PACKAGE_FILE) return "root";
  return path.replace(/\/package\.json$/, "");
};

const explicitManifestPin = (name: string, usages: DependencyUsageEntry[]) => {
  const versions = new Set(usages.map(({ range }) => range));
  const { path, range } = usages[0];
  if (versions.size > 1) {
    throw new Error(
      `Multiple versions of ${name} in ${path}; choose an explicit version before generating this policy.`,
    );
  }
  return { [name]: range };
};

const manifestCodependencies = (
  dependencies: DependencyUsageEntry[],
  manifest: OnboardingProject["manifests"][number],
  answers: OnboardingAnswers,
) => {
  const provider = ONBOARDING_PROVIDERS[manifest.manager];
  const selected = new Set(answers.selectedDependencies);
  const chosen = dependencies.filter(({ name }) => selected.has(name));
  const resolvesLatest = provider?.capabilities.supportsLatestResolution ?? true;
  if (resolvesLatest) {
    const names = chosen.map(({ name }) => name);
    const codependencies = Array.from(new Set(names));
    if (answers.mode === "verbose") return { codependencies };
    return selectedCodependencies(codependencies);
  }
  const pins = answers.mode === "precise" ? dependencies : chosen;
  const groups = dependencyEntryGroups(pins);
  const codependencies = Array.from(groups, ([name, usages]) => explicitManifestPin(name, usages));
  return { codependencies };
};

const manifestConfig = (
  dependencies: DependencyUsageEntry[],
  answers: OnboardingAnswers,
  manifest: OnboardingProject["manifests"][number],
) => {
  const name = manifest.name === manifest.path ? {} : { name: manifest.name };
  const codependencies = manifestCodependencies(dependencies, manifest, answers);
  const provider = ONBOARDING_PROVIDERS[manifest.manager];
  const supportsPrecise = provider?.capabilities.supportsPreciseMode ?? true;
  const mode = supportsPrecise ? answers.mode : "verbose";
  const policy = { path: manifest.path, manager: manifest.manager, mode };
  const hasStandardLockfile = manifest.manager !== "pip" && manifest.manager !== "conda";
  const lockfile = hasStandardLockfile ? {} : { lockfile: false };
  return Object.assign({}, name, policy, codependencies, lockfile);
};

export const renderOnboardingConfig = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): string => {
  const dependencies = project.dependencies.flatMap(onboardingDependencyEntries);
  const groups = groupDependencyEntriesBy(dependencies, ({ path }) => path);
  const entries = project.manifests.map((manifest) => {
    const id = manifestId(manifest.path);
    const usages = groups.get(manifest.path) || [];
    return [id, manifestConfig(usages, answers, manifest)];
  });
  const config = Object.fromEntries(entries);
  return `${JSON.stringify({ config }, null, 2)}\n`;
};

export const onboardingVersionManagers = (project: OnboardingProject): DependencyManager[] => {
  const managers = project.manifests.map(({ manager }) => manager);
  return Array.from(new Set(managers)).filter((manager) => VERSIONED_MANAGERS.has(manager));
};

const onboardingVersions = (project: OnboardingProject): Map<DependencyManager, string> => {
  const versions = new Map<DependencyManager, string>();
  onboardingVersionManagers(project).forEach((manager) => {
    const nodeVersion = manager === project.manager ? project.managerVersion : undefined;
    const version = project.toolVersions?.[manager] || nodeVersion;
    if (!version)
      throw new Error(`${manager} packageManager must include an exact version for GitHub Actions`);
    const isExact = ONBOARDING_VERSION_PATTERN.test(version);
    const isStableRust =
      manager !== "rust" || RUST_TOOLCHAIN_VERSION_PATTERN.test(version.replace(/^v/, ""));
    const isValid = isExact && isStableRust;
    if (!isValid) throw new Error(`${manager} requires an exact package manager version`);
    versions.set(manager, version);
  });
  return versions;
};

const onboardingPostUpdateCommand = (project: OnboardingProject): string => {
  const commands = project.manifests.map(({ path, manager }) => {
    const directory = ONBOARDING_MANAGERS.has(manager as OnboardingManager)
      ? "."
      : onboardingDirectory(path) || ".";
    const command = defaultManagerCommand(manager);
    return commandForRoot(command, directory);
  });
  return Array.from(new Set(commands)).join(" && ");
};

export const renderOnboardingWorkflow = (project: OnboardingProject): string => {
  const managers = Array.from(new Set(project.manifests.map(({ manager }) => manager)));
  const unsupported = managers.filter((manager) => !ACTION_MANAGERS.has(manager));
  if (unsupported.length > 0) {
    throw new Error(
      `GitHub Action setup does not support target manager(s): ${unsupported.join(", ")}`,
    );
  }
  const versions = onboardingVersions(project);
  const postUpdateCommand = onboardingPostUpdateCommand(project);
  return renderWorkflow({
    area: "infrastructure",
    label: "dependency",
    managers,
    versions,
    postUpdateCommand,
    schedule: ONBOARDING_SCHEDULE,
    tokenSecret: ONBOARDING_SECRET_NAME,
  });
};

const policyManifests = (project: OnboardingProject, answers: OnboardingAnswers) => {
  const selected = new Set(answers.selectedDependencies);
  const includesAll = answers.mode === "precise";
  const dependencies = project.dependencies.filter(({ name }) => {
    const includesDependency = includesAll || selected.has(name);
    return includesDependency;
  });
  const usages = dependencies.flatMap(onboardingDependencyEntries);
  const paths = new Set(usages.map(({ path }) => path));
  return project.manifests.filter(({ manager, path }) => {
    const resolvesLatest =
      ONBOARDING_PROVIDERS[manager]?.capabilities.supportsLatestResolution ?? true;
    const hasPolicy = resolvesLatest || paths.has(path);
    return hasPolicy;
  });
};

export const createOnboardingArtifacts = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
  options: OnboardingSetupOptions = {},
): OnboardingArtifact[] => {
  const manifests = policyManifests(project, answers);
  if (manifests.length === 0) throw new Error("No dependencies found for this policy");
  const policyProject = Object.assign({}, project, { manifests });
  const configContent = renderOnboardingConfig(policyProject, answers);
  const config = { path: ONBOARDING_CONFIG_PATH, content: configContent };
  if (!githubOnboardingEnabled(answers)) return [config];
  const includeWorkflow = options.workflow ?? true;
  if (!includeWorkflow) return [config];
  const workflowContent = renderOnboardingWorkflow(policyProject);
  const managers = Array.from(new Set(manifests.map(({ manager }) => manager)));
  const area = managers.length === 1 ? areaForManager(managers[0]) : "dependencies";
  const path = `.github/workflows/codependence-${area}.yml`;
  const workflow = { path, content: workflowContent };
  return [config, workflow];
};

const normalizeSourceFiles = (files: OnboardingSourceFile[]): OnboardingSourceFile[] =>
  files.map((file) => {
    const path = normalizeOnboardingPath(file.path);
    return Object.assign({}, file, { path });
  });

const nonNodeManifest = (
  file: OnboardingSourceFile,
  files: OnboardingSourceFile[],
): OnboardingProject["manifests"][number] | null => {
  const manager = manifestManager(file, files);
  if (!manager) return null;
  return { path: file.path, name: file.path, manager };
};

const nonNodeManifests = (files: OnboardingSourceFile[]): OnboardingProject["manifests"] =>
  files
    .map((file) => nonNodeManifest(file, files))
    .filter((manifest): manifest is OnboardingProject["manifests"][number] => manifest !== null);

const analyzeNodeProject = (files: OnboardingSourceFile[]): OnboardingProject | null => {
  const rootFile = files.find(({ path }) => path === ONBOARDING_PACKAGE_FILE);
  if (!rootFile) return null;

  const selectedFiles = selectOnboardingSourceFiles(files);
  const manifests = selectOnboardingManifests(selectedFiles.map(parseOnboardingManifest), files);
  const root = manifests.find(({ path }) => path === ONBOARDING_PACKAGE_FILE);
  if (!root) throw new Error("package.json not found in the project root");
  const manager = detectOnboardingManager(root.packageJson, files);
  const workspace = isOnboardingWorkspace(root.packageJson, files);
  const projectManifests = manifests.map(({ path, name }) => ({
    path,
    name,
    manager: manager.manager,
  }));
  const dependencies = collectOnboardingDependencies(manifests);
  return Object.assign({}, manager, { workspace, manifests: projectManifests, dependencies });
};

const analyzeOnboardingProjectSync = (files: OnboardingSourceFile[]): OnboardingProject => {
  const normalizedFiles = normalizeSourceFiles(files);
  const nodeProject = analyzeNodeProject(normalizedFiles);
  const nodeManifests = nodeProject?.manifests ?? [];
  const manifests = nodeManifests.concat(nonNodeManifests(normalizedFiles));
  if (manifests.length === 0) throw new Error("No supported package manifests found");

  const workspace = nodeProject?.workspace || false;
  const sourceFiles = new Map(normalizedFiles.map((file) => [file.path, file]));
  const parsed = manifests.flatMap(({ path, manager }) => {
    const provider = ONBOARDING_PROVIDERS[manager];
    const source = sourceFiles.get(path);
    const hasSourceProvider = provider && source;
    if (!hasSourceProvider) return [];
    const packageJson = provider.parseManifest(path, source.content);
    const { dependencyVersions } = packageJson;
    return [{ path, name: path, packageJson, dependencyVersions }];
  });
  const nonNodeDependencies = collectOnboardingDependencies(parsed);
  const allDependencies = (nodeProject?.dependencies || []).concat(nonNodeDependencies);
  const entries = allDependencies.flatMap(onboardingDependencyEntries);
  const groups = dependencyEntryGroups(entries);
  const collected = Array.from(groups, ([name, group]) => createDependency(name, group));
  const dependencies = collected.toSorted((left, right) => left.name.localeCompare(right.name));
  return {
    manager: nodeProject?.manager,
    managerVersion: nodeProject?.managerVersion,
    workspace,
    manifests,
    dependencies,
  };
};

export const analyzeOnboardingProject = (files: OnboardingSourceFile[]): OnboardingProject => {
  try {
    return analyzeOnboardingProjectSync(files);
  } catch (cause) {
    throw onboardingError(cause);
  }
};

export const scanOnboardingRepository = async (
  repository: OnboardingRepository,
  fetcher: OnboardingFetcher = fetch,
): Promise<OnboardingProject> => {
  try {
    const files = await repositorySourceFiles(repository, fetcher);
    return analyzeOnboardingProject(files);
  } catch (cause) {
    throw onboardingError(cause);
  }
};

const assertSelectedDependencies = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): void => {
  const known = new Set(project.dependencies.map(({ name }) => name));
  const unknown = answers.selectedDependencies.filter((name) => !known.has(name));
  if (unknown.length > 0) throw new Error(`Unknown project dependencies: ${unknown.join(", ")}`);
  const requiresDependency = answers.mode === "verbose";
  const hasSelectedDependencies = answers.selectedDependencies.length > 0;
  const isMissingDependency = requiresDependency && !hasSelectedDependencies;
  if (isMissingDependency) {
    throw new Error("Update-only mode requires at least one dependency");
  }
};

const createOnboardingSetupSync = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
  options: OnboardingSetupOptions,
): OnboardingSetup => {
  assertSelectedDependencies(project, answers);
  const artifacts = createOnboardingArtifacts(project, answers, options);
  const commands = onboardingCommands(project);
  const tokenSetup = githubOnboardingEnabled(answers)
    ? createOnboardingTokenSetup(answers, options.tokenSecret)
    : undefined;
  return Object.assign({}, commands, { artifacts, tokenSetup });
};

export const createOnboardingSetup = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
  options: OnboardingSetupOptions = {},
): OnboardingSetup => {
  try {
    return createOnboardingSetupSync(project, answers, options);
  } catch (cause) {
    throw onboardingError(cause);
  }
};

export { OnboardingError } from "./types";

export type {
  OnboardingDependency,
  OnboardingDependencyUsage,
  OnboardingAnswers,
  OnboardingArtifact,
  OnboardingCommand,
  OnboardingEnforcement,
  OnboardingFetcher,
  OnboardingFetchResponse,
  OnboardingManifest,
  OnboardingManager,
  OnboardingMode,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSetup,
  OnboardingSourceFile,
  OnboardingTokenSetup,
} from "./types";
