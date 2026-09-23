import { assertTextExcludes, assertTextIncludes } from "../../helpers/assertions";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createAnsiPattern } from "../../../src/dx/constants";
import {
  createTable,
  formatCliLegend,
  formatVersionTable,
  formatVersionTableTitle,
  readableForeground,
} from "../../../src/dx/output";
import {
  CODEPENDENCE_GRADIENT_END,
  CODEPENDENCE_GRADIENT_MIDDLE,
  CODEPENDENCE_GRADIENT_QUARTER,
  CODEPENDENCE_GRADIENT_START,
  CODEPENDENCE_GRADIENT_THREE_QUARTER,
  DIFF_BACKGROUND_PALETTE,
  DIFF_FOREGROUND_PALETTE,
  MUTED_VERSION_COLOR,
} from "../../../src/dx/output/constants";
import type { Rgb } from "../../../src/dx/output";
import type { TableColumn, TableRow, TableVersionDiff } from "../../../src/dx/output";

const visibleLength = (value: string): number => value.replace(createAnsiPattern(), "").length;

const outputLines = (value: string): string[] => value.split("\n");

const ansiBackground = (rgb: Rgb): string => `\x1b[48;2;${rgb.join(";")}m`;

const ansiForeground = (rgb: Rgb): string => `\x1b[38;2;${rgb.join(";")}m`;

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("createTable", () => {
  test("should create a basic table", () => {
    const columns: TableColumn[] = [
      { header: "Name", width: 10 },
      { header: "Value", width: 10 },
    ];

    const rows: TableRow[] = [
      { Name: "foo", Value: "bar" },
      { Name: "baz", Value: "qux" },
    ];

    const result = createTable(columns, rows);

    assert.match(result, /┌/);
    assert.match(result, /┐/);
    assert.match(result, /└/);
    assert.match(result, /┘/);
    assert.match(result, /Name/);
    assert.match(result, /Value/);
    assert.match(result, /foo/);
    assert.match(result, /bar/);
  });

  test("should handle empty rows", () => {
    const columns: TableColumn[] = [
      { header: "Name", width: 10 },
      { header: "Value", width: 10 },
    ];

    const rows: TableRow[] = [];

    const result = createTable(columns, rows);

    assert.match(result, /Name/);
    assert.match(result, /Value/);
    assert.match(result, /┌/);
    assert.match(result, /┘/);
  });

  test("should handle left alignment", () => {
    const columns: TableColumn[] = [{ header: "Name", width: 15, align: "left" }];

    const rows: TableRow[] = [{ Name: "test" }];

    const result = createTable(columns, rows);

    assert.match(result, /test/);
  });

  test("should handle right alignment", () => {
    const columns: TableColumn[] = [{ header: "Number", width: 10, align: "right" }];

    const rows: TableRow[] = [{ Number: "123" }];

    const result = createTable(columns, rows);

    assert.match(result, /123/);
  });

  test("should handle center alignment", () => {
    const columns: TableColumn[] = [{ header: "Center", width: 12, align: "center" }];

    const rows: TableRow[] = [{ Center: "text" }];

    const result = createTable(columns, rows);

    assert.match(result, /text/);
  });

  test("should handle missing values in rows", () => {
    const columns: TableColumn[] = [
      { header: "Col1", width: 10 },
      { header: "Col2", width: 10 },
    ];

    const rows: TableRow[] = [{ Col1: "value1" }];

    const result = createTable(columns, rows);

    assert.match(result, /value1/);
  });

  test("expands columns for long cell values", () => {
    const columns: TableColumn[] = [
      { header: "Name", width: 10 },
      { header: "Value", width: 10 },
    ];
    const rows: TableRow[] = [{ Name: "eslint-plugin-legibility", Value: "0.3.5" }];

    const result = createTable(columns, rows);
    const lengths = outputLines(result).map(visibleLength);

    assert.match(result, /eslint-plugin-legibility/);
    assert.deepStrictEqual(new Set(lengths).size, 1);
  });

  test("shrinks wide tables to the terminal width", () => {
    // eslint-disable-next-line legibility/no-single-use-renaming-alias -- Snapshot the original value before the test mutates it.
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", { configurable: true, value: 52 });

    try {
      const columns: TableColumn[] = [
        { header: "Name", width: 10 },
        { header: "Value", width: 10 },
      ];
      const rows: TableRow[] = [
        { Name: "a-very-long-package-name-that-needs-truncation", Value: "0.3.5" },
      ];

      const result = createTable(columns, rows);
      const lengths = outputLines(result).map(visibleLength);

      assert.ok(lengths.every((length) => length <= 52));
      assert.match(result, /\.\.\./);
    } finally {
      Object.defineProperty(process.stdout, "columns", {
        configurable: true,
        value: originalColumns,
      });
    }
  });
});

