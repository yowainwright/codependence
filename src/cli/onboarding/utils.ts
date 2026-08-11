import {
  ONBOARDING_DEPENDENCY_SECTIONS,
  ONBOARDING_GITHUB_API_URL,
  ONBOARDING_GITHUB_RAW_URL,
  ONBOARDING_IGNORED_DIRECTORIES,
  ONBOARDING_INSTALLS,
  ONBOARDING_MANAGER_ORDER,
  ONBOARDING_MANAGER_FILES,
  ONBOARDING_PACKAGE_FILE,
  ONBOARDING_PNPM_WORKSPACE_FILE,
  ONBOARDING_REPOSITORY_CONCURRENCY,
  ONBOARDING_USAGE_SEPARATOR,
  ONBOARDING_WORKSPACE_INSTALLS,
} from "./constants";
import type {
  DependencyUsageEntry,
  OnboardingDependency,
  OnboardingDependencyUsage,
  OnboardingFetcher,
  OnboardingManager,
  OnboardingPackageJson,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSourceFile,
  ParsedOnboardingManifest,
  RepositoryMetadata,
  RepositoryTree,
  RepositoryTreeEntry,
  WorkspaceMatchState,
} from "./types";

export const normalizeOnboardingPath = (path: string): string =>
  path.replaceAll("\\", "/").replace(/^\.\//, "");

const pathSegments = (path: string): string[] => normalizeOnboardingPath(path).split("/");

const isIgnoredOnboardingPath = (path: string): boolean =>
  pathSegments(path).some((segment) => ONBOARDING_IGNORED_DIRECTORIES.has(segment));

const isOnboardingPackageFile = (path: string): boolean => {
  const segments = pathSegments(path);
  return segments.at(-1) === ONBOARDING_PACKAGE_FILE;
};

const onboardingManifestDirectory = (path: string): string => {
  const segments = pathSegments(path);
  return segments.slice(0, -1).join("/");
};

export const parseOnboardingManifest = (file: OnboardingSourceFile): ParsedOnboardingManifest => {
  try {
    const packageJson = JSON.parse(file.content) as ParsedOnboardingManifest["packageJson"];
    const path = normalizeOnboardingPath(file.path);
    const name = packageJson.name || path;
    return { path, name, packageJson };
  } catch {
    throw new Error(`${file.path} is not valid JSON`);
  }
};

const packageWorkspacePatterns = (root: OnboardingPackageJson): string[] => {
  if (Array.isArray(root.workspaces)) return root.workspaces;
  return root.workspaces?.packages || [];
};

const stripYamlComment = (value: string): string => {
  const commentIndex = value.indexOf(" #");
  if (commentIndex === -1) return value.trim();
  return value.slice(0, commentIndex).trim();
};

const parseSingleQuotedPath = (value: string): string | undefined => {
  const match = /^'((?:''|[^'])*)'(?:\s+#.*)?$/.exec(value);
  const path = match?.[1];
  if (path === undefined) return undefined;
  return path.replaceAll("''", "'");
};

const parseDoubleQuotedPath = (value: string): string | undefined => {
  const match = /^("(?:\\.|[^"\\])*")(?:\s+#.*)?$/.exec(value);
  const path = match?.[1];
  if (path === undefined) return undefined;
  return JSON.parse(path) as string;
};

const parseWorkspacePath = (value: string): string => {
  const trimmed = value.trim();
  const singleQuoted = parseSingleQuotedPath(trimmed);
  if (singleQuoted !== undefined) return singleQuoted;
  const doubleQuoted = parseDoubleQuotedPath(trimmed);
  if (doubleQuoted !== undefined) return doubleQuoted;
  const scalar = stripYamlComment(trimmed);
  const isInvalidScalar = !scalar || scalar.includes(":");
  if (isInvalidScalar) throw new Error("Workspace paths must be strings");
  return scalar;
};

const workspaceListLines = (content: string): string[] => {
  const normalized = content.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);
  const packagesIndex = lines.findIndex((line) => line.startsWith("packages:"));
  if (packagesIndex === -1) return [];
  const packagesLine = lines[packagesIndex];
  const hasListDeclaration = /^packages:\s*(?:#.*)?$/.test(packagesLine);
  if (!hasListDeclaration) {
    throw new Error(`${ONBOARDING_PNPM_WORKSPACE_FILE} packages must be a list of paths`);
  }
  const remaining = lines.slice(packagesIndex + 1);
  const boundary = remaining.findIndex((line) => /^\S/.test(line) && !line.startsWith("#"));
  if (boundary === -1) return remaining;
  return remaining.slice(0, boundary);
};

