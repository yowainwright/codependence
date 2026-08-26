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

interface HelmReadState {
  readonly chartVersion?: string;
  readonly current: HelmDependencyDraft | null;
  readonly dependencies: Record<string, string>;
  readonly dependencyIndent: number;
  readonly inDependencies: boolean;
}

interface HelmWriteState {
  readonly currentName: string | null;
  readonly dependencyIndent: number;
  readonly inDependencies: boolean;
}

interface HelmWriteResult {
  readonly line: string;
  readonly state: HelmWriteState;
}

interface HelmWriteAccumulator {
  readonly lines: string[];
  readonly state: HelmWriteState;
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

const exitsDependencies = (state: HelmReadState | HelmWriteState, line: string): boolean => {
  if (!state.inDependencies) return false;
  if (isIgnoredLine(line)) return false;

  const indent = line.search(/\S/);
  const startsListItem = line.trimStart().startsWith("-");
  if (indent > state.dependencyIndent) return false;

  return !startsListItem;
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

const assignDependency = (state: HelmReadState, field: HelmFieldLine | null): HelmReadState => {
  if (!field) return state;

  const base = field.listItem ? finalizeDependency(state) : state;
  const current = field.listItem ? {} : base.current;
  if (!current) return base;

  const nextCurrent = assignDependencyField(current, field);
  return Object.assign({}, base, { current: nextCurrent });
};

const readHelmLine = (state: HelmReadState, line: string): HelmReadState => {
  const exited = exitsDependencies(state, line);
  const base = exited
    ? Object.assign({}, finalizeDependency(state), { inDependencies: false })
    : state;
  const field = readFieldLine(line);
  if (isDependenciesField(field)) {
    return Object.assign({}, finalizeDependency(base), {
      current: null,
      dependencyIndent: field.indent,
      inDependencies: true,
    });
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

const safeDependencyName = (value: string | null): string | null => {
  if (!value) return null;
  const hasSafeValue = !hasTemplate(value);
  if (!hasSafeValue) return null;
  if (!HELM_PATTERNS.PACKAGE_NAME.test(value)) return null;

  return value;
};

const updateVersionLine = (line: string, version: string): string => {
  const quoted = line.match(HELM_PATTERNS.QUOTED_VERSION_LINE);
  if (quoted) return `${quoted[1]}${quoted[2]}${version}${quoted[2]}${quoted[4]}`;

  const plain = line.match(HELM_PATTERNS.PLAIN_VERSION_LINE);
  if (!plain) return line;
  return `${plain[1]}${version}${plain[3]}`;
};

const writeDependencyLine = (
  state: HelmWriteState,
  field: HelmFieldLine | null,
  line: string,
  dependencies: Record<string, string>,
): HelmWriteResult => {
  if (!field) return { line, state };

  const currentName = field.listItem ? null : state.currentName;
  const base = Object.assign({}, state, { currentName });
  if (field.key === "name") {
    const name = safeDependencyName(readScalar(field.raw));
    return { line, state: Object.assign({}, base, { currentName: name }) };
  }
  const version = base.currentName ? dependencies[base.currentName] : undefined;
  const shouldUpdate = field.key === "version" && version;
  if (!shouldUpdate) return { line, state: base };

  return { line: updateVersionLine(line, version), state: base };
};

const writeHelmLine = (
  state: HelmWriteState,
  line: string,
  dependencies: Record<string, string>,
): HelmWriteResult => {
  const exited = exitsDependencies(state, line);
  const base = exited
    ? Object.assign({}, state, { currentName: null, inDependencies: false })
    : state;
  const field = readFieldLine(line);
  if (isDependenciesField(field)) {
    const nextState = {
      currentName: null,
      dependencyIndent: field.indent,
      inDependencies: true,
    };
    return { line, state: nextState };
  }
  if (!base.inDependencies) return { line, state: base };

  return writeDependencyLine(base, field, line, dependencies);
};

const updateHelmManifest = (content: string, dependencies: Record<string, string>): string => {
  const initialState = { currentName: null, dependencyIndent: -1, inDependencies: false };
  const initial: HelmWriteAccumulator = { lines: [], state: initialState };
  const { lines } = content.split("\n").reduce((accumulator, line) => {
    const result = writeHelmLine(accumulator.state, line, dependencies);
    return { lines: accumulator.lines.concat(result.line), state: result.state };
  }, initial);

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
