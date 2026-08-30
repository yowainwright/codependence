import { ANSI, createAnsiPattern, DEFAULT_WIDTH } from "../constants";
import {
  CODEPENDENCE_GRADIENT_END,
  CODEPENDENCE_GRADIENT_START,
  DIFF_BACKGROUND_PALETTE,
  DIFF_FOREGROUND_PALETTE,
  DIFF_DISTANCE_WEIGHT,
  DIFF_RANGE_LIMITS,
  DIFF_WEIGHTS,
  GLIMMER_HIGHLIGHT_COLOR,
  GLIMMER_HIGHLIGHT_WIDTH,
  MAX_DIFF_INTENSITY,
  MIN_DIFF_INTENSITY,
  MUTED_VERSION_COLOR,
  SEMVER_DIFF_SIZE,
  SHORT_STATUS_FOREGROUND,
  TABLE_CELL_PADDING,
  TABLE_TARGET_FOREGROUND_BASE,
  TABLE_TARGET_FOREGROUND_MIX,
  UNKNOWN_DIFF_DISTANCE,
  VERSION_TABLE_COLUMNS,
  VERSION_TABLE_TITLES,
} from "./constants";
import type {
  DiffDistance,
  DiffMeasurement,
  DiffPalette,
  GlimmerCharacterContext,
  GlimmerOptions,
  OrderedSemverVersions,
  Rgb,
  SemverDiffType,
  SemverParts,
  TableCellStyle,
  TableColumn,
  TableRow,
  TableRowStyle,
  TableVersionDiff,
  VersionTableMode,
} from "./types";

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

const rgbValues = (rgb: Rgb): string => rgb.join(";");

const bgColor = (rgb: Rgb): string => {
  return `\x1b[48;2;${rgbValues(rgb)}m`;
};

const fgColor = (rgb: Rgb): string => {
  return `\x1b[38;2;${rgbValues(rgb)}m`;
};

const colorText = (text: string, color: string): string => {
  return `${color}${text}${ANSI.RESET}`;
};

const interpolateChannel = (start: number, end: number, ratio: number): number => {
  const distance = end - start;
  const value = start + distance * ratio;
  return Math.round(value);
};

const interpolateRgb = (start: Rgb, end: Rgb, ratio: number): Rgb => {
  const redValue = interpolateChannel(start[0], end[0], ratio);
  const greenValue = interpolateChannel(start[1], end[1], ratio);
  const blueValue = interpolateChannel(start[2], end[2], ratio);
  return [redValue, greenValue, blueValue];
};

const clampRatio = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const mixRgb = (start: Rgb, end: Rgb, ratio: number): Rgb => {
  return interpolateRgb(start, end, clampRatio(ratio));
};

export const readableForeground = (rgb: Rgb): Rgb => {
  return mixRgb(rgb, TABLE_TARGET_FOREGROUND_BASE, TABLE_TARGET_FOREGROUND_MIX);
};

const stripAnsi = (text: string): string => {
  return text.replace(createAnsiPattern(), "");
};

const warmStatusText = (text: string): string => {
  const plainText = stripAnsi(text);
  return `${ANSI.BOLD}${fgColor(SHORT_STATUS_FOREGROUND)}${plainText}${ANSI.RESET}`;
};

const joinStatus = (symbol: string, text: string): string => `${symbol} ${warmStatusText(text)}`;

export const shortStatus = (symbol: string, text?: string): string => {
  if (text === undefined) return warmStatusText(symbol);
  return joinStatus(symbol, text);
};

const normalizeDiffDistance = ({ size, distance }: DiffDistance): number => {
  const rangeLimit = DIFF_RANGE_LIMITS[size];
  const distanceRatio = Math.log1p(distance) / Math.log1p(rangeLimit);
  return clampRatio(distanceRatio);
};

const scaleDiffIntensity = (ratio: number): number => {
  const intensityRange = MAX_DIFF_INTENSITY - MIN_DIFF_INTENSITY;
  const intensity = MIN_DIFF_INTENSITY + ratio * intensityRange;
  return clampRatio(intensity);
};