const parseWorkspaceListLine = (line: string): string => {
  const item = /^\s+-\s+(.+)$/.exec(line);
  if (!item) {
    throw new Error(`${ONBOARDING_PNPM_WORKSPACE_FILE} packages must be a list of paths`);
  }
  return parseWorkspacePath(item[1]);
};

const pnpmWorkspacePatterns = (files: OnboardingSourceFile[]): string[] => {
  const workspace = files.find(({ path }) => path === ONBOARDING_PNPM_WORKSPACE_FILE);
  if (!workspace) return [];
  const lines = workspaceListLines(workspace.content);
  const entries = lines.filter((line) => line.trim() && !line.trimStart().startsWith("#"));
  return entries.map(parseWorkspaceListLine);
};

export const onboardingWorkspacePatterns = (
  root: OnboardingPackageJson,
  files: OnboardingSourceFile[] = [],
): string[] => {
  const packagePatterns = packageWorkspacePatterns(root);
  const pnpmPatterns = pnpmWorkspacePatterns(files);
  return Array.from(new Set(packagePatterns.concat(pnpmPatterns)));
};

export const isOnboardingWorkspace = (
  root: OnboardingPackageJson,
  files: OnboardingSourceFile[],
): boolean => {
  const hasPackageWorkspaces = root.workspaces !== undefined;
  const hasPnpmWorkspace = files.some(({ path }) => path === ONBOARDING_PNPM_WORKSPACE_FILE);
  return hasPackageWorkspaces || hasPnpmWorkspace;
};

const escapeRegex = (value: string): string => value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

const workspacePatternRegex = (pattern: string): RegExp => {
  const normalized = normalizeOnboardingPath(pattern);
  const escaped = escapeRegex(normalized);
  const globstar = escaped.replaceAll("**", "\u0000");
  const stars = globstar.replaceAll("*", "[^/]*");
  const source = stars.replaceAll("\u0000", ".*");
  return new RegExp(`^${source}/?$`);
};

const matchesWorkspacePattern = (path: string, pattern: string): boolean => {
  const positivePattern = pattern.replace(/^!/, "");
  const directory = onboardingManifestDirectory(path);
  return workspacePatternRegex(positivePattern).test(directory);
};

const updateMatchState = (
  state: WorkspaceMatchState,
  pattern: string,
  path: string,
): WorkspaceMatchState => {
  if (!matchesWorkspacePattern(path, pattern)) return state;
  const isExcluded = pattern.startsWith("!");
  if (isExcluded) return { excluded: true, included: state.included };
  return { excluded: state.excluded, included: true };
};

export const isDeclaredWorkspace = (path: string, patterns: string[]): boolean => {
  const initial = { excluded: false, included: false };
  const matches = patterns.reduce(
    (state, pattern) => updateMatchState(state, pattern, path),
    initial,
  );
  const isAcceptedWorkspace = matches.included && !matches.excluded;
  return isAcceptedWorkspace;
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
  const selected = manifests.filter((manifest) => {
    if (isRootManifest(manifest)) return true;
    return isDeclaredWorkspace(manifest.path, patterns);
  });
  return selected.toSorted(compareManifestPaths);
};

const isSelectedPackageFile = (path: string, patterns: string[]): boolean => {
  if (path === ONBOARDING_PACKAGE_FILE) return true;
  if (!isOnboardingPackageFile(path)) return false;
  if (isIgnoredOnboardingPath(path)) return false;
  return isDeclaredWorkspace(path, patterns);
};

export const selectOnboardingSourceFiles = (
  files: OnboardingSourceFile[],
): OnboardingSourceFile[] => {
  const rootFile = files.find(({ path }) => path === ONBOARDING_PACKAGE_FILE);
  if (!rootFile) throw new Error("package.json not found in the project root");
  const root = parseOnboardingManifest(rootFile);
  const patterns = onboardingWorkspacePatterns(root.packageJson, files);
  return files.filter(({ path }) => isSelectedPackageFile(path, patterns));
};

