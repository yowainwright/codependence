import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import {
  appendDependencyVersion,
  emptyInfraManifest,
  isSafeImageName,
  isSafeImageVersion,
  readYamlImageLine,
  updateScalarLine,
  updateYamlImageLine,
} from "../infra";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import { HELM_PATTERNS, HELM_TEMPLATE_PATTERN } from "./constants";

interface HelmFieldLine {
  readonly indent: number;
  readonly key: string;
  readonly listItem: boolean;
  readonly raw: string;
}

interface HelmDependencyDraft {
  readonly name?: string;
  readonly repository?: string;
  readonly version?: string;
}

interface HelmDependencySectionState<Draft extends object> {
  readonly current: Draft | null;
  readonly dependencyIndent: number;
  readonly inDependencies: boolean;
}

interface HelmReadState extends HelmDependencySectionState<HelmDependencyDraft> {
  readonly chartVersion?: string;
  readonly dependencies: Record<string, string>;
}

interface HelmImageDraft {
  readonly registry?: string;
  readonly repository?: string;
  readonly tag?: string;
  readonly tagLine?: number;
}

interface HelmImageState {
  readonly current: HelmImageDraft | null;
  readonly fieldIndent: number | null;
  readonly imageIndent: number;
}

interface HelmImageUpdate {
  readonly line: number;
  readonly name: string;
}

interface HelmDependencyUpdateDraft extends HelmDependencyDraft {
  readonly versionLine?: number;
}

interface HelmDependencyUpdate {
  readonly line: number;
  readonly version: string;
}

interface HelmDependencyUpdateState
  extends HelmDependencySectionState<HelmDependencyUpdateDraft> {
  readonly updates: HelmDependencyUpdate[];
}

const unsupportedResolution = (): never => {
  throw new Error(
    "Helm provider requires explicit version pins and does not support latest resolution yet",
  );
};

const readFieldLine = (line: string): HelmFieldLine | null => {
  const match = line.match(HELM_PATTERNS.FIELD_LINE);
  if (!match) return null;

  return {
    indent: match[1].length,
    key: match[3],
    listItem: Boolean(match[2]),
    raw: match[4],
  };
};

const readQuotedScalar = (value: string): string | null => {
  const quote = value[0];
  const hasQuote = quote === '"' || quote === "'";
  if (!hasQuote) return null;

  const end = value.indexOf(quote, 1);
  const hasClosingQuote = end > 0;
  if (!hasClosingQuote) return null;

  return value.slice(1, end);
};

const readPlainScalar = (value: string): string | null => {
  const commentStart = value.indexOf("#");
  const raw = commentStart === -1 ? value : value.slice(0, commentStart);
  const scalar = raw.trim();
  return scalar || null;
};

const readScalar = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;

  const startsDoubleQuote = value.startsWith('"');
  const startsSingleQuote = value.startsWith("'");
  const isQuoted = startsDoubleQuote || startsSingleQuote;
  if (isQuoted) return readQuotedScalar(value);

  return readPlainScalar(value);
};

const hasTemplate = (value: string): boolean => {
  if (value.length === 0) return false;
  return HELM_TEMPLATE_PATTERN.test(value);
};

const isLocalRepository = (repository: string | undefined): boolean => {
  if (!repository) return true;

  const value = repository.trim();
  if (value.startsWith("file://")) return true;
  if (value.startsWith("./")) return true;
  return value.startsWith("../");
};

const isSafeDependency = ({ name, repository, version }: HelmDependencyDraft): boolean => {
  const missingRequiredFields = !name || !version;
  if (missingRequiredFields) return false;

  const hasTemplatedValue = hasTemplate(name) || hasTemplate(version);
  if (hasTemplatedValue) return false;

  const hasDigestPin = version.includes("@sha256:") || version.startsWith("sha256:");
  if (hasDigestPin) return false;
  if (isLocalRepository(repository)) return false;

  return HELM_PATTERNS.PACKAGE_NAME.test(name);
};

const dependencyEntry = (draft: HelmDependencyDraft): readonly [string, string] | null => {
  if (!isSafeDependency(draft)) return null;

  return [draft.name as string, draft.version as string];
};

const finalizeDependency = (state: HelmReadState): HelmReadState => {
  if (!state.current) return state;

  const entry = dependencyEntry(state.current);
  const current = null;
  if (!entry) return Object.assign({}, state, { current });

  const dependencies = Object.assign({}, state.dependencies, { [entry[0]]: entry[1] });
  return Object.assign({}, state, { current, dependencies });
};

const isIgnoredLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  return trimmed.startsWith("#");
};

const exitsDependencies = (
  state: { readonly dependencyIndent: number; readonly inDependencies: boolean },
  line: string,
): boolean => {
  if (!state.inDependencies) return false;
  if (isIgnoredLine(line)) return false;

  const indent = line.search(/\S/);
  const startsListItem = line.trimStart().startsWith("-");
  if (indent > state.dependencyIndent) return false;

  return !startsListItem;
};

const leaveDependencySection = <
  Draft extends object,
  State extends HelmDependencySectionState<Draft>,
>(
  state: State,
  line: string,
  finalize: (state: State) => State,
): State => {
  if (!exitsDependencies(state, line)) return state;

  const finalized = finalize(state);
  return Object.assign({}, finalized, { inDependencies: false });
};

const enterDependencySection = <
  Draft extends object,
  State extends HelmDependencySectionState<Draft>,
>(
  state: State,
  field: HelmFieldLine,
  finalize: (state: State) => State,
): State => {
  const finalized = finalize(state);
  return Object.assign({}, finalized, {
    current: null,
    dependencyIndent: field.indent,
    inDependencies: true,
  });
};

const isDependenciesField = (field: HelmFieldLine | null): field is HelmFieldLine => {
  if (!field) return false;

  const hasDependenciesKey = field.key === "dependencies";
  const isRootField = field.indent === 0;
  if (!hasDependenciesKey) return false;
  if (!isRootField) return false;

  return !field.listItem;
};

const assignChartField = (state: HelmReadState, field: HelmFieldLine | null): HelmReadState => {
  if (!field) return state;
  const isRootField = field.indent === 0;
  if (!isRootField) return state;
  if (field.listItem) return state;

  const value = readScalar(field.raw);
  if (!value) return state;
  const hasSafeValue = !hasTemplate(value);
  if (!hasSafeValue) return state;
  if (field.key === "version") return Object.assign({}, state, { chartVersion: value });
  return state;
};

const assignDependencyField = (
  draft: HelmDependencyDraft,
  field: HelmFieldLine,
): HelmDependencyDraft => {
  const value = readScalar(field.raw);
  if (!value) return draft;
  if (field.key === "name") return Object.assign({}, draft, { name: value });
  if (field.key === "version") return Object.assign({}, draft, { version: value });
  if (field.key === "repository") return Object.assign({}, draft, { repository: value });
  return draft;
};

const readDependencyDraftField = <
  Draft extends object,
  State extends HelmDependencySectionState<Draft>,
>(
  state: State,
  field: HelmFieldLine | null,
  finalize: (state: State) => State,
  createDraft: () => Draft,
  assignField: (draft: Draft, field: HelmFieldLine) => Draft,
): State => {
  if (!field) return state;

  const base = field.listItem ? finalize(state) : state;
  const current = field.listItem ? createDraft() : base.current;
  if (!current) return base;

  const nextCurrent = assignField(current, field);
  return Object.assign({}, base, { current: nextCurrent });
};

const assignDependency = (state: HelmReadState, field: HelmFieldLine | null): HelmReadState =>
  readDependencyDraftField(state, field, finalizeDependency, () => ({}), assignDependencyField);

const readHelmLine = (state: HelmReadState, line: string): HelmReadState => {
  const base = leaveDependencySection(state, line, finalizeDependency);
  const field = readFieldLine(line);
  if (isDependenciesField(field)) {
    return enterDependencySection(base, field, finalizeDependency);
  }
  if (base.inDependencies) return assignDependency(base, field);

  return assignChartField(base, field);
};

const readHelmManifest = (filePath: string, content: string): DependencyManifest => {
  const initialState: HelmReadState = {
    current: null,
    dependencies: {},
    dependencyIndent: -1,
    inDependencies: false,
  };
  const state = finalizeDependency(content.split("\n").reduce(readHelmLine, initialState));
  const version = state.chartVersion;
  const versioned = version ? { version } : {};
  const manifest = emptyInfraManifest(filePath);

  return Object.assign(manifest, { dependencies: state.dependencies }, versioned);
};

const imageName = ({ registry, repository }: HelmImageDraft): string | null => {
  if (!repository) return null;
  const name = registry ? `${registry}/${repository}` : repository;
  if (!isSafeImageName(name)) return null;
  return name;
};

const isSafeImageDraft = (draft: HelmImageDraft): boolean => {
  const name = imageName(draft);
  const tag = draft.tag;
  return Boolean(name && isSafeImageVersion(tag));
};

