import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatAsJSON, formatAsMarkdown, formatAsTable, format } from "../../../src/dx/report";
import { createAnsiPattern } from "../../../src/dx/constants";
import type { DependencyInfo } from "../../../src/types";

const stripAnsi = (str: string): string => str.replace(createAnsiPattern(), "");

describe("formatAsJSON", () => {
  it("should format dependencies as JSON with outdated status", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.status, "outdated");
    assert.strictEqual(parsed.exitCode, 1);
    assert.strictEqual(parsed.dependencies.length, 2);
    assert.strictEqual(parsed.summary.totalPackages, 2);
    assert.strictEqual(parsed.summary.outdated, 1);
    assert.strictEqual(parsed.summary.upToDate, 1);
  });

  it("should format dependencies as JSON with up-to-date status", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.status, "up-to-date");
    assert.strictEqual(parsed.exitCode, 0);
    assert.strictEqual(parsed.summary.outdated, 0);
    assert.strictEqual(parsed.summary.upToDate, 2);
  });

  it("should include duration when provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies, 1500);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.summary.duration, 1500);
  });

  it("should not include duration when not provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.summary.duration, undefined);
  });

  it("should mark dependencies with isPinned", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: true },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].isPinned, true);
  });

  it("should default isPinned to false when not provided", () => {
    const dependencies: DependencyInfo[] = [{ name: "react", current: "17.0.0", latest: "18.0.0" }];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].isPinned, false);
  });

  it("should determine major version severity", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].severity, "major");
  });

  it("should determine minor version severity", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].severity, "minor");
  });

  it("should determine patch version severity", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].severity, "patch");
  });

  it("should determine unknown severity for same versions", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].severity, "unknown");
  });

  it("should handle version prefixes", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "^17.0.0", latest: "^18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].severity, "major");
  });

  it("should mark canAutoUpdate true for outdated deps", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].canAutoUpdate, true);
  });

  it("should mark canAutoUpdate false for up-to-date deps", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.dependencies[0].canAutoUpdate, false);
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = formatAsJSON(dependencies);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.status, "up-to-date");
    assert.strictEqual(parsed.exitCode, 0);
    assert.deepStrictEqual(parsed.dependencies, []);
    assert.strictEqual(parsed.summary.totalPackages, 0);
    assert.strictEqual(parsed.summary.outdated, 0);
    assert.strictEqual(parsed.summary.upToDate, 0);
  });
});

describe("formatAsMarkdown", () => {
  it("should format outdated dependencies as markdown", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("# Dependency Status"));
    assert.ok(result.includes("## ▲ Outdated Dependencies (1)"));
    assert.ok(result.includes("| Package | Current | Latest | Severity |"));
    assert.ok(result.includes("| react | 17.0.0 | 18.0.0 | ● major |"));
    assert.ok(result.includes("## ✓ Up-to-date Dependencies (1)"));
    assert.ok(result.includes("- lodash @ 4.17.21"));
  });

  it("should format only up-to-date dependencies", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("# Dependency Status"));
    assert.ok(result.includes("## ✓ Up-to-date Dependencies (1)"));
    assert.ok(!result.includes("▲ Outdated Dependencies"));
  });

  it("should include summary section", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("## Summary"));
    assert.ok(result.includes("- Total packages: 2"));
    assert.ok(result.includes("- Outdated: 1"));
    assert.ok(result.includes("- Up-to-date: 1"));
  });

  it("should include duration when provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies, 2500);

    assert.ok(result.includes("- Duration: 2500ms"));
  });

  it("should not include duration when not provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(!result.includes("Duration:"));
  });

  it("should use correct severity emojis for major", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("● major"));
  });

  it("should use correct severity emojis for minor", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("● minor"));
  });

  it("should use correct severity emojis for patch", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("● patch"));
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("# Dependency Status"));
    assert.ok(result.includes("## Summary"));
    assert.ok(result.includes("- Total packages: 0"));
  });

  it("should format multiple outdated dependencies", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "vue", current: "2.6.0", latest: "3.0.0", isPinned: false },
      { name: "angular", current: "12.0.0", latest: "13.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.ok(result.includes("## ▲ Outdated Dependencies (3)"));
    assert.ok(result.includes("| react | 17.0.0 | 18.0.0 | ● major |"));
    assert.ok(result.includes("| vue | 2.6.0 | 3.0.0 | ● major |"));
    assert.ok(result.includes("| angular | 12.0.0 | 13.0.0 | ● major |"));
  });
});

describe("formatAsTable", () => {
  it("should format outdated dependencies as table", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("▲  Outdated Dependencies:"));
    assert.ok(result.includes("Package"));
    assert.ok(result.includes("Current"));
    assert.ok(result.includes("Latest"));
    assert.ok(result.includes("Severity"));
    assert.ok(result.includes("react"));
    assert.ok(result.includes("17.0.0"));
    assert.ok(result.includes("18.0.0"));
    assert.ok(result.includes("● major"));
    assert.ok(result.includes("1 outdated of 2 total"));
  });

  it("should show success message when all up-to-date", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("All dependencies are up-to-date!"));
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("All dependencies are up-to-date!"));
  });

  it("should use correct severity indicators for major", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("● major"));
  });

  it("should use correct severity indicators for minor", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("● minor"));
  });

  it("should use correct severity indicators for patch", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("● patch"));
  });

  it("should align columns correctly with varying lengths", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "very-long-package-name", current: "1.2.3", latest: "2.0.0", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("very-long-package-name"));
    assert.ok(result.includes("react"));
    assert.ok(result.includes("2 outdated of 2 total"));
  });

  it("should show count summary", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "vue", current: "2.0.0", latest: "3.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.ok(result.includes("2 outdated of 3 total"));
  });
});

describe("format", () => {
  const dependencies: DependencyInfo[] = [
    { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
  ];

  it("should format as JSON when type is json", () => {
    const result = format(dependencies, "json");
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.status, "outdated");
    assert.notStrictEqual(parsed.dependencies, undefined);
  });

  it("should format as markdown when type is markdown", () => {
    const result = format(dependencies, "markdown");

    assert.ok(result.includes("# Dependency Status"));
    assert.ok(result.includes("| Package | Current | Latest | Severity |"));
  });

  it("should format as table when type is table", () => {
    const result = stripAnsi(format(dependencies, "table"));

    assert.ok(result.includes("▲  Outdated Dependencies:"));
    assert.ok(result.includes("Package"));
  });

  it("should default to table format", () => {
    const result = stripAnsi(format(dependencies));

    assert.ok(result.includes("▲  Outdated Dependencies:"));
    assert.ok(result.includes("Package"));
  });

  it("should pass duration to JSON formatter", () => {
    const result = format(dependencies, "json", 3000);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.summary.duration, 3000);
  });

  it("should pass duration to markdown formatter", () => {
    const result = format(dependencies, "markdown", 3000);

    assert.ok(result.includes("- Duration: 3000ms"));
  });

  it("should not pass duration to table formatter", () => {
    const result = format(dependencies, "table", 3000);

    assert.ok(!result.includes("Duration"));
    assert.ok(!result.includes("3000"));
  });

  it("should handle all formats with empty dependencies", () => {
    const emptyDeps: DependencyInfo[] = [];

    const jsonResult = format(emptyDeps, "json");
    const markdownResult = format(emptyDeps, "markdown");
    const tableResult = format(emptyDeps, "table");

    assert.strictEqual(JSON.parse(jsonResult).status, "up-to-date");
    assert.ok(markdownResult.includes("# Dependency Status"));
    assert.ok(stripAnsi(tableResult).includes("✓ All dependencies are up-to-date!"));
  });
});
