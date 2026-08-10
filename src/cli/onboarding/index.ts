import { Effect, Schema } from "effect";
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

const onboardingError = (cause: unknown): OnboardingError => {
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

export const analyzeOnboardingProject = (
  files: OnboardingSourceFile[],
): Effect.Effect<OnboardingProject, OnboardingError> =>
  Effect.try({
    try: () => analyzeOnboardingProjectSync(files),
    catch: onboardingError,
  });

const repositorySchema = Schema.Struct({ default_branch: Schema.String });
const treeEntrySchema = Schema.Struct({ path: Schema.String, type: Schema.String });
const treeSchema = Schema.Struct({
  sha: Schema.String,
  tree: Schema.Array(treeEntrySchema),
  truncated: Schema.optional(Schema.Boolean),
});

const requestJson = (
  fetcher: OnboardingFetcher,
  url: string,
): Effect.Effect<unknown, OnboardingError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetcher(url);
      if (!response.ok) throw new Error(`GitHub request failed with status ${response.status}`);
      return response.json();
    },
    catch: onboardingError,
  });

const requestText = (
  fetcher: OnboardingFetcher,
  url: string,
): Effect.Effect<string, OnboardingError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetcher(url);
      if (!response.ok)
        throw new Error(`GitHub file request failed with status ${response.status}`);
      return response.text();
    },
    catch: onboardingError,
  });

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

const repositorySourceFile = (
  fetcher: OnboardingFetcher,
  repository: OnboardingRepository,
  revision: string,
  path: string,
): Effect.Effect<OnboardingSourceFile, OnboardingError> => {
  if (!sourceFileNeedsContent(path)) return Effect.succeed({ path, content: "" });
  const url = repositoryRawPath(repository, revision, path);
  return Effect.map(requestText(fetcher, url), (content) => ({ path, content }));
};

const repositorySourceFiles = (
  repository: OnboardingRepository,
  fetcher: OnboardingFetcher,
): Effect.Effect<OnboardingSourceFile[], OnboardingError> =>
  Effect.gen(function* () {
    const apiPath = repositoryApiPath(repository);
    const rawRepository = yield* requestJson(fetcher, apiPath);
    const metadata = yield* Schema.decodeUnknown(repositorySchema)(rawRepository).pipe(
      Effect.mapError(onboardingError),
    );
    const branch = encodeURIComponent(metadata.default_branch);
    const treeUrl = `${apiPath}/git/trees/${branch}?recursive=1`;
    const rawTree = yield* requestJson(fetcher, treeUrl);
    const tree = yield* Schema.decodeUnknown(treeSchema)(rawTree).pipe(
      Effect.mapError(onboardingError),
    );
    if (tree.truncated) {
      const cause = new Error("GitHub repository tree is too large to scan completely");
      return yield* Effect.fail(onboardingError(cause));
    }
    const paths = tree.tree
      .filter(({ path, type }) => type === "blob" && isRepositorySourcePath(path))
      .map(({ path }) => path);
    return yield* Effect.forEach(
      paths,
      (path) => repositorySourceFile(fetcher, repository, tree.sha, path),
      { concurrency: 6 },
    );
  });

const defaultOnboardingFetcher: OnboardingFetcher = (url) => fetch(url);

export const scanOnboardingRepository = (
  repository: OnboardingRepository,
  fetcher: OnboardingFetcher = defaultOnboardingFetcher,
): Effect.Effect<OnboardingProject, OnboardingError> =>
  Effect.flatMap(repositorySourceFiles(repository, fetcher), analyzeOnboardingProject);

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
): Effect.Effect<OnboardingSetup, OnboardingError> =>
  Effect.try({
    try: () => createOnboardingSetupSync(project, answers),
    catch: onboardingError,
  });

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
