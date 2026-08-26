import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import {
  appendDependencyVersion,
  emptyInfraManifest,
  hasTemplate,
  manifestOnlyResolution,
} from "../infra";
import { TERRAFORM_PATTERNS } from "./constants";

interface TerraformDraft {
  readonly source?: string;
  readonly sourceLine?: number;
  readonly version?: string;
  readonly versionLine?: number;
}

interface TerraformState {
  readonly block: "module" | "provider" | null;
  readonly blockDepth: number;
  readonly depth: number;
  readonly draft: TerraformDraft | null;
  readonly inRequiredProviders: boolean;
  readonly requiredProvidersDepth: number;
}

interface TerraformUpdate {
  readonly line: number;
  readonly name: string;
  readonly sourceRef: boolean;
}

const TERRAFORM_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const TERRAFORM_VERSION_PATTERN = new RegExp("^[~\\x3e\\x3c=!,.\\sA-Za-z0-9_-]+$");

const isLocalModuleSource = (source: string | undefined): boolean => {
  if (!source) return true;
  if (source.startsWith("./")) return true;
  if (source.startsWith("../")) return true;
  return source.startsWith("/");
};

const isSafeTerraformName = (value: string | undefined): value is string => {
  if (!value) return false;
  if (hasTemplate(value)) return false;
  return TERRAFORM_NAME_PATTERN.test(value);
};

const isSafeTerraformVersion = (value: string | undefined): value is string => {
  if (!value) return false;
  if (hasTemplate(value)) return false;
  return TERRAFORM_VERSION_PATTERN.test(value);
};

const cleanGitSourcePath = (url: URL): string | null => {
  const path = url.pathname.replace(/\.git$/, "").replace(/^\/+/, "");
  const name = `${url.hostname}/${path}`;
  if (!isSafeTerraformName(name)) return null;
  return name;
};

const gitModuleSource = (source: string): readonly [string, string] | null => {
  const rawUrl = source.replace(/^git::/, "");
  try {
    const url = new URL(rawUrl);
    const ref = url.searchParams.get("ref");
    const name = cleanGitSourcePath(url);
    if (!name) return null;
    const hasGitModuleRef = isSafeTerraformVersion(ref || undefined);
    if (!hasGitModuleRef) return null;
    return [name, ref as string];
  } catch {
    return null;
  }
};

const moduleName = (source: string | undefined): string | null => {
  if (isLocalModuleSource(source)) return null;
  if (!source) return null;

  const gitModule = gitModuleSource(source);
  if (gitModule) return gitModule[0];
  if (source.includes("://")) return null;
  if (!isSafeTerraformName(source)) return null;
  return source;
};

const moduleVersion = (draft: TerraformDraft): string | null => {
  const hasSafeVersion = Boolean(draft.version && isSafeTerraformVersion(draft.version));
  if (hasSafeVersion) return draft.version as string;
  if (!draft.source) return null;

  const gitModule = gitModuleSource(draft.source);
  if (!gitModule) return null;
  return gitModule[1];
};

const moduleUpdateLine = (draft: TerraformDraft): TerraformUpdate | null => {
  const name = moduleName(draft.source);
  if (!name) return null;

  const hasVersionLine = draft.version && draft.versionLine !== undefined;
  if (hasVersionLine) {
    return { line: draft.versionLine as number, name, sourceRef: false };
  }

  const hasSourceLine = draft.sourceLine !== undefined;
  if (!hasSourceLine) return null;

  const source = draft.source || "";
  const hasGitSourceRef = Boolean(gitModuleSource(source));
  if (hasGitSourceRef) {
    return { line: draft.sourceLine, name, sourceRef: true };
  }
  return null;
};

const providerName = (draft: TerraformDraft): string | null => {
  if (!isSafeTerraformName(draft.source)) return null;
  return draft.source;
};

const providerUpdateLine = (draft: TerraformDraft): TerraformUpdate | null => {
  const name = providerName(draft);
  if (!name) return null;

  const hasVersionLine = draft.version && draft.versionLine !== undefined;
  if (!hasVersionLine) return null;
  return { line: draft.versionLine as number, name, sourceRef: false };
};

const draftName = (state: TerraformState): string | null => {
  if (!state.draft) return null;
  if (state.block === "provider") return providerName(state.draft);
  return moduleName(state.draft.source);
};

const draftVersion = (state: TerraformState): string | null | undefined => {
  if (!state.draft) return null;
  if (state.block === "provider") return state.draft.version;
  return moduleVersion(state.draft);
};

const draftUpdateLine = (state: TerraformState): TerraformUpdate | null => {
  if (!state.draft) return null;
  if (state.block === "provider") return providerUpdateLine(state.draft);
  return moduleUpdateLine(state.draft);
};

const appendTerraformUpdate = (
  updates: TerraformUpdate[],
  update: TerraformUpdate | null,
): void => {
  if (!update) return;
  updates[updates.length] = update;
};

const finalizeDraft = (
  manifest: DependencyManifest,
  updates: TerraformUpdate[],
  state: TerraformState,
): void => {
  if (!state.draft) return;

  const name = draftName(state);
  if (!name) return;

  const version = draftVersion(state);
  const hasSafeVersion = isSafeTerraformVersion(version || undefined);
  if (!hasSafeVersion) return;

  appendDependencyVersion(manifest, name, version as string);
  const update = draftUpdateLine(state);
  appendTerraformUpdate(updates, update);
};