const diffScore = (size: DiffMeasurement["size"], distanceRatio: number): number => {
  const weightedDistance = distanceRatio * DIFF_DISTANCE_WEIGHT;
  return DIFF_WEIGHTS[size] + weightedDistance;
};

const measurement = (size: DiffMeasurement["size"], distance: number): DiffMeasurement => {
  const distanceRatio = normalizeDiffDistance({ size, distance });
  const score = diffScore(size, distanceRatio);
  return { size, distance, score };
};

const diffIntensity = (measurement: DiffMeasurement): number => {
  const distanceRatio = normalizeDiffDistance(measurement);
  return scaleDiffIntensity(distanceRatio);
};

const diffColor = (measurement: DiffMeasurement, palette: DiffPalette): Rgb => {
  const stops = palette[measurement.size];
  return interpolateRgb(stops[0], stops[1], diffIntensity(measurement));
};

const cleanVersion = (version: string): string => {
  return version
    .trim()
    .replace(/^[~^<>=\s]+/, "")
    .replace(/^v/, "");
};

const parseSemverParts = (version: string): SemverParts | null => {
  const match = cleanVersion(version).match(
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    prerelease: match[4]?.split(".") ?? [],
  };
};

const compareNumber = (left: number, right: number): number => {
  if (left === right) return 0;
  if (left > right) return 1;
  return -1;
};

const compareMainVersion = (left: SemverParts, right: SemverParts): number => {
  const majorComparison = compareNumber(left.major, right.major);
  if (majorComparison !== 0) return majorComparison;

  const minorComparison = compareNumber(left.minor, right.minor);
  if (minorComparison !== 0) return minorComparison;

  return compareNumber(left.patch, right.patch);
};

const hasPrerelease = (version: SemverParts): boolean => version.prerelease.length > 0;

const prereleaseValue = (version: SemverParts): string => version.prerelease.join(".");

const comparePrerelease = (left: SemverParts, right: SemverParts): number => {
  const comparison = prereleaseValue(left).localeCompare(prereleaseValue(right));
  return compareNumber(comparison, 0);
};

const compareReleaseState = (left: SemverParts, right: SemverParts): number | null => {
  const leftHasPrerelease = hasPrerelease(left);
  const rightHasPrerelease = hasPrerelease(right);
  const leftReleaseIsHigher = !leftHasPrerelease && rightHasPrerelease;
  const rightReleaseIsHigher = leftHasPrerelease && !rightHasPrerelease;

  if (leftReleaseIsHigher) return 1;
  if (rightReleaseIsHigher) return -1;
  return null;
};

const compareSemver = (left: SemverParts, right: SemverParts): number => {
  const mainComparison = compareMainVersion(left, right);
  if (mainComparison !== 0) return mainComparison;

  const releaseComparison = compareReleaseState(left, right);
  if (releaseComparison !== null) return releaseComparison;

  return comparePrerelease(left, right);
};

const orderedSemverVersions = (
  left: SemverParts,
  right: SemverParts,
): OrderedSemverVersions | null => {
  const comparison = compareSemver(left, right);
  if (comparison === 0) return null;

  if (comparison > 0) {
    return { lowVersion: right, highVersion: left };
  }

  return { lowVersion: left, highVersion: right };
};

const prereleaseDiffType = (
  lowVersion: SemverParts,
  highVersion: SemverParts,
): SemverDiffType | null => {
  const lowIsPrerelease = hasPrerelease(lowVersion);
  const highIsPrerelease = hasPrerelease(highVersion);
  const hasSameMainVersion = compareMainVersion(lowVersion, highVersion) === 0;
  const releasesPrerelease = lowIsPrerelease && !highIsPrerelease;
  const updatesPrerelease = hasSameMainVersion && highIsPrerelease;

  if (releasesPrerelease) return releaseDiffFromPrerelease(lowVersion);
  if (updatesPrerelease) return "prerelease";
  return null;
};

const releaseDiffFromPrerelease = (version: SemverParts): SemverDiffType => {
  const isMajorPrerelease = version.minor === 0 && version.patch === 0;
  if (isMajorPrerelease) return "major";
  if (version.patch === 0) return "minor";
  return "patch";
};

