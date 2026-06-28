export type LanguageId =
  | "nodejs"
  | "python"
  | "go"
  | "rust"
  | "docker"
  | "github-actions";

export type PolicyMode = "pin-listed" | "pin-exceptions";
export type OutputTab = "config" | "cli" | "action";
export type ScanStatus = "idle" | "scanning" | "success" | "error";

export type LanguageOption = {
  id: LanguageId;
  label: string;
  manifest: string;
};

export type GitHubRepo = {
  owner: string;
  repo: string;
};

export type ScanResult = {
  dependencies: string[];
  language: LanguageId;
  manifests: string[];
};

type GitHubContentFile = {
  content?: string;
  path?: string;
  type?: string;
};

export const defaultDependencyInput = "react\nlodash";

export const languageOptions: LanguageOption[] = [
  { id: "nodejs", label: "Node.js", manifest: "package.json" },
  { id: "python", label: "Python/uv", manifest: "pyproject.toml" },
  { id: "go", label: "Go", manifest: "go.mod" },
  { id: "rust", label: "Rust", manifest: "Cargo.toml" },
  { id: "docker", label: "Docker", manifest: "Dockerfile" },
  {
    id: "github-actions",
    label: "Actions",
    manifest: ".github/workflows",
  },
];

export const outputTabs: Array<{ id: OutputTab; label: string }> = [
  { id: "config", label: ".codependencerc" },
  { id: "cli", label: "CLI" },
  { id: "action", label: "Action" },
];

const unique = (values: string[]): string[] => {
  const presentValues = values.filter(Boolean);
  return Array.from(new Set(presentValues));
};

export const parseDependencies = (value: string): string[] => {
  const items = value.split(/[\s,]+/);
  return unique(items.map((item) => item.trim()));
};

const githubPathFromUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.hostname !== "github.com") return null;
    return url.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
};

export const parseGitHubRepoUrl = (value: string): GitHubRepo | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  let path = normalized;
  if (normalized.includes("github.com"))
    path = githubPathFromUrl(normalized) || "";
  if (!path) return null;

  const [owner, repoName] = path.split("/");
  if (!owner || !repoName) return null;
  return { owner, repo: repoName.replace(/\.git$/, "") };
};

const githubContentsUrl = (repo: GitHubRepo, path: string): string => {
  const root = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;
  return `${root}/contents/${path}`;
};

const decodeGitHubContent = (content: string): string => {
  const normalized = content.replace(/\s/g, "");
  return globalThis.atob(normalized);
};

const fetchGitHubContent = async (
  repo: GitHubRepo,
  path: string,
): Promise<GitHubContentFile | GitHubContentFile[] | null> => {
  const response = await fetch(githubContentsUrl(repo, path));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("GitHub scan failed");
  return response.json();
};

const fetchGitHubText = async (
  repo: GitHubRepo,
  path: string,
): Promise<string | null> => {
  const json = await fetchGitHubContent(repo, path);
  if (!json || Array.isArray(json) || !json.content) return null;
  return decodeGitHubContent(json.content);
};

const recordKeys = (value: unknown): string[] => {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value);
};

const parsePackageJsonDeps = (content: string): string[] => {
  try {
    const json = JSON.parse(content) as Record<string, unknown>;
    const deps = recordKeys(json.dependencies);
    const devDeps = recordKeys(json.devDependencies);
    const peerDeps = recordKeys(json.peerDependencies);
    const optionalDeps = recordKeys(json.optionalDependencies);
    return unique([...deps, ...devDeps, ...peerDeps, ...optionalDeps]);
  } catch {
    return [];
  }
};

const dependencyNameFromRequirement = (spec: string): string | null => {
  const match = spec.match(/^([a-zA-Z0-9_.-]+)/);
  if (!match) return null;
  return match[1];
};

const parsePyprojectDeps = (content: string): string[] => {
  const matches = Array.from(content.matchAll(/"([^"]+)"/g));
  const names = matches.map((match) => dependencyNameFromRequirement(match[1]));
  return unique(names.filter((item): item is string => Boolean(item)));
};

const parseGoDeps = (content: string): string[] => {
  const matches = Array.from(content.matchAll(/^\s*([^\s]+)\s+v\d/gm));
  return unique(matches.map((match) => match[1]));
};

const isCargoDependencySection = (section: string): boolean => {
  const rootSections = [
    "dependencies",
    "dev-dependencies",
    "build-dependencies",
  ];
  if (rootSections.includes(section)) return true;
  return section.endsWith(".dependencies");
};

