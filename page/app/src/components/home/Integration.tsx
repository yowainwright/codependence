import { useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { Effect } from "effect";
import { CopyButton } from "@/components/common/CopyButton";
import {
  analyzeOnboardingProject,
  createOnboardingSetup,
} from "@codependence/onboarding";
import type {
  OnboardingArtifact,
  OnboardingEnforcement,
  OnboardingMode,
  OnboardingProject,
  OnboardingRepository,
  OnboardingSetup,
  OnboardingSourceFile,
} from "@codependence/onboarding";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}

interface OnboardingSession {
  busy: boolean;
  enforcement: OnboardingEnforcement;
  error: string;
  handle?: FileSystemDirectoryHandle;
  managerVersion: string;
  message: string;
  mode: OnboardingMode;
  project?: OnboardingProject;
  repository: string;
  selectedDependencies: string[];
  setup?: OnboardingSetup;
}

interface OnboardingProps {
  session: OnboardingSession;
  setSession: SessionSetter;
}

interface ChoiceProps extends OnboardingProps {
  label: string;
  value: string;
}

interface DependencyProps extends OnboardingProps {
  dependency: OnboardingProject["dependencies"][number];
}

type SessionSetter = Dispatch<SetStateAction<OnboardingSession>>;

const INITIAL_SESSION: OnboardingSession = {
  busy: false,
  enforcement: "both",
  error: "",
  managerVersion: "",
  message: "",
  mode: "precise",
  repository: "",
  selectedDependencies: [],
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Onboarding failed";

const updateSession = (
  setSession: SessionSetter,
  values: Partial<OnboardingSession>,
): void => {
  setSession((current) => ({ ...current, ...values }));
};

const shouldReadFile = (name: string, prefix: string): boolean =>
  name === "package.json" || prefix.length === 0;

const sourceFile = async (
  handle: FileSystemFileHandle,
  path: string,
): Promise<OnboardingSourceFile> => {
  const file = await handle.getFile();
  const content = path.endsWith("package.json") ? await file.text() : "";
  return { path, content };
};

const scanDirectory = async (
  directory: FileSystemDirectoryHandle,
  prefix = "",
): Promise<OnboardingSourceFile[]> => {
  const files: OnboardingSourceFile[] = [];
  for await (const [name, handle] of directory.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    const isFile = handle.kind === "file" && shouldReadFile(name, prefix);
    const fileHandle = handle as FileSystemFileHandle;
    if (isFile) files.push(await sourceFile(fileHandle, path));
    const isDirectory = handle.kind === "directory";
    const shouldScan = isDirectory && !IGNORED_DIRECTORIES.has(name);
    const directoryHandle = handle as FileSystemDirectoryHandle;
    if (shouldScan) files.push(...(await scanDirectory(directoryHandle, path)));
  }
  return files;
};

const selectProject = async (): Promise<{
  handle: FileSystemDirectoryHandle;
  project: OnboardingProject;
}> => {
  const pickerWindow = window as DirectoryPickerWindow;
  if (!pickerWindow.showDirectoryPicker)
    throw new Error("Directory selection is not supported by this browser");
  const handle = await pickerWindow.showDirectoryPicker();
  const files = await scanDirectory(handle);
  const project = await Effect.runPromise(analyzeOnboardingProject(files));
  return { handle, project };
};

const scanProject = async (setSession: SessionSetter): Promise<void> => {
  updateSession(setSession, { busy: true, error: "", message: "" });
  try {
    const { handle, project } = await selectProject();
    const managerVersion = project.managerVersion || "";
    updateSession(setSession, {
      handle,
      project,
      managerVersion,
      setup: undefined,
    });
  } catch (error) {
    updateSession(setSession, { error: errorMessage(error) });
  } finally {
    updateSession(setSession, { busy: false });
  }
};

const parseRepository = (value: string): OnboardingRepository => {
  const withoutProtocol = value.trim().replace(/^https?:\/\/github\.com\//, "");
  const normalized = withoutProtocol
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "");
  const [owner, name, extra] = normalized.split("/");
  if (!owner || !name || extra)
    throw new Error("Enter a GitHub repository as owner/name");
  return { owner, name };
};

const githubEnabled = (enforcement: OnboardingEnforcement): boolean =>
  enforcement === "github" || enforcement === "both";

const setupRepository = (
  session: OnboardingSession,
): OnboardingRepository | undefined => {
  if (!githubEnabled(session.enforcement)) return undefined;
  return parseRepository(session.repository);
};

const setupProject = (session: OnboardingSession): OnboardingProject => {
  if (!session.project) throw new Error("Select a project first");
  if (session.project.managerVersion) return session.project;
  if (!githubEnabled(session.enforcement)) return session.project;
  if (!session.managerVersion.trim()) {
    throw new Error("Enter an exact package manager version");
  }
  return { ...session.project, managerVersion: session.managerVersion.trim() };
};

const generateSetup = async (
  session: OnboardingSession,
  setSession: SessionSetter,
): Promise<void> => {
  try {
    const project = setupProject(session);
    const repository = setupRepository(session);
    const selectedDependencies = session.selectedDependencies;
    const answers = {
      mode: session.mode,
      enforcement: session.enforcement,
      repository,
      selectedDependencies,
    };
    const setup = await Effect.runPromise(
      createOnboardingSetup(project, answers),
    );
    updateSession(setSession, {
      setup,
      error: "",
      message: "Setup is ready to write.",
    });
  } catch (error) {
    updateSession(setSession, { error: errorMessage(error), setup: undefined });
  }
};

const artifactExists = async (
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> => {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
};

const artifactDirectory = async (
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> => {
  let directory = root;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create: true });
  }
  return directory;
};