const finalizeImage = (
  manifest: DependencyManifest,
  updates: HelmImageUpdate[],
  draft: HelmImageDraft | null,
): void => {
  if (!draft || !isSafeImageDraft(draft)) return;

  const name = imageName(draft) as string;
  const tag = draft.tag as string;
  appendDependencyVersion(manifest, name, tag);
  if (draft.tagLine !== undefined) updates.push({ line: draft.tagLine, name });
};

const assignImageField = (
  draft: HelmImageDraft,
  field: HelmFieldLine,
  lineIndex: number,
): HelmImageDraft => {
  const value = readScalar(field.raw);
  if (!value || hasTemplate(value)) return draft;
  if (field.key === "registry") return Object.assign({}, draft, { registry: value });
  if (field.key === "repository") return Object.assign({}, draft, { repository: value });
  if (field.key === "tag") return Object.assign({}, draft, { tag: value, tagLine: lineIndex });
  return draft;
};

const emptyImageState = (): HelmImageState => ({
  current: null,
  fieldIndent: null,
  imageIndent: -1,
});

const startImageState = (field: HelmFieldLine): HelmImageState => ({
  current: {},
  fieldIndent: null,
  imageIndent: field.indent,
});

const closeImageState = (
  manifest: DependencyManifest,
  updates: HelmImageUpdate[],
  state: HelmImageState,
): HelmImageState => {
  finalizeImage(manifest, updates, state.current);
  return emptyImageState();
};

const startsImageBlock = (field: HelmFieldLine, rawValue: string | null): boolean =>
  field.key === "image" && !rawValue;

const exitsImageBlock = (state: HelmImageState, field: HelmFieldLine): boolean =>
  Boolean(state.current && field.indent <= state.imageIndent);

const directImageFieldIndent = (state: HelmImageState, field: HelmFieldLine): number | null => {
  if (!state.current) return null;
  if (field.indent <= state.imageIndent) return null;
  return state.fieldIndent ?? field.indent;
};

const readHelmImageLine = (
  state: HelmImageState,
  manifest: DependencyManifest,
  updates: HelmImageUpdate[],
  line: string,
  lineIndex: number,
): HelmImageState => {
  const directImage = readYamlImageLine(line);
  if (directImage) appendDependencyVersion(manifest, directImage.name, directImage.version);

  const field = readFieldLine(line);
  if (!field) return state;

  const rawValue = readScalar(field.raw);
  const base = exitsImageBlock(state, field) ? closeImageState(manifest, updates, state) : state;
  if (startsImageBlock(field, rawValue) && !base.current) return startImageState(field);

  const childIndent = directImageFieldIndent(base, field);
  if (childIndent === null) return base;

  const scoped =
    base.fieldIndent === null ? Object.assign({}, base, { fieldIndent: childIndent }) : base;
  if (field.indent !== childIndent) return scoped;
  if (!scoped.current) return scoped;

  const current = assignImageField(scoped.current, field, lineIndex);
  return Object.assign({}, scoped, { current });
};

const collectHelmValuesImages = (
  filePath: string,
  content: string,
): { manifest: DependencyManifest; updates: HelmImageUpdate[] } => {
  const manifest = emptyInfraManifest(filePath);
  const updates: HelmImageUpdate[] = [];
  const initial = emptyImageState();
  const state = content
    .split("\n")
    .reduce((acc, line, index) => readHelmImageLine(acc, manifest, updates, line, index), initial);
  finalizeImage(manifest, updates, state.current);
  return { manifest, updates };
};

const updateVersionLine = (line: string, version: string): string => {
  const quoted = line.match(HELM_PATTERNS.QUOTED_VERSION_LINE);
  if (quoted) return `${quoted[1]}${quoted[2]}${version}${quoted[2]}${quoted[4]}`;

  const plain = line.match(HELM_PATTERNS.PLAIN_VERSION_LINE);
  if (!plain) return line;
  return `${plain[1]}${version}${plain[3]}`;
};

const dependencyUpdate = (
  draft: HelmDependencyUpdateDraft,
  dependencies: Record<string, string>,
): HelmDependencyUpdate | null => {
  const entry = dependencyEntry(draft);
  if (!entry) return null;

  const version = dependencies[entry[0]];
  if (!version) return null;
  if (draft.versionLine === undefined) return null;

  return { line: draft.versionLine, version };
};

