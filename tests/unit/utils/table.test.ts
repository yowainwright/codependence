import { describe, test, expect } from "bun:test";
import { createTable, formatVersionTable } from "../../../src/utils/table";
import type { TableColumn, TableRow, VersionDiff } from "../../../src/utils/table";

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

    expect(result).toContain("┌");
    expect(result).toContain("┐");
    expect(result).toContain("└");
    expect(result).toContain("┘");
    expect(result).toContain("Name");
    expect(result).toContain("Value");
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  test("should handle empty rows", () => {
    const columns: TableColumn[] = [
      { header: "Name", width: 10 },
      { header: "Value", width: 10 },
    ];

    const rows: TableRow[] = [];

    const result = createTable(columns, rows);

    expect(result).toContain("Name");
    expect(result).toContain("Value");
    expect(result).toContain("┌");
    expect(result).toContain("┘");
  });

  test("should handle left alignment", () => {
    const columns: TableColumn[] = [
      { header: "Name", width: 15, align: "left" },
    ];

    const rows: TableRow[] = [{ Name: "test" }];

    const result = createTable(columns, rows);

    expect(result).toContain("test");
  });

  test("should handle right alignment", () => {
    const columns: TableColumn[] = [
      { header: "Number", width: 10, align: "right" },
    ];

    const rows: TableRow[] = [{ Number: "123" }];

    const result = createTable(columns, rows);

    expect(result).toContain("123");
  });

  test("should handle center alignment", () => {
    const columns: TableColumn[] = [
      { header: "Center", width: 12, align: "center" },
    ];

    const rows: TableRow[] = [{ Center: "text" }];

    const result = createTable(columns, rows);

    expect(result).toContain("text");
  });

  test("should handle missing values in rows", () => {
    const columns: TableColumn[] = [
      { header: "Col1", width: 10 },
      { header: "Col2", width: 10 },
    ];

    const rows: TableRow[] = [{ Col1: "value1" }];

    const result = createTable(columns, rows);

    expect(result).toContain("value1");
  });
});

describe("formatVersionTable", () => {
  test("should format version diffs with pinned packages", () => {
    const diffs: VersionDiff[] = [
      {
        package: "lodash",
        current: "4.17.0",
        latest: "4.17.21",
        isPinned: false,
        willUpdate: true,
      },
      {
        package: "express",
        current: "4.18.0",
        latest: "4.19.0",
        isPinned: true,
        willUpdate: false,
      },
    ];

    const result = formatVersionTable(diffs);

    expect(result).toContain("lodash");
    expect(result).toContain("4.17.0");
    expect(result).toContain("4.17.21");
    expect(result).toContain("express");
    expect(result).toContain("4.18.0");
    expect(result).toContain("4.19.0");
    expect(result).toContain("Update");
    expect(result).toContain("Pinned");
  });

  test("should handle empty diffs array", () => {
    const diffs: VersionDiff[] = [];

    const result = formatVersionTable(diffs);

    expect(result).toContain("Package");
    expect(result).toContain("Current");
    expect(result).toContain("Latest");
    expect(result).toContain("Action");
  });

  test("should handle single diff", () => {
    const diffs: VersionDiff[] = [
      {
        package: "react",
        current: "18.2.0",
        latest: "18.3.0",
        isPinned: false,
        willUpdate: true,
      },
    ];

    const result = formatVersionTable(diffs);

    expect(result).toContain("react");
    expect(result).toContain("18.2.0");
    expect(result).toContain("18.3.0");
  });
});
