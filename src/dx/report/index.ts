import type { DependencyInfo } from "../../types";
import { RAW_SYMBOLS, SYMBOLS } from "./constants";
import type { FormattedOutput } from "./types";

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
  dependencies.reduce<[DependencyInfo[], DependencyInfo[]]>((groups, dependency) => {
    const [outdated, upToDate] = groups;
    const isUpToDate = dependency.current === dependency.latest;
    return isUpToDate ? [outdated, upToDate.concat(dependency)] : [outdated.concat(dependency), upToDate];
  }, [[], []]);

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
    })),
    summary,
  };

  return JSON.stringify(formatted, null, 2);
};

export const formatAsMarkdown = (dependencies: DependencyInfo[], duration?: number): string => {
  const [outdatedDeps, upToDateDeps] = partitionDependencies(dependencies);
  const hasOutdated = outdatedDeps.length > 0;

  const outdatedLines = hasOutdated
    ? [
        `## ${RAW_SYMBOLS.warning} Outdated Dependencies (${outdatedDeps.length})\n`,
        "| Package | Current | Latest | Severity |",
        "|---------|---------|--------|----------|",
      ].concat(
        outdatedDeps.map((dep) => {
          const severity = getSeverity(dep.current, dep.latest);
          const severityIcon = getSeverityIcon(severity);
          return `| ${dep.name} | ${dep.current} | ${dep.latest} | ${severityIcon} ${severity} |`;
        }),
        "",
      )
    : [];

  const hasUpToDate = upToDateDeps.length > 0;

  const upToDateLines = hasUpToDate
    ? [
        `## ${RAW_SYMBOLS.success} Up-to-date Dependencies (${upToDateDeps.length})\n`,
      ].concat(
        upToDateDeps.map((dep) => `- ${dep.name} @ ${dep.current}`),
        "",
      )
    : [];
  const durationLines = duration ? [`- Duration: ${duration}ms`] : [];
  const lines = ["# Dependency Status\n"]
    .concat(outdatedLines, upToDateLines)
    .concat(
      "## Summary\n",
      `- Total packages: ${dependencies.length}`,
      `- Outdated: ${outdatedDeps.length}`,
      `- Up-to-date: ${upToDateDeps.length}`,
      durationLines,
    )
    .flat();

  return lines.join("\n");
};

export const formatAsTable = (dependencies: DependencyInfo[]): string => {
  const [outdatedDeps] = partitionDependencies(dependencies);
  const hasOutdated = outdatedDeps.length > 0;

  if (!hasOutdated) {
    return `${SYMBOLS.success} All dependencies are up-to-date!\n`;
  }

  const maxNameLength = Math.max(...outdatedDeps.map((dep) => dep.name.length), 10);
  const maxCurrentLength = Math.max(...outdatedDeps.map((dep) => dep.current.length), 7);
  const maxLatestLength = Math.max(...outdatedDeps.map((dep) => dep.latest.length), 6);

  const header = `  ${"Package".padEnd(maxNameLength)}  ${"Current".padEnd(maxCurrentLength)}  ${"Latest".padEnd(maxLatestLength)}  Severity`;
  const dependencyLines = outdatedDeps.map((dep) => {
    const severity = getSeverity(dep.current, dep.latest);
    const severityDisplay = `${getSeverityIcon(severity)} ${severity}`;
    return `  ${dep.name.padEnd(maxNameLength)}  ${dep.current.padEnd(maxCurrentLength)}  ${dep.latest.padEnd(maxLatestLength)}  ${severityDisplay}`;
  });
  const lines = [`\n${SYMBOLS.warning}  Outdated Dependencies:\n`, header, "  " + "─".repeat(header.length - 2)]
    .concat(dependencyLines)
    .concat(`\n  ${outdatedDeps.length} outdated of ${dependencies.length} total\n`);

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
