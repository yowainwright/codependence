import { cyan, green, yellow, gray } from "./colors";

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export interface TableRow {
  [key: string]: string;
}

const padString = (str: string, width: number, align = "left"): string => {
  const displayLength = str.replace(/\x1b\[[0-9;]*m/g, "").length;
  const padding = Math.max(0, width - displayLength);

  if (align === "right") {
    return " ".repeat(padding) + str;
  }

  if (align === "center") {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return " ".repeat(leftPad) + str + " ".repeat(rightPad);
  }

  return str + " ".repeat(padding);
};

export const createTable = (
  columns: TableColumn[],
  rows: TableRow[],
): string => {
  const lines: string[] = [];

  const topBorder =
    "┌" + columns.map((col) => "─".repeat(col.width + 2)).join("┬") + "┐";
  lines.push(topBorder);

  const headerRow =
    "│ " +
    columns
      .map((col) => padString(cyan(col.header), col.width, col.align))
      .join(" │ ") +
    " │";
  lines.push(headerRow);

  const middleBorder =
    "├" + columns.map((col) => "─".repeat(col.width + 2)).join("┼") + "┤";
  lines.push(middleBorder);

  for (const row of rows) {
    const rowLine =
      "│ " +
      columns
        .map((col) => {
          const value = row[col.header] || "";
          return padString(value, col.width, col.align);
        })
        .join(" │ ") +
      " │";
    lines.push(rowLine);
  }

  const bottomBorder =
    "└" + columns.map((col) => "─".repeat(col.width + 2)).join("┴") + "┘";
  lines.push(bottomBorder);

  return lines.join("\n");
};

export interface VersionDiff {
  package: string;
  current: string;
  latest: string;
  isPinned: boolean;
}

export const formatVersionTable = (diffs: VersionDiff[]): string => {
  const columns: TableColumn[] = [
    { header: "Package", width: 20, align: "left" },
    { header: "Current", width: 12, align: "left" },
    { header: "Latest", width: 12, align: "left" },
    { header: "Action", width: 12, align: "left" },
  ];

  const rows = diffs.map((diff) => {
    const action = diff.isPinned ? yellow("Pinned 📌") : green("Update ✓");

    return {
      Package: diff.package,
      Current: gray(diff.current),
      Latest: diff.latest,
      Action: action,
    };
  });

  return createTable(columns, rows);
};