const assertArtifactsMissing = async (
  root: FileSystemDirectoryHandle,
  artifacts: OnboardingArtifact[],
): Promise<void> => {
  for (const artifact of artifacts) {
    const segments = artifact.path.split("/");
    const name = segments.pop();
    if (!name) throw new Error("Generated artifact path is empty");
    const directory = await artifactDirectory(root, segments);
    if (await artifactExists(directory, name)) {
      throw new Error(`${artifact.path} already exists`);
    }
  }
};

const writeArtifact = async (
  root: FileSystemDirectoryHandle,
  artifact: OnboardingArtifact,
): Promise<void> => {
  const segments = artifact.path.split("/");
  const name = segments.pop();
  if (!name) throw new Error("Generated artifact path is empty");
  const directory = await artifactDirectory(root, segments);
  if (await artifactExists(directory, name)) {
    throw new Error(`${artifact.path} already exists`);
  }
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(artifact.content);
  await writable.close();
};

const writeSetup = async (
  session: OnboardingSession,
  setSession: SessionSetter,
): Promise<void> => {
  if (!session.handle || !session.setup) return;
  updateSession(setSession, { busy: true, error: "", message: "" });
  try {
    await assertArtifactsMissing(session.handle, session.setup.artifacts);
    for (const artifact of session.setup.artifacts) {
      await writeArtifact(session.handle, artifact);
    }
    const message = "Onboarding files were written to the project.";
    updateSession(setSession, { message });
  } catch (error) {
    updateSession(setSession, { error: errorMessage(error) });
  } finally {
    updateSession(setSession, { busy: false });
  }
};

function OnboardingHeader() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="font-mono text-sm text-primary">PROJECT ONBOARDING</p>
      <h2 className="mt-3 text-4xl font-black lg:text-5xl">
        Set your dependency policy
      </h2>
      <p className="mt-5 text-lg">
        Select a Node project. Codependence reads its declared workspaces and
        builds one policy.
      </p>
    </div>
  );
}

function ProjectPicker({ session, setSession }: OnboardingProps) {
  const handleScan = () => void scanProject(setSession);
  const busy = session.busy;
  const buttonLabel = busy ? "Scanning..." : "Select project folder";
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <button
        className="btn btn-primary rounded-lg"
        disabled={busy}
        onClick={handleScan}
      >
        {buttonLabel}
      </button>
      <p className="text-sm text-base-content/70">
        Files stay in your browser and are never uploaded.
      </p>
    </div>
  );
}

function ModeChoice({ label, value, session, setSession }: ChoiceProps) {
  const mode = value as OnboardingMode;
  const checked = session.mode === mode;
  const handleChange = () => {
    updateSession(setSession, { mode, setup: undefined });
  };
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-4">
      <input
        className="radio radio-primary mt-1"
        type="radio"
        checked={checked}
        onChange={handleChange}
      />
      <span>{label}</span>
    </label>
  );
}