const braceDelta = (line: string): number => {
  const withoutStrings = line.replace(/"[^"]*"|'[^']*'/g, "");
  const opens = (withoutStrings.match(/\{/g) || []).length;
  const closes = (withoutStrings.match(/\}/g) || []).length;
  return opens - closes;
};

const readStringAssignment = (line: string): readonly [string, string] | null => {
  const match = line.match(TERRAFORM_PATTERNS.STRING_ASSIGNMENT);
  if (!match) return null;

  const key = match[1].split("=")[0].trim();
  return [key, match[3]];
};

const assignDraftField = (
  draft: TerraformDraft,
  line: string,
  lineIndex: number,
): TerraformDraft => {
  const assignment = readStringAssignment(line);
  if (!assignment) return draft;

  const [key, value] = assignment;
  if (key === "source") return Object.assign({}, draft, { source: value, sourceLine: lineIndex });
  if (key === "version")
    return Object.assign({}, draft, { version: value, versionLine: lineIndex });
  return draft;
};

const startBlock = (state: TerraformState, line: string): TerraformState => {
  const block = line.match(TERRAFORM_PATTERNS.BLOCK_START);
  const blockName = block ? block[1] : "";
  if (blockName === "module") {
    return Object.assign({}, state, { block: "module", blockDepth: state.depth, draft: {} });
  }
  if (blockName === "required_providers") {
    return Object.assign({}, state, {
      inRequiredProviders: true,
      requiredProvidersDepth: state.depth,
    });
  }

  const object = line.match(TERRAFORM_PATTERNS.OBJECT_START);
  const startsProvider = state.inRequiredProviders && object;
  if (!startsProvider) return state;
  return Object.assign({}, state, { block: "provider", blockDepth: state.depth, draft: {} });
};

const closeFinishedBlocks = (
  manifest: DependencyManifest,
  updates: TerraformUpdate[],
  state: TerraformState,
): TerraformState => {
  const closesCurrentBlock = state.block && state.depth <= state.blockDepth;
  if (closesCurrentBlock) {
    finalizeDraft(manifest, updates, state);
    return Object.assign({}, state, { block: null, draft: null });
  }

  const exitsProviders = state.inRequiredProviders && state.depth <= state.requiredProvidersDepth;
  if (exitsProviders) return Object.assign({}, state, { inRequiredProviders: false });
  return state;
};

const activeBlockState = (state: TerraformState, line: string): TerraformState => {
  if (state.block) return state;
  return startBlock(state, line);
};

const assignedDraft = (
  state: TerraformState,
  line: string,
  lineIndex: number,
): TerraformDraft | null => {
  if (!state.draft) return null;
  return assignDraftField(state.draft, line, lineIndex);
};

const readTerraformLine = (
  manifest: DependencyManifest,
  updates: TerraformUpdate[],
  state: TerraformState,
  line: string,
  lineIndex: number,
): TerraformState => {
  const started = activeBlockState(state, line);
  const draft = assignedDraft(started, line, lineIndex);
  const depth = started.depth + braceDelta(line);
  const next = Object.assign({}, started, { depth, draft });
  return closeFinishedBlocks(manifest, updates, next);
};

const collectTerraform = (
  filePath: string,
  content: string,
): { manifest: DependencyManifest; updates: TerraformUpdate[] } => {
  const manifest = emptyInfraManifest(filePath);
  const updates: TerraformUpdate[] = [];
  const initial = {
    block: null,
    blockDepth: -1,
    depth: 0,
    draft: null,
    inRequiredProviders: false,
    requiredProvidersDepth: -1,
  } satisfies TerraformState;
  content
    .split("\n")
    .reduce(
      (state, line, index) => readTerraformLine(manifest, updates, state, line, index),
      initial,
    );
  return { manifest, updates };
};

const updateStringLine = (line: string, value: string): string => {
  const match = line.match(TERRAFORM_PATTERNS.STRING_ASSIGNMENT);
  if (!match) return line;
  return `${match[1]}${match[2]}${value}${match[2]}${match[4]}`;
};

const updateSourceRef = (line: string, version: string): string => {
  const match = line.match(TERRAFORM_PATTERNS.STRING_ASSIGNMENT);
  if (!match) return line;

  const source = match[3].replace(/^git::/, "");
  const url = new URL(source);
  url.searchParams.set("ref", version);
  return `${match[1]}${match[2]}git::${url.toString()}${match[2]}${match[4]}`;
};

export class TerraformProvider implements DependencyProvider {
  readonly language = LANGUAGES.TERRAFORM;
  readonly capabilities = {
    supportsLatestResolution: false,
    supportsPreciseMode: false,
    versionStrategy: "semver",
  } as const;

  async getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("Terraform");
  }

  async getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("Terraform");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return collectTerraform(filePath, content).manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const { updates } = collectTerraform(filePath, content);
    const lines = content.split("\n");
    updates.forEach(({ line, name, sourceRef }) => {
      const version = manifest.dependencies[name];
      if (!version) return;

      const currentLine = lines[line] || "";
      if (sourceRef) {
        lines[line] = updateSourceRef(currentLine, version);
        return;
      }

      lines[line] = updateStringLine(currentLine, version);
    });
    writeFileSync(filePath, lines.join("\n"));
  }

  validatePackageName(packageName: string): boolean {
    const trimmed = packageName.trim();
    if (trimmed !== packageName) return false;
    return isSafeTerraformName(trimmed);
  }
}
