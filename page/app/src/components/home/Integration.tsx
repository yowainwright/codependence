import { useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { CopyButton } from "@/components/common/CopyButton";
import {
  analyzeOnboardingProject,
  createOnboardingSetup,
  isOnboardingSourcePath,
  onboardingSourceFileNeedsContent,
  parseOnboardingRepository,
  scanOnboardingRepository,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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

interface ModeChoiceProps {
  label: string;
  value: string;
}

interface DependencyProps extends OnboardingProps {
  dependency: OnboardingProject["dependencies"][number];
}

type SessionSetter = Dispatch<SetStateAction<OnboardingSession>>;
type ProjectScanner = () => Promise<Partial<OnboardingSession>>;

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

const sourceFile = async (
  handle: FileSystemFileHandle,
  path: string,
): Promise<OnboardingSourceFile> => {
  const file = await handle.getFile();
  const needsContent = onboardingSourceFileNeedsContent(path);
  const content = needsContent ? await file.text() : "";
  return { path, content };
};

const scanDirectory = async (
  directory: FileSystemDirectoryHandle,
  prefix = "",
): Promise<OnboardingSourceFile[]> => {
  let files: OnboardingSourceFile[] = [];
  for await (const [name, handle] of directory.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    const isFile = handle.kind === "file" && isOnboardingSourcePath(path);
    const fileHandle = handle as FileSystemFileHandle;
    if (isFile) files = files.concat(await sourceFile(fileHandle, path));
    const isDirectory = handle.kind === "directory";
    const shouldScan = isDirectory && !IGNORED_DIRECTORIES.has(name);
    const directoryHandle = handle as FileSystemDirectoryHandle;
    if (shouldScan)
      files = files.concat(await scanDirectory(directoryHandle, path));
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
  const project = analyzeOnboardingProject(files);
  return { handle, project };
};

const runProjectScan = async (
  scanner: ProjectScanner,
  setSession: SessionSetter,
): Promise<void> => {
  updateSession(setSession, { busy: true, error: "", message: "" });
  try {
    const projectValues = await scanner();
    updateSession(setSession, {
      ...projectValues,
      selectedDependencies: [],
      setup: undefined,
    });
  } catch (error) {
    updateSession(setSession, { error: errorMessage(error) });
  } finally {
    updateSession(setSession, { busy: false });
  }
};

const localProjectScan = async (): Promise<Partial<OnboardingSession>> => {
  const { handle, project } = await selectProject();
  const managerVersion = project.managerVersion || "";
  return { handle, managerVersion, project };
};

const repositoryProjectScan = async (
  value: string,
): Promise<Partial<OnboardingSession>> => {
  const repository = parseOnboardingRepository(value);
  const project = await scanOnboardingRepository(repository);
  const repositoryName = `${repository.owner}/${repository.name}`;
  const managerVersion = project.managerVersion || "";
  return {
    handle: undefined,
    managerVersion,
    project,
    repository: repositoryName,
  };
};

const scanProject = (setSession: SessionSetter): Promise<void> =>
  runProjectScan(localProjectScan, setSession);

const scanGitHubProject = (
  value: string,
  setSession: SessionSetter,
): Promise<void> =>
  runProjectScan(() => repositoryProjectScan(value), setSession);

const githubEnabled = (enforcement: OnboardingEnforcement): boolean =>
  enforcement === "github" || enforcement === "both";

const setupRepository = (
  session: OnboardingSession,
): OnboardingRepository | undefined => {
  if (!githubEnabled(session.enforcement)) return undefined;
  return parseOnboardingRepository(session.repository);
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

const generateSetup = (
  session: OnboardingSession,
  setSession: SessionSetter,
): void => {
  try {
    const project = setupProject(session);
    const repository = setupRepository(session);

    const answers = {
      mode: session.mode,
      enforcement: session.enforcement,
      repository,
      selectedDependencies: session.selectedDependencies,
    };
    const setup = createOnboardingSetup(project, answers);
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
    const name = segments.at(-1);
    if (!name) throw new Error("Generated artifact path is empty");
    const directory = await artifactDirectory(root, segments.slice(0, -1));
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
  const name = segments.at(-1);
  if (!name) throw new Error("Generated artifact path is empty");
  const directory = await artifactDirectory(root, segments.slice(0, -1));
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
  const handle = session.handle;
  const setup = session.setup;
  if (!handle) return;
  if (!setup) return;
  updateSession(setSession, { busy: true, error: "", message: "" });
  try {
    await assertArtifactsMissing(handle, setup.artifacts);
    for (const artifact of setup.artifacts) {
      await writeArtifact(handle, artifact);
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
        Paste a public GitHub repository URL or select a local Node project.
        Codependence reads its declared workspaces and builds one policy.
      </p>
    </div>
  );
}

function LocalProjectButton({ session, setSession }: OnboardingProps) {
  const handleScan = () => void scanProject(setSession);
  const busy = session.busy;
  const buttonLabel = busy ? "Scanning..." : "Select project folder";
  return (
    <Button
      className="h-12 rounded-lg px-6"
      disabled={busy}
      onClick={handleScan}
    >
      {buttonLabel}
    </Button>
  );
}

function RepositoryScanButton({ session, setSession }: OnboardingProps) {
  const handleScan = () =>
    void scanGitHubProject(session.repository, setSession);
  const busy = session.busy;
  const repositoryButtonLabel = busy ? "Scanning..." : "Scan GitHub repository";
  const repositoryMissing = session.repository.trim().length === 0;
  return (
    <Button
      className="h-12 rounded-lg px-6"
      disabled={busy || repositoryMissing}
      onClick={handleScan}
    >
      {repositoryButtonLabel}
    </Button>
  );
}

function ProjectPicker({ session, setSession }: OnboardingProps) {
  return (
    <div className="mx-auto mt-10 grid max-w-xl gap-4">
      <div className="flex justify-center">
        <LocalProjectButton session={session} setSession={setSession} />
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <Separator className="flex-1" />
        OR
        <Separator className="flex-1" />
      </div>
      <RepositoryInput session={session} setSession={setSession} />
      <RepositoryScanButton session={session} setSession={setSession} />
      <p className="text-sm text-muted-foreground">
        Local files stay in your browser. Repository scans read public files
        directly from GitHub.
      </p>
    </div>
  );
}

function ModeChoice({ label, value }: ModeChoiceProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
      <RadioGroupItem value={value} className="mt-1" />
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
      <RadioGroup
        className="grid gap-3"
        value={session.mode}
        onValueChange={(value) =>
          updateSession(setSession, {
            mode: value as OnboardingMode,
            setup: undefined,
          })
        }
      >
        <ModeChoice value="precise" label={precise} />
        <ModeChoice value="verbose" label={verbose} />
      </RadioGroup>
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
    const without = session.selectedDependencies.filter(
      (dependencyName) => dependencyName !== name,
    );
    const selectedDependencies = checked ? without : [...without, name];
    updateSession(setSession, { selectedDependencies, setup: undefined });
  };
  return (
    <label className="flex cursor-pointer gap-3 border-b border-border py-3 last:border-0">
      <Checkbox
        className="mt-1"
        checked={checked}
        onCheckedChange={handleChange}
        aria-label={name}
      />
      <span>
        <strong>{name}</strong>
        <small className="block text-muted-foreground">{usages}</small>
      </span>
    </label>
  );
}

function DependencyFields({ session, setSession }: OnboardingProps) {
  const dependencies = session.project?.dependencies || [];
  const options = dependencies.map((dependency) => (
    <DependencyOption
      key={dependency.name}
      dependency={dependency}
      session={session}
      setSession={setSession}
    />
  ));
  return (
    <fieldset>
      <legend className="text-lg font-bold">Choose dependencies</legend>
      <p className="mt-1 text-sm text-muted-foreground">
        Each dependency applies across every listed workspace.
      </p>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border px-4">
        {options}
      </div>
    </fieldset>
  );
}

function EnforcementFields({ session, setSession }: OnboardingProps) {
  return (
    <div>
      <label id="enforcement-label" className="mb-2 block text-lg font-bold">
        Where should it run?
      </label>
      <Select
        value={session.enforcement}
        onValueChange={(value) => {
          if (value) {
            updateSession(setSession, {
              enforcement: value as OnboardingEnforcement,
              setup: undefined,
            });
          }
        }}
      >
        <SelectTrigger
          aria-labelledby="enforcement-label"
          className="h-12 w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="both">Locally and in GitHub Actions</SelectItem>
          <SelectItem value="github">GitHub Actions</SelectItem>
          <SelectItem value="local">Local CLI</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function RepositoryInput({ session, setSession }: OnboardingProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextRepository = event.currentTarget.value;
    const hasRemoteProject = Boolean(session.project && !session.handle);
    if (hasRemoteProject) {
      updateSession(setSession, {
        managerVersion: "",
        project: undefined,
        repository: nextRepository,
        selectedDependencies: [],
        setup: undefined,
      });
      return;
    }
    updateSession(setSession, { repository: nextRepository, setup: undefined });
  };
  return (
    <label className="block">
      <span className="mb-2 block font-bold">
        GitHub repository URL or owner/name
      </span>
      <Input
        className="h-12 w-full"
        placeholder="owner/name"
        value={session.repository}
        onChange={handleChange}
      />
    </label>
  );
}

function VersionInput({ session, setSession }: OnboardingProps) {
  const label = `Exact ${session.project?.manager} version`;
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSession(setSession, {
      managerVersion: event.currentTarget.value,
      setup: undefined,
    });
  };
  return (
    <label className="block">
      <span className="mb-2 block font-bold">{label}</span>
      <Input
        className="h-12 w-full"
        placeholder="1.2.3"
        value={session.managerVersion}
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
  const needsVersion = !session.project?.managerVersion;
  if (!needsVersion) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OptionalVersionInput session={session} setSession={setSession} />
    </div>
  );
}

function ProjectSummary({ project }: { project: OnboardingProject }) {
  const packageLabel = `${project.manifests.length} package manifest(s)`;
  const dependencyLabel = `${project.dependencies.length} dependencies`;
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{project.manager}</Badge>
      <Badge variant="outline">{packageLabel}</Badge>
      <Badge variant="outline">{dependencyLabel}</Badge>
    </div>
  );
}

function ArtifactOutput({ artifact }: { artifact: OnboardingArtifact }) {
  const content = artifact.content;
  return (
    <div>
      <div className="flex items-center justify-between">
        <strong>{artifact.path}</strong>
        <CopyButton text={content} />
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg bg-surface-raised p-4 text-xs">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function TokenSetup({ setup }: { setup: OnboardingSetup }) {
  const tokenSetup = setup.tokenSetup;
  if (!tokenSetup) return null;
  const permissions = tokenSetup.permissions.join(" and ");

  return (
    <div className="rounded-lg border border-primary/40 p-4">
      <h4 className="font-bold">Enable GitHub write access</h4>
      <p className="mt-2 text-sm">
        Create a fine-grained PAT with {permissions}.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a
          className="text-primary underline underline-offset-2"
          href={tokenSetup.personalAccessTokenUrl}
          target="_blank"
          rel="noreferrer"
        >
          Create token
        </a>
        <a
          className="text-primary underline underline-offset-2"
          href={tokenSetup.repositorySecretUrl}
          target="_blank"
          rel="noreferrer"
        >
          Save as {tokenSetup.secretName}
        </a>
      </div>
    </div>
  );
}

function SetupCommands({ setup }: { setup: OnboardingSetup }) {
  return (
    <div className="grid gap-2">
      <p>
        <strong>Install:</strong> <code>{setup.installCommand}</code>
      </p>
      <p>
        <strong>Verify:</strong> <code>{setup.verifyCommand}</code>
      </p>
    </div>
  );
}

function SetupOutput({ session, setSession }: OnboardingProps) {
  const setup = session.setup;
  if (!setup) return null;

  const artifacts = setup.artifacts.map((artifact) => (
    <ArtifactOutput key={artifact.path} artifact={artifact} />
  ));
  const handleWrite = () => void writeSetup(session, setSession);
  const writeAction = session.handle ? (
    <Button
      className="h-12 justify-self-start px-6"
      disabled={session.busy}
      onClick={handleWrite}
    >
      Write setup to project
    </Button>
  ) : (
    <p className="text-sm text-muted-foreground">
      Copy these files into the repository to apply the policy.
    </p>
  );
  return (
    <div className="grid gap-5 border-t border-border pt-6">
      {artifacts}
      <SetupCommands setup={setup} />
      <TokenSetup setup={setup} />
      {writeAction}
    </div>
  );
}

function Status({ session }: { session: OnboardingSession }) {
  const error = session.error;
  if (error) {
    return (
      <Alert className="border-error bg-error text-white dark:text-[#881337]">
        <AlertDescription className="text-current">{error}</AlertDescription>
      </Alert>
    );
  }
  const message = session.message;
  if (message) {
    return (
      <Alert className="border-success bg-success text-white dark:text-[#14532d]">
        <AlertDescription className="text-current">{message}</AlertDescription>
      </Alert>
    );
  }
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
    <div className="mx-auto mt-8 grid max-w-4xl gap-7 rounded-2xl bg-muted p-6 shadow-sm md:p-8">
      <ProjectSummary project={project} />
      <PolicyFields session={session} setSession={setSession} />
      <Button
        variant="secondary"
        className="h-12 justify-self-start px-6"
        onClick={handleGenerate}
      >
        Generate setup
      </Button>
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
