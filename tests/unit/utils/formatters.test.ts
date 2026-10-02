import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatAsJSON, formatAsMarkdown, formatAsTable, format } from "../../../src/dx/report";
import { createAnsiPattern } from "../../../src/dx/constants";
import type { DependencyInfo } from "../../../src/types";

const stripAnsi = (str: string): string => str.replace(createAnsiPattern(), "");

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
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

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("formatAsMarkdown", () => {
  it("should format outdated dependencies as markdown", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /# Dependency Status/);
    assert.match(result, /## ▲ Outdated Dependencies \(1\)/);
    assert.match(result, /\| Package \| Current \| Latest \| Severity \|/);
    assert.match(result, /\| react \| 17\.0\.0 \| 18\.0\.0 \| ● major \|/);
    assert.match(result, /## ✓ Up-to-date Dependencies \(1\)/);
    assert.match(result, /- lodash @ 4\.17\.21/);
  });

  it("should format only up-to-date dependencies", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /# Dependency Status/);
    assert.match(result, /## ✓ Up-to-date Dependencies \(1\)/);
    assert.doesNotMatch(result, /▲ Outdated Dependencies/);
  });

  it("should include summary section", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /## Summary/);
    assert.match(result, /- Total packages: 2/);
    assert.match(result, /- Outdated: 1/);
    assert.match(result, /- Up-to-date: 1/);
  });

  it("should include duration when provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies, 2500);

    assert.match(result, /- Duration: 2500ms/);
  });

  it("should not include duration when not provided", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.doesNotMatch(result, /Duration:/);
  });

  it("should use correct severity emojis for major", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /● major/);
  });

  it("should use correct severity emojis for minor", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /● minor/);
  });

  it("should use correct severity emojis for patch", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /● patch/);
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /# Dependency Status/);
    assert.match(result, /## Summary/);
    assert.match(result, /- Total packages: 0/);
  });

  it("should format multiple outdated dependencies", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "vue", current: "2.6.0", latest: "3.0.0", isPinned: false },
      { name: "angular", current: "12.0.0", latest: "13.0.0", isPinned: false },
    ];

    const result = formatAsMarkdown(dependencies);

    assert.match(result, /## ▲ Outdated Dependencies \(3\)/);
    assert.match(result, /\| react \| 17\.0\.0 \| 18\.0\.0 \| ● major \|/);
    assert.match(result, /\| vue \| 2\.6\.0 \| 3\.0\.0 \| ● major \|/);
    assert.match(result, /\| angular \| 12\.0\.0 \| 13\.0\.0 \| ● major \|/);
  });
});

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("formatAsTable", () => {
  it("should format outdated dependencies as table", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /▲  Outdated Dependencies:/);
    assert.match(result, /Package/);
    assert.match(result, /Current/);
    assert.match(result, /Latest/);
    assert.match(result, /Severity/);
    assert.match(result, /react/);
    assert.match(result, /17\.0\.0/);
    assert.match(result, /18\.0\.0/);
    assert.match(result, /● major/);
    assert.match(result, /1 outdated of 2 total/);
  });

  it("should show success message when all up-to-date", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /All dependencies are up-to-date!/);
  });

  it("should handle empty dependencies array", () => {
    const dependencies: DependencyInfo[] = [];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /All dependencies are up-to-date!/);
  });

  it("should use correct severity indicators for major", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /● major/);
  });

  it("should use correct severity indicators for minor", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.1.0", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /● minor/);
  });

  it("should use correct severity indicators for patch", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "18.0.0", latest: "18.0.1", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /● patch/);
  });

  it("should align columns correctly with varying lengths", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "very-long-package-name", current: "1.2.3", latest: "2.0.0", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /very-long-package-name/);
    assert.match(result, /react/);
    assert.match(result, /2 outdated of 2 total/);
  });

  it("should show count summary", () => {
    const dependencies: DependencyInfo[] = [
      { name: "react", current: "17.0.0", latest: "18.0.0", isPinned: false },
      { name: "vue", current: "2.0.0", latest: "3.0.0", isPinned: false },
      { name: "lodash", current: "4.17.21", latest: "4.17.21", isPinned: false },
    ];

    const result = stripAnsi(formatAsTable(dependencies));

    assert.match(result, /2 outdated of 3 total/);
  });
});

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
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

    assert.match(result, /# Dependency Status/);
    assert.match(result, /\| Package \| Current \| Latest \| Severity \|/);
  });

  it("should format as table when type is table", () => {
    const result = stripAnsi(format(dependencies, "table"));

    assert.match(result, /▲  Outdated Dependencies:/);
    assert.match(result, /Package/);
  });

  it("should default to table format", () => {
    const result = stripAnsi(format(dependencies));

    assert.match(result, /▲  Outdated Dependencies:/);
    assert.match(result, /Package/);
  });

  it("should pass duration to JSON formatter", () => {
    const result = format(dependencies, "json", 3000);
    const parsed = JSON.parse(result);

    assert.strictEqual(parsed.summary.duration, 3000);
  });

  it("should pass duration to markdown formatter", () => {
    const result = format(dependencies, "markdown", 3000);

    assert.match(result, /- Duration: 3000ms/);
  });

  it("should not pass duration to table formatter", () => {
    const result = format(dependencies, "table", 3000);

    assert.doesNotMatch(result, /Duration/);
    assert.doesNotMatch(result, /3000/);
  });

  it("should handle all formats with empty dependencies", () => {
    const emptyDeps: DependencyInfo[] = [];

    const jsonResult = format(emptyDeps, "json");
    const markdownResult = format(emptyDeps, "markdown");
    const tableResult = format(emptyDeps, "table");

    assert.strictEqual(JSON.parse(jsonResult).status, "up-to-date");
    assert.match(markdownResult, /# Dependency Status/);
    assert.match(stripAnsi(tableResult), /✓ All dependencies are up-to-date!/);
  });
});