const mainVersionDiffType = (
  lowVersion: SemverParts,
  highVersion: SemverParts,
  highIsPrerelease: boolean,
): SemverDiffType => {
  const prefix = highIsPrerelease ? "pre" : "";
  const hasMajorChange = highVersion.major > lowVersion.major;
  const hasMinorChange = highVersion.minor > lowVersion.minor;

  if (hasMajorChange) return `${prefix}major` as SemverDiffType;
  if (hasMinorChange) return `${prefix}minor` as SemverDiffType;
  return `${prefix}patch` as SemverDiffType;
};

const orderedVersionDiffType = ({
  lowVersion,
  highVersion,
}: OrderedSemverVersions): SemverDiffType => {
  const prereleaseType = prereleaseDiffType(lowVersion, highVersion);
  if (prereleaseType) return prereleaseType;

  return mainVersionDiffType(lowVersion, highVersion, hasPrerelease(highVersion));
};

const semverDiffType = (left: SemverParts, right: SemverParts): SemverDiffType | null => {
  const orderedVersions = orderedSemverVersions(left, right);
  if (!orderedVersions) return null;

  return orderedVersionDiffType(orderedVersions);
};

const releaseDistance = (
  current: SemverParts,
  target: SemverParts,
  type: SemverDiffType,
): number => {
  const size = SEMVER_DIFF_SIZE[type];
  if (size === "major") return Math.abs(target.major - current.major) || UNKNOWN_DIFF_DISTANCE;
  if (size === "minor") return Math.abs(target.minor - current.minor) || UNKNOWN_DIFF_DISTANCE;
  return Math.abs(target.patch - current.patch) || UNKNOWN_DIFF_DISTANCE;
};

const diffMeasurement = (current: string, target: string): DiffMeasurement => {
  const currentParts = parseSemverParts(current);
  const targetParts = parseSemverParts(target);
  const hasComparableVersions = currentParts !== null && targetParts !== null;
  if (!hasComparableVersions) return measurement("unknown", UNKNOWN_DIFF_DISTANCE);

  const type = semverDiffType(currentParts, targetParts);
  if (!type) return measurement("unknown", UNKNOWN_DIFF_DISTANCE);

  const size = SEMVER_DIFF_SIZE[type];
  const distance = releaseDistance(currentParts, targetParts, type);
  return measurement(size, distance);
};

const installedVersion = ({ latest, installed }: TableVersionDiff): string => {
  return installed || latest;
};

const targetForMode = (diff: TableVersionDiff, mode: VersionTableMode): string => {
  if (mode === "check") return diff.latest;
  return installedVersion(diff);
};

const tableDiffMeasurement = (diff: TableVersionDiff, mode: VersionTableMode): DiffMeasurement => {
  return diffMeasurement(diff.current, targetForMode(diff, mode));
};

const medianRisk = (diffs: TableVersionDiff[], mode: VersionTableMode): DiffMeasurement => {
  const fallback = measurement("unknown", UNKNOWN_DIFF_DISTANCE);
  const measurements = diffs
    .map((diff) => tableDiffMeasurement(diff, mode))
    .sort((left, right) => left.score - right.score);

  const hasMeasurements = measurements.length > 0;
  if (!hasMeasurements) return fallback;

  const medianIndex = Math.floor(measurements.length / 2);
  return measurements[medianIndex];
};

const targetVersionStyle = (current: string, target: string): TableCellStyle => {
  const measurement = diffMeasurement(current, target);
  const foreground = diffColor(measurement, DIFF_FOREGROUND_PALETTE);
  return {
    background: diffColor(measurement, DIFF_BACKGROUND_PALETTE),
    foreground: readableForeground(foreground),
    bold: true,
  };
};

const mutedVersionStyle = (): TableCellStyle => {
  return { foreground: MUTED_VERSION_COLOR };
};

export const formatVersionTableTitle = (
  diffs: TableVersionDiff[],
  mode: VersionTableMode = "update",
): string => {
  const title = VERSION_TABLE_TITLES[mode];
  const measurement = medianRisk(diffs, mode);
  const diamond = colorText("◆", fgColor(diffColor(measurement, DIFF_FOREGROUND_PALETTE)));
  const label = bold(cyan(`${title}:`));
  return `${diamond} ${label}`;
};

