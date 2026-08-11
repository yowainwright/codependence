import {
  ONBOARDING_GITHUB_API_URL,
  ONBOARDING_GITHUB_RAW_URL,
  ONBOARDING_MANAGER_FILES,
  ONBOARDING_PACKAGE_FILE,
  ONBOARDING_PNPM_WORKSPACE_FILE,
} from "./constants";
import { OnboardingError } from "./types";
import type {
  OnboardingAnswers,
  OnboardingFetcher,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSetup,
  OnboardingSourceFile,
} from "./types";
import {
  collectOnboardingDependencies,
  createOnboardingArtifacts,
  createOnboardingTokenSetup,
  detectOnboardingManager,
  githubOnboardingEnabled,
  isIgnoredOnboardingPath,
  isOnboardingWorkspace,
  isOnboardingPackageFile,
  normalizeOnboardingPath,
  onboardingCommands,
  parseOnboardingManifest,
  selectOnboardingManifests,
  selectOnboardingSourceFiles,
} from "./utils";

export const onboardingError = (cause: unknown): OnboardingError => {
  if (cause instanceof OnboardingError) return cause;
  const message = cause instanceof Error ? cause.message : "Onboarding failed";
  return new OnboardingError({ message, cause });
};

const analyzeOnboardingProjectSync = (files: OnboardingSourceFile[]): OnboardingProject => {
  const normalizedFiles = files.map((file) => ({
    ...file,
    path: normalizeOnboardingPath(file.path),
  }));
  const selectedFiles = selectOnboardingSourceFiles(normalizedFiles);
  const manifests = selectOnboardingManifests(
    selectedFiles.map(parseOnboardingManifest),
    normalizedFiles,
  );
  const root = manifests.find(({ path }) => path === ONBOARDING_PACKAGE_FILE);
  if (!root) throw new Error("package.json not found in the project root");
  return {
    ...detectOnboardingManager(root.packageJson, normalizedFiles),
    workspace: isOnboardingWorkspace(root.packageJson, normalizedFiles),
    manifests: manifests.map(({ path, name }) => ({ path, name })),
    dependencies: collectOnboardingDependencies(manifests),
  };
};

export const analyzeOnboardingProject = (files: OnboardingSourceFile[]): OnboardingProject => {
  try {
    return analyzeOnboardingProjectSync(files);
  } catch (cause) {
    throw onboardingError(cause);
  }
};

interface RepositoryMetadata {
  defaultBranch: string;
}

interface RepositoryTreeEntry {
  path: string;
  type: string;
}

interface RepositoryTree {
  tree: RepositoryTreeEntry[];
  truncated: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const requestJson = (fetcher: OnboardingFetcher, url: string): Promise<unknown> =>
  fetcher(url)
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub request failed with status ${response.status}`);
      return response.json();
    })
    .catch((cause) => {
      throw onboardingError(cause);
    });

const requestText = (fetcher: OnboardingFetcher, url: string): Promise<string> =>
  fetcher(url)
    .then((response) => {
      if (!response.ok)
        throw new Error(`GitHub file request failed with status ${response.status}`);
      return response.text();
    })
    .catch((cause) => {
      throw onboardingError(cause);
    });

const decodeRepository = (value: unknown): RepositoryMetadata => {
  const defaultBranch = isRecord(value) ? value.default_branch : undefined;
  if (typeof defaultBranch !== "string") {
    throw onboardingError(new Error("GitHub repository metadata is invalid"));
  }
  return { defaultBranch };
};

const decodeTreeEntry = (value: unknown): RepositoryTreeEntry => {
  const path = isRecord(value) ? value.path : undefined;
  const type = isRecord(value) ? value.type : undefined;
  if (typeof path !== "string" || typeof type !== "string") {
    throw onboardingError(new Error("GitHub repository tree is invalid"));
  }
  return { path, type };
};

const decodeTree = (value: unknown): RepositoryTree => {
  const entries = isRecord(value) ? value.tree : undefined;
  const truncated = isRecord(value) ? value.truncated : undefined;
  const hasInvalidEntries = !Array.isArray(entries);
  const hasInvalidTruncated = truncated !== undefined && typeof truncated !== "boolean";
  if (hasInvalidEntries || hasInvalidTruncated) {
    throw onboardingError(new Error("GitHub repository tree is invalid"));
  }
  return { tree: entries.map(decodeTreeEntry), truncated: truncated === true };
};

const repositoryApiPath = ({ owner, name }: OnboardingRepository): string =>
  `${ONBOARDING_GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");

const repositoryRawPath = (
  repository: OnboardingRepository,
  revision: string,
  path: string,
): string =>
  `${ONBOARDING_GITHUB_RAW_URL}/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/${encodePath(revision)}/${encodePath(path)}`;

const managerFiles = new Set(Object.values(ONBOARDING_MANAGER_FILES).flat());

const isRepositorySourcePath = (path: string): boolean => {
  if (isIgnoredOnboardingPath(path)) return false;
  if (isOnboardingPackageFile(path)) return true;
  return !path.includes("/") && managerFiles.has(path);
};

const sourceFileNeedsContent = (path: string): boolean =>
  isOnboardingPackageFile(path) || path === ONBOARDING_PNPM_WORKSPACE_FILE;

const mapConcurrent = async <Input, Output>(
  values: Input[],
  limit: number,
  transform: (value: Input) => Promise<Output>,
): Promise<Output[]> => {
  const results = Array.from<Output>({ length: values.length });
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    const index = nextIndex++;
    if (index >= values.length) return;
    results[index] = await transform(values[index]);
    await worker();
  };
  const workers = Array.from({ length: Math.min(limit, values.length) }, worker);
  await Promise.all(workers);
  return results;
};

const repositorySourceFile = (
  fetcher: OnboardingFetcher,
  repository: OnboardingRepository,
  revision: string,
  path: string,
): Promise<OnboardingSourceFile> => {
  if (!sourceFileNeedsContent(path)) return Promise.resolve({ path, content: "" });
  const url = repositoryRawPath(repository, revision, path);
  return requestText(fetcher, url).then((content) => ({ path, content }));
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

const repositorySourceFiles = (
  repository: OnboardingRepository,
  fetcher: OnboardingFetcher,
): Promise<OnboardingSourceFile[]> =>
  repositoryTree(repository, fetcher).then(({ tree, branch }) => {
    if (tree.truncated) {
      throw onboardingError(new Error("GitHub repository tree is too large to scan completely"));
    }
    const paths = tree.tree
      .filter(({ path, type }) => type === "blob" && isRepositorySourcePath(path))
      .map(({ path }) => path);
    return mapConcurrent(paths, 6, (path) =>
      repositorySourceFile(fetcher, repository, branch, path),
    );
  });

const defaultOnboardingFetcher: OnboardingFetcher = (url) => fetch(url);

export const scanOnboardingRepository = (
  repository: OnboardingRepository,
  fetcher: OnboardingFetcher = defaultOnboardingFetcher,
): Promise<OnboardingProject> =>
  repositorySourceFiles(repository, fetcher).then(analyzeOnboardingProject);

const assertSelectedDependencies = (
  project: OnboardingProject,
  answers: OnboardingAnswers,
): void => {
  const known = new Set(project.dependencies.map(({ name }) => name));
  const unknown = answers.selectedDependencies.filter((name) => !known.has(name));
  if (unknown.length > 0) throw new Error(`Unknown project dependencies: ${unknown.join(", ")}`);
  if (answers.mode === "verbose" && answers.selectedDependencies.length === 0) {
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
  return { artifacts, ...commands, tokenSetup };
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

export { parseOnboardingRepository } from "./utils";
