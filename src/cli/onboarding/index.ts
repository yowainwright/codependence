import { Effect } from "effect";
import { OnboardingError } from "./types";
import type {
  OnboardingAnswers,
  OnboardingProject,
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
  const packageFiles = normalizedFiles.filter(
    ({ path }) => isOnboardingPackageFile(path) && !isIgnoredOnboardingPath(path),
  );
  const selectedFiles = selectOnboardingSourceFiles(packageFiles);
  const manifests = selectOnboardingManifests(selectedFiles.map(parseOnboardingManifest));
  const root = manifests.find(({ path }) => path === "package.json");
  if (!root) throw new Error("package.json not found in the project root");
  return {
    ...detectOnboardingManager(root.packageJson, normalizedFiles),
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
  const commands = onboardingCommands(project.manager);
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
  OnboardingManifest,
  OnboardingManager,
  OnboardingMode,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSetup,
  OnboardingSourceFile,
  OnboardingTokenSetup,
} from "./types";
