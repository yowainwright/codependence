import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import { GITHUB_ACTIONS_PATTERNS } from "./constants";

type GitHubActionRef = {
  readonly name: string;
  readonly version: string;
};

const emptyManifest = (filePath: string): DependencyManifest => {
  const manifest = {
    filePath,
    dependencies: {},
  };
  return manifest;
};

const isExternalAction = (name: string): boolean => {
  if (name.startsWith("./")) return false;
  if (name.startsWith("../")) return false;
  if (name.startsWith("docker://")) return false;

  return true;
};

const isShaPinnedRef = (version: string): boolean =>
  version.length === 40 &&
  version
    .toLowerCase()
    .split("")
    .every((char) => "0123456789abcdef".includes(char));

const unsupportedActionsResolution = (): Error =>
  new Error(
    'GitHub Actions provider requires explicit version pins, e.g. {"actions/checkout":"v5"}; latest resolution and precise mode are not supported yet.',
  );

const readUsesLine = (line: string): GitHubActionRef | null => {
  const match = line.match(GITHUB_ACTIONS_PATTERNS.USES_LINE);
  if (!match) return null;

  const name = match[3];
  if (!isExternalAction(name)) return null;
  if (isShaPinnedRef(match[4])) return null;

  const actionRef = { name, version: match[4] };
  return actionRef;
};

export const updateGitHubActionsUsesLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const match = line.match(GITHUB_ACTIONS_PATTERNS.USES_LINE);
  if (!match) return line;

  const name = match[3];
  if (!isExternalAction(name)) return line;
  if (isShaPinnedRef(match[4])) return line;

  const version = dependencies[name];
  if (!version) return line;

  const updatedLine = `${match[1]}${match[2]}${name}@${version}${match[5]}${match[6]}`;
  return updatedLine;
};

export class GitHubActionsProvider implements DependencyProvider {
  readonly language = LANGUAGES.GITHUB_ACTIONS;
  readonly capabilities = {
    supportsLatestResolution: false,
    supportsPreciseMode: false,
    versionStrategy: "exact",
  } as const;

  async getLatestVersion(_packageName: string): Promise<string> {
    throw unsupportedActionsResolution();
  }

  async getAllVersions(_packageName: string): Promise<string[]> {
    throw unsupportedActionsResolution();
  }

  readManifest(filePath: string): DependencyManifest {
    const manifest = emptyManifest(filePath);
    const content = readFileSync(filePath, "utf8");

    for (const line of content.split("\n")) {
      const actionRef = readUsesLine(line);
      if (!actionRef) continue;

      manifest.dependencies[actionRef.name] = actionRef.version;
    }

    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updatedLines: string[] = [];

    for (const line of content.split("\n")) {
      const updatedLine = updateGitHubActionsUsesLine(line, manifest.dependencies);
      updatedLines.push(updatedLine);
    }

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = packageName.match(GITHUB_ACTIONS_PATTERNS.PACKAGE_NAME) !== null;
    return isValid;
  }
}
