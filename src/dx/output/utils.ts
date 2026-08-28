import { createAnsiPattern, DEFAULT_WIDTH } from "../constants";
import type { TableColumn, TableRow, TableVersionDiff, VersionTableMode } from "./types";

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

const gradientChannel = (start: number, end: number, ratio: number): number => {
  const distance = end - start;
  const value = start + distance * ratio;
  return Math.round(value);
};

const gradientColor = (ratio: number): string => {
  const redValue = gradientChannel(0, 188, ratio);
  const greenValue = gradientChannel(194, 92, ratio);
  const blueValue = 255;
  return `\x1b[38;2;${redValue};${greenValue};${blueValue}m`;
};

export const gradient = (text: string): string => {
  const characters = Array.from(text);
  const lastIndex = Math.max(characters.length - 1, 1);
  const coloredText = characters
    .map((character, index) => {
      const ratio = index / lastIndex;
      const color = gradientColor(ratio);
      return `${color}${character}`;
    })
    .join("");
  const formattedText = `\x1b[1m${coloredText}\x1b[0m`;
  return formattedText;
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

const visibleLength = (value: string): number => value.replace(createAnsiPattern(), "").length;

const truncateString = (value: string, width: number): string => {
  if (visibleLength(value) <= width) return value;

  const plainValue = value.replace(createAnsiPattern(), "");
  if (width <= 3) return ".".repeat(width);
  return `${plainValue.slice(0, width - 3)}...`;
};

const tableWidth = (columns: TableColumn[]): number =>
  columns.reduce((width, column) => width + column.width, columns.length * 3 + 1);

const columnWidth = (column: TableColumn, rows: TableRow[]): number => {
  const rowWidths = rows.map((row) => visibleLength(row[column.header] || ""));
  const widestRow = Math.max(0, ...rowWidths);
  return Math.max(column.width, visibleLength(column.header), widestRow);
};

const fitColumnsToTerminal = (columns: TableColumn[]): TableColumn[] => {
  const terminalWidth = process.stdout.columns || DEFAULT_WIDTH;
  const minimumTableWidth = columns.length * 3 + 1 + columns.length * 4;
  const maxTableWidth = Math.max(terminalWidth, minimumTableWidth);
  let fittedColumns = columns.slice();

  while (tableWidth(fittedColumns) > maxTableWidth) {
    const widestColumn = fittedColumns.reduce(
      (widest, column, index) => (column.width > fittedColumns[widest].width ? index : widest),
      0,
    );
    const canShrink = fittedColumns[widestColumn].width > 4;
    if (!canShrink) return fittedColumns;

    fittedColumns = fittedColumns.map((column, index) => {
      if (index !== widestColumn) return column;
      return Object.assign({}, column, { width: column.width - 1 });
    });
  }

  return fittedColumns;
};

const normalizeColumns = (columns: TableColumn[], rows: TableRow[]): TableColumn[] => {
  const naturalColumns = columns.map((column) =>
    Object.assign({}, column, { width: columnWidth(column, rows) }),
  );
  return fitColumnsToTerminal(naturalColumns);
};

const tableBorder = (columns: TableColumn[], left: string, join: string, right: string): string =>
  `${left}${columns.map(({ width }) => "─".repeat(width + 2)).join(join)}${right}`;

const tableRow = (columns: TableColumn[], row: TableRow): string => {
  const cells = columns.map(({ header, width, align }) => {
    const value = truncateString(row[header] || "", width);
    return padString(value, width, align);
  });
  return `│ ${cells.join(" │ ")} │`;
};

export const createTable = (columns: TableColumn[], rows: TableRow[]): string => {
  const fittedColumns = normalizeColumns(columns, rows);
  const top = tableBorder(fittedColumns, "┌", "┬", "┐");
  const headerValues = Object.fromEntries(
    fittedColumns.map(({ header }) => [header, cyan(header)]),
  );
  const header = tableRow(fittedColumns, headerValues);
  const middle = tableBorder(fittedColumns, "├", "┼", "┤");
  const content = rows.map((row) => tableRow(fittedColumns, row));
  const bottom = tableBorder(fittedColumns, "└", "┴", "┘");
  return [top, header, middle].concat(content, bottom).join("\n");
};

export const formatVersionTable = (
  diffs: TableVersionDiff[],
  mode: VersionTableMode = "update",
): string => {
  const checkColumns: TableColumn[] = [
    { header: "Package", width: 20, align: "left" },
    { header: "Current", width: 12, align: "left" },
    { header: "Available", width: 12, align: "left" },
  ];
  const updateColumns: TableColumn[] = [
    { header: "Package", width: 20, align: "left" },
    { header: "Previous", width: 12, align: "left" },
    { header: "Updated", width: 12, align: "left" },
  ];

  if (mode === "check") {
    const rows = diffs.map(({ package: packageName, current, latest }) => ({
      Package: packageName,
      Current: current,
      Available: green(latest),
    }));
    return createTable(checkColumns, rows);
  }

  const rows = diffs.map(({ package: packageName, current, latest, installed, isPinned }) => {
    const installedVersion = installed || latest;
    const formattedUpdated = isPinned ? yellow(installedVersion) : green(installedVersion);
    return {
      Package: packageName,
      Previous: current,
      Updated: formattedUpdated,
    };
  });
  return createTable(updateColumns, rows);
};
