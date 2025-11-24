import { describe, it, expect } from "bun:test";
import {
  formatAsJSON,
  formatAsMarkdown,
  formatAsTable,
  format,
} from "../../../src/utils/formatters";
import type { DependencyInfo } from "../../../src/types";

describe("formatAsJSON", () => {
  it("should format dependencies as JSON with outdated status", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("outdated");
    expect(parsed.exitCode).toBe(1);
    expect(parsed.dependencies).toHaveLength(2);
    expect(parsed.summary.totalPackages).toBe(2);
    expect(parsed.summary.outdated).toBe(1);
    expect(parsed.summary.upToDate).toBe(1);
  });

  it("should format dependencies as JSON with up-to-date status", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("up-to-date");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.summary.outdated).toBe(0);
    expect(parsed.summary.upToDate).toBe(2);
  });

  it("should include duration when provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies, 1500);
    const parsed = JSON.parse(result);

    expect(parsed.summary.duration).toBe(1500);
  });

  it("should not include duration when not provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.summary.duration).toBeUndefined();
  });

  it("should mark dependencies with isPinned", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: true },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].isPinned).toBe(true);
  });

  it("should default isPinned to false when not provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0" },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].isPinned).toBe(false);
  });

  it("should determine major version severity", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].severity).toBe("major");
  });

  it("should determine minor version severity", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].severity).toBe("minor");
  });

  it("should determine patch version severity", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].severity).toBe("patch");
  });

  it("should determine unknown severity for same versions", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].severity).toBe("unknown");
  });

  it("should handle version prefixes", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "^17.0.0", latest: "^18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].severity).toBe("major");
  });

  it("should mark canAutoUpdate true for outdated deps", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].canAutoUpdate).toBe(true);
  });

  it("should mark canAutoUpdate false for up-to-date deps", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.dependencies[0].canAutoUpdate).toBe(false);
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("up-to-date");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.dependencies).toEqual([]);
    expect(parsed.summary.totalPackages).toBe(0);
    expect(parsed.summary.outdated).toBe(0);
    expect(parsed.summary.upToDate).toBe(0);
  });
});

describe("formatAsMarkdown", () => {
  it("should format outdated dependencies as markdown", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("# Dependency Status");
    expect(result).toContain("## ⚠️ Outdated Dependencies (1)");
    expect(result).toContain("| Package | Current | Latest | Severity |");
    expect(result).toContain("| react | 17.0.0 | 18.0.0 | 🔴 major |");
    expect(result).toContain("## ✅ Up-to-date Dependencies (1)");
    expect(result).toContain("- lodash @ 4.17.21");
  });

  it("should format only up-to-date dependencies", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("# Dependency Status");
    expect(result).toContain("## ✅ Up-to-date Dependencies (1)");
    expect(result).not.toContain("⚠️ Outdated Dependencies");
  });

  it("should include summary section", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("## Summary");
    expect(result).toContain("- Total packages: 2");
    expect(result).toContain("- Outdated: 1");
    expect(result).toContain("- Up-to-date: 1");
  });

  it("should include duration when provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies, 2500);

    expect(result).toContain("- Duration: 2500ms");
  });

  it("should not include duration when not provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).not.toContain("Duration:");
  });

  it("should use correct severity emojis for major", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("🔴 major");
  });

  it("should use correct severity emojis for minor", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("🟡 minor");
  });

  it("should use correct severity emojis for patch", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("🟢 patch");
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("# Dependency Status");
    expect(result).toContain("## Summary");
    expect(result).toContain("- Total packages: 0");
  });

  it("should format multiple outdated dependencies", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "vue", current: "2.6.0", latest: "3.0.0", isPinned: false },
      { name: "angular", current: "12.0.0", latest: "13.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    expect(result).toContain("## ⚠️ Outdated Dependencies (3)");
    expect(result).toContain("| react | 17.0.0 | 18.0.0 | 🔴 major |");
    expect(result).toContain("| vue | 2.6.0 | 3.0.0 | 🔴 major |");
    expect(result).toContain("| angular | 12.0.0 | 13.0.0 | 🔴 major |");
  });
});

describe("formatAsTable", () => {
  it("should format outdated dependencies as table", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsTable(dependencies);

    expect(result).toContain("⚠️  Outdated Dependencies:");
    expect(result).toContain("Package");
    expect(result).toContain("Current");
    expect(result).toContain("Latest");
    expect(result).toContain("Severity");
    expect(result).toContain("react");
    expect(result).toContain("17.0.0");
    expect(result).toContain("18.0.0");
    expect(result).toContain("🔴 major");
    expect(result).toContain("1 outdated of 2 total");
  });

  it("should show success message when all up-to-date", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsTable(dependencies);

    expect(result).toBe("✅ All dependencies are up-to-date!\n");
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = formatAsTable(dependencies);

    expect(result).toBe("✅ All dependencies are up-to-date!\n");
  });

  it("should use correct severity indicators for major", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsTable(dependencies);

    expect(result).toContain("🔴 major");
  });

  it("should use correct severity indicators for minor", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = formatAsTable(dependencies);

    expect(result).toContain("🟡 minor");
  });

  it("should use correct severity indicators for patch", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = formatAsTable(dependencies);

    expect(result).toContain("🟢 patch");
  });

  it("should align columns correctly with varying lengths", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "very-long-package-name", current: "1.2.3", latest: "2.0.0", isPinned: false },
    ];

    const result = formatAsTable(dependencies);

    expect(result).toContain("very-long-package-name");
    expect(result).toContain("react");
    expect(result).toContain("2 outdated of 2 total");
  });

  it("should show count summary", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "vue", current: "2.0.0", latest: "3.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsTable(dependencies);

    expect(result).toContain("2 outdated of 3 total");
  });
});

describe("format", () => {
  const dependencies: DependencyInfo[] = [
    { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
  ];

  it("should format as JSON when type is json", () => {
    const result = format(dependencies, "json");
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("outdated");
    expect(parsed.dependencies).toBeDefined();
  });

  it("should format as markdown when type is markdown", () => {
    const result = format(dependencies, "markdown");

    expect(result).toContain("# Dependency Status");
    expect(result).toContain("| Package | Current | Latest | Severity |");
  });

  it("should format as table when type is table", () => {
    const result = format(dependencies, "table");

    expect(result).toContain("⚠️  Outdated Dependencies:");
    expect(result).toContain("Package");
  });

  it("should default to table format", () => {
    const result = format(dependencies);

    expect(result).toContain("⚠️  Outdated Dependencies:");
    expect(result).toContain("Package");
  });

  it("should pass duration to JSON formatter", () => {
    const result = format(dependencies, "json", 3000);
    const parsed = JSON.parse(result);

    expect(parsed.summary.duration).toBe(3000);
  });

  it("should pass duration to markdown formatter", () => {
    const result = format(dependencies, "markdown", 3000);

    expect(result).toContain("- Duration: 3000ms");
  });

  it("should not pass duration to table formatter", () => {
    const result = format(dependencies, "table", 3000);

    expect(result).not.toContain("Duration");
    expect(result).not.toContain("3000");
  });

  it("should handle all formats with empty dependencies", () => {
    const emptyDeps: DependencyInfo[] = [];

    const jsonResult = format(emptyDeps, "json");
    const markdownResult = format(emptyDeps, "markdown");
    const tableResult = format(emptyDeps, "table");

    expect(JSON.parse(jsonResult).status).toBe("up-to-date");
    expect(markdownResult).toContain("# Dependency Status");
    expect(tableResult).toContain("✅ All dependencies are up-to-date!");
  });
});
