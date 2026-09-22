import { readFileSync, writeFileSync } from "fs";
import { LANGUAGES } from "../constants";
import type { DependencyManifest, DependencyProvider } from "../types";
import {
  appendDependencyVersion,
  emptyInfraManifest,
  hasTemplate,
  manifestOnlyResolution,
  readYamlFieldLine,
  readYamlImageLine,
  readYamlScalar,
  updateScalarRange,
  updateTaggedImageRaw,
  readScalarRange,
} from "../infra";
import { CIRCLECI_PATTERNS } from "./constants";

interface CircleCIReadState {
  readonly dependencies: Record<string, string>;
  readonly dependencyVersions?: Record<string, readonly string[]>;
  readonly inOrbs: boolean;
  readonly orbsIndent: number;
}

interface CircleCIWriteState {
  readonly inOrbs: boolean;
  readonly orbsIndent: number;
}

const exitsBlock = (inBlock: boolean, blockIndent: number, line: string): boolean => {
  if (!inBlock) return false;
  const isIgnoredLine = !line.trim() || line.trimStart().startsWith("#");
  if (isIgnoredLine) return false;

  const indent = line.search(/\S/);
  return indent <= blockIndent;
};

const readOrbReference = (raw: string): readonly [string, string] | null => {
  const value = readYamlScalar(raw);
  if (!value) return null;
  if (hasTemplate(value)) return null;

  const match = value.match(CIRCLECI_PATTERNS.ORB_REFERENCE);
  if (!match) return null;
  return [match[1], match[2]];
};

const readCircleCILine = (
  manifest: DependencyManifest,
  state: CircleCIReadState,
  line: string,
): CircleCIReadState => {
  const field = readYamlFieldLine(line);
  const exited = exitsBlock(state.inOrbs, state.orbsIndent, line);
  const base = exited ? Object.assign({}, state, { inOrbs: false }) : state;
  const isRootField = field?.indent === 0 && !field.listItem;
  const isOrbsHeader = isRootField && field.key === "orbs";
  if (isOrbsHeader) {
    return Object.assign({}, base, { inOrbs: true, orbsIndent: field.indent });
  }

  const image = readYamlImageLine(line);
  if (image) appendDependencyVersion(manifest, image.name, image.version);

  const isOrbField = base.inOrbs && field && !field.listItem;
  const orb = isOrbField ? readOrbReference(field.raw) : null;
  if (orb) appendDependencyVersion(manifest, orb[0], orb[1]);
  return Object.assign({}, base, {
    dependencies: manifest.dependencies,
    dependencyVersions: manifest.dependencyVersions,
  });
};

const updateOrbRaw = (raw: string, dependencies: Record<string, string>): string => {
  const range = readScalarRange(raw);
  const orb = readOrbReference(raw);
  const hasOrbReference = range && orb;
  if (!hasOrbReference) return raw;

  const version = dependencies[orb[0]];
  if (!version) return raw;

  return updateScalarRange(raw, range, `${orb[0]}@${version}`);
};

const updateCircleCILine = (
  state: CircleCIWriteState,
  line: string,
  dependencies: Record<string, string>,
): { line: string; state: CircleCIWriteState } => {
  const field = readYamlFieldLine(line);
  const exited = exitsBlock(state.inOrbs, state.orbsIndent, line);
  const base = exited ? Object.assign({}, state, { inOrbs: false }) : state;
  const isRootField = field?.indent === 0 && !field.listItem;
  const isOrbsHeader = isRootField && field.key === "orbs";
  if (isOrbsHeader) {
    return { line, state: Object.assign({}, base, { inOrbs: true, orbsIndent: field.indent }) };
  }

  const imageLine = line.match(/^(\s*-\s+image\s*:\s*)(.*)$/);
  if (imageLine) {
    return {
      line: `${imageLine[1]}${updateTaggedImageRaw(imageLine[2], dependencies)}`,
      state: base,
    };
  }

  const isOrbField = base.inOrbs && field && !field.listItem;
  const updatedLine = isOrbField
    ? `${line.slice(0, line.length - field.raw.length)}${updateOrbRaw(field.raw, dependencies)}`
    : line;
  return { line: updatedLine, state: base };
};

export class CircleCIProvider implements DependencyProvider {
  readonly language = LANGUAGES.CIRCLECI;
  readonly capabilities = {
    supportsLatestResolution: false,
    supportsPreciseMode: false,
    versionStrategy: "exact",
  } as const;

  async getLatestVersion(): Promise<string> {
    return manifestOnlyResolution("CircleCI");
  }

  async getAllVersions(): Promise<string[]> {
    return manifestOnlyResolution("CircleCI");
  }

  readManifest(filePath: string): DependencyManifest {
    const manifest = emptyInfraManifest(filePath);
    const initialState = { dependencies: {}, inOrbs: false, orbsIndent: -1 };
    readFileSync(filePath, "utf8")
      .split("\n")
      .reduce((state, line) => readCircleCILine(manifest, state, line), initialState);
    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    let state = { inOrbs: false, orbsIndent: -1 };
    const lines = readFileSync(filePath, "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      const result = updateCircleCILine(state, line, manifest.dependencies);
      state = result.state;
      lines[index] = result.line;
    }
    const output = lines.join("\n");
    writeFileSync(filePath, output);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = CIRCLECI_PATTERNS.PACKAGE_NAME.test(packageName);
    return isValid;
  }
}
