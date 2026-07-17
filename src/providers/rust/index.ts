import { readFileSync, writeFileSync } from "fs";
import { exec } from "../../utils/exec";
import { LANGUAGES } from "../constants";
import type {
  CargoAssignment,
  CargoInlineField,
  CargoManifestLineResult,
  CargoSectionTarget,
  CargoValueRange,
  DependencyManifest,
  DependencyProvider,
  ProviderOptions,
} from "../types";
import { CARGO_PACKAGE_MANAGER } from "./constants";

const emptyManifest = (filePath: string): DependencyManifest => {
  const manifest = {
    filePath,
    dependencies: {},
    devDependencies: {},
  };
  return manifest;
};

const parseCargoSection = (section: string): CargoSectionTarget | null => {
  if (section === "dependencies") {
    return "dependencies";
  }
  if (section === "dev-dependencies") {
    return "devDependencies";
  }
  if (section === "build-dependencies") {
    return "devDependencies";
  }
  if (section.endsWith(".dependencies")) {
    return "dependencies";
  }
  if (section.endsWith(".dev-dependencies")) {
    return "devDependencies";
  }
  if (section.endsWith(".build-dependencies")) {
    return "devDependencies";
  }
  return null;
};

const isCargoNameCharacter = (char: string): boolean => {
  const isLowercase = char >= "a" && char <= "z";
  const isUppercase = char >= "A" && char <= "Z";
  const isDigit = char >= "0" && char <= "9";
  const isLetter = isLowercase || isUppercase;
  const isSeparator = char === "_" || char === "-";
  return isLetter || isDigit || isSeparator;
};

const isCargoPackageName = (packageName: string): boolean =>
  packageName.length > 0 && packageName.split("").every(isCargoNameCharacter);

const countLeadingWhitespace = (value: string): number => {
  let index = 0;
  while (value[index] === " " || value[index] === "\t") index++;
  return index;
};

const readCargoSectionName = (line: string): string | null => {
  const trimmed = line.trim();
  const hasSectionBrackets = trimmed.startsWith("[") && trimmed.endsWith("]");
  if (!hasSectionBrackets) return null;

  return trimmed.slice(1, -1).trim();
};

const readCargoKeyName = (key: string): string | null => {
  const trimmed = key.trim();
  const isQuoted = trimmed.startsWith('"') && trimmed.endsWith('"');
  const name = isQuoted ? trimmed.slice(1, -1) : trimmed;

  return isCargoPackageName(name) ? name : null;
};

const readQuotedCargoValueRange = (source: string): CargoValueRange | null => {
  if (!source.startsWith('"')) return null;

  const quoteEnd = source.indexOf('"', 1);
  if (quoteEnd === -1) return null;

  return {
    value: source.slice(0, quoteEnd + 1),
    suffix: source.slice(quoteEnd + 1),
  };
};

const readInlineCargoValueRange = (source: string): CargoValueRange | null => {
  if (!source.startsWith("{")) return null;

  const tableEnd = source.indexOf("}");
  if (tableEnd === -1) return null;

  return {
    value: source.slice(0, tableEnd + 1),
    suffix: source.slice(tableEnd + 1),
  };
};

const readCargoValueRange = (source: string): CargoValueRange | null =>
  readQuotedCargoValueRange(source) || readInlineCargoValueRange(source);

const parseCargoAssignmentLine = (line: string): CargoAssignment | null => {
  const equalsIndex = line.indexOf("=");
  if (equalsIndex === -1) return null;

  const aliasName = readCargoKeyName(line.slice(0, equalsIndex));
  if (!aliasName) return null;

  const afterEquals = line.slice(equalsIndex + 1);
  const valueStart = equalsIndex + 1 + countLeadingWhitespace(afterEquals);
  const range = readCargoValueRange(line.slice(valueStart));
  if (!range) return null;

  return {
    aliasName,
    prefix: line.slice(0, valueStart),
    value: range.value,
    suffix: range.suffix,
  };
};

const parseInlineField = (part: string): CargoInlineField | null => {
  const equalsIndex = part.indexOf("=");
  if (equalsIndex === -1) return null;

  const name = part.slice(0, equalsIndex).replaceAll("{", "").trim();
  if (!isCargoPackageName(name)) return null;

  const afterEquals = part.slice(equalsIndex + 1);
  const quoteStartOffset = afterEquals.indexOf('"');
  if (quoteStartOffset === -1) return null;

  const quoteStart = equalsIndex + 1 + quoteStartOffset;
  const quoteEnd = part.indexOf('"', quoteStart + 1);
  if (quoteEnd === -1) return null;

  return {
    name,
    value: part.slice(quoteStart + 1, quoteEnd),
    quoteStart,
    quoteEnd,
  };
};

const isInlineField = (field: CargoInlineField | null): field is CargoInlineField => field !== null;

const inlineFields = (value: string): CargoInlineField[] =>
  value.split(",").map(parseInlineField).filter(isInlineField);

const readInlineStringField = (value: string, field: string): string | null => {
  const found = inlineFields(value).find((candidate) => candidate.name === field);
  return found?.value || null;
};

const replaceInlinePart = (part: string, field: string, replacement: string): string => {
  const parsed = parseInlineField(part);
  if (!parsed) return part;
  if (parsed.name !== field) return part;

  return `${part.slice(0, parsed.quoteStart + 1)}${replacement}${part.slice(parsed.quoteEnd)}`;
};

const replaceInlineStringField = (
  value: string,
  field: string,
  replacement: string,
): string | null => {
  const parts = value.split(",");
  const updatedParts = parts.map((part) => replaceInlinePart(part, field, replacement));
  const hasUpdatedPart = updatedParts.some((part, index) => part !== parts[index]);

  return hasUpdatedPart ? updatedParts.join(",") : null;
};

