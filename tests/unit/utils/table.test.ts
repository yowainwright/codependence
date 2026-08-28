import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createAnsiPattern } from "../../../src/dx/constants";
import { createTable, formatVersionTable } from "../../../src/dx/output";
import type { TableColumn, TableRow, TableVersionDiff } from "../../../src/dx/output";

const visibleLength = (value: string): number => value.replace(createAnsiPattern(), "").length;

const outputLines = (value: string): string[] => value.split("\n");

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

    assert.ok(result.includes("┌"));
    assert.ok(result.includes("┐"));
    assert.ok(result.includes("└"));
    assert.ok(result.includes("┘"));
    assert.ok(result.includes("Name"));
    assert.ok(result.includes("Value"));
    assert.ok(result.includes("foo"));
    assert.ok(result.includes("bar"));
  });

  test("should handle empty rows", () => {
    const columns: TableColumn[] = [
      { header: "Name", width: 10 },
      { header: "Value", width: 10 },
    ];

    const rows: TableRow[] = [];

    const result = createTable(columns, rows);

    assert.ok(result.includes("Name"));
    assert.ok(result.includes("Value"));
    assert.ok(result.includes("┌"));
    assert.ok(result.includes("┘"));
  });

  test("should handle left alignment", () => {
    const columns: TableColumn[] = [{ header: "Name", width: 15, align: "left" }];

    const rows: TableRow[] = [{ Name: "test" }];

    const result = createTable(columns, rows);

    assert.ok(result.includes("test"));
  });

  test("should handle right alignment", () => {
    const columns: TableColumn[] = [{ header: "Number", width: 10, align: "right" }];

    const rows: TableRow[] = [{ Number: "123" }];

    const result = createTable(columns, rows);

    assert.ok(result.includes("123"));
  });

  test("should handle center alignment", () => {
    const columns: TableColumn[] = [{ header: "Center", width: 12, align: "center" }];

    const rows: TableRow[] = [{ Center: "text" }];

    const result = createTable(columns, rows);

    assert.ok(result.includes("text"));
  });

  test("should handle missing values in rows", () => {
    const columns: TableColumn[] = [
      { header: "Col1", width: 10 },
      { header: "Col2", width: 10 },
    ];

    const rows: TableRow[] = [{ Col1: "value1" }];

    const result = createTable(columns, rows);

    assert.ok(result.includes("value1"));
  });

  test("expands columns for long cell values", () => {
    const columns: TableColumn[] = [
      { header: "Name", width: 10 },
      { header: "Value", width: 10 },
    ];
    const rows: TableRow[] = [{ Name: "eslint-plugin-legibility", Value: "0.3.5" }];

    const result = createTable(columns, rows);
    const lengths = outputLines(result).map(visibleLength);

    assert.ok(result.includes("eslint-plugin-legibility"));
    assert.deepStrictEqual(new Set(lengths).size, 1);
  });

  test("shrinks wide tables to the terminal width", () => {
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
      assert.ok(result.includes("..."));
    } finally {
      Object.defineProperty(process.stdout, "columns", {
        configurable: true,
        value: originalColumns,
      });
    }
  });
});

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

    assert.ok(result.includes("lodash"));
    assert.ok(result.includes("Previous"));
    assert.ok(result.includes("Updated"));
    assert.ok(result.includes("4.17.0"));
    assert.ok(result.includes("4.17.21"));
    assert.ok(result.includes("^4.17.21"));
    assert.ok(result.includes("express"));
    assert.ok(result.includes("4.18.0"));
    assert.ok(result.includes("4.19.0"));
    assert.ok(!result.includes("Update ✓"));
    assert.ok(!result.includes("Pinned"));
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

    assert.ok(result.includes("Package"));
    assert.ok(result.includes("Current"));
    assert.ok(result.includes("Available"));
    assert.ok(!result.includes("Previous"));
    assert.ok(!result.includes("Updated"));
  });

  test("should handle empty diffs array", () => {
    const diffs: TableVersionDiff[] = [];

    const result = formatVersionTable(diffs);

    assert.ok(result.includes("Package"));
    assert.ok(result.includes("Previous"));
    assert.ok(result.includes("Updated"));
    assert.ok(!result.includes("Latest"));
    assert.ok(!result.includes("Installed"));
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

    assert.ok(result.includes("react"));
    assert.ok(result.includes("18.2.0"));
    assert.ok(result.includes("18.3.0"));
    assert.ok(result.includes("^18.3.0"));
  });
});