const finalizeDependencyUpdate = (
  state: HelmDependencyUpdateState,
  dependencies: Record<string, string>,
): HelmDependencyUpdateState => {
  if (!state.current) return state;

  const update = dependencyUpdate(state.current, dependencies);
  const updates = update ? state.updates.concat(update) : state.updates;
  return Object.assign({}, state, { current: null, updates });
};

const assignDependencyUpdateField = (
  draft: HelmDependencyUpdateDraft,
  field: HelmFieldLine,
  lineIndex: number,
): HelmDependencyUpdateDraft => {
  const value = readScalar(field.raw);
  if (!value) return draft;

  const next = assignDependencyField(draft, field);
  if (field.key !== "version") return next;
  return Object.assign({}, next, { versionLine: lineIndex });
};

const readDependencyUpdateField = (
  state: HelmDependencyUpdateState,
  field: HelmFieldLine | null,
  lineIndex: number,
  dependencies: Record<string, string>,
): HelmDependencyUpdateState => {
  const finalize = (nextState: HelmDependencyUpdateState) =>
    finalizeDependencyUpdate(nextState, dependencies);
  const assignField = (draft: HelmDependencyUpdateDraft, nextField: HelmFieldLine) =>
    assignDependencyUpdateField(draft, nextField, lineIndex);

  return readDependencyDraftField(state, field, finalize, () => ({}), assignField);
};

const readHelmUpdateLine = (
  state: HelmDependencyUpdateState,
  line: string,
  lineIndex: number,
  dependencies: Record<string, string>,
): HelmDependencyUpdateState => {
  const finalize = (nextState: HelmDependencyUpdateState) =>
    finalizeDependencyUpdate(nextState, dependencies);
  const base = leaveDependencySection(state, line, finalize);
  const field = readFieldLine(line);
  if (isDependenciesField(field)) {
    return enterDependencySection(base, field, finalize);
  }
  if (!base.inDependencies) return base;

  return readDependencyUpdateField(base, field, lineIndex, dependencies);
};

const collectDependencyUpdates = (
  content: string,
  dependencies: Record<string, string>,
): HelmDependencyUpdate[] => {
  const initial: HelmDependencyUpdateState = {
    current: null,
    dependencyIndent: -1,
    inDependencies: false,
    updates: [],
  };
  const state = content
    .split("\n")
    .reduce((acc, line, index) => readHelmUpdateLine(acc, line, index, dependencies), initial);
  return finalizeDependencyUpdate(state, dependencies).updates;
};

const updateHelmManifest = (content: string, dependencies: Record<string, string>): string => {
  const lines = content.split("\n");
  const updates = collectDependencyUpdates(content, dependencies);
  updates.forEach(({ line, version }) => {
    lines[line] = updateVersionLine(lines[line] || "", version);
  });

  return lines.join("\n");
};

const isChartManifest = (filePath: string): boolean => basename(filePath) === "Chart.yaml";

const updateHelmValuesManifest = (
  filePath: string,
  content: string,
  manifest: DependencyManifest,
): string => {
  const { updates } = collectHelmValuesImages(filePath, content);
  const lines = content
    .split("\n")
    .map((line) =>
      updateYamlImageLine(line, manifest.dependencies, manifest.resolvedDependencyVersions),
    );
  updates.forEach(({ line, name }) => {
    const version = manifest.dependencies[name];
    if (version) lines[line] = updateScalarLine(lines[line] || "", version);
  });
  return lines.join("\n");
};

export class HelmProvider implements DependencyProvider {
  readonly language = LANGUAGES.HELM;
  readonly capabilities = {
    supportsLatestResolution: false,
    supportsPreciseMode: false,
    versionStrategy: "semver",
  } as const;

  async getLatestVersion(): Promise<string> {
    return unsupportedResolution();
  }

  async getAllVersions(): Promise<string[]> {
    return unsupportedResolution();
  }

  readManifest(filePath: string): DependencyManifest {
    const content = readFileSync(filePath, "utf8");
    if (!isChartManifest(filePath)) return collectHelmValuesImages(filePath, content).manifest;
    return readHelmManifest(filePath, content);
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    const content = readFileSync(filePath, "utf8");
    const updated = isChartManifest(filePath)
      ? updateHelmManifest(content, manifest.dependencies)
      : updateHelmValuesManifest(filePath, content, manifest);
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const trimmed = packageName.trim();
    if (trimmed !== packageName) return false;

    return HELM_PATTERNS.PACKAGE_NAME.test(trimmed);
  }
}