const readCargoLine = (
  state: { active: boolean; deps: string[] },
  line: string,
): { active: boolean; deps: string[] } => {
  const section = line.match(/^\s*\[([^\]]+)\]/)?.[1] || "";
  if (section) return { ...state, active: isCargoDependencySection(section) };
  if (!state.active) return state;

  const name = line.match(/^\s*("?)([A-Za-z0-9_-]+)\1\s*=/)?.[2];
  if (!name) return state;
  return { ...state, deps: state.deps.concat(name) };
};

const parseCargoDeps = (content: string): string[] => {
  const initial = { active: false, deps: [] as string[] };
  const state = content.split("\n").reduce(readCargoLine, initial);
  return unique(state.deps);
};

const dockerImageName = (image: string): string | null => {
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  if (lastColon <= lastSlash) return null;
  return image.slice(0, lastColon);
};

const parseDockerDeps = (content: string): string[] => {
  const pattern = /^\s*FROM\s+(?:--platform=\S+\s+)?([^\s@]+)/gim;
  const matches = Array.from(content.matchAll(pattern));
  const names = matches.map((match) => dockerImageName(match[1]));
  return unique(names.filter((item): item is string => Boolean(item)));
};

const parseActionDeps = (content: string): string[] => {
  const pattern = /^\s*-?\s*uses:\s*['"]?([^'"\s@]+)@/gim;
  const matches = Array.from(content.matchAll(pattern));
  const names = matches.map((match) => match[1]);
  return unique(names.filter((name) => !isLocalActionRef(name)));
};

const isLocalActionRef = (name: string): boolean => {
  if (name.startsWith("./")) return true;
  return name.startsWith("docker://");
};

const scanManifest = async (
  repo: GitHubRepo,
  path: string,
  language: LanguageId,
  parse: (content: string) => string[],
): Promise<ScanResult | null> => {
  const content = await fetchGitHubText(repo, path);
  if (!content) return null;
  return { dependencies: parse(content), language, manifests: [path] };
};

const isWorkflowFile = (file: GitHubContentFile): boolean => {
  if (file.type !== "file" || !file.path) return false;
  return file.path.endsWith(".yml") || file.path.endsWith(".yaml");
};

const settledText = (result: PromiseSettledResult<string | null>): string[] => {
  if (result.status !== "fulfilled" || !result.value) return [];
  return [result.value];
};

const scanWorkflows = async (repo: GitHubRepo): Promise<ScanResult | null> => {
  const files = await fetchGitHubContent(repo, ".github/workflows");
  if (!Array.isArray(files)) return null;

  const workflowFiles = files.filter(isWorkflowFile).slice(0, 5);
  const textReads = workflowFiles.map((file) =>
    fetchGitHubText(repo, file.path || ""),
  );
  const results = await Promise.allSettled(textReads);
  const dependencies = unique(
    results.flatMap(settledText).flatMap(parseActionDeps),
  );
  if (dependencies.length === 0) return null;
  return workflowScanResult(workflowFiles, dependencies);
};

const workflowScanResult = (
  files: GitHubContentFile[],
  dependencies: string[],
): ScanResult => {
  return {
    dependencies,
    language: "github-actions",
    manifests: files.map((file) => file.path || ""),
  };
};

const settledScan = (
  result: PromiseSettledResult<ScanResult | null>,
): ScanResult[] => {
  if (result.status !== "fulfilled" || !result.value) return [];
  return [result.value];
};

const mergeScanResults = (results: ScanResult[]): ScanResult => {
  const first = results[0];
  if (!first) return { dependencies: [], language: "nodejs", manifests: [] };
  return mergedScanResults(first.language, results);
};

const mergedScanResults = (
  language: LanguageId,
  results: ScanResult[],
): ScanResult => {
  const dependencies = unique(results.flatMap((result) => result.dependencies));
  const manifests = unique(results.flatMap((result) => result.manifests));
  return { dependencies, language, manifests };
};

export const scanGitHubRepository = async (
  repo: GitHubRepo,
): Promise<ScanResult> => {
  const packageJson = scanManifest(
    repo,
    "package.json",
    "nodejs",
    parsePackageJsonDeps,
  );
  const pyproject = scanManifest(
    repo,
    "pyproject.toml",
    "python",
    parsePyprojectDeps,
  );
  const goMod = scanManifest(repo, "go.mod", "go", parseGoDeps);
  const cargo = scanManifest(repo, "Cargo.toml", "rust", parseCargoDeps);
  const dockerfile = scanManifest(
    repo,
    "Dockerfile",
    "docker",
    parseDockerDeps,
  );
  const scans = await Promise.allSettled([
    packageJson,
    pyproject,
    goMod,
    cargo,
    dockerfile,
    scanWorkflows(repo),
  ]);
  return mergeScanResults(scans.flatMap(settledScan));
};

const isPinExceptions = (mode: PolicyMode): boolean => {
  return mode === "pin-exceptions";
};

export const buildConfig = (
  language: LanguageId,
  mode: PolicyMode,
  dependencies: string[],
): string => {
  const config = {
    language,
    permissive: isPinExceptions(mode),
    codependencies: dependencies,
  };
  return JSON.stringify(config, null, 2);
};

const shellQuote = (value: string): string => {
  if (/^[a-zA-Z0-9_./:@-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
};

export const buildCliCommand = (
  language: LanguageId,
  mode: PolicyMode,
  dependencies: string[],
): string => {
  const args = ["codependence", "--language", language];
  if (isPinExceptions(mode)) args.push("--permissive");
  if (dependencies.length > 0) args.push("--codependencies");
  return args.concat(dependencies.map(shellQuote)).concat("--dryRun").join(" ");
};

export const buildActionYaml = (
  language: LanguageId,
  mode: PolicyMode,
  dependencies: string[],
): string => {
  const baseLines = actionBaseLines(language);
  const modeLines = isPinExceptions(mode) ? ["          permissive: true"] : [];
  const depLines = actionDependencyLines(dependencies);
  return baseLines.concat(modeLines, depLines).join("\n");
};

const actionBaseLines = (language: LanguageId): string[] => [
  "name: Dependency Policy",
  "on: [pull_request]",
  "jobs:",
  "  codependence:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - uses: yowainwright/codependence@v1",
  "        with:",
  `          language: ${language}`,
  "          dryRun: true",
];

const actionDependencyLines = (dependencies: string[]): string[] => {
  if (dependencies.length === 0) return [];
  return [`          codependencies: '${dependencies.join(" ")}'`];
};

export const buildOutput = (
  tab: OutputTab,
  language: LanguageId,
  mode: PolicyMode,
  dependencies: string[],
): string => {
  if (tab === "cli") return buildCliCommand(language, mode, dependencies);
  if (tab === "action") return buildActionYaml(language, mode, dependencies);
  return buildConfig(language, mode, dependencies);
};

export const labelForLanguage = (language: LanguageId): string => {
  const option = languageOptions.find((item) => item.id === language);
  if (!option) return language;
  return option.label;
};