// eslint-disable-next-line max-lines-per-function -- Suite registration is declarative; test callbacks remain checked.
describe("formatVersionTable", () => {
  test("should format version diffs with pinned packages", () => {
    const diffs: TableVersionDiff[] = [
      {
        package: "lodash",
        current: "4.17.0",
        latest: "4.17.21",
        installed: "^4.17.21",
        isPinned: false,
        willUpdate: true,
      },
      {
        package: "express",
        current: "4.18.0",
        latest: "4.19.0",
        installed: "4.19.0",
        isPinned: true,
        willUpdate: false,
      },
    ];

    const result = formatVersionTable(diffs);

    assert.match(result, /lodash/);
    assert.match(result, /Previous/);
    assert.match(result, /Updated/);
    assert.match(result, /4\.17\.0/);
    assert.match(result, /4\.17\.21/);
    assert.match(result, /\^4\.17\.21/);
    assert.match(result, /express/);
    assert.match(result, /4\.18\.0/);
    assert.match(result, /4\.19\.0/);
    assert.doesNotMatch(result, /Update ✓/);
    assert.doesNotMatch(result, /Pinned/);
  });

  test("should format check diffs without update action columns", () => {
    const diffs: TableVersionDiff[] = [
      {
        package: "lodash",
        current: "4.17.0",
        latest: "4.17.21",
        installed: "^4.17.21",
        isPinned: false,
        willUpdate: true,
      },
    ];

    const result = formatVersionTable(diffs, "check");

    assert.match(result, /Package/);
    assert.match(result, /Current/);
    assert.match(result, /Available/);
    assert.doesNotMatch(result, /Previous/);
    assert.doesNotMatch(result, /Updated/);
  });

  test("should handle empty diffs array", () => {
    const diffs: TableVersionDiff[] = [];

    const result = formatVersionTable(diffs);

    assert.match(result, /Package/);
    assert.match(result, /Previous/);
    assert.match(result, /Updated/);
    assert.doesNotMatch(result, /Latest/);
    assert.doesNotMatch(result, /Installed/);
  });

  test("should handle single diff", () => {
    const diffs: TableVersionDiff[] = [
      {
        package: "react",
        current: "18.2.0",
        latest: "18.3.0",
        installed: "^18.3.0",
        isPinned: false,
        willUpdate: true,
      },
    ];

    const result = formatVersionTable(diffs);

    assert.match(result, /react/);
    assert.match(result, /18\.2\.0/);
    assert.match(result, /18\.3\.0/);
    assert.match(result, /\^18\.3\.0/);
  });

  test("colors version columns by semantic diff size", () => {
    const diffs: TableVersionDiff[] = [
      { package: "major", current: "1.0.0", latest: "6.0.0", isPinned: false },
      { package: "minor", current: "1.0.0", latest: "1.12.0", isPinned: false },
      { package: "patch", current: "1.0.0", latest: "1.0.50", isPinned: false },
      { package: "unknown", current: "link:../pkg", latest: "1.0.0", isPinned: false },
    ];

    const result = formatVersionTable(diffs, "check");

    assertTextExcludes(result, "\n\u001b[48;2;");
    assertTextIncludes(result, ansiBackground(DIFF_BACKGROUND_PALETTE.major[1]));
    assertTextIncludes(result, ansiBackground(DIFF_BACKGROUND_PALETTE.minor[1]));
    assertTextIncludes(result, ansiBackground(DIFF_BACKGROUND_PALETTE.patch[1]));
    assertTextIncludes(result, ansiBackground(DIFF_BACKGROUND_PALETTE.unknown[1]));
    assertTextIncludes(result, `${ansiForeground(MUTED_VERSION_COLOR)}  1.0.0`);
    assertTextIncludes(
      result,
      `${ansiForeground(readableForeground(DIFF_FOREGROUND_PALETTE.major[1]))}  6.0.0`,
    );
    assertTextIncludes(
      result,
      `${ansiForeground(readableForeground(DIFF_FOREGROUND_PALETTE.minor[1]))}  1.12.0`,
    );
    assertTextIncludes(
      result,
      `${ansiForeground(readableForeground(DIFF_FOREGROUND_PALETTE.patch[1]))}  1.0.50`,
    );
    assertTextIncludes(
      result,
      `${ansiForeground(readableForeground(DIFF_FOREGROUND_PALETTE.unknown[1]))}  1.0.0`,
    );
  });

  test("uses codependence gradient stops for semantic diff foregrounds", () => {
    assert.deepStrictEqual(DIFF_FOREGROUND_PALETTE.patch, [
      CODEPENDENCE_GRADIENT_START,
      CODEPENDENCE_GRADIENT_QUARTER,
    ]);
    assert.deepStrictEqual(DIFF_FOREGROUND_PALETTE.minor, [
      CODEPENDENCE_GRADIENT_MIDDLE,
      CODEPENDENCE_GRADIENT_THREE_QUARTER,
    ]);
    assert.deepStrictEqual(DIFF_FOREGROUND_PALETTE.major, [
      CODEPENDENCE_GRADIENT_THREE_QUARTER,
      CODEPENDENCE_GRADIENT_END,
    ]);
  });

  test("colors table titles by the median semantic diff risk", () => {
    const diffs: TableVersionDiff[] = [
      { package: "patch", current: "1.0.0", latest: "1.0.50", isPinned: false },
      { package: "minor", current: "1.0.0", latest: "1.12.0", isPinned: false },
      { package: "major", current: "1.0.0", latest: "6.0.0", isPinned: false },
    ];

    const result = formatVersionTableTitle(diffs, "check");

    assertTextIncludes(result, `${ansiForeground(DIFF_FOREGROUND_PALETTE.minor[1])}◆\x1b[0m`);
    assertTextIncludes(result, "\u001b[1m\u001b[36mDependency Updates Available:");
  });

  test("uses the upper median semantic diff for even row counts", () => {
    const diffs: TableVersionDiff[] = [
      { package: "patch-a", current: "1.0.0", latest: "1.0.1", isPinned: false },
      { package: "patch-b", current: "1.0.0", latest: "1.0.2", isPinned: false },
      { package: "minor", current: "1.0.0", latest: "1.12.0", isPinned: false },
      { package: "major", current: "1.0.0", latest: "6.0.0", isPinned: false },
    ];

    const result = formatVersionTableTitle(diffs, "check");

    assertTextIncludes(result, `${ansiForeground(DIFF_FOREGROUND_PALETTE.minor[1])}◆\x1b[0m`);
  });

  test("colors table titles from patch risk when patch is highest", () => {
    const diffs: TableVersionDiff[] = [
      { package: "patch", current: "1.0.0", latest: "1.0.50", isPinned: false },
    ];

    const result = formatVersionTableTitle(diffs);

    assertTextIncludes(result, `${ansiForeground(DIFF_FOREGROUND_PALETTE.patch[1])}◆\x1b[0m`);
    assertTextIncludes(result, "\u001b[1m\u001b[36mUpdated Dependencies:");
  });

  test("uses semver-shaped values instead of arbitrary digits", () => {
    const diffs: TableVersionDiff[] = [
      { package: "range", current: "^1.2.3", latest: "1.14.0", isPinned: false },
      { package: "link", current: "link:../pkg-2", latest: "1.0.0", isPinned: false },
    ];

    const result = formatVersionTable(diffs, "check");

    assertTextIncludes(
      result,
      `${ansiForeground(readableForeground(DIFF_FOREGROUND_PALETTE.minor[1]))}  1.14.0`,
    );
    assertTextIncludes(
      result,
      `${ansiForeground(readableForeground(DIFF_FOREGROUND_PALETTE.unknown[1]))}  1.0.0`,
    );
  });

  test("uses readable foreground colors in the legend", () => {
    const result = formatCliLegend();

    assertTextIncludes(result, ansiBackground(DIFF_BACKGROUND_PALETTE.patch[1]));
    assertTextIncludes(
      result,
      `${ansiForeground(readableForeground(DIFF_FOREGROUND_PALETTE.patch[1]))}  1.2.3 -> 1.2.4`,
    );
    assertTextExcludes(
      result,
      `${ansiForeground(DIFF_FOREGROUND_PALETTE.patch[1])}  1.2.3 -> 1.2.4`,
    );
  });
});