const checkRow = ({ package: packageName, current, latest }: TableVersionDiff): TableRow => ({
  Package: packageName,
  Current: current,
  Available: latest,
});

const checkRowStyle = ({ current, latest }: TableVersionDiff): TableRowStyle => ({
  Current: mutedVersionStyle(),
  Available: targetVersionStyle(current, latest),
});

const updateRow = ({
  package: packageName,
  current,
  latest,
  installed,
}: TableVersionDiff): TableRow => {
  const target = installed || latest;
  return {
    Package: packageName,
    Previous: current,
    Updated: target,
  };
};

const updateRowStyle = ({ current, latest, installed }: TableVersionDiff): TableRowStyle => {
  const target = installed || latest;
  return {
    Previous: mutedVersionStyle(),
    Updated: targetVersionStyle(current, target),
  };
};

const versionTableRows = (diffs: TableVersionDiff[], mode: VersionTableMode): TableRow[] => {
  if (mode === "check") return diffs.map(checkRow);
  return diffs.map(updateRow);
};

const versionTableRowStyles = (
  diffs: TableVersionDiff[],
  mode: VersionTableMode,
): TableRowStyle[] => {
  if (mode === "check") return diffs.map(checkRowStyle);
  return diffs.map(updateRowStyle);
};

const gradientColor = (ratio: number): string => {
  return fgColor(interpolateRgb(CODEPENDENCE_GRADIENT_START, CODEPENDENCE_GRADIENT_END, ratio));
};

const gradientRgb = (ratio: number): Rgb => {
  return interpolateRgb(CODEPENDENCE_GRADIENT_START, CODEPENDENCE_GRADIENT_END, ratio);
};

const characterRatio = (index: number, characterCount: number): number => {
  const lastIndex = Math.max(characterCount - 1, 1);
  return index / lastIndex;
};

const gradientCharacter = (character: string, index: number, characterCount: number): string => {
  const ratio = characterRatio(index, characterCount);
  return `${gradientColor(ratio)}${character}`;
};

export const gradient = (text: string): string => {
  const characters = Array.from(text);
  const coloredText = characters
    .map((character, index) => gradientCharacter(character, index, characters.length))
    .join("");
  const formattedText = `\x1b[1m${coloredText}\x1b[0m`;
  return formattedText;
};

const glimmerDistance = (index: number, frameIndex: number, characterCount: number): number => {
  const cursor = ((frameIndex % characterCount) + characterCount) % characterCount;
  const directDistance = Math.abs(index - cursor);
  return Math.min(directDistance, characterCount - directDistance);
};

const glimmerHighlightRatio = (
  index: number,
  frameIndex: number,
  characterCount: number,
  highlightWidth: number,
): number => {
  const distance = glimmerDistance(index, frameIndex, characterCount);
  const remainingHighlight = highlightWidth - distance;
  return clampRatio(remainingHighlight / highlightWidth);
};

const glimmerCharacterColor = (baseColor: Rgb, highlightRatio: number): Rgb => {
  return interpolateRgb(baseColor, GLIMMER_HIGHLIGHT_COLOR, highlightRatio);
};

const glimmerBaseColor = (index: number, characterCount: number): Rgb => {
  return gradientRgb(characterRatio(index, characterCount));
};

const glimmerColor = (
  index: number,
  { characters, frameIndex, highlightWidth }: GlimmerCharacterContext,
): Rgb => {
  const baseColor = glimmerBaseColor(index, characters.length);
  const highlightRatio = glimmerHighlightRatio(
    index,
    frameIndex,
    characters.length,
    highlightWidth,
  );
  return glimmerCharacterColor(baseColor, highlightRatio);
};

const glimmerCharacter = (
  character: string,
  index: number,
  context: GlimmerCharacterContext,
): string => {
  const color = glimmerColor(index, context);
  return `${fgColor(color)}${character}`;
};