const isLocalCargoDependency = (value: string): boolean =>
  readInlineStringField(value, "git") !== null || readInlineStringField(value, "path") !== null;

const readCargoDependencyVersion = (value: string): string | null => {
  if (isLocalCargoDependency(value)) return null;

  if (value.startsWith('"')) {
    const quotedVersion = value.slice(1, -1);
    return quotedVersion;
  }

  return readInlineStringField(value, "version");
};

const readCargoPackageName = (name: string, value: string): string => {
  return readInlineStringField(value, "package") || name;
};

const parseCargoDependencyLine = (line: string): readonly [string, string] | null => {
  const assignment = parseCargoAssignmentLine(line);
  if (!assignment) return null;

  const version = readCargoDependencyVersion(assignment.value);
  if (!version) return null;

  const packageName = readCargoPackageName(assignment.aliasName, assignment.value);
  const parsed = [packageName, version] as const;
  return parsed;
};

const assignDependency = (
  manifest: DependencyManifest,
  target: CargoSectionTarget,
  name: string,
  version: string,
): void => {
  const targetDependencies = manifest[target] || {};
  targetDependencies[name] = version;
  manifest[target] = targetDependencies;
};

export const normalizeCargoPackageName = (packageName: string): string =>
  packageName.replaceAll("_", "-");

const cargoPackageNamesMatch = (left: string, right: string): boolean =>
  normalizeCargoPackageName(left) === normalizeCargoPackageName(right);

const readLatestCargoVersion = (stdout: string, packageName: string): string => {
  for (const line of stdout.split("\n")) {
    const assignment = parseCargoAssignmentLine(line);
    if (!assignment) continue;
    if (!cargoPackageNamesMatch(assignment.aliasName, packageName)) continue;

    const latestVersion = readCargoDependencyVersion(assignment.value);
    if (latestVersion) return latestVersion;
  }

  return "";
};

const updateCargoDependencyValue = (value: string, version: string): string | null => {
  if (isLocalCargoDependency(value)) return null;

  if (value.startsWith('"')) {
    const quotedVersion = `"${version}"`;
    return quotedVersion;
  }

  return replaceInlineStringField(value, "version", version);
};

export const updateCargoDependencyLine = (
  line: string,
  dependencies: Record<string, string>,
): string => {
  const assignment = parseCargoAssignmentLine(line);
  if (!assignment) return line;

  const { aliasName, value, prefix, suffix } = assignment;
  const packageName = readCargoPackageName(aliasName, value);
  const version = dependencies[packageName] || dependencies[aliasName];
  if (!version) return line;

  const updatedValue = updateCargoDependencyValue(value, version);
  if (!updatedValue) return line;

  const updatedLine = `${prefix}${updatedValue}${suffix}`;
  return updatedLine;
};

const updateCargoLine = (
  line: string,
  section: CargoSectionTarget | null,
  manifest: DependencyManifest,
): string => {
  if (!section) return line;

  const dependencies = manifest[section] || {};
  const updatedLine = updateCargoDependencyLine(line, dependencies);
  return updatedLine;
};

const readCargoManifestLine = (
  manifest: DependencyManifest,
  currentSection: CargoSectionTarget | null,
  line: string,
): CargoSectionTarget | null => {
  const sectionName = readCargoSectionName(line);
  if (sectionName) return parseCargoSection(sectionName);
  if (!currentSection) return currentSection;

  const parsed = parseCargoDependencyLine(line);
  if (!parsed) return currentSection;

  const [name, version] = parsed;
  assignDependency(manifest, currentSection, name, version);
  return currentSection;
};

const updateCargoManifestLine = (
  line: string,
  currentSection: CargoSectionTarget | null,
  manifest: DependencyManifest,
): CargoManifestLineResult => {
  const sectionName = readCargoSectionName(line);
  const nextSection = sectionName ? parseCargoSection(sectionName) : currentSection;
  const updatedLine = sectionName ? line : updateCargoLine(line, currentSection, manifest);

  return { line: updatedLine, currentSection: nextSection };
};

export class RustProvider implements DependencyProvider {
  readonly language = LANGUAGES.RUST;
  readonly capabilities = {
    supportsLatestResolution: true,
    supportsPreciseMode: true,
    versionStrategy: "semver",
  } as const;

  constructor(_options: ProviderOptions = {}) {}

  normalizePackageName(packageName: string): string {
    return normalizeCargoPackageName(packageName);
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const args = ["search", packageName, "--limit", "1"];
    const result = await exec(CARGO_PACKAGE_MANAGER, args);
    const latestVersion = readLatestCargoVersion(result.stdout, packageName);
    return latestVersion;
  }

  async getAllVersions(_packageName: string): Promise<string[]> {
    const versions: string[] = [];
    return versions;
  }

  readManifest(filePath: string): DependencyManifest {
    const manifest = emptyManifest(filePath);
    let currentSection: CargoSectionTarget | null = null;
    const content = readFileSync(filePath, "utf8");

    content.split("\n").forEach((line) => {
      currentSection = readCargoManifestLine(manifest, currentSection, line);
    });

    return manifest;
  }

  writeManifest(filePath: string, manifest: DependencyManifest): void {
    let currentSection: CargoSectionTarget | null = null;
    const content = readFileSync(filePath, "utf8");
    const updatedLines: string[] = [];

    content.split("\n").forEach((line) => {
      const result = updateCargoManifestLine(line, currentSection, manifest);
      currentSection = result.currentSection;
      updatedLines.push(result.line);
    });

    const updated = updatedLines.join("\n");
    writeFileSync(filePath, updated);
  }

  validatePackageName(packageName: string): boolean {
    const isValid = isCargoPackageName(packageName);
    return isValid;
  }
}
