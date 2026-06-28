import { useMemo, useState } from "react";
import {
  buildOutput,
  defaultDependencyInput,
  parseDependencies,
  parseGitHubRepoUrl,
  scanGitHubRepository,
  type LanguageId,
  type OutputTab,
  type PolicyMode,
  type ScanResult,
  type ScanStatus,
} from "./policyBuilderModel";

export type PolicyBuilderState = {
  repoUrl: string;
  dependencyInput: string;
  language: LanguageId;
  mode: PolicyMode;
  tab: OutputTab;
  scanStatus: ScanStatus;
  statusText: string;
};

const initialState: PolicyBuilderState = {
  repoUrl: "",
  dependencyInput: defaultDependencyInput,
  language: "nodejs",
  mode: "pin-exceptions",
  tab: "config",
  scanStatus: "idle",
  statusText: "",
};

export const usePolicyBuilder = () => {
  const [state, setState] = useState(initialState);
  const { dependencyInput, language, mode, repoUrl, tab } = state;
  const dependencies = useMemo(
    () => parseDependencies(dependencyInput),
    [dependencyInput],
  );
  const output = useMemo(
    () => buildOutput(tab, language, mode, dependencies),
    [dependencies, language, mode, tab],
  );
  const patchState = (patch: Partial<PolicyBuilderState>) =>
    setState((current) => ({ ...current, ...patch }));
  const scanRepository = async () =>
    scanRepositoryFromState(repoUrl, patchState);
  return { dependencies, output, patchState, scanRepository, state };
};

const scanRepositoryFromState = async (
  repoUrl: string,
  patchState: (patch: Partial<PolicyBuilderState>) => void,
) => {
  const repo = parseGitHubRepoUrl(repoUrl);
  if (!repo) {
    patchState({
      scanStatus: "error",
      statusText: "Enter a GitHub repo URL or owner/repo.",
    });
    return;
  }
  await runRepositoryScan(repo, patchState);
};

const runRepositoryScan = async (
  repo: NonNullable<ReturnType<typeof parseGitHubRepoUrl>>,
  patchState: (patch: Partial<PolicyBuilderState>) => void,
) => {
  patchState({
    scanStatus: "scanning",
    statusText: "Scanning public manifests...",
  });
  try {
    const result = await scanGitHubRepository(repo);
    patchState(scanResultState(result));
  } catch {
    patchState({
      scanStatus: "error",
      statusText: "Scan failed. Enter dependencies manually.",
    });
  }
};

const scanResultState = (result: ScanResult): Partial<PolicyBuilderState> => {
  const patch: Partial<PolicyBuilderState> = {
    language: result.language,
    scanStatus: "success",
    statusText: scanResultMessage(result),
  };
  if (result.dependencies.length > 0) {
    patch.dependencyInput = result.dependencies.slice(0, 12).join("\n");
  }
  return patch;
};

const scanResultMessage = (result: ScanResult): string => {
  if (result.manifests.length === 0) return "No supported manifests found.";
  return `Found ${result.manifests.length} manifests and ${result.dependencies.length} dependencies.`;
};
