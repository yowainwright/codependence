import { basename, dirname, join } from "node:path/posix";
import {
  ONBOARDING_ACTION_REF,
  ONBOARDING_CHECKOUT_REF,
  ONBOARDING_CONFIG_PATH,
  ONBOARDING_MANAGERS,
  ONBOARDING_PACKAGE_FILE,
  ONBOARDING_PAT_URL,
  ONBOARDING_SCHEDULE,
  ONBOARDING_SECRET_NAME,
  ONBOARDING_TOKEN_PERMISSIONS,
  ONBOARDING_VERIFY_COMMANDS,
  ONBOARDING_VERSION_PATTERN,
  ONBOARDING_WORKFLOW_PATH,
} from "./constants";
import { LANGUAGES, MANIFEST_FILES, PYTHON_PACKAGE_MANAGERS } from "../../providers/constants";
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
  OnboardingSourceFile,
  OnboardingTokenSetup,
  ParsedOnboardingManifest,
} from "./types";
import {
  createDependency,
  dependencyEntryGroups,
  isOnboardingWorkspace,
  managerFromFiles,
  manifestDependencyEntries,
  normalizeOnboardingPath,
  onboardingInstallArgs,
  packageManagerValue,
  parseOnboardingManifest,
  repositorySecretUrl,
  repositorySourceFiles,
  selectedCodependencies,
  selectOnboardingManifests,
  selectOnboardingSourceFiles,
  workflowSecretExpression,
} from "./utils";

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

export const createOnboardingTokenSetup = (answers: OnboardingAnswers): OnboardingTokenSetup => {
  if (!answers.repository) throw new Error("GitHub enforcement requires a repository");
  const { owner, name } = answers.repository;
  return {
    secretName: ONBOARDING_SECRET_NAME,
    personalAccessTokenUrl: ONBOARDING_PAT_URL,
    repositorySecretUrl: repositorySecretUrl(owner, name),
    permissions: ONBOARDING_TOKEN_PERMISSIONS,
  };
};

const manifestId = (path: string): string => {
  if (path === ONBOARDING_PACKAGE_FILE) return "root";
  return path.replace(/\/package\.json$/, "");
};

const manifestCodependencies = (manager: DependencyManager, selectedDependencies: string[]) => {
  const isNodeManifest = ONBOARDING_MANAGERS.has(manager as OnboardingManager);
  if (!isNodeManifest) return {};
  return selectedCodependencies(selectedDependencies);
};

const manifestConfig = (
  answers: OnboardingAnswers,
  manifest: OnboardingProject["manifests"][number],
) => {
  const name = manifest.name === manifest.path ? {} : { name: manifest.name };
  const codependencies = manifestCodependencies(manifest.manager, answers.selectedDependencies);
  const policy = { path: manifest.path, manager: manifest.manager, mode: answers.mode };
  return Object.assign({}, name, policy, codependencies);
};

export const renderOnboardingConfig = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): string => {
  const entries = project.manifests.map((manifest) => {
    const id = manifestId(manifest.path);
    return [id, manifestConfig(answers, manifest)];
  });
  const config = Object.fromEntries(entries);
  return `${JSON.stringify({ config }, null, 2)}\n`;
};

export const renderOnboardingWorkflow = (project: OnboardingProject): string => {
  if (!project.managerVersion) {
    throw new Error("packageManager must include an exact version for GitHub Actions");
  }
  if (!ONBOARDING_VERSION_PATTERN.test(project.managerVersion)) {
    throw new Error(`${project.manager} requires an exact package manager version`);
  }
  const secret = workflowSecretExpression(ONBOARDING_SECRET_NAME);
  const installCommand = `${project.manager} install`;
  return `# Generated by \`codependence init\`.
name: Codependence Node updates

on:
  schedule:
    - cron: "${ONBOARDING_SCHEDULE}"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: ${ONBOARDING_CHECKOUT_REF}
        with:
          persist-credentials: false

      - uses: ${ONBOARDING_ACTION_REF}
        with:
          targets: ${project.manager}
          version: ${project.managerVersion}
          pull-request: true
          token: ${secret}
          post-update-command: '${installCommand}'
`;
};