const groupDependencyEntriesBy = (
  entries: DependencyUsageEntry[],
  keyOf: (entry: DependencyUsageEntry) => string,
): Map<string, DependencyUsageEntry[]> => {
  const groupedSets = entries.reduce((groups, entry) => {
    const key = keyOf(entry);
    const group = groups.get(key) || new Set<DependencyUsageEntry>();
    group.add(entry);
    groups.set(key, group);
    return groups;
  }, new Map<string, Set<DependencyUsageEntry>>());
  const groups = Array.from(groupedSets, ([key, group]) => {
    const entry: [string, DependencyUsageEntry[]] = [key, Array.from(group)];
    return entry;
  });
  return new Map(groups);
};

const sectionDependencyEntries = (
  manifest: ParsedOnboardingManifest,
  section: OnboardingDependencyUsage["sections"][number],
): DependencyUsageEntry[] => {
  const dependencies = manifest.packageJson[section] || {};
  return Object.entries(dependencies).map(([name, range]) => ({
    name,
    path: manifest.path,
    range,
    sections: [section],
  }));
};

export const manifestDependencyEntries = (
  manifest: ParsedOnboardingManifest,
): DependencyUsageEntry[] =>
  ONBOARDING_DEPENDENCY_SECTIONS.flatMap((section) => sectionDependencyEntries(manifest, section));

const usageKey = ({ path, range }: OnboardingDependencyUsage): string =>
  `${path}${ONBOARDING_USAGE_SEPARATOR}${range}`;

const mergeUsageGroup = (group: DependencyUsageEntry[]): OnboardingDependencyUsage => {
  const first = group[0];
  const sections = group.flatMap(({ sections: entrySections }) => entrySections);
  const uniqueSections = Array.from(new Set(sections));
  return { path: first.path, range: first.range, sections: uniqueSections };
};

const mergeDependencyUsages = (entries: DependencyUsageEntry[]): OnboardingDependencyUsage[] => {
  const usages = groupDependencyEntriesBy(entries, usageKey);
  return Array.from(usages.values(), mergeUsageGroup);
};

export const createDependency = (
  name: string,
  entries: DependencyUsageEntry[],
): OnboardingDependency => ({ name, usages: mergeDependencyUsages(entries) });

export const dependencyEntryGroups = (
  entries: DependencyUsageEntry[],
): Map<string, DependencyUsageEntry[]> => groupDependencyEntriesBy(entries, ({ name }) => name);

export const packageManagerValue = (root: OnboardingPackageJson): [string, string?] => {
  const value = root.packageManager?.split("@");
  if (!value) return [""];
  const [manager, version] = value;
  return [manager || "", version];
};

export const managerFromFiles = (files: OnboardingSourceFile[]): OnboardingManager => {
  const normalizedPaths = files.map(({ path }) => normalizeOnboardingPath(path));
  const paths = new Set(normalizedPaths);
  const hasManagerFile = (candidate: OnboardingManager): boolean =>
    ONBOARDING_MANAGER_FILES[candidate].some((path) => paths.has(path));
  return ONBOARDING_MANAGER_ORDER.find(hasManagerFile) || "npm";
};

export const onboardingInstallArgs = (project: OnboardingProject): string[] => {
  if (!project.workspace) return ONBOARDING_INSTALLS[project.manager];
  const workspaceInstall = ONBOARDING_WORKSPACE_INSTALLS[project.manager];
  return workspaceInstall || ONBOARDING_INSTALLS[project.manager];
};

export const selectedCodependencies = (
  selectedDependencies: string[],
): { codependencies?: string[] } => {
  const dependencies = Array.from(new Set(selectedDependencies)).toSorted();
  if (dependencies.length === 0) return {};
  return { codependencies: dependencies };
};

export const workflowSecretExpression = (secretName: string): string =>
  ["$", `{{ secrets.${secretName} }}`].join("");

export const repositorySecretUrl = (owner: string, name: string): string =>
  `https://github.com/${owner}/${name}/settings/secrets/actions/new`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const requestJson = async (fetcher: OnboardingFetcher, url: string): Promise<unknown> => {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`GitHub request failed with status ${response.status}`);
  return response.json();
};

const requestText = async (fetcher: OnboardingFetcher, url: string): Promise<string> => {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`GitHub file request failed with status ${response.status}`);
  }
  return response.text();
};

const decodeRepository = (value: unknown): RepositoryMetadata => {
  const defaultBranch = isRecord(value) ? value.default_branch : undefined;
  if (typeof defaultBranch !== "string") {
    throw new Error("GitHub repository metadata is invalid");
  }
  return { defaultBranch };
};

