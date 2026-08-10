import {
  ONBOARDING_DEPENDENCY_SECTIONS,
  ONBOARDING_ACTION_REF,
  ONBOARDING_CHECKOUT_REF,
  ONBOARDING_CONFIG_PATH,
  ONBOARDING_IGNORED_DIRECTORIES,
  ONBOARDING_INSTALLS,
  ONBOARDING_MANAGER_FILES,
  ONBOARDING_MANAGERS,
  ONBOARDING_PACKAGE_FILE,
  ONBOARDING_PNPM_WORKSPACE_FILE,
  ONBOARDING_PAT_URL,
  ONBOARDING_SCHEDULE,
  ONBOARDING_SECRET_NAME,
  ONBOARDING_TOKEN_PERMISSIONS,
  ONBOARDING_VERIFY_COMMANDS,
  ONBOARDING_VERSION_PATTERN,
  ONBOARDING_WORKSPACE_INSTALLS,
  ONBOARDING_WORKFLOW_PATH,
} from "./constants";
import { parse as parseYaml } from "yaml";
import type {
  DependencyUsageEntry,
  OnboardingAnswers,
  OnboardingArtifact,
  OnboardingCommand,
  OnboardingDependency,
  OnboardingDependencyUsage,
  OnboardingManager,
  OnboardingPackageJson,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSourceFile,
  OnboardingTokenSetup,
  ParsedOnboardingManifest,
} from "./types";