export const glimmer = (text: string, options: GlimmerOptions = {}): string => {
  const characters = Array.from(text);
  if (characters.length === 0) return `${ANSI.BOLD}${ANSI.RESET}`;

  const frameIndex = options.frameIndex ?? 0;
  const highlightWidth = options.highlightWidth ?? GLIMMER_HIGHLIGHT_WIDTH;
  const context = { characters, frameIndex, highlightWidth };
  const coloredText = characters
    .map((character, index) => glimmerCharacter(character, index, context))
    .join("");

  return `${ANSI.BOLD}${coloredText}${ANSI.RESET}`;
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

const stylePrefix = ({ background, foreground, bold: isBold }: TableCellStyle): string => {
  const backgroundColor = background ? bgColor(background) : "";
  const foregroundColor = foreground ? fgColor(foreground) : "";
  const fontWeight = isBold ? ANSI.BOLD : "";
  return `${backgroundColor}${fontWeight}${foregroundColor}`;
};

const applyCellStyle = (value: string, style?: TableCellStyle): string => {
  if (!style) return value;

  const prefix = stylePrefix(style);
  if (!prefix) return value;

  return `${prefix}${value}${ANSI.RESET}`;
};

const visibleLength = (value: string): number => value.replace(createAnsiPattern(), "").length;

const truncateString = (value: string, width: number): string => {
  if (visibleLength(value) <= width) return value;

  const plainValue = value.replace(createAnsiPattern(), "");
  if (width <= 3) return ".".repeat(width);
  return `${plainValue.slice(0, width - 3)}...`;
};

const cellPadding = (): string => " ".repeat(TABLE_CELL_PADDING);

const paddedCellWidth = (width: number): number => width + TABLE_CELL_PADDING * 2;

const tableStructureWidth = (columnCount: number): number =>
  columnCount * (TABLE_CELL_PADDING * 2) + columnCount + 1;

const tableWidth = (columns: TableColumn[]): number =>
  columns.reduce((width, column) => width + column.width, tableStructureWidth(columns.length));

const columnWidth = (column: TableColumn, rows: TableRow[]): number => {
  const rowWidths = rows.map((row) => visibleLength(row[column.header] || ""));
  const widestRow = Math.max(0, ...rowWidths);
  return Math.max(column.width, visibleLength(column.header), widestRow);
};

const fitColumnsToTerminal = (columns: TableColumn[]): TableColumn[] => {
  const terminalWidth = process.stdout.columns || DEFAULT_WIDTH;
  const minimumTableWidth = tableStructureWidth(columns.length) + columns.length * 4;
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
  `${left}${columns.map(({ width }) => "─".repeat(paddedCellWidth(width))).join(join)}${right}`;

const tableCell = (
  { header, width, align }: TableColumn,
  row: TableRow,
  rowStyle: TableRowStyle,
): string => {
  const value = truncateString(row[header] || "", width);
  const paddedValue = padString(value, width, align);
  const cell = `${cellPadding()}${paddedValue}${cellPadding()}`;
  return applyCellStyle(cell, rowStyle[header]);
};

const tableRow = (columns: TableColumn[], row: TableRow, rowStyle: TableRowStyle = {}): string => {
  const cells = columns.map((column) => tableCell(column, row, rowStyle));
  return `│${cells.join("│")}│`;
};

export const createTable = (
  columns: TableColumn[],
  rows: TableRow[],
  rowStyles: TableRowStyle[] = [],
): string => {
  const fittedColumns = normalizeColumns(columns, rows);
  const top = tableBorder(fittedColumns, "┌", "┬", "┐");
  const headerValues = Object.fromEntries(
    fittedColumns.map(({ header }) => [header, cyan(header)]),
  );
  const header = tableRow(fittedColumns, headerValues);
  const middle = tableBorder(fittedColumns, "├", "┼", "┤");
  const content = rows.map((row, index) => tableRow(fittedColumns, row, rowStyles[index]));
  const bottom = tableBorder(fittedColumns, "└", "┴", "┘");
  return [top, header, middle].concat(content, bottom).join("\n");
};

export const formatVersionTable = (
  diffs: TableVersionDiff[],
  mode: VersionTableMode = "update",
): string => {
  const rows = versionTableRows(diffs, mode);
  const rowStyles = versionTableRowStyles(diffs, mode);
  return createTable(VERSION_TABLE_COLUMNS[mode], rows, rowStyles);
};