function ModeFields({ session, setSession }: OnboardingProps) {
  const precise = "Everything except selected pinned dependencies";
  const verbose = "Only selected dependencies";
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-lg font-bold">
        What should Codependence update?
      </legend>
      <ModeChoice
        session={session}
        setSession={setSession}
        value="precise"
        label={precise}
      />
      <ModeChoice
        session={session}
        setSession={setSession}
        value="verbose"
        label={verbose}
      />
    </fieldset>
  );
}

const dependencyUsages = (
  dependency: OnboardingProject["dependencies"][number],
): string =>
  dependency.usages.map(({ path, range }) => `${path}: ${range}`).join("; ");

function DependencyOption({
  dependency,
  session,
  setSession,
}: DependencyProps) {
  const name = dependency.name;
  const checked = session.selectedDependencies.includes(name);
  const usages = dependencyUsages(dependency);
  const handleChange = () => {
    const selected = session.selectedDependencies;
    const without = selected.filter(
      (dependencyName) => dependencyName !== name,
    );
    const selectedDependencies = checked ? without : [...without, name];
    updateSession(setSession, { selectedDependencies, setup: undefined });
  };
  return (
    <label className="flex cursor-pointer gap-3 border-b border-base-300 py-3 last:border-0">
      <input
        className="checkbox checkbox-primary mt-1"
        type="checkbox"
        checked={checked}
        onChange={handleChange}
      />
      <span>
        <strong>{name}</strong>
        <small className="block text-base-content/70">{usages}</small>
      </span>
    </label>
  );
}

function DependencyFields({ session, setSession }: OnboardingProps) {
  const dependencies = session.project?.dependencies || [];
  const options = dependencies.map((dependency) => {
    const name = dependency.name;
    return (
      <DependencyOption
        key={name}
        dependency={dependency}
        session={session}
        setSession={setSession}
      />
    );
  });
  return (
    <fieldset>
      <legend className="text-lg font-bold">Choose dependencies</legend>
      <p className="mt-1 text-sm text-base-content/70">
        Each dependency applies across every listed workspace.
      </p>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-base-300 px-4">
        {options}
      </div>
    </fieldset>
  );
}

function EnforcementFields({ session, setSession }: OnboardingProps) {
  const enforcement = session.enforcement;
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value as OnboardingEnforcement;
    updateSession(setSession, { enforcement: value, setup: undefined });
  };
  return (
    <label className="form-control">
      <span className="label-text mb-2 text-lg font-bold">
        Where should it run?
      </span>
      <select
        className="select select-bordered w-full"
        value={enforcement}
        onChange={handleChange}
      >
        <option value="both">Locally and in GitHub Actions</option>
        <option value="github">GitHub Actions</option>
        <option value="local">Local CLI</option>
      </select>
    </label>
  );
}

function RepositoryInput({ session, setSession }: OnboardingProps) {
  const repository = session.repository;
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextRepository = event.currentTarget.value;
    updateSession(setSession, { repository: nextRepository, setup: undefined });
  };
  return (
    <label className="form-control">
      <span className="label-text mb-2 font-bold">GitHub repository</span>
      <input
        className="input input-bordered w-full"
        placeholder="owner/name"
        value={repository}
        onChange={handleChange}
      />
    </label>
  );
}

function VersionInput({ session, setSession }: OnboardingProps) {
  const managerVersion = session.managerVersion;
  const manager = session.project?.manager;
  const label = `Exact ${manager} version`;
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const version = event.currentTarget.value;
    updateSession(setSession, { managerVersion: version, setup: undefined });
  };
  return (
    <label className="form-control">
      <span className="label-text mb-2 font-bold">{label}</span>
      <input
        className="input input-bordered w-full"
        placeholder="1.2.3"
        value={managerVersion}
        onChange={handleChange}
      />
    </label>
  );
}

function OptionalVersionInput({ session, setSession }: OnboardingProps) {
  if (session.project?.managerVersion) return null;
  return <VersionInput session={session} setSession={setSession} />;
}

function GitHubFields({ session, setSession }: OnboardingProps) {
  if (!githubEnabled(session.enforcement)) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RepositoryInput session={session} setSession={setSession} />
      <OptionalVersionInput session={session} setSession={setSession} />
    </div>
  );
}