export const createOnboardingArtifacts = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): OnboardingArtifact[] => {
  const configContent = renderOnboardingConfig(project, answers);
  const config = { path: ONBOARDING_CONFIG_PATH, content: configContent };
  if (!githubOnboardingEnabled(answers)) return [config];
  if (!project.manager) return [config];
  const hasNonNodeManifest = project.manifests.some(
    ({ manager }) => !ONBOARDING_MANAGERS.has(manager as OnboardingManager),
  );
  if (hasNonNodeManifest) return [config];
  const workflowContent = renderOnboardingWorkflow(project);
  const workflow = { path: ONBOARDING_WORKFLOW_PATH, content: workflowContent };
  return [config, workflow];
};

const normalizeSourceFiles = (files: OnboardingSourceFile[]): OnboardingSourceFile[] =>
  files.map((file) => {
    const path = normalizeOnboardingPath(file.path);
    return Object.assign({}, file, { path });
  });

const pythonManager = (
  file: OnboardingSourceFile,
  files: OnboardingSourceFile[],
): DependencyManager | undefined => {
  const filename = basename(file.path);
  if (filename === MANIFEST_FILES.REQUIREMENTS) return PYTHON_PACKAGE_MANAGERS.PIP;
  if (filename === MANIFEST_FILES.PIPFILE) return PYTHON_PACKAGE_MANAGERS.PIPENV;
  if (filename.startsWith("environment.")) return PYTHON_PACKAGE_MANAGERS.CONDA;
  if (filename !== MANIFEST_FILES.PYPROJECT) return undefined;

  const uvLockPath = join(dirname(file.path), MANIFEST_FILES.UV_LOCK);
  if (files.some(({ path }) => path === uvLockPath)) return PYTHON_PACKAGE_MANAGERS.UV;
  if (file.content.includes("[tool.poetry")) return PYTHON_PACKAGE_MANAGERS.POETRY;
  return PYTHON_PACKAGE_MANAGERS.PIP;
};

const isWorkflowManifest = (path: string): boolean => {
  const directory = dirname(path);
  const isWorkflowDirectory =
    directory === ".github/workflows" || directory.endsWith("/.github/workflows");
  const isYaml = path.endsWith(".yml") || path.endsWith(".yaml");
  return isWorkflowDirectory && isYaml;
};

const isGeneratedWorkflow = (file: OnboardingSourceFile): boolean =>
  isWorkflowManifest(file.path) && file.content.startsWith("# Generated by `codependence init");

const manifestManager = (
  file: OnboardingSourceFile,
  files: OnboardingSourceFile[],
): DependencyManager | undefined => {
  if (isGeneratedWorkflow(file)) return undefined;
  const filename = basename(file.path);
  const python = pythonManager(file, files);
  if (python) return python;
  if (filename === MANIFEST_FILES.GO_MOD) return LANGUAGES.GO;
  if (filename === MANIFEST_FILES.CARGO_TOML) return LANGUAGES.RUST;
  if (filename === MANIFEST_FILES.DOCKERFILE) return LANGUAGES.DOCKER;
  if (filename.startsWith("Dockerfile.")) return LANGUAGES.DOCKER;
  if (isWorkflowManifest(file.path)) return LANGUAGES.GITHUB_ACTIONS;
  return undefined;
};

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
  const manifests = [...(nodeProject?.manifests || []), ...nonNodeManifests(normalizedFiles)];
  if (manifests.length === 0) throw new Error("No supported package manifests found");

  const workspace = nodeProject?.workspace || false;
  const dependencies = nodeProject?.dependencies || [];
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
): OnboardingSetup => {
  assertSelectedDependencies(project, answers);
  const artifacts = createOnboardingArtifacts(project, answers);
  const commands = onboardingCommands(project);
  const tokenSetup = githubOnboardingEnabled(answers)
    ? createOnboardingTokenSetup(answers)
    : undefined;
  return Object.assign({}, commands, { artifacts, tokenSetup });
};

export const createOnboardingSetup = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): OnboardingSetup => {
  try {
    return createOnboardingSetupSync(project, answers);
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
