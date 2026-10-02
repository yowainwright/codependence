import type { DependencyInfo } from "../../types";
import { RAW_SYMBOLS, SYMBOLS } from "./constants";
import type { FormattedDependency, FormattedOutput } from "./types";

export {
  findSimilarPackages,
  formatEnhancedError,
  formatGenericError,
  formatNetworkError,
  formatPrivatePackageError,
  formatRegistryError,
  formatTimeoutError,
  formatValidationError,
  getSuggestionForPackage,
  hasRegistryInError,
  isPrivatePackage,
  isTimeout,
} from "./utils";
import {
  countUnchecked,
  hasSecurityData,
  hasVulnerabilities,
  securityFixHint,
  securitySummary,
  securityUncheckedNote,
  upToDateSecurityNote,
} from "./utils";
export type { ErrorContext, FormattedDependency, FormattedOutput, FormattedSummary } from "./types";

const getSeverity = (current: string, latest: string): "major" | "minor" | "patch" | "unknown" => {
  const currentParts = current.replace(/[^0-9.]/g, "").split(".");
  const latestParts = latest.replace(/[^0-9.]/g, "").split(".");

  if (currentParts[0] !== latestParts[0]) return "major";
  if (currentParts[1] !== latestParts[1]) return "minor";
  if (currentParts[2] !== latestParts[2]) return "patch";
  return "unknown";
};

const getSeverityIcon = (severity: "major" | "minor" | "patch" | "unknown"): string => {
  if (severity === "major") return RAW_SYMBOLS.severityMajor;
  if (severity === "minor") return RAW_SYMBOLS.severityMinor;
  return RAW_SYMBOLS.severityPatch;
};

const partitionDependencies = (
  dependencies: DependencyInfo[],
): [DependencyInfo[], DependencyInfo[]] =>
  dependencies.reduce<[DependencyInfo[], DependencyInfo[]]>(
    (groups, dependency) => {
      const [outdated, upToDate] = groups;
      const isUpToDate = dependency.current === dependency.latest;
      return isUpToDate
        ? [outdated, upToDate.concat(dependency)]
        : [outdated.concat(dependency), upToDate];
    },
    [[], []],
  );

const securityFields = ({ security }: DependencyInfo): Partial<FormattedDependency> => {
  if (!security) return {};
  if (!security.checked) return { securityStatus: "not-checked" };
  return { securityStatus: "checked", vulnerabilities: security.vulnerabilities };
};

export const formatAsJSON = (dependencies: DependencyInfo[], duration?: number): string => {
  const [outdatedDeps] = partitionDependencies(dependencies);
  const hasOutdated = outdatedDeps.length > 0;
  const durationSummary = duration ? { duration } : {};
  const summary = Object.assign(
    {
      totalPackages: dependencies.length,
      outdated: outdatedDeps.length,
      upToDate: dependencies.length - outdatedDeps.length,
    },
    durationSummary,
  );

  const formatted: FormattedOutput = {
    status: hasOutdated ? "outdated" : "up-to-date",
    exitCode: hasOutdated ? 1 : 0,
    dependencies: dependencies.map((dep) => ({
      package: dep.name,
      current: dep.current,
      latest: dep.latest,
      isPinned: dep.isPinned || false,
      severity: getSeverity(dep.current, dep.latest),
      canAutoUpdate: dep.current !== dep.latest,
      ...securityFields(dep),
    })),
    summary,
  };

  return JSON.stringify(formatted, null, 2);
};

const markdownOutdatedLines = (outdatedDeps: DependencyInfo[], showSecurity: boolean): string[] => {
  if (outdatedDeps.length === 0) return [];
  const securityHeader = showSecurity ? " Security |" : "";
  const securityRule = showSecurity ? "----------|" : "";
  const rows = outdatedDeps.map((dep) => {
    const severity = getSeverity(dep.current, dep.latest);
    const securityCell = showSecurity ? ` ${securitySummary(dep)} |` : "";
    return `| ${dep.name} | ${dep.current} | ${dep.latest} | ${getSeverityIcon(severity)} ${severity} |${securityCell}`;
  });
  return [
    `## ${RAW_SYMBOLS.warning} Outdated Dependencies (${outdatedDeps.length})\n`,
    `| Package | Current | Latest | Severity |${securityHeader}`,
    `|---------|---------|--------|----------|${securityRule}`,
  ].concat(rows, "");
};