function ProjectSummary({ project }: { project: OnboardingProject }) {
  const manager = project.manager;
  const packageLabel = `${project.manifests.length} package manifest(s)`;
  const dependencyLabel = `${project.dependencies.length} dependencies`;
  return (
    <div className="flex flex-wrap gap-2">
      <span className="badge badge-outline">{manager}</span>
      <span className="badge badge-outline">{packageLabel}</span>
      <span className="badge badge-outline">{dependencyLabel}</span>
    </div>
  );
}

function ArtifactOutput({ artifact }: { artifact: OnboardingArtifact }) {
  const path = artifact.path;
  const content = artifact.content;
  return (
    <div>
      <div className="flex items-center justify-between">
        <strong>{path}</strong>
        <CopyButton text={content} />
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg bg-base-300 p-4 text-xs">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function TokenSetup({ setup }: { setup: OnboardingSetup }) {
  const tokenSetup = setup.tokenSetup;
  if (!tokenSetup) return null;
  const permissions = tokenSetup.permissions.join(" and ");
  const tokenUrl = tokenSetup.personalAccessTokenUrl;
  const secretUrl = tokenSetup.repositorySecretUrl;
  const secretName = tokenSetup.secretName;
  return (
    <div className="rounded-lg border border-primary/40 p-4">
      <h4 className="font-bold">Enable GitHub write access</h4>
      <p className="mt-2 text-sm">
        Create a fine-grained PAT with {permissions}.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a
          className="link link-primary"
          href={tokenUrl}
          target="_blank"
          rel="noreferrer"
        >
          Create token
        </a>
        <a
          className="link link-primary"
          href={secretUrl}
          target="_blank"
          rel="noreferrer"
        >
          Save as {secretName}
        </a>
      </div>
    </div>
  );
}

function SetupCommands({ setup }: { setup: OnboardingSetup }) {
  const installCommand = setup.installCommand;
  const verifyCommand = setup.verifyCommand;
  return (
    <div className="grid gap-2">
      <p>
        <strong>Install:</strong> <code>{installCommand}</code>
      </p>
      <p>
        <strong>Verify:</strong> <code>{verifyCommand}</code>
      </p>
    </div>
  );
}

function SetupOutput({ session, setSession }: OnboardingProps) {
  const setup = session.setup;
  if (!setup) return null;
  const busy = session.busy;
  const artifacts = setup.artifacts.map((artifact) => {
    const path = artifact.path;
    return <ArtifactOutput key={path} artifact={artifact} />;
  });
  const handleWrite = () => void writeSetup(session, setSession);
  return (
    <div className="grid gap-5 border-t border-base-300 pt-6">
      {artifacts}
      <SetupCommands setup={setup} />
      <TokenSetup setup={setup} />
      <button
        className="btn btn-primary justify-self-start"
        disabled={busy}
        onClick={handleWrite}
      >
        Write setup to project
      </button>
    </div>
  );
}

function Status({ session }: { session: OnboardingSession }) {
  const error = session.error;
  if (error) return <p className="alert alert-error">{error}</p>;
  const message = session.message;
  if (message) return <p className="alert alert-success">{message}</p>;
  return null;
}

function PolicyFields({ session, setSession }: OnboardingProps) {
  return (
    <>
      <ModeFields session={session} setSession={setSession} />
      <DependencyFields session={session} setSession={setSession} />
      <EnforcementFields session={session} setSession={setSession} />
      <GitHubFields session={session} setSession={setSession} />
    </>
  );
}

function OnboardingForm({ session, setSession }: OnboardingProps) {
  const project = session.project;
  if (!project) return null;
  const handleGenerate = () => void generateSetup(session, setSession);
  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-7 rounded-2xl bg-base-200 p-6 shadow-sm md:p-8">
      <ProjectSummary project={project} />
      <PolicyFields session={session} setSession={setSession} />
      <button
        className="btn btn-secondary justify-self-start"
        onClick={handleGenerate}
      >
        Generate setup
      </button>
      <SetupOutput session={session} setSession={setSession} />
    </div>
  );
}

export function Integration() {
  const [session, setSession] = useState(INITIAL_SESSION);
  return (
    <section id="onboarding" className="py-20 lg:py-28">
      <OnboardingHeader />
      <ProjectPicker session={session} setSession={setSession} />
      <div className="mx-auto mt-4 max-w-4xl">
        <Status session={session} />
      </div>
      <OnboardingForm session={session} setSession={setSession} />
    </section>
  );
}