export const normalizeOnboardingPath = (path: string): string =>
  path.replaceAll("\\", "/").replace(/^\.\//, "");

const pathSegments = (path: string): string[] => normalizeOnboardingPath(path).split("/");

export const isIgnoredOnboardingPath = (path: string): boolean =>
  pathSegments(path).some((segment) => ONBOARDING_IGNORED_DIRECTORIES.has(segment));

export const isOnboardingPackageFile = (path: string): boolean =>
  normalizeOnboardingPath(path).split("/").at(-1) === ONBOARDING_PACKAGE_FILE;

export const parseOnboardingManifest = (file: OnboardingSourceFile): ParsedOnboardingManifest => {
  try {
    const packageJson = JSON.parse(file.content) as OnboardingPackageJson;
    const path = normalizeOnboardingPath(file.path);
    return { path, name: packageJson.name || path, packageJson };
  } catch {
    throw new Error(`${file.path} is not valid JSON`);
  }
};

const packageWorkspacePatterns = (root: OnboardingPackageJson): string[] => {
  if (Array.isArray(root.workspaces)) return root.workspaces;
  return root.workspaces?.packages || [];
};

const pnpmWorkspacePatterns = (files: OnboardingSourceFile[]): string[] => {
  const workspace = files.find(({ path }) => path === ONBOARDING_PNPM_WORKSPACE_FILE);
  if (!workspace) return [];
  const parsed: unknown = parseYaml(workspace.content);
  if (typeof parsed !== "object") return [];
  if (parsed === null) return [];
  if (!("packages" in parsed)) return [];
  const packages = parsed.packages;
  if (!Array.isArray(packages)) {
    throw new Error(`${ONBOARDING_PNPM_WORKSPACE_FILE} packages must be a list of paths`);
  }
  const hasInvalidPackage = packages.some((value) => typeof value !== "string");
  if (hasInvalidPackage) {
    throw new Error(`${ONBOARDING_PNPM_WORKSPACE_FILE} packages must be a list of paths`);
  }
  return packages;
};

export const onboardingWorkspacePatterns = (
  root: OnboardingPackageJson,
  files: OnboardingSourceFile[] = [],
): string[] => [...new Set([...packageWorkspacePatterns(root), ...pnpmWorkspacePatterns(files)])];

export const isOnboardingWorkspace = (
  root: OnboardingPackageJson,
  files: OnboardingSourceFile[],
): boolean =>
  root.workspaces !== undefined ||
  files.some(({ path }) => path === ONBOARDING_PNPM_WORKSPACE_FILE);

const escapeRegex = (value: string): string => value.replace(/[.+^${}()|[\]\\]/g, "\\$&");

const workspacePatternRegex = (pattern: string): RegExp => {
  const escaped = escapeRegex(normalizeOnboardingPath(pattern));
  const globstar = escaped.replaceAll("**", "\u0000");
  const source = globstar.replaceAll("*", "[^/]*").replaceAll("\u0000", ".*");
  return new RegExp(`^${source}/?$`);
};

const manifestDirectory = (path: string): string => {
  const segments = pathSegments(path);
  return segments.slice(0, -1).join("/");
};

const matchesWorkspacePattern = (path: string, pattern: string): boolean =>
  workspacePatternRegex(pattern.replace(/^!/, "")).test(manifestDirectory(path));

export const isDeclaredWorkspace = (path: string, patterns: string[]): boolean => {
  const included = patterns.filter((pattern) => !pattern.startsWith("!"));
  const excluded = patterns.filter((pattern) => pattern.startsWith("!"));
  const matchesIncluded = included.some((pattern) => matchesWorkspacePattern(path, pattern));
  const matchesExcluded = excluded.some((pattern) => matchesWorkspacePattern(path, pattern));
  return matchesIncluded && !matchesExcluded;
};

const isRootManifest = (manifest: ParsedOnboardingManifest): boolean =>
  manifest.path === ONBOARDING_PACKAGE_FILE;

const compareManifestPaths = (
  left: ParsedOnboardingManifest,
  right: ParsedOnboardingManifest,
): number => {
  if (isRootManifest(left)) return -1;
  if (isRootManifest(right)) return 1;
  return left.path.localeCompare(right.path);
};

export const selectOnboardingManifests = (
  manifests: ParsedOnboardingManifest[],
  files: OnboardingSourceFile[] = [],
): ParsedOnboardingManifest[] => {
  const root = manifests.find(isRootManifest);
  if (!root) throw new Error("package.json not found in the project root");
  const patterns = onboardingWorkspacePatterns(root.packageJson, files);
  const selected = manifests.filter(
    (manifest) => isRootManifest(manifest) || isDeclaredWorkspace(manifest.path, patterns),
  );
  return selected.sort(compareManifestPaths);
};

export const selectOnboardingSourceFiles = (
  files: OnboardingSourceFile[],
): OnboardingSourceFile[] => {
  const rootFile = files.find(({ path }) => path === ONBOARDING_PACKAGE_FILE);
  if (!rootFile) throw new Error("package.json not found in the project root");
  const root = parseOnboardingManifest(rootFile);
  const patterns = onboardingWorkspacePatterns(root.packageJson, files);
  return files.filter(({ path }) => {
    if (path === ONBOARDING_PACKAGE_FILE) return true;
    const isPackageFile = isOnboardingPackageFile(path);
    return isPackageFile && !isIgnoredOnboardingPath(path) && isDeclaredWorkspace(path, patterns);
  });
};

const sectionDependencyEntries = (
  manifest: ParsedOnboardingManifest,
  section: OnboardingDependencyUsage["sections"][number],
): DependencyUsageEntry[] =>
  Object.entries(manifest.packageJson[section] || {}).map(([name, range]) => ({
    name,
    path: manifest.path,
    range,
    sections: [section],
  }));

const manifestDependencyEntries = (manifest: ParsedOnboardingManifest): DependencyUsageEntry[] =>
  ONBOARDING_DEPENDENCY_SECTIONS.flatMap((section) => sectionDependencyEntries(manifest, section));

const usageKey = ({ path, range }: OnboardingDependencyUsage): string => `${path}\u0000${range}`;

const mergeDependencyUsages = (entries: DependencyUsageEntry[]): OnboardingDependencyUsage[] => {
  const usages = new Map<string, OnboardingDependencyUsage>();
  entries.forEach(({ name: _name, ...entry }) => {
    const key = usageKey(entry);
    const current = usages.get(key);
    const sections = current ? [...current.sections, ...entry.sections] : entry.sections;
    usages.set(key, { ...entry, sections: [...new Set(sections)] });
  });
  return [...usages.values()];
};

const groupDependencyEntries = (
  entries: DependencyUsageEntry[],
): Map<string, DependencyUsageEntry[]> =>
  entries.reduce((groups, entry) => {
    const group = groups.get(entry.name);
    if (group) {
      group.push(entry);
      return groups;
    }
    groups.set(entry.name, [entry]);
    return groups;
  }, new Map<string, DependencyUsageEntry[]>());

export const collectOnboardingDependencies = (
  manifests: ParsedOnboardingManifest[],
): OnboardingDependency[] => {
  const entries = manifests.flatMap(manifestDependencyEntries);
  const groups = groupDependencyEntries(entries);
  const dependencies = [...groups.entries()].map(([name, group]) => ({
    name,
    usages: mergeDependencyUsages(group),
  }));
  return dependencies.sort((left, right) => left.name.localeCompare(right.name));
};

const packageManagerValue = (root: OnboardingPackageJson): [string, string?] => {
  const [manager, version] = root.packageManager?.split("@") || [];
  return [manager || "", version];
};

const managerFromFiles = (files: OnboardingSourceFile[]): OnboardingManager => {
  const paths = new Set(files.map(({ path }) => normalizeOnboardingPath(path)));
  const hasManagerFile = (candidate: OnboardingManager): boolean =>
    ONBOARDING_MANAGER_FILES[candidate].some((path) => paths.has(path));
  const managers: OnboardingManager[] = ["bun", "pnpm", "yarn", "npm"];
  const manager = managers.find(hasManagerFile);
  return manager || "npm";
};

export const detectOnboardingManager = (
  root: OnboardingPackageJson,
  files: OnboardingSourceFile[],
): { manager: OnboardingManager; managerVersion?: string } => {
  const [candidate, managerVersion] = packageManagerValue(root);
  const manager = ONBOARDING_MANAGERS.has(candidate as OnboardingManager)
    ? (candidate as OnboardingManager)
    : managerFromFiles(files);
  return managerVersion ? { manager, managerVersion } : { manager };
};

const selectedCodependencies = (answers: OnboardingAnswers): { codependencies?: string[] } => {
  const dependencies = [...new Set(answers.selectedDependencies)].sort();
  return dependencies.length > 0 ? { codependencies: dependencies } : {};
};

export const renderOnboardingConfig = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): string => {
  const files = project.manifests.map(({ path }) => path);
  const codependencies = selectedCodependencies(answers);
  const target = { manager: project.manager, files, mode: answers.mode, ...codependencies };
  return `${JSON.stringify({ targets: [target] }, null, 2)}\n`;
};

