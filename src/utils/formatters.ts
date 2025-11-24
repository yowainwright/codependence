import type { DependencyInfo } from "../types";

export interface FormattedOutput {
  status: "outdated" | "up-to-date";
  exitCode: number;
  dependencies: Array<{
    package: string;
    current: string;
    latest: string;
    isPinned: boolean;
    severity: "major" | "minor" | "patch" | "unknown";
    canAutoUpdate: boolean;
  }>;
  summary: {
    totalPackages: number;
    outdated: number;
    upToDate: number;
    duration?: number;
  };
}

const getSeverity = (
  current: string,
  latest: string,
): "major" | "minor" | "patch" | "unknown" => {
  const currentParts = current.replace(/[^0-9.]/g, "").split(".");
  const latestParts = latest.replace(/[^0-9.]/g, "").split(".");

  if (currentParts[0] !== latestParts[0]) return "major";
  if (currentParts[1] !== latestParts[1]) return "minor";
  if (currentParts[2] !== latestParts[2]) return "patch";
  return "unknown";
};

export const formatAsJSON = (
  dependencies: DependencyInfo[],
  duration?: number,
): string => {
  const outdatedDeps = dependencies.filter((dep) => dep.current !== dep.latest);
  const hasOutdated = outdatedDeps.length > 0;

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
    summary: {
      totalPackages: dependencies.length,
      outdated: outdatedDeps.length,
      upToDate: dependencies.length - outdatedDeps.length,
      ...(duration ? { duration } : {}),
    },
  };

  return JSON.stringify(formatted, null, 2);
};

export const formatAsMarkdown = (
  dependencies: DependencyInfo[],
  duration?: number,
): string => {
  const outdatedDeps = dependencies.filter((dep) => dep.current !== dep.latest);
  const hasOutdated = outdatedDeps.length > 0;

  const lines: string[] = [];
  lines.push("# Dependency Status\n");

  if (hasOutdated) {
    lines.push(`## ⚠️ Outdated Dependencies (${outdatedDeps.length})\n`);
    lines.push("| Package | Current | Latest | Severity |");
    lines.push("|---------|---------|--------|----------|");

    outdatedDeps.forEach((dep) => {
      const severity = getSeverity(dep.current, dep.latest);
      const severityEmoji =
        severity === "major" ? "🔴" : severity === "minor" ? "🟡" : "🟢";
      lines.push(
        `| ${dep.name} | ${dep.current} | ${dep.latest} | ${severityEmoji} ${severity} |`,
      );
    });

    lines.push("");
  }

  const upToDateDeps = dependencies.filter(
    (dep) => dep.current === dep.latest,
  );
  const hasUpToDate = upToDateDeps.length > 0;

  if (hasUpToDate) {
    lines.push(`## ✅ Up-to-date Dependencies (${upToDateDeps.length})\n`);
    upToDateDeps.forEach((dep) => {
      lines.push(`- ${dep.name} @ ${dep.current}`);
    });
    lines.push("");
  }

  lines.push("## Summary\n");
  lines.push(`- Total packages: ${dependencies.length}`);
  lines.push(`- Outdated: ${outdatedDeps.length}`);
  lines.push(`- Up-to-date: ${upToDateDeps.length}`);
  if (duration) {
    lines.push(`- Duration: ${duration}ms`);
  }

  return lines.join("\n");
};

export const formatAsTable = (dependencies: DependencyInfo[]): string => {
  const outdatedDeps = dependencies.filter((dep) => dep.current !== dep.latest);
  const hasOutdated = outdatedDeps.length > 0;

  if (!hasOutdated) {
    return "✅ All dependencies are up-to-date!\n";
  }

  const lines: string[] = [];
  lines.push("\n⚠️  Outdated Dependencies:\n");

  const maxNameLength = Math.max(
    ...outdatedDeps.map((dep) => dep.name.length),
    10,
  );
  const maxCurrentLength = Math.max(
    ...outdatedDeps.map((dep) => dep.current.length),
    7,
  );
  const maxLatestLength = Math.max(
    ...outdatedDeps.map((dep) => dep.latest.length),
    6,
  );

  const header = `  ${"Package".padEnd(maxNameLength)}  ${"Current".padEnd(maxCurrentLength)}  ${"Latest".padEnd(maxLatestLength)}  Severity`;
  lines.push(header);
  lines.push("  " + "─".repeat(header.length - 2));

  outdatedDeps.forEach((dep) => {
    const severity = getSeverity(dep.current, dep.latest);
    const severityDisplay =
      severity === "major" ? "🔴 major" : severity === "minor" ? "🟡 minor" : "🟢 patch";
    lines.push(
      `  ${dep.name.padEnd(maxNameLength)}  ${dep.current.padEnd(maxCurrentLength)}  ${dep.latest.padEnd(maxLatestLength)}  ${severityDisplay}`,
    );
  });

  lines.push(
    `\n  ${outdatedDeps.length} outdated of ${dependencies.length} total\n`,
  );

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
