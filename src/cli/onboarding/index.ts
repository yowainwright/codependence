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
  const args = onboardingInstallArgs(project);
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

export const renderOnboardingConfig = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): string => {
  const files = project.manifests.map(({ path }) => path);
  const codependencies = selectedCodependencies(answers.selectedDependencies);
  const baseTarget = { manager: project.manager, files, mode: answers.mode };
  const target = Object.assign({}, baseTarget, codependencies);
  return `${JSON.stringify({ targets: [target] }, null, 2)}\n`;
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
  return `# Generated by Codependence onboarding.
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
  const workflowContent = renderOnboardingWorkflow(project);
  const workflow = { path: ONBOARDING_WORKFLOW_PATH, content: workflowContent };
  return [config, workflow];
};

const analyzeOnboardingProjectSync = (files: OnboardingSourceFile[]): OnboardingProject => {
  const normalizedFiles = files.map((file) => {
    const path = normalizeOnboardingPath(file.path);
    return Object.assign({}, file, { path });
  });
  const selectedFiles = selectOnboardingSourceFiles(normalizedFiles);
  const manifests = selectOnboardingManifests(
    selectedFiles.map(parseOnboardingManifest),
    normalizedFiles,
  );
  const root = manifests.find(({ path }) => path === ONBOARDING_PACKAGE_FILE);
  if (!root) throw new Error("package.json not found in the project root");
  const manager = detectOnboardingManager(root.packageJson, normalizedFiles);
  const workspace = isOnboardingWorkspace(root.packageJson, normalizedFiles);
  const projectManifests = manifests.map(({ path, name }) => ({ path, name }));
  const dependencies = collectOnboardingDependencies(manifests);
  return Object.assign({}, manager, { workspace, manifests: projectManifests, dependencies });
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