const workflowSecretExpression = (): string =>
  ["$", `{{ secrets.${ONBOARDING_SECRET_NAME} }}`].join("");

export const renderOnboardingWorkflow = (project: OnboardingProject): string => {
  if (!project.managerVersion) {
    throw new Error("packageManager must include an exact version for GitHub Actions");
  }
  if (!ONBOARDING_VERSION_PATTERN.test(project.managerVersion)) {
    throw new Error(`${project.manager} requires an exact package manager version`);
  }
  const secret = workflowSecretExpression();
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

export const githubOnboardingEnabled = (answers: OnboardingAnswers): boolean =>
  answers.enforcement === "github" || answers.enforcement === "both";

export const parseOnboardingRepository = (value: string): OnboardingRepository => {
  const withoutProtocol = value.trim().replace(/^https?:\/\/github\.com\//, "");
  const normalized = withoutProtocol
    .replace(/^git@github\.com:/, "")
    .replace(/\.git\/?$/, "")
    .replace(/\/$/, "");
  const [owner, name, extra] = normalized.split("/");
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner || "");
  const validName = /^[A-Za-z0-9._-]+$/.test(name || "");
  if (!validOwner || !validName || extra) {
    throw new Error("Enter a GitHub repository as owner/name");
  }
  return { owner, name };
};

const repositorySecretUrl = (owner: string, name: string): string =>
  `https://github.com/${owner}/${name}/settings/secrets/actions/new`;

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

export const createOnboardingArtifacts = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): OnboardingArtifact[] => {
  const config = {
    path: ONBOARDING_CONFIG_PATH,
    content: renderOnboardingConfig(project, answers),
  };
  if (!githubOnboardingEnabled(answers)) return [config];
  const workflow = { path: ONBOARDING_WORKFLOW_PATH, content: renderOnboardingWorkflow(project) };
  return [config, workflow];
};

const onboardingInstallArgs = (project: OnboardingProject): string[] => {
  if (!project.workspace) return ONBOARDING_INSTALLS[project.manager];
  return ONBOARDING_WORKSPACE_INSTALLS[project.manager] || ONBOARDING_INSTALLS[project.manager];
};

export const onboardingCommands = (
  project: OnboardingProject,
): { installCommand: string; install: OnboardingCommand; verifyCommand: string } => {
  const manager = project.manager;
  const args = onboardingInstallArgs(project);
  const install = { command: manager, args };
  const installCommand = [manager, ...args].join(" ");
  const verifyCommand = ONBOARDING_VERIFY_COMMANDS[manager];
  return { installCommand, install, verifyCommand };
};
