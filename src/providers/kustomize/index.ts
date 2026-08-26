import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import {
  appendDependencyVersion,
  emptyInfraManifest,
  hasTemplate,
  isSafeDigest,
  isSafeImageName,
  isSafeImageVersion,
  manifestOnlyResolution,
  readYamlFieldLine,
  readYamlScalar,
  updateScalarLine,
} from "../infra";

interface KustomizeImageDraft {
  readonly digest?: string;
  readonly digestLine?: number;
  readonly name?: string;
  readonly newName?: string;
  readonly newTag?: string;
  readonly tagLine?: number;
}

interface KustomizeState {
  readonly current: KustomizeImageDraft | null;
  readonly imagesIndent: number;
  readonly inImages: boolean;
}

interface KustomizeUpdate {
  readonly name: string;
  readonly line: number;
}

const isIgnoredLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return trimmed.startsWith("#");
};

const exitsImages = (state: KustomizeState, line: string): boolean => {
  if (!state.inImages) return false;
  if (isIgnoredLine(line)) return false;

  const indent = line.search(/\S/);
  const isListItem = line.trimStart().startsWith("-");
  return indent <= state.imagesIndent && !isListItem;
};

const imageName = (draft: KustomizeImageDraft): string | null => {
  const name = draft.newName || draft.name;
  if (!isSafeImageName(name)) return null;
  return name;
};

const imageVersion = (draft: KustomizeImageDraft): string | null => {
  const hasTag = Boolean(draft.newTag);
  const hasDigest = Boolean(draft.digest);
  if (hasTag === hasDigest) return null;
  if (hasTag && isSafeImageVersion(draft.newTag)) return draft.newTag;
  if (hasDigest && isSafeDigest(draft.digest)) return draft.digest;
  return null;
};

const imageUpdateLine = (draft: KustomizeImageDraft): number | null => {
  if (draft.newTag) return draft.tagLine ?? null;
  if (draft.digest) return draft.digestLine ?? null;
  return null;
};

const finalizeImage = (
  manifest: DependencyManifest,
  updates: KustomizeUpdate[],
  draft: KustomizeImageDraft | null,
): void => {
  if (!draft) return;

  const name = imageName(draft);
  const version = imageVersion(draft);
  if (!name || !version) return;

  appendDependencyVersion(manifest, name, version);
  const line = imageUpdateLine(draft);
  if (line !== null) updates.push({ line, name });
};

const assignImageField = (
  draft: KustomizeImageDraft,
  key: string,
  value: string,
  lineIndex: number,
): KustomizeImageDraft => {
  if (hasTemplate(value)) return draft;
  if (key === "name") return Object.assign({}, draft, { name: value });
  if (key === "newName") return Object.assign({}, draft, { newName: value });
  if (key === "newTag") return Object.assign({}, draft, { newTag: value, tagLine: lineIndex });
  if (key === "digest") return Object.assign({}, draft, { digest: value, digestLine: lineIndex });
  return draft;
};

const readImageLine = (
  state: KustomizeState,
  manifest: DependencyManifest,
  updates: KustomizeUpdate[],
  line: string,
  lineIndex: number,
): KustomizeState => {
  const exited = exitsImages(state, line);
  const base = exited ? Object.assign({}, state, { current: null, inImages: false }) : state;
  if (exited) finalizeImage(manifest, updates, state.current);

  const field = readYamlFieldLine(line);
  if (field?.key === "images" && field.indent === 0 && !field.listItem) {
    finalizeImage(manifest, updates, base.current);
    return { current: null, imagesIndent: field.indent, inImages: true };
  }
  if (!base.inImages || !field) return base;

  const current = field.listItem ? {} : base.current;
  if (field.listItem) finalizeImage(manifest, updates, base.current);
  if (!current) return base;

  const value = readYamlScalar(field.raw);
  const next = value ? assignImageField(current, field.key, value, lineIndex) : current;
  return Object.assign({}, base, { current: next });
};

const collectImages = (
  filePath: string,
  content: string,
): { manifest: DependencyManifest; updates: KustomizeUpdate[] } => {
  const manifest = emptyInfraManifest(filePath);
  const updates: KustomizeUpdate[] = [];
  const initial = { current: null, imagesIndent: -1, inImages: false };
  const state = content
    .split("\n")
    .reduce((acc, line, index) => readImageLine(acc, manifest, updates, line, index), initial);
  finalizeImage(manifest, updates, state.current);
  return { manifest, updates };
};

export class KustomizeProvider implements DependencyProvider {
  readonly language = LANGUAGES.KUSTOMIZE;
  readonly capabilities = {
    supportsLatestResolution: false,
    supportsPreciseMode: false,
    versionStrategy: "exact",
  } as const;

  async getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("Kustomize");
  }

  async getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("Kustomize");
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    return collectImages(filePath, content).manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const { updates } = collectImages(filePath, content);
    const lines = content.split("\n");
    updates.forEach(({ line, name }) => {
      const current = readYamlScalar(lines[line] || "");
      if (!current) return;

      const next = manifest.dependencies[name];
      if (next) lines[line] = updateScalarLine(lines[line], next);
    });
    writeFileSync(filePath, lines.join("\n"));
  }

  validatePackageName(packageName: string): boolean {
    return isSafeImageName(packageName);
  }
}
