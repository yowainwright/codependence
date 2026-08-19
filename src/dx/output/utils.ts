import { createAnsiPattern } from "../constants";
import { SYMBOLS } from "../report/constants";
import type { TableColumn, TableRow, TableVersionDiff } from "./types";

export const green = (text: string): string => {
  return `\x1b[32m${text}\x1b[0m`;
};

export const red = (text: string): string => {
  return `\x1b[31m${text}\x1b[0m`;
};

export const yellow = (text: string): string => {
  return `\x1b[33m${text}\x1b[0m`;
};

export const cyan = (text: string): string => {
  return `\x1b[36m${text}\x1b[0m`;
};

export const gray = (text: string): string => {
  return `\x1b[90m${text}\x1b[0m`;
};

export const bold = (text: string): string => {
  return `\x1b[1m${text}\x1b[0m`;
};

export const gradient = (text: string): string => {
  return `${cyan(text)}`;
};

export const success = (text: string = "✓"): string => {
  return green(text);
};

export const error = (text: string = "✗"): string => {
  return red(text);
};

const padString = (value: string, width: number, align = "left"): string => {
  const displayLength = value.replace(createAnsiPattern(), "").length;
  const padding = Math.max(0, width - displayLength);
  if (align === "right") return `${" ".repeat(padding)}${value}`;
  if (align !== "center") return `${value}${" ".repeat(padding)}`;

  const leftPadding = Math.floor(padding / 2);
  const rightPadding = padding - leftPadding;
  return `${" ".repeat(leftPadding)}${value}${" ".repeat(rightPadding)}`;
};

const tableBorder = (columns: TableColumn[], left: string, join: string, right: string): string =>
  `${left}${columns.map(({ width }) => "─".repeat(width + 2)).join(join)}${right}`;

const tableRow = (columns: TableColumn[], row: TableRow): string => {
  const cells = columns.map(({ header, width, align }) => {
    const value = row[header] || "";
    return padString(value, width, align);
  });
  return `│ ${cells.join(" │ ")} │`;
};

export const createTable = (columns: TableColumn[], rows: TableRow[]): string => {
  const top = tableBorder(columns, "┌", "┬", "┐");
  const headerValues = Object.fromEntries(columns.map(({ header }) => [header, cyan(header)]));
  const header = tableRow(columns, headerValues);
  const middle = tableBorder(columns, "├", "┼", "┤");
  const content = rows.map((row) => tableRow(columns, row));
  const bottom = tableBorder(columns, "└", "┴", "┘");
  return [top, header, middle, ...content, bottom].join("\n");
};

export const formatVersionTable = (diffs: TableVersionDiff[]): string => {
  const columns: TableColumn[] = [
    { header: "Package", width: 20, align: "left" },
    { header: "Current", width: 12, align: "left" },
    { header: "Latest", width: 12, align: "left" },
    { header: "Action", width: 12, align: "left" },
  ];
  const rows = diffs.map(({ package: packageName, current, latest, isPinned }) => {
    const action = isPinned
      ? yellow(`Pinned ${SYMBOLS.pinned}`)
      : green(`Update ${SYMBOLS.success}`);
    return { Package: packageName, Current: gray(current), Latest: latest, Action: action };
  });
  return createTable(columns, rows);
};