const decodeTreeEntry = (value: unknown): RepositoryTreeEntry => {
  const path = isRecord(value) ? value.path : undefined;
  const type = isRecord(value) ? value.type : undefined;
  const hasInvalidEntry = typeof path !== "string" || typeof type !== "string";
  if (hasInvalidEntry) throw new Error("GitHub repository tree is invalid");
  return { path, type };
};

const decodeTree = (value: unknown): RepositoryTree => {
  const entries = isRecord(value) ? value.tree : undefined;
  const truncated = isRecord(value) ? value.truncated : undefined;
  const hasInvalidEntries = !Array.isArray(entries);
  const hasInvalidTruncated = truncated !== undefined && typeof truncated !== "boolean";
  const hasInvalidTree = hasInvalidEntries || hasInvalidTruncated;
  if (hasInvalidTree) throw new Error("GitHub repository tree is invalid");
  return { tree: entries.map(decodeTreeEntry), truncated: Boolean(truncated) };
};

const repositoryApiPath = ({ owner, name }: OnboardingRepository): string => {
  const encodedOwner = encodeURIComponent(owner);
  const encodedName = encodeURIComponent(name);
  return `${ONBOARDING_GITHUB_API_URL}/repos/${encodedOwner}/${encodedName}`;
};

const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");

const repositoryRawPath = (
  repository: OnboardingRepository,
  revision: string,
  path: string,
): string => {
  const owner = encodeURIComponent(repository.owner);
  const name = encodeURIComponent(repository.name);
  return `${ONBOARDING_GITHUB_RAW_URL}/${owner}/${name}/${encodePath(revision)}/${encodePath(path)}`;
};

const managerFiles = new Set(Object.values(ONBOARDING_MANAGER_FILES).flat());

const isRepositorySourcePath = (path: string): boolean => {
  if (isIgnoredOnboardingPath(path)) return false;
  if (isOnboardingPackageFile(path)) return true;
  const isRootFile = !path.includes("/");
  return isRootFile && managerFiles.has(path);
};

const sourceFileNeedsContent = (path: string): boolean => {
  const isPackageFile = isOnboardingPackageFile(path);
  const isWorkspaceFile = path === ONBOARDING_PNPM_WORKSPACE_FILE;
  return isPackageFile || isWorkspaceFile;
};

const mapConcurrentBatch = async <Input, Output>(
  values: Input[],
  limit: number,
  transform: (value: Input) => Promise<Output>,
  offset: number,
  previous: Output[],
): Promise<Output[]> => {
  if (offset >= values.length) return previous;
  const batch = values.slice(offset, offset + limit);
  const current = await Promise.all(batch.map(transform));
  const results = previous.concat(current);
  return mapConcurrentBatch(values, limit, transform, offset + limit, results);
};

const mapConcurrent = <Input, Output>(
  values: Input[],
  limit: number,
  transform: (value: Input) => Promise<Output>,
): Promise<Output[]> => mapConcurrentBatch(values, limit, transform, 0, []);

const repositorySourceFile = async (
  fetcher: OnboardingFetcher,
  repository: OnboardingRepository,
  revision: string,
  path: string,
): Promise<OnboardingSourceFile> => {
  if (!sourceFileNeedsContent(path)) return { path, content: "" };
  const url = repositoryRawPath(repository, revision, path);
  const content = await requestText(fetcher, url);
  return { path, content };
};

const repositoryTree = async (
  repository: OnboardingRepository,
  fetcher: OnboardingFetcher,
): Promise<{ tree: RepositoryTree; branch: string }> => {
  const apiPath = repositoryApiPath(repository);
  const metadata = decodeRepository(await requestJson(fetcher, apiPath));
  const branch = encodeURIComponent(metadata.defaultBranch);
  const treeUrl = `${apiPath}/git/trees/${branch}?recursive=1`;
  const tree = decodeTree(await requestJson(fetcher, treeUrl));
  return { tree, branch: metadata.defaultBranch };
};

export const repositorySourceFiles = async (
  repository: OnboardingRepository,
  fetcher: OnboardingFetcher,
): Promise<OnboardingSourceFile[]> => {
  const { tree, branch } = await repositoryTree(repository, fetcher);
  if (tree.truncated) {
    throw new Error("GitHub repository tree is too large to scan completely");
  }
  const paths = tree.tree
    .filter(({ path, type }) => type === "blob" && isRepositorySourcePath(path))
    .map(({ path }) => path);
  return mapConcurrent(paths, ONBOARDING_REPOSITORY_CONCURRENCY, (path) =>
    repositorySourceFile(fetcher, repository, branch, path),
  );
};