const vulnerableLodash: DependencyInfo = {
  name: "lodash",
  current: "4.17.20",
  latest: "4.18.1",
  language: "nodejs",
  security: {
    checked: true,
    vulnerabilities: [
      { id: "GHSA-a", severity: "high", fixedIn: "4.17.21" },
      { id: "GHSA-b", severity: "high", fixedIn: "4.17.21" },
      { id: "GHSA-c", severity: "moderate", fixedIn: "4.18.0" },
    ],
  },
};

const vulnerableCurrent: DependencyInfo = {
  name: "request",
  current: "2.88.2",
  latest: "2.88.2",
  language: "nodejs",
  security: {
    checked: true,
    vulnerabilities: [{ id: "GHSA-d", severity: "moderate" }],
  },
};

const clean: DependencyInfo = {
  name: "left-pad",
  current: "1.3.0",
  latest: "1.3.0",
  language: "nodejs",
  security: { checked: true, vulnerabilities: [] },
};

const unchecked: DependencyInfo = {
  name: "actions/checkout",
  current: "v4",
  latest: "v5",
  language: "github-actions",
  security: { checked: false, vulnerabilities: [] },
};

const plain: DependencyInfo[] = [
  { name: "react", current: "17.0.0", latest: "18.0.0" },
  { name: "lodash", current: "4.17.21", latest: "4.17.21" },
];

it("formatAsJSON => adds security fields only when security data exists", () => {
  const parsed = JSON.parse(formatAsJSON(plain));

  parsed.dependencies.forEach((dependency: Record<string, unknown>) => {
    assert.strictEqual("securityStatus" in dependency, false);
    assert.strictEqual("vulnerabilities" in dependency, false);
  });
});

it("formatAsJSON => reports checked packages with their vulnerabilities", () => {
  const parsed = JSON.parse(formatAsJSON([vulnerableLodash, clean]));

  assert.strictEqual(parsed.dependencies[0].securityStatus, "checked");
  assert.strictEqual(parsed.dependencies[0].vulnerabilities.length, 3);
  assert.deepStrictEqual(parsed.dependencies[1].vulnerabilities, []);
});

it("formatAsJSON => omits vulnerabilities for unchecked packages", () => {
  const dependency = JSON.parse(formatAsJSON([unchecked])).dependencies[0];

  assert.strictEqual(dependency.securityStatus, "not-checked");
  assert.strictEqual("vulnerabilities" in dependency, false);
});

it("formatAsJSON => does not leak internal fields", () => {
  const dependency = JSON.parse(formatAsJSON([vulnerableLodash])).dependencies[0];

  assert.strictEqual("language" in dependency, false);
  assert.strictEqual("security" in dependency, false);
});

it("formatAsTable => is unchanged without security data", () => {
  const table = formatAsTable(plain);

  assert.match(table, /Outdated Dependencies:/);
  assert.doesNotMatch(table, /Security/);
  assert.doesNotMatch(table, /Pastoralist/);
});

it("formatAsTable => adds a Security column with severity counts", () => {
  const table = formatAsTable([vulnerableLodash, clean]);

  assert.match(table, /Severity\s+Security/);
  assert.match(table, /lodash\s+4\.17\.20\s+4\.18\.1\s+.*minor\s+2 high, 1 moderate/);
});

it("formatAsTable => lists vulnerable packages that are already current", () => {
  const table = formatAsTable([vulnerableCurrent, clean]);

  assert.match(table, /request\s+2\.88\.2\s+2\.88\.2\s+up-to-date\s+1 moderate/);
  assert.doesNotMatch(table, /left-pad/);
});

it("formatAsTable => retitles the table when security data is present", () => {
  assert.match(formatAsTable([vulnerableLodash]), /Outdated or vulnerable dependencies:/);
});

it("formatAsTable => shows not checked for unsupported ecosystems", () => {
  assert.match(formatAsTable([unchecked]), /actions\/checkout\s+v4\s+v5\s+.*major\s+not checked/);
});