const markdownUpToDateLines = (upToDateDeps: DependencyInfo[]): string[] => {
  if (upToDateDeps.length === 0) return [];
  const lines = upToDateDeps.map(
    (dep) => `- ${dep.name} @ ${dep.current}${upToDateSecurityNote(dep)}`,
  );
  return [`## ${RAW_SYMBOLS.success} Up-to-date Dependencies (${upToDateDeps.length})\n`].concat(
    lines,
    "",
  );
};

export const formatAsMarkdown = (dependencies: DependencyInfo[], duration?: number): string => {
  const [outdatedDeps, upToDateDeps] = partitionDependencies(dependencies);
  const hint = securityFixHint(dependencies);
  const hintLines = hint ? [`> ${hint}`, ""] : [];
  const durationLines = duration ? [`- Duration: ${duration}ms`] : [];
  const uncheckedCount = countUnchecked(dependencies);
  const uncheckedLines = uncheckedCount > 0 ? [`- Security not checked: ${uncheckedCount}`] : [];
  const lines = ["# Dependency Status\n"]
    .concat(
      markdownOutdatedLines(outdatedDeps, hasSecurityData(dependencies)),
      markdownUpToDateLines(upToDateDeps),
      hintLines,
    )
    .concat(
      "## Summary\n",
      `- Total packages: ${dependencies.length}`,
      `- Outdated: ${outdatedDeps.length}`,
      `- Up-to-date: ${upToDateDeps.length}`,
      uncheckedLines,
      durationLines,
    )
    .flat();

  return lines.join("\n");
};

const severityCell = (dep: DependencyInfo): string => {
  if (dep.current === dep.latest) return "up-to-date";
  const severity = getSeverity(dep.current, dep.latest);
  return `${getSeverityIcon(severity)} ${severity}`;
};

const widest = (values: string[], minimum: number): number =>
  Math.max(...values.map((value) => value.length), minimum);

export const formatAsTable = (dependencies: DependencyInfo[]): string => {
  const [outdatedDeps] = partitionDependencies(dependencies);
  const outdatedSet = new Set(outdatedDeps);
  const listedDeps = dependencies.filter((dep) => outdatedSet.has(dep) || hasVulnerabilities(dep));

  const uncheckedNote = securityUncheckedNote(dependencies);
  if (listedDeps.length === 0) {
    const noteLine = uncheckedNote ? `${uncheckedNote}\n` : "";
    return `${SYMBOLS.success} All dependencies are up-to-date!\n${noteLine}`;
  }

  const showSecurity = hasSecurityData(dependencies);
  const nameWidth = widest(
    listedDeps.map((dep) => dep.name),
    10,
  );
  const currentWidth = widest(
    listedDeps.map((dep) => dep.current),
    7,
  );
  const latestWidth = widest(
    listedDeps.map((dep) => dep.latest),
    6,
  );
  const severityWidth = showSecurity ? widest(listedDeps.map(severityCell), 8) : 0;
  const securityHeader = showSecurity ? "  Security" : "";

  const title = showSecurity ? "Outdated or vulnerable dependencies:" : "Outdated Dependencies:";
  const header = `  ${"Package".padEnd(nameWidth)}  ${"Current".padEnd(currentWidth)}  ${"Latest".padEnd(latestWidth)}  ${"Severity".padEnd(severityWidth)}${securityHeader}`;
  const dependencyLines = listedDeps.map((dep) => {
    const securityCell = showSecurity ? `  ${securitySummary(dep)}` : "";
    return `  ${dep.name.padEnd(nameWidth)}  ${dep.current.padEnd(currentWidth)}  ${dep.latest.padEnd(latestWidth)}  ${severityCell(dep).padEnd(severityWidth)}${securityCell}`;
  });
  const hint = securityFixHint(dependencies);
  const hintLines = hint ? [`  ${hint}\n`] : [];
  const noteLines = uncheckedNote ? [`  ${uncheckedNote}\n`] : [];
  const lines = [`\n${SYMBOLS.warning}  ${title}\n`, header, "  " + "─".repeat(header.length - 2)]
    .concat(dependencyLines)
    .concat(`\n  ${outdatedDeps.length} outdated of ${dependencies.length} total\n`)
    .concat(noteLines, hintLines);

  return lines.join("\n");
};

export const format = (
  dependencies: DependencyInfo[],
  formatType: "json" | "markdown" | "table" = "table",
  duration?: number,
): string => {
  switch (formatType) {
    case "json":
      return formatAsJSON(dependencies, duration);
    case "markdown":
      return formatAsMarkdown(dependencies, duration);
    case "table":
    default:
      return formatAsTable(dependencies);
  }
};