it("formatAsTable => reports all clear when nothing is outdated or vulnerable", () => {
  assert.match(formatAsTable([clean]), /All dependencies are up-to-date!/);
});

it("formatAsTable => suggests Pastoralist for vulnerable npm packages", () => {
  assert.match(formatAsTable([vulnerableLodash]), /pastoralist --checkSecurity --interactive/);
});

it("formatAsTable => omits the Pastoralist hint for other ecosystems", () => {
  const python = { ...vulnerableLodash, name: "requests", language: "python" as const };

  assert.doesNotMatch(formatAsTable([python]), /Pastoralist/);
  assert.doesNotMatch(formatAsTable([clean, unchecked]), /Pastoralist/);
});

it("formatAsMarkdown => is unchanged without security data", () => {
  const markdown = formatAsMarkdown(plain);

  assert.match(markdown, /\| Package \| Current \| Latest \| Severity \|\n\|---------\|/);
  assert.doesNotMatch(markdown, /Security|Pastoralist/);
});

it("formatAsMarkdown => adds a Security column to the outdated table", () => {
  const markdown = formatAsMarkdown([vulnerableLodash]);

  assert.match(markdown, /\| Package \| Current \| Latest \| Severity \| Security \|/);
  assert.match(markdown, /\| lodash \| 4\.17\.20 \| 4\.18\.1 \| .* minor \| 2 high, 1 moderate \|/);
});

it("formatAsMarkdown => notes vulnerabilities on up-to-date packages", () => {
  const markdown = formatAsMarkdown([vulnerableCurrent, clean]);

  assert.match(markdown, /- request @ 2\.88\.2 \(security: 1 moderate\)/);
  assert.match(markdown, /- left-pad @ 1\.3\.0\n/);
});

it("formatAsMarkdown => adds the Pastoralist hint only for vulnerable npm packages", () => {
  assert.match(formatAsMarkdown([vulnerableLodash]), /> Fix with Pastoralist: pastoralist/);
  assert.doesNotMatch(formatAsMarkdown([clean, unchecked]), /Pastoralist/);
});

const outdatedClean: DependencyInfo = {
  name: "react",
  current: "17.0.0",
  latest: "18.0.0",
  language: "nodejs",
  security: { checked: true, vulnerabilities: [] },
};

const lineFor = (output: string, name: string): string =>
  output
    .split("\n")
    .find((line) => line.includes(name))
    ?.trimEnd() ?? "";

it("formatAsTable => leaves the Security cell empty for packages without security data", () => {
  const withoutSecurity: DependencyInfo = { name: "react", current: "17.0.0", latest: "18.0.0" };
  const table = formatAsTable([withoutSecurity, vulnerableLodash]);

  assert.match(table, /Severity\s+Security/);
  assert.match(lineFor(table, "react"), /major$/);
});

it("formatAsTable => shows none for an outdated package with no vulnerabilities", () => {
  assert.match(lineFor(formatAsTable([outdatedClean]), "react"), /major\s+none$/);
});

it("formatAsMarkdown => shows none for an outdated package with no vulnerabilities", () => {
  assert.match(lineFor(formatAsMarkdown([outdatedClean]), "| react"), /major \| none \|$/);
});

const uncheckedCurrent: DependencyInfo = {
  name: "nginx",
  current: "1.19",
  latest: "1.19",
  language: "docker",
  security: { checked: false, vulnerabilities: [] },
};

it("formatAsTable => says when current packages could not be scanned", () => {
  const table = formatAsTable([uncheckedCurrent]);

  assert.match(table, /All dependencies are up-to-date!/);
  assert.match(
    table,
    /Security: 1 package not checked \(unsupported ecosystem or OSV unavailable\)/,
  );
});

it("formatAsTable => counts several unchecked packages", () => {
  const second = { ...uncheckedCurrent, name: "redis" };

  assert.match(formatAsTable([uncheckedCurrent, second]), /Security: 2 packages not checked/);
});

it("formatAsTable => keeps the unchecked note under the table rows", () => {
  const table = formatAsTable([vulnerableLodash, uncheckedCurrent]);

  assert.match(table, /lodash\s+4\.17\.20/);
  assert.match(table, /Security: 1 package not checked/);
});

it("formatAsTable => adds no unchecked note when everything was scanned", () => {
  assert.doesNotMatch(formatAsTable([vulnerableLodash]), /not checked \(/);
  assert.doesNotMatch(formatAsTable(plain), /Security:/);
});

it("formatAsMarkdown => marks unchecked current packages and counts them", () => {
  const markdown = formatAsMarkdown([uncheckedCurrent, clean]);

  assert.match(markdown, /- nginx @ 1\.19 \(security: not checked\)/);
  assert.match(markdown, /- Security not checked: 1/);
});

it("formatAsMarkdown => adds no unchecked line when everything was scanned", () => {
  assert.doesNotMatch(formatAsMarkdown([clean]), /Security not checked/);
});
